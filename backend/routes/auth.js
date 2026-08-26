const express = require('express')
const jwt = require('jsonwebtoken')
const multer = require('multer')
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
const { authLimiter } = require('../middleware/rateLimiter')
const cloudinary = require('../utils/cloudinary')

const router = express.Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

// ─── POST /api/auth/register ──────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, username } = req.body

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

    // ✅ Username validation — case insensitive unique check
    if (username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: 'Username must be 3-20 characters.' })
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
          message: 'Username can only contain letters, numbers, and underscore.',
        })
      }
      const existingUsername = await User.findOne({
        username: { $regex: new RegExp(`^${username}$`, 'i') },
      })
      if (existingUsername) {
        return res.status(400).json({
          message: `Username "${username}" is already taken. Please choose another.`,
        })
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      ...(username ? { username: username.toLowerCase() } : {}),
    })

    res.status(201).json({
      message: 'Account created successfully. Please log in.',
    })
  } catch (error) {
    console.error('Register error:', error.message)
    res.status(500).json({ message: 'Server error. Please try again.' })
  }
})

// ─── POST /api/auth/login ─────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
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
        username: user.username || null,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl,
        autoRejectInvites: user.autoRejectInvites,
        notificationsEnabled: user.notificationsEnabled,
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
    username: req.user.username || null,
    createdAt: req.user.createdAt,
    avatarUrl: req.user.avatarUrl,
    autoRejectInvites: req.user.autoRejectInvites,
    notificationsEnabled: req.user.notificationsEnabled,
  })
})

// ─── PUT /api/auth/me ─────────────────────────────────────────
router.put('/me', protect, async (req, res) => {
  try {
    const { name, email, password, username, autoRejectInvites, notificationsEnabled } = req.body
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

    // ✅ Username update with case-insensitive uniqueness check
    if (username !== undefined) {
      const newUsername = username.trim().toLowerCase()
      if (newUsername !== (user.username || '')) {
        if (newUsername.length < 3 || newUsername.length > 20) {
          return res.status(400).json({ message: 'Username must be 3-20 characters.' })
        }
        if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
          return res.status(400).json({
            message: 'Username can only contain letters, numbers, and underscore.',
          })
        }
        const existingUsername = await User.findOne({
          username: { $regex: new RegExp(`^${newUsername}$`, 'i') },
          _id: { $ne: req.user._id },
        })
        if (existingUsername) {
          return res.status(400).json({
            message: `Username "${newUsername}" is already taken. Please choose another.`,
          })
        }
        user.username = newUsername
      }
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters.' })
      }
      user.password = password
    }

    if (typeof autoRejectInvites === 'boolean') {
      user.autoRejectInvites = autoRejectInvites
    }

    if (typeof notificationsEnabled === 'boolean') {
      user.notificationsEnabled = notificationsEnabled
    }

    await user.save()

    res.json({
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl,
        autoRejectInvites: user.autoRejectInvites,
        notificationsEnabled: user.notificationsEnabled,
      },
    })
  } catch (error) {
    console.error('Update profile error:', error.message)
    res.status(500).json({ message: 'Failed to update profile.' })
  }
})

// ─── PUT /api/auth/me/avatar ──────────────────────────────────
router.put('/me/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' })
    }

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      resource_type: 'image',
      folder: 'connectx/avatars',
      transformation: [{ width: 400, height: 400, crop: 'limit' }],
    })

    const user = await User.findById(req.user._id)
    user.avatarUrl = uploadResult.secure_url
    await user.save()

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        createdAt: user.createdAt,
        avatarUrl: user.avatarUrl,
        autoRejectInvites: user.autoRejectInvites,
        notificationsEnabled: user.notificationsEnabled,
      },
    })
  } catch (error) {
    console.error('Avatar upload error:', error.message)
    res.status(500).json({ message: 'Failed to upload profile photo.' })
  }
})

// ─── DELETE /api/auth/me/avatar ───────────────────────────────
router.delete('/me/avatar', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    user.avatarUrl = null
    await user.save()
    res.json({ success: true })
  } catch (error) {
    console.error('Remove avatar error:', error.message)
    res.status(500).json({ message: 'Failed to remove profile photo.' })
  }
})

// ─── DELETE /api/auth/me ──────────────────────────────────────
router.delete('/me', protect, async (req, res) => {
  try {
    const userId = req.user._id

    await Group.updateMany(
      { $or: [{ members: userId }, { admins: userId }] },
      { $pull: { members: userId, admins: userId } }
    )

    const ownedGroups = await Group.find({ createdBy: userId })
    const ownedGroupIds = ownedGroups.map((g) => g._id)
    if (ownedGroupIds.length > 0) {
      await GroupMessage.deleteMany({ groupId: { $in: ownedGroupIds } })
      await GroupInvitation.deleteMany({ groupId: { $in: ownedGroupIds } })
      await GroupJoinRequest.deleteMany({ groupId: { $in: ownedGroupIds } })
      await AdminActionRequest.deleteMany({ groupId: { $in: ownedGroupIds } })
      await Group.deleteMany({ _id: { $in: ownedGroupIds } })
    }

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