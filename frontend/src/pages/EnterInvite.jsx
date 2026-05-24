import { useState } from 'react'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { KeyRound, Search, UserPlus, Check, AlertCircle } from 'lucide-react'

export default function EnterInvite() {
  const [code, setCode] = useState('')
  const [phase, setPhase] = useState('input')
  const [foundUser, setFoundUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLookup = async (e) => {
    e.preventDefault()
    const trimmed = code.replace(/\s/g, '').toUpperCase().trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/invite/validate', { code: trimmed })
      setFoundUser({ name: data.userName, id: data.userId })
      setPhase('found')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/connections/request', {
        inviteCode: code.replace(/\s/g, '').toUpperCase().trim(),
        receiverId: foundUser.id,
      })
      setPhase('sent')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request.')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setCode('')
    setPhase('input')
    setFoundUser(null)
    setError('')
  }

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Enter Invite Code</h1>
          <p className="text-text-dim text-sm font-mono">
            Enter a code someone shared with you to request a connection
          </p>
        </div>

        {phase === 'input' && (
          <div className="panel p-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-void border border-border mx-auto mb-6">
              <KeyRound className="w-7 h-7 text-accent" />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded-lg px-3 py-2 mb-4 font-mono text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className="input-field text-center text-lg tracking-[0.25em] font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={!code.trim() || loading}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Looking up...' : 'Look Up Code'}
              </button>
            </form>
          </div>
        )}

        {phase === 'found' && foundUser && (
          <div className="panel p-8 text-center">
            <p className="text-text-dim text-xs font-mono uppercase tracking-widest mb-6">
              Code verified — User found
            </p>
            <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center mx-auto mb-4">
              <span className="font-mono font-bold text-accent text-2xl">
                {foundUser.name?.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <h3 className="text-text font-semibold text-xl mb-1">{foundUser.name}</h3>
            <p className="text-text-dim text-sm font-mono mb-8">
              Send a connection request to this user
            </p>
            {error && <p className="text-danger font-mono text-xs mb-4">{error}</p>}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleRequest}
                disabled={loading}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Sending...' : 'Request Connection'}
              </button>
              <button onClick={reset} className="btn-ghost">Cancel</button>
            </div>
          </div>
        )}

        {phase === 'sent' && (
          <div className="panel p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-text font-semibold text-xl mb-2">Request Sent!</h3>
            <p className="text-text-dim text-sm font-mono mb-8 leading-relaxed">
              Connection request sent to{' '}
              <span className="text-accent">{foundUser?.name}</span>.<br />
              Waiting for their approval.
            </p>
            <button onClick={reset} className="btn-ghost">Enter Another Code</button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {[
            'Code must be valid and not expired',
            "You will see the other person's name before requesting",
            'They must approve for the connection to be created',
            'Expired or used codes will be rejected',
          ].map((tip) => (
            <div key={tip} className="flex items-center gap-3 text-text-dim text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-warn shrink-0" />
              {tip}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}