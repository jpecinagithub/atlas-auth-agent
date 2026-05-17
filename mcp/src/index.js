import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { AlibabaProvider } from './providers/alibaba.js'
import { OllamaProvider } from './providers/ollama.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '../..')

function extractFilesFromResponse(response) {
  console.log(`\n🔍 PROCESANDO RESPUESTA DEL LLM...`)
  
  let files = null
  
  // METODO 1: Buscar bloque ```json ... ```
  const jsonBlockMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/i)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1])
      if (parsed.files && Array.isArray(parsed.files)) {
        console.log(`✅ Método 1: Bloque JSON - ${parsed.files.length} archivos`)
        return parsed.files
      }
    } catch (e) {}
  }
  
  // METODO 2: Extraer cada archivo manualmente buscando patrones
  const filesArray = []
  
  // Buscar cada archivo por su estructura: "path": "...", "name": "...", "content": "..."
  const fileRegex = /"path"\s*:\s*"([^"]+)"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/gi
  
  let match
  while ((match = fileRegex.exec(response)) !== null) {
    filesArray.push({
      path: match[1],
      name: match[2],
      content: match[3]
    })
  }
  
  if (filesArray.length > 0) {
    console.log(`✅ Método 2: Regex manual - ${filesArray.length} archivos`)
    return filesArray
  }
  
  // METODO 3: Buscar objetos individuales
  const objectsMatch = response.match(/\{[^{}]*"path"[^{}]*\}/gi)
  if (objectsMatch) {
    for (const obj of objectsMatch) {
      const pathMatch = obj.match(/"path"\s*:\s*"([^"]+)"/)
      const nameMatch = obj.match(/"name"\s*:\s*"([^"]+)"/)
      const contentMatch = obj.match(/"content"\s*:\s*"([\s\S]*?)"(?=\s*[,\}])/)
      
      if (pathMatch && contentMatch) {
        filesArray.push({
          path: pathMatch[1],
          name: nameMatch ? nameMatch[1] : pathMatch[1],
          content: contentMatch[1]
        })
      }
    }
    if (filesArray.length > 0) {
      console.log(`✅ Método 3: Objetos individuales - ${filesArray.length} archivos`)
      return filesArray
    }
  }
  
  console.log(`❌ No se pudieron extraer archivos`)
  return null
}

class FileWriter {
  constructor(targetFolder) {
    this.targetFolder = targetFolder
  }

  async writeFiles(files) {
    await fs.ensureDir(this.targetFolder)
    const results = []
    
    for (const file of files) {
      const filePath = path.join(this.targetFolder, file.path)
      const dir = path.dirname(filePath)
      await fs.ensureDir(dir)
      await fs.writeFile(filePath, file.content, 'utf-8')
      results.push({ path: file.path, absolutePath: filePath })
      console.log(`✓ Escrito: ${file.path}`)
    }
    return results
  }
}

export class MCPClient {
  constructor() {
    this.provider = null
    this.usingOllama = false
  }

  async connect() {
    const { ALIBABA_API_KEY } = process.env
    
    if (ALIBABA_API_KEY && ALIBABA_API_KEY !== 'sk-...' && ALIBABA_API_KEY !== 'tu_api_key_aqui') {
      console.log('🔗 Intentando conectar a Alibaba...')
      const alibaba = new AlibabaProvider({ apiKey: ALIBABA_API_KEY })
      const alibabaOk = await alibaba.checkConnection()
      
      if (alibabaOk) {
        this.provider = alibaba
        this.usingOllama = false
        console.log('✓ Conectado a Alibaba LLM')
        return
      }
    }
    
    console.log('🔗 Intentando conectar a Ollama...')
    const ollama = new OllamaProvider({})
    const ollamaOk = await ollama.checkConnection()
    
    if (ollamaOk) {
      this.provider = ollama
      this.usingOllama = true
      console.log('✓ Conectado a Ollama (local)')
      return
    }
    
    throw new Error('No se pudo conectar a ningún LLM')
  }

  async complete(messages) {
    if (!this.provider) {
      throw new Error('MCP no conectado')
    }
    return this.provider.complete(messages)
  }
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/generate', async (req, res) => {
  const { prompt, targetFolder } = req.body
  
  if (!prompt || !targetFolder) {
    return res.status(400).json({ error: 'prompt y targetFolder son requeridos' })
  }
  
  try {
    const systemPrompt = await fs.readFile(
      path.join(projectRoot, 'skills/auth-generator/prompts/system-prompt.md'),
      'utf-8'
    )

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Genera un sistema de autenticación completo con los siguientes requisitos: ${prompt}` }
    ]

    const client = new MCPClient()
    await client.connect()
    
    const response = await client.complete(messages)
    console.log(`📝 Respuesta recibida (${response.length} caracteres)`)
    
    let files = extractFilesFromResponse(response)

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log(`❌ ERROR: No se pudieron extraer archivos`)
      return res.status(500).json({ error: 'No se pudieron extraer archivos de la respuesta' })
    }

    console.log(`📄 Archivos extraídos: ${files.length}`)
    files.forEach((f, i) => console.log(`  ${i+1}. ${f.name}`))

    const writer = new FileWriter(targetFolder)
    await writer.writeFiles(files)

    res.json({ success: true, files: files.map(f => ({ name: f.name, path: f.path })) })
  } catch (error) {
    console.error('Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.AGENT_PORT || 3000
app.listen(PORT, () => console.log(`🚀 MCP Server en http://localhost:${PORT}`))