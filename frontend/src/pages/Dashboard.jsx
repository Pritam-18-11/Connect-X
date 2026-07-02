import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import api from '../utils/api'
import {
  QrCode, KeyRound, UserCheck, MessageSquare,
  Shield, Clock, Zap, Users,
} from 'lucide-react'

const quickActions = [
  { to: '/invite/generate', icon: QrCode, title: 'Generate Invite Code', desc: 'Create a temporary 100-second invite code', accent: 'border-accent/20 hover:border-accent/50' },
  { to: '/invite/enter', icon: KeyRound, title: 'Enter Invite Code', desc: "Use someone's invite code to connect", accent: 'border-warn/20 hover:border-warn/40' },
  { to: '/requests', icon: UserCheck, title: 'Connection Requests', desc: 'Approve or reject incoming requests', accent: 'border-success/20 hover:border-success/40' },
  { to: '/chats', icon: MessageSquare, title: 'Open Chats', desc: 'Continue your private conversations', accent: 'border-accent/20 hover:border-accent/50' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const { onlineUsers } = useSocket()
  const navigate = useNavigate()
  const location = useLocation()
  const [connections, setConnections] = useState([])
  const [requests, setRequests] = useState([])
  const [messagesToday, setMessagesToday] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [connRes, reqRes, statsRes] = await Promise.all([
          api.get('/connections/list'),
          api.get('/connections/requests'),
          api.get('/chat/stats/today'),
        ])
        setConnections(connRes.data)
        setRequests(reqRes.data)
        setMessagesToday(statsRes.data.count)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const stats = [
    { label: 'Active Connections', value: connections.length, icon: Shield, color: 'text-accent' },
    { label: 'Pending Requests', value: requests.length, icon: UserCheck, color: 'text-warn' },
    { label: 'Messages Today', value: messagesToday, icon: MessageSquare, color: 'text-success' },
    { label: 'Timed Connections', value: '0', icon: Clock, color: 'text-accent' },
  ]

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="tag"><Zap className="w-3 h-3" /> System Online</span>
          </div>
          <h1 className="text-2xl font-semibold text-text mb-1">Dashboard</h1>
          <p className="text-text-dim text-sm font-mono">
            Welcome back, <span className="text-accent">{user?.name || '...'}</span>
          </p>
        </div>

        {/* Revoke success message */}
        {location.state?.revokedSuccess && (
          <div className="mb-6 flex items-center gap-2 bg-success/10 border border-success/30 text-success rounded px-4 py-3 font-mono text-sm">
            Connection Revoked Successfully
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="panel p-5">
              <div className="mb-3"><Icon className={`w-5 h-5 ${color}`} /></div>
              <p className={`font-mono font-bold text-3xl ${color} mb-1`}>{value}</p>
              <p className="text-text-dim text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="mb-8">
          <h2 className="text-text text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-accent" /> Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map(({ to, icon: Icon, title, desc, accent }) => (
              <Link key={to} to={to} className={`panel p-5 border cursor-pointer transition-all duration-300 group ${accent}`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded bg-void border border-border flex items-center justify-center shrink-0 group-hover:border-accent/40 transition-colors">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text font-medium text-sm">{title}</h3>
                    <p className="text-text-dim text-xs font-mono mt-0.5">{desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* My Connections */}
        <div className="mb-8">
          <h2 className="text-text text-sm font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-4 h-px bg-success" /> My Connections
          </h2>
          {loading ? (
            <div className="panel p-6 text-center">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : connections.length === 0 ? (
            <div className="panel p-6 text-center">
              <Users className="w-8 h-8 text-muted mx-auto mb-2" />
              <p className="text-text-dim font-mono text-sm">No connections yet</p>
            </div>
          ) : (
            <div className="panel divide-y divide-border">
              {connections.map((conn) => {
                const isOnline = onlineUsers.includes(conn.userId.toString())
                return (
                  <div
                    key={conn.connectionId}
                    onClick={() => navigate(`/chat/${conn.userId}`)}
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-void/40 transition-colors"
                  >
                    <div className="relative">
                      {conn.avatarUrl ? (
                        <img
                          src={conn.avatarUrl}
                          alt={conn.name}
                          className="w-9 h-9 rounded-full object-cover border border-accent/30"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-sm">
                          {conn.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-panel" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-text text-sm font-medium">{conn.name}</p>
                      <p className="text-text-dim text-xs font-mono">
                        {isOnline ? 'Online · Click to chat' : 'Offline'}
                      </p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-muted" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Privacy notice */}
        <div className="panel p-5 border border-accent/10 bg-accent-glow/30">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-accent font-mono text-sm font-semibold mb-1 tracking-wide">
                Consent-First Protocol Active
              </h3>
              <p className="text-text-dim text-xs font-mono leading-relaxed">
                No one can message you without mutual approval. You are in full control.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}