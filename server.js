import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname)

const app = express()
app.use(cors())
app.use(express.json())

// ============== LLM CLIENT ==============
async function callLLM(prompt) {
  const { ALIBABA_API_KEY, DASHSCOPE_INTL } = process.env
  
  const baseUrl = DASHSCOPE_INTL === 'false' 
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

  // Leer el system prompt
  const systemPrompt = await fs.readFile(
    path.join(projectRoot, 'skills/auth-generator/prompts/system-prompt.md'),
    'utf-8'
  )

  console.log(`\n📤 Enviando al LLM...`)
  
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ALIBABA_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'qwen3.5-plus-2026-02-15',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera un sistema de autenticación completo: ${prompt}` }
      ],
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`LLM Error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ============== FILE PARSER ==============
function extractFiles(response) {
  console.log(`\n🔍 Extrayendo archivos...`)
  
  // Método 1: Bloque ```json
  const jsonBlock = response.match(/```json\s*(\{[\s\S]*?\})\s*```/i)
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock[1])
      if (parsed.files) {
        // Procesar el contenido de cada archivo
        parsed.files = parsed.files.map(f => ({
          ...f,
          content: (f.content || '')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
        }))
        console.log(`✅ ${parsed.files.length} archivos extraídos`)
        return parsed.files
      }
    } catch (e) {}
  }

  // Método 2: Regex manual
  const files = []
  const regex = /"path"\s*:\s*"([^"]+)"\s*,\s*"name"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/gi
  
  let match
  while ((match = regex.exec(response)) !== null) {
    // Procesar el contenido para convertir \n en saltos reales
    let content = match[3]
      .replace(/\\n/g, '\n')      // \\n -> saltos de línea
      .replace(/\\r/g, '\r')       // \\r -> carriage return
      .replace(/\\t/g, '\t')      // \\t -> tabs
      .replace(/\\\\/g, '\\')     // \\ -> backslash
    
    files.push({ path: match[1], name: match[2], content })
  }
  
  if (files.length > 0) {
    console.log(`✅ ${files.length} archivos por regex`)
    return files
  }

  console.log(`❌ No se pudieron extraer archivos`)
  return null
}

// ============== ROUTES ==============
app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.post('/generate', async (req, res) => {
  const { prompt, targetFolder, feedback, previousFiles } = req.body
  
  if (!prompt || !targetFolder) {
    return res.status(400).json({ error: 'Faltan parámetros' })
  }
  
  try {
    // Si hay feedback, es una iteración - construir prompt mejorado
    let finalPrompt = prompt
    if (feedback) {
      finalPrompt = `
Sistema de autenticación previamente generado.
Feedback del usuario: ${feedback}

Por favor modifica o añade los archivos necesarios según el feedback.
El usuario quiere: ${prompt}

Responde con los archivos actualizados/modificados en formato JSON.
`
      console.log(`🔄 ITERACIÓN - Feedback: ${feedback}`)
    }

    const llmResponse = await callLLM(finalPrompt)
    const files = extractFiles(llmResponse)
    
    if (!files || files.length === 0) {
      return res.status(500).json({ error: 'No se pudieron extraer archivos' })
    }

    // Escribir archivos
    await fs.ensureDir(targetFolder)
    for (const file of files) {
      const filePath = path.join(targetFolder, file.path)
      await fs.ensureDir(path.dirname(filePath))
      await fs.writeFile(filePath, file.content, 'utf-8')
      console.log(`✓ ${file.path}`)
    }

    res.json({ success: true, files: files.map(f => ({ name: f.name, path: f.path })) })
  } catch (error) {
    console.error('Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`))