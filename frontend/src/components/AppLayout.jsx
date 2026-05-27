import { useState } from 'react'
import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden bg-void">
      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:static md:z-auto
        transform transition-transform duration-300 ease-in-out
        ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar onClose={() => setMenuOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-panel sticky top-0 z-20">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-void transition-colors text-text-dim hover:text-text"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" style={{color: 'var(--color-accent)'}}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-bold text-text text-sm">PrivaChat</span>
          </div>
        </div>

        <div className="h-[calc(100%-57px)] md:h-full overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  )
}