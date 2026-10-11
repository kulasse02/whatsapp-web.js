const db = require('../database')
const bcrypt = require('bcryptjs')
const { sendErrorResponse } = require('../utils')

const getUsers = async (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, is_admin, created_at FROM users').all()
    res.json({ success: true, data: users })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const createUser = async (req, res) => {
  try {
    const { username, password, is_admin } = req.body
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' })
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: 'Password minimal 4 characters' })
    }

    const hash = bcrypt.hashSync(password, 10)
    const isAdminVal = is_admin ? 1 : 0
    db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)')
      .run(username, hash, isAdminVal)

    res.json({ success: true, message: 'User created successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Username already exists' })
    }
    sendErrorResponse(res, 500, error.message)
  }
}

const updateUser = async (req, res) => {
  try {
    const { id } = req.params
    const { username, password, is_admin } = req.body

    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' })
    }

    // Cari user asli
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Hindari admin menonaktifkan status admin miliknya sendiri secara tidak sengaja
    let isAdminVal = is_admin ? 1 : 0
    if (parseInt(id) === req.user.id && isAdminVal === 0) {
      return res.status(400).json({ success: false, error: 'You cannot revoke your own admin rights' })
    }

    if (password && password.trim().length > 0) {
      if (password.length < 4) {
        return res.status(400).json({ success: false, error: 'Password minimal 4 characters' })
      }
      const hash = bcrypt.hashSync(password, 10)
      db.prepare('UPDATE users SET username = ?, password_hash = ?, is_admin = ? WHERE id = ?')
        .run(username, hash, isAdminVal, id)
    } else {
      db.prepare('UPDATE users SET username = ?, is_admin = ? WHERE id = ?')
        .run(username, isAdminVal, id)
    }

    res.json({ success: true, message: 'User updated successfully' })
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Username already exists' })
    }
    sendErrorResponse(res, 500, error.message)
  }
}

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' })
    }

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    res.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const getSettings = async (req, res) => {
  try {
    const settings = db.prepare('SELECT key, value FROM settings').all()
    const settingsMap = {}
    for (const row of settings) {
      settingsMap[row.key] = row.value
    }
    res.json({ success: true, data: settingsMap })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const updateSettings = async (req, res) => {
  try {
    const settings = req.body
    if (typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid settings format' })
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    
    // Gunakan transaction SQLite agar aman
    const transaction = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        stmt.run(key, String(value))
      }
    })
    
    transaction(settings)
    res.json({ success: true, message: 'Settings updated successfully' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getSettings,
  updateSettings
}
