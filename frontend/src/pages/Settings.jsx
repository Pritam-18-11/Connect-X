import { useState, useEffect } from 'react'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { User, Shield, Bell, Trash2, Save, Check } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [autoReject, setAutoReject] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 500))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text mb-1">Settings</h1>
          <p className="text-text-dim text-sm font-mono">Manage your account and privacy preferences</p>
        </div>

        {/* Profile */}
        <Section icon={User} title="Profile">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/25 flex items-center justify-center font-mono font-bold text-accent text-xl shadow-glow-sm">
              {initials}
            </div>
            <div>
              <p className="text-text font-medium">{name || 'Loading...'}</p>
              <p className="text-text-dim text-xs font-mono">{email}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                className="input-field"
              />
            </div>
          </div>
        </Section>

        {/* Privacy */}
        <Section icon={Shield} title="Privacy">
          <Toggle
            label="Auto-reject unknown invites"
            desc="Automatically reject connection requests without reviewing"
            value={autoReject}
            onChange={setAutoReject}
          />
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          <Toggle
            label="Enable notifications"
            desc="Receive alerts for new messages and connection requests"
            value={notifications}
            onChange={setNotifications}
          />
        </Section>

        {/* Danger */}
        <Section icon={Trash2} title="Danger Zone" danger>
          <p className="text-text-dim text-sm font-mono mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button className="btn-danger">Delete Account</button>
        </Section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 disabled:opacity-60"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AppLayout>
  )
}

function Section({ icon: Icon, title, children, danger }) {
  return (
    <div className="panel p-6 mb-6">
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
        <Icon className={`w-4 h-4 ${danger ? 'text-danger' : 'text-accent'}`} />
        <h2 className={`font-mono text-sm font-semibold uppercase tracking-widest ${danger ? 'text-danger' : 'text-text'}`}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, desc, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-text text-sm font-medium">{label}</p>
        {desc && <p className="text-text-dim text-xs font-mono mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300 shrink-0 mt-0.5 ${value ? 'bg-accent shadow-glow-sm' : 'bg-border'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}