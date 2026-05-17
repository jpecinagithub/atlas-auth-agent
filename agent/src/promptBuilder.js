import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export async function buildPrompt(userRequirements) {
  const systemPrompt = await fs.readFile(
    path.join(__dirname, '../skills/auth-generator/prompts/system-prompt.md'),
    'utf-8'
  )
  
  const userPromptTemplate = await fs.readFile(
    path.join(__dirname, '../skills/auth-generator/prompts/user-prompt.md'),
    'utf-8'
  )
  
  const userPrompt = userPromptTemplate.replace(
    '{{REQUIREMENTS}}',
    userRequirements
  )
  
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
}

export function extractFieldsFromPrompt(prompt) {
  const fields = []
  const fieldMatch = prompt.match(/campos?\s*:?\s*([^\n]+)/i)
  if (fieldMatch) {
    const fieldList = fieldMatch[1].split(/[,\s]+/)
    fieldList.forEach(f => {
      if (f && f !== 'y' && f !== 'con') fields.push(f.toLowerCase())
    })
  }
  return fields
}