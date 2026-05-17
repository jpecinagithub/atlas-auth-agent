const MODELS_INTL = [
  'qwen3.5-plus-2026-02-15',
  'qwen3.5-plus',
  'qwen3-coder-plus',
  'qwen-turbo',
  'qwen-plus',
  'qwen-long'
]
const MODELS_CN = ['qwen-turbo', 'qwen-plus', 'qwen-long', 'qwen-max', 'qwen-max-long']

export class AlibabaProvider {
  constructor(config) {
    this.apiKey = config.apiKey
    const isIntl = process.env.DASHSCOPE_INTL !== 'false'
    this.baseUrl = isIntl 
      ? 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    this.model = config.model || process.env.ALIBABA_MODEL
    console.log(`📡 Conectando a Alibaba: ${this.baseUrl}`)
    console.log(`🤖 Modelo configurado: ${this.model}`)
  }

  async complete(messages) {
    console.log(`\n========================================`)
    console.log(`📤 ENVIANDO AL LLM:`)
    console.log(`========================================`)
    console.log(`Modelo: ${this.model}`)
    console.log(`Mensajes:`)
    messages.forEach((msg, i) => {
      console.log(`\n--- Mensaje ${i+1} (${msg.role}) ---`)
      console.log(msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : ''))
    })
    console.log(`\n========================================\n`)
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Error API: ${error}`)
      throw new Error(`Alibaba API error: ${error}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content
    
    console.log(`\n========================================`)
    console.log(`📥 RESPUESTA DEL LLM:`)
    console.log(`========================================`)
    console.log(content.substring(0, 2000) + (content.length > 2000 ? '\n... (truncado)' : ''))
    console.log(`\n========================================\n`)
    
    return content
  }

  async checkConnection() {
    try {
      console.log('🔄 Verificando conexión con Alibaba...')
      
      const isChina = this.baseUrl.includes('dashscope.aliyuncs.com')
      const modelsToTry = this.model ? [this.model, ...(isChina ? MODELS_CN : MODELS_INTL)] : (isChina ? MODELS_CN : MODELS_INTL)
      
      for (const model of modelsToTry) {
        try {
          console.log(`  Probando ${model}...`)
          const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: 'user', content: 'OK' }],
              max_tokens: 1
            })
          })
          
          if (response.ok) {
            this.model = model
            console.log(`✓ Modelo ${model} disponible`)
            console.log('✓ Conexión exitosa')
            return true
          }
        } catch (e) {
          console.log(`  ✗ ${model}: fallido`)
        }
      }
      
      throw new Error('Ningún modelo disponible')
    } catch (e) {
      console.error('✗ Error de conexión:', e.message)
      return false
    }
  }
}