const express = require('express')
const router = express.Router()
const PrivateChatRequest = require('../models/PrivateChatRequest')
const Connection = require('../models/Connection')
const Group = require('../models/Group')
const { protect } = require('../middleware/auth')
const { getIO } = require('../socket/socketManager')

// ── Helpers ───────────────────────────────────────────────────
async function shareGroup(userId1, userId2) {
  const group = await Group.findOne({ members: { $all: [userId1, userId2] } })
  return !!group
}

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

// ── POST /api/private-chat/request ────────────────────────────
router.post('/request', protect, async (req, res) => {
  try {
    const { receiverId, groupId } = req.body
    const senderId = req.user._id

    if (senderId.toString() === receiverId) {
      return res.status(400).json({ message: 'You cannot request yourself.' })
    }

    // Must share a group
    const shared = await shareGroup(senderId, receiverId)
    if (!shared) {
      return res.status(403).json({ message: 'You must be in the same group to send a private chat request.' })
    }

    // Already connected?
    const connected = await areConnected(senderId, receiverId)
    if (connected) {
      return res.status(400).json({ message: 'You are already connected with this user.' })
    }

    // Check existing pending request
    const existingPending = await PrivateChatRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
    if (existingPending) {
      return res.status(400).json({ message: 'Request already pending.' })
    }

    // 24h cooldown check
    const cooldown = await PrivateChatRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'rejected',
      rejectedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
    if (cooldown) {
      const cooldownEnd = new Date(cooldown.rejectedAt.getTime() + 24 * 60 * 60 * 1000)
      return res.status(429).json({
        message: 'You can request again after the cooldown period.',
        cooldownEnd,
      })
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const request = await PrivateChatRequest.create({
      sender: senderId,
      receiver: receiverId,
      groupId,
      expiresAt,
    })

    const populated = await PrivateChatRequest.findById(request._id)
      .populate('sender', 'name')
      .populate('groupId', 'name')

    // Notify receiver via socket
    const io = getIO()
    if (io) {
      io.to(receiverId.toString()).emit('private_chat_request', {
        requestId: request._id,
        sender: { _id: senderId, name: req.user.name },
        groupName: populated.groupId?.name,
      })
    }

    res.status(201).json({ success: true, requestId: request._id })
  } catch (err) {
    console.error('Send private chat request error:', err.message)
    res.status(500).json({ message: 'Failed to send request.' })
  }
})

// ── GET /api/private-chat/requests — Received pending requests
router.get('/requests', protect, async (req, res) => {
  try {
    // Lazy-expire old requests
    await PrivateChatRequest.updateMany(
      { receiver: req.user._id, status: 'pending', expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    )

    const requests = await PrivateChatRequest.find({
      receiver: req.user._id,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('sender', 'name')
      .populate('groupId', 'name')
      .sort({ createdAt: -1 })

    res.json(requests)
  } catch (err) {
    console.error('Get private chat requests error:', err.message)
    res.status(500).json({ message: 'Failed to fetch requests.' })
  }
})

// ── GET /api/private-chat/status/:userId — Check status ───────
router.get('/status/:userId', protect, async (req, res) => {
  try {
    const myId = req.user._id
    const otherId = req.params.userId

    // Connected?
    const connected = await areConnected(myId, otherId)
    if (connected) return res.json({ status: 'connected' })

    // Pending sent?
    const sentRequest = await PrivateChatRequest.findOne({
      sender: myId,
      receiver: otherId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
    if (sentRequest) {
      return res.json({ status: 'request_pending_sent', requestId: sentRequest._id })
    }

    // Pending received?
    const receivedRequest = await PrivateChatRequest.findOne({
      sender: otherId,
      receiver: myId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
    if (receivedRequest) {
      return res.json({ status: 'request_pending_received', requestId: receivedRequest._id })
    }

    // 24h cooldown?
    const cooldown = await PrivateChatRequest.findOne({
      sender: myId,
      receiver: otherId,
      status: 'rejected',
      rejectedAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    })
    if (cooldown) {
      const cooldownEnd = new Date(cooldown.rejectedAt.getTime() + 24 * 60 * 60 * 1000)
      return res.json({ status: 'rejected_cooldown', cooldownEnd })
    }

    res.json({ status: 'not_connected' })
  } catch (err) {
    console.error('Status check error:', err.message)
    res.status(500).json({ message: 'Failed to check status.' })
  }
})

// ── POST /api/private-chat/approve/:id ───────────────────────
router.post('/approve/:id', protect, async (req, res) => {
  try {
    const request = await PrivateChatRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending.' })
    }

    request.status = 'approved'
    await request.save()

    // Create permanent connection (reuse existing Connection model)
    const connection = await Connection.create({
      user1: request.sender,
      user2: request.receiver,
    })

    // Notify sender in real-time
    const io = getIO()
    if (io) {
      io.to(request.sender.toString()).emit('private_chat_approved', {
        by: { _id: req.user._id, name: req.user.name },
        chatUserId: req.user._id,
      })
    }

    res.json({ success: true, chatUserId: request.sender })
  } catch (err) {
    console.error('Approve private chat request error:', err.message)
    res.status(500).json({ message: 'Failed to approve request.' })
  }
})

// ── POST /api/private-chat/reject/:id ────────────────────────
router.post('/reject/:id', protect, async (req, res) => {
  try {
    const request = await PrivateChatRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })

    if (request.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending.' })
    }

    request.status = 'rejected'
    request.rejectedAt = new Date()
    await request.save()

    // Notify sender
    const io = getIO()
    if (io) {
      io.to(request.sender.toString()).emit('private_chat_rejected', {
        by: { _id: req.user._id, name: req.user.name },
      })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Reject private chat request error:', err.message)
    res.status(500).json({ message: 'Failed to reject request.' })
  }
})

// ── DELETE /api/private-chat/cancel/:id ──────────────────────
router.delete('/cancel/:id', protect, async (req, res) => {
  try {
    const request = await PrivateChatRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found.' })

    if (request.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending.' })
    }

    request.status = 'cancelled'
    await request.save()

    // Notify receiver
    const io = getIO()
    if (io) {
      io.to(request.receiver.toString()).emit('private_chat_cancelled', {
        requestId: request._id,
        by: req.user._id,
      })
    }

    res.json({ success: true })
  } catch (err) {
    console.error('Cancel private chat request error:', err.message)
    res.status(500).json({ message: 'Failed to cancel request.' })
  }
})

module.exports = router