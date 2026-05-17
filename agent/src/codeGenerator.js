export class CodeGenerator {
  constructor(mcpClient) {
    this.mcp = mcpClient
  }

  async generate(messages, targetFolder) {
    const response = await this.mcp.complete(messages)
    
    try {
      const parsed = JSON.parse(response)
      return parsed.files || []
    } catch (e) {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]).files || []
      }
      throw new Error('No se pudo parsear la respuesta del LLM')
    }
  }

  validateFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('No se generaron archivos')
    }

    for (const file of files) {
      if (!file.path || !file.content) {
        throw new Error('Archivo inválido: falta path o content')
      }
    }

    return true
  }
}