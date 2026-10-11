const { sessions } = require('../sessions')
const { sendErrorResponse } = require('../utils')
const db = require('../database')

/**
 * @function
 * @async
 * @name getClassInfo
 * @description Gets information about a chat using the chatId and sessionId
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {string} req.body.chatId - The ID of the chat to get information for
 * @param {string} req.params.sessionId - The ID of the session to use
 * @returns {Object} - Returns a JSON object with the success status and chat information
 * @throws {Error} - Throws an error if chat is not found or if there is a server error
 */
const getClassInfo = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    res.json({ success: true, chat })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Clears all messages in a chat.
 *
 * @function
 * @async
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The ID of the session.
 * @param {string} req.body.chatId - The ID of the chat to clear messages from.
 * @throws {Error} If the chat is not found or there is an internal server error.
 * @returns {Object} The success status and the cleared messages.
 */
const clearMessages = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const clearMessages = await chat.clearMessages()
    res.json({ success: true, clearMessages })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Stops typing or recording in chat immediately.
 *
 * @function
 * @async
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {string} req.body.chatId - ID of the chat to clear the state for.
 * @param {string} req.params.sessionId - ID of the session the chat belongs to.
 * @returns {Promise<void>} - A Promise that resolves with a JSON object containing a success flag and the result of clearing the state.
 * @throws {Error} - If there was an error while clearing the state.
 */
const clearState = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const clearState = await chat.clearState()
    res.json({ success: true, clearState })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Delete a chat.
 *
 * @async
 * @function
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {string} req.body.chatId - The ID of the chat to be deleted.
 * @returns {Object} A JSON response indicating whether the chat was deleted successfully.
 * @throws {Object} If there is an error while deleting the chat, an error response is sent with a status code of 500.
 * @throws {Object} If the chat is not found, an error response is sent with a status code of 404.
 */
const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const deleteChat = await chat.delete()
    res.json({ success: true, deleteChat })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Fetches messages from a specified chat.
 *
 * @function
 * @async
 *
 * @param {Object} req - The request object containing sessionId, chatId, and searchOptions.
 * @param {string} req.params.sessionId - The ID of the session associated with the chat.
 * @param {Object} req.body - The body of the request containing chatId and searchOptions.
 * @param {string} req.body.chatId - The ID of the chat from which to fetch messages.
 * @param {Object} req.body.searchOptions - The search options to use when fetching messages.
 *
 * @param {Object} res - The response object to send the fetched messages.
 * @returns {Promise<Object>} A JSON object containing the success status and fetched messages.
 *
 * @throws {Error} If the chat is not found or there is an error fetching messages.
 */
const fetchMessages = async (req, res) => {
  try {
    const { chatId, searchOptions } = req.body
    const client = sessions.get(req.params.sessionId)
    const limit = searchOptions?.limit || 50

    const result = await client.pupPage.evaluate(async ({ chatId, limit }) => {
      const chatWid = window.require('WAWebWidFactory').createWid(chatId)
      const chat = window.require('WAWebCollections').Chat.get(chatWid)
      if (!chat) return { error: 'chat not found' }

      const msgsType = typeof chat.msgs
      const msgsKeys = chat.msgs ? Object.keys(chat.msgs).join(',') : 'null'
      const msgsLen = chat.msgs?.length
      const hasModels = !!chat.msgs?.models
      const modelsLen = chat.msgs?.models?.length

      const sample = []
      if (chat.msgs && chat.msgs.length > 0) {
        for (let i = 0; i < Math.min(chat.msgs.length, 3); i++) {
          const m = chat.msgs[i]
          if (!m) continue
          sample.push({
            idKeys: m.__x_id ? Object.keys(m.__x_id).join(',') : 'no-id',
            body: m.__x_body || m.body || 'no-body',
            t: m.__x_t || m.t
          })
        }
      }

      return { msgsType, msgsKeys, msgsLen, hasModels, modelsLen, sample }
    }, { chatId, limit })

    res.json({ success: true, ...result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Gets the contact for a chat
 * @async
 * @function
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {string} req.params.sessionId - The ID of the current session
 * @param {string} req.body.chatId - The ID of the chat to get the contact for
 * @returns {Promise<void>} - Promise that resolves with the chat's contact information
 * @throws {Error} - Throws an error if chat is not found or if there is an error getting the contact information
 */
const getContact = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const contact = await chat.getContact()
    res.json({ success: true, contact })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Send a recording state to a WhatsApp chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat to send the recording state to.
 * @returns {object} - An object containing a success message and the result of the sendStateRecording method.
 * @throws {object} - An error object containing a status code and error message if an error occurs.
 */
const sendStateRecording = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const sendStateRecording = await chat.sendStateRecording()
    res.json({ success: true, sendStateRecording })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Send a typing state to a WhatsApp chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat to send the typing state to.
 * @returns {object} - An object containing a success message and the result of the sendStateTyping method.
 * @throws {object} - An error object containing a status code and error message if an error occurs.
 */
const sendStateTyping = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const sendStateTyping = await chat.sendStateTyping()
    res.json({ success: true, sendStateTyping })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Gets chat labels.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 */
const getLabels = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.getLabels()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Changes chat labels.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 * @param {Array<string>} req.body.labelIds - Array of label IDs.
 */
const changeLabels = async (req, res) => {
  try {
    const { chatId, labelIds } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.changeLabels(labelIds)
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Gets pinned messages in a chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 */
const getPinnedMessages = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.getPinnedMessages()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Syncs history for a chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 */
const syncHistory = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.syncHistory()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Adds or edits a customer note for a chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 * @param {string} req.body.note - The note to add or edit.
 */
const addOrEditCustomerNote = async (req, res) => {
  try {
    const { chatId, note } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.addOrEditCustomerNote(note)
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

/**
 * Gets the customer note for a chat.
 * @async
 * @function
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {string} req.params.sessionId - The session ID.
 * @param {object} req.body - The request body.
 * @param {string} req.body.chatId - The ID of the chat.
 */
const getCustomerNote = async (req, res) => {
  try {
    const { chatId } = req.body
    const client = sessions.get(req.params.sessionId)
    const chat = await client.getChatById(chatId)
    if (!chat) { sendErrorResponse(res, 404, 'Chat not Found') }
    const result = await chat.getCustomerNote()
    res.json({ success: true, result })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const resolveChatId = async (req, res) => {
  try {
    const { sessionId, chatId } = req.params
    const client = sessions.get(sessionId)
    if (!client || !client.pupPage) return res.json({ success: false })
    const result = await client.pupPage.evaluate((cid) => {
      try {
        const C = window.require('WAWebCollections')
        const chats = C.Chat.getModelsArray()
        for (const ch of chats) {
          if (ch.id?._serialized === cid) return { resolved: cid }
        }
        const contacts = C.Contact.getModelsArray()
        const cidUser = cid.split('@')[0]
        const variants = [cidUser, '62' + cidUser.replace(/^0+/, ''), cidUser.replace(/^62/, '0')]
        for (const ct of contacts) {
          const ctUser = (ct.id?._serialized || '').split('@')[0]
          if (variants.includes(ctUser)) return { resolved: ct.id._serialized }
        }
        return { resolved: null }
      } catch (e) {
        return { resolved: null }
      }
    }, chatId)
    res.json({ success: true, ...result, chatId })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const getMessages = async (req, res) => {
  try {
    const { sessionId, chatId } = req.params
    const limit = parseInt(req.query.limit) || 50

    // Find all matching JIDs (e.g. if chatId is LID or phone number, find linked representations in DB)
    const targetJids = [chatId]
    const userPart = chatId.split('@')[0]
    
    // Check if there are other messages that match userPart (e.g. lid vs c.us)
    const altRows = db.prepare('SELECT DISTINCT remote_jid FROM messages WHERE session_id = ? AND (remote_jid LIKE ? OR remote_jid = ?) LIMIT 5')
      .all(sessionId, `%${userPart}%`, chatId)
    for (const r of altRows) {
      if (r.remote_jid && !targetJids.includes(r.remote_jid)) {
        targetJids.push(r.remote_jid)
      }
    }

    const placeholders = targetJids.map(() => '?').join(',')
    // Fetch the latest `limit` messages (DESC) and then return them sorted ASC so the newest messages are shown
    const sql = `
      SELECT * FROM (
        SELECT id AS _serialized, from_me AS fromMe, body, timestamp, message_type AS messageType, mimetype, media_path AS mediaPath, msg_wid AS msgWid, remote_jid AS remoteJid, parent_msg_id AS parentMsgId, parent_msg_body AS parentMsgBody
        FROM messages
        WHERE session_id = ? AND remote_jid IN (${placeholders})
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
      ) sub
      ORDER BY timestamp ASC, _serialized ASC
    `
    const rows = db.prepare(sql).all(sessionId, ...targetJids, limit)
    res.json({ success: true, messages: rows })
  } catch (error) {
    sendErrorResponse(res, 500, error.message)
  }
}

const getMessageMedia = async (req, res) => {
  try {
    const { sessionId, chatId, msgWid } = req.params
    const client = sessions.get(sessionId)
    if (!client || !client.pupPage) return sendErrorResponse(res, 404, 'session not found')

    // Construct full serialized IDs based on database message origin records
    const msgRow = db.prepare('SELECT from_me FROM messages WHERE session_id = ? AND remote_jid = ? AND msg_wid = ?').get(sessionId, chatId, msgWid)
    const fromMe = msgRow ? msgRow.from_me === 1 : false
    const serializedId = `${fromMe ? 'true' : 'false'}_${chatId}_${msgWid}`
    const altSerializedId = `${!fromMe ? 'true' : 'false'}_${chatId}_${msgWid}`

    console.log('[getMessageMedia] sessionId:', sessionId, 'chatId:', chatId, 'msgWid:', msgWid, 'serializedId:', serializedId)

    const result = await client.pupPage.evaluate(async ({ serializedId, altSerializedId, chatId }) => {
      try {
        const MsgCollection = window.require('WAWebCollections').Msg
        let m = MsgCollection.get(serializedId) || MsgCollection.get(altSerializedId)
        let debug = { directGet: !!m, totalModels: MsgCollection.models?.length || 0 }

        // 1. Try to fetch the message directly from WhatsApp servers by its full serialized ID
        if (!m) {
          try {
            const res = await MsgCollection.getMessagesById([serializedId])
            debug.getByIdPrimary = res?.messages?.length || 0
            if (res && res.messages && res.messages.length > 0) {
              m = res.messages[0]
              debug.primaryMsgKeys = Object.keys(m || {})
              debug.primaryMsgIdProps = m.id ? Object.keys(m.id || {}) : null
              debug.primaryMsgIdSerialized = m.id?._serialized || null
            }
          } catch (e) { debug.getByIdPrimaryErr = e.message }
        }
        if (!m) {
          try {
            const res = await MsgCollection.getMessagesById([altSerializedId])
            debug.getByIdAlt = res?.messages?.length || 0
            if (res && res.messages && res.messages.length > 0) {
              m = res.messages[0]
              debug.altMsgKeys = Object.keys(m || {})
              debug.altMsgIdProps = m.id ? Object.keys(m.id || {}) : null
              debug.altMsgIdSerialized = m.id?._serialized || null
            }
          } catch (e) { debug.getByIdAltErr = e.message }
        }

        // 2. Fallback: Scan global Msg Collection models by short ID
        if (!m) {
          const idOnly = serializedId.split('_')[2]
          if (MsgCollection.models) {
            for (const model of MsgCollection.models) {
              if (model.id?.id === idOnly || model.id?._serialized === serializedId || model.id?._serialized === altSerializedId) {
                m = model
                break
              }
            }
          }
        }

        let targetId = serializedId
        if (m && m.id) {
          if (m.id._serialized) targetId = m.id._serialized
          else if (m.id.$1) targetId = m.id.$1
          else if (m.id.id) targetId = `${m.id.fromMe ? 'true' : 'false'}_${m.id.remote}_${m.id.id}`
        }
        // 3. Fallback resolveMediaBlob if MsgCollection getMessagesById doesn't supply a standard object
        let resolved = null
        if (targetId) {
          try {
            resolved = await window.WWebJS.resolveMediaBlob(targetId)
          } catch (e) {
            debug.resolveErr = e.message
            // Inline polyfill for resolveMediaBlob if internal collections get corrupted
            if (m && m.downloadMedia) {
              try {
                await m.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true })
                const cached = window.require('WAWebMediaInMemoryBlobCache')?.InMemoryMediaBlobCache?.get(m.mediaObject?.filehash)
                let blob = cached || (m.mediaObject?.mediaBlob ? m.mediaObject.mediaBlob.forceToBlob() : null)
                if (blob) {
                  resolved = {
                    blob,
                    mimetype: m.mimetype,
                    filename: m.filename,
                    filesize: m.size
                  }
                }
              } catch (e2) { debug.inlineDownloadErr = e2.message }
            }
          }
        }

        if (resolved && resolved.blob) {
          debug.resolved = true
          debug.hasBlob = true
          try {
            // Convert Blob to base64 using the official WWebJS helper
            const data = await window.WWebJS.arrayBufferToBase64Async(
              await resolved.blob.arrayBuffer()
            )
            debug.dataLen = data?.length || 0
            return {
              data,
              mimetype: resolved.mimetype,
              filename: resolved.filename,
              _debug: debug
            }
          } catch (e3) { debug.base64Err = e3.message }
        }

        return { _debug: debug }
      } catch (e) { return { _debug: { fatalErr: e.message } } }
    }, { serializedId, altSerializedId, chatId })

    // Log diagnostic info from browser context
    if (result && result._debug) {
      console.log('[getMessageMedia] Browser debug:', JSON.stringify(result._debug))
    }

    if (!result || !result.data) return sendErrorResponse(res, 404, 'media not found')
    const { _debug, ...mediaData } = result
    res.json({ success: true, ...mediaData })
  } catch (error) {
    console.log('[getMessageMedia] Route error:', error.message)
    sendErrorResponse(res, 500, error.message)
  }
}

module.exports = {
  getClassInfo,
  clearMessages,
  clearState,
  deleteChat,
  fetchMessages,
  getContact,
  sendStateRecording,
  sendStateTyping,
  getLabels,
  changeLabels,
  getPinnedMessages,
  syncHistory,
  addOrEditCustomerNote,
  getCustomerNote,
  getMessages,
  resolveChatId,
  getMessageMedia
}
