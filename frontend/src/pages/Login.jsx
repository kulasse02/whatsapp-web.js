import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { api } from '../api'

export default function Login() {
  const { login } = useAuth()
  const [tab, setTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const res = await api.login(username, password)
        login(res.token, res.username, res.is_admin)
      } else {
        await api.register(username, password)
        const res = await api.login(username, password)
        login(res.token, res.username, res.is_admin)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-900 via-slate-800 to-emerald-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 size-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 size-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="card w-full max-w-[360px] glass-card rounded-2xl border border-white/10 shadow-2xl p-1 relative z-10 transition-all duration-300">
        <div className="card-body p-6">
          {/* Logo Brand Header */}
          <div className="flex flex-col items-center mb-4">
            <div className="size-11 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/30 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-5.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h2 className="text-2xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent tracking-tight">WWebJS</h2>
            <p className="text-[10px] text-slate-400/70 mt-0.5">WhatsApp Web API & Client Panel</p>
          </div>

          {/* Styled tab selector */}
          <div role="tablist" className="tabs tabs-boxed bg-slate-900/60 p-1 border border-white/5 rounded-xl mb-4">
            <button 
              type="button"
              role="tab" 
              className={`tab flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === 'login' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`} 
              onClick={() => setTab('login')}
            >
              Sign In
            </button>
            <button 
              type="button"
              role="tab" 
              className={`tab flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                tab === 'register' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`} 
              onClick={() => setTab('register')}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold text-slate-300 uppercase tracking-wider">Username</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input 
                  type="text" 
                  className="input input-bordered w-full pl-10 bg-slate-900/40 border-white/10 rounded-xl text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-sm placeholder:text-slate-600" 
                  placeholder="Enter username"
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required 
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input 
                  type="password" 
                  className="input input-bordered w-full pl-10 bg-slate-900/40 border-white/10 rounded-xl text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-sm placeholder:text-slate-600" 
                  placeholder="Enter password"
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </div>

            {error && (
              <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-200 text-xs rounded-xl p-3 flex gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span>{error}</span>
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary w-full bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-95 shadow-lg shadow-emerald-500/15 rounded-xl font-bold py-2 text-sm text-white transition-all transform active:scale-[0.98] mt-4" 
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                tab === 'login' ? 'Sign In to Dashboard' : 'Create New Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
