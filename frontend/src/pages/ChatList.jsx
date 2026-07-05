import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useSocket } from '../context/SocketContext'
import AvatarViewerModal from '../components/AvatarViewerModal'
import { MessageSquare, ShieldOff } from 'lucide-react'

function formatChatTime(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const sameYear = date.getFullYear() === now.getFullYear()
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  })
}

function getPreviewText(lastMessage) {
  if (!lastMessage) return 'No messages yet'
  const prefix = lastMessage.fromMe ? 'You: ' : ''
  if (lastMessage.messageType === 'voice') return `${prefix}🎤 Voice message`
  if (lastMessage.messageType === 'image') return `${prefix}📷 Photo`
  return `${prefix}${lastMessage.text}`
}

function sortByRecent(list) {
  return [...list].sort((a, b) => {
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt) : new Date(a.connectedAt)
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt) : new Date(b.connectedAt)
    return bTime - aTime
  })
}

export default function ChatList() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewerAvatar, setViewerAvatar] = useState(null)
  const { socket, onlineUsers, clearUnread } = useSocket()

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const { data } = await api.get('/connections/list')
        setConnections(sortByRecent(data))
      } catch (err) {
        console.error('Failed to fetch connections:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchConnections()
  }, [])

  // Real-time updates: new incoming/outgoing messages update preview, unread count & order
  useEffect(() => {
    if (!socket) return

    const handleReceive = (msg) => {
      const senderId = typeof msg.senderId === 'object'
        ? msg.senderId?._id?.toString()
        : msg.senderId?.toString()

      setConnections((prev) => {
        const updated = prev.map((c) => {
          if (c.userId?.toString() !== senderId) return c
          return {
            ...c,
            lastMessage: {
              text: msg.text,
              messageType: msg.messageType,
              fromMe: false,
              createdAt: msg.createdAt,
            },
            unreadCount: (c.unreadCount || 0) + 1,
          }
        })
        return sortByRecent(updated)
      })
    }

    const handleSent = (msg) => {
      const receiverId = msg.receiverId?.toString()

      setConnections((prev) => {
        const updated = prev.map((c) => {
          if (c.userId?.toString() !== receiverId) return c
          return {
            ...c,
            lastMessage: {
              text: msg.text,
              messageType: msg.messageType,
              fromMe: true,
              createdAt: msg.createdAt,
            },
          }
        })
        return sortByRecent(updated)
      })
    }

    socket.on('receive_message', handleReceive)
    socket.on('message_sent', handleSent)

    return () => {
      socket.off('receive_message', handleReceive)
      socket.off('message_sent', handleSent)
    }
  }, [socket])

  const openAvatarViewer = (e, conn) => {
    if (!conn.avatarUrl) return
    e.preventDefault()
    e.stopPropagation()
    setViewerAvatar({ src: conn.avatarUrl, name: conn.name })
  }

  const handleChatClick = (userId) => {
    clearUnread(userId)
    setConnections((prev) =>
      prev.map((c) =>
        c.userId?.toString() === userId?.toString() ? { ...c, unreadCount: 0 } : c
      )
    )
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Chats</h1>
          <p className="text-text-dim text-sm font-mono">
            {connections.length} active connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="panel p-12 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : connections.length === 0 ? (
          <div className="panel p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-text-dim font-mono text-sm">No active chats yet</p>
            <p className="text-text-dim text-xs font-mono mt-1 opacity-60">
              Generate or enter an invite code to connect
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => {
              const isOnline = onlineUsers.includes(conn.userId?.toString())
              const unreadCount = conn.unreadCount || 0
              const hasUnread = unreadCount > 0
              const timeSource = conn.lastMessage?.createdAt || conn.connectedAt

              return (
                <Link
                  key={conn.userId}
                  to={`/chat/${conn.userId}`}
                  onClick={() => handleChatClick(conn.userId)}
                  className="panel p-4 flex items-center gap-4 hover:border-accent/20 transition-all duration-200 border border-transparent cursor-pointer group"
                >
                  <div className="relative shrink-0" onClick={(e) => openAvatarViewer(e, conn)}>
                    {conn.avatarUrl ? (
                      <img
                        src={conn.avatarUrl}
                        alt={conn.name}
                        className="w-12 h-12 rounded-full object-cover border border-accent/25"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-mono font-bold text-accent">
                        {conn.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-panel shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium text-sm truncate">
                      {conn.name}{' '}
                      <span className="text-text-dim text-xs font-mono font-normal">
                        ({isOnline ? 'Online' : 'Offline'})
                      </span>
                    </p>
                    <p className="text-text-dim text-xs font-mono truncate mt-0.5">
                      {getPreviewText(conn.lastMessage)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-xs font-mono ${hasUnread ? 'text-green-500 font-semibold' : 'text-text-dim'}`}>
                      {formatChatTime(timeSource)}
                    </span>
                    {hasUnread && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] flex items-center justify-center text-white text-[11px] font-bold font-mono">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <div className="mt-8 flex items-start gap-3 p-4 rounded-xl border border-border">
          <ShieldOff className="w-4 h-4 text-muted shrink-0 mt-0.5" />
          <p className="text-text-dim text-xs font-mono leading-relaxed">
            You can revoke any connection at any time from inside the chat window.
          </p>
        </div>
      </div>

      {viewerAvatar && (
        <AvatarViewerModal
          src={viewerAvatar.src}
          name={viewerAvatar.name}
          onClose={() => setViewerAvatar(null)}
        />
      )}
    </AppLayout>
  )
}