const Database = require('better-sqlite3')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'data', 'app.db')
const fs = require('fs')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

try { db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`) } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    from_me INTEGER NOT NULL DEFAULT 0,
    remote_jid TEXT NOT NULL,
    body TEXT,
    message_type TEXT DEFAULT 'chat',
    mimetype TEXT,
    media_path TEXT,
    timestamp INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, remote_jid)
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS business_catalogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    image_base64 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    trigger_type TEXT NOT NULL DEFAULT 'contains', -- contains, exact, regex, starts_with, ends_with, media_type, time_range
    trigger_value TEXT NOT NULL,
    response_type TEXT NOT NULL DEFAULT 'text', -- text, media, template
    response_value TEXT NOT NULL,
    media_path TEXT,
    apply_to TEXT NOT NULL DEFAULT 'all', -- all, individual, group
    priority INTEGER NOT NULL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_auto_reply_session ON auto_reply_rules(session_id, is_active)
`)

try { db.exec(`ALTER TABLE messages ADD COLUMN mimetype TEXT`) } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN media_path TEXT`) } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN msg_wid TEXT`) } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN parent_msg_id TEXT`) } catch (_) {}
try { db.exec(`ALTER TABLE messages ADD COLUMN parent_msg_body TEXT`) } catch (_) {}

// Init default settings
try {
  const hasRegisterSetting = db.prepare('SELECT 1 FROM settings WHERE key = ?').get('allow_register')
  if (!hasRegisterSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('allow_register', 'true')
  }
} catch (e) {
  console.error('Error initializing settings:', e)
}

// Init default admin user if no users exist
try {
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get()
  if (userCountRow && userCountRow.count === 0) {
    const bcrypt = require('bcryptjs')
    const hash = bcrypt.hashSync('admin123', 10)
    db.prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)').run('admin', hash)
    console.log('Default admin user created: admin / admin123')
  }
} catch (e) {
  console.error('Error initializing default admin:', e)
}

module.exports = db
