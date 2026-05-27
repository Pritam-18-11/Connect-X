import { useState, useEffect } from 'react'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useSocket } from '../context/SocketContext'
import { UserCheck, Check, X, Clock, Inbox, MessageSquare } from 'lucide-react'

export default function ConnectionRequests() {
  const [requests, setRequests] = useState([])
  const [privateChatRequests, setPrivateChatRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [pcLoading, setPcLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const { socket } = useSocket()

  useEffect(() => {
    fetchRequests()
    fetchPrivateChatRequests()
  }, [])

  // Real-time: নতুন private chat request এলে list এ add করো
  useEffect(() => {
    if (!socket) return

    const handleNewRequest = (data) => {
      setPrivateChatRequests((prev) => {
        // Duplicate check
        if (prev.find((r) => r._id === data.requestId)) return prev
        return [
          {
            _id: data.requestId,
            sender: { _id: data.sender._id, name: data.sender.name },
            groupId: { name: data.groupName },
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]
      })
    }

    const handleCancelled = ({ requestId }) => {
      setPrivateChatRequests((prev) => prev.filter((r) => r._id?.toString() !== requestId?.toString()))
    }

    socket.on('private_chat_request', handleNewRequest)
    socket.on('private_chat_cancelled', handleCancelled)

    return () => {
      socket.off('private_chat_request', handleNewRequest)
      socket.off('private_chat_cancelled', handleCancelled)
    }
  }, [socket])

  const fetchRequests = async () => {
    try {
      const { data } = await api.get('/connections/requests')
      setRequests(data)
    } catch (err) {
      console.error('Failed to fetch connection requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPrivateChatRequests = async () => {
    try {
      const { data } = await api.get('/private-chat/requests')
      setPrivateChatRequests(data)
    } catch (err) {
      console.error('Failed to fetch private chat requests:', err)
    } finally {
      setPcLoading(false)
    }
  }

  const handle = async (id, action) => {
    try {
      await api.post(`/connections/${action}/${id}`)
      setRequests((r) => r.filter((req) => req._id !== id))
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    }
  }

  const handlePCApprove = async (req) => {
    setProcessingId(req._id)
    try {
      await api.post(`/private-chat/approve/${req._id}`)
      setPrivateChatRequests((prev) => prev.filter((r) => r._id !== req._id))
    } catch (err) {
      console.error('Failed to approve private chat request:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const handlePCReject = async (req) => {
    setProcessingId(req._id)
    try {
      await api.post(`/private-chat/reject/${req._id}`)
      setPrivateChatRequests((prev) => prev.filter((r) => r._id !== req._id))
    } catch (err) {
      console.error('Failed to reject private chat request:', err)
    } finally {
      setProcessingId(null)
    }
  }

  const totalPending = requests.length + privateChatRequests.length

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Requests</h1>
          <p className="text-text-dim text-sm font-mono">
            Review and approve incoming requests
          </p>
        </div>

        {loading && pcLoading ? (
          <div className="panel p-12 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : totalPending === 0 ? (
          <div className="panel p-12 text-center">
            <Inbox className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-text-dim font-mono text-sm">No pending requests</p>
            <p className="text-text-dim text-xs font-mono mt-1 opacity-60">
              New requests will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-8">

            {/* ── Private Chat Requests ── */}
            {privateChatRequests.length > 0 && (
              <div>
                <h2 className="text-text text-xs font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-accent" />
                  Message Requests — {privateChatRequests.length}
                </h2>
                <div className="space-y-3">
                  {privateChatRequests.map((req) => (
                    <div key={req._id} className="panel p-5 border border-accent/10">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center font-mono font-bold text-accent shrink-0">
                          {req.sender?.name?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text font-medium">{req.sender?.name || 'Unknown'}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <MessageSquare className="w-3 h-3 text-accent" />
                            <p className="text-accent text-xs font-mono">
                              wants to message you
                              {req.groupId?.name && (
                                <span className="text-text-dim"> from </span>
                              )}
                              {req.groupId?.name && (
                                <span className="text-accent font-semibold">{req.groupId.name}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-text-dim text-xs font-mono mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handlePCApprove(req)}
                            disabled={processingId === req._id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handlePCReject(req)}
                            disabled={processingId === req._id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-60"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Connection Requests ── */}
            {requests.length > 0 && (
              <div>
                <h2 className="text-text text-xs font-mono uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-4 h-px bg-warn" />
                  Connection Requests — {requests.length}
                </h2>
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div key={req._id} className="panel p-5 border border-warn/10">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-warn/10 border border-warn/30 flex items-center justify-center font-mono font-bold text-warn shrink-0">
                          {req.senderId?.name?.slice(0, 2).toUpperCase() || '??'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text font-medium">{req.senderId?.name || 'Unknown'}</p>
                          <div className="flex items-center gap-1.5 text-text-dim text-xs font-mono mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handle(req._id, 'approve')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-success/10 border border-success/30 text-success hover:bg-success/20 font-mono text-xs uppercase tracking-wider transition-all"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => handle(req._id, 'reject')}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 font-mono text-xs uppercase tracking-wider transition-all"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </AppLayout>
  )
}