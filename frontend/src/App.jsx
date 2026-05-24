import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import GenerateInvite from './pages/GenerateInvite'
import EnterInvite from './pages/EnterInvite'
import ConnectionRequests from './pages/ConnectionRequests'
import ChatList from './pages/ChatList'
import ChatWindow from './pages/ChatWindow'
import Settings from './pages/Settings'
import GroupList from './pages/GroupList'
import GroupChat from './pages/GroupChat'
import GroupJoin from './pages/GroupJoin'
import GroupRequests from './pages/GroupRequests'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/invite/generate" element={<ProtectedRoute><GenerateInvite /></ProtectedRoute>} />
              <Route path="/invite/enter" element={<ProtectedRoute><EnterInvite /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><ConnectionRequests /></ProtectedRoute>} />
              <Route path="/chats" element={<ProtectedRoute><ChatList /></ProtectedRoute>} />
              <Route path="/chat/:userId" element={<ProtectedRoute><ChatWindow /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* Groups — join/:code before :id */}
              <Route path="/groups" element={<ProtectedRoute><GroupList /></ProtectedRoute>} />
              <Route path="/groups/join/:code" element={<ProtectedRoute><GroupJoin /></ProtectedRoute>} />
              <Route path="/groups/:id" element={<ProtectedRoute><GroupChat /></ProtectedRoute>} />
              <Route path="/group-requests" element={<ProtectedRoute><GroupRequests /></ProtectedRoute>} />

              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}