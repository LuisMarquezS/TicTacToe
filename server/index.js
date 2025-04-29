// index.js - Servidor Local con Cluster configurado pero solo 1 Worker activo (para que todo funcione como antes)
const cluster = require("cluster");
const os = require("os");
const WebSocket = require("ws");

  // Configuración del cluster
const numCPUs = 8;

if (cluster.isMaster) {
  console.log(`🔧 Master PID ${process.pid} corriendo - iniciando ${numCPUs} proceso hijo`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on("exit", (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} murió. Reiniciando...`);
    cluster.fork();
  });

} else {
  let jugadores = {}; // { nombre: socket }
  let salas = {}; // { nombreSala: { jugadores: [nombre1, nombre2], tablero: [] } }
  let reiniciosPendientes = {}; // { nombreSala: Set }

  const wss = new WebSocket.Server({ port: 3001 });
  console.log(`✅ Worker PID ${process.pid} escuchando en ws://localhost:3001`);

  function broadcastListas() {
    const listaJugadores = Object.keys(jugadores);
    const listaSalas = Object.keys(salas).map(nombreSala => ({
      nombre: nombreSala,
      cantidad: salas[nombreSala].jugadores.length
    }));

    const dataJugadores = JSON.stringify({ type: "listaJugadores", jugadores: listaJugadores });
    const dataSalas = JSON.stringify({ type: "listaSalas", salas: listaSalas });

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(dataJugadores);
        client.send(dataSalas);
      }
    });
  }
// Broadcast de las listas de jugadores y salas a todos los clientes conectados
  wss.on("connection", (ws) => {
    ws.on("message", (msg) => {
      const data = JSON.parse(msg);
// Manejo de mensajes del cliente
      if (data.type === "registro") {
        if (jugadores[data.nombre]) {
          ws.send(JSON.stringify({ type: "error", mensaje: "Nombre ya en uso" }));
          return;
        }
        ws.nombre = data.nombre;
        jugadores[data.nombre] = ws;
        ws.send(JSON.stringify({ type: "registroOK" }));
        broadcastListas();
      }

      if (data.type === "crearSala") {
        if (salas[data.nombre]) {
          ws.send(JSON.stringify({ type: "error", mensaje: "La sala ya existe" }));
          return;
        }
        salas[data.nombre] = { jugadores: [ws.nombre], tablero: Array(9).fill("") };
        ws.sala = data.nombre;
        ws.send(JSON.stringify({ type: "esperandoJugador" }));
        broadcastListas();
      }

      if (data.type === "unirseSala") {
        if (salas[data.nombre] && salas[data.nombre].jugadores.length === 1) {
          salas[data.nombre].jugadores.push(ws.nombre);
          ws.sala = data.nombre;
          const jugadoresSala = salas[data.nombre].jugadores;
          const tablero = salas[data.nombre].tablero;

          jugadoresSala.forEach((nombre, index) => {
            if (jugadores[nombre]) {
              jugadores[nombre].send(JSON.stringify({
                type: "inicioPartida",
                jugador: index === 0 ? "X" : "O",
                tuNombre: nombre,
                rival: jugadoresSala.find(n => n !== nombre),
                tablero: tablero
              }));
            }
          });
          broadcastListas();
        }
      }
// El cliente envía un mensaje de jugada
      if (data.type === "jugada") {
        const sala = ws.sala;
        if (!sala) return;
        salas[sala].tablero[data.casilla] = data.jugador;
        const tableroActual = salas[sala].tablero;

        salas[sala].jugadores.forEach(nombre => {
          if (jugadores[nombre]) {
            jugadores[nombre].send(JSON.stringify({
              type: "jugada",
              casilla: data.casilla,
              jugador: data.jugador,
              tablero: tableroActual
            }));
          }
        });
      }
// El cliente envía un mensaje de reinicio
      if (data.type === "reiniciar") {
        const sala = ws.sala;
        if (!sala) return;
        if (!reiniciosPendientes[sala]) reiniciosPendientes[sala] = new Set();
        reiniciosPendientes[sala].add(ws.nombre);

        if (reiniciosPendientes[sala].size === 2) {
          salas[sala].tablero = Array(9).fill("");
          salas[sala].jugadores.forEach(nombre => {
            if (jugadores[nombre]) {
              jugadores[nombre].send(JSON.stringify({ type: "reiniciar" }));
            }
          });
          reiniciosPendientes[sala] = new Set();
        } else {
          const rival = salas[sala].jugadores.find(nombre => nombre !== ws.nombre);
          if (jugadores[rival]) {
            jugadores[rival].send(JSON.stringify({ type: "solicitaReinicio" }));
          }
        }
      }
// El cliente envía un mensaje de salir de la sala
      if (data.type === "salirSala") {
        const sala = ws.sala;
        if (!sala) return;

        const rival = salas[sala].jugadores.find(nombre => nombre !== ws.nombre);
        if (jugadores[rival]) {
          jugadores[rival].send(JSON.stringify({ type: "salaCerrada" }));
        }

        delete salas[sala];
        delete reiniciosPendientes[sala];
        ws.sala = null;
        broadcastListas();
      }
    });
// El cliente se desconecta
    ws.on("close", () => {
      const nombre = ws.nombre;
      if (nombre) delete jugadores[nombre];

      const sala = ws.sala;
      if (sala && salas[sala]) {
        salas[sala].jugadores = salas[sala].jugadores.filter(n => n !== nombre);
        if (salas[sala].jugadores.length === 0) {
          delete salas[sala];
          delete reiniciosPendientes[sala];
        }
      }
      broadcastListas();
    });
  });
}
