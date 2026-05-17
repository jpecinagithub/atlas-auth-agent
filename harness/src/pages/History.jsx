import React, { useEffect, useState } from 'react'

function History() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/agent/projects')
      .then(r => r.json())
      .then(data => setProjects(data.projects || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-3xl mb-2">⏳</p>
        <p>Cargando historial...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-red-600">
        <p className="font-semibold">❌ Error al cargar el historial</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-4">🗂️</p>
        <p>No hay proyectos generados todavía.</p>
        <p className="text-sm mt-1">Genera tu primer proyecto desde la pestaña Generador.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-700">
        Proyectos generados ({projects.length})
      </h2>

      {projects.map(project => (
        <div key={project.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-semibold text-gray-800">📁 {project.id}</p>
              {project.lastGeneration?.prompt && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {project.lastGeneration.prompt}
                </p>
              )}
            </div>
            <div className="text-right text-sm text-gray-400 shrink-0">
              {project.lastGeneration?.files != null && (
                <p>{project.lastGeneration.files} archivos</p>
              )}
              {project.updated && (
                <p>{new Date(project.updated).toLocaleDateString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default History
