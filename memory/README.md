# Sistema de Memoria

El sistema de memoria permite al agente recordar generaciones anteriores y reutilizar contexto entre sesiones.

## Estructura

```
memory/
└── src/
    ├── projectHistory.js   # API pública: las tres funciones que usa agent.js
    └── memoryStore.js      # Implementación: lectura/escritura de JSON en disco
```

Los datos se persisten en `.agent-data/projects.json` (en la raíz del repositorio).

## API

```javascript
import { saveGeneration, loadProjectContext, getAllProjects } from './memory/src/projectHistory.js'

// Guardar los metadatos de una generación completada
await saveGeneration(projectId, files, prompt)
// projectId: string (basename de la carpeta destino, ej: "mi-auth")
// files:     array de { path, name, content }
// prompt:    string con el prompt original del usuario

// Cargar el contexto de un proyecto previo (null si no existe)
const ctx = await loadProjectContext(projectId)
// Devuelve: { id, lastGeneration: { files, prompt, date } } | null

// Listar todos los proyectos guardados
const projects = await getAllProjects()
// Devuelve: array de objetos proyecto ordenados por fecha
```

## Almacenamiento

El archivo `.agent-data/projects.json` tiene este formato:

```json
{
  "mi-auth": {
    "id": "mi-auth",
    "lastGeneration": {
      "files": 18,
      "prompt": "sistema de autenticacion con login y registro",
      "date": "2026-05-17T10:30:00.000Z"
    }
  },
  "otro-proyecto": {
    "id": "otro-proyecto",
    "lastGeneration": { ... }
  }
}
```

El `projectId` es siempre el `path.basename()` de la carpeta destino. Si el usuario genera en `C:\Desktop\mi-auth`, el projectId es `mi-auth`.

## Cuándo se usa

### Al generar (`agentGenerate`)

Al inicio, el agente intenta cargar contexto previo:

```javascript
const previousContext = await loadProjectContext(projectId)
if (previousContext) {
  // Se loguea que existe historial previo
  // El contexto puede usarse para informar al LLM en futuras versiones
}
```

Al finalizar la generación exitosamente:

```javascript
await saveGeneration(projectId, files, userPrompt)
```

Solo se guardan metadatos (número de archivos, prompt, fecha) — **no el contenido de los archivos**. Esto mantiene el almacenamiento ligero.

### En la UI (History)

La página `/history` del harness llama a `GET /agent/projects` que internamente usa `getAllProjects()` para mostrar el historial de proyectos generados.

## Notas

- El directorio `.agent-data/` está en `.gitignore` — el historial no se commitea
- Si `.agent-data/projects.json` no existe, `MemoryStore` lo crea automáticamente al arrancar
- El store no tiene índices ni caché — lee el JSON completo en cada operación. Válido para el volumen de datos de un proyecto de aprendizaje
