import 'dotenv/config'
import { buildPrompt, extractFieldsFromPrompt } from './promptBuilder.js'
import { CodeGenerator } from './codeGenerator.js'
import { FileWriter } from './fileWriter.js'

async function main() {
  const args = JSON.parse(process.argv[2] || '{}')
  const prompt = args.prompt
  const targetFolder = args.targetFolder
  
  if (!prompt || !targetFolder) {
    console.error('Usage: node index.js {"prompt": "...", "targetFolder": "..."}')
    process.exit(1)
  }

  console.log('🚀 Iniciando generación de código...')
  console.log(`📁 Carpeta destino: ${targetFolder}`)
  console.log(`📝 Requisitos: ${prompt}`)

  try {
    const messages = await buildPrompt(prompt)
    console.log('✓ Prompt construido')
    
    const { MCPClient } = await import('../mcp/src/index.js')
    const mcp = new MCPClient()
    await mcp.connect()
    
    const generator = new CodeGenerator(mcp)
    const files = await generator.generate(messages, targetFolder)
    generator.validateFiles(files)
    console.log(`✓ Generados ${files.length} archivos`)

    const writer = new FileWriter(targetFolder)
    await writer.writeFiles(files)
    console.log('✓ Archivos escritos en disco')

    console.log(JSON.stringify({ success: true, files: files.length }))
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()