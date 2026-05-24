import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { Users, Plus, KeyRound, X, AlertCircle } from 'lucide-react'

export default function GroupList() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchGroups()
  }, [])

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups')
      setGroups(data)
    } catch (err) {
      console.error('Failed to fetch groups:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return
    setCreating(true)
    setError('')
    try {
      const { data } = await api.post('/groups', {
        name: groupName.trim(),
        description: groupDesc.trim(),
      })
      setShowCreateModal(false)
      setGroupName('')
      setGroupDesc('')
      navigate(`/groups/${data._id}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group.')
    } finally {
      setCreating(false)
    }
  }

  const handleJoin = (e) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    navigate(`/groups/join/${joinCode.trim().toUpperCase()}`)
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-text mb-1">Groups</h1>
            <p className="text-text-dim text-sm font-mono">
              {groups.length} group{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>

        {/* Join via code */}
        <form onSubmit={handleJoin} className="panel p-4 mb-6 flex gap-3">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter group invite code to join"
              className="input-field pl-10"
            />
          </div>
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="btn-ghost disabled:opacity-40"
          >
            Join
          </button>
        </form>

        {loading ? (
          <div className="panel p-12 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : groups.length === 0 ? (
          <div className="panel p-12 text-center">
            <Users className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-text-dim font-mono text-sm">No groups yet</p>
            <p className="text-text-dim text-xs font-mono mt-1 opacity-60">
              Create a group or join with an invite code
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <div
                key={group._id}
                onClick={() => navigate(`/groups/${group._id}`)}
                className="panel p-4 flex items-center gap-4 hover:border-accent/20 transition-all cursor-pointer border border-transparent"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-glow border border-accent/30 flex items-center justify-center font-mono font-bold text-accent text-lg shrink-0">
                  {group.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text font-medium">{group.name}</p>
                  <p className="text-text-dim text-xs font-mono truncate">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    {group.description && ` · ${group.description}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="panel p-6 w-full max-w-sm border border-border relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-text font-semibold text-lg mb-4">Create Group</h3>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 mb-4 font-mono text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="My Group"
                  className="input-field"
                  maxLength={50}
                  required
                />
              </div>
              <div>
                <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="What is this group about?"
                  className="input-field"
                  maxLength={100}
                />
              </div>
              <button
                type="submit"
                disabled={creating || !groupName.trim()}
                className="btn-primary w-full disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  )
}