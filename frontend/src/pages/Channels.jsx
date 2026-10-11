import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

export default function Channels() {
  const { sessionId } = useParams()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchChannels()
  }, [sessionId])

  const fetchChannels = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getChannels(sessionId)
      if (res.success && Array.isArray(res.channels)) {
        setChannels(res.channels)
      } else {
        setChannels([])
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch WhatsApp Channels')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto h-full text-base-content antialiased">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl border border-white/5 shadow-xl text-white">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight">WhatsApp Channels</h1>
          <p className="text-xs text-slate-400">View and explore subscribed or managed channels for this session.</p>
        </div>
        <button 
          className="btn btn-sm btn-outline border-white/10 hover:bg-white/5 text-white rounded-xl gap-2 px-4 h-9"
          onClick={fetchChannels}
          disabled={loading}
        >
          {loading ? <span className="loading loading-spinner loading-xs"></span> : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 rounded-2xl flex gap-3 text-sm py-3.5 px-4 shadow-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="loading loading-spinner loading-lg text-emerald-500"></span>
          <span className="text-xs font-semibold text-base-content/40">Fetching channel list...</span>
        </div>
      ) : (
        <>
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-base-100 border border-base-300/40 rounded-3xl text-center shadow-sm">
              <div className="size-16 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-8"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              </div>
              <h3 className="text-lg font-bold">No WhatsApp Channels Subscribed</h3>
              <p className="text-sm text-base-content/50 max-w-sm mt-1">This WhatsApp account does not follow or moderate any channels currently.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {channels.map((ch, idx) => (
                <div key={ch.id || idx} className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 group">
                  <div className="card-body p-5">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="size-12 rounded-xl overflow-hidden bg-base-200 border border-base-300/40 flex items-center justify-center shrink-0">
                        {ch.avatarUrl ? (
                          <img src={ch.avatarUrl} alt={ch.name} className="size-full object-cover select-none" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6 text-base-content/40"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="space-y-1 flex-1 min-w-0">
                        <h3 className="font-bold text-sm tracking-tight text-base-content truncate">{ch.name}</h3>
                        <p className="text-xs text-base-content/50 font-mono truncate">{ch.id}</p>
                        {ch.description && (
                          <p className="text-xs text-base-content/75 line-clamp-2 mt-2 leading-relaxed bg-base-200/40 p-2 rounded-lg border border-base-300/30">
                            {ch.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
