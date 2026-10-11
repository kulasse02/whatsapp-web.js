import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Users from './pages/Users'
import Channels from './pages/Channels'
import Profile from './pages/Profile'
import Catalog from './pages/Catalog'
import AutoReply from './pages/AutoReply'
import Layout from './components/Layout'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function UserOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Public({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><span className="loading loading-spinner loading-lg"></span></div>
  if (user) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Public><Login /></Public>} />
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat/:sessionId" element={<Chat />} />
          <Route path="/chat/:sessionId/:chatId" element={<Chat />} />
          <Route path="/session/:sessionId/chat" element={<Chat />} />
          <Route path="/session/:sessionId/chat/:chatId" element={<Chat />} />
          <Route path="/session/:sessionId/channels" element={<Channels />} />
          <Route path="/session/:sessionId/profile" element={<Profile />} />
          <Route path="/session/:sessionId/catalog" element={<Catalog />} />
          <Route path="/session/:sessionId/auto-reply" element={<AutoReply />} />
          <Route path="/users" element={<Users />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
