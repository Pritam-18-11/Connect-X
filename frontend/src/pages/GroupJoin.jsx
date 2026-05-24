import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { Users, UserPlus, Check, AlertCircle } from 'lucide-react'

export default function GroupJoin() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await api.get(`/groups/join/${code}`)
        setData(res.data)
        if (res.data.hasPendingRequest) setRequested(true)
      } catch (err) {
        setError(err.response?.data?.message || 'Invalid invite code.')
      } finally {
        setLoading(false)
      }
    }
    fetchGroup()
  }, [code])

  const handleRequest = async () => {
    setRequesting(true)
    setError('')
    try {
      await api.post(`/groups/join/${code}`)
      setRequested(true)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request.')
    } finally {
      setRequesting(false)
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

  return (
    <AppLayout>
      <div className="p-8 max-w-md">
        {error && !data ? (
          <div className="panel p-8 text-center">
            <AlertCircle className="w-10 h-10 text-danger mx-auto mb-4" />
            <p className="text-danger font-mono mb-4">{error}</p>
            <button onClick={() => navigate('/groups')} className="btn-ghost">
              Go to Groups
            </button>
          </div>
        ) : (
          <div className="panel p-8 text-center">
            <div className="w-16 h-16 rounded-xl bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-3xl mx-auto mb-4">
              {data?.group?.name?.slice(0, 1).toUpperCase()}
            </div>
            <h2 className="text-text font-semibold text-xl mb-1">{data?.group?.name}</h2>
            {data?.group?.description && (
              <p className="text-text-dim text-sm font-mono mb-2">{data.group.description}</p>
            )}
            <div className="flex items-center justify-center gap-1.5 text-text-dim text-xs font-mono mb-6">
              <Users className="w-3.5 h-3.5" />
              {data?.group?.memberCount} members
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 mb-4 font-mono text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            {data?.alreadyMember ? (
              <div className="space-y-3">
                <p className="text-success font-mono text-sm">
                  You are already a member of this group.
                </p>
                <button
                  onClick={() => navigate(`/groups/${data.group._id}`)}
                  className="btn-primary w-full"
                >
                  Open Group
                </button>
              </div>
            ) : requested ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-success font-mono text-sm">
                  <Check className="w-4 h-4" /> Request sent! Waiting for admin approval.
                </div>
                <button onClick={() => navigate('/groups')} className="btn-ghost w-full">
                  Back to Groups
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequest}
                disabled={requesting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {requesting ? 'Sending...' : 'Request to Join'}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}