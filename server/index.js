// Servidor WebSocket usando multiprogramación con 'cluster' para procesos hijos
const cluster = require("cluster");
const os = require("os");
const WebSocket = require("ws");

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`🔧 Master PID ${process.pid} corriendo - iniciando ${numCPUs} procesos hijos`);

  // Crea un proceso hijo por núcleo de CPU
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Escucha eventos cuando un proceso hijo termina
  cluster.on("exit", (worker, code, signal) => {
    console.log(`⚠️ Worker ${worker.process.pid} murió. Reiniciando...`);
    cluster.fork();
  });

} else {
  // Código que corre en cada proceso hijo
  const wss = new WebSocket.Server({ port: 3001 });
  console.log(`✅ Worker PID ${process.pid} escuchando en ws://localhost:3001`);

  // Estructuras locales de cada proceso (no compartidas entre workers)
  let jugadores = {};               // { nombre: ws }
  let salas = {};                   // { nombreSala: [nombre1, nombre2] }
  let reiniciosPendientes = {};    // { nombreSala: Set(nombres) }

  function broadcastListaJugadores() {
    const nombres = Object.keys(jugadores);
    const mensaje = JSON.stringify({ type: "listaJugadores", jugadores: nombres });
    Object.values(jugadores).forEach(ws => ws.send(mensaje));
  }

  function broadcastListaSalas() {
    const listaSalas = Object.entries(salas).map(([nombre, jugadores]) => ({ nombre, cantidad: jugadores.length }));
    const mensaje = JSON.stringify({ type: "listaSalas", salas: listaSalas });
    Object.values(jugadores).forEach(ws => ws.send(mensaje));
  }

  wss.on("connection", (ws) => {
    console.log("🧩 Cliente conectado a PID", process.pid);

    ws.on("message", (msg) => {
      const data = JSON.parse(msg);

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
      }

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

      if (data.type === "unirseSala") {
        const nombreSala = data.nombre;
        if (salas[nombreSala] && salas[nombreSala].length === 1) {
          salas[nombreSala].push(ws.usuario);
          ws.sala = nombreSala;

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

    ws.on("close", () => {
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

      console.log(`❌ Cliente desconectado de PID ${process.pid}: ${nombre || "desconocido"}`);
    });
  });
}
