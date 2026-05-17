import { useState, useCallback } from 'react'
import { generateAuthSystem } from '../services/agentService'

export function useAgent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const generate = useCallback(async (prompt, targetFolder) => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await generateAuthSystem(prompt, targetFolder)
      setResult(data)
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return { generate, loading, error, result }
}