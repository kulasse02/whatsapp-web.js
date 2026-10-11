import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

export default function Profile() {
  const { sessionId } = useParams()
  
  // Status states
  const [statusInput, setStatusInput] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  
  // Loading & Feedback states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Avatar upload states
  const [avatarBase64, setAvatarBase64] = useState('')
  const [avatarMimetype, setAvatarMimetype] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (!file.type.startsWith('image/')) {
      return setError('Only image files are allowed!')
    }

    setAvatarMimetype(file.type)
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result)
      const base64Data = reader.result.split(',')[1]
      setAvatarBase64(base64Data)
    }
    reader.readAsDataURL(file)
  }

  const showFeedback = (msg, isError = false) => {
    if (isError) {
      setError(msg)
      setTimeout(() => setError(''), 4000)
    } else {
      setSuccess(msg)
      setTimeout(() => setSuccess(''), 4000)
    }
  }

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!statusInput.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.setProfileStatus(sessionId, statusInput.trim())
      if (res.success) {
        showFeedback('WhatsApp status (bio) updated successfully!')
        setStatusInput('')
      }
    } catch (err) {
      showFeedback(err.message || 'Failed to update WhatsApp status', true)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDisplayName = async (e) => {
    e.preventDefault()
    if (!displayNameInput.trim()) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.setProfileDisplayName(sessionId, displayNameInput.trim())
      if (res.success) {
        showFeedback('Profile display name updated successfully!')
        setDisplayNameInput('')
      }
    } catch (err) {
      showFeedback(err.message || 'Failed to update display name (Note: Business account required)', true)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadAvatar = async () => {
    if (!avatarBase64 || !avatarMimetype) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.setProfilePicture(sessionId, avatarMimetype, avatarBase64)
      if (res.success) {
        showFeedback('Profile picture updated successfully!')
        setAvatarBase64('')
        setAvatarMimetype('')
        setAvatarPreview('')
      }
    } catch (err) {
      showFeedback(err.message || 'Failed to update profile picture', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 overflow-y-auto h-full text-base-content antialiased">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl border border-white/5 shadow-xl text-white">
        <h1 className="text-2xl font-extrabold tracking-tight">WhatsApp Profile Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Configure profile status bio, name, and profile picture for this active session.</p>
      </div>

      {/* Alert Feedbacks */}
      {error && (
        <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 rounded-2xl flex gap-3 text-sm py-3 px-4 shadow-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success bg-emerald-500/10 border-emerald-500/20 text-emerald-700 rounded-2xl flex gap-3 text-sm py-3 px-4 shadow-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Details Panel */}
        <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-3xl p-6 space-y-6">
          <h2 className="text-lg font-bold border-b border-base-300/40 pb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5 text-emerald-500"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            Edit Profile Info
          </h2>

          {/* Form Status Bio */}
          <form onSubmit={handleUpdateStatus} className="space-y-3">
            <div className="form-control w-full">
              <label className="label py-1"><span className="label-text text-xs font-semibold">WhatsApp Status / About Bio</span></label>
              <input 
                type="text" 
                className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-sm"
                value={statusInput}
                onChange={e => setStatusInput(e.target.value)}
                placeholder="e.g. Busy, Available, At work"
                disabled={loading}
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-sm bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl px-5 text-white font-bold h-9 min-h-9"
              disabled={loading || !statusInput.trim()}
            >
              {loading ? <span className="loading loading-spinner loading-xs text-white"></span> : 'Update Status Bio'}
            </button>
          </form>

          {/* Form Display Name */}
          <form onSubmit={handleUpdateDisplayName} className="space-y-3 pt-4 border-t border-base-300/30">
            <div className="form-control w-full">
              <label className="label py-1">
                <span className="label-text text-xs font-semibold">Display Profile Name</span>
              </label>
              <input 
                type="text" 
                className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-sm"
                value={displayNameInput}
                onChange={e => setDisplayNameInput(e.target.value)}
                placeholder="e.g. My Business Store"
                disabled={loading}
              />
              <span className="text-[10px] text-base-content/40 mt-1">This action is only supported for official WhatsApp Business Accounts.</span>
            </div>
            <button 
              type="submit" 
              className="btn btn-primary btn-sm bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl px-5 text-white font-bold h-9 min-h-9"
              disabled={loading || !displayNameInput.trim()}
            >
              {loading ? <span className="loading loading-spinner loading-xs text-white"></span> : 'Update Display Name'}
            </button>
          </form>
        </div>

        {/* Profile Picture Card */}
        <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-3xl p-6 flex flex-col items-center text-center justify-between min-h-[300px]">
          <div className="w-full space-y-4">
            <h2 className="text-lg font-bold border-b border-base-300/40 pb-3 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5 text-emerald-500"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              Profile Picture
            </h2>

            {/* Preview Box */}
            <div className="size-36 rounded-full border-4 border-emerald-500/20 bg-base-200 overflow-hidden mx-auto flex items-center justify-center relative group">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview Avatar" className="size-full object-cover select-none" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-14 text-base-content/30"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              )}
            </div>

            {/* Input File upload */}
            <div className="form-control w-full max-w-xs mx-auto">
              <input 
                type="file" 
                accept="image/*"
                className="file-input file-input-bordered file-input-sm w-full rounded-xl" 
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>
          </div>

          {avatarBase64 && (
            <button 
              className="btn btn-primary w-full max-w-xs bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl text-white font-bold h-10 min-h-10 mt-6"
              onClick={handleUploadAvatar}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-xs text-white"></span> : 'Set New Profile Picture'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
