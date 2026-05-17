import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class MemoryStore {
  constructor() {
    this.dataDir = path.join(__dirname, '../../.agent-data')
    this.projectsFile = path.join(this.dataDir, 'projects.json')
  }

  async init() {
    await fs.ensureDir(this.dataDir)
    if (!await fs.pathExists(this.projectsFile)) {
      await fs.writeJson(this.projectsFile, { projects: [] })
    }
  }

  async saveProject(project) {
    await this.init()
    const data = await fs.readJson(this.projectsFile)
    
    const existing = data.projects.findIndex(p => p.id === project.id)
    if (existing >= 0) {
      data.projects[existing] = { ...data.projects[existing], ...project, updated: new Date() }
    } else {
      data.projects.push({ ...project, created: new Date(), updated: new Date() })
    }
    
    await fs.writeJson(this.projectsFile, data)
  }

  async getProject(id) {
    await this.init()
    const data = await fs.readJson(this.projectsFile)
    return data.projects.find(p => p.id === id)
  }

  async getAllProjects() {
    await this.init()
    const data = await fs.readJson(this.projectsFile)
    return data.projects
  }

  async getContext(projectId) {
    const project = await this.getProject(projectId)
    if (!project) return null
    
    return {
      fields: project.fields || [],
      customConfig: project.config || {},
      previousGenerations: project.history || []
    }
  }
}