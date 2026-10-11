const db = require('../database')

/**
 * AutoReply Engine Service
 * Evaluates incoming messages against workflow trigger rules per session.
 */

// Helper to evaluate trigger match
function matchesTrigger(rule, message, textBody) {
  const { trigger_type, trigger_value, apply_to } = rule
  const isGroup = message.from?.endsWith('@g.us') || message.to?.endsWith('@g.us') || message.author
  
  // Scope filter: all, individual, group
  if (apply_to === 'individual' && isGroup) return false
  if (apply_to === 'group' && !isGroup) return false

  const cleanText = (textBody || '').trim().toLowerCase()
  const targetValue = (trigger_value || '').trim().toLowerCase()

  switch (trigger_type) {
    case 'contains': {
      // Split trigger_value by comma to support multiple keywords (OR logic)
      const keywords = targetValue.split(',').map(k => k.trim()).filter(Boolean)
      return keywords.some(kw => cleanText.includes(kw))
    }
    case 'exact': {
      return cleanText === targetValue
    }
    case 'starts_with': {
      const keywords = targetValue.split(',').map(k => k.trim()).filter(Boolean)
      return keywords.some(kw => cleanText.startsWith(kw))
    }
    case 'ends_with': {
      const keywords = targetValue.split(',').map(k => k.trim()).filter(Boolean)
      return keywords.some(kw => cleanText.endsWith(kw))
    }
    case 'regex': {
      try {
        const regex = new RegExp(trigger_value, 'i')
        return regex.test(textBody || '')
      } catch (e) {
        return false
      }
    }
    case 'media_type': {
      // e.g. image, video, document, ptt, sticker
      const msgType = message.type || 'chat'
      return targetValue.split(',').map(t => t.trim().toLowerCase()).includes(msgType.toLowerCase())
    }
    case 'time_range': {
      // Format: "08:00-17:00"
      try {
        const [start, end] = targetValue.split('-').map(t => t.trim())
        const now = new Date()
        const currentMins = now.getHours() * 60 + now.getMinutes()
        
        const [sH, sM] = start.split(':').map(Number)
        const [eH, eM] = end.split(':').map(Number)
        const startMins = sH * 60 + sM
        const endMins = eH * 60 + eM
        
        if (startMins <= endMins) {
          return currentMins >= startMins && currentMins <= endMins
        } else {
          // Overnight range, e.g. 22:00-06:00
          return currentMins >= startMins || currentMins <= endMins
        }
      } catch (e) {
        return false
      }
    }
    default:
      return false
  }
}

// Process incoming message against active rules
async function processAutoReply(client, sessionId, message) {
  try {
    // Ignore messages sent by self
    if (message.fromMe) return

    const rules = db.prepare(`
      SELECT * FROM auto_reply_rules 
      WHERE session_id = ? AND is_active = 1 
      ORDER BY priority DESC, id ASC
    `).all(sessionId)

    if (!rules || rules.length === 0) return

    const textBody = message.body || ''
    const targetJid = message.from

    for (const rule of rules) {
      if (matchesTrigger(rule, message, textBody)) {
        console.log(`[AutoReply] Rule "${rule.name}" triggered for session ${sessionId} from ${targetJid}`)
        
        // Execute response
        if (rule.response_type === 'text') {
          // Dynamic placeholder replacement (e.g. {sender}, {time})
          let responseText = rule.response_value || ''
          const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          responseText = responseText.replace(/{time}/g, nowStr)
          
          if (message.reply) {
            await message.reply(responseText)
          } else {
            await client.sendMessage(targetJid, responseText)
          }
        }
        
        // Stop after first matching rule priority
        break
      }
    }
  } catch (err) {
    console.error(`[AutoReply Error] Session ${sessionId}:`, err.message)
  }
}

module.exports = {
  processAutoReply
}
