import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { api } from '../api'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Mobile sidebar state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // Change password states
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (!currentPassword || !newPassword) {
      return setPasswordError('All fields are required')
    }
    if (newPassword.length < 4) {
      return setPasswordError('New password minimal 4 characters')
    }
    try {
      const res = await api.changePassword(currentPassword, newPassword)
      if (res.success) {
        setPasswordSuccess('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setTimeout(() => setShowPasswordModal(false), 1500)
      }
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password')
    }
  }

  const isActive = (path) => location.pathname === path
  const isSessionPathActive = (subpath) => location.pathname.startsWith(`/session/${activeSessionId}/${subpath}`)

  // Close drawer on page navigation
  const handleNavClick = () => {
    setMobileDrawerOpen(false)
  }

  return (
    <div className="min-h-screen bg-base-200/50 flex flex-col text-base-content antialiased">
      {/* Premium Glassmorphism Navbar */}
      <header className="sticky top-0 z-40 w-full navbar bg-base-100/80 backdrop-blur-md border-b border-base-300/60 px-4 md:px-6 shadow-sm justify-between transition-all">
        <div className="flex items-center gap-2">
          {/* Hamburger toggle for mobile */}
          <button 
            type="button"
            className="btn btn-ghost btn-sm btn-square md:hidden text-base-content/80 hover:bg-base-200"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            aria-label="Toggle Navigation Menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
              {mobileDrawerOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 12h16M4 6h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Logo with emerald/teal gradient */}
          <Link to="/" className="flex items-center gap-2 group" onClick={handleNavClick}>
            <div className="size-8 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-700 bg-clip-text text-transparent tracking-tight">WWebJS</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Username profile badge */}
          {user && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-200 border border-base-300/40 text-sm font-medium">
              <div className="size-5 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center text-[10px] font-bold">
                {user.username[0]?.toUpperCase()}
              </div>
              <span className="hidden sm:inline opacity-80">{user.username}</span>
            </div>
          )}
          

          
          <button 
            className="btn btn-ghost btn-sm gap-1.5 rounded-lg text-error hover:bg-error/10 hover:border-error/20 border border-transparent transition-colors" 
            onClick={handleLogout}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {mobileDrawerOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Modernized Dynamic Sidebar */}
        <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-base-100 border-r border-base-300/60 flex flex-col p-4 shrink-0 justify-between transition-transform duration-300 ease-in-out ${
          mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}>
          <ul className="menu gap-1 p-0 w-full">
            {activeSessionId ? (
              // ================= SESSION-SPECIFIC SIDEBAR =================
              <>
                <li>
                  <Link 
                    to="/" 
                    onClick={handleNavClick}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-all mb-4 justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
                    <span>Back to Sessions</span>
                  </Link>
                </li>
                
                <li className="menu-title text-[10px] font-extrabold uppercase tracking-widest opacity-40 px-3 mb-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500 status-connected-pulse" />
                  <span className="truncate">Session: {activeSessionId}</span>
                </li>

                <li>
                  <Link 
                    to={`/session/${activeSessionId}/chat`} 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isSessionPathActive('chat') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>Chats</span>
                  </Link>
                </li>

                <li>
                  <Link 
                    to={`/session/${activeSessionId}/channels`} 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isSessionPathActive('channels') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                    <span>Channels</span>
                  </Link>
                </li>

                <li>
                  <Link 
                    to={`/session/${activeSessionId}/profile`} 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isSessionPathActive('profile') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662"/></svg>
                    <span>WhatsApp Profile</span>
                  </Link>
                </li>

                <li>
                  <Link 
                    to={`/session/${activeSessionId}/catalog`} 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isSessionPathActive('catalog') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span>Business Catalog</span>
                  </Link>
                </li>

                <li>
                  <Link 
                    to={`/session/${activeSessionId}/auto-reply`} 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isSessionPathActive('auto-reply') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span>Auto Reply Workflow</span>
                  </Link>
                </li>
              </>
            ) : (
              // ================= GLOBAL SIDEBAR =================
              <>
                <li className="menu-title text-xs font-semibold uppercase tracking-wider opacity-40 px-3 mb-2">Navigation</li>
                <li>
                  <Link 
                    to="/" 
                    onClick={handleNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                      isActive('/') 
                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                        : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                    <span>Dashboard</span>
                  </Link>
                </li>
                
                {user?.is_admin && (
                  <li>
                    <Link 
                      to="/users" 
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                        isActive('/users') 
                          ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 font-semibold border-l-4 border-emerald-500 pl-2' 
                          : 'hover:bg-base-200 text-base-content/70 hover:text-base-content'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      <span>User Management</span>
                    </Link>
                  </li>
                )}

                <li className="menu-title text-xs font-semibold uppercase tracking-wider opacity-40 px-3 mt-4 mb-2">Account</li>
                <li>
                  <button 
                    onClick={() => {
                      handleNavClick()
                      setCurrentPassword('')
                      setNewPassword('')
                      setPasswordError('')
                      setPasswordSuccess('')
                      setShowPasswordModal(true)
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-base-200 text-base-content/70 hover:text-base-content"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><rect width="8" height="11" x="8" y="11" rx="2" ry="2"/><path d="M12 11V7a4 4 0 0 0-8 0v4"/><circle cx="12" cy="16" r="1"/></svg>
                    <span>Change Password</span>
                  </button>
                </li>
              </>
            )}
          </ul>
          
          <div className="p-3 bg-base-200/50 border border-base-300/40 rounded-xl">
            <p className="text-[10px] text-base-content/40 font-mono">WWebJS Admin v1.0.2</p>
            <p className="text-[9px] text-base-content/30 mt-1">REST API & Web UI for WhatsApp Manager</p>
          </div>
        </aside>

        {/* Page Content Panel */}
        <main className="flex-1 p-0 overflow-y-auto overflow-x-hidden relative w-full">
          <Outlet />
        </main>
      </div>



      {/* Styled Change Password Modal */}
      {showPasswordModal && (
        <dialog className="modal modal-open bg-black/40 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-box glass-card border border-base-300/40 rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><rect width="8" height="11" x="8" y="11" rx="2" ry="2"/><path d="M12 11V7a4 4 0 0 0-8 0v4"/><circle cx="12" cy="16" r="1"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Change Password</h3>
                <p className="text-xs text-base-content/50">Update your account credentials</p>
              </div>
            </div>

            {passwordError && (
              <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 rounded-xl flex gap-2 text-xs py-2 px-3 mb-4">
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="alert alert-success bg-emerald-500/10 border-emerald-500/20 text-emerald-700 rounded-xl flex gap-2 text-xs py-2 px-3 mb-4">
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">Current Password</span></label>
                <input 
                  type="password" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">New Password</span></label>
                <input 
                  type="password" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="modal-action gap-2 mt-8">
                <button type="button" className="btn btn-ghost rounded-xl px-5" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl px-5 text-white">Update Password</button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}
