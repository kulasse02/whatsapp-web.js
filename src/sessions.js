const { Client, LocalAuth } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')
const { baseWebhookURL, sessionFolderPath, maxAttachmentSize, setMessagesAsSeen, webVersion, webVersionCacheType, recoverSessions, maxActiveSessions, sessionIdleTimeoutMs } = require('./config')
const db = require('./database')
const { triggerWebhook, waitForNestedObject, checkIfEventisEnabled } = require('./utils')

const sessions = new Map()
const sessionReactions = new Map()
const sessionActivity = new Map()

const touchSession = (sessionId) => {
  sessionActivity.set(sessionId, Date.now())
}

const saveMessage = async (sessionId, message) => {
  try {
    const remoteJid = message._data?.id?.remote || message._data?.remoteJid || (message.fromMe ? message.to : message.from)
    if (!remoteJid) { console.log('saveMessage: no remoteJid', message.fromMe, message.from, message.to); return }
    const msgWid = message.id?.id || null

    // Check for duplicate msg_wid within the session to prevent double-inserting
    if (msgWid) {
      const existing = db.prepare('SELECT id FROM messages WHERE session_id = ? AND msg_wid = ? LIMIT 1').get(sessionId, msgWid)
      if (existing) return
    }

    let mimetype = message.mimetype || message._data?.mimetype || null
    let mediaPath = null
    if (message.hasMedia && maxAttachmentSize > 0) {
      try {
        const media = await message.downloadMedia().catch(() => null)
        if (media && media.data) {
          if (!mimetype) mimetype = media.mimetype
          const rawMime = (typeof mimetype === 'string' && mimetype) ? mimetype : 'application/octet-stream'
          const ext = (rawMime.split('/')[1] || 'bin').split(';')[0] || 'bin'
          const dir = path.join(__dirname, '..', 'data', 'media', sessionId)
          fs.mkdirSync(dir, { recursive: true })
          const filename = `${remoteJid}_${message.timestamp || Date.now()}.${ext}`
          const filepath = path.join(dir, filename)
          fs.writeFileSync(filepath, media.data, 'base64')
          mediaPath = `/media/${sessionId}/${filename}`
        }
      } catch (err) {
        console.error(`Session ${sessionId} saveMessage media download error:`, err.message)
      }
    }
    
    // Extract quote/reply references (WhatsApp Web structure)
    let parentMsgId = null
    let parentMsgBody = null
    if (message.hasQuotedMsg || message._data?.quotedStanzaID || message._data?.quotedMsg) {
      parentMsgId = message._data?.quotedStanzaID || message._data?.quotedMsg?.id?.id || message._data?.quotedMsg?.id?._serialized || null
      parentMsgBody = message._data?.quotedMsg?.body || message._data?.quotedMsg?.caption || null
      
      if (!parentMsgBody && typeof message.getQuotedMessage === 'function') {
        try {
          const quotedMsgObj = await message.getQuotedMessage()
          if (quotedMsgObj) {
            parentMsgId = parentMsgId || quotedMsgObj.id?.id || quotedMsgObj.id?._serialized || null
            parentMsgBody = quotedMsgObj.body || quotedMsgObj.caption || null
          }
        } catch (e) {}
      }
    }

    const stmt = db.prepare('INSERT INTO messages (session_id, from_me, remote_jid, body, message_type, mimetype, media_path, msg_wid, timestamp, parent_msg_id, parent_msg_body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    stmt.run(sessionId, message.fromMe ? 1 : 0, remoteJid, message.body || '', message.type || 'chat', mimetype, mediaPath, msgWid, message.timestamp || Math.floor(Date.now() / 1000), parentMsgId, parentMsgBody)
  } catch (e) { console.log('saveMessage error:', e.message) }
}

const destroyAllBrowsers = async () => {
  for (const [id, client] of sessions) {
    console.log(`Destroying browser for session ${id}`)
    try {
      if (client._idleTimer) clearTimeout(client._idleTimer)
      if (client.pupBrowser) {
        const childProcess = client.pupBrowser.process()
        if (childProcess) childProcess.kill('SIGKILL')
        await client.pupBrowser.close().catch(() => {})
      }
      await client.destroy().catch(() => {})
    } catch (e) { /* ignore */ }
  }
  sessions.clear()
  sessionActivity.clear()
}

process.on('SIGTERM', async () => { await destroyAllBrowsers(); process.exit(0) })
process.on('SIGINT', async () => { await destroyAllBrowsers(); process.exit(0) })
process.on('exit', () => {
  for (const [, client] of sessions) {
    const proc = client.pupBrowser?.process()
    if (proc) proc.kill('SIGKILL')
  }
})

const removeSingletonFiles = (sessionDir) => {
  for (const file of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      const fp = path.join(sessionDir, file)
      if (fs.existsSync(fp)) fs.unlinkSync(fp)
    } catch (e) { /* ignore */ }
  }
}

// Function to validate if the session is ready
const validateSession = async (sessionId) => {
  try {
    const returnData = { success: false, state: null, message: '' }

    if (!sessions.has(sessionId) || !sessions.get(sessionId)) {
      returnData.message = 'session_not_found'
      return returnData
    }

    const client = sessions.get(sessionId)
    const hasPage = await waitForNestedObject(client, 'pupPage', 3000)
      .then(() => true)
      .catch(() => false)

    if (!hasPage) {
      return { success: false, state: null, message: 'session_not_ready' }
    }

    let maxRetry = 0
    while (true) {
      try {
        if (client.pupPage.isClosed()) {
          return { success: false, state: null, message: 'browser tab closed' }
        }
        await Promise.race([
          client.pupPage.evaluate('1'),
          new Promise(resolve => setTimeout(resolve, 1000))
        ])
        break
      } catch (error) {
        if (maxRetry === 2) {
          return { success: false, state: null, message: 'session closed' }
        }
        maxRetry++
      }
    }

    const state = await client.getState()
    returnData.state = state
    if (state !== 'CONNECTED') {
      returnData.message = 'session_not_connected'
      return returnData
    }

    returnData.success = true
    returnData.message = 'session_connected'
    return returnData
  } catch (error) {
    console.log(error)
    return { success: false, state: null, message: error.message }
  }
}

// Function to handle client session restoration (sequential to avoid race conditions)
const restoreSessions = async () => {
  try {
    if (!fs.existsSync(sessionFolderPath)) {
      fs.mkdirSync(sessionFolderPath)
      return
    }
    const files = await fs.promises.readdir(sessionFolderPath)
    const sessionDirs = files.filter(f => /^session-.+$/.test(f))
    for (const file of sessionDirs) {
      const match = file.match(/^session-(.+)$/)
      if (match) {
        const sessionId = match[1]
        const sessionDir = path.join(sessionFolderPath, file)
        removeSingletonFiles(sessionDir)
        console.log('existing session detected', sessionId)
        // Ensure restored sessions exist in DB table so they remain visible to admin / owner
        try {
          const db = require('./database')
          const existing = db.prepare('SELECT id FROM user_sessions WHERE session_id = ?').get(sessionId)
          if (!existing) {
            // Register under default admin user (id: 1)
            const adminUser = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get()
            const adminId = adminUser ? adminUser.id : 1
            db.prepare('INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?)').run(adminId, sessionId)
          }
        } catch (_) {}
        await setupSession(sessionId)
      }
    }
  } catch (error) {
    console.error('Failed to restore sessions:', error)
  }
}

const setupSession = async (sessionId) => {
  try {
    if (sessions.has(sessionId)) {
      return { success: false, message: `Session already exists for: ${sessionId}`, client: sessions.get(sessionId) }
    }

    if (sessions.size >= maxActiveSessions) {
      return {
        success: false,
        message: `Max active sessions limit (${maxActiveSessions}) reached. Terminate an inactive session first.`,
        client: null
      }
    }

    const sessionDir = path.join(sessionFolderPath, `session-${sessionId}`)
    if (fs.existsSync(sessionDir)) {
      removeSingletonFiles(sessionDir)
    }

    const localAuth = new LocalAuth({ clientId: sessionId, dataPath: sessionFolderPath })
    delete localAuth.logout
    localAuth.logout = () => { }

    const clientOptions = {
      puppeteer: {
        executablePath: process.env.CHROME_BIN || null,
        // headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      authStrategy: localAuth
    }

    if (webVersion) {
      clientOptions.webVersion = webVersion
      switch (webVersionCacheType.toLowerCase()) {
        case 'local':
          clientOptions.webVersionCache = {
            type: 'local'
          }
          break
        case 'remote':
          clientOptions.webVersionCache = {
            type: 'remote',
            remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/' + webVersion + '.html'
          }
          break
        default:
          clientOptions.webVersionCache = {
            type: 'none'
          }
      }
    }

    const client = new Client(clientOptions)

    client.initialize().catch(err => console.log('Initialize error:', err.message))

    initializeEvents(client, sessionId)

    // Save the session to the Map
    sessions.set(sessionId, client)
    touchSession(sessionId)

    // Idle timeout: if configured (>0) and no activity for sessionIdleTimeoutMs, close the browser and drop the session
    if (client._idleTimer) clearTimeout(client._idleTimer)
    if (sessionIdleTimeoutMs > 0) {
      client._idleTimer = setTimeout(async () => {
        if (sessions.get(sessionId) !== client) return
        const last = sessionActivity.get(sessionId) || 0
        if (Date.now() - last >= sessionIdleTimeoutMs) {
          console.log(`Session ${sessionId} idle for >${sessionIdleTimeoutMs}ms. Closing browser.`)
          await disconnectSession(sessionId)
        }
      }, sessionIdleTimeoutMs)
      if (client._idleTimer && typeof client._idleTimer.unref === 'function') client._idleTimer.unref()
    }

    return { success: true, message: 'Session initiated successfully', client }
  } catch (error) {
    return { success: false, message: error.message, client: null }
  }
}

const initializeEvents = (client, sessionId) => {
  // check if the session webhook is overridden
  const sessionWebhook = process.env[sessionId.toUpperCase() + '_WEBHOOK_URL'] || baseWebhookURL

  client.on('ready', () => {
    console.log(`Session ${sessionId} ready`)
    client.qr = null
    touchSession(sessionId)
  })

  client.on('authenticated', () => {
    console.log(`Session ${sessionId} authenticated`)
    client.qr = null
  })

  if (recoverSessions) {
    waitForNestedObject(client, 'pupPage').then(() => {
      const restartSession = async (sessionId) => {
        sessions.delete(sessionId)
        await client.destroy().catch(e => { })
        await setupSession(sessionId)
      }
      client.pupPage.once('close', function () {
        // emitted when the page closes
        console.log(`Browser page closed for ${sessionId}. Restoring`)
        restartSession(sessionId)
      })
      client.pupPage.once('error', function () {
        // emitted when the page crashes
        console.log(`Error occurred on browser page for ${sessionId}. Restoring`)
        restartSession(sessionId)
      })
    }).catch(e => { })
  }

  checkIfEventisEnabled('auth_failure')
    .then(_ => {
      client.on('auth_failure', (msg) => {
        triggerWebhook(sessionWebhook, sessionId, 'status', { msg })
      })
    })

  checkIfEventisEnabled('authenticated')
    .then(_ => {
      client.on('authenticated', () => {
        triggerWebhook(sessionWebhook, sessionId, 'authenticated')
      })
    })

  checkIfEventisEnabled('call')
    .then(_ => {
      client.on('call', async (call) => {
        triggerWebhook(sessionWebhook, sessionId, 'call', { call })
      })
    })

  checkIfEventisEnabled('change_state')
    .then(_ => {
      client.on('change_state', state => {
        triggerWebhook(sessionWebhook, sessionId, 'change_state', { state })
      })
    })

  checkIfEventisEnabled('disconnected')
    .then(_ => {
      client.on('disconnected', (reason) => {
        triggerWebhook(sessionWebhook, sessionId, 'disconnected', { reason })
      })
    })

  checkIfEventisEnabled('group_join')
    .then(_ => {
      client.on('group_join', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_join', { notification })
      })
    })

  checkIfEventisEnabled('group_leave')
    .then(_ => {
      client.on('group_leave', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_leave', { notification })
      })
    })

  checkIfEventisEnabled('group_update')
    .then(_ => {
      client.on('group_update', (notification) => {
        triggerWebhook(sessionWebhook, sessionId, 'group_update', { notification })
      })
    })

  checkIfEventisEnabled('loading_screen')
    .then(_ => {
      client.on('loading_screen', (percent, message) => {
        triggerWebhook(sessionWebhook, sessionId, 'loading_screen', { percent, message })
      })
    })

  checkIfEventisEnabled('media_uploaded')
    .then(_ => {
      client.on('media_uploaded', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'media_uploaded', { message })
      })
    })

  const { processAutoReply } = require('./services/autoReplyService')

  checkIfEventisEnabled('message')
    .then(_ => {
      client.on('message', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message', { message })
        touchSession(sessionId)
        
        // Trigger Workflow Auto Reply Engine
        processAutoReply(client, sessionId, message).catch(e => console.log('AutoReply execution error:', e.message))

        if (message.hasMedia && typeof message._data?.size === 'number' && message._data.size < maxAttachmentSize) {
          checkIfEventisEnabled('media').then(_ => {
            const hasValidMime = !!(message.mimetype || message._data?.mimetype)
            if (hasValidMime) {
              message.downloadMedia().then(messageMedia => {
                if (messageMedia) {
                  triggerWebhook(sessionWebhook, sessionId, 'media', { messageMedia, message })
                }
              }).catch(e => {
                // Non-fatal download error (e.g. expired media or network issue)
              })
            }
          })
        }
        if (setMessagesAsSeen && message.from && !message.from.includes('status@broadcast') && !message.from.includes('newsletter')) {
          try {
            const chat = await message.getChat().catch(() => null)
            if (chat && typeof chat.sendSeen === 'function') {
              chat.sendSeen().catch(() => {})
            }
          } catch (e) {
            // ignore non-fatal getChat error
          }
        }
      })
    })

  checkIfEventisEnabled('message_ack')
    .then(_ => {
      client.on('message_ack', async (message, ack) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ack', { message, ack })
        touchSession(sessionId)
        if (setMessagesAsSeen && message.from && !message.from.includes('status@broadcast') && !message.from.includes('newsletter')) {
          try {
            const chat = await message.getChat().catch(() => null)
            if (chat && typeof chat.sendSeen === 'function') {
              chat.sendSeen().catch(() => {})
            }
          } catch (e) {
            // ignore non-fatal getChat error
          }
        }
      })
    })

  checkIfEventisEnabled('message_create')
    .then(_ => {
      client.on('message_create', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_create', { message })
        touchSession(sessionId)
        saveMessage(sessionId, message)
        if (setMessagesAsSeen && message.from && !message.from.includes('status@broadcast') && !message.from.includes('newsletter')) {
          try {
            const chat = await message.getChat().catch(() => null)
            if (chat && typeof chat.sendSeen === 'function') {
              chat.sendSeen().catch(() => {})
            }
          } catch (e) {
            // ignore non-fatal getChat error
          }
        }
      })
    })

  checkIfEventisEnabled('message_reaction')
    .then(_ => {
      client.on('message_reaction', (reaction) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_reaction', { reaction })
        const msgId = reaction.msgId?._serialized || reaction.msgId?.id
        if (msgId) {
          if (!sessionReactions.has(sessionId)) sessionReactions.set(sessionId, new Map())
          const map = sessionReactions.get(sessionId)
          if (!map.has(msgId)) map.set(msgId, [])
          const existing = map.get(msgId)
          const idx = existing.findIndex(r => r.senderId === reaction.senderId)
          if (idx >= 0) {
            if (reaction.reaction) existing[idx].emoji = reaction.reaction
            else existing.splice(idx, 1)
          } else if (reaction.reaction) {
            existing.push({ emoji: reaction.reaction, senderId: reaction.senderId, ts: reaction.timestamp })
          }
        }
      })
    })

  checkIfEventisEnabled('message_edit')
    .then(_ => {
      client.on('message_edit', (message, newBody, prevBody) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_edit', { message, newBody, prevBody })
      })
    })

  checkIfEventisEnabled('message_ciphertext')
    .then(_ => {
      client.on('message_ciphertext', (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_ciphertext', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_everyone')
    .then(_ => {
      // eslint-disable-next-line camelcase
      client.on('message_revoke_everyone', async (message) => {
        // eslint-disable-next-line camelcase
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_everyone', { message })
      })
    })

  checkIfEventisEnabled('message_revoke_me')
    .then(_ => {
      client.on('message_revoke_me', async (message) => {
        triggerWebhook(sessionWebhook, sessionId, 'message_revoke_me', { message })
      })
    })

  client.on('qr', (qr) => {
    // inject qr code into session
    client.qr = qr
    checkIfEventisEnabled('qr')
      .then(_ => {
        triggerWebhook(sessionWebhook, sessionId, 'qr', { qr })
      })
  })

  checkIfEventisEnabled('ready')
    .then(_ => {
      client.on('ready', () => {
        triggerWebhook(sessionWebhook, sessionId, 'ready')
      })
    })

  checkIfEventisEnabled('contact_changed')
    .then(_ => {
      client.on('contact_changed', async (message, oldId, newId, isContact) => {
        triggerWebhook(sessionWebhook, sessionId, 'contact_changed', { message, oldId, newId, isContact })
      })
    })

  checkIfEventisEnabled('chat_removed')
    .then(_ => {
      client.on('chat_removed', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_removed', { chat })
      })
    })

  checkIfEventisEnabled('chat_archived')
    .then(_ => {
      client.on('chat_archived', async (chat, currState, prevState) => {
        triggerWebhook(sessionWebhook, sessionId, 'chat_archived', { chat, currState, prevState })
      })
    })

  checkIfEventisEnabled('unread_count')
    .then(_ => {
      client.on('unread_count', async (chat) => {
        triggerWebhook(sessionWebhook, sessionId, 'unread_count', { chat })
      })
    })
}

// Function to delete client session folder
const deleteSessionFolder = async (sessionId) => {
  try {
    const targetDirPath = path.join(sessionFolderPath, `session-${sessionId}`)
    const resolvedTargetDirPath = await fs.promises.realpath(targetDirPath)
    const resolvedSessionPath = await fs.promises.realpath(sessionFolderPath)

    // Ensure the target directory path ends with a path separator
    const safeSessionPath = `${resolvedSessionPath}${path.sep}`

    // Validate the resolved target directory path is a subdirectory of the session folder path
    if (!resolvedTargetDirPath.startsWith(safeSessionPath)) {
      throw new Error('Invalid path: Directory traversal detected')
    }
    await fs.promises.rm(resolvedTargetDirPath, { recursive: true, force: true })
  } catch (error) {
    console.log('Folder deletion error', error)
    throw error
  }
}

const reloadSession = async (sessionId) => {
  try {
    const client = sessions.get(sessionId)
    if (!client) return
    client.pupPage?.removeAllListeners('close')
    client.pupPage?.removeAllListeners('error')
    if (client.pupBrowser) {
      const childProcess = client.pupBrowser.process()
      try {
        const pages = await client.pupBrowser.pages().catch(() => [])
        await Promise.allSettled(pages.map((page) => page.close().catch(() => {})))
        await Promise.race([
          client.pupBrowser.close().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 3000))
        ])
      } catch (e) { /* ignore */ }
      if (childProcess) childProcess.kill('SIGKILL')
    }
    sessions.delete(sessionId)
    sessionActivity.delete(sessionId)
    await setupSession(sessionId)
  } catch (error) {
    console.log(error)
    throw error
  }
}

const deleteSession = async (sessionId, validation) => {
  try {
    const client = sessions.get(sessionId)
    if (client) {
      client.pupPage?.removeAllListeners('close')
      client.pupPage?.removeAllListeners('error')
      const childProcess = client.pupBrowser?.process()
      if (validation?.success) {
        console.log(`Logging out session ${sessionId}`)
        await client.logout().catch(() => {})
      } else if (validation?.message === 'session_not_connected') {
        console.log(`Destroying session ${sessionId}`)
        await client.destroy().catch(() => {})
      }
      if (childProcess) childProcess.kill('SIGKILL')
      sessions.delete(sessionId)
      sessionActivity.delete(sessionId)
    }

    // Always delete folder and DB record regardless of in-memory status
    await deleteSessionFolder(sessionId).catch(() => {})
    try {
      db.prepare('DELETE FROM user_sessions WHERE session_id = ?').run(sessionId)
    } catch (_) {}
  } catch (error) {
    console.log('deleteSession error:', error)
    throw error
  }
}

// Function to handle session flush
const flushSessions = async (deleteOnlyInactive) => {
  try {
    // Read the contents of the sessions folder
    const files = await fs.promises.readdir(sessionFolderPath)
    // Iterate through the files in the parent folder
    for (const file of files) {
      // Use regular expression to extract the string from the folder name
      const match = file.match(/^session-(.+)$/)
      if (match) {
        const sessionId = match[1]
        const validation = await validateSession(sessionId)
        if (!deleteOnlyInactive || !validation.success) {
          await deleteSession(sessionId, validation)
        }
      }
    }
  } catch (error) {
    console.log(error)
    throw error
  }
}

const disconnectSession = async (sessionId) => {
  try {
    const client = sessions.get(sessionId)
    if (!client) return
    client.pupPage?.removeAllListeners('close')
    client.pupPage?.removeAllListeners('error')
    if (client.pupBrowser) {
      const childProcess = client.pupBrowser.process()
      try {
        const pages = await client.pupBrowser.pages().catch(() => [])
        await Promise.allSettled(pages.map((page) => page.close().catch(() => {})))
        await Promise.race([
          client.pupBrowser.close().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 3000))
        ])
      } catch (e) { /* ignore */ }
      if (childProcess) childProcess.kill('SIGKILL')
    }
    if (client._idleTimer) clearTimeout(client._idleTimer)
    sessions.delete(sessionId)
    sessionActivity.delete(sessionId)
  } catch (error) {
    console.log(error)
    throw error
  }
}

const periodicSessionCleaner = async () => {
  const now = Date.now()
  const reaped = []
  for (const [sessionId, client] of sessions) {
    try {
      // Browser already dead (tab closed / crashed) -> zombie session
      let browserDead = false
      if (client.pupPage && typeof client.pupPage.isClosed === 'function') {
        try {
          browserDead = client.pupPage.isClosed()
        } catch (_) {
          browserDead = true
        }
      }
      if (!client.pupBrowser) browserDead = true

      const last = sessionActivity.get(sessionId) || 0
      const isIdle = sessionIdleTimeoutMs > 0 && (now - last >= sessionIdleTimeoutMs)
      
      // Never kill a connected healthy session just because of inactivity unless browser is dead
      let shouldReap = browserDead
      if (!browserDead && isIdle) {
        // If state is CONNECTED, keep it alive unless forced
        const state = await client.getState().catch(() => null)
        if (state !== 'CONNECTED') {
          shouldReap = true
        } else {
          // If still connected, refresh activity so it's not marked idle continuously
          touchSession(sessionId)
        }
      }

      if (shouldReap) {
        console.log(`Cleaner: closing session ${sessionId} (deadBrowser=${browserDead}, idle=${isIdle})`)
        await disconnectSession(sessionId)
        reaped.push(sessionId)
      }
    } catch (e) {
      console.log(`Cleaner error for ${sessionId}:`, e.message)
    }
  }
  if (reaped.length) {
    console.log(`Cleaner: ${reaped.length} session(s) closed: ${reaped.join(', ')}`)
  }
}

const startPeriodicCleaner = (intervalMs) => {
  const timer = setInterval(() => {
    periodicSessionCleaner().catch(e => console.error('periodicSessionCleaner error:', e.message))
  }, intervalMs)
  if (timer && typeof timer.unref === 'function') timer.unref()
  return timer
}

module.exports = {
  sessions,
  sessionReactions,
  setupSession,
  restoreSessions,
  validateSession,
  deleteSession,
  reloadSession,
  flushSessions,
  disconnectSession,
  periodicSessionCleaner,
  startPeriodicCleaner,
  touchSession,
  saveMessage
}
