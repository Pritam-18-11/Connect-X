import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import ImageCropModal from '../components/ImageCropModal'
import AvatarViewerModal from '../components/AvatarViewerModal'
import { User, Shield, Bell, Trash2, Save, Check, AlertCircle, X, Camera, Loader2 } from 'lucide-react'

export default function Settings() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [autoReject, setAutoReject] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const [showAvatarViewer, setShowAvatarViewer] = useState(false)
  const avatarInputRef = useRef(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (user) {
      setName(user.name || '')
      setEmail(user.email || '')
      setAvatarUrl(user.avatarUrl || null)
    }
    fetchLatestPrefs()
  }, [user])

  const fetchLatestPrefs = async () => {
    try {
      const { data } = await api.get('/auth/me')
      setAutoReject(!!data.autoRejectInvites)
      setNotifications(data.notificationsEnabled !== false)
      setAvatarUrl(data.avatarUrl || null)
    } catch (err) {
      console.error('Failed to fetch preferences:', err)
    } finally {
      setLoadingPrefs(false)
    }
  }

  // ── Avatar handlers ───────────────────────────────────────────
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file.')
      return
    }
    setAvatarError('')
    setCropSrc(URL.createObjectURL(file))
  }

  const cancelCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  const confirmCrop = async (blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
      const formData = new FormData()
      formData.append('avatar', file)
      const { data } = await api.put('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAvatarUrl(data.user.avatarUrl)
      // ✅ FIX: AuthContext user state update hobe immediately
      updateUser({ avatarUrl: data.user.avatarUrl })
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to upload photo.')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      await api.delete('/auth/me/avatar')
      setAvatarUrl(null)
      // ✅ FIX: AuthContext user state update hobe immediately
      updateUser({ avatarUrl: null })
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Failed to remove photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        email,
        autoRejectInvites: autoReject,
        notificationsEnabled: notifications,
      }
      if (password.trim()) payload.password = password.trim()

      const { data } = await api.put('/auth/me', payload)

      // ✅ FIX: AuthContext user state update — Sidebar immediately reflect korbe
      updateUser({
        name: data.user.name,
        email: data.user.email,
        autoRejectInvites: data.user.autoRejectInvites,
        notificationsEnabled: data.user.notificationsEnabled,
      })

      setPassword('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.delete('/auth/me')
      logout()
      navigate('/login')
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account.')
      setDeleting(false)
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

        {error && (
          <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-4 py-3 mb-6 font-mono text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Profile */}
        <Section icon={User} title="Profile">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
            <div className="relative shrink-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
              />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={name}
                  onClick={() => setShowAvatarViewer(true)}
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/25 shadow-glow-sm cursor-pointer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/25 flex items-center justify-center font-mono font-bold text-accent text-xl shadow-glow-sm">
                  {initials}
                </div>
              )}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center text-void hover:bg-accent-dim transition-colors disabled:opacity-60"
                title="Change photo"
              >
                {uploadingAvatar
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Camera className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex-1">
              <p className="text-text font-medium">{name || 'Loading...'}</p>
              <p className="text-text-dim text-xs font-mono">{email}</p>
              {avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="text-danger text-xs font-mono mt-1 hover:underline disabled:opacity-60"
                >
                  Remove photo
                </button>
              )}
              {avatarError && (
                <p className="text-danger text-xs font-mono mt-1">{avatarError}</p>
              )}
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
          {loadingPrefs ? (
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <Toggle
              label="Auto-reject unknown invites"
              desc="Automatically reject connection requests without reviewing"
              value={autoReject}
              onChange={setAutoReject}
            />
          )}
        </Section>

        {/* Notifications */}
        <Section icon={Bell} title="Notifications">
          {loadingPrefs ? (
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          ) : (
            <Toggle
              label="Enable notifications"
              desc="Receive alerts for new messages and connection requests"
              value={notifications}
              onChange={setNotifications}
            />
          )}
        </Section>

        {/* Danger */}
        <Section icon={Trash2} title="Danger Zone" danger>
          <p className="text-text-dim text-sm font-mono mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          <button onClick={() => setShowDeleteModal(true)} className="btn-danger">
            Delete Account
          </button>
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

      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          mode="avatar"
          onCancel={cancelCrop}
          onConfirm={confirmCrop}
        />
      )}

      {showAvatarViewer && avatarUrl && (
        <AvatarViewerModal src={avatarUrl} name={name} onClose={() => setShowAvatarViewer(false)} />
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="panel p-6 w-full max-w-sm border border-danger/30 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
              className="absolute top-4 right-4 text-muted hover:text-text transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>

            <Trash2 className="w-10 h-10 text-danger mx-auto mb-4" />
            <h3 className="text-text font-semibold text-lg mb-2 text-center">Delete your account?</h3>
            <p className="text-text-dim text-sm font-mono mb-4 text-center leading-relaxed">
              This will permanently delete your account, connections, messages, and groups you created. This cannot be undone.
            </p>

            {deleteError && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded px-3 py-2 mb-4 font-mono text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {deleteError}
              </div>
            )}

            <label className="block text-text-dim text-xs font-mono uppercase tracking-widest mb-2">
              Type <span className="text-danger">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="input-field mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-ghost flex-1 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== 'DELETE'}
                className="btn-danger flex-1 disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
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