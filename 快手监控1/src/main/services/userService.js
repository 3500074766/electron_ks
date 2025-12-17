import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'

function resolveDbPath() {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || require('path').dirname(app.getPath('exe'))
  const exeDb = join(exeDir, 'Sqlite3.db')
  if (!isDev()) {
    return exeDb
  }
  const resourcePath = join(process.resourcesPath || process.cwd(), 'Sqlite3.db')
  if (fs.existsSync(resourcePath)) return resourcePath
  const localRoot = join(process.cwd(), 'Sqlite3.db')
  if (fs.existsSync(localRoot)) return localRoot
  const sibling = join(process.cwd(), '..', 'electron-ks', 'Sqlite3.db')
  if (fs.existsSync(sibling)) return sibling
  return exeDb
}

function isDev() {
  const isEnvSet = process.env.ELECTRON_IS_DEV === '1'
  const isNotPackaged = process.defaultApp || /node_modules[\\/]/.test(process.execPath)
  return isEnvSet || isNotPackaged
}

export class UserService {
  constructor() {
    this.dbPath = resolveDbPath()
  }

  _fetchAll(sql, params = []) {
    return new Promise(async (resolve, reject) => {
      try {
        const mod = await import('sqlite3')
        const sqlite3 = mod.default || mod
        const db = new sqlite3.Database(this.dbPath)
        db.all(sql, params, (err, rows) => {
          db.close()
          if (err) return reject(err)
          resolve(rows)
        })
      } catch (e) {
        resolve([])
      }
    })
  }

  async getAllUsers(includeInactive = false) {
    const sql = 'SELECT * FROM Mysqlks'
    const rows = await this._fetchAll(sql, [])
    const users = rows.map(row => {
      const UID = String(row.UID ?? row.uid ?? '')
      const 名称 = row.Name ?? row.name ?? row['名称'] ?? ''
      const 头像 = row.Fmurl ?? row.fmurl ?? row['头像'] ?? ''
      const ck = row.CLck ?? row.Clck ?? row['磁力CK'] ?? ''
      return { UID, 名称, 头像, ck }
    })
    return users
  }

  async getUserByUid(uid) {
    const sql = 'SELECT * FROM Mysqlks WHERE UID = ?'
    const rows = await this._fetchAll(sql, [uid])
    const row = rows?.[0]
    if (!row) return null
    return {
      UID: String(row.UID || ''),
      名称: row.Name || '',
      头像: row.Fmurl || '',
      ck: row.CLck || row.Clck || ''
    }
  }
}
