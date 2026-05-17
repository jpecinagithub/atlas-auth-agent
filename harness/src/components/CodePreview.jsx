import React, { useState } from 'react'

export default function CodePreview({ files }) {
  const [selectedFile, setSelectedFile] = useState(null)

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Archivos generados</h2>
      
      <div className="flex gap-4">
        <div className="w-1/3 border-r pr-4">
          {files.map((file, i) => (
            <div
              key={i}
              onClick={() => setSelectedFile(file)}
              className={`p-2 cursor-pointer rounded ${
                selectedFile?.path === file.path ? 'bg-blue-100' : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium text-sm">{file.name}</div>
              <div className="text-xs text-gray-500">{file.path}</div>
            </div>
          ))}
        </div>
        
        <div className="w-2/3">
          {selectedFile ? (
            <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm overflow-auto max-h-96">
              <code>{selectedFile.content}</code>
            </pre>
          ) : (
            <p className="text-gray-500">Selecciona un archivo para ver su contenido</p>
          )}
        </div>
      </div>
    </div>
  )
}