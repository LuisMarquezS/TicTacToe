# Tic-Tac-Toe - Multiplayer Game (Local, WebSocket y Cluster)

Este proyecto implementa un **juego de Tic-Tac-Toe** multijugador utilizando **WebSocket**, **Node.js con Cluster** y **memoria local** para gestionar el estado del juego entre múltiples jugadores.

## 🌐 **Estructura del Proyecto**

Este proyecto está dividido en dos partes:

- **Frontend (React)**: El juego en sí, visualizado y jugado por los usuarios.
- **Backend (Node.js)**: El servidor que maneja la lógica del juego, la sincronización entre jugadores, y el manejo de las salas.

### 🚀 **Tecnologías Utilizadas:**

- **Node.js**: Para el backend.
- **WebSocket**: Para la comunicación en tiempo real entre jugadores.
- **Cluster**: Para manejar múltiples procesos (workers) y permitir la **multiprogramación**.
- **React**: Para el frontend, creando la interfaz de usuario interactiva.

---

## 📦 **Instalación**

### 1. **Clonar el Proyecto**

```bash
git clone <url-del-repositorio>
cd TicTacToe
```

### 2. **Instalar Dependencias**

#### Backend (Servidor)
Dentro de la carpeta /server:

```bash
cd server
npm install
```

#### Frontend (React)
Dentro de la carpeta /client:

```bash
cd client
npm install
```

## ⚙️ **Configuración**

### 1. **Configurar el Backend para Corroer Localmente**

Este proyecto está configurado para correr en local sin ningún servicio externo:

Ejecuta el backend con:

```bash
npm start
```

El WebSocket backend se ejecutará en `ws://localhost:3001`.

### 2. **Configurar el Frontend para Corroer Localmente**

Dentro del proyecto de React, corre:

```bash
npm start
```

Esto abrirá el juego en el navegador con `http://localhost:3000`, que se conectará al backend local `ws://localhost:3001`.

## 🎮 **Cómo Jugar**

1. **Entrar al Juego**: Los jugadores deben ingresar un nombre único en el menú de inicio.
2. **Crear una Sala**: Un jugador puede crear una nueva sala de juego.
3. **Unirse a una Sala**: Otros jugadores pueden unirse a salas disponibles.
4. **Jugar**: El juego es un Tic-Tac-Toe clásico. Los jugadores alternan turnos para colocar sus símbolos en el tablero.
5. **Revancha**: Si ambos jugadores están de acuerdo, se puede reiniciar la partida.

## 🖥 **Cómo Funciona el Backend**

- **Servidor WebSocket**: El servidor backend utiliza WebSocket para la comunicación en tiempo real entre los jugadores.
- **Cluster**: El backend está configurado con multiproceso (cluster). Utiliza todos los núcleos de CPU disponibles para manejar múltiples conexiones simultáneas.

### Flujo de eventos:
1. Los jugadores envían eventos a través de WebSocket, como unirse a una sala, hacer una jugada, reiniciar la partida, etc.
2. El servidor escucha esos eventos y actualiza el estado del juego.
3. Cuando el estado cambia, el servidor emite un mensaje a todos los jugadores conectados, asegurando que todos vean la actualización en tiempo real.

## 🔄 **Multiproceso con Cluster**

El backend está configurado para usar multiproceso mediante cluster en Node.js. Esto permite que el servidor aproveche todos los núcleos de CPU disponibles y maneje más conexiones simultáneas.

- Cada vez que el servidor recibe una nueva conexión, crea un nuevo proceso hijo (worker).
- Los trabajadores manejan las solicitudes y la lógica del juego, pero cada trabajador tiene su propia memoria.
- Para sincronizar la información entre trabajadores, el proyecto mantiene la información en memoria local.

## 🛠 **Comandos Útiles**

### Ejecutar el Backend:
```bash
cd server
npm start
```

### Ejecutar el Frontend:
```bash
cd client
npm start
```

## 🔧 **Posibles Mejoras**

- **Escalabilidad**: Actualmente el sistema es escalable solo mediante cluster. Si decides agregar un almacenamiento en memoria compartido, la arquitectura sería más robusta y escalable.
- **Persistencia**: Si deseas hacer el juego persistente entre sesiones (guardar progreso, jugadores previos, etc.), puedes integrar bases de datos adicionales (MongoDB, PostgreSQL, etc.).
- **Interfaz de Usuario**: Puedes mejorar la interfaz agregando más interacciones, animaciones y funcionalidades.

## 🧑‍💻 **Contribuir**

- Si tienes sugerencias de mejoras, envía un pull request.
- Si tienes alguna duda o sugerencia, no dudes en abrir un issue.