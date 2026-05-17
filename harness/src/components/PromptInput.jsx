import React from 'react'

export default function PromptInput({ value, onChange, onGenerate, disabled }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Prompt de autenticación</h2>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: quiero un sistema de autenticación con email, password, nombre y rol de usuario"
        className="w-full h-32 px-4 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        disabled={disabled}
      />
      <div className="mt-4 flex justify-end">
        <button
          onClick={onGenerate}
          disabled={disabled || !value}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {disabled ? 'Generando...' : 'Generar código'}
        </button>
      </div>
    </div>
  )
}