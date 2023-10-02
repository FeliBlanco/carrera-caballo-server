const express = require('express')
const cors = require('cors');
const bodyParser = require('body-parser');
//const { createServer } = require('node:https');
const http = require('http')
const fs = require('fs')

const { Server } = require('socket.io');


const app = express();

app.use(cors(/*{origin: ['https://tottobene.000webhostapp.com/', 'http://localhost'], credentials: false}*/));
app.use(bodyParser.json())

app.set('PORT', 2087);

/*const privateKey = fs.readFileSync('/var/www/getyn.com.ar/certs/key.pem');
const certificate = fs.readFileSync('/var/www/getyn.com.ar/certs/cert.pem');

const credentials = {
	key: privateKey,
	cert: certificate,
};*/


const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ['http://localhost', 'https://tottobene.000webhostapp.com'],
        methods: ['POST', 'GET'],
        credentials: true
    },
    allowEIO3: true
});


let jugadores = [-1, -1, -1]

let infoJuego = {
    empezo: false,
    conteo: 3,
    jugadores: [],
    puesto: 0,
    cantidadCaballos: 3,
    puedenmover: false,
    segundos: 0
}

let contador = null;

const resetearJuego = () => {
    infoJuego = {
        empezo: false,
        conteo: 3,
        jugadores: [],
        puesto: 0,
        cantidadCaballos: 3,
        puedenmover: false,
        segundos: 0
    }

    jugadores = [-1, -1, -1]
    io.emit('resetjuego', infoJuego)

    if(contador != null)
    {
        clearInterval(contador);
        contador = null;
    }

}


io.on('connection', (socket) => {
    console.log("se conecto alguien")

    socket.on('movercaballo-client', (data) => {
        if(data.position >= 93) {
            infoJuego.puesto ++;
            if(infoJuego.jugadores[data.user]) {
                io.emit("ganador", {user: infoJuego.jugadores[data.user], puesto: infoJuego.puesto, tiempo: getTiempo(infoJuego.segundos)})
            }
            if(infoJuego.puesto == 2) {
                //resetearJuego()
                infoJuego.puedenmover = false;
                io.emit('actualizarjuego', infoJuego)

                setTimeout(() => {
                    resetearJuego()
                }, 1000 * 5)
            }
        } else {
            io.emit('movercaballo', data)
        }
    })

    socket.on('disconnect', () => {
        console.log("disconnect")

        for(let i = 0; i < infoJuego.jugadores.length; i++) {
            if(infoJuego.jugadores[i]) {

                if(infoJuego.jugadores[i].socketid == socket.id) {
                    const data = infoJuego.jugadores[i];
       
                    if(infoJuego.empezo == false) {
                        jugadores[data.id] = -1;
                        infoJuego.jugadores.splice(i, 1);
                        io.emit('jugadoroff', data.id)
                    } else {
                        infoJuego.jugadores[i].conectado = false;
                        verificarJuego()
                    }
                    console.log("SE ENCONTRO UN JUGADOR Q SALIO")
                }
            }

        }
        console.log("disconnect")
        console.log(socket.id)

    })

})

  
app.get('/', (req, res) => {
    res.send("anda")
})

app.get('/getInfo', (req, res) => {
    res.send({code: 1, data: infoJuego})
})

app.post('/unirse', (req, res) => {
    const { username, socketid } = req.body;
    if(!username) return res.status(500).send({msg_err: 'username is required.'});
    if(!socketid) return res.status(500).send({msg_err: 'socketid is required.'});

    let jugadorid = -1;

    for(let i = 0; i < jugadores.length; i++) {
        if(jugadores[i] == -1) {
            jugadorid = i;
            break;
        }
    }

    if(jugadorid == -1 || infoJuego.jugadores.length >= 3)return res.send({code: 2})

    let infouser = {
        username,
        id: jugadorid,
        socketid: socketid,
        conectado: true       
    }

    infoJuego.jugadores.push(infouser)
    io.emit('actualizarjuego', infoJuego)

    jugadores[jugadorid] = infoJuego.jugadores.length - 1;

    io.emit('nuevojugador', infouser)

    if(infoJuego.jugadores.length >= 3) {
        comenzarJuego();
    }

    res.send({code: 1, data: infouser})
})

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
            infoJuego.puedenmover = true;
            io.emit('actualizarjuego', infoJuego)
            io.emit('conteo', 'off');
            if(contador != null)
            {
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
    console.log("VerificarJuego")
    if(infoJuego.jugadores.every(i => i.conectado == false)) {
        console.log("SE RESETEA EL JUEGO")

        resetearJuego()
    }
}

server.listen(app.get('PORT'), () => {
    console.log(`Servidor abierto en puerto ${app.get('PORT')}`);
})

const getTiempo = (segundos) => {
    let minutos = Math.floor(segundos / 60);
    segundos -= (minutos * 60);

    return `${minutos}:${segundos}`
}