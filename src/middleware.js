const { globalApiKey, jwtSecret, rateLimitMax, rateLimitWindowMs } = require('./config')
const { sendErrorResponse } = require('./utils')
const { validateSession } = require('./sessions')
const rateLimiting = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const db = require('./database')

const apikey = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), jwtSecret)
      req.user = decoded
    } catch (e) { /* invalid token, fall through to error */ }
  }

  // Bypass API Key check entirely if request is authenticated via JWT (session ownership is protected separately)
  if (req.user) {
    return next()
  }

  if (globalApiKey) {
    const apiKey = req.headers['x-api-key']
    if (apiKey && apiKey === globalApiKey) return next()

    // Do NOT log the API key value to console or output for security/privacy
    return sendErrorResponse(res, 403, 'Invalid API key')
  }
  next()
}

const sessionNameValidation = async (req, res, next) => {
  /*
    #swagger.parameters['sessionId'] = {
      in: 'path',
      description: 'Unique identifier for the session (alphanumeric and - allowed)',
      required: true,
      type: 'string',
      example: 'f8377d8d-a589-4242-9ba6-9486a04ef80c'
    }
  */
  if ((!/^[\w-]+$/.test(req.params.sessionId))) {
    /* #swagger.responses[422] = {
        description: "Unprocessable Entity.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/ErrorResponse" }
          }
        }
      }
    */
    return sendErrorResponse(res, 422, 'Session should be alphanumerical or -')
  }
  next()
}

const sessionExistenceValidation = async (req, res, next) => {
  const { sessions } = require('./sessions')
  const session = sessions.get(req.params.sessionId)
  if (!session) {
    return sendErrorResponse(res, 404, 'session_not_found')
  }
  next()
}

const sessionValidation = async (req, res, next) => {
  const validation = await validateSession(req.params.sessionId)
  if (validation.success !== true) {
    /* #swagger.responses[404] = {
        description: "Not Found.",
        content: {
          "application/json": {
            schema: { "$ref": "#/definitions/NotFoundResponse" }
          }
        }
      }
    */
    return sendErrorResponse(res, 404, validation.message)
  }
  const { touchSession } = require('./sessions')
  touchSession(req.params.sessionId)
  next()
}

const rateLimiter = rateLimiting({
  max: rateLimitMax,
  windowMS: rateLimitWindowMs,
  message: "You can't make any more requests at the moment. Try again later"
})

const sessionSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Session']
  */
  next()
}

const clientSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Client']
  */
  next()
}

const contactSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Contact']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the contact',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

const messageSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Message']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'The Chat id which contains the message',
            example: '6281288888888@c.us'
          },
          messageId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the message',
            example: 'ABCDEF999999999'
          }
        }
      }
    }
  */
  next()
}

const chatSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Chat']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the given Chat (either group or personnal)',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

const groupChatSwagger = async (req, res, next) => {
  /*
    #swagger.tags = ['Group Chat']
    #swagger.requestBody = {
      required: true,
      schema: {
        type: 'object',
        properties: {
          chatId: {
            type: 'string',
            description: 'Unique whatsApp identifier for the given Chat (either group or personnal)',
            example: '6281288888888@c.us'
          }
        }
      }
    }
  */
  next()
}

const extractSessionId = (req) => {
  if (req.params && req.params.sessionId) return req.params.sessionId
  if (req.body && req.body.sessionId) return req.body.sessionId

  // Check URL path or originalUrl (e.g. /session/start/:id, /client/getChats/:id, /api/auto-reply/:id)
  const fullPath = req.originalUrl ? req.originalUrl.split('?')[0] : (req.path || '')
  const patterns = [
    /^\/(?:api\/)?session\/(?:start|status|qr|restart|disconnect|terminate)\/([^\/]+)/,
    /^\/(?:api\/)?client\/[^\/]+\/([^\/]+)/,
    /^\/(?:api\/)?chat\/[^\/]+\/([^\/]+)/,
    /^\/(?:api\/)?groupChat\/[^\/]+\/([^\/]+)/,
    /^\/(?:api\/)?message\/[^\/]+\/([^\/]+)/,
    /^\/(?:api\/)?contact\/[^\/]+\/([^\/]+)/,
    /^\/api\/auto-reply\/([^\/]+)/
  ]
  for (const regex of patterns) {
    const m = fullPath.match(regex)
    if (m && m[1]) return m[1]
  }
  return null
}

const sessionOwnership = async (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  if (apiKey && apiKey === globalApiKey) return next()

  if (req.user && req.user.is_admin === 1) return next()

  if (req.user) {
    const sessionId = extractSessionId(req)
    // If no sessionId in this request (e.g. /session/list), allow through
    if (!sessionId) return next()

    try {
      const row = db.prepare('SELECT user_id FROM user_sessions WHERE session_id = ?').get(sessionId)
      if (row) {
        if (row.user_id !== req.user.id) {
          return sendErrorResponse(res, 403, 'Forbidden: You do not own this session')
        }
      } else {
        // If session not found in user_sessions table:
        // Only startSession endpoint allows claiming a new unassigned session ID.
        // For any other endpoint, non-owner users are forbidden.
        const isStartEndpoint = (req.path || '').startsWith('/start/') || (req.originalUrl || '').includes('/session/start/')
        if (isStartEndpoint) {
          db.prepare('INSERT INTO user_sessions (user_id, session_id) VALUES (?, ?)').run(req.user.id, sessionId)
        } else {
          return sendErrorResponse(res, 403, 'Forbidden: You do not own this session')
        }
      }
    } catch (e) {
      return sendErrorResponse(res, 500, e.message)
    }
  }
  next()
}

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.is_admin !== 1) {
    return sendErrorResponse(res, 403, 'Forbidden: Admin access required')
  }
  next()
}

module.exports = {
  sessionValidation,
  sessionExistenceValidation,
  apikey,
  sessionNameValidation,
  sessionSwagger,
  clientSwagger,
  contactSwagger,
  messageSwagger,
  chatSwagger,
  groupChatSwagger,
  rateLimiter,
  sessionOwnership,
  requireAdmin
}
