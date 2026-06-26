const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Message = require('../models/Message')
const Connection = require('../models/Connection')
const MessageLimit = require('../models/MessageLimit')
const Group = require('../models/Group')
const GroupMessage = require('../models/GroupMessage')

const onlineUsers = new Map()

function isCreator(group, userId) {
  return group.createdBy.toString() === userId.toString()
}

async function checkAndUpdateLimit(senderUserId, receiverUserId) {
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
  return { allowed: true }
}

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) return next(new Error('Authentication error: No token'))
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.id).select('-password')
      if (!user) return next(new Error('Authentication error: User not found'))
      socket.user = user
      next()
    } catch (err) {
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString()
    console.log(`🔌 User connected: ${socket.user.name} (${userId})`)

    onlineUsers.set(userId, socket.id)
    socket.join(userId)
    io.emit('user_online', { userId })

    // Join all group rooms this user belongs to
    try {
      const groups = await Group.find({ members: socket.user._id })
      groups.forEach((group) => {
        socket.join(`group_${group._id}`)
      })
    } catch (err) {
      console.error('Error joining group rooms:', err.message)
    }

    // ── Private Message ───────────────────────────────────────
    socket.on('send_message', async ({ receiverId, text }) => {
      try {
        if (!text || !text.trim()) return

        const conn = await Connection.findOne({
          $or: [
            { user1: userId, user2: receiverId },
            { user1: receiverId, user2: userId },
          ],
          isActive: true,
          isRevoked: false,
        })
        if (!conn) return

        const limitCheck = await checkAndUpdateLimit(userId, receiverId)
        if (!limitCheck.allowed) {
          socket.emit('message_limit_reached', { message: limitCheck.message })
          return
        }

        const message = await Message.create({
          senderId: userId,
          receiverId,
          text: text.trim(),
        })

        const msgData = {
          _id: message._id,
          senderId: userId,
          receiverId,
          text: message.text,
          seen: false,
          isEdited: false,
          createdAt: message.createdAt,
        }

        io.to(receiverId).emit('receive_message', msgData)
        socket.emit('message_sent', msgData)
      } catch (err) {
        console.error('Socket send_message error:', err.message)
      }
    })

    // ── Typing ────────────────────────────────────────────────
    socket.on('typing', ({ receiverId }) => {
      io.to(receiverId).emit('user_typing', { senderId: userId, name: socket.user.name })
    })

    socket.on('stop_typing', ({ receiverId }) => {
      io.to(receiverId).emit('user_stop_typing', { senderId: userId })
    })

    // ── Mark Seen ─────────────────────────────────────────────
    socket.on('mark_seen', async ({ messageId, senderId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { seen: true })
        io.to(senderId).emit('message_seen', { messageId })
      } catch (err) {
        console.error('Mark seen error:', err.message)
      }
    })

    // ── Revoke Connection ─────────────────────────────────────
    socket.on('revoke_connection', ({ otherUserId }) => {
      io.to(otherUserId).emit('connection_revoked', {
        by: userId,
        message: 'Your connection has been revoked.',
      })
      socket.emit('revoke_confirmed', { otherUserId })
    })

    // ── Group: Join room ──────────────────────────────────────
    socket.on('join_group', ({ groupId }) => {
      socket.join(`group_${groupId}`)
    })

    // ── Group: Send message ───────────────────────────────────
    socket.on('group_send_message', async ({ groupId, text }) => {
      try {
        if (!text || !text.trim()) return

        const group = await Group.findById(groupId)
        if (!group) return
        if (!group.members.some((m) => m.toString() === userId)) return

        const message = await GroupMessage.create({
          groupId,
          senderId: userId,
          text: text.trim(),
        })

        const msgData = {
          _id: message._id,
          groupId,
          senderId: { _id: userId, name: socket.user.name },
          text: message.text,
          isEdited: false,
          createdAt: message.createdAt,
        }

        io.to(`group_${groupId}`).emit('receive_group_message', msgData)
      } catch (err) {
        console.error('Group send message error:', err.message)
      }
    })

    // ── Group: Edit message ───────────────────────────────────
    // Only the original sender can edit. No "(edited)" trace shown to anyone.
    socket.on('group_edit_message', async ({ messageId, text }) => {
      try {
        if (!text || !text.trim()) return

        const message = await GroupMessage.findById(messageId)
        if (!message) return
        if (message.senderId.toString() !== userId) return
        if (message.isDeletedForEveryone) return

        message.text = text.trim()
        message.isEdited = true
        await message.save()

        io.to(`group_${message.groupId}`).emit('group_message_edited', {
          messageId: message._id,
          text: message.text,
        })
      } catch (err) {
        console.error('Group edit message error:', err.message)
      }
    })

    // ── Group: Delete message ─────────────────────────────────
    // deleteFor: 'me' | 'everyone'
    // - Sender deleting own message: removed for everyone, no trace anywhere.
    // - Creator deleting someone else's message:
    //     -> The original sender's room (their personal userId room) is
    //        EXCLUDED from the generic "deleted" broadcast, and instead gets
    //        ONLY the targeted "deleted by creator" event. This removes any
    //        race condition — the sender's client can never receive both
    //        events and never has to reconcile ordering.
    //     -> Everyone else in the group just sees the message vanish.
    socket.on('group_delete_message', async ({ messageId, deleteFor }) => {
      try {
        const message = await GroupMessage.findById(messageId)
        if (!message) return

        const group = await Group.findById(message.groupId)
        if (!group) return

        const isSender = message.senderId.toString() === userId
        const isGroupCreator = isCreator(group, userId)
        const groupRoom = `group_${message.groupId}`

        if (deleteFor === 'everyone') {
          if (!isSender && !isGroupCreator) return // not authorized

          if (isSender) {
            // Sender deleting their own message — fully gone for everyone, no trace
            await GroupMessage.findByIdAndDelete(message._id)
            io.to(groupRoom).emit('group_message_deleted', { messageId: message._id })
            return
          }

          // Creator deleting someone else's message.
          // Broadcast the generic "vanish" event to the room EXCEPT the
          // original sender's personal room, so the sender's client only
          // ever receives the targeted notice event below — no ordering
          // ambiguity, no race condition.
          const senderUserId = message.senderId.toString()

          io.to(groupRoom).except(senderUserId).emit('group_message_deleted', {
            messageId: message._id,
          })

          io.to(senderUserId).emit('group_message_deleted_by_creator', {
            messageId: message._id,
            creatorName: socket.user.name,
          })

          await GroupMessage.findByIdAndDelete(message._id)
          return
        }

        // Delete for me only
        if (!message.deletedFor.some((id) => id.toString() === userId)) {
          message.deletedFor.push(userId)
          await message.save()
        }
        socket.emit('group_message_deleted_for_me', { messageId: message._id })
      } catch (err) {
        console.error('Group delete message error:', err.message)
      }
    })

    // ── Disconnect ────────────────────────────────────────────
    socket.on('disconnect', () => {
      onlineUsers.delete(userId)
      io.emit('user_offline', { userId })
      console.log(`❌ User disconnected: ${socket.user.name}`)
    })
  })

  return io
}

module.exports = initSocket