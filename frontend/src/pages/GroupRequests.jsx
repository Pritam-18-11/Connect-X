import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useSocket } from '../context/SocketContext'
import { Bell, Check, X, MessageSquare } from 'lucide-react'

export default function GroupRequests() {
  const [invitations, setInvitations] = useState([])
  const [joinRequests, setJoinRequests] = useState([])
  const [adminActions, setAdminActions] = useState([])
  const [privateChatRequests, setPrivateChatRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const { socket } = useSocket()
  const navigate = useNavigate()

  useEffect(() => {
    fetchData()
  }, [])

  // Socket listeners for real-time private chat request updates
  useEffect(() => {
    if (!socket) return

    const handleNewRequest = (data) => {
      setPrivateChatRequests((prev) => [
        {
          _id: data.requestId,
          sender: data.sender,
          groupId: { name: data.groupName },
          status: 'pending',
        },
        ...prev,
      ])
    }

    const handleCancelled = ({ requestId }) => {
      setPrivateChatRequests((prev) => prev.filter((r) => r._id !== requestId))
    }

    socket.on('private_chat_request', handleNewRequest)
    socket.on('private_chat_cancelled', handleCancelled)

    return () => {
      socket.off('private_chat_request', handleNewRequest)
      socket.off('private_chat_cancelled', handleCancelled)
    }
  }, [socket])

  const fetchData = async () => {
    try {
      const [invRes, adminTasksRes, privateChatRes] = await Promise.all([
        api.get('/groups/my-invitations'),
        api.get('/groups/pending-admin-tasks'),
        api.get('/private-chat/requests'),
      ])
      setInvitations(invRes.data)
      setJoinRequests(adminTasksRes.data.joinRequests)
      setAdminActions(adminTasksRes.data.adminActionRequests)
      setPrivateChatRequests(privateChatRes.data)
    } catch (err) {
      console.error('Failed to fetch group requests:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInvitation = async (id, action) => {
    try {
      const res = await api.post(`/groups/invitations/${id}/${action}`)
      setInvitations((prev) => prev.filter((i) => i._id !== id))
      if (action === 'approve' && res.data.groupId) {
        navigate(`/groups/${res.data.groupId}`)
      }
    } catch (err) {
      console.error('Failed to handle invitation:', err)
    }
  }

  const handleJoinRequest = async (id, action) => {
    try {
      await api.post(`/groups/join-requests/${id}/${action}`)
      setJoinRequests((prev) => prev.filter((r) => r._id !== id))
    } catch (err) {
      console.error('Failed to handle join request:', err)
    }
  }

  const handleAdminAction = async (id, action) => {
    try {
      await api.post(`/groups/admin-actions/${id}/${action}`)
      setAdminActions((prev) => prev.filter((a) => a._id !== id))
    } catch (err) {
      console.error('Failed to handle admin action:', err)
    }
  }

  const handlePrivateChatRequest = async (id, action) => {
    try {
      if (action === 'approve') {
        const { data } = await api.post(`/private-chat/approve/${id}`)
        setPrivateChatRequests((prev) => prev.filter((r) => r._id !== id))
        navigate(`/chat/${data.chatUserId}`)
      } else {
        await api.post(`/private-chat/reject/${id}`)
        setPrivateChatRequests((prev) => prev.filter((r) => r._id !== id))
      }
    } catch (err) {
      console.error('Failed to handle private chat request:', err)
    }
  }

  const totalCount =
    invitations.length + joinRequests.length + adminActions.length + privateChatRequests.length

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Group Requests</h1>
          <p className="text-text-dim text-sm font-mono">
            {totalCount} pending item{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="panel p-12 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : totalCount === 0 ? (
          <div className="panel p-12 text-center">
            <Bell className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-text-dim font-mono text-sm">No pending group requests</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Private Chat Requests */}
            {privateChatRequests.length > 0 && (
              <Section title="Private Chat Requests" color="accent">
                {privateChatRequests.map((req) => (
                  <div key={req._id} className="panel p-4 border border-accent/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-sm shrink-0">
                        {req.sender?.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-text text-sm font-medium">{req.sender?.name}</p>
                        <p className="text-text-dim text-xs font-mono">
                          <MessageSquare className="w-3 h-3 inline mr-1" />
                          Wants to start a private conversation
                          {req.groupId?.name && (
                            <span className="text-accent"> · from {req.groupId.name}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <ActionButton
                        label="Approve"
                        color="success"
                        onClick={() => handlePrivateChatRequest(req._id, 'approve')}
                      />
                      <ActionButton
                        label="Reject"
                        color="danger"
                        onClick={() => handlePrivateChatRequest(req._id, 'reject')}
                      />
                    </div>
                  </div>
                ))}
              </Section>
            )}

            {/* Group Invitations */}
            {invitations.length > 0 && (
              <Section title="Group Invitations" color="warn">
                {invitations.map((inv) => (
                  <RequestCard
                    key={inv._id}
                    title={inv.groupId?.name}
                    subtitle={`Invited by ${inv.invitedBy?.name}`}
                    approveLabel="Join"
                    onApprove={() => handleInvitation(inv._id, 'approve')}
                    onReject={() => handleInvitation(inv._id, 'reject')}
                  />
                ))}
              </Section>
            )}

            {/* Join Requests */}
            {joinRequests.length > 0 && (
              <Section title="Join Requests" color="success">
                {joinRequests.map((req) => (
                  <RequestCard
                    key={req._id}
                    title={req.requestedBy?.name}
                    subtitle={`Wants to join ${req.groupId?.name}`}
                    onApprove={() => handleJoinRequest(req._id, 'approve')}
                    onReject={() => handleJoinRequest(req._id, 'reject')}
                  />
                ))}
              </Section>
            )}

            {/* Admin Action Requests */}
            {adminActions.length > 0 && (
              <Section title="Admin Action Requests" color="success">
                {adminActions.map((action) => (
                  <RequestCard
                    key={action._id}
                    title={`${action.actionType === 'remove-member' ? 'Remove' : 'Promote'} ${action.targetUser?.name}`}
                    subtitle={`By ${action.requestedBy?.name} in ${action.groupId?.name}`}
                    onApprove={() => handleAdminAction(action._id, 'approve')}
                    onReject={() => handleAdminAction(action._id, 'reject')}
                  />
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function Section({ title, color, children }) {
  const lines = { accent: 'bg-accent', warn: 'bg-warn', success: 'bg-success' }
  return (
    <div>
      <h2 className="text-text text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
        <span className={`w-4 h-px ${lines[color]}`} />
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ActionButton({ label, color, onClick }) {
  const [loading, setLoading] = useState(false)
  const colors = {
    success: 'bg-success/10 border-success/30 text-success hover:bg-success/20',
    danger: 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20',
  }
  const handle = async () => {
    setLoading(true)
    await onClick()
    setLoading(false)
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      className={`flex items-center gap-1 px-3 py-1.5 rounded border font-mono text-xs transition-all disabled:opacity-60 ${colors[color]}`}
    >
      {color === 'success' ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {loading ? '...' : label}
    </button>
  )
}

function RequestCard({ title, subtitle, onApprove, onReject, approveLabel = 'Approve' }) {
  const [processing, setProcessing] = useState(false)
  const handle = async (fn) => { setProcessing(true); await fn(); setProcessing(false) }
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-text font-medium text-sm truncate">{title}</p>
        <p className="text-text-dim text-xs font-mono truncate">{subtitle}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => handle(onApprove)} disabled={processing}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-success/10 border border-success/30 text-success hover:bg-success/20 font-mono text-xs transition-all disabled:opacity-60">
          <Check className="w-3 h-3" /> {approveLabel}
        </button>
        <button onClick={() => handle(onReject)} disabled={processing}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 font-mono text-xs transition-all disabled:opacity-60">
          <X className="w-3 h-3" /> Reject
        </button>
      </div>
    </div>
  )
}