import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../AuthContext'

export default function Dashboard() {
  const navigate = useNavigate()

  const [newSessionId, setNewSessionId] = useState('')
  const [sessions, setSessions] = useState([])
  const [qrSession, setQrSession] = useState(null)
  const qrIntervalRef = useRef(null)

  // Pairing Code States
  const [linkMode, setLinkMode] = useState('qr') // 'qr' | 'pairing'
  const [phoneNumberInput, setPhoneNumberInput] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [pairingLoading, setPairingLoading] = useState(false)
  const [pairingError, setPairingError] = useState('')

  // Flash Message state
  const [flash, setFlash] = useState({ message: '', type: '' })

  const showFlash = (msg, type = 'success') => {
    setFlash({ message: msg, type })
    setTimeout(() => setFlash({ message: '', type: '' }), 4000)
  }

  useEffect(() => {
    api.listSessions().then(async res => {
      if (!res.success) return
      const backendList = res.data.map(bs => ({
        id: bs.id,
        owner: bs.owner || 'System',
        status: bs.status || 'disconnected'
      }))
      saveSessions(backendList)

      // Check status directly: if session is connected, set connected immediately
      for (const s of backendList) {
        try {
          const statusRes = await api.sessionStatus(s.id).catch(() => null)
          if (statusRes && statusRes.success) {
            updateSession(s.id, { status: 'connected', qr: null })
          } else {
            const qrRes = await api.sessionQR(s.id).catch(() => null)
            if (qrRes && qrRes.success && qrRes.qr) {
              updateSession(s.id, { status: 'scan_qr', qr: qrRes.qr })
            } else {
              updateSession(s.id, { status: 'disconnected', qr: null })
            }
          }
        } catch (_) {
          updateSession(s.id, { status: 'disconnected', qr: null })
        }
      }
    }).catch(() => {
      const stored = localStorage.getItem('sessions')
      const localSessions = stored ? (JSON.parse(stored) || []) : []
      if (localSessions.length) setSessions(localSessions)
    })
    return () => { if (qrIntervalRef.current) clearInterval(qrIntervalRef.current) }
  }, [])

  function saveSessions(list) {
    setSessions(list)
    localStorage.setItem('sessions', JSON.stringify(list))
  }

  const checkSession = async (id) => {
    try {
      const status = await api.sessionStatus(id)
      if (status.success) {
        updateSession(id, { status: 'connected', qr: null })
        return
      }
      const res = await api.sessionQR(id)
      if (res.success && res.qr) {
        updateSession(id, { status: 'scan_qr', qr: res.qr })
        return
      }
      updateSession(id, { status: 'disconnected', qr: null })
    } catch (_) {
      updateSession(id, { status: 'disconnected', qr: null })
    }
  }

  const addSession = async () => {
    const id = newSessionId.trim() || 'session-' + Date.now()
    setNewSessionId('')
    if (sessions.find(s => s.id === id)) return
    const newList = [...sessions, { id, status: 'starting' }]
    saveSessions(newList)
    try {
      await api.startSession(id)
      updateSession(id, { status: 'waiting_qr' })
      pollQR(id)
    } catch (err) {
      updateSession(id, { status: 'error', error: err.message })
    }
  }

  const pollQR = (sessionId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.sessionQR(sessionId)
        if (res.success && res.qr) {
          updateSession(sessionId, { qr: res.qr, status: 'scan_qr' })
        }
        const status = await api.sessionStatus(sessionId)
        if (status.success) {
          updateSession(sessionId, { status: 'connected', qr: null })
          clearInterval(interval)
          if (qrSession === sessionId) setQrSession(null)
        }
      } catch (_) {}
    }, 2000)
    return interval
  }

  const openQR = async (sessionId) => {
    const s = sessions.find(x => x.id === sessionId)
    const needRestart = s?.status === 'disconnected' || s?.status === 'error'
    if (needRestart) {
      updateSession(sessionId, { status: 'restarting', qr: null })
      try {
        await api.restartSession(sessionId)
      } catch (_) {
        try { await api.startSession(sessionId) } catch (_) {}
      }
      updateSession(sessionId, { status: 'waiting_qr' })
    }
    setQrSession(sessionId)
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
    qrIntervalRef.current = setInterval(async () => {
      try {
        const res = await api.sessionQR(sessionId)
        if (res.success && res.qr) {
          updateSession(sessionId, { qr: res.qr, status: 'scan_qr' })
        }
        const status = await api.sessionStatus(sessionId)
        if (status.success) {
          updateSession(sessionId, { status: 'connected', qr: null })
          setQrSession(null)
          if (qrIntervalRef.current) clearInterval(qrIntervalRef.current)
        }
      } catch (_) {}
    }, 2000)
  }

  const closeQR = () => {
    if (qrIntervalRef.current) {
      clearInterval(qrIntervalRef.current)
      qrIntervalRef.current = null
    }
    if (linkMode === 'pairing' && qrSession) {
      api.cancelPairingCode(qrSession).catch(() => {})
    }
    setQrSession(null)
    setLinkMode('qr')
    setPairingCode('')
    setPhoneNumberInput('')
    setPairingError('')
  }

  const handleGeneratePairing = async () => {
    setPairingError('')
    setPairingCode('')
    if (!phoneNumberInput.trim()) return setPairingError('Phone number is required')
    setPairingLoading(true)
    try {
      const res = await api.requestPairingCode(qrSession, phoneNumberInput.trim())
      if (res.success && res.code) {
        setPairingCode(res.code)
      } else {
        setPairingError('Failed to generate pairing code')
      }
    } catch (err) {
      setPairingError(err.message || 'Failed to generate pairing code')
    } finally {
      setPairingLoading(false)
    }
  }

  const handleCancelPairing = async () => {
    setPairingError('')
    setPairingCode('')
    setPairingLoading(true)
    try {
      await api.cancelPairingCode(qrSession)
      setLinkMode('qr')
    } catch (err) {
      setPairingError(err.message || 'Failed to cancel pairing code')
    } finally {
      setPairingLoading(false)
    }
  }

  const disconnect = async (id) => {
    updateSession(id, { status: 'disconnecting' })
    try {
      await api.disconnectSession(id)
      updateSession(id, { status: 'disconnected' })
    } catch (err) {
      updateSession(id, { status: 'error', error: err.message })
    }
  }

  const currentSession = sessions.find(s => s.id === qrSession)
  const currentQR = currentSession?.qr || ''

  const updateSession = (id, updates) => {
    setSessions(prev => {
      const newList = prev.map(s => s.id === id ? { ...s, ...updates } : s)
      localStorage.setItem('sessions', JSON.stringify(newList))
      return newList
    })
  }

  const terminate = async (id) => {
    try { 
      const res = await api.terminateSession(id)
      saveSessions(sessions.filter(s => s.id !== id))
      if (qrSession === id) closeQR()
      showFlash(`Session "${id}" berhasil dihapus secara permanen!`, 'success')
    } catch (err) {
      showFlash(`Gagal menghapus session "${id}": ${err.message}`, 'error')
    }
  }

  const restart = async (id) => {
    updateSession(id, { status: 'restarting', qr: null })
    try {
      await api.restartSession(id)
      updateSession(id, { status: 'waiting_qr' })
      pollQR(id)
    } catch (err) {
      updateSession(id, { status: 'error', error: err.message })
    }
  }

  const statusBadge = (s) => {
    switch (s.status) {
      case 'connected': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 status-connected-pulse" />
            Connected
          </span>
        )
      case 'scan_qr': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            Scan QR
          </span>
        )
      case 'waiting_qr': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
            Waiting QR
          </span>
        )
      case 'connecting': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
            <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Connecting
          </span>
        )
      case 'restarting': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-600 border border-purple-500/20">
            <span className="size-1.5 rounded-full bg-purple-500 animate-pulse" />
            Restarting
          </span>
        )
      case 'disconnecting': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-500/10 text-orange-600 border border-orange-500/20">
            <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
            Disconnecting
          </span>
        )
      case 'disconnected': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-500/10 text-gray-600 border border-gray-500/20">
            <span className="size-1.5 rounded-full bg-gray-500" />
            Disconnected
          </span>
        )
      case 'error': 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-600 border border-red-500/20">
            <span className="size-1.5 rounded-full bg-red-500" />
            Error
          </span>
        )
      default: 
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-500/10 text-gray-600 border border-gray-500/20">
            {s.status}
          </span>
        )
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Flash Message Banner */}
      {flash.message && (
        <div className={`alert ${flash.type === 'error' ? 'alert-error' : 'alert-success'} text-xs shadow-md rounded-2xl animate-fade-in flex justify-between`}>
          <span>{flash.message}</span>
          <button onClick={() => setFlash({ message: '', type: '' })} className="btn btn-ghost btn-xs btn-circle">✕</button>
        </div>
      )}

      {/* Top Banner & Session Creator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-xl border border-emerald-500/20">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">WhatsApp Web Engine</span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">Sessions Management</h1>
        </div>
        
        <div className="flex items-center gap-2 max-w-md w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              className="input input-bordered input-sm sm:input-md w-full rounded-xl sm:rounded-2xl bg-white/5 border-white/10 text-xs sm:text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-500"
              placeholder="Session name (e.g. MyWA)"
              value={newSessionId}
              onChange={e => setNewSessionId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSession()}
            />
          </div>
          <button className="btn btn-primary btn-sm sm:btn-md bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white font-bold rounded-xl sm:rounded-2xl px-4 sm:px-5 hover:opacity-90 shadow-md shadow-emerald-500/20 gap-1.5 sm:gap-2 shrink-0 transition-transform active:scale-95 text-xs sm:text-sm" onClick={addSession}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            <span>Add Session</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-base-100 border border-base-300/40 rounded-2xl sm:rounded-3xl text-center shadow-sm">
          <div className="size-16 sm:size-20 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-8 sm:size-10"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h3 className="text-base sm:text-lg font-bold">No WhatsApp Sessions</h3>
          <p className="text-xs sm:text-sm text-base-content/50 max-w-sm mt-1 mb-6">Create your first WhatsApp Web instance by naming it and scanning the QR code.</p>
          <button className="btn btn-sm btn-outline border-base-300 rounded-xl px-4" onClick={() => setNewSessionId('session-1')}>
            Quick Create
          </button>
        </div>
      )}

      {/* Grid of Sessions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map(s => (
          <div key={s.id} className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 group">
            <div className="card-body p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/60 group-hover:bg-emerald-500/5 group-hover:text-emerald-600 transition-colors shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-mono font-bold text-sm tracking-tight text-base-content truncate">{s.id}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {statusBadge(s)}
                      {s.owner && (
                        <span className="text-[10px] text-base-content/70 font-semibold bg-base-200 px-2 py-0.5 rounded-md border border-base-300/60" title="Session Owner">
                          👤 {s.owner}
                        </span>
                      )}
                      {s.status === 'error' && s.error && (
                        <span className="text-[10px] text-red-500 font-medium bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10 truncate max-w-[180px]" title={s.error}>
                          {s.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions: Always visible on mobile, nicely spaced */}
                <div className="flex items-center gap-1 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-base-200/60 w-full sm:w-auto justify-end">
                  {s.status === 'connected' && (
                    <button className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 text-emerald-600" onClick={() => navigate(`/session/${s.id}/chat`)} title="Open Chat View">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                  )}
                  {(s.qr || s.status === 'scan_qr' || s.status === 'waiting_qr') && (
                    <button className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-blue-500/10 hover:text-blue-600 text-blue-600" onClick={() => openQR(s.id)} title="Show QR Code">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/></svg>
                    </button>
                  )}
                  {s.status === 'disconnected' && (
                    <button className="btn btn-emerald btn-xs sm:btn-sm rounded-xl gap-1 text-white shadow-sm" onClick={() => restart(s.id)} title="Connect / Resume Session">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span>Connect</span>
                    </button>
                  )}
                  {s.status === 'connected' && (
                    <button className="btn btn-ghost btn-sm btn-square rounded-xl text-amber-500 hover:bg-amber-500/10" onClick={() => disconnect(s.id)} title="Pause / Disconnect Session">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4.5"><rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/></svg>
                    </button>
                  )}
                  {(s.status === 'connected' || s.status === 'error') && (
                    <button className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-purple-500/10 hover:text-purple-600" onClick={() => restart(s.id)} title="Restart Session">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4.5"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M9 3h6v6"/></svg>
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm btn-square rounded-xl text-error hover:bg-error/10 hover:border-error/20 border border-transparent" onClick={() => terminate(s.id)} title="Delete Session">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modern QR / Pairing Code Modal */}
      {qrSession && (
        <dialog className="modal modal-open bg-black/50 backdrop-blur-md" onClick={closeQR}>
          <div className="modal-box glass-card border border-base-300/40 rounded-3xl shadow-2xl p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <h3 className="font-extrabold text-xl leading-tight">Link Device</h3>
            <p className="text-xs text-base-content/50 mt-1 mb-4">
              {currentSession?.status === 'connected'
                ? 'Device Linked Successfully'
                : 'Choose a method to link your WhatsApp'}
            </p>

            {/* Link Mode Tab Switcher */}
            {currentSession?.status !== 'connected' && (
              <div className="tabs tabs-boxed bg-base-200/60 p-1 border border-base-300/20 rounded-xl mb-6 max-w-xs mx-auto flex">
                <button 
                  className={`tab flex-1 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${linkMode === 'qr' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow' : 'text-base-content/60'}`}
                  onClick={() => setLinkMode('qr')}
                >
                  QR Code
                </button>
                <button 
                  className={`tab flex-1 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${linkMode === 'pairing' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow' : 'text-base-content/60'}`}
                  onClick={() => setLinkMode('pairing')}
                >
                  Phone Number
                </button>
              </div>
            )}
            
            {linkMode === 'qr' ? (
              <>
                <div className="flex justify-center p-3 bg-white border border-base-300/50 rounded-2xl shadow-inner max-w-fit mx-auto">
                  {currentQR ? (
                    <img
                      key={currentQR}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}`}
                      alt="QR Code"
                      className="w-56 h-56 rounded-lg select-none"
                    />
                  ) : (
                    <div className="w-56 h-56 flex flex-col items-center justify-center text-base-content/40 bg-base-100 rounded-lg">
                      {currentSession?.status === 'waiting_qr' || currentSession?.status === 'restarting' ? (
                        <>
                          <span className="loading loading-ring loading-lg text-emerald-500 mb-2"></span>
                          <span className="text-[10px] font-medium opacity-60">Initializing WhatsApp Page...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-8 mb-2 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 3v18"/><path d="M15 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
                          <span className="text-xs font-semibold">No QR Code Available</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {currentQR && (
                  <p className="text-[10px] text-base-content/40 mt-3 flex items-center justify-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3 animate-spin text-emerald-500"><line x1="12" x2="12" y1="2" y2="6"/><line x1="12" x2="12" y1="18" y2="22"/><line x1="4.93" x2="7.76" y1="4.93" y2="7.76"/><line x1="16.24" x2="19.07" y1="16.24" y2="19.07"/><line x1="2" x2="6" y1="12" y2="12"/><line x1="18" x2="22" y1="12" y2="12"/><line x1="4.93" x2="7.76" y1="19.07" y2="16.24"/><line x1="16.24" x2="19.07" y1="7.76" y2="4.93"/></svg>
                    Syncing status dynamically
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4 max-w-xs mx-auto text-left">
                {!pairingCode ? (
                  <>
                    <div className="form-control w-full">
                      <label className="label py-1"><span className="label-text text-xs font-semibold">WhatsApp Number</span></label>
                      <input 
                        type="text" 
                        className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                        value={phoneNumberInput}
                        onChange={e => setPhoneNumberInput(e.target.value)}
                        placeholder="e.g. 628123456789"
                        disabled={pairingLoading}
                      />
                      <span className="text-[9px] opacity-40 mt-1">Include country code, numbers only (no spaces, dashes or +).</span>
                    </div>

                    {pairingError && (
                      <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 text-xs py-2 px-3 rounded-xl">
                        <span>{pairingError}</span>
                      </div>
                    )}

                    <button 
                      className="btn btn-primary w-full bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl text-white font-bold h-10 min-h-10 mt-2"
                      onClick={handleGeneratePairing}
                      disabled={pairingLoading}
                    >
                      {pairingLoading ? <span className="loading loading-spinner loading-xs text-white"></span> : 'Generate Pairing Code'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-4 text-center">
                    <p className="text-xs text-base-content/60">Enter this code on your mobile device:</p>
                    
                    <div className="flex justify-center py-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl font-mono font-black text-3xl tracking-widest text-emerald-600 select-all">
                      {pairingCode}
                    </div>

                    <div className="text-left text-xs bg-base-200/50 border border-base-300/40 p-4 rounded-xl space-y-2.5 text-base-content/85 leading-relaxed">
                      <div className="flex gap-2.5 items-start">
                        <span className="badge badge-sm badge-emerald font-bold shrink-0 mt-0.5">1</span>
                        <span>Open WhatsApp on your mobile phone.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="badge badge-sm badge-emerald font-bold shrink-0 mt-0.5">2</span>
                        <span>Tap <strong>Menu</strong> (Android) or <strong>Settings</strong> (iOS) &gt; <strong>Linked Devices</strong>.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="badge badge-sm badge-emerald font-bold shrink-0 mt-0.5">3</span>
                        <span>Tap <strong>Link a Device</strong> &gt; <strong>Link with phone number instead</strong>.</span>
                      </div>
                      <div className="flex gap-2.5 items-start">
                        <span className="badge badge-sm badge-emerald font-bold shrink-0 mt-0.5">4</span>
                        <span>Enter the 8-character code shown above.</span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-ghost btn-xs text-error hover:bg-error/10 rounded-lg px-4 mx-auto block mt-2"
                      onClick={handleCancelPairing}
                      disabled={pairingLoading}
                    >
                      {pairingLoading ? <span className="loading loading-spinner loading-xs"></span> : 'Cancel & Reset Request'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="modal-action justify-center mt-6 border-t border-base-300/40 pt-4">
              <button className="btn btn-sm btn-ghost rounded-xl px-6" onClick={closeQR}>Close Dialog</button>
            </div>
          </div>
        </dialog>
      )}


    </div>
  )
}
