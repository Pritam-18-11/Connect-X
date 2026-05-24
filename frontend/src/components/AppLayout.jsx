import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  return (
    <div className="h-screen flex overflow-hidden bg-void grid-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
