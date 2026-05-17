import axios from 'axios'

const API_URL = 'http://localhost:3000'

export async function generateAuthSystem(prompt, targetFolder) {
  const response = await axios.post(`${API_URL}/generate`, {
    prompt,
    targetFolder
  })
  return response.data
}

export async function checkAgentStatus() {
  try {
    await axios.get(`${API_URL}/health`)
    return true
  } catch {
    return false
  }
}