const express = require('express')
const router = express.Router()
const Block = require('../models/Block')
const { protect } = require('../middleware/auth')

// ── POST /api/block ───────────────────────────────────────────
// Block a user
router.post('/', protect, async (req, res) => {
  try {
    const { blockedUserId } = req.body

    if (!blockedUserId) {
      return res.status(400).json({ message: 'blockedUserId is required.' })
    }

    if (blockedUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot block yourself.' })
    }

    // Check if already blocked
    const existing = await Block.findOne({
      blockedBy: req.user._id,
      blockedUser: blockedUserId,
    })

    if (existing) {
      return res.json({ success: true, message: 'Already blocked.' })
    }

    await Block.create({
      blockedBy: req.user._id,
      blockedUser: blockedUserId,
    })

    res.json({ success: true, message: 'User blocked.' })
  } catch (error) {
    console.error('Block error:', error.message)
    res.status(500).json({ message: 'Failed to block user.' })
  }
})

// ── DELETE /api/block/:userId ─────────────────────────────────
// Unblock a user
router.delete('/:userId', protect, async (req, res) => {
  try {
    await Block.findOneAndDelete({
      blockedBy: req.user._id,
      blockedUser: req.params.userId,
    })

    res.json({ success: true, message: 'User unblocked.' })
  } catch (error) {
    console.error('Unblock error:', error.message)
    res.status(500).json({ message: 'Failed to unblock user.' })
  }
})

// ── GET /api/block/status/:userId ─────────────────────────────
// Check block status
router.get('/status/:userId', protect, async (req, res) => {
  try {
    const iBlockedThem = await Block.findOne({
      blockedBy: req.user._id,
      blockedUser: req.params.userId,
    })

    const theyBlockedMe = await Block.findOne({
      blockedBy: req.params.userId,
      blockedUser: req.user._id,
    })

    res.json({
      iBlockedThem: !!iBlockedThem,
      theyBlockedMe: !!theyBlockedMe,
    })
  } catch (error) {
    console.error('Block status error:', error.message)
    res.status(500).json({ message: 'Failed to check block status.' })
  }
})

module.exports = router