require('./routes')
const { restoreSessions, startPeriodicCleaner } = require('./sessions')
const { routes } = require('./routes')
const { maxAttachmentSize, cleanerIntervalMs } = require('./config')
const app = require('express')()
const bodyParser = require('body-parser')

app.disable('x-powered-by')
app.use(bodyParser.json({ limit: maxAttachmentSize + 1000000 }))
app.use(bodyParser.urlencoded({ limit: maxAttachmentSize + 1000000, extended: true }))
app.use('/', routes)

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' })
  }
  next(err)
})

restoreSessions()
startPeriodicCleaner(cleanerIntervalMs)

module.exports = app
