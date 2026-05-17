import { MemoryStore } from './memoryStore.js'

const store = new MemoryStore()

export async function saveGeneration(projectId, files, prompt) {
  await store.saveProject({
    id: projectId,
    lastGeneration: { files: files.length, prompt, date: new Date() }
  })
}

export async function loadProjectContext(projectId) {
  return store.getContext(projectId)
}

export async function getAllProjects() {
  return store.getAllProjects()
}