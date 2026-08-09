import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()

  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [unreadChats, setUnreadChats] = useState({})
  const [unreadGroups, setUnreadGroups] = useState({})

  // ✅ NEW: Track which chat/group is currently active
  const activeChatRef = useRef(null)
  const activeGroupRef = useRef(null)

  const socketRef = useRef(null)

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }
      setSocket(null)
      setOnlineUsers([])
      setUnreadChats({})
      setUnreadGroups({})
      return
    }

    const token = sessionStorage.getItem('token')
    if (!token) {
      console.warn('⚠️ No token found for socket connection')
      return
    }

    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const s = io(import.meta.env.VITE_API_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => console.log('✅ Socket connected:', s.id))
    s.on('disconnect', (reason) => console.log('❌ Socket disconnected:', reason))
    s.on('connect_error', (err) => console.error('❌ Socket connection error:', err.message))

    s.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => prev.includes(userId) ? prev : [...prev, userId])
    })

    s.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId))
    })

    // ✅ FIX: Only increment unread if NOT currently viewing that chat
    s.on('receive_message', (msg) => {
      const senderId = typeof msg.senderId === 'object'
        ? msg.senderId?._id?.toString()
        : msg.senderId?.toString()

      if (senderId && activeChatRef.current !== senderId) {
        setUnreadChats((prev) => ({
          ...prev,
          [senderId]: (prev[senderId] || 0) + 1
        }))
      }
    })

    // ✅ FIX: Only increment unread if NOT currently viewing that group
    s.on('receive_group_message', (msg) => {
      const groupId = typeof msg.groupId === 'object'
        ? msg.groupId?._id?.toString()
        : msg.groupId?.toString()

      const senderId = typeof msg.senderId === 'object'
        ? msg.senderId?._id?.toString()
        : msg.senderId?.toString()

      const currentUserId = String(user?.id || user?._id || '')
      if (groupId && senderId !== currentUserId && activeGroupRef.current !== groupId) {
        setUnreadGroups((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] || 0) + 1
        }))
      }
    })

    return () => {
      if (s) {
        s.removeAllListeners()
        s.disconnect()
      }
      socketRef.current = null
      setSocket(null)
      setOnlineUsers([])
      setUnreadChats({})
      setUnreadGroups({})
    }
  }, [user])

  const clearUnread = (userId) => {
    // ✅ FIX: Set active chat so incoming messages don't increment
    activeChatRef.current = userId
    setUnreadChats((prev) => {
      if (!prev[userId]) return prev
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  const clearUnreadGroup = (groupId) => {
    // ✅ FIX: Set active group so incoming messages don't increment
    activeGroupRef.current = groupId
    setUnreadGroups((prev) => {
      if (!prev[groupId]) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  // ✅ NEW: Call when leaving a chat/group page
  const leaveChat = () => {
    activeChatRef.current = null
  }

  const leaveGroup = () => {
    activeGroupRef.current = null
  }

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      unreadChats,
      clearUnread,
      unreadGroups,
      clearUnreadGroup,
      leaveChat,
      leaveGroup,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}