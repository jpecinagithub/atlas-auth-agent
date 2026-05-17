# Atlas Auth Agent

Agente autónomo que genera, valida y despliega sistemas de autenticación fullstack completos a partir de una descripción en lenguaje natural.

## Qué hace

1. Recibe un prompt (ej: "login, registro y dashboard con JWT")
2. Analiza los requisitos automáticamente (features, campos, stack)
3. Llama al LLM (Alibaba DashScope / qwen3-coder-plus) con un system prompt especializado
4. Extrae todos los archivos generados del JSON de respuesta
5. Valida el código contra más de 10 comprobaciones automáticas
6. Se auto-corrige hasta 3 iteraciones si la validación falla
7. Escribe los archivos en la carpeta destino (la crea si no existe)
8. Despliega el proyecto: base de datos, dependencias, backend y frontend

## Stack generado

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + React Router v6 |
| Backend | Node.js + Express + JWT + bcryptjs |
| Base de datos | MySQL (`mysql2`) o PostgreSQL (`pg`) |
| Autenticación | JWT Bearer token + localStorage |

## Estructura del repositorio

```
atlas-auth-agent/
├── agent.js                        # Orquestador principal (Express + lógica del agente)
├── package.json                    # Workspace raíz
├── .env                            # Variables de entorno (no commitear)
├── .env.example                    # Plantilla de configuración
│
├── agent/src/
│   ├── logger.js                   # Logger con niveles (debug/info/warn/error)
│   ├── jsonExtractor.js            # Parser robusto de JSON desde respuestas LLM
│   ├── promptBuilder.js            # Constructor de prompts y extracción de campos
│   ├── codeGenerator.js            # Generador de código vía MCP client
│   └── fileWriter.js               # Escritura de archivos en disco
│
├── memory/src/
│   ├── projectHistory.js           # API: saveGeneration, loadProjectContext, getAllProjects
│   └── memoryStore.js              # Almacén JSON en .agent-data/projects.json
│
├── skills/auth-generator/prompts/
│   ├── system-prompt.md            # System prompt para MySQL
│   └── system-prompt-pg.md         # System prompt para PostgreSQL
│
├── harness/src/
│   ├── pages/Generator.jsx         # UI principal con logs en tiempo real
│   └── pages/History.jsx           # Historial de proyectos generados
│
├── mcp/src/providers/
│   ├── alibaba.js                  # Cliente Alibaba DashScope
│   └── ollama.js                   # Cliente Ollama (modelos locales)
│
└── test/
    ├── jsonExtractor.test.js
    ├── promptBuilder.test.js
    └── codeGenerator.test.js
```

## Instalación

### Requisitos previos

- Node.js 18+
- MySQL 8+ corriendo localmente (para los proyectos que se generen)
- API key de [Alibaba DashScope](https://dashscope.aliyuncs.com)

### Pasos

```bash
# 1. Instalar dependencias raíz y harness
npm install
cd harness && npm install && cd ..

# 2. Configurar entorno
cp .env.example .env
# Editar .env con tu ALIBABA_API_KEY y credenciales MySQL

# 3. Compilar la UI
cd harness && npm run build && cd ..

# 4. Arrancar el agente
node agent.js
# → http://localhost:3001
```

## Configuración (.env)

```env
# LLM
ALIBABA_API_KEY=sk-...            # API key de DashScope
DASHSCOPE_INTL=true               # true = endpoint internacional (Singapur)
ALIBABA_MODEL=qwen3-coder-plus    # Modelo a usar

# Agente
PORT=3001                         # Puerto del servidor del agente
LOG_LEVEL=info                    # debug | info | warn | error
```

Ver `.env.example` para la plantilla completa con todas las variables.

## Uso

### Desde la UI (recomendado)

1. Abre `http://localhost:3001`
2. Escribe la ruta destino (se crea automáticamente si no existe)
3. Selecciona la base de datos (MySQL / PostgreSQL)
4. Describe el sistema en el textarea
5. Clic en **Generar** — el agente genera y valida el código
6. Clic en **Desplegar** — el agente crea la BD, instala deps y levanta el proyecto

### Desde la API REST

```bash
# Generar
curl -X POST http://localhost:3001/agent/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "sistema de autenticacion con login, registro y JWT",
    "targetFolder": "C:/proyectos/mi-auth",
    "stack": { "db": "mysql" }
  }'

# Desplegar
curl -X POST http://localhost:3001/agent/deploy \
  -H "Content-Type: application/json" \
  -d '{ "targetFolder": "C:/proyectos/mi-auth" }'

# Estado del agente
curl http://localhost:3001/health

# Historial de proyectos
curl http://localhost:3001/agent/projects
```

## Puertos

| Servicio | Puerto |
|----------|--------|
| Agente (este servidor) | 3001 |
| Backend generado | 3000 |
| Frontend generado (Vite dev) | 5173 |

## Tests

```bash
npm test
```

Cubre: extracción de JSON desde respuestas LLM, construcción de prompts y validación de archivos generados.

## Proyectos generados

Cada proyecto tiene esta estructura:

```
mi-proyecto/
├── backend/
│   ├── server.js       # Express con /api/auth/register, /login, /profile
│   ├── .env            # Credenciales DB + JWT_SECRET
│   ├── schema.sql      # CREATE TABLE users (id, name, email, password, created_at)
│   └── seeds.sql       # Usuario de prueba con hash bcrypt real
└── frontend/
    ├── src/pages/
    │   ├── Login.jsx       # Formulario + credenciales de prueba visibles
    │   ├── Register.jsx    # Formulario con validación y mensaje de éxito
    │   └── Dashboard.jsx   # Panel protegido por token
    ├── src/services/api.js # Axios con interceptor JWT + redirect al 401
    └── vite.config.js      # Proxy /api → http://localhost:3000
```

Usuario de prueba disponible tras el deploy: **test@example.com / 123456**

## Documentación adicional

- [CLAUDE.md](./CLAUDE.md) — Guía para trabajar con Claude Code en este proyecto
- [AGENTS.md](./AGENTS.md) — Arquitectura y comportamiento del agente autónomo
- [memory/README.md](./memory/README.md) — Sistema de memoria y historial
- [skills/README.md](./skills/README.md) — Skills de generación y system prompts
