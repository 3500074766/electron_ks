import fs from 'fs'
import { join } from 'path'
import { app } from 'electron'

const FILE_NAME = 'overview.json'

function getFilePath() {
  const dir = app.getPath('userData')
  return join(dir, FILE_NAME)
}

export class OverviewRepo {
  constructor() {
    this.path = getFilePath()
    if (!fs.existsSync(this.path)) { fs.writeFileSync(this.path, JSON.stringify({}), 'utf-8') }
  }

  readAll() {
    try { return JSON.parse(fs.readFileSync(this.path, 'utf-8')) } catch { return {} }
  }

  save(uid, items) {
    const data = this.readAll()
    data[uid] = { items, ts: Date.now() }
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf-8')
  }

  getLastSpend(uid) {
    const data = this.readAll()
    const rec = data[uid]
    if (!rec || !rec.items) return 0
    const spendItem = rec.items.find(i => i && i.name && ['消耗', '花费', 'spend', 'cost'].some(k => i.name.includes(k)))
    return spendItem ? spendItem.value : 0
  }
}
