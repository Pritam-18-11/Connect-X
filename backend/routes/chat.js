const express = require('express')
const router = express.Router()
const multer = require('multer')
const Message = require('../models/Message')
const Connection = require('../models/Connection')
const MessageLimit = require('../models/MessageLimit')
const { protect } = require('../middleware/auth')
const { getIO } = require('../socket/socketManager')
const cloudinary = require('../utils/cloudinary')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB max

async function areConnected(userId1, userId2) {
  const conn = await Connection.findOne({
    $or: [
      { user1: userId1, user2: userId2 },
      { user1: userId2, user2: userId1 },
    ],
    isActive: true,
    isRevoked: false,
  })
  return !!conn
}

async function checkMessageLimit(senderUserId, receiverUserId) {
  const today = new Date().toISOString().slice(0, 10)

  const limit = await MessageLimit.findOne({
    ownerUserId: receiverUserId,
    targetUserId: senderUserId,
  })

  if (!limit) return { allowed: true }

  if (limit.lastResetDate !== today) {
    limit.currentCount = 0
    limit.lastResetDate = today
    await limit.save()
  }

  if (limit.currentCount >= limit.dailyLimit) {
    return {
      allowed: false,
      message: `Daily message limit of ${limit.dailyLimit} reached. Try again tomorrow.`,
    }
  }

  limit.currentCount += 1
  await limit.save()

  return { allowed: true, remaining: limit.dailyLimit - limit.currentCount }
}

// ── GET /api/chat/stats/today ─────────────────────────────────
router.get('/stats/today', protect, async (req, res) => {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const count = await Message.countDocuments({
      senderId: req.user._id,
      createdAt: { $gte: startOfDay },
    })

    res.json({ count })
  } catch (error) {
    console.error('Get today stats error:', error.message)
    res.status(500).json({ message: 'Failed to fetch stats.' })
  }
})

// ── GET /api/chat/:userId ─────────────────────────────────────
router.get('/:userId', protect, async (req, res) => {
  try {
    const connected = await areConnected(req.user._id, req.params.userId)
    if (!connected) {
      return res.status(403).json({ message: 'You are not connected with this user.' })
    }

    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user._id },
      ],
      deletedFor: { $ne: req.user._id },
    }).sort({ createdAt: 1 })

    res.json(messages)
  } catch (error) {
    console.error('Get chat error:', error.message)
    res.status(500).json({ message: 'Failed to fetch messages.' })
  }
})

// ── POST /api/chat/send ───────────────────────────────────────
router.post('/send', protect, async (req, res) => {
  try {
    const { receiverId, text } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' })
    }

    const connected = await areConnected(req.user._id, receiverId)
    if (!connected) {
      return res.status(403).json({ message: 'You are not connected with this user.' })
    }

    const limitCheck = await checkMessageLimit(req.user._id, receiverId)
    if (!limitCheck.allowed) {
      return res.status(429).json({ message: limitCheck.message })
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      text: text.trim(),
      messageType: 'text',
    })

    res.status(201).json(message)
  } catch (error) {
    console.error('Send message error:', error.message)
    res.status(500).json({ message: 'Failed to send message.' })
  }
})

// ── POST /api/chat/send-voice ──────────────────────────────────
// multipart/form-data: audio (file), receiverId, duration
router.post('/send-voice', protect, upload.single('audio'), async (req, res) => {
  try {
    const { receiverId, duration } = req.body

    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided.' })
    }
    if (!receiverId) {
      return res.status(400).json({ message: 'receiverId is required.' })
    }

    const connected = await areConnected(req.user._id, receiverId)
    if (!connected) {
      return res.status(403).json({ message: 'You are not connected with this user.' })
    }

    const limitCheck = await checkMessageLimit(req.user._id, receiverId)
    if (!limitCheck.allowed) {
      return res.status(429).json({ message: limitCheck.message })
    }

    // Upload to Cloudinary (audio as 'video' resource_type — Cloudinary requires this for audio files)
    const base64Audio = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const uploadResult = await cloudinary.uploader.upload(base64Audio, {
      resource_type: 'video', // Cloudinary treats audio under 'video' resource type
      folder: 'connectx/voice-messages',
      format: 'mp3',
    })

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      text: '',
      messageType: 'voice',
      audioUrl: uploadResult.secure_url,
      audioDuration: duration ? Number(duration) : null,
    })

    const msgData = {
      _id: message._id,
      senderId: req.user._id,
      receiverId,
      text: '',
      messageType: 'voice',
      audioUrl: message.audioUrl,
      audioDuration: message.audioDuration,
      seen: false,
      isEdited: false,
      createdAt: message.createdAt,
    }

    // Notify receiver in real-time, same as socket text messages
    const io = getIO()
    if (io) {
      io.to(receiverId).emit('receive_message', msgData)
    }

    res.status(201).json(message)
  } catch (error) {
    console.error('Send voice message error:', error.message)
    res.status(500).json({ message: 'Failed to send voice message.' })
  }
})

// ── PUT /api/chat/seen/:messageId ─────────────────────────────
router.put('/seen/:messageId', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ message: 'Message not found.' })

    message.seen = true
    await message.save()

    res.json({ success: true })
  } catch (error) {
    console.error('Mark seen error:', error.message)
    res.status(500).json({ message: 'Failed to mark as seen.' })
  }
})

// ── PUT /api/chat/edit/:messageId ─────────────────────────────
router.put('/edit/:messageId', protect, async (req, res) => {
  try {
    const { text } = req.body
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message cannot be empty.' })
    }

    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ message: 'Message not found.' })

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages.' })
    }

    if (message.messageType === 'voice') {
      return res.status(400).json({ message: 'Voice messages cannot be edited.' })
    }

    if (message.isDeletedForEveryone) {
      return res.status(400).json({ message: 'Cannot edit a deleted message.' })
    }

    message.text = text.trim()
    message.isEdited = true
    await message.save()

    const otherUserId =
      message.senderId.toString() === req.user._id.toString()
        ? message.receiverId.toString()
        : message.senderId.toString()

    const io = getIO()
    if (io) {
      io.to(otherUserId).emit('message_edited', {
        messageId: message._id,
        text: message.text,
      })
    }

    res.json({ success: true, message })
  } catch (error) {
    console.error('Edit message error:', error.message)
    res.status(500).json({ message: 'Failed to edit message.' })
  }
})

// ── DELETE /api/chat/:messageId?for=me|everyone ───────────────
router.delete('/:messageId', protect, async (req, res) => {
  try {
    const { for: deleteFor } = req.query
    const message = await Message.findById(req.params.messageId)
    if (!message) return res.status(404).json({ message: 'Message not found.' })

    const userId = req.user._id.toString()
    const isSender = message.senderId.toString() === userId

    const otherUserId = isSender
      ? message.receiverId.toString()
      : message.senderId.toString()

    if (deleteFor === 'everyone') {
      if (!isSender) {
        return res.status(403).json({ message: 'You can only delete your own messages for everyone.' })
      }
      await Message.findByIdAndDelete(message._id)

      const io = getIO()
      if (io) {
        io.to(otherUserId).emit('message_deleted', { messageId: message._id })
      }

      return res.json({ success: true })
    }

    if (!message.deletedFor.some((id) => id.toString() === userId)) {
      message.deletedFor.push(req.user._id)
      await message.save()
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error.message)
    res.status(500).json({ message: 'Failed to delete message.' })
  }
})

module.exports = router