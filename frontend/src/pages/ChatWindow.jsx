import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import ImageCropModal from '../components/ImageCropModal'
import {
  Send, ShieldOff, Settings2, Clock, MoreVertical,
  X, Check, CheckCheck, AlertTriangle, AlertCircle, Ban,
  Pencil, Trash2, MoreHorizontal, Mic, Square, Play, Pause, Trash,
  ImageIcon, ZoomIn, Bot, Sparkles,
} from 'lucide-react'

// ── Date helpers ────────────────────────────────────────────────
function getDateLabel(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = (startOfDay(now) - startOfDay(date)) / (1000 * 60 * 60 * 24)
  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric',
  })
}

function isSameDay(d1, d2) {
  const a = new Date(d1), b = new Date(d2)
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function DateSeparator({ label }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 rounded-full bg-panel border border-border text-text-dim text-xs font-mono">
        {label}
      </span>
    </div>
  )
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Image Lightbox ────────────────────────────────────────────
function ImageLightbox({ src, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button onClick={onClose} className="absolute top-4 right-4 text-white hover:text-gray-300">
        <X className="w-6 h-6" />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ── Image Bubble ──────────────────────────────────────────────
function ImageBubble({ src }) {
  const [lightbox, setLightbox] = useState(false)
  return (
    <>
      <div
        className="relative cursor-pointer group/img"
        onClick={() => setLightbox(true)}
      >
        <img
          src={src}
          alt="Image message"
          className="max-w-[220px] max-h-[220px] rounded-lg object-cover border border-white/10"
        />
        <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 rounded-lg transition-all flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
        </div>
      </div>
      {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
    </>
  )
}

// ── Voice Message Bubble ──────────────────────────────────────
function VoiceBubble({ msg, isMe }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const duration = msg.audioDuration || 0

  const togglePlay = () => {
    if (!audioRef.current) return
    playing ? audioRef.current.pause() : audioRef.current.play()
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={msg.audioUrl} preload="metadata" />
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          isMe ? 'bg-void/20 hover:bg-void/30' : 'bg-accent/15 hover:bg-accent/25'
        }`}
      >
        {playing
          ? <Pause className={`w-4 h-4 ${isMe ? 'text-void' : 'text-accent'}`} />
          : <Play className={`w-4 h-4 ${isMe ? 'text-void' : 'text-accent'}`} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${isMe ? 'bg-void/20' : 'bg-border'}`}>
          <div
            className={`h-full rounded-full transition-all ${isMe ? 'bg-void' : 'bg-accent'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-xs mt-1 font-mono ${isMe ? 'text-void/70' : 'text-text-dim'}`}>
          {formatDuration(playing || currentTime > 0 ? currentTime : duration)}
        </p>
      </div>
    </div>
  )
}

// ── Action menu ──────────────────────────────────────────────────
function MessageActionMenu({ isMe, isVoice, isImage, onEdit, onDeleteMe, onDeleteEveryone, onAnalyzeScam, onClose, anchorRect }) {
  const menuRef = useRef(null)
  const [style, setStyle] = useState({ top: 0, left: 0, visibility: 'hidden' })

  useEffect(() => {
    if (!anchorRect || !menuRef.current) return
    const menuWidth = menuRef.current.offsetWidth || 192
    const menuHeight = menuRef.current.offsetHeight || 120
    const gap = 6

    let left = isMe
      ? anchorRect.left - menuWidth - gap
      : anchorRect.right + gap

    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))

    let top = anchorRect.top
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8))

    setStyle({ top, left, visibility: 'visible' })
  }, [anchorRect, isMe])

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: style.top, left: style.left, visibility: style.visibility }}
      className="z-50 w-48 panel border border-border py-1 shadow-modal"
      onClick={(e) => e.stopPropagation()}
    >
      {isMe && !isVoice && !isImage && (
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
      {isMe && (
        <button
          onClick={() => { onDeleteEveryone(); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-danger hover:bg-danger/10 text-xs font-mono transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
        </button>
      )}
      <button
        onClick={() => { onAnalyzeScam(); onClose() }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-warn hover:bg-warn/10 text-xs font-mono transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5" /> Check for Scam
      </button>
    </div>
  )
}

function Message({
  msg, currentUserId, onEdit, onDeleteMe, onDeleteEveryone,
  editingId, editText, setEditText, onSaveEdit, onCancelEdit,
}) {
  const senderId =
    typeof msg.senderId === 'object'
      ? msg.senderId?._id?.toString()
      : msg.senderId?.toString()

  const isMe = senderId === currentUserId
  const isVoice = msg.messageType === 'voice'
  const isImage = msg.messageType === 'image'
  const [showMenu, setShowMenu] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const triggerRef = useRef(null)
  const isEditing = editingId === msg._id

  const [scamResult, setScamResult] = useState(null)
  const [scamLoading, setScamLoading] = useState(false)

  const analyzeScam = async () => {
    setScamLoading(true)
    setScamResult(null)
    try {
      const { data } = await api.post('/chat/analyze-scam', { messageId: msg._id })
      setScamResult(data)
    } catch (err) {
      setScamResult({ scamScore: 0, category: 'error', reason: 'Failed to analyze.', advice: null })
    } finally {
      setScamLoading(false)
    }
  }

  const openMenu = (e) => {
    e.stopPropagation()
    const rect = triggerRef.current?.getBoundingClientRect()
    setAnchorRect(rect)
    setShowMenu((v) => !v)
  }

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3 group`}>
      <div className="relative max-w-xs lg:max-w-sm">
        <div className={`${isImage ? 'p-1' : 'px-4 py-2.5'} rounded-lg text-sm font-mono leading-relaxed ${
          isMe
            ? 'bg-accent text-void rounded-br-sm'
            : 'bg-panel border border-border text-text rounded-bl-sm'
        }`}>
          {isEditing ? (
            <div className="space-y-2 px-3 py-1">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit()
                  if (e.key === 'Escape') onCancelEdit()
                }}
                autoFocus
                className="w-full bg-void border border-border rounded px-2 py-1 text-sm outline-none text-text"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={onCancelEdit} className={`text-xs opacity-80 hover:opacity-100 ${isMe ? 'text-void' : 'text-text-dim'}`}>Cancel</button>
                <button onClick={onSaveEdit} className={`text-xs font-semibold hover:underline ${isMe ? 'text-void' : 'text-text'}`}>Save</button>
              </div>
            </div>
          ) : isImage ? (
            <div>
              <ImageBubble src={msg.imageUrl} />
              <div className={`flex items-center justify-end gap-1 mt-1 px-2 pb-1 text-xs ${isMe ? 'text-void/60' : 'text-text-dim'}`}>
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isMe && (msg.seen ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
              </div>
            </div>
          ) : isVoice ? (
            <>
              <VoiceBubble msg={msg} isMe={isMe} />
              <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isMe ? 'text-void/60' : 'text-text-dim'}`}>
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isMe && (msg.seen ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
              </div>
            </>
          ) : (
            <>
              <p>{msg.text}</p>
              {/* Auto scam alert (from real-time socket) */}
              {msg.scamAlert && (
                <div className="mt-2 px-2 py-1.5 bg-danger/20 border border-danger/40 rounded text-xs font-mono text-danger flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>⚠️ Scam Warning ({msg.scamAlert.score}% risk) — {msg.scamAlert.reason}</span>
                </div>
              )}
              <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${isMe ? 'text-void/60' : 'text-text-dim'}`}>
                <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {isMe && (msg.seen ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />)}
              </div>
            </>
          )}

          {/* Manual scam check loading */}
          {scamLoading && (
            <div className="mt-2 px-3 py-2 bg-panel border border-border rounded text-xs font-mono text-text-dim flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Analyzing message...
            </div>
          )}

          {/* Manual scam check result */}
          {scamResult && !scamLoading && (
            <div className={`mt-2 px-3 py-2.5 rounded border text-xs font-mono space-y-1.5 ${
              scamResult.scamScore >= 61
                ? 'bg-danger/15 border-danger/40 text-danger'
                : scamResult.scamScore >= 35
                ? 'bg-warn/15 border-warn/40 text-warn'
                : 'bg-success/15 border-success/40 text-success'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {scamResult.scamScore >= 61
                    ? '🚨 High Scam Risk'
                    : scamResult.scamScore >= 35
                    ? '⚠️ Suspicious'
                    : scamResult.scamScore >= 25
                    ? '🟡 Unlikely Scam'
                    : '✅ Not a Scam'}
                </span>
                <span className="font-bold">{scamResult.scamScore}%</span>
              </div>
              <p className="text-xs opacity-90">{scamResult.reason}</p>
              {scamResult.advice && (
                <p className="text-xs opacity-80 border-t border-current/20 pt-1.5">
                  💡 {scamResult.advice}
                </p>
              )}
              <button
                onClick={() => setScamResult(null)}
                className="text-xs opacity-60 hover:opacity-100 mt-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {!isEditing && (
          <button
            ref={triggerRef}
            onClick={openMenu}
            className={`absolute top-0 ${isMe ? '-left-7' : '-right-7'} opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-text hover:bg-void transition-opacity`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}

        {showMenu && (
          <MessageActionMenu
            isMe={isMe}
            isVoice={isVoice}
            isImage={isImage}
            anchorRect={anchorRect}
            onEdit={() => onEdit(msg)}
            onDeleteMe={() => onDeleteMe(msg._id)}
            onDeleteEveryone={() => onDeleteEveryone(msg._id)}
            onAnalyzeScam={analyzeScam}
            onClose={() => setShowMenu(false)}
          />
        )}
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
  const { socket, onlineUsers, clearUnread, leaveChat } = useSocket()
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

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedUrl, setRecordedUrl] = useState(null)
  const [recordDuration, setRecordDuration] = useState(0)
  const [sendingVoice, setSendingVoice] = useState(false)
  const mediaRecorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordTimerRef = useRef(null)
  const recordStartRef = useRef(null)

  // Image state
  const [cropSrc, setCropSrc] = useState(null)
  const [selectedImageBlob, setSelectedImageBlob] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null)
  const [sendingImage, setSendingImage] = useState(false)
  const imageInputRef = useRef(null)

  // AI Assistant state
  const [aiAssistantStatus, setAiAssistantStatus] = useState('none')
  const [aiAssistantRequestedBy, setAiAssistantRequestedBy] = useState(null)
  const [requestingAi, setRequestingAi] = useState(false)
  const [respondingAi, setRespondingAi] = useState(false)
  const unreadSnapshotRef = useRef([])

  const [showAskAiModal, setShowAskAiModal] = useState(false)
  const [askQuestion, setAskQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiAnswerLoading, setAiAnswerLoading] = useState(false)
  const [aiAnswerError, setAiAnswerError] = useState('')

  const [showSummaryModal, setShowSummaryModal] = useState(false)
  const [unreadSummary, setUnreadSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  const bottomRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  const currentUserId = String(user?.id || user?._id || '')
  const isOnline = onlineUsers.includes(otherUserId)

  useEffect(() => {
    if (otherUserId) clearUnread(otherUserId)
  }, [otherUserId])

  useEffect(() => {
    return () => {
      leaveChat()
    }
  }, [])

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

        unreadSnapshotRef.current = msgRes.data
          .filter(
            (m) =>
              m.messageType === 'text' &&
              !m.seen &&
              String(m.senderId) === otherUserId
          )
          .map((m) => m._id)

        setMessages(msgRes.data)
        setConnectionId(statusRes.data.connectionId)
        setAiAssistantStatus(statusRes.data.aiAssistantStatus || 'none')
        setAiAssistantRequestedBy(statusRes.data.aiAssistantRequestedBy || null)

        api.put(`/chat/seen-all/${otherUserId}`).catch((err) => console.error('Mark all seen error:', err))

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
        clearUnread(otherUserId)
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
    const handleSeenBulk = ({ messageIds }) => {
      setMessages((prev) =>
        prev.map((m) => (messageIds.includes(m._id.toString()) ? { ...m, seen: true } : m))
      )
    }
    const handleRevoked = ({ by }) => {
      if (by === otherUserId) {
        alert('This connection has been revoked.')
        navigate('/dashboard')
      }
    }
    const handleLimitReached = ({ message }) => setLimitError(message)

    const handleEdited = ({ messageId, text }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, text } : m))
      )
    }
    const handleDeleted = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    }

    const handleAiRequest = ({ by }) => {
      setAiAssistantStatus('pending')
      setAiAssistantRequestedBy(by._id)
    }
    const handleAiResponse = ({ accepted }) => {
      setAiAssistantStatus(accepted ? 'enabled' : 'none')
      if (!accepted) setAiAssistantRequestedBy(null)
    }
    const handleAiDisabled = () => {
      setAiAssistantStatus('none')
      setAiAssistantRequestedBy(null)
    }

    socket.on('receive_message', handleReceive)
    socket.on('message_sent', handleSent)
    socket.on('user_typing', handleTyping)
    socket.on('user_stop_typing', handleStopTyping)
    socket.on('message_seen', handleSeen)
    socket.on('messages_seen_bulk', handleSeenBulk)
    socket.on('connection_revoked', handleRevoked)
    socket.on('message_limit_reached', handleLimitReached)
    socket.on('message_edited', handleEdited)
    socket.on('message_deleted', handleDeleted)
    socket.on('ai_assistant_request', handleAiRequest)
    socket.on('ai_assistant_response', handleAiResponse)
    socket.on('ai_assistant_disabled', handleAiDisabled)

    return () => {
      socket.off('receive_message', handleReceive)
      socket.off('message_sent', handleSent)
      socket.off('user_typing', handleTyping)
      socket.off('user_stop_typing', handleStopTyping)
      socket.off('message_seen', handleSeen)
      socket.off('messages_seen_bulk', handleSeenBulk)
      socket.off('connection_revoked', handleRevoked)
      socket.off('message_limit_reached', handleLimitReached)
      socket.off('message_edited', handleEdited)
      socket.off('message_deleted', handleDeleted)
      socket.off('ai_assistant_request', handleAiRequest)
      socket.off('ai_assistant_response', handleAiResponse)
      socket.off('ai_assistant_disabled', handleAiDisabled)
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

  // ── AI Assistant handlers ───────────────────────────────────────
  const requestAiAssistant = async () => {
    setRequestingAi(true)
    try {
      const { data } = await api.post(`/connections/ai-assistant/request/${otherUserId}`)
      setAiAssistantStatus(data.aiAssistantStatus)
      setAiAssistantRequestedBy(currentUserId)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send request.')
    } finally {
      setRequestingAi(false)
    }
  }

  const respondAiAssistant = async (accept) => {
    setRespondingAi(true)
    try {
      const { data } = await api.post(`/connections/ai-assistant/respond/${otherUserId}`, { accept })
      setAiAssistantStatus(data.aiAssistantStatus)
      if (!accept) setAiAssistantRequestedBy(null)
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond.')
    } finally {
      setRespondingAi(false)
    }
  }

  const disableAiAssistant = async () => {
    try {
      await api.post(`/connections/ai-assistant/disable/${otherUserId}`)
      setAiAssistantStatus('none')
      setAiAssistantRequestedBy(null)
    } catch (err) {
      console.error('Disable AI assistant error:', err)
    }
  }

  const handleAskAi = async () => {
    if (!askQuestion.trim()) return
    setAiAnswerLoading(true)
    setAiAnswerError('')
    setAiAnswer('')
    try {
      const { data } = await api.post(`/chat/${otherUserId}/ask-ai`, { question: askQuestion.trim() })
      setAiAnswer(data.answer)
    } catch (err) {
      setAiAnswerError(err.response?.data?.message || 'Failed to get AI response.')
    } finally {
      setAiAnswerLoading(false)
    }
  }

  const handleSummarizeUnread = async () => {
    setShowSummaryModal(true)
    setSummaryLoading(true)
    setSummaryError('')
    setUnreadSummary('')

    if (unreadSnapshotRef.current.length === 0) {
      setSummaryLoading(false)
      setSummaryError('No unread messages to summarize.')
      return
    }

    try {
      const { data } = await api.post(`/chat/${otherUserId}/summarize-unread`, {
        messageIds: unreadSnapshotRef.current,
      })
      setUnreadSummary(data.summary)
    } catch (err) {
      setSummaryError(err.response?.data?.message || 'Failed to generate summary.')
    } finally {
      setSummaryLoading(false)
    }
  }

  // ── Image handlers ────────────────────────────────────────────
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }
    setCropSrc(URL.createObjectURL(file))
  }

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const confirmCrop = (blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setSelectedImageBlob(blob)
    setImagePreviewUrl(URL.createObjectURL(blob))
  }

  const cancelSelectedImage = () => {
    setSelectedImageBlob(null)
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const sendImageMessage = async () => {
    if (!selectedImageBlob) return
    setSendingImage(true)
    try {
      const file = new File([selectedImageBlob], 'image.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('image', file)
      formData.append('receiverId', otherUserId)

      const { data } = await api.post('/chat/send-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setMessages((prev) => [...prev, data])
      cancelSelectedImage()
    } catch (err) {
      console.error('Send image error:', err)
      setLimitError(err.response?.data?.message || 'Failed to send image.')
    } finally {
      setSendingImage(false)
    }
  }

  // ── Voice handlers ────────────────────────────────────────────
  const startRecording = async () => {
    if (!canSend) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      recordedChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' })
        setRecordedBlob(blob)
        setRecordedUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      recordStartRef.current = Date.now()
      setRecordDuration(0)
      recordTimerRef.current = setInterval(() => {
        setRecordDuration(Math.floor((Date.now() - recordStartRef.current) / 1000))
      }, 200)
    } catch (err) {
      console.error('Microphone access error:', err)
      alert('Could not access microphone. Please allow microphone permission.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      clearInterval(recordTimerRef.current)
    }
  }

  const cancelRecordedVoice = () => {
    setRecordedBlob(null)
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedUrl(null)
    setRecordDuration(0)
  }

  const sendVoiceMessage = async () => {
    if (!recordedBlob) return
    setSendingVoice(true)
    try {
      const formData = new FormData()
      formData.append('audio', recordedBlob, 'voice-message.webm')
      formData.append('receiverId', otherUserId)
      formData.append('duration', recordDuration)

      const { data } = await api.post('/chat/send-voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setMessages((prev) => [...prev, data])
      cancelRecordedVoice()
    } catch (err) {
      console.error('Send voice message error:', err)
      setLimitError(err.response?.data?.message || 'Failed to send voice message.')
    } finally {
      setSendingVoice(false)
    }
  }

  useEffect(() => {
    return () => {
      clearInterval(recordTimerRef.current)
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      if (cropSrc) URL.revokeObjectURL(cropSrc)
    }
  }, [])

  // ── Edit / Delete handlers ─────────────────────────────────
  const startEdit = (msg) => {
    if (msg.messageType !== 'text') return
    setEditingId(msg._id)
    setEditText(msg.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async () => {
    if (!editText.trim() || !editingId) return
    try {
      await api.put(`/chat/edit/${editingId}`, { text: editText.trim() })
      setMessages((prev) =>
        prev.map((m) => (m._id === editingId ? { ...m, text: editText.trim() } : m))
      )
    } catch (err) {
      console.error('Edit error:', err)
    } finally {
      cancelEdit()
    }
  }

  const deleteForMe = async (messageId) => {
    try {
      await api.delete(`/chat/${messageId}?for=me`)
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    } catch (err) {
      console.error('Delete for me error:', err)
    }
  }

  const deleteForEveryone = async (messageId) => {
    try {
      await api.delete(`/chat/${messageId}?for=everyone`)
      setMessages((prev) => prev.filter((m) => m._id !== messageId))
    } catch (err) {
      console.error('Delete for everyone error:', err)
    }
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
            {otherUser?.avatarUrl ? (
              <img
                src={otherUser.avatarUrl}
                alt={otherUser.name}
                className="w-10 h-10 rounded-full object-cover border border-accent/30"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-sm">
                {otherUser?.name.slice(0, 2).toUpperCase()}
              </div>
            )}
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
              {aiAssistantStatus === 'enabled' && (
                <span className="tag text-xs text-accent border-accent/30 bg-accent/10 flex items-center gap-1">
                  <Bot className="w-3 h-3" /> AI
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
              <div className="absolute top-10 right-0 w-56 panel border border-border z-20 py-1">
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

                {aiAssistantStatus === 'none' && (
                  <button
                    onClick={() => { requestAiAssistant(); setShowMenu(false) }}
                    disabled={requestingAi}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors disabled:opacity-60"
                  >
                    <Bot className="w-4 h-4" />
                    {requestingAi ? 'Sending...' : 'Enable AI Assistant'}
                  </button>
                )}
                {aiAssistantStatus === 'enabled' && (
                  <>
                    <button
                      onClick={() => {
                        setShowAskAiModal(true)
                        setAskQuestion('')
                        setAiAnswer('')
                        setAiAnswerError('')
                        setShowMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors"
                    >
                      <Sparkles className="w-4 h-4" /> Ask AI About This Chat
                    </button>
                    <button
                      onClick={() => { handleSummarizeUnread(); setShowMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-text-dim hover:text-text hover:bg-void text-sm font-mono transition-colors"
                    >
                      <Sparkles className="w-4 h-4" /> Summarize Unread Messages
                    </button>
                    <button
                      onClick={() => { disableAiAssistant(); setShowMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-danger hover:bg-danger/10 text-sm font-mono transition-colors"
                    >
                      <Bot className="w-4 h-4" /> Disable AI Assistant
                    </button>
                  </>
                )}

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

        {/* AI Assistant request banners */}
        {aiAssistantStatus === 'pending' && aiAssistantRequestedBy && String(aiAssistantRequestedBy) !== currentUserId && (
          <div className="shrink-0 mx-6 mt-4 flex items-center justify-between gap-3 bg-accent/10 border border-accent/30 text-accent rounded px-4 py-2.5 font-mono text-xs">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 shrink-0" />
              <span>{otherUser?.name} wants to enable AI Assistant for this chat.</span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => respondAiAssistant(true)}
                disabled={respondingAi}
                className="px-2.5 py-1 rounded bg-success/15 border border-success/30 text-success hover:bg-success/25 transition-colors disabled:opacity-60"
              >
                Accept
              </button>
              <button
                onClick={() => respondAiAssistant(false)}
                disabled={respondingAi}
                className="px-2.5 py-1 rounded bg-danger/15 border border-danger/30 text-danger hover:bg-danger/25 transition-colors disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </div>
        )}
        {aiAssistantStatus === 'pending' && aiAssistantRequestedBy && String(aiAssistantRequestedBy) === currentUserId && (
          <div className="shrink-0 mx-6 mt-4 flex items-center gap-2 bg-warn/10 border border-warn/30 text-warn rounded px-4 py-2.5 font-mono text-xs">
            <Bot className="w-4 h-4 shrink-0" />
            Waiting for {otherUser?.name} to approve AI Assistant...
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
          {messages.map((msg, idx) => {
            const showSeparator =
              idx === 0 || !isSameDay(msg.createdAt, messages[idx - 1].createdAt)
            return (
              <div key={msg._id}>
                {showSeparator && <DateSeparator label={getDateLabel(msg.createdAt)} />}
                <Message
                  msg={msg}
                  currentUserId={currentUserId}
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

          {/* Image preview before send */}
          {selectedImageBlob && (
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-border"
                />
                <button
                  onClick={cancelSelectedImage}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 text-text-dim text-xs font-mono">
                <p>Cropped image ready to send</p>
              </div>
              <button
                onClick={sendImageMessage}
                disabled={sendingImage}
                className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 shrink-0 shadow-glow-sm"
              >
                {sendingImage
                  ? <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
              </button>
            </div>
          )}

          {/* Voice recorded preview */}
          {recordedBlob && !selectedImageBlob ? (
            <div className="flex items-center gap-3">
              <button
                onClick={cancelRecordedVoice}
                className="w-10 h-10 rounded-full flex items-center justify-center text-danger hover:bg-danger/10 transition-colors shrink-0"
              >
                <Trash className="w-4 h-4" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-void border border-border rounded-lg px-4 py-2.5">
                <audio src={recordedUrl} controls className="w-full h-8" />
              </div>
              <button
                onClick={sendVoiceMessage}
                disabled={sendingVoice}
                className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 shrink-0 shadow-glow-sm"
              >
                {sendingVoice
                  ? <div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex items-center gap-3">
              <button
                onClick={stopRecording}
                className="w-11 h-11 rounded-full bg-danger flex items-center justify-center text-white shrink-0 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
              <div className="flex-1 flex items-center gap-2 text-danger font-mono text-sm">
                <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
                Recording... {formatDuration(recordDuration)}
              </div>
            </div>
          ) : !selectedImageBlob ? (
            <form onSubmit={sendMessage} className="flex gap-3 items-center">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => canSend && imageInputRef.current?.click()}
                disabled={!canSend}
                className="w-10 h-10 rounded flex items-center justify-center text-text-dim hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 shrink-0"
                title="Send image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <input
                value={input}
                onChange={handleInputChange}
                placeholder={canSend ? 'Type a message...' : 'Messaging unavailable'}
                className="input-field flex-1"
                disabled={!canSend}
              />
              {input.trim() ? (
                <button
                  type="submit"
                  disabled={!canSend}
                  className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-glow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!canSend}
                  className="w-11 h-11 rounded bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-glow-sm"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
          ) : null}
        </div>
      </div>

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          mode="image"
          onCancel={cancelCrop}
          onConfirm={confirmCrop}
        />
      )}

      {/* Ask AI Modal */}
      {showAskAiModal && (
        <Modal onClose={() => setShowAskAiModal(false)}>
          <h3 className="text-text font-semibold text-lg mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" /> Ask AI
          </h3>
          <p className="text-text-dim text-xs font-mono mb-4">
            Ask about anything discussed in this chat with {otherUser?.name}.
          </p>
          <div className="flex gap-2 mb-4">
            <input
              value={askQuestion}
              onChange={(e) => setAskQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
              placeholder="e.g. what did we decide about the trip?"
              className="input-field flex-1 text-sm"
            />
            <button
              onClick={handleAskAi}
              disabled={aiAnswerLoading || !askQuestion.trim()}
              className="btn-primary px-4 disabled:opacity-40"
            >
              {aiAnswerLoading ? '...' : 'Ask'}
            </button>
          </div>
          {aiAnswerLoading && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {aiAnswerError && <p className="text-danger text-sm font-mono">{aiAnswerError}</p>}
          {aiAnswer && (
            <div className="text-text text-sm font-mono leading-relaxed whitespace-pre-line max-h-80 overflow-y-auto bg-void border border-border rounded-lg p-3">
              {aiAnswer}
            </div>
          )}
        </Modal>
      )}

      {/* Unread Summary Modal */}
      {showSummaryModal && (
        <Modal onClose={() => setShowSummaryModal(false)}>
          <h3 className="text-text font-semibold text-lg mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" /> Unread Summary
          </h3>
          <p className="text-text-dim text-xs font-mono mb-4">
            AI summary of messages from {otherUser?.name} that were unread when you opened this chat
          </p>
          {summaryLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : summaryError ? (
            <p className="text-danger text-sm font-mono text-center py-4">{summaryError}</p>
          ) : (
            <div className="text-text text-sm font-mono leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto">
              {unreadSummary}
            </div>
          )}
        </Modal>
      )}

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