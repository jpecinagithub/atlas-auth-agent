import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findMatchingBrace, tryParseJSON, extractFiles } from '../agent/src/jsonExtractor.js'

// ── findMatchingBrace ──────────────────────────────────────────────────────

test('findMatchingBrace: simple object', () => {
  assert.equal(findMatchingBrace('{"a":1}', 0), 6)
})

test('findMatchingBrace: nested object', () => {
  assert.equal(findMatchingBrace('{"a":{"b":1}}', 0), 12)
})

test('findMatchingBrace: returns -1 for unclosed brace', () => {
  assert.equal(findMatchingBrace('{"unclosed":', 0), -1)
})

test('findMatchingBrace: respects start offset', () => {
  // starts from index 4 → inner object {"b":1}
  assert.equal(findMatchingBrace('xyz {"b":1}', 4), 10)
})

// ── tryParseJSON ───────────────────────────────────────────────────────────

test('tryParseJSON: parses valid JSON', () => {
  assert.deepEqual(tryParseJSON('{"a":1}'), { a: 1 })
})

test('tryParseJSON: returns null for invalid JSON', () => {
  assert.equal(tryParseJSON('not json'), null)
})

test('tryParseJSON: recovers from control characters', () => {
  // \x01 is a control char — the cleaner should strip it and allow parsing
  const withControl = '{"a":"hello\x01world"}'
  const result = tryParseJSON(withControl)
  assert.notEqual(result, null)
  assert.equal(result.a, 'helloworld')
})

// ── extractFiles ───────────────────────────────────────────────────────────

test('extractFiles: extracts from ```json block', () => {
  const response = '```json\n{"files":[{"path":"server.js","name":"server.js","content":"hi"}]}\n```'
  const files = extractFiles(response)
  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'server.js')
})

test('extractFiles: extracts from raw JSON (no code block)', () => {
  const response = '{"files":[{"path":"app.js","name":"app.js","content":"code"}]}'
  const files = extractFiles(response)
  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'app.js')
})

test('extractFiles: returns null for plain text without JSON', () => {
  assert.equal(extractFiles('Here is some text without any JSON'), null)
})

test('extractFiles: returns null for null input', () => {
  assert.equal(extractFiles(null), null)
})

test('extractFiles: skips invalid JSON blocks and tries next', () => {
  // First block is broken JSON, second is valid
  const response = '```json\n{broken}\n```\n```json\n{"files":[{"path":"x.js","name":"x.js","content":"ok"}]}\n```'
  const files = extractFiles(response)
  assert.ok(files !== null)
  assert.equal(files[0].path, 'x.js')
})

test('extractFiles: handles multiple files', () => {
  const payload = { files: [
    { path: 'a.js', name: 'a.js', content: '1' },
    { path: 'b.js', name: 'b.js', content: '2' },
    { path: 'c.js', name: 'c.js', content: '3' },
  ]}
  const response = '```json\n' + JSON.stringify(payload) + '\n```'
  const files = extractFiles(response)
  assert.equal(files.length, 3)
})
