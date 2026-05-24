const express = require('express')
const router = express.Router()
const Group = require('../models/Group')
const GroupInvitation = require('../models/GroupInvitation')
const GroupJoinRequest = require('../models/GroupJoinRequest')
const GroupMessage = require('../models/GroupMessage')
const AdminActionRequest = require('../models/AdminActionRequest')
const Connection = require('../models/Connection')
const { protect } = require('../middleware/auth')

function generateCode() {
  return Math.random().toString(36).substring(2, 12).toUpperCase()
}

function isCreator(group, userId) {
  return group.createdBy.toString() === userId.toString()
}

function isAdmin(group, userId) {
  return group.admins.some((id) => id.toString() === userId.toString())
}

function isMember(group, userId) {
  return group.members.some((id) => id.toString() === userId.toString())
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

router.post('/', protect, async (req, res) => {
  try {
    const { name, description } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required.' })
    }
    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.user._id,
      admins: [req.user._id],
      members: [req.user._id],
      inviteCode: generateCode(),
    })
    res.status(201).json(group)
  } catch (err) {
    console.error('Create group error:', err.message)
    res.status(500).json({ message: 'Failed to create group.' })
  }
})

router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 })

    const myGroups = groups.filter((g) =>
      g.members.some((m) => m.toString() === req.user._id.toString())
    )

    res.json(myGroups)
  } catch (err) {
    console.error('Get groups error:', err.message)
    res.status(500).json({ message: 'Failed to fetch groups.' })
  }
})

router.get('/my-invitations', protect, async (req, res) => {
  try {
    const invitations = await GroupInvitation.find({
      invitedUser: req.user._id,
      status: 'pending',
    })
      .populate('groupId', 'name description')
      .populate('invitedBy', 'name')
      .sort({ createdAt: -1 })
    res.json(invitations)
  } catch (err) {
    console.error('Get invitations error:', err.message)
    res.status(500).json({ message: 'Failed to fetch invitations.' })
  }
})

router.get('/pending-admin-tasks', protect, async (req, res) => {
  try {
    const adminGroups = await Group.find({ admins: req.user._id })
    const adminGroupIds = adminGroups.map((g) => g._id)
    const creatorGroupIds = adminGroups
      .filter((g) => g.createdBy.toString() === req.user._id.toString())
      .map((g) => g._id)

    const [joinRequests, adminActionRequests] = await Promise.all([
      GroupJoinRequest.find({ groupId: { $in: adminGroupIds }, status: 'pending' })
        .populate('requestedBy', 'name')
        .populate('groupId', 'name'),
      AdminActionRequest.find({ groupId: { $in: creatorGroupIds }, status: 'pending' })
        .populate('requestedBy', 'name')
        .populate('targetUser', 'name')
        .populate('groupId', 'name'),
    ])

    res.json({ joinRequests, adminActionRequests })
  } catch (err) {
    console.error('Pending admin tasks error:', err.message)
    res.status(500).json({ message: 'Failed to fetch tasks.' })
  }
})

router.get('/join/:code', protect, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.code })
      .populate('createdBy', 'name')
    if (!group) return res.status(404).json({ message: 'Invalid invite code.' })

    const alreadyMember = group.members.some(
      (m) => m.toString() === req.user._id.toString()
    )
    const pendingRequest = await GroupJoinRequest.findOne({
      groupId: group._id,
      requestedBy: req.user._id,
      status: 'pending',
    })

    res.json({
      group: {
        _id: group._id,
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        createdBy: group.createdBy,
      },
      alreadyMember,
      hasPendingRequest: !!pendingRequest,
    })
  } catch (err) {
    console.error('Get group by code error:', err.message)
    res.status(500).json({ message: 'Failed to fetch group info.' })
  }
})

router.post('/join/:code', protect, async (req, res) => {
  try {
    const group = await Group.findOne({ inviteCode: req.params.code })
    if (!group) return res.status(404).json({ message: 'Invalid invite code.' })

    const alreadyMember = group.members.some(
      (m) => m.toString() === req.user._id.toString()
    )
    if (alreadyMember) {
      return res.status(400).json({ message: 'You are already a member.' })
    }

    const existing = await GroupJoinRequest.findOne({
      groupId: group._id,
      requestedBy: req.user._id,
      status: 'pending',
    })
    if (existing) return res.status(400).json({ message: 'Join request already sent.' })

    const joinRequest = await GroupJoinRequest.create({
      groupId: group._id,
      requestedBy: req.user._id,
    })

    res.status(201).json({ success: true, message: 'Join request sent.', joinRequest })
  } catch (err) {
    console.error('Join request error:', err.message)
    res.status(500).json({ message: 'Failed to send join request.' })
  }
})

router.post('/invitations/:id/approve', protect, async (req, res) => {
  try {
    const invitation = await GroupInvitation.findById(req.params.id)
    if (!invitation) return res.status(404).json({ message: 'Invitation not found.' })
    if (invitation.invitedUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }
    invitation.status = 'approved'
    await invitation.save()
    await Group.findByIdAndUpdate(invitation.groupId, {
      $addToSet: { members: req.user._id },
    })
    res.json({ success: true, groupId: invitation.groupId })
  } catch (err) {
    console.error('Approve invitation error:', err.message)
    res.status(500).json({ message: 'Failed to approve invitation.' })
  }
})

router.post('/invitations/:id/reject', protect, async (req, res) => {
  try {
    const invitation = await GroupInvitation.findById(req.params.id)
    if (!invitation) return res.status(404).json({ message: 'Invitation not found.' })
    if (invitation.invitedUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' })
    }
    invitation.status = 'rejected'
    await invitation.save()
    res.json({ success: true })
  } catch (err) {
    console.error('Reject invitation error:', err.message)
    res.status(500).json({ message: 'Failed to reject invitation.' })
  }
})

router.post('/join-requests/:id/approve', protect, async (req, res) => {
  try {
    const joinRequest = await GroupJoinRequest.findById(req.params.id)
    if (!joinRequest) return res.status(404).json({ message: 'Request not found.' })
    const group = await Group.findById(joinRequest.groupId)
    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Admins only.' })
    }
    joinRequest.status = 'approved'
    await joinRequest.save()
    await Group.findByIdAndUpdate(group._id, {
      $addToSet: { members: joinRequest.requestedBy },
    })
    res.json({ success: true, groupId: group._id })
  } catch (err) {
    console.error('Approve join request error:', err.message)
    res.status(500).json({ message: 'Failed to approve request.' })
  }
})

router.post('/join-requests/:id/reject', protect, async (req, res) => {
  try {
    const joinRequest = await GroupJoinRequest.findById(req.params.id)
    if (!joinRequest) return res.status(404).json({ message: 'Request not found.' })
    const group = await Group.findById(joinRequest.groupId)
    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Admins only.' })
    }
    joinRequest.status = 'rejected'
    await joinRequest.save()
    res.json({ success: true })
  } catch (err) {
    console.error('Reject join request error:', err.message)
    res.status(500).json({ message: 'Failed to reject request.' })
  }
})

router.post('/admin-actions/:id/approve', protect, async (req, res) => {
  try {
    const actionReq = await AdminActionRequest.findById(req.params.id)
    if (!actionReq) return res.status(404).json({ message: 'Request not found.' })
    const group = await Group.findById(actionReq.groupId)
    if (!isCreator(group, req.user._id)) {
      return res.status(403).json({ message: 'Creator only.' })
    }
    actionReq.status = 'approved'
    await actionReq.save()
    if (actionReq.actionType === 'remove-member') {
      await Group.findByIdAndUpdate(group._id, {
        $pull: { members: actionReq.targetUser, admins: actionReq.targetUser },
      })
    } else if (actionReq.actionType === 'make-admin') {
      await Group.findByIdAndUpdate(group._id, {
        $addToSet: { admins: actionReq.targetUser },
      })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('Approve admin action error:', err.message)
    res.status(500).json({ message: 'Failed to approve action.' })
  }
})

router.post('/admin-actions/:id/reject', protect, async (req, res) => {
  try {
    const actionReq = await AdminActionRequest.findById(req.params.id)
    if (!actionReq) return res.status(404).json({ message: 'Request not found.' })
    const group = await Group.findById(actionReq.groupId)
    if (!isCreator(group, req.user._id)) {
      return res.status(403).json({ message: 'Creator only.' })
    }
    actionReq.status = 'rejected'
    await actionReq.save()
    res.json({ success: true })
  } catch (err) {
    console.error('Reject admin action error:', err.message)
    res.status(500).json({ message: 'Failed to reject action.' })
  }
})

router.get('/:id([0-9a-fA-F]{24})', protect, async (req, res) => {
  try {
    const rawGroup = await Group.findById(req.params.id)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })

    const memberCheck = rawGroup.members.some(
      (m) => m.toString() === req.user._id.toString()
    )
    if (!memberCheck) {
      return res.status(403).json({ message: 'You are not a member of this group.' })
    }

    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('admins', 'name')
      .populate('members', 'name')

    res.json(group)
  } catch (err) {
    console.error('Get group error:', err.message)
    res.status(500).json({ message: 'Failed to fetch group.' })
  }
})

router.get('/:id([0-9a-fA-F]{24})/messages', protect, async (req, res) => {
  try {
    const rawGroup = await Group.findById(req.params.id)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })

    const memberCheck = rawGroup.members.some(
      (m) => m.toString() === req.user._id.toString()
    )
    if (!memberCheck) {
      return res.status(403).json({ message: 'Not a member.' })
    }

    const messages = await GroupMessage.find({ groupId: req.params.id })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 })

    res.json(messages)
  } catch (err) {
    console.error('Get group messages error:', err.message)
    res.status(500).json({ message: 'Failed to fetch messages.' })
  }
})

router.post('/:id([0-9a-fA-F]{24})/invite', protect, async (req, res) => {
  try {
    const { targetUserId } = req.body
    const rawGroup = await Group.findById(req.params.id)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })

    if (!isAdmin(rawGroup, req.user._id)) {
      return res.status(403).json({ message: 'Only admins can invite users.' })
    }

    const connected = await areConnected(req.user._id, targetUserId)
    if (!connected) {
      return res.status(403).json({ message: 'You can only invite users you are connected with.' })
    }

    if (isMember(rawGroup, targetUserId)) {
      return res.status(400).json({ message: 'User is already a member.' })
    }

    const existing = await GroupInvitation.findOne({
      groupId: rawGroup._id,
      invitedUser: targetUserId,
      status: 'pending',
    })
    if (existing) return res.status(400).json({ message: 'Invitation already sent.' })

    const invitation = await GroupInvitation.create({
      groupId: rawGroup._id,
      invitedBy: req.user._id,
      invitedUser: targetUserId,
    })

    res.status(201).json({ success: true, invitation })
  } catch (err) {
    console.error('Invite error:', err.message)
    res.status(500).json({ message: 'Failed to send invitation.' })
  }
})

router.post('/:id([0-9a-fA-F]{24})/admin-action', protect, async (req, res) => {
  try {
    const { targetUserId, actionType } = req.body
    const group = await Group.findById(req.params.id)
    if (!group) return res.status(404).json({ message: 'Group not found.' })

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Admins only.' })
    }

    if (!['remove-member', 'make-admin'].includes(actionType)) {
      return res.status(400).json({ message: 'Invalid action type.' })
    }

    if (isCreator(group, req.user._id)) {
      if (actionType === 'remove-member') {
        if (isCreator(group, targetUserId)) {
          return res.status(400).json({ message: 'Cannot remove creator.' })
        }
        await Group.findByIdAndUpdate(group._id, {
          $pull: { members: targetUserId, admins: targetUserId },
        })
        return res.json({ success: true, direct: true })
      }
      if (actionType === 'make-admin') {
        if (!isMember(group, targetUserId)) {
          return res.status(400).json({ message: 'User is not a member.' })
        }
        await Group.findByIdAndUpdate(group._id, {
          $addToSet: { admins: targetUserId },
        })
        return res.json({ success: true, direct: true })
      }
    }

    const existing = await AdminActionRequest.findOne({
      groupId: group._id,
      targetUser: targetUserId,
      actionType,
      status: 'pending',
    })
    if (existing) return res.status(400).json({ message: 'Request already pending.' })

    const actionRequest = await AdminActionRequest.create({
      groupId: group._id,
      requestedBy: req.user._id,
      targetUser: targetUserId,
      actionType,
    })

    res.status(201).json({ success: true, pending: true, actionRequest })
  } catch (err) {
    console.error('Admin action error:', err.message)
    res.status(500).json({ message: 'Failed to submit action.' })
  }
})

router.post('/:id([0-9a-fA-F]{24})/demote/:userId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) return res.status(404).json({ message: 'Group not found.' })

    if (!isAdmin(group, req.user._id)) {
      return res.status(403).json({ message: 'Admins only.' })
    }
    if (isCreator(group, req.params.userId)) {
      return res.status(400).json({ message: 'Cannot demote the creator.' })
    }
    if (!isAdmin(group, req.params.userId)) {
      return res.status(400).json({ message: 'User is not an admin.' })
    }

    await Group.findByIdAndUpdate(group._id, {
      $pull: { admins: req.params.userId },
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Demote error:', err.message)
    res.status(500).json({ message: 'Failed to demote admin.' })
  }
})

router.post('/:id([0-9a-fA-F]{24})/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
    if (!group) return res.status(404).json({ message: 'Group not found.' })

    if (isCreator(group, req.user._id)) {
      return res.status(400).json({ message: 'Creator cannot leave the group.' })
    }
    if (!isMember(group, req.user._id)) {
      return res.status(400).json({ message: 'You are not a member.' })
    }

    await Group.findByIdAndUpdate(group._id, {
      $pull: { members: req.user._id, admins: req.user._id },
    })

    res.json({ success: true })
  } catch (err) {
    console.error('Leave group error:', err.message)
    res.status(500).json({ message: 'Failed to leave group.' })
  }
})

// ── GET /api/groups/:groupId/search/keyword ───────────────────
router.get('/:groupId/search/keyword', protect, async (req, res) => {
  try {
    const { q } = req.query

    const rawGroup = await Group.findById(req.params.groupId)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })
    if (!isMember(rawGroup, req.user._id)) {
      return res.status(403).json({ message: 'Not a member.' })
    }

    if (!q || !q.trim()) {
      return res.status(400).json({ message: 'Keyword is required.' })
    }

    // Escape special regex characters for safety
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const messages = await GroupMessage.find({
      groupId: req.params.groupId,
      text: { $regex: escaped, $options: 'i' },
    })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 })
      .limit(100)

    res.json(messages)
  } catch (err) {
    console.error('Keyword search error:', err.message)
    res.status(500).json({ message: 'Search failed.' })
  }
})

// ── GET /api/groups/:groupId/search/username ──────────────────
router.get('/:groupId/search/username', protect, async (req, res) => {
  try {
    const { userId } = req.query

    const rawGroup = await Group.findById(req.params.groupId)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })
    if (!isMember(rawGroup, req.user._id)) {
      return res.status(403).json({ message: 'Not a member.' })
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required.' })
    }

    // Verify the searched user is actually a member of this group
    if (!isMember(rawGroup, userId)) {
      return res.status(400).json({ message: 'User is not a member of this group.' })
    }

    const messages = await GroupMessage.find({
      groupId: req.params.groupId,
      senderId: userId,
    })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 })
      .limit(200)

    res.json(messages)
  } catch (err) {
    console.error('Username search error:', err.message)
    res.status(500).json({ message: 'Search failed.' })
  }
})

// ── GET /api/groups/:groupId/search/date ─────────────────────
router.get('/:groupId/search/date', protect, async (req, res) => {
  try {
    const { from, to } = req.query

    const rawGroup = await Group.findById(req.params.groupId)
    if (!rawGroup) return res.status(404).json({ message: 'Group not found.' })
    if (!isMember(rawGroup, req.user._id)) {
      return res.status(403).json({ message: 'Not a member.' })
    }

    if (!from || !to) {
      return res.status(400).json({ message: 'from and to dates are required.' })
    }

    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format.' })
    }

    const messages = await GroupMessage.find({
      groupId: req.params.groupId,
      createdAt: { $gte: fromDate, $lte: toDate },
    })
      .populate('senderId', 'name')
      .sort({ createdAt: 1 })
      .limit(200)

    res.json(messages)
  } catch (err) {
    console.error('Date search error:', err.message)
    res.status(500).json({ message: 'Search failed.' })
  }
})

module.exports = router