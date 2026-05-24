const express = require('express')
const router = express.Router()
const MessageLimit = require('../models/MessageLimit')
const Connection = require('../models/Connection')
const { protect } = require('../middleware/auth')

// Helper: check if two users are connected
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

// ── POST /api/message-limit/set ───────────────────────────────
router.post('/set', protect, async (req, res) => {
  try {
    const { targetUserId, dailyLimit } = req.body
    const ownerUserId = req.user._id

    if (!targetUserId || !dailyLimit) {
      return res.status(400).json({ message: 'targetUserId and dailyLimit are required.' })
    }

    if (![10, 20, 30, 50].includes(Number(dailyLimit))) {
      return res.status(400).json({ message: 'dailyLimit must be 10, 20, 30, or 50.' })
    }

    const connected = await areConnected(ownerUserId, targetUserId)
    if (!connected) {
      return res.status(403).json({ message: 'You are not connected with this user.' })
    }

    // Upsert: create or update
    const limit = await MessageLimit.findOneAndUpdate(
      { ownerUserId, targetUserId },
      {
        dailyLimit: Number(dailyLimit),
        currentCount: 0,
        lastResetDate: new Date().toISOString().slice(0, 10),
      },
      { upsert: true, new: true }
    )

    res.json({ success: true, limit })
  } catch (error) {
    console.error('Set limit error:', error.message)
    res.status(500).json({ message: 'Failed to set message limit.' })
  }
})

// ── GET /api/message-limit/:targetUserId ──────────────────────
router.get('/:targetUserId', protect, async (req, res) => {
  try {
    const limit = await MessageLimit.findOne({
      ownerUserId: req.user._id,
      targetUserId: req.params.targetUserId,
    })

    if (!limit) {
      return res.json({ hasLimit: false })
    }

    // Check if needs reset
    const today = new Date().toISOString().slice(0, 10)
    if (limit.lastResetDate !== today) {
      limit.currentCount = 0
      limit.lastResetDate = today
      await limit.save()
    }

    res.json({
      hasLimit: true,
      dailyLimit: limit.dailyLimit,
      currentCount: limit.currentCount,
      remaining: limit.dailyLimit - limit.currentCount,
    })
  } catch (error) {
    console.error('Get limit error:', error.message)
    res.status(500).json({ message: 'Failed to get message limit.' })
  }
})

// ── DELETE /api/message-limit/remove/:targetUserId ────────────
router.delete('/remove/:targetUserId', protect, async (req, res) => {
  try {
    await MessageLimit.findOneAndDelete({
      ownerUserId: req.user._id,
      targetUserId: req.params.targetUserId,
    })
    res.json({ success: true, message: 'Message limit removed.' })
  } catch (error) {
    console.error('Remove limit error:', error.message)
    res.status(500).json({ message: 'Failed to remove message limit.' })
  }
})

module.exports = router