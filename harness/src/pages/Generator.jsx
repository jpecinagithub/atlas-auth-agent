import React, { useState } from 'react'
import FolderSelector from '../components/FolderSelector'
import CodePreview from '../components/CodePreview'

function Generator() {
  const [targetFolder, setTargetFolder] = useState('')
  const [prompt, setPrompt] = useState('')
  const [db, setDb] = useState('mysql')
  const [status, setStatus] = useState('idle')
  const [logs, setLogs] = useState([])
  const [files, setFiles] = useState(null)
  const [validation, setValidation] = useState(null)
  const [deployResult, setDeployResult] = useState(null)

  const addLog = (msg) => setLogs(prev => [...prev, msg])

  const handleGenerate = async () => {
    if (!prompt || !targetFolder) {
      addLog('❌ Error: Prompt y carpeta destino requeridos')
      return
    }
    setStatus('generating')
    setLogs([`🤖 Iniciando agente autónomo...`])
    setValidation(null)
    setDeployResult(null)

    try {
      const response = await fetch('/agent/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, targetFolder, stack: { db } })
      })
      const data = await response.json()

      if (data.files?.length > 0) {
        setFiles(data.files)
        setValidation(data.validation)
        addLog(`✅ Generación completa — ${data.files.length} archivos`)
        addLog(`📊 Validación: ${data.validation?.passed ? 'PASÓ' : 'CON WARNINGS'}`)
        addLog(`🔄 Iteraciones: ${data.iterations}`)
        data.validation?.checks?.forEach(c => addLog(`   ${c.passed ? '✅' : '❌'} ${c.name}`))
        addLog(`\n💡 Para desplegar, haz clic en "🌐 Desplegar"`)
      } else {
        addLog(`❌ Error: ${data.error || data.message || 'Error desconocido'}`)
      }
    } catch (error) {
      addLog(`❌ Error de conexión: ${error.message}`)
    } finally {
      setStatus('idle')
    }
  }

  const handleDeploy = async () => {
    if (!targetFolder) { addLog('❌ Selecciona una carpeta destino'); return }
    setStatus('deploying')
    addLog('\n🚀 INICIANDO DESPLEGUE...')

    try {
      const response = await fetch('/agent/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFolder })
      })
      const data = await response.json()
      setDeployResult(data)

      if (data.database) addLog('✅ Base de datos creada')
      if (data.backend)  addLog('✅ Backend levantado')
      if (data.frontend) addLog('✅ Frontend levantado')

      if (data.urls) {
        addLog('\n🌐 URLs DEL PROYECTO:')
        if (data.urls.backend)  addLog(`   Backend:  ${data.urls.backend}`)
        if (data.urls.frontend) addLog(`   Frontend: ${data.urls.frontend}`)
      }
      if (data.errors?.length > 0) {
        addLog('\n⚠️ Errores:')
        data.errors.forEach(e => addLog(`   - ${e}`))
      }
    } catch (error) {
      addLog(`❌ Error de despliegue: ${error.message}`)
    } finally {
      setStatus('idle')
    }
  }

  const handleNew = () => {
    setFiles(null); setValidation(null); setDeployResult(null)
    setLogs([]); setPrompt('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Panel Izquierdo */}
      <div className="space-y-4">
        <FolderSelector value={targetFolder} onChange={setTargetFolder} />

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Describe lo que necesitas</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Base de datos:</label>
              <select
                value={db}
                onChange={e => setDb(e.target.value)}
                disabled={status !== 'idle'}
                className="text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
              </select>
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: quiero un sistema de autenticación con login, registro, JWT, email y password"
            className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            disabled={status !== 'idle'}
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleGenerate}
              disabled={status !== 'idle' || !prompt || !targetFolder}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {status === 'generating' ? '🤖 Generando...' : '🚀 Generar'}
            </button>
            {files && (
              <button
                onClick={handleDeploy}
                disabled={status !== 'idle'}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {status === 'deploying' ? '⏳ Desplegando...' : '🌐 Desplegar'}
              </button>
            )}
            {files && (
              <button onClick={handleNew} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600">
                🗑️ Nuevo
              </button>
            )}
          </div>
        </div>

        {/* Logs */}
        <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto">
          <h3 className="text-gray-400 text-sm mb-2">📝 LOGS DEL AGENTE</h3>
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">{logs.join('\n')}</pre>
        </div>

        {/* URLs */}
        {deployResult?.urls && (
          <div className="bg-green-50 rounded-lg p-4 border-2 border-green-500">
            <h3 className="font-bold text-green-700 mb-3">🎉 PROYECTO DESPLEGADO</h3>
            <div className="space-y-2">
              {deployResult.urls.frontend && (
                <a href={deployResult.urls.frontend} target="_blank" rel="noopener noreferrer"
                   className="block text-lg font-semibold text-blue-600 hover:underline">
                  🌐 Abrir Frontend: {deployResult.urls.frontend}
                </a>
              )}
              {deployResult.urls.backend && (
                <a href={deployResult.urls.backend} target="_blank" rel="noopener noreferrer"
                   className="block text-sm text-gray-600">
                  🔧 Backend API: {deployResult.urls.backend}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Validación */}
        {validation && (
          <div className={`rounded-lg p-4 ${validation.passed ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <h3 className="font-semibold mb-2">
              {validation.passed ? '✅ VALIDACIÓN PASADA' : '⚠️ VALIDACIÓN CON WARNINGS'}
            </h3>
            {validation.missing?.length > 0 && (
              <p className="text-sm text-red-600">Faltantes: {validation.missing.join(', ')}</p>
            )}
            {validation.errors?.length > 0 && (
              <p className="text-sm text-yellow-600">Errores: {validation.errors.join(', ')}</p>
            )}
          </div>
        )}
      </div>

      {/* Panel Derecho — Archivos */}
      <div>
        {files ? (
          <CodePreview files={files} />
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
            <p className="text-4xl mb-4">📁</p>
            <p>Los archivos generados aparecerán aquí</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Generator
