const express = require('express')
const router = express.Router()
const ConnectionRequest = require('../models/ConnectionRequest')
const Connection = require('../models/Connection')
const InviteCode = require('../models/InviteCode')
const User = require('../models/User')
const { protect } = require('../middleware/auth')

// ── POST /api/connections/request ─────────────────────────────
router.post('/request', protect, async (req, res) => {
  try {
    const { receiverId, inviteCode } = req.body
    const senderId = req.user._id

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: 'You cannot connect with yourself.' })
    }

    const alreadyConnected = await Connection.findOne({
      $or: [
        { user1: senderId, user2: receiverId },
        { user1: receiverId, user2: senderId },
      ],
      isActive: true,
      isRevoked: false,
    })
    if (alreadyConnected) {
      return res.status(400).json({ message: 'You are already connected with this user.' })
    }

    const existing = await ConnectionRequest.findOne({
      senderId,
      receiverId,
      status: 'pending',
    })
    if (existing) {
      return res.status(400).json({ message: 'Connection request already sent.' })
    }

    const invite = await InviteCode.findOne({
      code: inviteCode.toUpperCase().trim(),
      isUsed: false,
    })
    if (!invite || new Date() > invite.expiresAt) {
      return res.status(400).json({ message: 'Invite code is invalid or expired.' })
    }

    invite.isUsed = true
    await invite.save()

    const receiver = await User.findById(receiverId)
    if (receiver?.autoRejectInvites) {
      const request = await ConnectionRequest.create({
        senderId,
        receiverId,
        inviteCodeId: invite._id,
        status: 'rejected',
      })
      return res.status(201).json({
        success: true,
        message: 'Connection request sent.',
        request,
        autoRejected: true,
      })
    }

    const request = await ConnectionRequest.create({
      senderId,
      receiverId,
      inviteCodeId: invite._id,
    })

    res.status(201).json({ success: true, message: 'Connection request sent.', request })
  } catch (error) {
    console.error('Request error:', error.message)
    res.status(500).json({ message: 'Failed to send request.' })
  }
})

// ── GET /api/connections/requests ─────────────────────────────
router.get('/requests', protect, async (req, res) => {
  try {
    const requests = await ConnectionRequest.find({
      receiverId: req.user._id,
      status: 'pending',
    }).populate('senderId', 'name email avatarUrl')

    const validRequests = requests.filter((r) => r.senderId)

    res.json(validRequests)
  } catch (error) {
    console.error('Get requests error:', error.message)
    res.status(500).json({ message: 'Failed to fetch requests.' })
  }
})

// ── POST /api/connections/approve/:id ─────────────────────────
router.post('/approve/:id', protect, async (req, res) => {
  try {
    const request = await ConnectionRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })

    if (request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    request.status = 'approved'
    await request.save()

    await Connection.create({
      user1: request.senderId,
      user2: request.receiverId,
    })

    res.json({ success: true, message: 'Connection approved.' })
  } catch (error) {
    console.error('Approve error:', error.message)
    res.status(500).json({ message: 'Failed to approve request.' })
  }
})

// ── POST /api/connections/reject/:id ──────────────────────────
router.post('/reject/:id', protect, async (req, res) => {
  try {
    const request = await ConnectionRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })

    if (request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    request.status = 'rejected'
    await request.save()

    res.json({ success: true, message: 'Connection rejected.' })
  } catch (error) {
    console.error('Reject error:', error.message)
    res.status(500).json({ message: 'Failed to reject request.' })
  }
})

// ── GET /api/connections/list ──────────────────────────────────
router.get('/list', protect, async (req, res) => {
  try {
    const connections = await Connection.find({
      $or: [{ user1: req.user._id }, { user2: req.user._id }],
      isActive: true,
      isRevoked: false,
    })
      .populate('user1', 'name email avatarUrl')
      .populate('user2', 'name email avatarUrl')

    const connectedUsers = connections
      .filter((conn) => conn.user1 && conn.user2)
      .map((conn) => {
        const other =
          conn.user1._id.toString() === req.user._id.toString()
            ? conn.user2
            : conn.user1
        return {
          connectionId: conn._id,
          userId: other._id,
          name: other.name,
          email: other.email,
          avatarUrl: other.avatarUrl,
          connectedAt: conn.createdAt,
        }
      })

    res.json(connectedUsers)
  } catch (error) {
    console.error('List connections error:', error.message)
    res.status(500).json({ message: 'Failed to fetch connections.' })
  }
})

// ── DELETE /api/connections/revoke/:connectionId ───────────────
router.delete('/revoke/:connectionId', protect, async (req, res) => {
  try {
    const connection = await Connection.findById(req.params.connectionId)

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found.' })
    }

    const userId = req.user._id.toString()
    const isParticipant =
      connection.user1.toString() === userId ||
      connection.user2.toString() === userId

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to revoke this connection.' })
    }

    const otherUserId =
      connection.user1.toString() === userId
        ? connection.user2.toString()
        : connection.user1.toString()

    connection.isActive = false
    connection.isRevoked = true
    connection.revokedBy = req.user._id
    connection.revokedAt = new Date()
    await connection.save()

    res.json({
      success: true,
      message: 'Connection revoked successfully.',
      otherUserId,
    })
  } catch (error) {
    console.error('Revoke error:', error.message)
    res.status(500).json({ message: 'Failed to revoke connection.' })
  }
})

// ── GET /api/connections/status/:userId ───────────────────────
router.get('/status/:userId', protect, async (req, res) => {
  try {
    const activeConnection = await Connection.findOne({
      $or: [
        { user1: req.user._id, user2: req.params.userId },
        { user1: req.params.userId, user2: req.user._id },
      ],
      isActive: true,
      isRevoked: false,
    })

    if (activeConnection) {
      return res.json({ status: 'connected', connectionId: activeConnection._id })
    }

    const revokedConnection = await Connection.findOne({
      $or: [
        { user1: req.user._id, user2: req.params.userId },
        { user1: req.params.userId, user2: req.user._id },
      ],
      isRevoked: true,
    })

    if (revokedConnection) {
      return res.json({ status: 'revoked' })
    }

    res.json({ status: 'not-connected' })
  } catch (error) {
    console.error('Status check error:', error.message)
    res.status(500).json({ message: 'Failed to check status.' })
  }
})

module.exports = router