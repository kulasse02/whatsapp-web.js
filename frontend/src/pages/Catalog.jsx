import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

export default function Catalog() {
  const { sessionId } = useParams()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Modal form states
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('create') // 'create' | 'edit'
  const [editingProductId, setEditingProductId] = useState(null)
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageBase64, setImageBase64] = useState('')
  const [imagePreview, setImagePreview] = useState('')

  useEffect(() => {
    fetchCatalog()
  }, [sessionId])

  const fetchCatalog = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getCatalogs(sessionId)
      if (res.success) {
        setProducts(res.data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog products')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const openCreateModal = () => {
    setModalType('create')
    setEditingProductId(null)
    setName('')
    setDescription('')
    setPrice('')
    setImageBase64('')
    setImagePreview('')
    setShowModal(true)
  }

  const openEditModal = (p) => {
    setModalType('edit')
    setEditingProductId(p.id)
    setName(p.name)
    setDescription(p.description || '')
    setPrice(p.price ? String(p.price) : '')
    setImageBase64(p.image_base64 || '')
    setImagePreview(p.image_base64 ? `data:image/jpeg;base64,${p.image_base64}` : '')
    setShowModal(true)
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      return setError('Only image files are allowed!')
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result)
      const base64Data = reader.result.split(',')[1]
      setImageBase64(base64Data)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) return setError('Product name is required')

    const productPayload = {
      name: name.trim(),
      description: description.trim(),
      price: price ? parseFloat(price) : 0,
      image_base64: imageBase64
    }

    try {
      if (modalType === 'create') {
        const res = await api.createCatalog(sessionId, productPayload)
        if (res.success) {
          showToast('Product added successfully!')
          setShowModal(false)
          fetchCatalog()
        }
      } else {
        const res = await api.updateCatalog(sessionId, editingProductId, productPayload)
        if (res.success) {
          showToast('Product updated successfully!')
          setShowModal(false)
          fetchCatalog()
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save product')
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!confirm('Are you sure you want to remove this product from the catalog?')) return
    setError('')
    try {
      const res = await api.deleteCatalog(sessionId, id)
      if (res.success) {
        showToast('Product removed successfully!')
        fetchCatalog()
      }
    } catch (err) {
      setError(err.message || 'Failed to delete product')
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 overflow-y-auto h-full text-base-content antialiased">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 bg-gradient-to-r from-slate-900 to-slate-800 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5 shadow-xl text-white">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Business Catalog Manager</h1>
          <p className="text-xs text-slate-400">Manage products or services details. You can easily share these catalog items during chats.</p>
        </div>
        <button 
          className="btn btn-primary btn-sm bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 gap-2 shrink-0 transition-transform active:scale-95 px-4 h-9 self-start sm:self-center"
          onClick={openCreateModal}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add Product
        </button>
      </div>

      {/* Feedbacks */}
      {error && (
        <div className="alert alert-error bg-red-500/10 border-red-500/20 text-red-600 rounded-2xl flex gap-3 text-sm py-3.5 px-4 shadow-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success bg-emerald-500/10 border-emerald-500/20 text-emerald-700 rounded-2xl flex gap-3 text-sm py-3.5 px-4 shadow-sm font-semibold">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-5 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>{success}</span>
        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="loading loading-spinner loading-lg text-emerald-500"></span>
          <span className="text-xs font-semibold text-base-content/40">Loading business catalog...</span>
        </div>
      ) : (
        <>
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-base-100 border border-base-300/40 rounded-3xl text-center shadow-sm">
              <div className="size-16 rounded-2xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-8"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <h3 className="text-lg font-bold">Catalog is Empty</h3>
              <p className="text-sm text-base-content/50 max-w-sm mt-1 mb-6">Create catalogs for your products or services here, then you can instantly share them with users in chats.</p>
              <button className="btn btn-sm btn-outline border-base-300 rounded-xl px-4" onClick={openCreateModal}>
                Create First Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {products.map(p => (
                <div key={p.id} className="card bg-base-100 border border-base-300/60 shadow-sm rounded-2xl hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
                  <div className="space-y-4">
                    {/* Picture area */}
                    <div className="h-44 w-full bg-base-200 border-b border-base-300/40 flex items-center justify-center overflow-hidden relative">
                      {p.image_base64 ? (
                        <img src={`data:image/jpeg;base64,${p.image_base64}`} alt={p.name} className="w-full h-full object-cover select-none" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-12 text-base-content/30"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                      )}
                    </div>
                    
                    {/* Content area */}
                    <div className="px-5 space-y-2">
                      <h3 className="font-bold text-base leading-snug tracking-tight text-base-content">{p.name}</h3>
                      <p className="text-sm font-bold text-emerald-600">Rp {p.price ? p.price.toLocaleString('id-ID') : '0'}</p>
                      {p.description && (
                        <p className="text-xs text-base-content/60 line-clamp-3 leading-relaxed">
                          {p.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-5 border-t border-base-300/40 mt-6 flex items-center justify-end gap-2">
                    <button 
                      className="btn btn-ghost btn-sm btn-square rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 size-8"
                      onClick={() => openEditModal(p)}
                      title="Edit Product"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm btn-square rounded-xl text-error hover:bg-error/10 hover:border-error/20 border border-transparent size-8"
                      onClick={() => handleDeleteProduct(p.id)}
                      title="Delete Product"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-4"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Styled Product Modal */}
      {showModal && (
        <dialog className="modal modal-open bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="modal-box glass-card border border-base-300/40 rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">{modalType === 'create' ? 'Add Catalog Product' : 'Edit Catalog Product'}</h3>
                <p className="text-xs text-base-content/50">Setup catalog items details & picture</p>
              </div>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              {/* Image upload field */}
              <div className="form-control w-full flex flex-col items-center justify-center border-2 border-dashed border-base-300 rounded-2xl p-4 bg-base-200/50 hover:bg-base-200 transition-all relative overflow-hidden group">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Image Preview" className="h-32 object-contain rounded-xl select-none" />
                    <button 
                      type="button" 
                      className="absolute right-2 top-2 btn btn-xs btn-circle btn-error text-white" 
                      onClick={() => { setImagePreview(''); setImageBase64('') }}
                    >✕</button>
                  </>
                ) : (
                  <label className="flex flex-col items-center justify-center size-full cursor-pointer select-none">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-8 text-base-content/40 mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                    <span className="text-xs font-bold text-base-content/55">Upload Product Picture</span>
                    <span className="text-[10px] text-base-content/40 mt-1">Image size max 5MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">Product Name</span></label>
                <input 
                  type="text" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Premium Leather Bag"
                  required
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">Price (Rupiah)</span></label>
                <input 
                  type="number" 
                  className="input input-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-mono"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder="e.g. 150000"
                />
              </div>

              <div className="form-control w-full">
                <label className="label py-1"><span className="label-text text-xs font-semibold">Product Description</span></label>
                <textarea 
                  className="textarea textarea-bordered w-full rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs h-24"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide specifications, features, colors, etc."
                />
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
