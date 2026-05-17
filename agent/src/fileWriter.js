import fs from 'fs-extra'
import path from 'path'

export class FileWriter {
  constructor(targetFolder) {
    this.targetFolder = targetFolder
  }

  async writeFiles(files) {
    await fs.ensureDir(this.targetFolder)
    
    const results = []
    
    for (const file of files) {
      const filePath = path.join(this.targetFolder, file.path)
      const dir = path.dirname(filePath)
      
      await fs.ensureDir(dir)
      await fs.writeFile(filePath, file.content, 'utf-8')
      
      results.push({
        path: file.path,
        absolutePath: filePath,
        size: file.content.length
      })
      
      console.log(`✓ Escrito: ${file.path}`)
    }
    
    return results
  }

  async validateStructure() {
    const requiredDirs = ['server', 'client']
    for (const dir of requiredDirs) {
      const dirPath = path.join(this.targetFolder, dir)
      if (!await fs.pathExists(dirPath)) {
        console.warn(`⚠ Falta directorio: ${dir}`)
      }
    }
  }
}