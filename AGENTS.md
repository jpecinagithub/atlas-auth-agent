# AGENTS.md — Arquitectura del agente autónomo

## Qué es un agente en este contexto

Un agente autónomo es un sistema que no solo llama a un LLM una vez — analiza el resultado, lo valida contra criterios concretos y, si no cumple, vuelve a llamar al LLM con feedback específico hasta que el código sea correcto (o se agote el número de intentos).

## Diagrama de flujo

```
Usuario (UI o API)
        │
        ▼
POST /agent/generate
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  agentGenerate(prompt, targetFolder, stack)         │
│                                                     │
│  1. ensureDir(targetFolder)                         │
│  2. analyzeRequirements(prompt)                     │
│        └─→ { features: ['login','jwt',...],         │
│               fields: ['email','password',...] }    │
│                                                     │
│  3. callLLM(messages, stack)                        │
│        └─→ respuesta raw del LLM (texto + JSON)    │
│                                                     │
│  4. extractFiles(response)                          │
│        └─→ [ { path, name, content }, ... ]         │
│                                                     │
│  5. validateGeneratedCode(files, requirements)      │
│        └─→ { passed, checks, errors, warnings }    │
│                                                     │
│  6. ┌── validation.passed? ──────────────────────┐  │
│     │  NO (y iteraciones < 3)                    │  │
│     │  → buildCorrectionPrompt(errors)           │  │
│     │  → callLLM([original, corrección])         │  │
│     │  → extractFiles → validate → repetir       │  │
│     └────────────────────────────────────────────┘  │
│                                                     │
│  7. Escribir archivos en targetFolder               │
│  8. saveGeneration(projectId, files, prompt)        │
│  9. git init en targetFolder                        │
└─────────────────────────────────────────────────────┘
        │
        ▼
POST /agent/deploy (llamada separada)
        │
        ▼
┌─────────────────────────────────────────────────────┐
│  deployProject(targetFolder, generatedFiles)        │
│                                                     │
│  1. Parsear .env generado (credenciales DB)         │
│  2. CREATE DATABASE IF NOT EXISTS                   │
│  3. Ejecutar schema.sql                             │
│  4. Corregir hashes bcrypt falsos en seeds.sql      │
│  5. Ejecutar seeds.sql                              │
│  6. npm install backend                             │
│  7. spawn backend (npm start) → esperar puerto 3000 │
│  8. npm install frontend                            │
│  9. spawn frontend (npm run dev) → esperar puerto 5173│
└─────────────────────────────────────────────────────┘
```

## Componentes del agente

### Analizador de requisitos (`analyzeRequirements`)

Detecta por regex qué features y campos pide el usuario:

| Pattern buscado | Feature detectada |
|----------------|------------------|
| `login` | `login` |
| `regist` | `register` |
| `jwt\|token` | `jwt-auth` |
| `logout\|cerrar sesion` | `logout` |
| `dashboard\|panel` | `dashboard` |
| `email\|correo` | campo `email` |
| `password\|contrase` | campo `password` |
| `nombre\|name` | campo `name` |
| `rol\|role\|perfil` | campo `role` |

### Cliente LLM (`callLLM`)

- Endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (INTL) o el estándar de DashScope
- Modelo configurable vía `ALIBABA_MODEL` (por defecto: `qwen3-coder-plus`)
- Selecciona el system prompt según `stack.db`:
  - `mysql` → `skills/auth-generator/prompts/system-prompt.md`
  - `postgresql` → `skills/auth-generator/prompts/system-prompt-pg.md`
- La respuesta se espera en JSON puro (sin texto antes ni después)

### Extractor de JSON (`jsonExtractor.js`)

El LLM a veces envuelve el JSON en bloques de código o añade texto extra. El extractor tiene tres estrategias:

1. Busca bloques ` ```json ... ``` ` y extrae el JSON de dentro usando balanceo de llaves
2. Si no hay bloque, busca el primer `{` y extrae hasta la llave de cierre balanceada
3. Limpia caracteres de control (`\x00-\x08`, etc.) que rompen `JSON.parse`

### Validador (`validateGeneratedCode`)

Comprueba 10 aspectos del código generado:

| Check | Qué verifica |
|-------|-------------|
| Backend existe | `server.js` o `index.js` con Express |
| Express+Cors+JSON | `express()`, `cors()`, `express.json()` |
| Rutas Auth | `/api/auth` presente |
| JWT | `jsonwebtoken` o `jwt` |
| Dependencies | `package.json` con dependencias |
| Schema SQL | `CREATE TABLE` con campos básicos |
| Frontend existe | Archivos `.jsx` en el proyecto |
| Login completo | Formulario + email + password + llamada a API (`axios`, `fetch` o `api.`) |
| Register completo | Formulario + llamada a API |
| Frontend deps | `react`, `vite` en package.json |

Si un check falla, se incluye en `errors` (crítico) o `warnings` (no bloquea). La validación `passed` requiere que no haya errores críticos.

### Loop de auto-corrección

Cuando `validation.passed === false`:

1. Se construye un mensaje de corrección con los errores específicos
2. Se añade al hilo de mensajes (`messages`) como respuesta del asistente + nuevo turno de usuario
3. Se vuelve a llamar al LLM con el contexto completo
4. Máximo 3 iteraciones — después se escribe lo que hay con un warning

### Sistema de memoria

El agente guarda metadatos de cada generación en `.agent-data/projects.json`:

```json
{
  "projectId": {
    "id": "mi-proyecto",
    "lastGeneration": {
      "files": 18,
      "prompt": "sistema de autenticacion...",
      "date": "2026-05-17T..."
    }
  }
}
```

Al iniciar una nueva generación para el mismo `projectId` (basename de la carpeta destino), carga el contexto previo para informar al LLM de generaciones anteriores.

## Corrección del hash bcrypt

El LLM siempre genera hashes bcrypt inventados en `seeds.sql` (no puede ejecutar código). El agente lo detecta y corrige en el momento del deploy:

```
Regex: /\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}/g
→ Reemplaza con: bcrypt.hash('123456', 10)  ← hash real generado en tiempo de ejecución
```

## Puertos y procesos

El agente gestiona cuatro procesos:

| Proceso | Puerto | Cómo se arranca |
|---------|--------|----------------|
| Agente (este) | 3001 | `node agent.js` (manual) |
| Backend generado | 3000 | `spawn('npm start')` en deploy |
| Frontend generado | 5173 | `spawn('npm run dev')` en deploy |
| UI harness (dev) | 5173 | `npm run dev` en harness/ (opcional) |

El agente espera a que los puertos 3000 y 5173 estén activos antes de reportar el deploy como completado. Usa `net.createConnection` para verificar la disponibilidad real del puerto (no un `setTimeout` arbitrario).

## Estado en memoria entre requests

`generatedFiles` es una variable de módulo que persiste entre el request de generate y el de deploy:

```
POST /generate → generatedFiles = result.files  (se guarda en memoria)
POST /deploy   → deployProject(targetFolder, generatedFiles)  (se lee de memoria)
```

Esto significa que si el servidor se reinicia entre ambas llamadas, el deploy fallará. Es una limitación conocida y aceptada para este proyecto de aprendizaje.
