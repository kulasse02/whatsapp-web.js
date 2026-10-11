const app = require('./src/app')
const path = require('path')
const cors = require('cors')
const express = require('express')
const { baseWebhookURL } = require('./src/config')
const { router: authRouter } = require('./src/auth')
require('dotenv').config()

require('./src/database')

app.use(cors())

app.use('/api/auth', authRouter)

const frontendPath = path.join(__dirname, 'frontend', 'dist')
const mediaPath = path.join(__dirname, 'data', 'media')
app.use('/media', express.static(mediaPath))
app.use(express.static(frontendPath))
app.get('*', (req, res, next) => {
  // If the path starts with /session/ but isn't followed by backend actions like start/status/qr/restart/disconnect/terminate, it's a frontend route.
  const isBackendSessionRoute = req.path.startsWith('/session/start/') ||
                                req.path.startsWith('/session/status/') ||
                                req.path.startsWith('/session/qr/') ||
                                req.path.startsWith('/session/restart/') ||
                                req.path.startsWith('/session/disconnect/') ||
                                req.path.startsWith('/session/terminate/') ||
                                req.path === '/session/list' ||
                                req.path === '/session/terminateInactive' ||
                                req.path === '/session/terminateAll';

  const isApiRoute = req.path.startsWith('/api/') || 
                     (req.path.startsWith('/session/') && isBackendSessionRoute) || 
                     req.path.startsWith('/client/') || 
                     req.path.startsWith('/chat/') || 
                     req.path.startsWith('/groupChat/') || 
                     req.path.startsWith('/message/') || 
                     req.path.startsWith('/contact/') || 
                     req.path === '/ping';

  if (isApiRoute) {
    return next()
  }
  res.sendFile(path.join(frontendPath, 'index.html'))
})

const port = process.env.PORT || 3000

if (!baseWebhookURL) {
  console.error('BASE_WEBHOOK_URL environment variable is not available. Exiting...')
  process.exit(1)
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
