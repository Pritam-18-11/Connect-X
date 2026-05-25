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

    // Private chat unread
    s.on('receive_message', (msg) => {
      const senderId = typeof msg.senderId === 'object'
        ? msg.senderId?._id?.toString()
        : msg.senderId?.toString()

      if (senderId) {
        setUnreadChats((prev) => ({ ...prev, [senderId]: true }))
      }
    })

    // Group chat unread
    s.on('receive_group_message', (msg) => {
      const groupId = typeof msg.groupId === 'object'
        ? msg.groupId?._id?.toString()
        : msg.groupId?.toString()

      const senderId = typeof msg.senderId === 'object'
        ? msg.senderId?._id?.toString()
        : msg.senderId?.toString()

      // নিজের message এ dot দেখাবে না
      const currentUserId = String(user?.id || user?._id || '')
      if (groupId && senderId !== currentUserId) {
        setUnreadGroups((prev) => ({ ...prev, [groupId]: true }))
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
    setUnreadChats((prev) => {
      if (!prev[userId]) return prev
      const next = { ...prev }
      delete next[userId]
      return next
    })
  }

  const clearUnreadGroup = (groupId) => {
    setUnreadGroups((prev) => {
      if (!prev[groupId]) return prev
      const next = { ...prev }
      delete next[groupId]
      return next
    })
  }

  return (
    <SocketContext.Provider value={{
      socket,
      onlineUsers,
      unreadChats,
      clearUnread,
      unreadGroups,
      clearUnreadGroup,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}