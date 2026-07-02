import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, QrCode, KeyRound, UserCheck,
  MessageSquare, Settings, LogOut, Shield, Users,
  Bell, Sun, Moon, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const navItems = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/invite/generate', icon: QrCode,          label: 'Generate Invite' },
  { to: '/invite/enter',    icon: KeyRound,         label: 'Enter Invite' },
  { to: '/requests',        icon: UserCheck,        label: 'Requests' },
  { to: '/chats',           icon: MessageSquare,    label: 'Chats' },
  { to: '/groups',          icon: Users,            label: 'Groups' },
  { to: '/group-requests',  icon: Bell,             label: 'Group Requests' },
  { to: '/settings',        icon: Settings,         label: 'Settings' },
]

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleNavClick = () => {
    if (onClose) onClose()
  }

  return (
    <aside className="w-72 h-full flex flex-col bg-panel border-r border-border shrink-0">
      {/* ── Logo ───────────────────────────────── */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-panel" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-text tracking-tight text-sm leading-none">
                Connect-X
              </h1>
              <p className="text-text-dim text-xs mt-0.5 font-mono opacity-70">consent-first</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-text-dim hover:text-text hover:bg-void transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── User Card ──────────────────────────── */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-void border border-border">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover border border-accent/25 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/25 flex items-center justify-center font-mono font-bold text-accent text-xs shrink-0">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-text text-sm font-medium truncate leading-tight">
              {user?.name || '...'}
            </p>
            <p className="text-success text-xs font-mono opacity-80 leading-tight mt-0.5">
              Online
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-success shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────── */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={handleNavClick}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span className="flex-1 truncate text-[15px]">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom Actions ─────────────────────── */}
      <div className="px-3 py-3 border-t border-border space-y-0.5">
        <button onClick={toggleTheme} className="nav-link w-full group">
          {theme === 'dark' ? (
            <>
              <Sun className="w-[18px] h-[18px] shrink-0 text-warn" />
              <span className="text-[15px]">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-[18px] h-[18px] shrink-0 text-accent" />
              <span className="text-[15px]">Dark Mode</span>
            </>
          )}
        </button>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-danger hover:bg-danger/8 hover:text-danger"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span className="text-[15px]">Logout</span>
        </button>
      </div>
    </aside>
  )
}