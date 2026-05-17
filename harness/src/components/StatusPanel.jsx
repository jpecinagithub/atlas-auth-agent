import React from 'react'

export default function StatusPanel({ status, logs }) {
  const statusColors = {
    idle: 'bg-gray-100 text-gray-600',
    generating: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Estado</h2>
      <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${statusColors[status]}`}>
        {status === 'idle' && 'Listo'}
        {status === 'generating' && 'Generando código...'}
        {status === 'completed' && 'Completado'}
        {status === 'error' && 'Error'}
      </div>
      
      {logs.length > 0 && (
        <div className="mt-4 p-4 bg-gray-50 rounded max-h-40 overflow-y-auto font-mono text-sm">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      )}
    </div>
  )
}