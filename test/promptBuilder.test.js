import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractFieldsFromPrompt } from '../agent/src/promptBuilder.js'

test('returns empty array when no fields pattern found', () => {
  const result = extractFieldsFromPrompt('quiero login con email y password')
  assert.deepEqual(result, [])
})

test('extracts comma-separated fields after "campos:"', () => {
  const result = extractFieldsFromPrompt('campos: nombre, email, teléfono')
  assert.ok(result.includes('nombre'), 'debe incluir nombre')
  assert.ok(result.includes('email'),  'debe incluir email')
})

test('extracts single field after "campo:"', () => {
  const result = extractFieldsFromPrompt('campo: email')
  assert.ok(result.includes('email'))
})

test('filters out conjunctions like "y" and "con"', () => {
  const result = extractFieldsFromPrompt('campos: nombre y apellido')
  assert.ok(!result.includes('y'), '"y" no debe aparecer como campo')
})

test('returns empty array for empty string', () => {
  assert.deepEqual(extractFieldsFromPrompt(''), [])
})
