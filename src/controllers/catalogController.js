const db = require('../database')
const { sendErrorResponse } = require('../utils')

const getCatalogs = async (req, res) => {
  try {
    const { sessionId } = req.params
    const catalogs = db.prepare('SELECT id, session_id, name, description, price, image_base64, created_at FROM business_catalogs WHERE session_id = ? ORDER BY id DESC').all(sessionId)
    res.json({ success: true, data: catalogs })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const createCatalog = async (req, res) => {
  try {
    const { sessionId } = req.params
    const { name, description, price, image_base64 } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }

    const priceVal = price ? parseFloat(price) : 0.0
    const result = db.prepare('INSERT INTO business_catalogs (session_id, name, description, price, image_base64) VALUES (?, ?, ?, ?, ?)')
      .run(sessionId, name.trim(), description || '', priceVal, image_base64 || '')

    res.json({ success: true, id: result.lastInsertRowId, message: 'Product added to catalog' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const updateCatalog = async (req, res) => {
  try {
    const { sessionId, id } = req.params
    const { name, description, price, image_base64 } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required' })
    }

    const priceVal = price ? parseFloat(price) : 0.0
    // Check if item exists
    const item = db.prepare('SELECT 1 FROM business_catalogs WHERE id = ? AND session_id = ?').get(id, sessionId)
    if (!item) {
      return res.status(404).json({ success: false, error: 'Product not found in this session catalog' })
    }

    db.prepare('UPDATE business_catalogs SET name = ?, description = ?, price = ?, image_base64 = ? WHERE id = ? AND session_id = ?')
      .run(name.trim(), description || '', priceVal, image_base64 || '', id, sessionId)

    res.json({ success: true, message: 'Product updated successfully' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const deleteCatalog = async (req, res) => {
  try {
    const { sessionId, id } = req.params
    const result = db.prepare('DELETE FROM business_catalogs WHERE id = ? AND session_id = ?').run(id, sessionId)
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' })
    }

    res.json({ success: true, message: 'Product deleted from catalog' })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  getCatalogs,
  createCatalog,
  updateCatalog,
  deleteCatalog
}
