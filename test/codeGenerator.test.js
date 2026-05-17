import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CodeGenerator } from '../agent/src/codeGenerator.js'

// CodeGenerator solo necesita el cliente MCP para generate(); validateFiles es pura
const gen = new CodeGenerator(null)

test('validateFiles returns true for a valid file list', () => {
  const files = [
    { path: 'backend/server.js', content: 'console.log("ok")' },
    { path: 'frontend/src/App.jsx', content: '<div/>' }
  ]
  assert.equal(gen.validateFiles(files), true)
})

test('validateFiles throws for an empty array', () => {
  assert.throws(
    () => gen.validateFiles([]),
    /No se generaron archivos/
  )
})

test('validateFiles throws when a file is missing content', () => {
  assert.throws(
    () => gen.validateFiles([{ path: 'server.js' }]),
    /Archivo inválido/
  )
})

test('validateFiles throws when a file is missing path', () => {
  assert.throws(
    () => gen.validateFiles([{ content: 'hello' }]),
    /Archivo inválido/
  )
})

test('validateFiles throws for non-array input', () => {
  assert.throws(
    () => gen.validateFiles(null),
    /No se generaron archivos/
  )
})
