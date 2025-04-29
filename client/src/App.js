// App.js FINAL para correr LOCAL, sincronizado correctamente
import { useEffect, useRef, useState } from "react";
import './Fallout.css';

function App() {
  // Referencia al WebSocket
  const socketRef = useRef(null);

  // Estados principales de flujo
  const [fase, setFase] = useState("registro"); // Fase del juego: registro, menu, espera, juego
  const [nombreJugador, setNombreJugador] = useState(""); // Nombre actual del jugador
  const [nombreInput, setNombreInput] = useState(""); // Nombre escrito en el input
  const [jugadoresOnline, setJugadoresOnline] = useState([]); // Lista de jugadores conectados
  const [salasDisponibles, setSalasDisponibles] = useState([]); // Lista de salas disponibles

  // Estados de la partida
  const [jugador, setJugador] = useState(""); // X u O
  const [tuNombre, setTuNombre] = useState(""); // Tu propio nombre
  const [rival, setRival] = useState(""); // Nombre del oponente
  const [turno, setTurno] = useState("X"); // Turno actual
  const [tablero, setTablero] = useState(Array(9).fill("")); // Estado del tablero de juego
  const [ganador, setGanador] = useState(null); // Ganador actual o empate
  const [sala, setSala] = useState(""); // Sala actual donde estás jugando
  const [inputSala, setInputSala] = useState(""); // Nombre de la sala que quieres crear
  const [pendienteReinicio, setPendienteReinicio] = useState(false); // Espera de respuesta de revancha
  const [mensajeReinicio, setMensajeReinicio] = useState(false); // Mensaje de que el rival pidió revancha

  // Estados para apagado simulado tipo Fallout
  const [apagado, setApagado] = useState(false);

  // Función que simula el apagado (pantalla negra)
  const apagarSistema = () => {
    setApagado(true);
    setTimeout(() => {
      salirDeSala(); // Salimos y regresamos a registro
      setApagado(false);
    }, 3000);
  };

  // Efecto que conecta el WebSocket al iniciar
  useEffect(() => {
    socketRef.current = new WebSocket("ws://localhost:3001");

    socketRef.current.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      console.log("📦 Data recibida:", data);

      // Respuestas según tipo de mensaje recibido
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
        }
      }
      if (data.type === "jugada") {
        if (Array.isArray(data.tablero)) {
          setTablero([...data.tablero]);
          setTurno(data.jugador === "X" ? "O" : "X");
          const resultado = verificarGanador([...data.tablero]);
          if (resultado) setGanador(resultado);
        } else {
          console.warn("❗ Tablero inválido recibido:", data.tablero);
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
  }, []);

  // Verificar si hay un ganador o empate
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

  // Enviar jugada al servidor
  const handleClick = (i) => {
    if (tablero[i] === "" && turno === jugador && !ganador && !pendienteReinicio) {
      socketRef.current.send(JSON.stringify({ type: "jugada", casilla: i, jugador }));
    }
  };

  // Crear una sala nueva
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

  // Solicitar revancha
  const solicitarReinicio = () => {
    setPendienteReinicio(true);
    socketRef.current.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Aceptar la solicitud de revancha
  const aceptarReinicio = () => {
    setMensajeReinicio(false);
    setPendienteReinicio(true);
    socketRef.current.send(JSON.stringify({ type: "reiniciar" }));
  };

  // Resetear el tablero para nueva partida
  const reiniciarJuego = () => {
    setTablero(Array(9).fill(""));
    setTurno("X");
    setGanador(null);
  };

  // Salir de la sala y volver al registro
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

  // Salir correctamente de la sala pero volver al menú sin borrar nombre
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

  // Volver al menú sin avisar al servidor (por ejemplo si rival se desconecta)
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

  // Enviar registro inicial al servidor
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
        <p> SYSTEM SHUTDOWN...</p>
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

                <button onClick={salirYVolverAlMenu} style={{ marginTop: "1rem" }}>Salir de la Sala</button>
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