require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const multer = require('multer')
const helmet = require('helmet')
const mongoSanitize = require('express-mongo-sanitize')
const connectDB = require('./config/db')
const initSocket = require('./socket')
const socketManager = require('./socket/socketManager')

const app = express()
const server = http.createServer(app)

connectDB()

// ✅ Security headers
app.use(helmet())
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }))

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))

// ✅ NoSQL injection prevent
app.use(mongoSanitize())

app.use('/api/auth', require('./routes/auth'))
app.use('/api/invite', require('./routes/invite'))
app.use('/api/connections', require('./routes/connections'))
app.use('/api/chat', require('./routes/chat'))
app.use('/api/message-limit', require('./routes/messageLimit'))
app.use('/api/block', require('./routes/block'))
app.use('/api/groups', require('./routes/groups'))
app.use('/api/private-chat', require('./routes/privateChat'))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PrivaChat backend is running' })
})

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large.' })
    }
    return res.status(400).json({ message: err.message })
  }
  if (err) {
    console.error('Unhandled error:', err.message)
    return res.status(500).json({ message: 'Something went wrong.' })
  }
  next()
})

const io = initSocket(server)
socketManager.setIO(io)

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`\n🛡️  PrivaChat backend running on port ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`)
})