import { useEffect, useState } from "react";
import './Fallout.css';

// Establece la conexión WebSocket con el servidor
const socket = new WebSocket("wss://tictactoe-lv05.onrender.com");

function App() {
  // Estados principales del juego
  const [fase, setFase] = useState("registro");
  const [nombreJugador, setNombreJugador] = useState("");
  const [nombreInput, setNombreInput] = useState("");
  const [jugadoresOnline, setJugadoresOnline] = useState([]);
  const [salasDisponibles, setSalasDisponibles] = useState([]);

  const [jugador, setJugador] = useState("");
  const [tuNombre, setTuNombre] = useState("");
  const [rival, setRival] = useState("");
  const [turno, setTurno] = useState("X");
  const [tablero, setTablero] = useState(Array(9).fill(""));
  const [ganador, setGanador] = useState(null);
  const [sala, setSala] = useState("");
  const [inputSala, setInputSala] = useState("");
  const [pendienteReinicio, setPendienteReinicio] = useState(false);
  const [mensajeReinicio, setMensajeReinicio] = useState(false);
  const [apagado, setApagado] = useState(false);

  // Maneja los mensajes que llegan del servidor
  useEffect(() => {
    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

      // Control de las fases del juego según el mensaje
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
      }
      if (data.type === "jugada") {
        const nuevo = [...tablero];
        nuevo[data.casilla] = data.jugador;
        setTablero(nuevo);
        setTurno(data.jugador === "X" ? "O" : "X");
        const resultado = verificarGanador(nuevo);
        if (resultado) setGanador(resultado);
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
        salirDeSala();
      }
    };
  }, [tablero]);

  // Verifica si hay ganador o empate
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

  // Maneja los clics del tablero
  const handleClick = (i) => {
    if (tablero[i] === "" && turno === jugador && !ganador && !pendienteReinicio) {
      const nuevo = [...tablero];
      nuevo[i] = jugador;
      setTablero(nuevo);
      setTurno(jugador === "X" ? "O" : "X");
      socket.send(JSON.stringify({ type: "jugada", casilla: i, jugador }));
      const resultado = verificarGanador(nuevo);
      if (resultado) setGanador(resultado);
    }
  };

  // Funciones para crear o unirse a salas
  const crearSala = () => {
    if (inputSala.trim() === "") return alert("Nombre de sala inválido");
    socket.send(JSON.stringify({ type: "crearSala", nombre: inputSala.trim() }));
    setSala(inputSala.trim());
  };

  const unirseSala = (nombreSala) => {
    socket.send(JSON.stringify({ type: "unirseSala", nombre: nombreSala }));
    setSala(nombreSala);
  };

  // Funciones para reiniciar juego
  const solicitarReinicio = () => {
    setPendienteReinicio(true);
    socket.send(JSON.stringify({ type: "reiniciar" }));
  };

  const aceptarReinicio = () => {
    setMensajeReinicio(false);
    setPendienteReinicio(true);
    socket.send(JSON.stringify({ type: "reiniciar" }));
  };

  const reiniciarJuego = () => {
    setTablero(Array(9).fill(""));
    setTurno("X");
    setGanador(null);
  };

  // Limpia estados y vuelve a pantalla de inicio
  const salirDeSala = () => {
    socket.send(JSON.stringify({ type: "salirSala" }));
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

  // Simula el apagado del sistema con animación
  const apagarSistema = () => {
    setApagado(true);
    setTimeout(() => {
      salirDeSala();
      setApagado(false);
    }, 3000);
  };

  // Envía el nombre al servidor para registrarse
  const enviarRegistro = () => {
    const nombre = nombreInput.trim();
    if (!nombre) return alert("Ingresa un nombre válido");
    if (socket.readyState !== 1) return alert("Conexión no lista.");
    socket.send(JSON.stringify({ type: "registro", nombre }));
  };

  return (
    // Estructura visual principal del juego
    <div className="terminal-frame">
      {/* Pantalla de apagado fuera de la terminal-screen */}
      {apagado && (
        <div style={{
          position: "absolute",
          top: 75,
          left: 75,
          width: "85%",
          height: "70%",
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
          <p>> SYSTEM SHUTDOWN...</p>
        </div>
      )}

      {/* Botón POWER fuera de la pantalla */}
      <div
        style={{
          position: "absolute",
          bottom: "5.6%",
          right: "23.2%",
          width: "45px",
          height: "45px",
          cursor: "pointer",
          backgroundColor: "transparent",
          zIndex: 10,
          background: "rgba(0,255,0,0.3)", // ← agrega color visible
    border: "1px solid #00ff00" 
        }}
        onClick={apagarSistema}
        title="Power off"
      />

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
              <>
                <h3>Eres: {tuNombre} ({jugador})</h3>
                <h4>Rival: {rival} ({jugador === "X" ? "O" : "X"})</h4>
                <h4>Turno de: {turno === jugador ? `${tuNombre} (${jugador})` : `${rival} (${jugador === "X" ? "O" : "X"})`}</h4>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 100px)", gap: "5px", justifyContent: "center" }}>
                  {tablero.map((casilla, i) => (
                    <div key={i} onClick={() => handleClick(i)} style={{ border: "1px solid #39ff14", height: "100px", fontSize: "2rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      {casilla}
                    </div>
                  ))}
                </div>

                {ganador && (
                  <>
                    <h2>{ganador === "Empate" ? "¡Empate!" : ganador === jugador ? `¡Ganaste tú (${tuNombre})!` : `¡Ganó ${rival} (${ganador})!`}</h2>
                    {!pendienteReinicio && <button onClick={solicitarReinicio}>Pedir Revancha</button>}
                  </>
                )}

                <button onClick={salirDeSala}>Salir de la Sala</button>

                {mensajeReinicio && (
                  <div style={{ marginTop: "1rem" }}>
                    <p>Tu oponente quiere una revancha.</p>
                    <button onClick={aceptarReinicio}>Aceptar</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;