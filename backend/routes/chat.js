const express = require('express')
const router = express.Router()
const Message = require('../models/Message')
const Connection = require('../models/Connection')
const MessageLimit = require('../models/MessageLimit')
const { protect } = require('../middleware/auth')

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

// Helper: check and update message limit
// ownerUserId = receiver (the one who set the limit)
// targetUserId = sender (the one being limited)
async function checkMessageLimit(senderUserId, receiverUserId) {
  const today = new Date().toISOString().slice(0, 10)

  const limit = await MessageLimit.findOne({
    ownerUserId: receiverUserId,
    targetUserId: senderUserId,
  })

  if (!limit) return { allowed: true }

  // Auto reset if new day
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

  // Increment count
  limit.currentCount += 1
  await limit.save()

  return { allowed: true, remaining: limit.dailyLimit - limit.currentCount }
}

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

    // Check message limit
    const limitCheck = await checkMessageLimit(req.user._id, receiverId)
    if (!limitCheck.allowed) {
      return res.status(429).json({ message: limitCheck.message })
    }

    const message = await Message.create({
      senderId: req.user._id,
      receiverId,
      text: text.trim(),
    })

    res.status(201).json(message)
  } catch (error) {
    console.error('Send message error:', error.message)
    res.status(500).json({ message: 'Failed to send message.' })
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

module.exports = router