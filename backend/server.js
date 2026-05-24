require('dotenv').config()
const express = require('express')
const cors = require('cors')
const http = require('http')
const connectDB = require('./config/db')
const initSocket = require('./socket')
const socketManager = require('./socket/socketManager')

const app = express()
const server = http.createServer(app)

connectDB()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json())

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

// Initialize Socket.IO and store io instance for use in routes
const io = initSocket(server)
socketManager.setIO(io)

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`\n🛡️  PrivaChat backend running on port ${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`)
})