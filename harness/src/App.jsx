import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Generator from './pages/Generator'
import History from './pages/History'

const navClass = ({ isActive }) =>
  `px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-gray-600 hover:bg-gray-100'
  }`

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de navegación */}
      <nav className="bg-white border-b shadow-sm px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-800 mr-2">
          🤖 Atlas Auth Agent
        </span>
        <NavLink to="/" end className={navClass}>
          Generador
        </NavLink>
        <NavLink to="/history" className={navClass}>
          Historial
        </NavLink>
      </nav>

      {/* Contenido de cada ruta */}
      <main className="max-w-6xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Generator />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
