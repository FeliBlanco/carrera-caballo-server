const express = require('express')
const cors = require('cors');
const bodyParser = require('body-parser');
const { createServer } = require('node:http');
const http = require('http')

const { Server } = require("socket.io");


const app = express();

app.use(cors({origin:'http://localhost'}));
app.use(bodyParser.json())

app.set('PORT', process.env.PORT || 3000);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"],
        credentials: true
    }
});

server.listen(app.get('PORT'), () => {
    console.log(`Servidor abierto en puerto ${app.get('PORT')}`);
})

let jugadores = [-1, -1, -1]

let infoJuego = {
    empezo: false,
    jugadores: []
}


app.get('/', (req, res) => {
    res.send("anda")
})

app.get('/getInfo', (req, res) => {
    res.send({code: 1, data: infoJuego})
})

app.post('/unirse', (req, res) => {
    const { username } = req.body;
    if(!username) return res.status(500).send({msg_err: 'username is required.'});

    let jugadorid = -1;

    for(let i = 0; i < jugadores.length; i++) {
        if(jugadores[i] == -1) {
            jugadorid = i;
            break;
        }
    }

    if(jugadorid == -1 || infoJuego.jugadores.length >= 3)return res.send({code: 2})

    infoJuego.jugadores.push({
        username,
        id: jugadorid
    })

    jugadores[jugadorid] = infoJuego.jugadores.length - 1;

    if(infoJuego.jugadores.length >= 3) {
        comenzarJuego();
    }

    res.send({code: 1, data: infoJuego})
})

const comenzarJuego = () => {

}