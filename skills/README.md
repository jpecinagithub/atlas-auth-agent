# Skills — Generación de autenticación

Las skills son los system prompts que definen exactamente qué código genera el LLM. Son la **fuente de verdad** del proyecto generado: si el código tiene un bug sistemático, el fix va en el system prompt, no en el agente.

## Estructura

```
skills/
├── manifest.json                       # Declaración de skills disponibles
└── auth-generator/
    └── prompts/
        ├── system-prompt.md            # Stack con MySQL
        └── system-prompt-pg.md         # Stack con PostgreSQL
```

## Cómo se selecciona la skill

En `agent.js`, la función `callLLM` selecciona el prompt según el parámetro `stack.db`:

```javascript
const promptFile = stack.db === 'postgresql'
  ? 'skills/auth-generator/prompts/system-prompt-pg.md'
  : 'skills/auth-generator/prompts/system-prompt.md'
```

El usuario elige MySQL o PostgreSQL en el dropdown de la UI.

## Qué define cada system prompt

Cada prompt instruye al LLM para generar un sistema completo con 18 archivos:

### Backend (5 archivos)

| Archivo | Contenido |
|---------|-----------|
| `backend/package.json` | Dependencias: express, mysql2/pg, bcryptjs, jsonwebtoken, cors, dotenv |
| `backend/server.js` | POST /api/auth/register, POST /api/auth/login, GET /api/auth/profile |
| `backend/.env` | DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET |
| `backend/schema.sql` | CREATE TABLE IF NOT EXISTS users (id, name, email, password, created_at) |
| `backend/seeds.sql` | INSERT usuario de prueba (test@example.com) |

### Frontend (13 archivos)

| Archivo | Contenido |
|---------|-----------|
| `frontend/package.json` | react, react-dom, react-router-dom, axios + vite, tailwindcss |
| `frontend/vite.config.js` | proxy /api → http://localhost:3000 |
| `frontend/tailwind.config.js` | content: index.html + src/**/*.jsx |
| `frontend/postcss.config.js` | tailwindcss + autoprefixer |
| `frontend/index.html` | HTML con div#root y script src=/src/main.jsx |
| `frontend/src/index.css` | @tailwind base/components/utilities |
| `frontend/src/main.jsx` | React 18 createRoot con BrowserRouter |
| `frontend/src/App.jsx` | Routes: /, /login, /register, /dashboard |
| `frontend/src/pages/Login.jsx` | Form + recuadro de credenciales de prueba + loading state |
| `frontend/src/pages/Register.jsx` | Form con validación de password + mensaje de éxito |
| `frontend/src/pages/Dashboard.jsx` | Perfil del usuario + botón logout |
| `frontend/src/components/Navbar.jsx` | Links dinámicos según si hay token en localStorage |
| `frontend/src/services/api.js` | Axios con interceptor JWT + redirect a /login en 401 |

## Diferencias MySQL vs PostgreSQL

| Aspecto | MySQL (`system-prompt.md`) | PostgreSQL (`system-prompt-pg.md`) |
|---------|---------------------------|-----------------------------------|
| Driver | `mysql2` | `pg` |
| Pool | `mysql.createPool({...})` | `new pg.Pool({...})` |
| Placeholders SQL | `?` | `$1, $2, ...` |
| Resultado query | `const [rows] = await pool.execute(...)` | `const result = await pool.query(...)` |
| Acceso al resultado | `rows[0]` | `result.rows[0]` |
| Auto-increment | `INT AUTO_INCREMENT PRIMARY KEY` | `SERIAL PRIMARY KEY` |
| Tipo fecha | `DATETIME` | `TIMESTAMP` |
| Puerto por defecto | 3306 | 5432 |

## Reglas críticas en los prompts

Estas reglas están explícitas en ambos system prompts para evitar que el LLM genere código incompleto:

1. `package.json` debe ser JSON válido y completo con todas las dependencias
2. No usar `...` ni `TODO` en ningún archivo
3. Usar ES modules (`import`/`export`) en el backend
4. El formato de salida es **solo JSON** — sin texto antes ni después
5. Login.jsx debe incluir siempre el recuadro con las credenciales de prueba:
   ```jsx
   <div className="bg-blue-50 border border-blue-200 ...">
     <p>Email: test@example.com</p>
     <p>Contraseña: 123456</p>
   </div>
   ```

## Cómo modificar un sistema prompt

Si el agente genera código con un bug sistemático (siempre falta algo, siempre hay un error concreto):

1. Edita el system prompt correspondiente en `skills/auth-generator/prompts/`
2. Reinicia el agente (`node agent.js`)
3. Genera un nuevo proyecto para verificar el fix

No es necesario tocar `agent.js` para corregir la calidad del código generado.

## manifest.json

```json
{
  "skills": [
    {
      "id": "auth-generator",
      "description": "Genera un sistema de autenticación fullstack completo",
      "prompts": ["system-prompt.md", "system-prompt-pg.md"]
    }
  ]
}
```

## Añadir una nueva skill

Para añadir soporte a otro stack (ej: MongoDB, SQLite):

1. Crear `skills/auth-generator/prompts/system-prompt-mongo.md`
2. Añadir la opción al dropdown en `harness/src/pages/Generator.jsx`
3. Añadir el caso en `callLLM()` dentro de `agent.js`
4. Actualizar `validateGeneratedCode()` si el stack tiene diferencias en la validación
5. Registrar la nueva skill en `skills/manifest.json`
