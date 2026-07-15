const express = require('express')
const router = express.Router()
const ConnectionRequest = require('../models/ConnectionRequest')
const Connection = require('../models/Connection')
const InviteCode = require('../models/InviteCode')
const User = require('../models/User')
const Message = require('../models/Message')
const { protect } = require('../middleware/auth')
const { getIO } = require('../socket/socketManager')

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

    const validConnections = connections.filter((conn) => conn.user1 && conn.user2)

    const connectedUsers = await Promise.all(
      validConnections.map(async (conn) => {
        const other =
          conn.user1._id.toString() === req.user._id.toString()
            ? conn.user2
            : conn.user1

        const lastMsg = await Message.findOne({
          $or: [
            { senderId: req.user._id, receiverId: other._id },
            { senderId: other._id, receiverId: req.user._id },
          ],
          deletedFor: { $ne: req.user._id },
        })
          .sort({ createdAt: -1 })
          .select('text messageType senderId createdAt')

        const unreadCount = await Message.countDocuments({
          senderId: other._id,
          receiverId: req.user._id,
          seen: false,
          deletedFor: { $ne: req.user._id },
        })

        return {
          connectionId: conn._id,
          userId: other._id,
          name: other.name,
          email: other.email,
          avatarUrl: other.avatarUrl,
          connectedAt: conn.createdAt,
          lastMessage: lastMsg
            ? {
                text: lastMsg.text,
                messageType: lastMsg.messageType,
                fromMe: lastMsg.senderId.toString() === req.user._id.toString(),
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount,
        }
      })
    )

    connectedUsers.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.connectedAt)
      const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.connectedAt)
      return bTime - aTime
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
      return res.json({
        status: 'connected',
        connectionId: activeConnection._id,
        aiAssistantStatus: activeConnection.aiAssistantStatus,
        aiAssistantRequestedBy: activeConnection.aiAssistantRequestedBy,
      })
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

// ── Helper: find active connection between two users ──────────
async function findActiveConnection(userId1, userId2) {
  return Connection.findOne({
    $or: [
      { user1: userId1, user2: userId2 },
      { user1: userId2, user2: userId1 },
    ],
    isActive: true,
    isRevoked: false,
  })
}

// ── POST /api/connections/ai-assistant/request/:otherUserId ───
router.post('/ai-assistant/request/:otherUserId', protect, async (req, res) => {
  try {
    const myId = req.user._id.toString()
    const otherId = req.params.otherUserId

    const connection = await findActiveConnection(myId, otherId)
    if (!connection) {
      return res.status(404).json({ message: 'Connection not found.' })
    }

    if (connection.aiAssistantStatus === 'enabled') {
      return res.status(400).json({ message: 'AI Assistant is already enabled for this chat.' })
    }
    if (connection.aiAssistantStatus === 'pending') {
      return res.status(400).json({ message: 'A request is already pending.' })
    }

    connection.aiAssistantStatus = 'pending'
    connection.aiAssistantRequestedBy = req.user._id
    await connection.save()

    const io = getIO()
    if (io) {
      io.to(otherId).emit('ai_assistant_request', {
        by: { _id: req.user._id, name: req.user.name },
      })
    }

    res.json({ success: true, aiAssistantStatus: connection.aiAssistantStatus })
  } catch (err) {
    console.error('AI assistant request error:', err.message)
    res.status(500).json({ message: 'Failed to send request.' })
  }
})

// ── POST /api/connections/ai-assistant/respond/:otherUserId ───
router.post('/ai-assistant/respond/:otherUserId', protect, async (req, res) => {
  try {
    const { accept } = req.body
    const myId = req.user._id.toString()
    const otherId = req.params.otherUserId

    const connection = await findActiveConnection(myId, otherId)
    if (!connection) {
      return res.status(404).json({ message: 'Connection not found.' })
    }

    if (connection.aiAssistantStatus !== 'pending') {
      return res.status(400).json({ message: 'No pending request.' })
    }

    if (connection.aiAssistantRequestedBy?.toString() === myId) {
      return res.status(403).json({ message: 'You cannot respond to your own request.' })
    }

    connection.aiAssistantStatus = accept ? 'enabled' : 'none'
    if (!accept) connection.aiAssistantRequestedBy = null
    await connection.save()

    const io = getIO()
    if (io) {
      io.to(otherId).emit('ai_assistant_response', {
        accepted: !!accept,
        by: { _id: req.user._id, name: req.user.name },
      })
    }

    res.json({ success: true, aiAssistantStatus: connection.aiAssistantStatus })
  } catch (err) {
    console.error('AI assistant respond error:', err.message)
    res.status(500).json({ message: 'Failed to respond to request.' })
  }
})

// ── POST /api/connections/ai-assistant/disable/:otherUserId ───
router.post('/ai-assistant/disable/:otherUserId', protect, async (req, res) => {
  try {
    const myId = req.user._id.toString()
    const otherId = req.params.otherUserId

    const connection = await findActiveConnection(myId, otherId)
    if (!connection) {
      return res.status(404).json({ message: 'Connection not found.' })
    }

    connection.aiAssistantStatus = 'none'
    connection.aiAssistantRequestedBy = null
    await connection.save()

    const io = getIO()
    if (io) {
      io.to(otherId).emit('ai_assistant_disabled', {
        by: { _id: req.user._id, name: req.user.name },
      })
    }

    res.json({ success: true, aiAssistantStatus: 'none' })
  } catch (err) {
    console.error('AI assistant disable error:', err.message)
    res.status(500).json({ message: 'Failed to disable AI assistant.' })
  }
})

module.exports = router