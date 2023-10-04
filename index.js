const express = require('express')
const cors = require('cors');
const bodyParser = require('body-parser');
//const { createServer } = require('node:https');
const https = require('https')
const fs = require('fs')
const { Server } = require('socket.io');


const app = express();

/* EXPRESS CONFIG */

app.use(cors(/*{origin: ['https://tottobene.000webhostapp.com/', 'http://localhost'], credentials: false}*/));
app.use(bodyParser.json())

app.set('PORT', 2087);

/* CONFIGURACION CERTIFICADOS SSL */
const privateKey = fs.readFileSync('/var/www/getyn.com.ar/certs/key.pem');
const certificate = fs.readFileSync('/var/www/getyn.com.ar/certs/cert.pem');


const credentials = {
	key: privateKey,
	cert: certificate,
};

/* CREAR SERVER HTTP / HTTPS */
const server = https.createServer(credentials, app);

/* CONEXION SOCKET */
const io = new Server(server, {
    cors: {
        origin: ['http://localhost', 'https://tottobene.000webhostapp.com'],
        methods: ['POST', 'GET'],
        credentials: true
    },
    allowEIO3: true
});

/* CONFIGURACION */

const CANTIDAD_JUGADORES = 3;

let jugadores = [-1, -1, -1]

let infoJuego = {
    empezo: false,
    conteo: 3,
    jugadores: [],
    puesto: 0,
    cantidadCaballos: 3,
    puedenmover: false,
    segundos: 0,
    resetear:5
}
 

/* TIMERS */

let resetInterval = null;
let contador = null;

/* CALLBACKS SOCKET */

io.on('connection', (socket) => {
    console.log("se conecto alguien")


    /* ACTUALIZAR LOS CABALLOS PARA TODOS (Cuando el jugador aprieta la tecla) */
    socket.on('movercaballo-client', (data) => {
        if(infoJuego.jugadores[data.user].termino == true) return;
        if(data.position >= 93) {
            // LLEGÓ A LA META
            infoJuego.puesto ++;
            if(infoJuego.jugadores[data.user]) {
                infoJuego.jugadores[data.user].termino = true;
                // SOCKET: ANUNCIA EL GANADOR
                io.emit("ganador", {user: infoJuego.jugadores[data.user], puesto: infoJuego.puesto, tiempo: getTiempo(infoJuego.segundos)})
            }
            if(infoJuego.puesto == 2 || infoJuego.jugadores.every(i => i.conectado == false || i.termino == true)) {
                // YA HAY 2 GANADORES, INICIA CONTADOR PARA RESETEAR JUEGO
                //resetearJuego()
                infoJuego.puedenmover = false;
                io.emit('actualizarjuego', infoJuego);

                /* TIMER RESETEAR */

                if(resetInterval != null) clearInterval(resetInterval)

                resetInterval = setInterval(() => {
                    infoJuego.resetear -= 1;
                    if(infoJuego.resetear <= 0) {
                        resetearJuego()
                        clearInterval(resetInterval)
                        resetInterval = null;
                    } else {
                        io.emit('resetcontador', infoJuego.resetear)
                    }
                }, 1000)
            }
        } else {
            //NO LLEGÓ A LA META, ENTONCES ACTUALIZA
            io.emit('movercaballo', data)
        }
    })

    socket.on('disconnect', () => {
        console.log("disconnect")

        // CUANDO ALGUIEN SE DESCONECTA BUSCA SI ES JUGADOR
        for(let i = 0; i < infoJuego.jugadores.length; i++) {
            if(infoJuego.jugadores[i]) {
                if(infoJuego.jugadores[i].socketid == socket.id) {
                    const data = infoJuego.jugadores[i];
       
                    if(infoJuego.empezo == false) {
                        // SI ESTÁ ANOTADO PARA JUGAR LO SACÁ DE LA LISTA
                        jugadores[data.id] = -1;
                        infoJuego.jugadores.splice(i, 1);
                        // SCOKET: LIBERA EL ESPACIO DE LA LISTA
                        io.emit('jugadoroff', data.id)
                    } else {
                        // SI YA ESTÁ JUGANDO SÓLO LO MARCA COMO DESCONECTADO
                        infoJuego.jugadores[i].conectado = false;
                        // VERIFICA SI ESTAN TODOS DESCONECTADOS PARA RESETEAR EL JUEGO
                        verificarJuego();
                    }
                    console.log("SE ENCONTRO UN JUGADOR Q SALIO")
                }
            }

        }
    })

})

  
app.get('/', (req, res) => {
    res.send("Hola")
})

app.get('/getInfo', (req, res) => {
    // OBTIENE LA INFORMACIÓN DEL JUEGO
    res.send({code: 1, data: infoJuego})
})

app.post('/unirse', (req, res) => {
    const { username, socketid } = req.body;
    if(!username) return res.status(500).send({msg_err: 'username is required.'});
    if(!socketid) return res.status(500).send({msg_err: 'socketid is required.'});

    let jugadorid = -1;

    // BUSCA SI HAY LUGAR DISPONIBLE
    for(let i = 0; i < jugadores.length; i++) {
        if(jugadores[i] == -1) {
            jugadorid = i;
            break;
        }
    }

    if(jugadorid == -1 || infoJuego.jugadores.length >= CANTIDAD_JUGADORES) return res.send({code: 2})

    const buscarNombre = infoJuego.jugadores.findIndex(i => i.username.toLowerCase() == username.toLowerCase());
    if(buscarNombre != -1) return res.send({code: 3});

    let infouser = {
        username,
        id: jugadorid,
        socketid: socketid,
        conectado: true,
        termino: false  
    }

    infoJuego.jugadores.push(infouser)

    // SOCKET: ACTUALIZA LOS DATOS DEL JUEGO
    io.emit('actualizarjuego', infoJuego)

    jugadores[jugadorid] = infoJuego.jugadores.length - 1;

    // SOCKET: AGREGA AL NUEVO JUGADOR A LA LISTA
    io.emit('nuevojugador', infouser)

    // SI YA HAY 3 JUGADORES ANOTADOS COMIENZA EL JUEGO
    if(infoJuego.jugadores.length >= CANTIDAD_JUGADORES) {
        comenzarJuego();
    }

    res.send({code: 1, data: infouser})
})


/*   FUNCIONES    */

const resetearJuego = () => {
    infoJuego = {
        empezo: false,
        conteo: 3,
        jugadores: [],
        puesto: 0,
        cantidadCaballos: 3,
        puedenmover: false,
        segundos: 0,
        resetear: 5
    }

    jugadores = []
    for(let i = 0; i < CANTIDAD_JUGADORES; i++) {
        jugadores[i] = -1;
    }

    io.emit('resetjuego', infoJuego)

    if(contador != null) {
        clearInterval(contador);
        contador = null;
    }
}


const comenzarJuego = () => {
    console.log("EMPEZAR JUEGO")
    if(infoJuego.empezo == true) return;
    infoJuego.conteo = 3;
    infoJuego.empezo = true;
    infoJuego.puedenmover = false;
    io.emit('conteo', infoJuego.conteo);
    io.emit('actualizarjuego', infoJuego)
    iniciarConteo();
}

const iniciarConteo = () => {
    console.log("iniciar conteo")
    setTimeout(() => {
        if(infoJuego.conteo == 0) {
            /* PERMITE A LOS JUGADORES PODER MOVERSE */
            infoJuego.puedenmover = true;
            io.emit('actualizarjuego', infoJuego)
            io.emit('conteo', 'off');

            /* CONTADOR QUE LLEVA EL TIEMPO DEL JUEGO */
            if(contador != null){
                clearInterval(contador);
                contador = null;
            }

            contador = setInterval(() => {
                infoJuego.segundos += 1;
                io.emit('contador', getTiempo(infoJuego.segundos));
            }, 1000)
        } else {
            infoJuego.conteo = infoJuego.conteo - 1;
            io.emit('conteo', infoJuego.conteo);
            iniciarConteo();
        }
    }, 1000)
}

const verificarJuego = () => {
    if(infoJuego.jugadores.every(i => i.conectado == false) || infoJuego.jugadores.every(i => (i.conectado == false || i.termino == true))) {
        console.log("SE RESETEA EL JUEGO")
        resetearJuego()
    }
}


const getTiempo = (segundos) => {
    // PASAMOS DE SEGUNDOS A FORMATO MINUTOS:SEGUNDOS
    let minutos = Math.floor(segundos / 60);
    segundos -= (minutos * 60);
    
    return `${minutos < 10 ? '0' : ''}${minutos}:${segundos < 10 ? '0' : ''}${segundos}`
}


server.listen(app.get('PORT'), () => {
    console.log(`Servidor abierto en puerto ${app.get('PORT')}`);
})