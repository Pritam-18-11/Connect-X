import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useSocket } from '../context/SocketContext'
import { MessageSquare, ShieldOff } from 'lucide-react'

export default function ChatList() {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const { onlineUsers } = useSocket()

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const { data } = await api.get('/connections/list')
        setConnections(data)
      } catch (err) {
        console.error('Failed to fetch connections:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchConnections()
  }, [])

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
              return (
                <Link
                  key={conn.userId}
                  to={`/chat/${conn.userId}`}
                  className="panel p-4 flex items-center gap-4 hover:border-accent/20 transition-all duration-200 border border-transparent cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-mono font-bold text-accent">
                      {conn.name?.slice(0, 2).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-panel shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium text-sm">{conn.name}</p>
                    <p className="text-text-dim text-xs font-mono">
                      {isOnline ? 'Online' : 'Offline'}
                    </p>
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
    </AppLayout>
  )
}