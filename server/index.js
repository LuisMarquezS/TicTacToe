const cluster = require("cluster");
const os = require("os");
const WebSocket = require("ws");

const numCPUs = os.cpus().length;
const workers = {};

if (cluster.isMaster) {
  console.log(`🔧 Master PID ${process.pid} lanzando ${numCPUs} Workers...`);

  let jugadores = {}; 
  let salas = {};     
  let reiniciosPendientes = {};

  function broadcastActualizacion() {
    const listaJugadores = Object.keys(jugadores);
    const listaSalas = Object.keys(salas).map(nombreSala => ({
      nombre: nombreSala,
      cantidad: salas[nombreSala].jugadores.length
    }));

    for (const id in workers) {
      workers[id].send({ type: "broadcastListas", jugadores: listaJugadores, salas: listaSalas });
    }
  }

  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    workers[worker.id] = worker;
  }

  for (const id in workers) {
    workers[id].on("message", (message) => {
      const { type, data, idMensaje } = message;

      if (type === "registro") {
        if (jugadores[data.nombre]) {
          workers[id].send({ idMensaje, type: "error", mensaje: "Nombre ya en uso" });
        } else {
          jugadores[data.nombre] = id;
          workers[id].send({ idMensaje, type: "registroOK" });
          broadcastActualizacion();
        }
      }

      if (type === "crearSala") {
        if (salas[data.nombre]) {
          workers[id].send({ idMensaje, type: "error", mensaje: "La sala ya existe" });
        } else {
          salas[data.nombre] = { jugadores: [data.jugador], tablero: Array(9).fill("") };
          workers[id].send({ idMensaje, type: "esperandoJugador" });
          broadcastActualizacion();
        }
      }

      if (type === "unirseSala") {
        if (salas[data.nombreSala] && salas[data.nombreSala].jugadores.length === 1) {
          salas[data.nombreSala].jugadores.push(data.jugador);
          const jugadoresSala = salas[data.nombreSala].jugadores;
          const tablero = salas[data.nombreSala].tablero;

          jugadoresSala.forEach((nombre, index) => {
            const idWorker = jugadores[nombre];
            if (workers[idWorker]) {
              workers[idWorker].send({
                type: "inicioPartida",
                jugador: index === 0 ? "X" : "O",
                tuNombre: nombre,
                rival: jugadoresSala.find(n => n !== nombre),
                tablero
              });
            }
          });
          broadcastActualizacion();
        } else {
          workers[id].send({ idMensaje, type: "error", mensaje: "No se pudo unir a la sala" });
        }
      }

      if (type === "jugada") {
        const { sala, casilla, jugador } = data;
        if (salas[sala]) {
          salas[sala].tablero[casilla] = jugador;
          const tableroActual = salas[sala].tablero;
          const siguienteTurno = jugador === "X" ? "O" : "X"; // <--- Cambio agregado aquí
          console.log("✅ Tablero actualizado:", tableroActual); // ← Agrega esto para debug


          salas[sala].jugadores.forEach(nombre => {
            const idWorker = jugadores[nombre];
            if (workers[idWorker]) {
              workers[idWorker].send({
                type: "jugada",
                casilla,
                jugador,
                tablero: tableroActual,
                turno: siguienteTurno // <--- Cambio agregado aquí
              });
            }
          });
        }
      }

      if (type === "reiniciar") {
        const { sala, nombre } = data;
        if (!reiniciosPendientes[sala]) reiniciosPendientes[sala] = new Set();
        reiniciosPendientes[sala].add(nombre);

        if (reiniciosPendientes[sala].size === 2) {
          salas[sala].tablero = Array(9).fill("");
          salas[sala].jugadores.forEach(nombre => {
            const idWorker = jugadores[nombre];
            if (workers[idWorker]) {
              workers[idWorker].send({ type: "reiniciar" });
            }
          });
          reiniciosPendientes[sala] = new Set();
        } else {
          const rival = salas[sala].jugadores.find(n => n !== nombre);
          if (rival && workers[jugadores[rival]]) {
            workers[jugadores[rival]].send({ type: "solicitaReinicio" });
          }
        }
      }

      if (type === "salirSala") {
        const { sala, nombre } = data;
        if (salas[sala]) {
          const rival = salas[sala].jugadores.find(n => n !== nombre);
          if (rival && workers[jugadores[rival]]) {
            workers[jugadores[rival]].send({ type: "salaCerrada" });
          }
          delete salas[sala];
          delete reiniciosPendientes[sala];
        }
        broadcastActualizacion();
      }

      if (type === "desconectar") {
        const { nombre } = data;
        if (jugadores[nombre]) delete jugadores[nombre];

        for (const salaNombre in salas) {
          salas[salaNombre].jugadores = salas[salaNombre].jugadores.filter(n => n !== nombre);
          if (salas[salaNombre].jugadores.length === 0) {
            delete salas[salaNombre];
            delete reiniciosPendientes[salaNombre];
          }
        }
        broadcastActualizacion();
      }
    });
  }

  cluster.on("exit", (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} murió. Reiniciando...`);
    const newWorker = cluster.fork();
    workers[newWorker.id] = newWorker;
  });

} else {
  const wss = new WebSocket.Server({ port: 3000 + cluster.worker.id });
  const clientes = new Set();
  const pendingRequests = {};

  console.log(`✅ Worker PID ${process.pid} escuchando en ws://localhost:${3000 + cluster.worker.id}`);

  wss.on("connection", (ws) => {
    clientes.add(ws);

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);
      const idMensaje = Math.random().toString(36).substr(2, 9);

      pendingRequests[idMensaje] = ws;

      if (data.type === "registro") {
        ws.nombre = data.nombre;
        process.send({ type: "registro", idMensaje, data: { nombre: data.nombre } });
      }
      if (data.type === "crearSala") {
        ws.sala = data.nombre; 
        process.send({ type: "crearSala", idMensaje, data: { nombre: data.nombre, jugador: ws.nombre } });
      }
      if (data.type === "unirseSala") {
        ws.sala = data.nombre;
        process.send({ type: "unirseSala", idMensaje, data: { nombreSala: data.nombre, jugador: ws.nombre } });
      }
      if (data.type === "jugada") {
        process.send({ type: "jugada", idMensaje, data: { sala: ws.sala, casilla: data.casilla, jugador: data.jugador } });
      }
      if (data.type === "reiniciar") {
        process.send({ type: "reiniciar", idMensaje, data: { sala: ws.sala, nombre: ws.nombre } });
      }
      if (data.type === "salirSala") {
        process.send({ type: "salirSala", idMensaje, data: { sala: ws.sala, nombre: ws.nombre } });
      }
    });

    ws.on("close", () => {
      if (ws.nombre) {
        process.send({ type: "desconectar", data: { nombre: ws.nombre } });
      }
      clientes.delete(ws);
    });
  });

  process.on("message", (message) => {
    if (message.type === "broadcastListas") {
      const dataJugadores = JSON.stringify({ type: "listaJugadores", jugadores: message.jugadores });
      const dataSalas = JSON.stringify({ type: "listaSalas", salas: message.salas });
      clientes.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(dataJugadores);
          ws.send(dataSalas);
        }
      });
    } else if (message.idMensaje && pendingRequests[message.idMensaje]) {
      const ws = pendingRequests[message.idMensaje];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
      delete pendingRequests[message.idMensaje];
    } else {
  if (message.type === "inicioPartida") {
    clientes.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.nombre === message.tuNombre) {
        ws.send(JSON.stringify(message));
      }
    });
  } else {
    clientes.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}
  });
}
