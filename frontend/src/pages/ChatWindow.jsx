import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import {
  Send, ShieldOff, Settings2, Clock, MoreVertical,
  X, Check, CheckCheck, AlertTriangle, AlertCircle, Ban,
} from 'lucide-react'

function Message({ msg, currentUserId }) {
  const senderId =
    typeof msg.senderId === 'object'
      ? msg.senderId?._id?.toString()
      : msg.senderId?.toString()

  const isMe = senderId === currentUserId

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-lg text-sm font-mono leading-relaxed ${
        isMe
          ? 'bg-accent text-void rounded-br-sm'
          : 'bg-panel border border-border text-text rounded-bl-sm'
      }`}>
        <p>{msg.text}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isMe ? 'text-void/60' : 'text-text-dim'}`}>
          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isMe && (msg.seen ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator({ name }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-panel border border-border px-4 py-3 rounded-lg rounded-bl-sm">
        <p className="text-text-dim text-xs font-mono mb-1">{name} is typing...</p>
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot w-2 h-2 rounded-full bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="panel p-6 w-full max-w-sm border border-border relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  )
}

export default function ChatWindow() {
  const { userId: otherUserId } = useParams()
  const { user } = useAuth()
  const { socket, onlineUsers } = useSocket()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [otherUser, setOtherUser] = useState(null)
  const [connectionId, setConnectionId] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showRevokeModal, setShowRevokeModal] = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [showTimedModal, setShowTimedModal] = useState(false)
  const [timedDays, setTimedDays] = useState(null)
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState('')
  const [limitError, setLimitError] = useState('')
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedByThem, setBlockedByThem] = useState(false)
  const [currentLimit, setCurrentLimit] = useState(null)
  const [selectedLimit, setSelectedLimit] = useState(null)
  const [limitLoading, setLimitLoading] = useState(false)
  const [blockPhase, setBlockPhase] = useState('choose')

  const bottomRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // Always string for reliable comparison
  const currentUserId = String(user?.id || user?._id || '')
  const isOnline = onlineUsers.includes(otherUserId)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [msgRes, connRes, statusRes, limitRes, blockRes] = await Promise.all([
          api.get(`/chat/${otherUserId}`),
          api.get('/connections/list'),
          api.get(`/connections/status/${otherUserId}`),
          api.get(`/message-limit/${otherUserId}`),
          api.get(`/block/status/${otherUserId}`),
        ])

        if (statusRes.data.status !== 'connected') {
          setError('You are not connected with this user.')
          setLoading(false)
          return
        }

        setMessages(msgRes.data)
        setConnectionId(statusRes.data.connectionId)
        const conn = connRes.data.find((c) => c.userId.toString() === otherUserId)
        if (conn) setOtherUser(conn)

        if (limitRes.data.hasLimit) {
          setCurrentLimit(limitRes.data)
          setSelectedLimit(limitRes.data.dailyLimit)
        }

        setIsBlocked(blockRes.data.iBlockedThem)
        setBlockedByThem(blockRes.data.theyBlockedMe)
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load chat.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [otherUserId])

  useEffect(() => {
    if (!socket) return

    const handleReceive = (msg) => {
      if (msg.senderId === otherUserId || msg.receiverId === otherUserId) {
        setMessages((prev) => [...prev, msg])
        socket.emit('mark_seen', { messageId: msg._id, senderId: msg.senderId })
      }
    }
    const handleSent = (msg) => {
      setMessages((prev) => [...prev, msg])
      setLimitError('')
    }
    const handleTyping = ({ senderId }) => {
      if (senderId === otherUserId) setIsTyping(true)
    }
    const handleStopTyping = ({ senderId }) => {
      if (senderId === otherUserId) setIsTyping(false)
    }
    const handleSeen = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, seen: true } : m))
      )
    }
    const handleRevoked = ({ by }) => {
      if (by === otherUserId) {
        alert('This connection has been revoked.')
        navigate('/dashboard')
      }
    }
    const handleLimitReached = ({ message }) => setLimitError(message)

    socket.on('receive_message', handleReceive)
    socket.on('message_sent', handleSent)
    socket.on('user_typing', handleTyping)
    socket.on('user_stop_typing', handleStopTyping)
    socket.on('message_seen', handleSeen)
    socket.on('connection_revoked', handleRevoked)
    socket.on('message_limit_reached', handleLimitReached)

    return () => {
      socket.off('receive_message', handleReceive)
      socket.off('message_sent', handleSent)
      socket.off('user_typing', handleTyping)
      socket.off('user_stop_typing', handleStopTyping)
      socket.off('message_seen', handleSeen)
      socket.off('connection_revoked', handleRevoked)
      socket.off('message_limit_reached', handleLimitReached)
    }
  }, [socket, otherUserId, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleInputChange = (e) => {
    setInput(e.target.value)
    setLimitError('')
    if (!socket) return
    socket.emit('typing', { receiverId: otherUserId })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverId: otherUserId })
    }, 1500)
  }

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() || !socket || isBlocked || blockedByThem) return
    socket.emit('send_message', { receiverId: otherUserId, text: input.trim() })
    socket.emit('stop_typing', { receiverId: otherUserId })
    setInput('')
  }

  const handleRevoke = async () => {
    if (!connectionId) return
    setRevoking(true)
    try {
      await api.delete(`/connections/revoke/${connectionId}`)
      if (socket) socket.emit('revoke_connection', { otherUserId })
      navigate('/dashboard', { state: { revokedSuccess: true } })
    } catch (err) {
      console.error('Revoke error:', err)
    } finally {
      setRevoking(false)
      setShowRevokeModal(false)
      setShowBlockModal(false)
    }
  }

  const handleBlock = async () => {
    try {
      await api.post('/block', { blockedUserId: otherUserId })
      setIsBlocked(true)
      setShowBlockModal(false)
    } catch (err) {
      console.error('Block error:', err)
    }
  }

  const handleUnblock = async () => {
    try {
      await api.delete(`/block/${otherUserId}`)
      setIsBlocked(false)
    } catch (err) {
      console.error('Unblock error:', err)
    }
  }

  const handleSaveLimit = async () => {
    setLimitLoading(true)
    try {
      if (selectedLimit === null) {
        await api.delete(`/message-limit/remove/${otherUserId}`)
        setCurrentLimit(null)
      } else {
        const { data } = await api.post('/message-limit/set', {
          targetUserId: otherUserId,
          dailyLimit: selectedLimit,
        })
        setCurrentLimit({
          hasLimit: true,
          dailyLimit: selectedLimit,
          currentCount: data.limit.currentCount,
          remaining: selectedLimit - data.limit.currentCount,
        })
      }
      setShowLimitModal(false)
    } catch (err) {
      console.error('Set limit error:', err)
    } finally {
      setLimitLoading(false)
    }
  }

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
            <button onClick={() => navigate('/chats')} className="btn-ghost">Go Back</button>
          </div>
        </div>
      </AppLayout>
    )
  }

  const canSend = !isBlocked && !blockedByThem && !limitError

  return (
    <AppLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-border px-6 py-4 flex items-center gap-4 bg-panel">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-sm">
              {otherUser?.name.slice(0, 2).toUpperCase()}
            </div>
            {isOnline && !isBlocked && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-panel" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-text font-medium text-sm">{otherUser?.name}</p>
              {isBlocked && (
                <span className="tag text-xs text-danger border-danger/30 bg-danger/10">
                  Blocked
                </span>
              )}
            </div>
            <p className="text-text-dim text-xs font-mono">
              {isBlocked
                ? 'You blocked this user'
                : blockedByThem
                ? 'You are blocked'
                : isOnline
                ? 'Online'
                : 'Offline'}
              {currentLimit && !isBlocked && (
                <span className="ml-2 text-warn">· Limit: {currentLimit.dailyLimit}/day</span>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="p-2 rounded hover:bg-void text-text-dim hover:text-text transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute top-10 right-0 w-52 panel border border-border z-20 py-1">
                {!isBlocked ? (
                  <button
                    onClick={() => { setBlockPhase('choose'); setShowBlockModal(true); setShowMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors"
                  >
                    <Ban className="w-4 h-4" /> Block User
                  </button>
                ) : (
                  <button
                    onClick={() => { handleUnblock(); setShowMenu(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-success hover:bg-success/10 text-sm font-mono transition-colors"
                  >
                    <Ban className="w-4 h-4" /> Unblock User
                  </button>
                )}
                <button
                  onClick={() => { setShowLimitModal(true); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors"
                >
                  <Settings2 className="w-4 h-4" /> Communication Limit
                </button>
                <button
                  onClick={() => { setShowTimedModal(true); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors"
                >
                  <Clock className="w-4 h-4" /> Timed Connection
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={() => { setShowRevokeModal(true); setShowMenu(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-danger hover:bg-danger/10 text-sm font-mono transition-colors"
                >
                  <ShieldOff className="w-4 h-4" /> Revoke Connection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Blocked banner */}
        {(isBlocked || blockedByThem) && (
          <div className="shrink-0 mx-6 mt-4 flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-4 py-2.5 font-mono text-xs">
            <Ban className="w-4 h-4 shrink-0" />
            {isBlocked
              ? 'You have blocked this user. Unblock to send messages.'
              : 'You cannot send messages to this user.'}
          </div>
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4"
          onClick={() => setShowMenu(false)}
        >
          {messages.length === 0 && (
            <div className="text-center text-text-dim font-mono text-sm mt-8">
              No messages yet. Say hello!
            </div>
          )}
          {messages.map((msg) => (
            <Message key={msg._id} msg={msg} currentUserId={currentUserId} />
          ))}
          {isTyping && <TypingIndicator name={otherUser?.name} />}
          <div ref={bottomRef} />
        </div>

        {/* Limit error bar */}
        {limitError && (
          <div className="shrink-0 mx-6 mb-2 flex items-center gap-2 bg-warn/10 border border-warn/30 text-warn rounded px-4 py-2.5 font-mono text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {limitError}
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-border px-6 py-4 bg-panel">
          <form onSubmit={sendMessage} className="flex gap-3 items-center">
            <input
              value={input}
              onChange={handleInputChange}
              placeholder={canSend ? 'Type a message...' : 'Messaging unavailable'}
              className="input-field flex-1"
              disabled={!canSend}
            />
            <button
              type="submit"
              disabled={!input.trim() || !canSend}
              className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-glow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <Modal onClose={() => setShowBlockModal(false)}>
          {blockPhase === 'choose' && (
            <div className="text-center">
              <Ban className="w-10 h-10 text-warn mx-auto mb-4" />
              <h3 className="text-text font-semibold text-lg mb-2">Block {otherUser?.name}?</h3>
              <p className="text-text-dim text-sm font-mono mb-6 leading-relaxed">
                Blocking will stop all messages. Do you also want to permanently revoke this connection?
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleBlock}
                  className="w-full py-3 rounded border border-warn/40 bg-warn/10 text-warn font-mono text-sm hover:bg-warn/20 transition-all"
                >
                  Block Only (keep connection)
                </button>
                <button
                  onClick={() => setBlockPhase('confirm-revoke')}
                  className="w-full py-3 rounded border border-danger/40 bg-danger/10 text-danger font-mono text-sm hover:bg-danger/20 transition-all"
                >
                  Block + Revoke Connection
                </button>
                <button onClick={() => setShowBlockModal(false)} className="btn-ghost w-full">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {blockPhase === 'confirm-revoke' && (
            <div className="text-center">
              <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-4" />
              <h3 className="text-text font-semibold text-lg mb-2">Are you sure?</h3>
              <p className="text-text-dim text-sm font-mono mb-6 leading-relaxed">
                This will permanently revoke the connection with{' '}
                <span className="text-accent">{otherUser?.name}</span>.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setBlockPhase('choose')} className="btn-ghost flex-1">
                  Go Back
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="btn-danger flex-1 disabled:opacity-60"
                >
                  {revoking ? 'Revoking...' : 'Yes, Revoke'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Revoke Modal */}
      {showRevokeModal && (
        <Modal onClose={() => setShowRevokeModal(false)}>
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-danger mx-auto mb-4" />
            <h3 className="text-text font-semibold text-lg mb-2">Are you sure?</h3>
            <p className="text-text-dim text-sm font-mono mb-6 leading-relaxed">
              This will permanently remove your connection with{' '}
              <span className="text-accent">{otherUser?.name}</span>.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowRevokeModal(false)} className="btn-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="btn-danger flex-1 disabled:opacity-60"
              >
                {revoking ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Message Limit Modal */}
      {showLimitModal && (
        <Modal onClose={() => setShowLimitModal(false)}>
          <h3 className="text-text font-semibold text-lg mb-1">Set Daily Message Limit</h3>
          <p className="text-text-dim text-sm font-mono mb-2">
            Limit how many messages{' '}
            <span className="text-accent">{otherUser?.name}</span> can send per day.
          </p>
          {currentLimit && (
            <p className="text-warn text-xs font-mono mb-4">
              Current: {currentLimit.dailyLimit}/day · Used: {currentLimit.currentCount}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[10, 20, 30, 50].map((limit) => (
              <button
                key={limit}
                onClick={() => setSelectedLimit(limit)}
                className={`py-3 rounded font-mono text-sm border transition-all ${
                  selectedLimit === limit
                    ? 'bg-accent-glow border-accent text-accent'
                    : 'border-border text-text-dim hover:border-accent/40'
                }`}
              >
                {limit}/day
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedLimit(null)}
            className={`w-full py-2.5 rounded font-mono text-sm border transition-all mb-4 ${
              selectedLimit === null
                ? 'bg-danger/10 border-danger text-danger'
                : 'border-border text-text-dim hover:border-danger/40'
            }`}
          >
            Remove Limit
          </button>
          <button
            onClick={handleSaveLimit}
            disabled={limitLoading}
            className="btn-primary w-full disabled:opacity-60"
          >
            {limitLoading ? 'Saving...' : 'Save Limit'}
          </button>
        </Modal>
      )}

      {/* Timed Connection Modal */}
      {showTimedModal && (
        <Modal onClose={() => setShowTimedModal(false)}>
          <h3 className="text-text font-semibold text-lg mb-1">Timed Connection</h3>
          <p className="text-text-dim text-sm font-mono mb-6">
            Set an expiry for this connection
          </p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[7, 15, 30, 60, 90, null].map((days) => (
              <button
                key={days ?? 'none'}
                onClick={() => setTimedDays(days)}
                className={`py-2.5 rounded font-mono text-sm border transition-all ${
                  timedDays === days
                    ? 'bg-warn/10 border-warn text-warn'
                    : 'border-border text-text-dim hover:border-warn/40'
                }`}
              >
                {days === null ? 'Permanent' : `${days} days`}
              </button>
            ))}
          </div>
          <button onClick={() => setShowTimedModal(false)} className="btn-primary w-full">
            Apply
          </button>
        </Modal>
      )}
    </AppLayout>
  )
}