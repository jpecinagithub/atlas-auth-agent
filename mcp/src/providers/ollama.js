export class OllamaProvider {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434'
    this.model = config.model || 'llama3'
    console.log(`📡 Conectando a Ollama: ${this.baseUrl}`)
    console.log(`🤖 Modelo: ${this.model}`)
  }

  async complete(messages) {
    const systemMessage = messages.find(m => m.role === 'system')?.content || ''
    const userMessage = messages.find(m => m.role === 'user')?.content || ''

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        stream: false
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Ollama API error: ${error}`)
    }

    const data = await response.json()
    return data.message.content
  }

  async checkConnection() {
    try {
      console.log('🔄 Verificando conexión con Ollama...')
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) throw new Error('Ollama no disponible')
      
      const data = await response.json()
      const models = data.models?.map(m => m.name) || []
      console.log(`✓ Ollama disponible. Modelos: ${models.join(', ')}`)
      return true
    } catch (e) {
      console.error('✗ Ollama no disponible:', e.message)
      return false
    }
  }
}