import { useEffect, useRef, useState } from "react"; // Hooks de React
import './Fallout.css'; // Estilo personalizado estilo Fallout

function App() {
  const socketRef = useRef(null); // Referencia al WebSocket

  // Estados generales del juego
  const [fase, setFase] = useState("registro"); // Controla en qué parte del juego estás (registro, menú, juego...)
  const [nombreJugador, setNombreJugador] = useState(""); // Nombre del jugador actual
  const [nombreInput, setNombreInput] = useState(""); // Input para ingresar nombre
  const [jugadoresOnline, setJugadoresOnline] = useState([]); // Lista de jugadores conectados
  const [salasDisponibles, setSalasDisponibles] = useState([]); // Lista de salas creadas

  // Estados de la partida
  const [jugador, setJugador] = useState(""); // "X" o "O"
  const [tuNombre, setTuNombre] = useState(""); // Tu nombre dentro de la sala
  const [rival, setRival] = useState(""); // El nombre del otro jugador
  const [turno, setTurno] = useState("X"); // De quién es el turno actual
  const [tablero, setTablero] = useState(Array(9).fill("")); // Estado del tablero
  const [ganador, setGanador] = useState(null); // Almacena el ganador actual
  const [sala, setSala] = useState(""); // Nombre de la sala
  const [inputSala, setInputSala] = useState(""); // Input para nombre de sala
  const [pendienteReinicio, setPendienteReinicio] = useState(false); // Si se solicitó un reinicio
  const [mensajeReinicio, setMensajeReinicio] = useState(false); // Si el otro jugador pidió reinicio

  const [apagado, setApagado] = useState(false); // Controla el efecto visual de apagado

  const apagarSistema = () => {
    setApagado(true);
    setTimeout(() => {
      salirDeSala();
      setApagado(false);
    }, 3000);
  };

  // Conexión y manejo del WebSocket
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3001");

    socket.onopen = () => {
      console.log("✅ Conectado al WebSocket");
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log("📦 Data recibida:", data);

      // Manejo de tipos de mensajes
      if (data.type === "registroOK") {
        setFase("menu");
        setNombreJugador(nombreInput);
      }
      if (data.type === "error") {
        alert(data.mensaje);
        setNombreInput("");
      }
      if (data.type === "listaJugadores") {
        setJugadoresOnline(data.jugadores);
      }
      if (data.type === "listaSalas") {
        setSalasDisponibles(data.salas);
      }
      if (data.type === "esperandoJugador") {
        setFase("espera");
      }
      if (data.type === "inicioPartida") {
        setJugador(data.jugador);
        setFase("juego");
        setTuNombre(data.tuNombre);
        setRival(data.rival);
        if (Array.isArray(data.tablero)) {
          setTablero([...data.tablero]);
          setTurno("X");
        }
      }
      if (data.type === "jugada") {
        if (Array.isArray(data.tablero)) {
          setTablero([...data.tablero]);
          setTurno(data.turno);
          const resultado = verificarGanador([...data.tablero]);
          if (resultado) setGanador(resultado);
        }
      }
      if (data.type === "reiniciar") {
        reiniciarJuego();
        setPendienteReinicio(false);
        setMensajeReinicio(false);
      }
      if (data.type === "solicitaReinicio") {
        setMensajeReinicio(true);
      }
      if (data.type === "salaCerrada") {
        alert("El otro jugador ha salido de la sala.");
        volverAlMenu();
      }
    };

    socket.onclose = () => {
      console.log("❌ WebSocket cerrado");
    };

    socketRef.current = socket;

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, []);

  // Verifica si alguien ganó
  const verificarGanador = (nuevoTablero) => {
    const lineas = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lineas) {
      if (nuevoTablero[a] && nuevoTablero[a] === nuevoTablero[b] && nuevoTablero[a] === nuevoTablero[c]) {
        return nuevoTablero[a];
      }
    }
    return nuevoTablero.includes("") ? null : "Empate";
  };

  // Manejo del click en el tablero
  const handleClick = (i) => {
    if (tablero[i] === "" && turno === jugador && !ganador && !pendienteReinicio) {
      socketRef.current.send(JSON.stringify({ type: "jugada", casilla: i, jugador }));
    }
  };

  // Crear nueva sala
  const crearSala = () => {
    if (inputSala.trim() === "") return alert("Nombre de sala inválido");
    socketRef.current.send(JSON.stringify({ type: "crearSala", nombre: inputSala.trim() }));
    setSala(inputSala.trim());
  };

  // Unirse a una sala existente
  const unirseSala = (nombreSala) => {
    socketRef.current.send(JSON.stringify({ type: "unirseSala", nombre: nombreSala }));
    setSala(nombreSala);
  };

  // Solicitar reinicio de partida
  const solicitarReinicio = () => {
    setPendienteReinicio(true);
    socketRef.current.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Aceptar reinicio recibido del otro jugador
  const aceptarReinicio = () => {
    setMensajeReinicio(false);
    setPendienteReinicio(true);
    socketRef.current.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Reinicia los estados del tablero
  const reiniciarJuego = () => {
    setTablero(Array(9).fill(""));
    setTurno("X");
    setGanador(null);
  };

  // Sale de la sala y reinicia todos los estados
  const salirDeSala = () => {
    socketRef.current.send(JSON.stringify({ type: "salirSala" }));
    setFase("registro");
    setNombreJugador("");
    setNombreInput("");
    setTablero(Array(9).fill(""));
    setGanador(null);
    setTurno("X");
    setJugador("");
    setSala("");
    setPendienteReinicio(false);
    setMensajeReinicio(false);
  };

  // Sale de la sala y vuelve al menú
  const salirYVolverAlMenu = () => {
    socketRef.current.send(JSON.stringify({ type: "salirSala" }));
    setFase("menu");
    setTablero(Array(9).fill(""));
    setGanador(null);
    setTurno("X");
    setJugador("");
    setSala("");
    setPendienteReinicio(false);
    setMensajeReinicio(false);
  };

  // Vuelve al menú sin enviar mensaje
  const volverAlMenu = () => {
    setFase("menu");
    setTablero(Array(9).fill(""));
    setGanador(null);
    setTurno("X");
    setJugador("");
    setSala("");
    setPendienteReinicio(false);
    setMensajeReinicio(false);
  };

  // Envía el nombre para registrarse
  const enviarRegistro = () => {
    const nombre = nombreInput.trim();
    if (!nombre) return alert("Ingresa un nombre válido");

    if (socketRef.current.readyState === 0) {
      socketRef.current.addEventListener("open", () => {
        socketRef.current.send(JSON.stringify({ type: "registro", nombre }));
      });
    } else if (socketRef.current.readyState === 1) {
      socketRef.current.send(JSON.stringify({ type: "registro", nombre }));
    } else {
      socketRef.current = new WebSocket("ws://localhost:3001");
      socketRef.current.addEventListener("open", () => {
        socketRef.current.send(JSON.stringify({ type: "registro", nombre }));
      });
    }
  };

return (
  <div className="terminal-frame">
    {apagado && (
      <div style={{
        position: "absolute",
        top: 75,
        left: 75,
        width: "85%",
        height: "60%",
        backgroundColor: "#000",
        color: "#39ff14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: "1.5rem",
        zIndex: 9999,
        borderRadius: "50px",
      }}>
        <p> SYSTEM SHUTDOWN...</p>
      </div>
    )}
    <div className="terminal-screen">
      {!apagado && (
        <>
          {fase === "registro" && (
            <>
              <h2>Ingresa tu nombre</h2>
              <input value={nombreInput} onChange={(e) => setNombreInput(e.target.value)} placeholder="Tu nombre" />
              <br />
              <button onClick={enviarRegistro}>Entrar</button>
            </>
          )}
          {fase === "menu" && (
            <>
              <h2>Bienvenido, {nombreJugador}</h2>
              <h4>Jugadores en línea:</h4>
              <ul>{jugadoresOnline.map((j, i) => <li key={i}>{j}</li>)}</ul>
              <h4>Salas disponibles:</h4>
              <table>
                <thead><tr><th>Sala</th><th>Jugadores</th><th>Acción</th></tr></thead>
                <tbody>
                  {salasDisponibles.map((s, i) => (
                    <tr key={i}>
                      <td>{s.nombre}</td>
                      <td>{s.cantidad}/2</td>
                      <td>{s.cantidad < 2 ? <button onClick={() => unirseSala(s.nombre)}>Unirse</button> : "Llena"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <input value={inputSala} onChange={(e) => setInputSala(e.target.value)} placeholder="Nombre nueva sala" />
              <br />
              <button onClick={crearSala}>Crear Sala</button>
            </>
          )}
          {fase === "espera" && <p>Esperando a otro jugador para empezar...</p>}
          {fase === "juego" && (
            <div className="contenedor-juego">
              <div className="panel-izquierdo">
                <h3>Eres: {tuNombre} ({jugador})</h3>
                <h4>Rival: {rival} ({jugador === "X" ? "O" : "X"})</h4>
                <h4>Turno de: {turno === jugador ? `${tuNombre} (${jugador})` : `${rival} (${jugador === "X" ? "O" : "X"})`}</h4>

                {ganador && (
                  <>
                    <h3 style={{ marginTop: "1rem" }}>
                      {ganador === "Empate" ? "¡Empate!" : ganador === jugador ? `¡Ganaste tú (${tuNombre})!` : `¡Ganó ${rival} (${ganador})!`}
                    </h3>
                    {!pendienteReinicio && <button onClick={solicitarReinicio}>Pedir Revancha</button>}
                  </>
                )}

                {mensajeReinicio && (
                  <div style={{ marginTop: "1rem" }}>
                    <p>Tu oponente quiere una revancha.</p>
                    <button onClick={aceptarReinicio}>Aceptar</button>
                  </div>
                )}

                <button onClick={salirYVolverAlMenu} style={{ marginTop: "1rem" }}>Salir de la Sala</button>
              </div>

              <div className="panel-tablero">
                <div className="tablero">
                  {tablero.map((casilla, i) => (
                    <div key={i} onClick={() => handleClick(i)} className="casilla">
                      {casilla}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </div>
);
}

export default App;
