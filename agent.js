// ==================== AGENTE AUTÓNOMO ====================
// El agente analiza, genera, valida y se auto-corrige

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import net from 'net'
import bcrypt from 'bcryptjs'
import { saveGeneration, loadProjectContext, getAllProjects } from './memory/src/projectHistory.js'
import { logger } from './agent/src/logger.js'
import { extractFiles as _extractFiles } from './agent/src/jsonExtractor.js'

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

// ==================== ANALIZADOR DE REQUISITOS ====================
function analyzeRequirements(prompt) {
  const requirements = {
    features: [],
    fields: [],
    tech: []
  }

  const promptLower = prompt.toLowerCase()

  // Detectar características
  if (promptLower.includes('login') || promptLower.includes('iniciar sesión')) {
    requirements.features.push('login')
  }
  if (promptLower.includes('registro') || promptLower.includes('register') || promptLower.includes('signup')) {
    requirements.features.push('register')
  }
  if (promptLower.includes('jwt') || promptLower.includes('token') || promptLower.includes('autenticación')) {
    requirements.features.push('jwt-auth')
  }
  if (promptLower.includes('logout') || promptLower.includes('cerrar sesión')) {
    requirements.features.push('logout')
  }
  if (promptLower.includes('dashboard') || promptLower.includes('panel')) {
    requirements.features.push('dashboard')
  }

  // Detectar campos
  const fieldPatterns = [
    { pattern: /email|correo/i, field: 'email' },
    { pattern: /password|contraseña|pass/i, field: 'password' },
    { pattern: /nombre|name/i, field: 'name' },
    { pattern: /apellido|surname|lastname/i, field: 'surname' },
    { pattern: /teléfono|phone/i, field: 'phone' },
    { pattern: /rol|role/i, field: 'role' }
  ]

  for (const { pattern, field } of fieldPatterns) {
    if (pattern.test(prompt)) {
      requirements.fields.push(field)
    }
  }

  // Tech stack
  requirements.tech = ['react', 'vite', 'tailwind', 'node', 'express', 'mysql']

  return requirements
}

// ==================== LLM CLIENT ====================
async function callLLM(messages, stack = { db: 'mysql' }) {
  const { ALIBABA_API_KEY, DASHSCOPE_INTL, ALIBABA_MODEL } = process.env
  const model = ALIBABA_MODEL || 'qwen3-coder-plus'

  const baseUrl = DASHSCOPE_INTL === 'false'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

  const promptFile = stack.db === 'postgresql' ? 'system-prompt-pg.md' : 'system-prompt.md'
  const systemPrompt = await fs.readFile(
    path.join(__dirname, `skills/auth-generator/prompts/${promptFile}`),
    'utf-8'
  )

  logger.info(`[LLM] model=${model} db=${stack.db} mensajes=${messages.length}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000)

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALIBABA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7
    }),
    signal: controller.signal
  })
  clearTimeout(timeoutId)

  logger.info(`[LLM] status=${response.status}`)

  if (!response.ok) {
    const errorText = await response.text()
    logger.error(`[LLM] ${response.status} — ${errorText}`)
    throw new Error(`LLM error: ${response.status}`)
  }

  const data = await response.json()
  logger.info(`[LLM] tokens=${data.usage?.total_tokens || 'N/A'}`)

  return data.choices[0].message.content
}

// ==================== VALIDADOR ROBUSTO ====================
function validateGeneratedCode(files, requirements, stack = { db: 'mysql' }) {
  const results = {
    passed: true,
    checks: [],
    missing: [],
    errors: [],
    warnings: []
  }

  logger.info(`[VALIDATE] features=${requirements.features.join(',')} db=${stack.db} archivos=${files.length}`)

  // === BACKEND ===
  
  // Check 1: Backend existe
  const backendFiles = files.filter(f => 
    f.path.startsWith('backend') || 
    f.path.includes('server.js') || 
    f.path.includes('package.json') && !f.path.includes('node_modules')
  )
  const hasBackend = backendFiles.length >= 2
  results.checks.push({ name: 'Backend existe', passed: hasBackend })
  if (!hasBackend) {
    results.passed = false
    results.missing.push('Falta directorio backend')
  }

  // Check 2: server.js contenido válido
  const serverFile = files.find(f => f.path.includes('server.js') || f.path === 'server.js')
  if (!serverFile) {
    results.passed = false
    results.missing.push('Falta server.js')
    results.checks.push({ name: 'server.js', passed: false })
  } else {
    const content = serverFile.content
    
    // Validaciones de contenido
    const hasExpress = content.includes('express')
    const hasCors = content.includes('cors')
    const hasJson = content.includes('express.json') || content.includes('express.urlencoded')
    const hasAuthRoutes = content.includes('/api/auth')
    const hasLogin = content.includes('/login') || content.includes('login')
    const hasRegister = content.includes('/register') || content.includes('register')
    const hasJWT = content.includes('jwt') || content.includes('jsonwebtoken')
    const hasPasswordHash = content.includes('bcrypt') || content.includes('hash')
    const hasDB = stack.db === 'postgresql'
      ? content.includes('pg') || content.includes('postgres')
      : content.includes('mysql') || content.includes('mysql2')
    const dbLabel = stack.db === 'postgresql' ? 'PostgreSQL (pg)' : 'MySQL (mysql2)'

    if (!hasExpress) results.errors.push('server.js: falta express')
    if (!hasCors) results.warnings.push('server.js: falta cors')
    if (!hasAuthRoutes) results.errors.push('server.js: no hay rutas /api/auth')
    if (!hasLogin) results.errors.push('server.js: no hay ruta login')
    if (!hasRegister) results.errors.push('server.js: no hay ruta register')
    if (!hasJWT && requirements.features.includes('jwt-auth')) results.errors.push('server.js: no implementa JWT')
    if (!hasPasswordHash) results.warnings.push('server.js: no usa bcrypt para passwords')
    if (!hasDB) results.warnings.push(`server.js: no hay conexión ${dbLabel}`)

    results.checks.push({ name: 'Express+Cors+JSON', passed: hasExpress && hasCors && hasJson })
    results.checks.push({ name: 'Rutas Auth', passed: hasAuthRoutes })
    results.checks.push({ name: 'JWT', passed: !requirements.features.includes('jwt-auth') || hasJWT })
  }

  // Check 3: package.json backend válido
  const backendPkg = files.find(f => f.path.includes('backend') && f.path.includes('package.json'))
  if (backendPkg) {
    const hasAllDeps = backendPkg.content.includes('express') && 
                       backendPkg.content.includes('mysql') && 
                       backendPkg.content.includes('bcrypt') &&
                       backendPkg.content.includes('jsonwebtoken')
    if (!hasAllDeps) {
      results.errors.push('backend/package.json: faltan dependencias')
    }
    results.checks.push({ name: 'Dependencies', passed: hasAllDeps })
  } else {
    results.missing.push('Falta backend/package.json')
  }

  // Check 4: schema.sql
  const schemaFile = files.find(f => f.path.includes('schema.sql'))
  if (schemaFile) {
    const hasTable = schemaFile.content.includes('CREATE TABLE')
    const hasEmail = schemaFile.content.toLowerCase().includes('email')
    const hasPassword = schemaFile.content.toLowerCase().includes('password')
    
    if (!hasTable) results.errors.push('schema.sql: no hay CREATE TABLE')
    if (!hasEmail) results.errors.push('schema.sql: falta campo email')
    if (!hasPassword) results.errors.push('schema.sql: falta campo password')
    
    // Campos adicionales
    for (const field of requirements.fields) {
      if (!schemaFile.content.toLowerCase().includes(field)) {
        results.warnings.push(`schema.sql: falta campo ${field}`)
      }
    }
    results.checks.push({ name: 'Schema SQL', passed: hasTable && hasEmail && hasPassword })
  } else {
    results.warnings.push('Falta schema.sql')
  }

  // === FRONTEND ===
  
  // Check 5: Frontend existe
  const frontendFiles = files.filter(f => 
    f.path.startsWith('frontend') || 
    f.path.startsWith('src') ||
    f.path.includes('vite.config') ||
    f.path.includes('index.html')
  )
  const hasFrontend = frontendFiles.length >= 3
  results.checks.push({ name: 'Frontend existe', passed: hasFrontend })
  if (!hasFrontend) {
    results.passed = false
    results.missing.push('Falta frontend')
  }

  // Check 6: Login.jsx
  if (requirements.features.includes('login')) {
    const loginFile = files.find(f => f.path.includes('Login') || f.path.includes('login'))
    if (!loginFile) {
      results.missing.push('Falta Login.jsx')
      results.checks.push({ name: 'Login.jsx', passed: false })
    } else {
      const hasForm = loginFile.content.includes('form') || loginFile.content.includes('onSubmit')
      const hasEmail = loginFile.content.toLowerCase().includes('email')
      const hasPassword = loginFile.content.toLowerCase().includes('password')
      const hasAPI = loginFile.content.includes('axios') || loginFile.content.includes('fetch') || loginFile.content.includes('api.')
      const hasToken = loginFile.content.includes('token') || loginFile.content.includes('localStorage')
      
      if (!hasForm) results.errors.push('Login.jsx: no tiene formulario')
      if (!hasEmail) results.errors.push('Login.jsx: falta input email')
      if (!hasPassword) results.errors.push('Login.jsx: falta input password')
      if (!hasAPI) results.errors.push('Login.jsx: no llama a API')
      if (!hasToken) results.warnings.push('Login.jsx: no guarda token')
      
      results.checks.push({ name: 'Login completo', passed: hasForm && hasEmail && hasPassword && hasAPI })
    }
  }

  // Check 7: Register.jsx
  if (requirements.features.includes('register')) {
    const registerFile = files.find(f => f.path.includes('Register'))
    if (!registerFile) {
      results.missing.push('Falta Register.jsx')
      results.checks.push({ name: 'Register.jsx', passed: false })
    } else {
      const hasForm = registerFile.content.includes('form')
      const hasFields = requirements.fields.some(f => registerFile.content.toLowerCase().includes(f))
      const hasAPI = registerFile.content.includes('axios') || registerFile.content.includes('fetch') || registerFile.content.includes('api.')
      
      if (!hasForm) results.warnings.push('Register.jsx: no tiene formulario')
      if (!hasFields) results.warnings.push('Register.jsx: faltan campos')
      if (!hasAPI) results.errors.push('Register.jsx: no llama a API')
      
      results.checks.push({ name: 'Register completo', passed: hasForm && hasAPI })
    }
  }

  // Check 8: Dashboard.jsx (si se pidió)
  if (requirements.features.includes('dashboard')) {
    const dashboardFile = files.find(f => f.path.includes('Dashboard'))
    if (!dashboardFile) {
      results.missing.push('Falta Dashboard.jsx')
      results.checks.push({ name: 'Dashboard.jsx', passed: false })
    } else {
      const hasLogout = dashboardFile.content.toLowerCase().includes('logout') || 
                        dashboardFile.content.includes('localStorage.removeItem')
      results.checks.push({ name: 'Dashboard con logout', passed: hasLogout })
    }
  }

  // Check 9: package.json frontend válido
  const frontendPkg = files.find(f => f.path.includes('frontend') && f.path.includes('package.json'))
  if (frontendPkg) {
    const hasReact = frontendPkg.content.includes('react')
    const hasVite = frontendPkg.content.includes('vite')
    const hasAxios = frontendPkg.content.includes('axios')
    
    if (!hasReact || !hasVite) {
      results.errors.push('frontend/package.json: faltan dependencias')
    }
    results.checks.push({ name: 'Frontend deps', passed: hasReact && hasVite })
  }

  // Check 10: vite.config.js
  const viteConfig = files.find(f => f.path.includes('vite.config'))
  if (!viteConfig) {
    results.warnings.push('Falta vite.config.js')
  }

  // === RESUMEN ===
  
  if (results.errors.length > 0) {
    results.passed = false
  }

  logger.info(`[VALIDATE] resultado=${results.passed ? 'PASS' : 'FAIL'}`)
  results.checks.forEach(c => logger.info(`[VALIDATE]   ${c.passed ? '✓' : '✗'} ${c.name}`))
  if (results.missing.length > 0) logger.warn(`[VALIDATE] faltantes: ${results.missing.join(', ')}`)
  if (results.errors.length > 0)  logger.error(`[VALIDATE] errores: ${results.errors.join(', ')}`)
  if (results.warnings.length > 0) logger.warn(`[VALIDATE] warnings: ${results.warnings.join(', ')}`)

  return results
}

// ==================== EXTRACTOR DE ARCHIVOS ====================
// La lógica pura de extracción vive en agent/src/jsonExtractor.js (testeable de forma aislada)

function extractFiles(response) {
  logger.info(`[EXTRACT] Analizando respuesta (${response?.length || 0} chars)`)
  const files = _extractFiles(response)
  if (files) logger.info(`[EXTRACT] ${files.length} archivos extraídos`)
  else logger.warn('[EXTRACT] Sin resultado — JSON no válido en la respuesta del LLM')
  return files
}

// ==================== AGENTE AUTÓNOMO ====================
async function agentGenerate(userPrompt, targetFolder, stack = { db: 'mysql' }) {
  logger.info(`[AGENT] Iniciando | destino=${targetFolder} | db=${stack.db}`)
  logger.debug(`[AGENT] Prompt: ${userPrompt}`)

  await fs.ensureDir(targetFolder)
  logger.info(`[AGENT] Carpeta destino lista: ${targetFolder}`)

  const projectId = path.basename(targetFolder)

  // Cargar contexto previo si existe
  const previousContext = await loadProjectContext(projectId)
  if (previousContext) {
    logger.info(`[MEMORY] Contexto previo encontrado para '${projectId}' — generaciones anteriores: ${previousContext.previousGenerations?.length || 0}`)
  }

  // 1. ANALIZAR requisitos
  const requirements = analyzeRequirements(userPrompt)
  console.log(`\n📋 Requisitos detectados:`)
  console.log(`   Features: ${requirements.features.join(', ')}`)
  console.log(`   Campos: ${requirements.fields.join(', ')}`)

  // 2. GENERAR código inicial
  logger.info('[AGENT] Generando código...')
  const messages = [{ role: 'user', content: userPrompt }]
  let lastResponse = await callLLM(messages, stack)
  logger.info(`[AGENT] LLM respondió — ${lastResponse?.length || 0} chars`)
  messages.push({ role: 'assistant', content: lastResponse })

  let files = extractFiles(lastResponse)
  if (!files) {
    logger.error('[AGENT] No se pudieron extraer archivos del LLM')
    throw new Error('No se pudieron extraer archivos del LLM')
  }

  logger.info(`[AGENT] ${files.length} archivos generados`)
  files.forEach((f, i) => logger.debug(`[AGENT]   ${i+1}. ${f.path} (${f.content?.length || 0} chars)`))

  // 3. VALIDAR
  let validation = validateGeneratedCode(files, requirements, stack)
  let iteration = 0
  const maxIterations = 3

  // 4. Loop de auto-corrección — el historial completo se pasa al LLM en cada iteración
  while (!validation.passed && iteration < maxIterations) {
    iteration++
    logger.info(`[AGENT] Auto-corrección iteración ${iteration}/${maxIterations}`)

    const feedbackSections = []
    if (validation.missing.length > 0) {
      feedbackSections.push(`**ARCHIVOS FALTANTES:**\n- ${validation.missing.join('\n- ')}`)
    }
    if (validation.errors.length > 0) {
      feedbackSections.push(`**ERRORES A CORREGIR:**\n- ${validation.errors.join('\n- ')}`)
    }
    if (validation.warnings.length > 0) {
      feedbackSections.push(`**WARNINGS:**\n- ${validation.warnings.join('\n- ')}`)
    }

    const feedback = `## TAREA: Corregir el código generado

El código NO pasó la validación autónoma.

${feedbackSections.join('\n\n')}

**Instrucciones para la corrección:**
1. Genera SOLO los archivos que faltan O están mal
2. Cada archivo debe tener contenido COMPLETO y FUNCIONAL
3. No uses "TODO" o placeholders
4. Verifica que:
   - server.js tenga express, cors, /api/auth, jwt, bcrypt
   - package.json tenga todas las dependencias
   - schema.sql tenga la tabla users con los campos
   - Login.jsx tenga form, inputs, llamada a API, guarde token
   - Register.jsx tenga form, llamada a API

**Formato de respuesta:**
\`\`\`json
{
  "files": [
    {"path": "backend/server.js", "name": "server.js", "content": "..."},
    ...
  ]
}
\`\`\``

    logger.info('[AGENT] Enviando feedback al LLM con historial completo...')
    messages.push({ role: 'user', content: feedback })
    lastResponse = await callLLM(messages, stack)
    messages.push({ role: 'assistant', content: lastResponse })

    const correctedFiles = extractFiles(lastResponse)
    if (correctedFiles) {
      for (const cf of correctedFiles) {
        const existing = files.findIndex(f => f.path === cf.path)
        if (existing >= 0) {
          files[existing] = cf
        } else {
          files.push(cf)
        }
      }
      logger.info(`[AGENT] ${correctedFiles.length} archivos corregidos`)
    }

    // Revalidar
    validation = validateGeneratedCode(files, requirements, stack)
  }

  // 5. Si sigue sin pasar, avisar
  if (!validation.passed) {
    logger.warn(`[AGENT] Validación incompleta tras ${iteration} iteraciones — faltantes: ${validation.missing.join(', ')}`)
  } else {
    logger.info('[AGENT] Validación PASADA')
  }

  // 6. Escribir archivos
  for (const file of files) {
    const filePath = path.join(targetFolder, file.path)
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, file.content, 'utf-8')
    console.log(`✓ ${file.path}`)
  }

  // Guardar en memoria
  await saveGeneration(projectId, files, userPrompt)
  logger.info(`[MEMORY] Generación guardada para '${projectId}'`)

  // Inicializar repositorio git en el proyecto generado
  try {
    await execAsync('git init && git add . && git commit -m "Initial generation by Atlas Auth Agent"', { cwd: targetFolder })
    logger.info(`[GIT] Repositorio inicializado en '${targetFolder}'`)
  } catch (e) {
    logger.warn(`[GIT] git init omitido: ${e.message.split('\n')[0]}`)
  }

  // Guardar archivos para uso posterior
  generatedFiles = files

  return {
    files: files.map(f => ({ name: f.name, path: f.path })),
    validation,
    iterations: iteration,
    targetFolder
  }
}

// ==================== DESPLEGADOR ====================

// Sondea un puerto local cada 500ms hasta que acepte conexiones o expire el timeout
function waitForPort(port, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    function attempt() {
      const socket = net.createConnection(port, 'localhost')
      socket.on('connect', () => { socket.destroy(); resolve() })
      socket.on('error', () => {
        socket.destroy()
        if (Date.now() >= deadline) {
          reject(new Error(`Puerto ${port} no disponible después de ${timeout}ms`))
        } else {
          setTimeout(attempt, 500)
        }
      })
    }
    attempt()
  })
}

let generatedFiles = [] // Almacena los archivos generados

async function deployProject(targetFolder, files) {
  logger.info('[DEPLOY] Iniciando despliegue completo...')

  const results = {
    database: false,
    backend: false,
    frontend: false,
    errors: [],
    urls: {}
  }

  // 1. Leer configuración de .env
  const envFile = files.find(f => f.path.includes('.env'))
  if (!envFile) {
    results.errors.push('No se encontró .env')
    return results
  }

  const envVars = {}
  envFile.content.split('\n').forEach(line => {
    if (line.includes('=') && !line.startsWith('#')) {
      const [key, ...value] = line.split('=')
      envVars[key.trim()] = value.join('=').trim()
    }
  })

  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = envVars
  const DB_PORT = envVars.DB_PORT || '3306'
  logger.info(`[DEPLOY] DB: ${DB_HOST}:${DB_PORT}/${DB_NAME}`)

  // 2. Crear Base de Datos y ejecutar SQL
  logger.info('[DEPLOY] Creando base de datos...')
  try {
    const schemaFile = files.find(f => f.path.includes('schema.sql'))
    const seedsFile  = files.find(f => f.path.includes('seeds.sql'))

    if (schemaFile) {
      await execAsync(`mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME}"`)
      logger.info(`[DEPLOY] Base de datos '${DB_NAME}' lista`)

      const schemaPath = path.join(targetFolder, schemaFile.path)
      await execAsync(`mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < "${schemaPath}"`)
      logger.info('[DEPLOY] Schema ejecutado')

      if (seedsFile) {
        const seedsPath = path.join(targetFolder, seedsFile.path)

        // El LLM genera hashes bcrypt falsos — los reemplazamos con uno real antes de insertar
        const bcryptPattern = /\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}/g
        const fixedContent = seedsFile.content.replace(bcryptPattern, await bcrypt.hash('123456', 10))
        if (fixedContent !== seedsFile.content) {
          await fs.writeFile(seedsPath, fixedContent, 'utf-8')
          logger.info('[DEPLOY] Hash bcrypt corregido en seeds.sql')
        }

        await execAsync(`mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < "${seedsPath}"`)
        logger.info('[DEPLOY] Seeds ejecutados')
      }

      results.database = true
    }
  } catch (e) {
    logger.warn(`[DEPLOY] Error en base de datos: ${e.message}`)
    results.errors.push(`Database: ${e.message}`)
  }

  // 3. Instalar dependencias backend
  logger.info('[DEPLOY] Instalando dependencias backend...')
  try {
    const backendFolder = path.join(targetFolder, 'backend')
    await execAsync('npm install', { cwd: backendFolder })
    logger.info('[DEPLOY] Dependencias backend instaladas')
  } catch (e) {
    results.errors.push(`Backend install: ${e.message}`)
  }

  // 4. Levantar backend
  logger.info('[DEPLOY] Levantando backend...')
  try {
    const backendFolder = path.join(targetFolder, 'backend')
    const backendProc = spawn('cmd.exe', ['/c', 'npm start'], {
      cwd: backendFolder,
      detached: true,
      stdio: 'ignore',
      shell: true
    })
    backendProc.unref()

    const backendPort = parseInt(envVars.PORT || '3000')
    logger.info(`[DEPLOY] Esperando puerto ${backendPort}...`)
    await waitForPort(backendPort)
    results.backend = true
    results.urls.backend = `http://localhost:${backendPort}`
    logger.info(`[DEPLOY] Backend activo en http://localhost:${backendPort}`)
  } catch (e) {
    results.errors.push(`Backend start: ${e.message}`)
  }

  // 5. Instalar dependencias frontend
  logger.info('[DEPLOY] Instalando dependencias frontend...')
  try {
    const frontendFolders = ['frontend', 'client', 'src']
    let frontendFolder = null

    for (const name of frontendFolders) {
      const candidate = path.join(targetFolder, name)
      if (await fs.pathExists(path.join(candidate, 'package.json'))) {
        frontendFolder = candidate
        break
      }
    }

    if (frontendFolder) {
      await execAsync('npm install', { cwd: frontendFolder })
      logger.info('[DEPLOY] Dependencias frontend instaladas')

      // 6. Levantar frontend
      logger.info('[DEPLOY] Levantando frontend...')
      const frontendProc = spawn('cmd.exe', ['/c', 'npm run dev'], {
        cwd: frontendFolder,
        detached: true,
        stdio: 'ignore',
        shell: true
      })
      frontendProc.unref()

      const frontendPort = parseInt(process.env.FRONTEND_PORT || '1600')
      logger.info(`[DEPLOY] Esperando puerto ${frontendPort}...`)
      await waitForPort(frontendPort)
      results.frontend = true
      results.urls.frontend = `http://localhost:${frontendPort}`
      logger.info(`[DEPLOY] Frontend activo en http://localhost:${frontendPort}`)
    }
  } catch (e) {
    results.errors.push(`Frontend: ${e.message}`)
  }

  return results
}

// ==================== ROUTES ====================
app.get('/health', (req, res) => res.json({ status: 'ok', agent: 'active' }))

app.post('/agent/generate', async (req, res) => {
  const { prompt, targetFolder, stack = { db: 'mysql' } } = req.body

  if (!prompt || !targetFolder) {
    return res.status(400).json({ error: 'Faltan parámetros: prompt y targetFolder' })
  }

  logger.info(`[API] POST /agent/generate | db=${stack.db} | folder=${targetFolder}`)

  try {
    const result = await agentGenerate(prompt, targetFolder, stack)

    logger.info(`[API] Completado — ${result.files.length} archivos | ${result.iterations} iteraciones | validación=${result.validation.passed ? 'PASS' : 'WARN'}`)

    res.json({
      success: result.validation.passed,
      files: result.files,
      validation: result.validation,
      iterations: result.iterations,
      message: result.validation.passed ? 'Código generado y validado correctamente' : 'Código generado con warnings'
    })
  } catch (error) {
    logger.error(`[API] Error en generación: ${error.message}`)
    res.status(500).json({ error: error.message, message: 'Error en la generación' })
  }
})

// Route Legacy
app.post('/generate', async (req, res) => {
  const { prompt, targetFolder } = req.body
  const result = await agentGenerate(prompt, targetFolder)
  res.json(result)
})

// Route: Deploy
app.post('/agent/deploy', async (req, res) => {
  const { targetFolder } = req.body
  
  console.log(`\n🌐 /agent/deploy llamado con targetFolder: ${targetFolder}`)
  console.log(`   generatedFiles.length: ${generatedFiles.length}`)
  
  if (!targetFolder) {
    console.log('   ❌ Falta targetFolder')
    return res.status(400).json({ error: 'Falta targetFolder' })
  }
  
  if (generatedFiles.length === 0) {
    console.log('   ❌ No hay archivos generados')
    return res.status(400).json({ error: 'No hay archivos generados. Llama primero a /agent/generate' })
  }
  
  try {
    console.log(`   ✅ Ejecutando deploy...`)
    const deployResult = await deployProject(targetFolder, generatedFiles)
    
    res.json({
      success: deployResult.errors.length === 0,
      ...deployResult,
      message: deployResult.errors.length === 0 
        ? '✅ Proyecto desplegado correctamente'
        : '⚠️ Despliegue con errores',
      urls: deployResult.urls
    })
  } catch (error) {
    console.error('   ❌ Deploy error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Route: Projects history
app.get('/agent/projects', async (req, res) => {
  try {
    const projects = await getAllProjects()
    res.json({ projects })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3001
// ==================== SERVIR FRONTEND ====================
// Siempre al final, después de las rutas API
app.use(express.static(path.join(__dirname, 'harness/dist')))
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'harness/dist/index.html'))
})

app.listen(PORT, () => console.log(`🤖 Agente Autónomo en http://localhost:${PORT}`))

process.on('uncaughtException', (err) => console.error('❌ Uncaught:', err))