# Jeeves Control de Gastos

Esta es la aplicación de Control de Gastos de Jeeves, migrada desde Google Apps Script a una arquitectura moderna.

## ¿Qué es este proyecto y por qué existe?

Este proyecto es una aplicación de control de gastos que te permite gestionar y visualizar tus transacciones. Fue creado para modernizar una aplicación existente en Google Apps Script, utilizando tecnologías más actuales y robustas como React para la interfaz de usuario y Node.js con Express y SQLite para el backend. Su propósito principal es ofrecer una herramienta eficiente y fácil de usar para el seguimiento de tus finanzas.

## Requisitos Previos

Asegúrate de tener instalado [Node.js](https://nodejs.org/) (versión 16 o superior).

---

## 🚀 Cómo ejecutar el proyecto en tu laptop (Windows)

El proyecto se compone de dos partes principales: el `backend` (servidor) y el `frontend` (interfaz de usuario). Ambos deben estar ejecutándose para que la aplicación funcione correctamente.

### 1. Iniciar el Backend (Servidor Node.js)

El backend maneja la lógica de la API y se conecta a la base de datos local de SQLite.

Abre tu terminal de comandos (puedes usar `cmd`, PowerShell o Git Bash) y sigue estos pasos:

```bash
cd backend
npm install   # Instala las dependencias del backend (solo la primera vez)
npm run dev   # Inicia el servidor de desarrollo
```

> El servidor del backend estará funcionando en `http://localhost:3001`
> *Nota: El servidor creará y poblará automáticamente la base de datos (`jeeves.db`) con datos de prueba si no existe.*

### 2. Iniciar el Frontend (Aplicación React)

El frontend es la interfaz de usuario con la que interactuarás.

Abre una **nueva ventana de terminal** (manteniendo abierta la del backend) y ejecuta lo siguiente:

```bash
cd frontend
npm install   # Instala las dependencias del frontend (solo la primera vez)
npm run dev   # Inicia la aplicación React en modo de desarrollo
```

> La aplicación frontend estará funcionando en `http://localhost:5173`
> Una vez que ambos estén corriendo, abre tu navegador y visita `http://localhost:5173` para empezar a usar la aplicación.

---

## 🛠 Estructura del Proyecto

- `/backend`: Contiene el código del servidor (`server.js`), la inicialización de la base de datos (`database.js`) y el archivo de la base de datos SQLite (`jeeves.db`).
- `/frontend`: Contiene la aplicación web de React.
  - `/src/components`: Componentes reutilizables de UI (Sidebar, TopBar).
  - `/src/pages`: Las vistas principales (Dashboard, Transactions).
  - `/src/index.css`: Todos los estilos base y diseño.
- `original-code`: Referencia al código original en Google Apps Script.

## 📝 Notas

- Si necesitas reiniciar la base de datos a su estado original, simplemente elimina el archivo `backend/jeeves.db` y reinicia el servidor backend.
- Para cambiar la URL a la que el frontend hace peticiones, modifica la llamada `fetch` dentro de `frontend/src/App.jsx`.
