import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'

class AppStore {
  constructor() {
    this.db = null
    this.dbPath = join(app.getPath('userData'), 'app_data.db')
    this.init()
  }

  init() {
    // 自动连接数据库
    this.db = new sqlite3.Database(this.dbPath)
    this.initTables()
  }

  initTables() {
    this.db.serialize(() => {
      // 1. 用户数据表：专门存UID对应的所有业务数据（GMV, 消耗, ROI等）
      // data 字段存 JSON 字符串，方便你随时加新字段，不用改表结构
      this.db.run(`
        CREATE TABLE IF NOT EXISTS user_stats (
          uid TEXT PRIMARY KEY,
          name TEXT,
          data TEXT,
          updated_at INTEGER
        )
      `)

      // 2. 系统设置表：存刷新间隔、倒计时状态等
      this.db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `)
    })
  }

  // --- 通用方法 ---

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err)
        else resolve(this)
      })
    })
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err)
        else resolve(row)
      })
    })
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err)
        else resolve(rows)
      })
    })
  }

  // --- 业务快捷接口 ---

  // 保存用户数据 (自动判断是插入还是更新)
  // data 是一个对象，会被自动转为 JSON
  async saveUserStats(uid, name, dataObj) {
    const jsonStr = JSON.stringify(dataObj)
    const now = Date.now()
    const sql = `
      INSERT INTO user_stats (uid, name, data, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(uid) DO UPDATE SET
      name = excluded.name,
      data = excluded.data,
      updated_at = excluded.updated_at
    `
    return this.run(sql, [String(uid), name, jsonStr, now])
  }

  // 获取单个用户数据
  async getUserStats(uid) {
    const row = await this.get('SELECT * FROM user_stats WHERE uid = ?', [String(uid)])
    if (!row) return null
    return {
      ...row,
      data: JSON.parse(row.data) // 自动转回对象
    }
  }

  // 获取所有用户数据 (返回给前端表格用)
  async getAllUserStats() {
    const rows = await this.all('SELECT * FROM user_stats')
    return rows.map(row => {
      let parsedData = {}
      try { parsedData = JSON.parse(row.data) } catch (e) {}
      // 展平数据，方便前端表格直接使用
      return {
        UID: row.uid,
        名称: row.name,
        updated_at: row.updated_at,
        ...parsedData
      }
    })
  }

  // 获取某个用户的上次消耗 (替代 repo.getLastSpend)
  async getLastSpend(uid) {
    const stats = await this.getUserStats(uid)
    if (!stats || !stats.data) return 0
    return stats.data.花费 || stats.data.spend || 0
  }

  // --- 设置相关 ---

  async setSetting(key, value) {
    const strVal = JSON.stringify(value)
    return this.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, strVal]
    )
  }

  async getSetting(key, defaultValue = null) {
    const row = await this.get('SELECT value FROM settings WHERE key = ?', [key])
    if (!row) return defaultValue
    try {
      return JSON.parse(row.value)
    } catch {
      return defaultValue
    }
  }
}

export const appStore = new AppStore()
