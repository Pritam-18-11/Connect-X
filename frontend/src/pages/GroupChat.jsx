import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  Send, MoreVertical, X, Copy, Check,
  Users, UserPlus, LogOut, Shield, Crown,
  MessageSquare, ChevronLeft, Clock, Search, UserMinus,
  Pencil, Trash2, MoreHorizontal,
} from 'lucide-react'

// ── Keyword Highlighter ───────────────────────────────────────
function HighlightedText({ text, keyword }) {
  if (!keyword || !keyword.trim()) return <span>{text}</span>
  const kw = keyword.trim()
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === kw.toLowerCase() ? (
          <mark key={i} className="bg-accent/30 text-accent rounded px-0.5 not-italic font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

// ── Message Action Menu ────────────────────────────────────────
function MessageActionMenu({ isMe, canCreatorDelete, onEdit, onDeleteMe, onDeleteEveryone, onClose }) {
  return (
    <div
      className="absolute z-30 top-full mt-1 right-0 w-48 panel border border-border py-1"
      onClick={(e) => e.stopPropagation()}
    >
      {isMe && (
        <button
          onClick={() => { onEdit(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-text-dim hover:text-text hover:bg-void text-xs font-mono transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
      )}
      <button
        onClick={() => { onDeleteMe(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-text-dim hover:text-text hover:bg-void text-xs font-mono transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Delete for me
      </button>
      {(isMe || canCreatorDelete) && (
        <button
          onClick={() => { onDeleteEveryone(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-danger hover:bg-danger/10 text-xs font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
        </button>
      )}
    </div>
  )
}

// ── Group Message Component ───────────────────────────────────
function GroupMsg({
  msg, currentUserId, isCurrentUserCreator,
  onEdit, onDeleteMe, onDeleteEveryone,
  editingId, editText, setEditText, onSaveEdit, onCancelEdit,
}) {
  const senderId = msg.senderId?._id?.toString() || msg.senderId?.toString()
  const isMe = senderId === currentUserId
  const senderName = msg.senderId?.name || 'Unknown'
  const [showMenu, setShowMenu] = useState(false)
  const isEditing = editingId === msg._id

  // Creator can delete-for-everyone on others' messages too
  const canCreatorDelete = isCurrentUserCreator && !isMe

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className={`relative max-w-xs lg:max-w-sm ${!isMe ? 'space-y-1' : ''}`}>
        {!isMe && <p className="text-accent text-xs font-mono px-1">{senderName}</p>}
        <div className={`px-4 py-2.5 rounded-lg text-sm font-mono leading-relaxed ${
          isMe
            ? 'bg-accent text-void rounded-br-sm'
            : 'bg-panel border border-border text-text rounded-bl-sm'
        }`}>
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit()
                  if (e.key === 'Escape') onCancelEdit()
                }}
                autoFocus
                className="w-full bg-void/20 border border-current/30 rounded px-2 py-1 text-sm outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={onCancelEdit} className="text-xs opacity-70 hover:opacity-100">Cancel</button>
                <button onClick={onSaveEdit} className="text-xs font-semibold hover:underline">Save</button>
              </div>
            </div>
          ) : (
            <p className={`text-xs mt-1 text-right ${isMe ? 'text-void/60' : 'text-text-dim'}`} style={{ display: 'contents' }}>
              <span style={{ display: 'block' }}>{msg.text}</span>
              <span className="block text-xs mt-1 text-right">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
          )}
        </div>

        {!isEditing && (canCreatorDelete || isMe) && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v) }}
            className={`absolute top-0 ${isMe ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-text hover:bg-void transition-opacity`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}

        {showMenu && (
          <MessageActionMenu
            isMe={isMe}
            canCreatorDelete={canCreatorDelete}
            onEdit={() => onEdit(msg)}
            onDeleteMe={() => onDeleteMe(msg._id)}
            onDeleteEveryone={() => onDeleteEveryone(msg._id)}
            onClose={() => setShowMenu(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── "Deleted by creator" notice — shown ONLY to the original sender ──
function DeletedByCreatorNotice({ msg, currentUserId }) {
  const senderId = msg.senderId?._id?.toString() || msg.senderId?.toString()
  const isMe = senderId === currentUserId
  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="max-w-xs lg:max-w-sm px-4 py-2.5 rounded-lg text-xs font-mono italic text-text-dim border border-dashed border-border bg-panel/40">
        This message is deleted by {msg._deletedByCreatorName}
      </div>
    </div>
  )
}

// ── Modal Shell ───────────────────────────────────────────────
function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="panel p-6 w-full max-w-sm border border-border relative max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-text transition-colors">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

// ── Search Result Card ────────────────────────────────────────
function SearchResultCard({ msg, searchTab, keyword, onClick }) {
  return (
    <div
      onClick={onClick}
      className="p-3 rounded border border-transparent hover:border-border hover:bg-void/60 cursor-pointer transition-all mb-1"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-accent text-xs font-mono font-semibold">
          {msg.senderId?.name || 'Unknown'}
        </span>
        <span className="text-text-dim text-xs font-mono">
          {new Date(msg.createdAt).toLocaleDateString()} &nbsp;
          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <p className="text-text text-xs font-mono leading-relaxed line-clamp-2">
        {searchTab === 'keyword'
          ? <HighlightedText text={msg.text} keyword={keyword} />
          : msg.text}
      </p>
    </div>
  )
}

// ── Main GroupChat Component ──────────────────────────────────
export default function GroupChat() {
  const { id: groupId } = useParams()
  const { user } = useAuth()
  const { socket } = useSocket()
  const navigate = useNavigate()

  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [connections, setConnections] = useState([])
  const [copiedLink, setCopiedLink] = useState(false)
  const [invitingUser, setInvitingUser] = useState(null)
  const [leavingGroup, setLeavingGroup] = useState(false)
  const [removingMember, setRemovingMember] = useState(null)

  // Member detail states
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberStatus, setMemberStatus] = useState(null)
  const [memberStatusLoading, setMemberStatusLoading] = useState(false)
  const [processingRequest, setProcessingRequest] = useState(false)
  const [requestError, setRequestError] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  // Search states
  const [showSearch, setShowSearch] = useState(false)
  const [searchTab, setSearchTab] = useState('keyword')
  const [keyword, setKeyword] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchDone, setSearchDone] = useState(false)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)

  const bottomRef = useRef(null)
  const messageRefs = useRef({})

  const currentUserId = String(user?.id || user?._id || '')

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      const [groupRes, messagesRes] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/messages`),
      ])
      setGroup(groupRes.data)
      setMessages(messagesRes.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load group.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!socket) return
    socket.emit('join_group', { groupId })

    const handleMessage = (msg) => {
      const msgGroupId = typeof msg.groupId === 'object'
        ? msg.groupId?._id?.toString()
        : msg.groupId?.toString()

      if (msgGroupId === groupId?.toString()) {
        setMessages((prev) => [...prev, msg])
      }
    }

    const handleChatApproved = ({ chatUserId }) => {
      if (selectedMember && selectedMember._id?.toString() === chatUserId?.toString()) {
        setMemberStatus({ status: 'connected' })
      }
    }

    // ── Edit / Delete listeners ────────────────────────────────
    const handleEdited = ({ messageId, text }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, text } : m))
      )
    }

    // Everyone except the original sender sees the message simply vanish
    const handleDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    }

    // The original sender ALSO receives this targeted event (in addition to
    // handleDeleted from the room broadcast) — replace the message with a notice
    // instead of removing it.
    const handleDeletedByCreator = ({ messageId, creatorName }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? { ...m, _deletedByCreator: true, _deletedByCreatorName: creatorName }
            : m
        )
      )
    }

    const handleDeletedForMe = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    }

    socket.on('receive_group_message', handleMessage)
    socket.on('private_chat_approved', handleChatApproved)
    socket.on('group_message_edited', handleEdited)
    socket.on('group_message_deleted', handleDeleted)
    socket.on('group_message_deleted_by_creator', handleDeletedByCreator)
    socket.on('group_message_deleted_for_me', handleDeletedForMe)

    return () => {
      socket.off('receive_group_message', handleMessage)
      socket.off('private_chat_approved', handleChatApproved)
      socket.off('group_message_edited', handleEdited)
      socket.off('group_message_deleted', handleDeleted)
      socket.off('group_message_deleted_by_creator', handleDeletedByCreator)
      socket.off('group_message_deleted_for_me', handleDeletedForMe)
    }
  }, [socket, groupId, selectedMember])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() || !socket) return
    socket.emit('group_send_message', { groupId, text: input.trim() })
    setInput('')
  }

  // ── Edit / Delete handlers ─────────────────────────────────
  const startEdit = (msg) => {
    setEditingId(msg._id)
    setEditText(msg.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = () => {
    if (!editText.trim() || !editingId || !socket) return
    socket.emit('group_edit_message', { messageId: editingId, text: editText.trim() })
    setMessages((prev) =>
      prev.map((m) => (m._id === editingId ? { ...m, text: editText.trim() } : m))
    )
    cancelEdit()
  }

  const deleteForMe = (messageId) => {
    if (!socket) return
    socket.emit('group_delete_message', { messageId, deleteFor: 'me' })
    setMessages((prev) => prev.filter((m) => m._id !== messageId))
  }

  const deleteForEveryone = (messageId) => {
    if (!socket) return
    socket.emit('group_delete_message', { messageId, deleteFor: 'everyone' })
    // Optimistically remove; if this client is the original sender being
    // deleted by the creator, the targeted socket event will restore a notice.
    setMessages((prev) => prev.filter((m) => m._id !== messageId))
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/groups/join/${group.inviteCode}`)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const openInviteModal = async () => {
    setShowMenu(false)
    try {
      const { data } = await api.get('/connections/list')
      const memberIds = group.members.map((m) => m._id?.toString())
      setConnections(data.filter((c) => !memberIds.includes(c.userId?.toString())))
    } catch (err) {
      console.error('Failed to load connections:', err)
    }
    setShowInviteModal(true)
  }

  const handleInvite = async (userId) => {
    setInvitingUser(userId)
    try {
      await api.post(`/groups/${groupId}/invite`, { targetUserId: userId })
      setConnections((prev) => prev.filter((c) => c.userId?.toString() !== userId))
    } catch (err) {
      console.error('Invite error:', err)
    } finally {
      setInvitingUser(null)
    }
  }

  const handleLeave = async () => {
    setLeavingGroup(true)
    try {
      await api.post(`/groups/${groupId}/leave`)
      navigate('/groups')
    } catch (err) {
      console.error('Leave error:', err)
      setLeavingGroup(false)
    }
  }

  // ── Remove Member Logic ───────────────────────────────────────
  const handleRemoveMember = async (memberId) => {
    setRemovingMember(memberId)
    setRequestError('')
    try {
      const { data } = await api.post(`/groups/${groupId}/admin-action`, {
        targetUserId: memberId,
        actionType: 'remove-member',
      })
      if (data.direct) {
        setGroup((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m._id?.toString() !== memberId),
          admins: prev.admins.filter((a) => (a._id?.toString() || a.toString()) !== memberId),
        }))
        setSelectedMember(null)
      } else {
        setRequestError('Remove request sent to group creator for approval.')
      }
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to remove member.')
    } finally {
      setRemovingMember(null)
    }
  }

  // ── Member Detail Logic ───────────────────────────────────────
  const handleMemberClick = async (member) => {
    const memberId = member._id?.toString()
    if (memberId === currentUserId) return
    setSelectedMember(member)
    setMemberStatus(null)
    setMemberStatusLoading(true)
    setRequestError('')
    try {
      const { data } = await api.get(`/private-chat/status/${memberId}`)
      setMemberStatus(data)
    } catch (err) {
      console.error('Failed to fetch status:', err)
    } finally {
      setMemberStatusLoading(false)
    }
  }

  const handleSendChatRequest = async () => {
    setProcessingRequest(true)
    setRequestError('')
    try {
      const { data } = await api.post('/private-chat/request', {
        receiverId: selectedMember._id,
        groupId,
      })
      setMemberStatus({ status: 'request_pending_sent', requestId: data.requestId })
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to send request.')
    } finally {
      setProcessingRequest(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!memberStatus?.requestId) return
    setProcessingRequest(true)
    try {
      await api.delete(`/private-chat/cancel/${memberStatus.requestId}`)
      setMemberStatus({ status: 'not_connected' })
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to cancel request.')
    } finally {
      setProcessingRequest(false)
    }
  }

  const handleApproveRequest = async () => {
    if (!memberStatus?.requestId) return
    setProcessingRequest(true)
    try {
      const { data } = await api.post(`/private-chat/approve/${memberStatus.requestId}`)
      setShowMembersModal(false)
      setSelectedMember(null)
      navigate(`/chat/${data.chatUserId}`)
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to approve request.')
      setProcessingRequest(false)
    }
  }

  const handleRejectRequest = async () => {
    if (!memberStatus?.requestId) return
    setProcessingRequest(true)
    try {
      await api.post(`/private-chat/reject/${memberStatus.requestId}`)
      setMemberStatus({ status: 'not_connected' })
      setSelectedMember(null)
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to reject request.')
    } finally {
      setProcessingRequest(false)
    }
  }

  const renderMemberActionButton = () => {
    if (memberStatusLoading) {
      return (
        <div className="flex justify-center py-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )
    }
    if (!memberStatus) return null
    const { status, requestId, cooldownEnd } = memberStatus

    if (status === 'connected') {
      return (
        <button onClick={() => navigate(`/chat/${selectedMember._id}`)}
          className="btn-primary w-full flex items-center justify-center gap-2">
          <MessageSquare className="w-4 h-4" /> Message
        </button>
      )
    }
    if (status === 'request_pending_sent') {
      return (
        <div className="space-y-2">
          <div className="w-full py-2.5 rounded border border-accent/30 text-accent font-mono text-sm text-center opacity-70">
            ✓ Requested
          </div>
          <button onClick={handleCancelRequest} disabled={processingRequest}
            className="w-full text-danger font-mono text-xs hover:underline py-1 disabled:opacity-60">
            {processingRequest ? 'Cancelling...' : 'Cancel Request'}
          </button>
        </div>
      )
    }
    if (status === 'request_pending_received') {
      return (
        <div className="space-y-3">
          <p className="text-text-dim text-xs font-mono text-center">
            This user wants to chat privately with you
          </p>
          <div className="flex gap-2">
            <button onClick={handleApproveRequest} disabled={processingRequest}
              className="flex-1 py-2.5 rounded bg-success/10 border border-success/30 text-success font-mono text-sm hover:bg-success/20 disabled:opacity-60 transition-all">
              Approve
            </button>
            <button onClick={handleRejectRequest} disabled={processingRequest}
              className="flex-1 py-2.5 rounded bg-danger/10 border border-danger/30 text-danger font-mono text-sm hover:bg-danger/20 disabled:opacity-60 transition-all">
              Reject
            </button>
          </div>
        </div>
      )
    }
    if (status === 'rejected_cooldown') {
      const hoursLeft = Math.max(1, Math.ceil((new Date(cooldownEnd) - new Date()) / (1000 * 60 * 60)))
      return (
        <div className="w-full py-2.5 rounded border border-border text-text-dim font-mono text-sm text-center opacity-60 flex items-center justify-center gap-2">
          <Clock className="w-4 h-4" /> Request again in {hoursLeft}h
        </div>
      )
    }
    return (
      <button onClick={handleSendChatRequest} disabled={processingRequest}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
        <UserPlus className="w-4 h-4" />
        {processingRequest ? 'Sending...' : 'Request Private Chat'}
      </button>
    )
  }

  // ── Search Logic ──────────────────────────────────────────────
  const handleSearch = async () => {
    setSearchLoading(true)
    setSearchResults([])
    setSearchDone(false)
    try {
      let res
      if (searchTab === 'keyword') {
        if (!keyword.trim()) return
        res = await api.get(`/groups/${groupId}/search/keyword?q=${encodeURIComponent(keyword)}`)
      } else if (searchTab === 'username') {
        if (!selectedMemberId) return
        res = await api.get(`/groups/${groupId}/search/username?userId=${selectedMemberId}`)
      } else if (searchTab === 'date') {
        if (!dateFrom || !dateTo) return
        res = await api.get(`/groups/${groupId}/search/date?from=${dateFrom}&to=${dateTo}`)
      }
      setSearchResults(res?.data || [])
      setSearchDone(true)
    } catch (err) {
      console.error('Search error:', err)
      setSearchDone(true)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleResultClick = (messageId) => {
    setShowSearch(false)
    setHighlightedMessageId(messageId)

    setTimeout(() => {
      const el = messageRefs.current[messageId]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      setTimeout(() => setHighlightedMessageId(null), 3000)
    }, 150)
  }

  const resetSearch = () => {
    setSearchResults([])
    setSearchDone(false)
    setKeyword('')
    setSelectedMemberId('')
    setDateFrom('')
    setDateTo('')
  }

  const currentUserIsAdmin = group?.admins?.some(
    (a) => (a._id?.toString() || a.toString()) === currentUserId
  )
  const currentUserIsCreator =
    (group?.createdBy?._id?.toString() || group?.createdBy?.toString()) === currentUserId

  if (loading) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-danger font-mono mb-4">{error}</p>
            <button onClick={() => navigate('/groups')} className="btn-ghost">Go Back</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex items-center gap-4 bg-panel">
          <div className="w-10 h-10 rounded-lg bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-lg">
            {group?.name?.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-text font-medium text-sm">{group?.name}</p>
              {currentUserIsCreator && (
                <span className="text-xs font-mono text-accent border border-accent/30 px-1.5 py-0.5 rounded">Creator</span>
              )}
              {currentUserIsAdmin && !currentUserIsCreator && (
                <span className="text-xs font-mono text-warn border border-warn/30 px-1.5 py-0.5 rounded">Admin</span>
              )}
            </div>
            <p className="text-text-dim text-xs font-mono">{group?.members?.length} members</p>
          </div>

          {/* Search icon */}
          <button
            onClick={() => { setShowSearch((v) => !v); resetSearch() }}
            className={`p-2 rounded transition-colors ${showSearch ? 'bg-accent-glow text-accent' : 'hover:bg-void text-text-dim hover:text-text'}`}
            title="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Menu */}
          <div className="relative">
            <button onClick={() => setShowMenu((v) => !v)}
              className="p-2 rounded hover:bg-void text-text-dim hover:text-text transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute top-10 right-0 w-52 panel border border-border z-20 py-1">
                <button onClick={() => { copyLink(); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors">
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Copied!' : 'Copy Invite Link'}
                </button>
                <button onClick={() => { setSelectedMember(null); setMemberStatus(null); setShowMembersModal(true); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors">
                  <Users className="w-4 h-4" /> Members
                </button>
                {currentUserIsAdmin && (
                  <button onClick={openInviteModal}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors">
                    <UserPlus className="w-4 h-4" /> Invite User
                  </button>
                )}
                {!currentUserIsCreator && (
                  <>
                    <div className="border-t border-border my-1" />
                    <button onClick={() => { handleLeave(); setShowMenu(false) }}
                      disabled={leavingGroup}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-danger hover:bg-danger/10 text-sm font-mono transition-colors disabled:opacity-60">
                      <LogOut className="w-4 h-4" />
                      {leavingGroup ? 'Leaving...' : 'Leave Group'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4" onClick={() => setShowMenu(false)}>
          {messages.length === 0 && (
            <div className="text-center text-text-dim font-mono text-sm mt-8">
              No messages yet. Start the conversation!
            </div>
          )}
          {messages.map((msg) => {
            if (msg._deletedByCreator) {
              return (
                <div key={msg._id} ref={(el) => { if (el) messageRefs.current[msg._id] = el }}>
                  <DeletedByCreatorNotice
                    msg={{ ...msg, _deletedByCreatorName: msg._deletedByCreatorName }}
                    currentUserId={currentUserId}
                  />
                </div>
              )
            }
            return (
              <div
                key={msg._id}
                ref={(el) => { if (el) messageRefs.current[msg._id] = el }}
                className={`rounded-lg transition-all duration-500 ${
                  highlightedMessageId === msg._id
                    ? 'outline outline-2 outline-accent/60 bg-accent/5 shadow-glow-sm'
                    : ''
                }`}
              >
                <GroupMsg
                  msg={msg}
                  currentUserId={currentUserId}
                  isCurrentUserCreator={currentUserIsCreator}
                  onEdit={startEdit}
                  onDeleteMe={deleteForMe}
                  onDeleteEveryone={deleteForEveryone}
                  editingId={editingId}
                  editText={editText}
                  setEditText={setEditText}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                />
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border px-6 py-4 bg-panel">
          <form onSubmit={sendMessage} className="flex gap-3 items-center">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="input-field flex-1"
            />
            <button type="submit" disabled={!input.trim()}
              className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-glow-sm">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* ── Search Panel (right-side drawer) ── */}
      {showSearch && (
        <div className="fixed inset-0 z-40 flex pointer-events-none">
          <div
            className="flex-1 pointer-events-auto"
            onClick={() => setShowSearch(false)}
          />
          <div className="w-80 bg-panel border-l border-border flex flex-col h-full shadow-panel pointer-events-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-accent" />
                <h3 className="text-text font-mono text-sm font-semibold">Search Messages</h3>
              </div>
              <button onClick={() => setShowSearch(false)}
                className="text-muted hover:text-text transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-border shrink-0">
              {[
                { key: 'keyword', label: 'Keyword' },
                { key: 'username', label: 'Member' },
                { key: 'date', label: 'Date' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setSearchTab(tab.key); setSearchResults([]); setSearchDone(false) }}
                  className={`flex-1 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                    searchTab === tab.key
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-dim hover:text-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 border-b border-border shrink-0">
              {searchTab === 'keyword' && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. project"
                    className="input-field flex-1 text-sm"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !keyword.trim()}
                    className="px-3 py-2 rounded bg-accent text-void hover:bg-accent-dim transition-colors disabled:opacity-40 shrink-0"
                  >
                    {searchLoading
                      ? <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                      : <Search className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {searchTab === 'username' && (
                <div className="space-y-2">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="">Select a member...</option>
                    {group?.members?.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name}{m._id?.toString() === currentUserId ? ' (you)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !selectedMemberId}
                    className="btn-primary w-full py-2 text-sm disabled:opacity-40"
                  >
                    {searchLoading ? 'Searching...' : 'Search Messages'}
                  </button>
                </div>
              )}

              {searchTab === 'date' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-1">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-1">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="input-field w-full text-sm"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={searchLoading || !dateFrom || !dateTo}
                    className="btn-primary w-full py-2 text-sm disabled:opacity-40"
                  >
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {searchLoading && (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!searchLoading && searchDone && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-muted mx-auto mb-2" />
                  <p className="text-text-dim text-xs font-mono">No messages found.</p>
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <>
                  <p className="text-text-dim text-xs font-mono mb-3 px-1">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                    <span className="text-accent/60 ml-1">· Click to jump</span>
                  </p>
                  {searchResults.map((msg) => (
                    <SearchResultCard
                      key={msg._id}
                      msg={msg}
                      searchTab={searchTab}
                      keyword={keyword}
                      onClick={() => handleResultClick(msg._id)}
                    />
                  ))}
                </>
              )}

              {!searchLoading && !searchDone && (
                <div className="text-center py-8">
                  <p className="text-text-dim text-xs font-mono opacity-60">
                    {searchTab === 'keyword' && 'Type a keyword and press Search'}
                    {searchTab === 'username' && 'Select a member and press Search'}
                    {searchTab === 'date' && 'Select a date range and press Search'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && (
        <Modal onClose={() => { setShowMembersModal(false); setSelectedMember(null); setMemberStatus(null) }}>
          {selectedMember ? (
            <div>
              <button
                onClick={() => { setSelectedMember(null); setMemberStatus(null); setRequestError('') }}
                className="flex items-center gap-1 text-text-dim text-xs font-mono mb-4 hover:text-text transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to members
              </button>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-xl mx-auto mb-3">
                  {selectedMember.name?.slice(0, 2).toUpperCase()}
                </div>
                <p className="text-text font-semibold text-lg">{selectedMember.name}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  {(group?.createdBy?._id?.toString() || group?.createdBy?.toString()) === selectedMember._id?.toString() && (
                    <span className="flex items-center gap-1 text-xs font-mono text-accent">
                      <Crown className="w-3 h-3" /> Creator
                    </span>
                  )}
                  {group?.admins?.some((a) => (a._id?.toString() || a.toString()) === selectedMember._id?.toString()) &&
                    (group?.createdBy?._id?.toString() || group?.createdBy?.toString()) !== selectedMember._id?.toString() && (
                      <span className="flex items-center gap-1 text-xs font-mono text-warn">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                </div>
              </div>
              {requestError && (
                <div className="bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 mb-3 font-mono text-xs text-center">
                  {requestError}
                </div>
              )}
              {renderMemberActionButton()}

              {/* Remove Member button — admins/creator only, not on self, not on creator */}
              {currentUserIsAdmin &&
                selectedMember._id?.toString() !== currentUserId &&
                (group?.createdBy?._id?.toString() || group?.createdBy?.toString()) !== selectedMember._id?.toString() && (
                  <button
                    onClick={() => handleRemoveMember(selectedMember._id)}
                    disabled={removingMember === selectedMember._id}
                    className="w-full mt-3 py-2.5 rounded border border-danger/30 bg-danger/10 text-danger font-mono text-sm hover:bg-danger/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    <UserMinus className="w-4 h-4" />
                    {removingMember === selectedMember._id ? 'Removing...' : 'Remove from Group'}
                  </button>
                )}

              <p className="text-text-dim text-xs font-mono text-center mt-3 opacity-60">
                Consent required for private messaging
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-text font-semibold text-lg mb-1">Members</h3>
              <p className="text-text-dim text-xs font-mono mb-4">Click a member to interact privately</p>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {group?.members?.map((member) => {
                  const mId = member._id?.toString()
                  const isMe = mId === currentUserId
                  const mIsCreator = (group.createdBy?._id?.toString() || group.createdBy?.toString()) === mId
                  const mIsAdmin = group.admins?.some((a) => (a._id?.toString() || a.toString()) === mId)
                  return (
                    <div key={mId} onClick={() => !isMe && handleMemberClick(member)}
                      className={`flex items-center gap-3 p-2.5 rounded transition-colors ${isMe ? 'opacity-50' : 'hover:bg-void/60 cursor-pointer'}`}>
                      <div className="w-8 h-8 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-xs shrink-0">
                        {member.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-text text-sm flex-1">
                        {member.name} {isMe && <span className="text-text-dim text-xs">(you)</span>}
                      </span>
                      {mIsCreator && <Crown className="w-3.5 h-3.5 text-accent shrink-0" />}
                      {mIsAdmin && !mIsCreator && <Shield className="w-3.5 h-3.5 text-warn shrink-0" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <h3 className="text-text font-semibold text-lg mb-4">Invite User</h3>
          {connections.length === 0 ? (
            <p className="text-text-dim font-mono text-sm text-center py-4">
              No connected users available to invite.
            </p>
          ) : (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div key={conn.userId} className="flex items-center gap-3 p-2 rounded hover:bg-void/40">
                  <div className="w-8 h-8 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-xs">
                    {conn.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-text text-sm flex-1">{conn.name}</span>
                  <button onClick={() => handleInvite(conn.userId)} disabled={invitingUser === conn.userId}
                    className="text-xs font-mono text-accent border border-accent/30 px-2 py-1 rounded hover:bg-accent-glow transition-all disabled:opacity-60">
                    {invitingUser === conn.userId ? 'Sending...' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </AppLayout>
  )
}