const BASE = ''

function getToken() {
  return localStorage.getItem('token')
}



function headers() {
  const h = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h['Authorization'] = `Bearer ${t}`
  return h
}

async function request(method, url, body) {
  const opts = { method, headers: headers() }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(BASE + url, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  login: (username, password) =>
    request('POST', '/api/auth/login', { username, password }),

  register: (username, password) =>
    request('POST', '/api/auth/register', { username, password }),

  startSession: (sessionId) => {
    const h = headers()
    return fetch(`/session/start/${sessionId}`, { method: 'GET', headers: h })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Request failed')
        return data
      })
  },

  sessionStatus: (sessionId) =>
    request('GET', `/session/status/${sessionId}`),

  sessionQR: (sessionId) =>
    request('GET', `/session/qr/${sessionId}`),

  restartSession: (sessionId) =>
    request('GET', `/session/restart/${sessionId}`),

  terminateSession: (sessionId) =>
    request('GET', `/session/terminate/${sessionId}`),

  getChats: (sessionId) =>
    request('GET', `/client/getChats/${sessionId}`),

  fetchMessages: (sessionId, chatId, limit) =>
    request('POST', `/chat/fetchMessages/${sessionId}`, { chatId, searchOptions: { limit } }),

  getChatById: (sessionId, chatId) =>
    request('POST', `/client/getChatById/${sessionId}`, { chatId }),

  getMessages: (sessionId, chatId, limit) =>
    request('GET', `/chat/getMessages/${sessionId}/${chatId}?limit=${limit || 50}`),

  resolveChatId: (sessionId, chatId) =>
    request('GET', `/chat/resolveChatId/${sessionId}/${chatId}`),

  getNumberId: (sessionId, number) =>
    request('POST', `/client/getNumberId/${sessionId}`, { number }),

  getMessageMedia: (sessionId, chatId, msgId) =>
    request('GET', `/chat/getMessageMedia/${sessionId}/${chatId}/${msgId}`),

  sendMessage: (sessionId, chatId, message) =>
    request('POST', `/client/sendMessage/${sessionId}`, { chatId, message }),

  sendTextMessage: (sessionId, chatId, text) =>
    request('POST', `/client/sendMessage/${sessionId}`, { chatId, content: text, contentType: 'string' }),

  sendMediaMessage: (sessionId, chatId, mimetype, data, filename) =>
    request('POST', `/client/sendMessage/${sessionId}`, { chatId, contentType: 'MessageMedia', content: { mimetype, data, filename } }),

  getContacts: (sessionId) =>
    request('POST', `/client/getContacts/${sessionId}`),

  listSessions: () =>
    request('GET', '/session/list'),

  sendSeen: (sessionId, chatId) =>
    request('POST', `/client/sendSeen/${sessionId}`, { chatId }),

  getProfilePicUrl: (sessionId, contactId) =>
    request('POST', `/client/getProfilePicUrl/${sessionId}`, { contactId }),

  reactToMessage: (sessionId, chatId, messageId, reaction) =>
    request('POST', `/message/react/${sessionId}`, { messageId, chatId, reaction }),

  starMessage: (sessionId, chatId, messageId) =>
    request('POST', `/message/star/${sessionId}`, { messageId, chatId }),

  unstarMessage: (sessionId, chatId, messageId) =>
    request('POST', `/message/unstar/${sessionId}`, { messageId, chatId }),

  deleteMessage: (sessionId, chatId, messageId, everyone) =>
    request('POST', `/message/delete/${sessionId}`, { messageId, chatId, everyone }),

  replyMessage: (sessionId, chatId, messageId, content) =>
    request('POST', `/message/reply/${sessionId}`, { messageId, chatId, content, destinationChatId: chatId }),

  searchMessages: (sessionId, query) =>
    request('POST', `/client/searchMessages/${sessionId}`, { query }),

  sendReactionDirect: (sessionId, chatId, messageId, reaction) =>
    request('POST', `/client/sendReactionDirect/${sessionId}`, { chatId, messageId, reaction }),

  getMessageReactions: (sessionId, chatId, messageId) =>
    request('POST', `/client/getMessageReactions/${sessionId}`, { chatId, messageId }),

  getAdminUsers: () => request('GET', '/api/admin/users'),
  createAdminUser: (username, password, is_admin) => request('POST', '/api/admin/users', { username, password, is_admin }),
  updateAdminUser: (id, username, password, is_admin) => request('PUT', `/api/admin/users/${id}`, { username, password, is_admin }),
  deleteAdminUser: (id) => request('DELETE', `/api/admin/users/${id}`),
  getAdminSettings: () => request('GET', '/api/admin/settings'),
  updateAdminSettings: (settings) => request('POST', '/api/admin/settings', settings),
  changePassword: (currentPassword, newPassword) => request('POST', '/api/auth/change-password', { currentPassword, newPassword }),
  requestPairingCode: (sessionId, phoneNumber) => request('POST', `/client/requestPairingCode/${sessionId}`, { phoneNumber }),
  cancelPairingCode: (sessionId) => request('POST', `/client/cancelPairingCode/${sessionId}`),
  disconnectSession: (sessionId) => request('GET', `/session/disconnect/${sessionId}`),

  // Profile APIs
  setProfileStatus: (sessionId, status) => request('POST', `/client/setStatus/${sessionId}`, { status }),
  setProfileDisplayName: (sessionId, displayName) => request('POST', `/client/setDisplayName/${sessionId}`, { displayName }),
  setProfilePicture: (sessionId, pictureMimetype, pictureData) => request('POST', `/client/setProfilePicture/${sessionId}`, { pictureMimetype, pictureData }),

  // Channels APIs
  getChannels: (sessionId) => request('GET', `/client/getChannels/${sessionId}`),

  // Catalog APIs
  getCatalogs: (sessionId) => request('GET', `/client/catalog/${sessionId}`),
  createCatalog: (sessionId, product) => request('POST', `/client/catalog/${sessionId}`, product),
  updateCatalog: (sessionId, id, product) => request('PUT', `/client/catalog/${sessionId}/${id}`, product),
  deleteCatalog: (sessionId, id) => request('DELETE', `/client/catalog/${sessionId}/${id}`),

  // Auto Reply Workflow APIs
  getAutoReplyRules: (sessionId) => request('GET', `/api/auto-reply/${sessionId}`),
  createAutoReplyRule: (sessionId, data) => request('POST', `/api/auto-reply/${sessionId}`, data),
  updateAutoReplyRule: (ruleId, data) => request('PUT', `/api/auto-reply/rule/${ruleId}`, data),
  deleteAutoReplyRule: (ruleId) => request('DELETE', `/api/auto-reply/rule/${ruleId}`),
  toggleAutoReplyRule: (ruleId) => request('PATCH', `/api/auto-reply/rule/${ruleId}/toggle`),
}
