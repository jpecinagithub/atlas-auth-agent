// Finds the index of the closing brace that matches the opening brace at `start`
export function findMatchingBrace(str, start) {
  let depth = 0
  for (let i = start; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Tries to JSON.parse a candidate string; on failure strips control chars and retries
export function tryParseJSON(candidate) {
  try {
    return JSON.parse(candidate)
  } catch {
    const cleaned = candidate.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    try {
      return JSON.parse(cleaned)
    } catch {
      return null
    }
  }
}

// Extracts the `files` array from an LLM response string.
// Tries ```json blocks first (balanced-brace), then raw JSON objects.
export function extractFiles(response) {
  if (!response) return null

  // Method 1: ```json block with balanced-brace matching
  let searchFrom = 0
  while (true) {
    const blockIdx = response.indexOf('```json', searchFrom)
    if (blockIdx === -1) break
    const braceStart = response.indexOf('{', blockIdx)
    if (braceStart === -1) break
    const braceEnd = findMatchingBrace(response, braceStart)
    if (braceEnd === -1) break
    const parsed = tryParseJSON(response.slice(braceStart, braceEnd + 1))
    if (parsed?.files?.length > 0) return parsed.files
    searchFrom = braceEnd + 1
  }

  // Method 2: raw JSON object anywhere in the response
  let rawFrom = 0
  while (true) {
    const start = response.indexOf('{', rawFrom)
    if (start === -1) break
    const end = findMatchingBrace(response, start)
    if (end === -1) break
    const parsed = tryParseJSON(response.slice(start, end + 1))
    if (parsed?.files?.length > 0) return parsed.files
    rawFrom = end + 1
  }

  return null
}
