// index.js actualizado con fixes de sincronización y limpieza en Redis
const cluster = require("cluster");
const os = require("os");
const WebSocket = require("ws");
const { createClient } = require("redis");

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`🔧 Master PID ${process.pid} corriendo - iniciando ${numCPUs} procesos hijos`);
  for (let i = 0; i < numCPUs; i++) cluster.fork();

  cluster.on("exit", (worker) => {
    console.log(`⚠️ Worker ${worker.process.pid} murió. Reiniciando...`);
    cluster.fork();
  });

} else {
  const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });

  redis.on("error", (err) => console.error("Redis error:", err));

  redis.connect().then(() => {
    console.log(`🟢 [PID ${process.pid}] Conectado a Redis`);
    const wss = new WebSocket.Server({ port: 3001 });
    console.log(`✅ Worker PID ${process.pid} escuchando en ws://localhost:3001`);

    wss.on("connection", (ws) => {
      console.log("🧩 Cliente conectado en PID", process.pid);

      ws.on("message", async (msg) => {
        const data = JSON.parse(msg);

        if (data.type === "registro") {
          const nombre = data.nombre;
          const yaExiste = await redis.hExists("jugadores", nombre);
          if (yaExiste) {
            ws.send(JSON.stringify({ type: "error", mensaje: "Nombre ya en uso" }));
            return;
          }
          ws.usuario = nombre;
          ws.sala = null;
          await redis.hSet("jugadores", nombre, "activo");
          ws.send(JSON.stringify({ type: "registroOK" }));
          await enviarListasGlobal();
        }

        if (data.type === "crearSala") {
          const nombreSala = data.nombre;
          const existe = await redis.exists(`sala:${nombreSala}`);
          if (existe) {
            ws.send(JSON.stringify({ type: "error", mensaje: "La sala ya existe" }));
            return;
          }
          ws.sala = nombreSala;
          await redis.rPush(`sala:${nombreSala}`, ws.usuario);
          ws.send(JSON.stringify({ type: "esperandoJugador" }));
          await enviarListasGlobal();
        }

        if (data.type === "unirseSala") {
          const nombreSala = data.nombre;
          const jugadoresSala = await redis.lRange(`sala:${nombreSala}`, 0, -1);
          if (jugadoresSala.length === 1) {
            await redis.rPush(`sala:${nombreSala}`, ws.usuario);
            ws.sala = nombreSala;
            const jugadores = [...jugadoresSala, ws.usuario];

            for (const nombre of jugadores) {
              const target = [...wss.clients].find(c => c.usuario === nombre);
              if (target) {
                target.send(JSON.stringify({
                  type: "inicioPartida",
                  jugador: nombre === jugadores[0] ? "X" : "O",
                  tuNombre: nombre,
                  rival: jugadores.find(n => n !== nombre)
                }));
              }
            }
            await enviarListasGlobal();
          }
        }

        if (data.type === "jugada") {
          const sala = ws.sala;
          if (!sala) return;
          const jugadores = await redis.lRange(`sala:${sala}`, 0, -1);
          for (const nombre of jugadores) {
            const target = [...wss.clients].find(c => c.usuario === nombre);
            if (target) {
              target.send(JSON.stringify({
                type: "jugada",
                casilla: data.casilla,
                jugador: data.jugador
              }));
            }
          }
        }

        if (data.type === "reiniciar") {
          const sala = ws.sala;
          if (!sala) return;
          await redis.sAdd(`reinicio:${sala}`, ws.usuario);
          const reinicios = await redis.sMembers(`reinicio:${sala}`);

          if (reinicios.length === 2) {
            const jugadores = await redis.lRange(`sala:${sala}`, 0, -1);
            for (const nombre of jugadores) {
              const target = [...wss.clients].find(c => c.usuario === nombre);
              if (target) target.send(JSON.stringify({ type: "reiniciar" }));
            }
            await redis.del(`reinicio:${sala}`);
          } else {
            const jugadores = await redis.lRange(`sala:${sala}`, 0, -1);
            const rival = jugadores.find(n => n !== ws.usuario);
            const target = [...wss.clients].find(c => c.usuario === rival);
            if (target) target.send(JSON.stringify({ type: "solicitaReinicio" }));
          }
        }

        if (data.type === "salirSala") {
          const sala = ws.sala;
          if (!sala) return;
          const jugadores = await redis.lRange(`sala:${sala}`, 0, -1);
          const rival = jugadores.find(n => n !== ws.usuario);
          if (rival) {
            const target = [...wss.clients].find(c => c.usuario === rival);
            if (target) target.send(JSON.stringify({ type: "salaCerrada" }));
          }
          await redis.del(`sala:${sala}`);
          await redis.del(`reinicio:${sala}`);
          await enviarListasGlobal();
        }

        setInterval(async () => {
          const keys = await redis.keys("sala:*");
          for (const key of keys) {
            const jugadores = await redis.lRange(key, 0, -1);
            if (jugadores.length === 0) {
              await redis.del(key);
              await redis.del(`reinicio:${key.replace("sala:", "")}`);
            }
          }
        }, 10000);
      
      
        
      });

      ws.on("close", async () => {
        const nombre = ws.usuario;
        const sala = ws.sala;
      
        if (nombre) await redis.hDel("jugadores", nombre);
      
        if (sala) {
          await redis.lRem(`sala:${sala}`, 0, nombre); // elimina al jugador de la sala
      
          const jugadores = await redis.lRange(`sala:${sala}`, 0, -1);
          if (jugadores.length === 0) {
            await redis.del(`sala:${sala}`);
            await redis.del(`reinicio:${sala}`);
          }
        }
      
        await enviarListasGlobal();
      });
      
    });


    setInterval(async () => {
      const keys = await redis.keys("sala:*");
      for (const key of keys) {
        const jugadores = await redis.lRange(key, 0, -1);
        if (jugadores.length === 0) await redis.del(key);
      }
    }, 10000); // cada 10 segundos
    
    async function enviarListasGlobal() {
      const jugadores = await redis.hKeys("jugadores");
      const keys = await redis.keys("sala:*");
      const salas = [];
      for (const key of keys) {
        const nombre = key.replace("sala:", "");
        const jugadoresSala = await redis.lRange(key, 0, -1);
        salas.push({ nombre, cantidad: jugadoresSala.length });
      }
      for (const cliente of wss.clients) {
        if (cliente.readyState === WebSocket.OPEN) {
          cliente.send(JSON.stringify({ type: "listaJugadores", jugadores }));
          cliente.send(JSON.stringify({ type: "listaSalas", salas }));
        }
      }
    }

  }).catch(err => {
    console.error(`❌ [PID ${process.pid}] Error al conectar a Redis:`, err);
    process.exit(1);
  });
}
