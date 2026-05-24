import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()

  const [socket, setSocket] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])

  const socketRef = useRef(null)

  useEffect(() => {
    // If user logs out → cleanup everything
    if (!user) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }

      setSocket(null)
      setOnlineUsers([])
      return
    }

    const token = sessionStorage.getItem('token')

    if (!token) {
      console.warn('⚠️ No token found for socket connection')
      return
    }

    // Prevent duplicate socket connections
    if (socketRef.current) {
      socketRef.current.removeAllListeners()
      socketRef.current.disconnect()
      socketRef.current = null
    }

    const s = io('http://localhost:5000', {
      auth: {
        token,
      },
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      console.log('✅ Socket connected:', s.id)
    })

    s.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason)
    })

    s.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', err.message)
    })

    s.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => {
        if (prev.includes(userId)) return prev
        return [...prev, userId]
      })
    })

    s.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) =>
        prev.filter((id) => id !== userId)
      )
    })

    // Cleanup on unmount or user switch
    return () => {
      if (s) {
        s.removeAllListeners()
        s.disconnect()
      }

      socketRef.current = null
      setSocket(null)
      setOnlineUsers([])
    }
  }, [user])

  return (
    <SocketContext.Provider
      value={{
        socket,
        onlineUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}