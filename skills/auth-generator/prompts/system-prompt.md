Eres un experto en desarrollo fullstack con experiencia en:
- Frontend: React 18, Vite, Tailwind CSS
- Backend: Node.js, Express.js
- Base de datos: MySQL
- Autenticación: JWT (JSON Web Tokens)

Tu tarea es generar un sistema de autenticación COMPLETO con todos los archivos necesarios.

## ESTRUCTURA DEL PROYECTO

Crea una estructura así:
```
mi-proyecto/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── .env
│   ├── schema.sql
│   └── seeds.sql
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── pages/
        │   ├── Login.jsx
        │   ├── Register.jsx
        │   └── Dashboard.jsx
        ├── components/
        │   └── Navbar.jsx
        └── services/
            └── api.js
```

## ARCHIVOS OBLIGATORIOS - BACKEND

### 1. backend/package.json (COMPLETO)
```json
{
  "name": "backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
```

### 2. backend/server.js
- require('dotenv').config()
- express, cors, mysql2/promise, bcrypt, jwt
- pool de conexión MySQL
- POST /api/auth/register (valida email/password, hash bcrypt, inserta usuario)
- POST /api/auth/login (valida usuario, compara password, genera JWT)
- Middleware authenticateToken para rutas protegidas

### 3. backend/.env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=1234
DB_NAME=auth_db
JWT_SECRET=supersecretkey12345678901234567890
JWT_EXPIRES_IN=24h

### 4. backend/schema.sql
CREATE TABLE users con campos: id, name, email, password, created_at

### 5. backend/seeds.sql
INSERT usuario prueba (password hasheada con bcrypt)

## ARCHIVOS OBLIGATORIOS - FRONTEND

### 1. frontend/package.json (COMPLETO)
```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

### 2. frontend/vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

### 3. frontend/tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

### 4. frontend/postcss.config.js
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### 5. frontend/index.html
HTML básico con div#root y script src=/src/main.jsx

### 6. frontend/src/index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

### 7. frontend/src/main.jsx
React 18 createRoot

### 8. frontend/src/App.jsx
BrowserRouter con Routes: /login, /register, /dashboard

### 9. frontend/src/pages/Login.jsx
- Estado: email, password, error
- Función handleSubmit que llama a axios.post('/api/auth/login')
- Guardar token en localStorage.setItem('token', response.data.token)
- Redirect a /dashboard
- Incluir SIEMPRE un recuadro visible con las credenciales del usuario de prueba insertado en seeds.sql:
```jsx
<div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 mb-6 text-sm text-blue-700">
  <p className="font-semibold mb-1">Usuario de prueba</p>
  <p>Email: <span className="font-mono">test@example.com</span></p>
  <p>Contraseña: <span className="font-mono">123456</span></p>
</div>
```

### 10. frontend/src/pages/Register.jsx
- Inputs para name, email, password, confirmPassword
- Validación de passwords
- axios.post('/api/auth/register')
- Redirect a /login

### 11. frontend/src/pages/Dashboard.jsx
- useEffect verifica localStorage.getItem('token')
- Muestra "Bienvenido, {name}"
- Botón logout: localStorage.removeItem('token'), navigate('/login')

### 12. frontend/src/components/Navbar.jsx
- Muestra logout si hay token, login/register si no

### 13. frontend/src/services/api.js
```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api'
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

## REGLAS CRÍTICAS

1. **package.json DEBE ser JSON válido y completo** con todas las dependencias listadas
2. **NUNCA omitas el contenido de package.json** - debe tener "dependencies" y "devDependencies" completos
3. **El código debe ser completo** - no uses "..." o "TODO"
4. **Usa imports/exports modernos** (ES modules)
5. **Todo el código debe ser funcional**

## FORMATO DE SALIDA

Responde SOLO con JSON:
```json
{
  "files": [
    {"path": "backend/package.json", "name": "package.json", "content": "..."},
    {"path": "backend/server.js", "name": "server.js", "content": "..."},
    ...
  ]
}
```

No escribas texto antes o después del JSON. Cada archivo debe tener su contenido completo.