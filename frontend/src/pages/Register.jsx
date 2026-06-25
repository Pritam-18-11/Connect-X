import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Lock, Mail, User, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }

    setLoading(true)
    try {
      await register({ name: form.name, email: form.email, password: form.password })
      setSuccess('Account created! Redirecting to login...')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-void grid-bg flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-accent/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-72 h-72 rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-accent-glow border border-accent/30 mb-5 shadow-glow">
            <Shield className="w-8 h-8 text-accent" />
          </div>
          <h1 className="font-mono font-bold text-2xl text-text tracking-widest uppercase mb-2">
            Connect-X
          </h1>
          <p className="text-text-dim text-sm font-mono">consent-first private messaging</p>
        </div>

        <div className="panel p-8">
          <div className="mb-6">
            <h2 className="text-text font-semibold text-lg mb-1">Create account</h2>
            <p className="text-text-dim text-sm">No phone number required</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-4 py-3 mb-4 font-mono text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-success/10 border border-success/30 text-success rounded px-4 py-3 mb-4 font-mono text-sm">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  placeholder="Your name" className="input-field pl-10" required />
              </div>
            </div>

            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="you@example.com" className="input-field pl-10" required />
              </div>
            </div>

            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input type={showPassword ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange} placeholder="••••••••" className="input-field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-text-dim text-xs font-mono mt-1.5">Minimum 6 characters</p>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (
                <><div className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />Creating...</>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="divider" />
          <p className="text-center text-text-dim text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-accent hover:underline font-mono">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-text-dim text-xs font-mono mt-6 opacity-50">
          Your identity stays private · Invite-only connections
        </p>
      </div>
    </div>
  )
}
