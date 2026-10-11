const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const db = require('./database')
const { jwtSecret } = require('./config')

const router = express.Router()
const JWT_SECRET = jwtSecret

router.post('/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' })
  }
  if (password.length < 4) {
    return res.status(400).json({ success: false, error: 'Password minimal 4 characters' })
  }

  // Cek apakah pendaftaran umum diperbolehkan
  try {
    const regSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('allow_register')
    if (regSetting && regSetting.value !== 'true') {
      return res.status(403).json({ success: false, error: 'Registration is disabled by administrator' })
    }
  } catch (err) {
    // Abaikan jika tabel settings belum siap/error
  }

  try {
    const hash = bcrypt.hashSync(password, 10)
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash)
    res.json({ success: true, message: 'User registered' })
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Username already exists' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' })
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' })
  }
  const token = jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' })
  res.json({ success: true, token, username: user.username, is_admin: user.is_admin })
})

const authenticate = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET)
    req.user = decoded
    next()
  } catch (e) {
    res.status(401).json({ success: false, error: 'Invalid token' })
  }
}

router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current password and new password required' })
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, error: 'New password minimal 4 characters' })
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(401).json({ success: false, error: 'Invalid current password' })
    }

    const hash = bcrypt.hashSync(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id)
    res.json({ success: true, message: 'Password updated successfully' })
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = { router, authenticate }
