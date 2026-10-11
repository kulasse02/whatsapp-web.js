const db = require('../database')
const { sendErrorResponse } = require('../utils')

/**
 * Get all auto reply rules for a session
 */
const getRules = async (req, res) => {
  try {
    const { sessionId } = req.params
    const rules = db.prepare('SELECT * FROM auto_reply_rules WHERE session_id = ? ORDER BY priority DESC, id ASC').all(sessionId)
    res.json({ success: true, rules })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Create a new auto reply rule
 */
const createRule = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { name, trigger_type, trigger_value, response_type, response_value, apply_to, priority, is_active } = req.body

    if (!name || !trigger_type || !trigger_value || !response_value) {
      return sendErrorResponse(res, 400, 'Required fields missing: name, trigger_type, trigger_value, response_value')
    }

    const stmt = db.prepare(`
      INSERT INTO auto_reply_rules 
      (session_id, name, trigger_type, trigger_value, response_type, response_value, apply_to, priority, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = stmt.run(
      sessionId,
      name,
      trigger_type || 'contains',
      trigger_value,
      response_type || 'text',
      response_value,
      apply_to || 'all',
      priority !== undefined ? Number(priority) : 10,
      is_active !== undefined ? (is_active ? 1 : 0) : 1
    )

    const newRule = db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(result.lastInsertRowid)
    res.json({ success: true, rule: newRule })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Update an existing rule
 */
const updateRule = async (req, res) => {
  try {
    const { id } = req.params
    const { name, trigger_type, trigger_value, response_type, response_value, apply_to, priority, is_active } = req.body

    const existing = db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(id)
    if (!existing) {
      return sendErrorResponse(res, 404, 'Auto reply rule not found')
    }

    const stmt = db.prepare(`
      UPDATE auto_reply_rules SET
        name = COALESCE(?, name),
        trigger_type = COALESCE(?, trigger_type),
        trigger_value = COALESCE(?, trigger_value),
        response_type = COALESCE(?, response_type),
        response_value = COALESCE(?, response_value),
        apply_to = COALESCE(?, apply_to),
        priority = COALESCE(?, priority),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `)

    stmt.run(
      name,
      trigger_type,
      trigger_value,
      response_type,
      response_value,
      apply_to,
      priority,
      is_active !== undefined ? (is_active ? 1 : 0) : undefined,
      id
    )

    const updated = db.prepare('SELECT * FROM auto_reply_rules WHERE id = ?').get(id)
    res.json({ success: true, rule: updated })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Delete an auto reply rule
 */
const deleteRule = async (req, res) => {
  try {
    const { id } = req.params
    const stmt = db.prepare('DELETE FROM auto_reply_rules WHERE id = ?')
    stmt.run(id)
    res.json({ success: true, message: 'Auto reply rule deleted successfully' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Toggle active status of a rule
 */
const toggleRule = async (req, res) => {
  try {
    const { id } = req.params
    const existing = db.prepare('SELECT is_active FROM auto_reply_rules WHERE id = ?').get(id)
    if (!existing) {
      return sendErrorResponse(res, 404, 'Auto reply rule not found')
    }

    const newStatus = existing.is_active === 1 ? 0 : 1
    db.prepare('UPDATE auto_reply_rules SET is_active = ? WHERE id = ?').run(newStatus, id)
    res.json({ success: true, is_active: newStatus })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule
}
