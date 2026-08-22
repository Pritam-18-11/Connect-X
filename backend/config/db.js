const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false,
    })

    mongoose.connection.on('disconnected', () => {
      console.error('⚠️ MongoDB disconnected! Attempting reconnect...')
    })

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected!')
    })

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB error:', err.message)
    })

    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`)
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB