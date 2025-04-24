// Importa React y los hooks necesarios
import { useEffect, useState } from "react";
import './Fallout.css';

// Establece la conexión WebSocket con el servidor
const socket = new WebSocket("wss://tictactoe-lv05.onrender.com");

function App() {
  // Estados principales del juego
  const [fase, setFase] = useState("registro"); // controla la etapa del juego
  const [nombreJugador, setNombreJugador] = useState(""); // nombre del jugador ya registrado
  const [nombreInput, setNombreInput] = useState(""); // nombre en el campo input
  const [jugadoresOnline, setJugadoresOnline] = useState([]); // lista de jugadores conectados
  const [salasDisponibles, setSalasDisponibles] = useState([]); // salas que se pueden ver o entrar

  // Estados específicos de una partida activa
  const [jugador, setJugador] = useState(""); // X u O
  const [tuNombre, setTuNombre] = useState("");
  const [rival, setRival] = useState("");
  const [turno, setTurno] = useState("X"); // de quién es el turno
  const [tablero, setTablero] = useState(Array(9).fill(""));
  const [ganador, setGanador] = useState(null); // resultado
  const [sala, setSala] = useState(""); // nombre de la sala
  const [inputSala, setInputSala] = useState(""); // input para nombre de nueva sala
  const [pendienteReinicio, setPendienteReinicio] = useState(false); // si el jugador pidió revancha
  const [mensajeReinicio, setMensajeReinicio] = useState(false); // si el rival pidió revancha
  const [apagado, setApagado] = useState(false); // para simular apagado de la terminal

  // Escucha los mensajes del WebSocket del backend
  useEffect(() => {
    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);

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
        volverAlMenu();
      }
    };
  }, [tablero]);

  // Lógica para validar si alguien ganó
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

  // Al hacer clic en una casilla
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

  // Crear una sala nueva
  const crearSala = () => {
    if (inputSala.trim() === "") return alert("Nombre de sala inválido");
    socket.send(JSON.stringify({ type: "crearSala", nombre: inputSala.trim() }));
    setSala(inputSala.trim());
  };

  // Unirse a una sala ya existente
  const unirseSala = (nombreSala) => {
    socket.send(JSON.stringify({ type: "unirseSala", nombre: nombreSala }));
    setSala(nombreSala);
  };

  // Enviar solicitud de reinicio
  const solicitarReinicio = () => {
    setPendienteReinicio(true);
    socket.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Aceptar solicitud de reinicio del rival
  const aceptarReinicio = () => {
    setMensajeReinicio(false);
    setPendienteReinicio(true);
    socket.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Limpiar tablero y estado para reiniciar
  const reiniciarJuego = () => {
    setTablero(Array(9).fill(""));
    setTurno("X");
    setGanador(null);
  };

  // Salir de la sala manualmente
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

  // Volver al menú sin reiniciar nombre
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

  // Simular apagado del sistema desde el botón POWER
  const apagarSistema = () => {
    setApagado(true);
    setTimeout(() => {
      salirDeSala();
      setApagado(false);
    }, 3000);
  };

  // Enviar nombre para registrarse
  const enviarRegistro = () => {
    const nombre = nombreInput.trim();
    if (!nombre) return alert("Ingresa un nombre válido");
    if (socket.readyState !== 1) return alert("Conexión no lista.");
    socket.send(JSON.stringify({ type: "registro", nombre }));
  };

// Estructura visual principal de la aplicación
return (
  <div className="terminal-frame">

    {/* Pantalla negra estilo apagado con mensaje al centro */}
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
        <p>> SYSTEM SHUTDOWN...</p>
      </div>
    )}

    {/* Botón invisible encima del botón físico "POWER" del monitor */}
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
      }}
      onClick={apagarSistema}
      title="Power off"
    />

    {/* Contenido de la pantalla verde del monitor */}
    <div className="terminal-screen">
      {!apagado && (
        <>
          {/* Pantalla de ingreso de nombre */}
          {fase === "registro" && (
            <>
              <h2>Ingresa tu nombre</h2>
              <input value={nombreInput} onChange={(e) => setNombreInput(e.target.value)} placeholder="Tu nombre" />
              <br />
              <button onClick={enviarRegistro}>Entrar</button>
            </>
          )}

          {/* Menú principal: jugadores online y salas */}
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

          {/* Pantalla de espera */}
          {fase === "espera" && <p>Esperando a otro jugador para empezar...</p>}

          {/* Juego activo: panel lateral + tablero */}
          {fase === "juego" && (
            <div className="contenedor-juego">

              {/* Panel izquierdo con información del jugador y acciones */}
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

                <button onClick={salirDeSala} style={{ marginTop: "1rem" }}>Salir de la Sala</button>
              </div>

              {/* Tablero central del juego */}
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