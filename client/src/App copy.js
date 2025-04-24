import { useEffect, useState } from "react";
import './Fallout.css';

const socket = new WebSocket("ws://localhost:3001");

function App() {
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
        if (resultado) {
          setGanador(resultado);
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
        salirDeSala();
      }
    };
  }, [tablero]);

  const verificarGanador = (nuevoTablero) => {
    const lineasGanadoras = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];

    for (const [a, b, c] of lineasGanadoras) {
      if (
        nuevoTablero[a] &&
        nuevoTablero[a] === nuevoTablero[b] &&
        nuevoTablero[a] === nuevoTablero[c]
      ) {
        return nuevoTablero[a];
      }
    }

    if (!nuevoTablero.includes("")) return "Empate";
    return null;
  };

  const handleClick = (i) => {
    if (tablero[i] === "" && turno === jugador && !ganador && !pendienteReinicio) {
      const nuevo = [...tablero];
      nuevo[i] = jugador;
      setTablero(nuevo);
      setTurno(jugador === "X" ? "O" : "X");
      socket.send(JSON.stringify({ type: "jugada", casilla: i, jugador }));

      const resultado = verificarGanador(nuevo);
      if (resultado) {
        setGanador(resultado);
      }
    }
  };

  const crearSala = () => {
    if (inputSala.trim() === "") {
      alert("Nombre de sala inválido");
      return;
    }

    socket.send(JSON.stringify({ type: "crearSala", nombre: inputSala.trim() }));
    setSala(inputSala.trim());
  };

  const unirseSala = (nombreSala) => {
    socket.send(JSON.stringify({ type: "unirseSala", nombre: nombreSala }));
    setSala(nombreSala);
  };

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

  const salirDeSala = () => {
    setFase("menu");
    setTablero(Array(9).fill(""));
    setGanador(null);
    setTurno("X");
    setJugador("");
    setSala("");
    setPendienteReinicio(false);
    setMensajeReinicio(false);
  };

  const enviarRegistro = () => {
    const nombre = nombreInput.trim();
    if (nombre === "") {
      alert("Ingresa un nombre válido");
      return;
    }

    if (socket.readyState !== 1) {
      alert("Conexión no lista. Espera unos segundos e intenta de nuevo.");
      return;
    }

    socket.send(JSON.stringify({ type: "registro", nombre }));
  };

  return (
    <div className="container">
      {fase === "registro" && (
        <>
          <h2>Ingresa tu nombre</h2>
          <input
            value={nombreInput}
            onChange={(e) => setNombreInput(e.target.value)}
            placeholder="Tu nombre"
          />
          <br />
          <button onClick={enviarRegistro}>Entrar</button>
        </>
      )}

      {fase === "menu" && (
        <>
          <h2>Bienvenido, {nombreJugador}</h2>

          <h4>Jugadores en línea:</h4>
          <ul>
            {jugadoresOnline.map((j, i) => (
              <li key={i}>{j}</li>
            ))}
          </ul>

          <h4>Salas disponibles:</h4>
          <table>
            <thead>
              <tr>
                <th>Sala</th>
                <th>Jugadores</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {salasDisponibles.map((sala, i) => (
                <tr key={i}>
                  <td>{sala.nombre}</td>
                  <td>{sala.cantidad}/2</td>
                  <td>
                    {sala.cantidad < 2 ? (
                      <button onClick={() => unirseSala(sala.nombre)}>Unirse</button>
                    ) : (
                      "Llena"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <input
            value={inputSala}
            onChange={(e) => setInputSala(e.target.value)}
            placeholder="Nombre nueva sala"
          />
          <br />
          <button onClick={crearSala}>Crear Sala</button>
        </>
      )}

      {fase === "espera" && <p>Esperando a otro jugador para empezar...</p>}

      {fase === "juego" && (
        <>
          <h3>Eres: {tuNombre} ({jugador})</h3>
          <h4>Rival: {rival} ({jugador === "X" ? "O" : "X"})</h4>
          <h4>
            Turno de: {turno === jugador ? `${tuNombre} (${jugador})` : `${rival} (${jugador === "X" ? "O" : "X"})`}
          </h4>

          <div className="tablero" style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 100px)",
            gap: "5px",
            justifyContent: "center",
            marginTop: "1rem"
          }}>
            {tablero.map((casilla, i) => (
              <div
                key={i}
                onClick={() => handleClick(i)}
                style={{
                  border: "1px solid #39ff14",
                  height: "100px",
                  fontSize: "2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                {casilla}
              </div>
            ))}
          </div>

          {ganador && (
            <>
              <h2>
                {ganador === "Empate"
                  ? "¡Empate!"
                  : ganador === jugador
                  ? `¡Ganaste tú (${tuNombre})!`
                  : `¡Ganó ${rival} (${ganador})!`}
              </h2>

              {!pendienteReinicio && (
                <button onClick={solicitarReinicio}>
                  Pedir Revancha
                </button>
              )}
            </>
          )}

          <button
            onClick={() => {
              socket.send(JSON.stringify({ type: "salirSala" }));
              salirDeSala();
            }}
          >
            Salir de la Sala
          </button>

          {mensajeReinicio && (
            <div style={{ marginTop: "1rem" }}>
              <p>Tu oponente quiere una revancha.</p>
              <button onClick={aceptarReinicio}>Aceptar</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
