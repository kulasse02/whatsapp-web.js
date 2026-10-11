import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../AuthContext'

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [allowRegister, setAllowRegister] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal states
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('create') // 'create' | 'edit'
  const [editingUserId, setEditingUserId] = useState(null)
  const [usernameInput, setUsernameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [isAdminInput, setIsAdminInput] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const usersRes = await api.getAdminUsers()
      if (usersRes.success) setUsers(usersRes.data)

      const settingsRes = await api.getAdminSettings()
      if (settingsRes.success && settingsRes.data) {
        setAllowRegister(settingsRes.data.allow_register === 'true')
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch admin data')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleRegister = async (checked) => {
    try {
      setError('')
      const res = await api.updateAdminSettings({ allow_register: checked ? 'true' : 'false' })
      if (res.success) {
        setAllowRegister(checked)
        showToast('Settings updated successfully')
      }
    } catch (err) {
      setError(err.message || 'Failed to update settings')
    }
  }

  const openCreateModal = () => {
    setModalType('create')
    setEditingUserId(null)
    setUsernameInput('')
    setPasswordInput('')
    setIsAdminInput(false)
    setShowModal(true)
  }

  const openEditModal = (user) => {
    setModalType('edit')
    setEditingUserId(user.id)
    setUsernameInput(user.username)
    setPasswordInput('')
    setIsAdminInput(user.is_admin === 1)
    setShowModal(true)
  }

  const handleSaveUser = async (e) => {
    e.preventDefault()
    setError('')
    if (!usernameInput.trim()) return setError('Username is required')
    if (modalType === 'create' && !passwordInput) return setError('Password is required')

    try {
      if (modalType === 'create') {
        const res = await api.createAdminUser(usernameInput.trim(), passwordInput, isAdminInput)
        if (res.success) {
          showToast('User created successfully')
          setShowModal(false)
          fetchData()
        }
      } else {
        const res = await api.updateAdminUser(editingUserId, usernameInput.trim(), passwordInput, isAdminInput)
        if (res.success) {
          showToast('User updated successfully')
          setShowModal(false)
          fetchData()
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save user')
    }
  }

  const handleDeleteUser = async (id) => {
    if (id === currentUser.id) return
    if (!confirm('Are you sure you want to delete this user? All their associated sessions and messages will be permanently deleted!')) return
    setError('')
    try {
      const res = await api.deleteAdminUser(id)
      if (res.success) {
        showToast('User deleted successfully')
        fetchData()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const showToast = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 overflow-y-auto h-full text-base-content antialiased">
      {/* Top Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl border border-white/5 shadow-xl text-white">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold tracking-tight">User Management</h1>
          <p className="text-xs text-slate-400">Manage user accounts and system configuration settings.</p>
        </div>

        {/* Allow Register Toggle Box */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
          <div className="flex flex-col">
            <span className="text-xs font-bold">Allow Public Register</span>
            <span className="text-[10px] text-slate-400">Allow new users to sign up</span>
          </div>
          <input 
            type="checkbox" 
            className="toggle toggle-emerald toggle-md border-white/20" 
            checked={allowRegister}
            onChange={(e) => handleToggleRegister(e.target.checked)}
          />
        </div>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 rounded-2xl flex gap-3 text-sm py-3.5 px-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success bg-emerald-500/10 border-emerald-500/20 text-emerald-700 rounded-2xl flex gap-3 text-sm py-3.5 px-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="font-semibold">{success}</span>
        </div>
      )}

      {/* Main Panel Content Card */}
      <div className="card bg-base-100 border border-base-300/60 shadow-sm rounded-3xl">
        <div className="card-body p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">System Users ({users.length})</h2>
            <button 
              className="btn btn-primary btn-sm bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 gap-2 shrink-0 transition-transform active:scale-95 px-4 h-9" 
              onClick={openCreateModal}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              Add User
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="loading loading-spinner loading-lg text-emerald-500"></span>
              <span className="text-xs font-semibold text-base-content/40">Loading users...</span>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="table w-full rounded-2xl border border-base-300/40">
                <thead>
                  <tr className="bg-base-200/50 text-base-content/60 font-semibold border-b border-base-300/40">
                    <th className="rounded-tl-2xl">Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th className="text-center rounded-tr-2xl w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300/30">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-base-200/20 transition-all duration-200">
                      <td className="font-medium font-mono text-sm">{u.username}</td>
                      <td>
                        {u.is_admin === 1 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20">
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">
                            User
                          </span>
                        )}
                      </td>
                      <td className="text-xs text-base-content/50 font-mono">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            className="btn btn-ghost btn-xs btn-square rounded-lg hover:bg-emerald-500/10 hover:text-emerald-600 size-7" 
                            onClick={() => openEditModal(u)}
                            title="Edit User"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                          </button>
                          <button 
                            className={`btn btn-ghost btn-xs btn-square rounded-lg hover:bg-error/10 hover:text-error size-7 ${u.id === currentUser.id ? 'btn-disabled opacity-30' : ''}`}
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={u.id === currentUser.id}
                            title={u.id === currentUser.id ? "You cannot delete yourself" : "Delete User"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Styled Add/Edit Modal */}
      {showModal && (
        <dialog className="modal modal-open bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="modal-box glass-card border border-base-300/40 rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{modalType === 'create' ? 'Add System User' : 'Edit User Settings'}</h3>
                <p className="text-xs text-base-content/50">Setup credentials and permission levels</p>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">Username</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                  value={usernameInput}
                  onChange={e => setUsernameInput(e.target.value)}
                  placeholder="username"
                  required
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1">
                  <span className="label-text text-xs font-semibold">
                    {modalType === 'create' ? 'Password' : 'Password (leave blank to keep unchanged)'}
                  </span>
                </label>
                <input 
                  type="password" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder={modalType === 'create' ? "••••••••" : "Keep current password"}
                  required={modalType === 'create'}
                />
              </div>

              <div className="form-control pt-2">
                <label className="label cursor-pointer justify-start gap-3 p-0 select-none">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary checkbox-xs rounded animate-none" 
                    checked={isAdminInput}
                    onChange={e => setIsAdminInput(e.target.checked)}
                    disabled={editingUserId === currentUser.id}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Grant Administrator Role</span>
                    <span className="text-[10px] opacity-50">Admin users can manage other users and configurations</span>
                  </div>
                </label>
              </div>

              <div className="modal-action gap-2 mt-8">
                <button type="button" className="btn btn-ghost rounded-xl px-5" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary bg-gradient-to-r from-emerald-500 to-teal-600 border-none hover:opacity-90 rounded-xl px-5 text-white">Save Changes</button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </div>
  )
}
