# CLAUDE.md — Guía para Claude Code

Este archivo define cómo trabajar con este proyecto usando Claude Code.

## Contexto del proyecto

Atlas Auth Agent es un agente autónomo que genera sistemas de autenticación fullstack. El punto de entrada es `agent.js` — un servidor Express que actúa como orquestador: recibe prompts, llama al LLM, valida el código generado, lo escribe en disco y lo despliega.

**Este es un proyecto de aprendizaje**, no un sistema de producción. Prioriza claridad sobre robustez.

## Arquitectura en una línea

```
UI (harness) → POST /agent/generate → agentGenerate() → LLM → validate → write files → disk
                POST /agent/deploy  → deployProject()  → MySQL + npm install + spawn backend/frontend
```

## Archivos clave

| Archivo | Responsabilidad |
|---------|----------------|
| `agent.js` | Todo: servidor, lógica de generación, validación, deploy |
| `agent/src/jsonExtractor.js` | Extrae el JSON de archivos desde la respuesta del LLM |
| `agent/src/logger.js` | Logger con niveles controlados por `LOG_LEVEL` |
| `memory/src/memoryStore.js` | Persiste historial en `.agent-data/projects.json` |
| `skills/auth-generator/prompts/system-prompt.md` | System prompt MySQL (fuente de verdad del código generado) |
| `skills/auth-generator/prompts/system-prompt-pg.md` | System prompt PostgreSQL |
| `harness/src/pages/Generator.jsx` | UI principal — si cambias la API, actualiza aquí también |

## Flujo de generación (`agentGenerate`)

1. `fs.ensureDir(targetFolder)` — crea la carpeta destino si no existe
2. `analyzeRequirements(prompt)` — extrae features y campos con regex
3. `callLLM(messages, stack)` — llama a DashScope, selecciona system prompt según `stack.db`
4. `extractFiles(response)` — parsea el JSON de la respuesta (balanceo de llaves)
5. `validateGeneratedCode(files, requirements, stack)` — 10+ comprobaciones
6. Loop de auto-corrección (máx. 3 iteraciones) si `validation.passed === false`
7. Escribe archivos en disco con `fs.writeFile`
8. `saveGeneration(projectId, files, prompt)` — guarda en memoria
9. `git init` en la carpeta generada

## Flujo de deploy (`deployProject`)

1. Parsea el `.env` generado para obtener credenciales DB
2. Crea la base de datos MySQL con `CREATE DATABASE IF NOT EXISTS`
3. Ejecuta `schema.sql` y `seeds.sql` (con corrección automática de hashes bcrypt)
4. `npm install` en backend y frontend
5. `spawn` del backend (`npm start`) y espera al puerto 3000
6. `spawn` del frontend (`npm run dev`) y espera al puerto 5173

## Variables de entorno necesarias

```env
ALIBABA_API_KEY=sk-...      # Obligatorio
DASHSCOPE_INTL=true         # true para endpoint internacional
ALIBABA_MODEL=qwen3-coder-plus
PORT=3001
LOG_LEVEL=info
```

## Cómo arrancar en desarrollo

```bash
# Terminal 1: agente (sirve la UI desde harness/dist)
node agent.js

# Para desarrollo de la UI con hot reload:
# Terminal 2
cd harness && npm run dev
# La UI dev en :5173 proxea /agent y /health → :3001
```

## Convenciones del código

- ES modules en todo el proyecto (`"type": "module"` en package.json)
- El agente usa `import` / `export`, no `require`
- El logger es el único mecanismo de logging — no añadir `console.log` sin razón
- Los archivos de `agent/src/` son módulos puros: no tienen side effects al importar
- `generatedFiles` es una variable de módulo en `agent.js` que persiste entre requests (necesaria para que `/agent/deploy` acceda a los archivos del último generate)

## Tests

```bash
npm test   # node --test test/**/*.test.js
```

Los tests usan el runner nativo de Node 18 (`node:test` + `node:assert`). No hay framework externo.

## Puntos de atención

- **Hash bcrypt en seeds.sql**: el LLM siempre genera hashes falsos. El deploy los reemplaza automáticamente con un hash real de `123456` antes de ejecutar los seeds.
- **Puerto 3000 vs 3001**: el agente corre en 3001; el backend generado en 3000. No deben coincidir.
- **`generatedFiles` en memoria**: si el agente se reinicia entre generate y deploy, el deploy fallará porque esa variable se pierde. Es un trade-off conocido y aceptado para un proyecto de aprendizaje.
- **System prompts**: son la fuente de verdad de lo que se genera. Si hay un bug en el código generado, el fix va en el system prompt correspondiente, no en el código del agente.
