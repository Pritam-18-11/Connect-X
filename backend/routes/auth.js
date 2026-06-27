const express = require('express')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Connection = require('../models/Connection')
const ConnectionRequest = require('../models/ConnectionRequest')
const Message = require('../models/Message')
const MessageLimit = require('../models/MessageLimit')
const Block = require('../models/Block')
const Group = require('../models/Group')
const GroupMessage = require('../models/GroupMessage')
const GroupInvitation = require('../models/GroupInvitation')
const GroupJoinRequest = require('../models/GroupJoinRequest')
const AdminActionRequest = require('../models/AdminActionRequest')
const PrivateChatRequest = require('../models/PrivateChatRequest')
const InviteCode = require('../models/InviteCode')
const { protect } = require('../middleware/auth')

const router = express.Router()

// Helper: generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  })
}

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields.' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' })
    }

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' })
    }

    const user = await User.create({ name, email, password })

    res.status(201).json({
      message: 'Account created successfully. Please log in.',
    })
  } catch (error) {
    console.error('Register error:', error.message)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
})

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Login error:', error.message)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
})

// ─── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  res.json({
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    createdAt: req.user.createdAt,
  })
})

// ─── PUT /api/auth/me — Update profile ─────────────────────────
router.put('/me', protect, async (req, res) => {
  try {
    const { name, email, password } = req.body
    const user = await User.findById(req.user._id)

    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (name !== undefined) {
      if (!name.trim() || name.trim().length < 2) {
        return res.status(400).json({ message: 'Name must be at least 2 characters.' })
      }
      user.name = name.trim()
    }

    if (email !== undefined && email.trim().toLowerCase() !== user.email) {
      const newEmail = email.trim().toLowerCase()
      const existing = await User.findOne({ email: newEmail })
      if (existing) {
        return res.status(400).json({ message: 'This email is already in use.' })
      }
      user.email = newEmail
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' })
      }
      user.password = password // pre-save hook will hash it
    }

    await user.save()

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error.message)
    res.status(500).json({ message: 'Failed to update profile.' })
  }
})

// ─── DELETE /api/auth/me — Delete account + cascade cleanup ───
router.delete('/me', protect, async (req, res) => {
  try {
    const userId = req.user._id

    // Remove user from all groups (members/admins), but keep group/messages intact
    await Group.updateMany(
      { $or: [{ members: userId }, { admins: userId }] },
      { $pull: { members: userId, admins: userId } }
    )

    // Delete groups created solely by this user along with their messages
    const ownedGroups = await Group.find({ createdBy: userId })
    const ownedGroupIds = ownedGroups.map((g) => g._id)
    if (ownedGroupIds.length > 0) {
      await GroupMessage.deleteMany({ groupId: { $in: ownedGroupIds } })
      await GroupInvitation.deleteMany({ groupId: { $in: ownedGroupIds } })
      await GroupJoinRequest.deleteMany({ groupId: { $in: ownedGroupIds } })
      await AdminActionRequest.deleteMany({ groupId: { $in: ownedGroupIds } })
      await Group.deleteMany({ _id: { $in: ownedGroupIds } })
    }

    // Clean up everything tied to this user
    await Promise.all([
      Connection.deleteMany({ $or: [{ user1: userId }, { user2: userId }] }),
      ConnectionRequest.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
      Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] }),
      MessageLimit.deleteMany({ $or: [{ ownerUserId: userId }, { targetUserId: userId }] }),
      Block.deleteMany({ $or: [{ blockedBy: userId }, { blockedUser: userId }] }),
      GroupMessage.deleteMany({ senderId: userId }),
      GroupInvitation.deleteMany({ $or: [{ invitedBy: userId }, { invitedUser: userId }] }),
      GroupJoinRequest.deleteMany({ requestedBy: userId }),
      AdminActionRequest.deleteMany({ $or: [{ requestedBy: userId }, { targetUser: userId }] }),
      PrivateChatRequest.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }),
      InviteCode.deleteMany({ userId }),
    ])

    await User.findByIdAndDelete(userId)

    res.json({ success: true, message: 'Account deleted successfully.' })
  } catch (error) {
    console.error('Delete account error:', error.message)
    res.status(500).json({ message: 'Failed to delete account.' })
  }
})

module.exports = router