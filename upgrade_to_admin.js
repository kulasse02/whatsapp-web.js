const db = require('./src/database')
try {
  const result = db.prepare('UPDATE users SET is_admin = 1').run()
  console.log(`Success: upgraded ${result.changes} users to Administrator.`)
} catch (e) {
  console.error('Error running upgrade script:', e)
}
