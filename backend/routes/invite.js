const express = require('express')
const router = express.Router()
const InviteCode = require('../models/InviteCode')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

// Helper: generate random 6-character code
function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

// ── POST /api/invite/generate ─────────────────────────────────
// Authenticated user generates a new invite code
router.post('/generate', protect, async (req, res) => {
  try {
    // Delete any existing code for this user
    await InviteCode.deleteMany({ userId: req.user._id })

    // Create new code with 100 second expiry
    const expiresAt = new Date(Date.now() + 100 * 1000)
    const code = generateRandomCode()

    const invite = await InviteCode.create({
      userId: req.user._id,
      code,
      expiresAt,
    })

    res.json({
      code: invite.code,
      expiresAt: invite.expiresAt,
      expiresInSeconds: 100,
    })
  } catch (error) {
    console.error('Generate invite error:', error.message)
    res.status(500).json({ message: 'Failed to generate invite code.' })
  }
})

// ── POST /api/invite/validate ─────────────────────────────────
// Anyone can validate a code (must be logged in)
router.post('/validate', protect, async (req, res) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ message: 'Please provide an invite code.' })
    }

    // Find the code
    const invite = await InviteCode.findOne({
      code: code.toUpperCase().trim(),
    }).populate('userId', 'name email')

    if (!invite) {
      return res.status(404).json({ message: 'Invalid invite code.' })
    }

    // Check if expired
    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ message: 'Invite code has expired.' })
    }

    // Check if already used
    if (invite.isUsed) {
      return res.status(400).json({ message: 'Invite code has already been used.' })
    }

    // Cannot use your own code
    if (invite.userId._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot use your own invite code.' })
    }

    res.json({
      success: true,
      userName: invite.userId.name,
      userId: invite.userId._id,
      code: invite.code,
    })
  } catch (error) {
    console.error('Validate invite error:', error.message)
    res.status(500).json({ message: 'Failed to validate invite code.' })
  }
})

// ── POST /api/invite/use ──────────────────────────────────────
// Mark invite code as used (called when sending connection request)
router.post('/use', protect, async (req, res) => {
  try {
    const { code } = req.body

    const invite = await InviteCode.findOne({
      code: code.toUpperCase().trim(),
      isUsed: false,
    })

    if (!invite) {
      return res.status(404).json({ message: 'Invalid or already used code.' })
    }

    if (new Date() > invite.expiresAt) {
      return res.status(400).json({ message: 'Invite code has expired.' })
    }

    invite.isUsed = true
    await invite.save()

    res.json({ success: true, message: 'Invite code used successfully.' })
  } catch (error) {
    console.error('Use invite error:', error.message)
    res.status(500).json({ message: 'Failed to use invite code.' })
  }
})

module.exports = router