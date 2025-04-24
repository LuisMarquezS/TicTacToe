// Importa el módulo WebSocket para crear el servidor
const WebSocket = require('ws');

// Crea el servidor WebSocket en el puerto 3001
const wss = new WebSocket.Server({ port: 3001 });
console.log('🟢 Servidor WebSocket escuchando en ws://localhost:3001');

// Diccionarios para manejar jugadores y salas
let jugadores = {};               // { nombre: ws }
let salas = {};                   // { nombreSala: [nombre1, nombre2] }
let reiniciosPendientes = {};    // { nombreSala: Set(nombres) }

// Envía la lista actual de jugadores conectados a todos los clientes
function broadcastListaJugadores() {
  const nombres = Object.keys(jugadores);
  const mensaje = JSON.stringify({ type: "listaJugadores", jugadores: nombres });
  Object.values(jugadores).forEach(ws => {
    ws.send(mensaje);
  });
}

// Envía la lista de salas disponibles con su número de jugadores
function broadcastListaSalas() {
  const listaSalas = Object.entries(salas).map(([nombre, jugadores]) => ({
    nombre,
    cantidad: jugadores.length
  }));
  const mensaje = JSON.stringify({ type: "listaSalas", salas: listaSalas });
  Object.values(jugadores).forEach(ws => {
    ws.send(mensaje);
  });
}

// Maneja una nueva conexión WebSocket
wss.on('connection', (ws) => {
  console.log("🧩 Cliente conectado");

  // Manejo de mensajes entrantes desde un cliente
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    // Registro de nombre único por jugador
    if (data.type === "registro") {
      const nombre = data.nombre;
      if (jugadores[nombre]) {
        ws.send(JSON.stringify({ type: "error", mensaje: "Nombre ya en uso" }));
        return;
      }
      ws.usuario = nombre;
      jugadores[nombre] = ws;
      ws.send(JSON.stringify({ type: "registroOK" }));
      broadcastListaJugadores();
      broadcastListaSalas();
      return;
    }

    // Crear una nueva sala
    if (data.type === "crearSala") {
      const nombreSala = data.nombre;
      if (salas[nombreSala]) {
        ws.send(JSON.stringify({ type: "error", mensaje: "La sala ya existe" }));
        return;
      }
      salas[nombreSala] = [ws.usuario];
      ws.sala = nombreSala;
      ws.send(JSON.stringify({ type: "esperandoJugador" }));
      broadcastListaSalas();
    }

    // Unirse a una sala ya existente
    if (data.type === "unirseSala") {
      const nombreSala = data.nombre;
      if (salas[nombreSala] && salas[nombreSala].length === 1) {
        salas[nombreSala].push(ws.usuario);
        ws.sala = nombreSala;

        // Inicia partida para ambos jugadores
        salas[nombreSala].forEach((nombre, index) => {
          const rival = salas[nombreSala].find(n => n !== nombre);
          const cliente = jugadores[nombre];
          cliente.send(JSON.stringify({
            type: "inicioPartida",
            jugador: index === 0 ? "X" : "O",
            tuNombre: nombre,
            rival: rival
          }));
        });
        reiniciosPendientes[nombreSala] = new Set();
        broadcastListaSalas();
      }
    }

    // Reenvía jugada al rival
    if (data.type === "jugada") {
      const sala = salas[ws.sala];
      if (sala && sala.length === 2) {
        const rival = sala.find(n => n !== ws.usuario);
        jugadores[rival].send(JSON.stringify({
          type: "jugada",
          casilla: data.casilla,
          jugador: data.jugador
        }));
      }
    }

    // Manejo de solicitud de reinicio de partida
    if (data.type === "reiniciar") {
      const sala = ws.sala;
      if (!sala || !salas[sala]) return;

      if (!reiniciosPendientes[sala]) {
        reiniciosPendientes[sala] = new Set();
      }

      reiniciosPendientes[sala].add(ws.usuario);

      if (reiniciosPendientes[sala].size === 2) {
        salas[sala].forEach(nombre => {
          jugadores[nombre].send(JSON.stringify({ type: "reiniciar" }));
        });
        reiniciosPendientes[sala].clear();
      } else {
        const rival = salas[sala].find(n => n !== ws.usuario);
        jugadores[rival].send(JSON.stringify({ type: "solicitaReinicio" }));
      }
    }

    // Jugador abandona la sala
    if (data.type === "salirSala") {
      const sala = salas[ws.sala];
      if (sala) {
        const rival = sala.find(n => n !== ws.usuario);
        if (rival && jugadores[rival]) {
          jugadores[rival].send(JSON.stringify({ type: "salaCerrada" }));
        }
        delete salas[ws.sala];
        delete reiniciosPendientes[ws.sala];
        broadcastListaSalas();
      }
    }
  });

  // Manejo de desconexión del cliente
  ws.on('close', () => {
    const nombre = ws.usuario;
    if (nombre && jugadores[nombre]) {
      delete jugadores[nombre];
      broadcastListaJugadores();
    }

    const sala = ws.sala;
    if (sala && salas[sala]) {
      const rival = salas[sala].find(n => n !== nombre);
      if (rival && jugadores[rival]) {
        jugadores[rival].send(JSON.stringify({ type: "salaCerrada" }));
      }
      delete salas[sala];
      delete reiniciosPendientes[sala];
      broadcastListaSalas();
    }

    console.log(`❌ Cliente desconectado: ${nombre || "desconocido"}`);
  });
});