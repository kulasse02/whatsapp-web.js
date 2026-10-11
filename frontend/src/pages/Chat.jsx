import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'

const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏']

function MessageImage({ sessionId, chatId, msgWid }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    api.getMessageMedia(sessionId, chatId, msgWid)
      .then(r => {
        if (cancelled) return
        if (r.success && r.data) {
          setSrc(`data:${r.mimetype || 'image/jpeg'};base64,${r.data}`)
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => { cancelled = true }
  }, [sessionId, chatId, msgWid])

  if (src) return <img src={src} alt="" className="max-w-xs rounded-xl shadow-sm border border-base-300/40 hover:scale-[1.02] transition-transform duration-200" loading="lazy" />

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-xs font-medium">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>Gambar kedaluwarsa atau tidak ditemukan</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-base-200/50 rounded-xl border border-base-300/40 text-xs italic opacity-70">
      <span className="loading loading-spinner loading-xs text-emerald-500"></span>
      <span>Downloading image...</span>
    </div>
  )
}

function extractPhone(chatId) {
  if (!chatId) return ''
  const num = chatId.split('@')[0]
  if (!num || num.length < 6) return ''
  if (num.startsWith('62')) return '+62 ' + num.slice(2).replace(/(\d{3})(\d{4})(\d{4,})/, '$1-$2-$3')
  return '+' + num
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function chatName(c) {
  return c.name || c.formattedTitle || ''
}

function chatIdStr(c) {
  return c.id?._serialized || c.id || ''
}

function lastMsg(c) {
  const m = c.lastMessage
  if (!m) return ''
  if (typeof m === 'object') return m.body || ''
  return ''
}

export default function Chat() {
  const { sessionId, chatId: paramChatId } = useParams()
  const navigate = useNavigate()
  const [selectedChat, setSelectedChat] = useState(paramChatId || null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatList, setChatList] = useState([])
  const [loadingChats, setLoadingChats] = useState(true)
  const [chatError, setChatError] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const fileRef = useRef(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const [search, setSearch] = useState('')
  const [profilePics, setProfilePics] = useState({})
  const [reactingMsg, setReactingMsg] = useState(null)
  const [searchInChat, setSearchInChat] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [reactions, setReactions] = useState({})
  const [selectedFile, setSelectedFile] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)

  // Catalog integration states
  const [showCatalogSelector, setShowCatalogSelector] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState([])
  const [attemptedPics, setAttemptedPics] = useState({})

  useEffect(() => {
    loadChats()
    const interval = setInterval(loadChats, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  useEffect(() => {
    if (paramChatId) {
      setSelectedChat(paramChatId)
      if (paramChatId.includes('@c.us')) {
        const num = paramChatId.split('@')[0]
        api.getNumberId(sessionId, num).then(r => {
          if (r.success && r.result?._serialized && r.result._serialized !== paramChatId) {
            navigate(`/session/${sessionId}/chat/${r.result._serialized}`, { replace: true })
          }
        }).catch(() => {})
      }
    }
  }, [paramChatId])

  useEffect(() => {
    if (selectedChat) {
      loadMessages()
      fetchReactionsRef.current()
      api.sendSeen(sessionId, selectedChat).catch(() => {})
      const iv = setInterval(() => {
        loadMessages()
        fetchReactionsRef.current()
      }, 3000)
      return () => clearInterval(iv)
    }
  }, [selectedChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchReactionsRef = useRef(async () => {})
  fetchReactionsRef.current = async () => {
    if (!selectedChat || !messages.length) return
    const ids = messages.map(m => msgFullId(m)).filter(Boolean)
    if (!ids.length) return
    const chunk = ids.slice(0, 10)
    const results = await Promise.all(chunk.map(fullId =>
      api.getMessageReactions(sessionId, selectedChat, fullId)
        .then(r => r.success && r.reactions?.length ? { fullId, reactions: r.reactions } : null)
        .catch(() => null)
    ))
    const updates = {}
    for (const r of results) {
      if (r) updates[r.fullId] = r.reactions
    }
    if (Object.keys(updates).length) setReactions(prev => ({ ...prev, ...updates }))
  }

  const loadChats = async () => {
    try {
      const res = await api.getChats(sessionId)
      let list = []
      if (res.success && Array.isArray(res.data)) list = res.data
      else if (res.success && Array.isArray(res.result)) list = res.result
      else if (res.success && Array.isArray(res.chats)) list = res.chats
      else { setChatError(res.error || 'Failed to load chats'); return }
      setChatList(list)
      setChatError('')
      const ids = list.map(c => chatIdStr(c)).filter(Boolean)
      loadProfilePics(ids.slice(0, 20))
    } catch (err) {
      setChatError(err.message || 'Failed to load chats')
    } finally {
      setLoadingChats(false)
    }
  }

  const loadProfilePics = async (ids) => {
    const cache = {}
    const newAttempted = { ...attemptedPics }
    let hasNewAttempt = false

    const pendingIds = ids.filter(id => !profilePics[id] && !attemptedPics[id])
    if (pendingIds.length === 0) return

    await Promise.all(pendingIds.slice(0, 5).map(async (id) => {
      newAttempted[id] = true
      hasNewAttempt = true
      try {
        const r = await api.getProfilePicUrl(sessionId, id)
        if (r.success && r.result) {
          cache[id] = r.result
        }
      } catch (_) {}
    }))

    if (hasNewAttempt) setAttemptedPics(newAttempted)
    if (Object.keys(cache).length) setProfilePics(prev => ({ ...prev, ...cache }))
  }

  const loadMessages = async () => {
    try {
      const res = await api.getMessages(sessionId, selectedChat, 100)
      if (res.success && Array.isArray(res.messages)) {
        setMessages(prev => {
          // Preserve any temp/pending messages not yet committed in db
          const tempMsgs = prev.filter(m => {
            const wid = m.msgWid || m.id?.id
            return wid && String(wid).startsWith('temp-')
          })
          if (!tempMsgs.length) return res.messages
          // Merge avoiding duplicates by msgWid
          const dbWids = new Set(res.messages.map(m => m.msgWid).filter(Boolean))
          const remainingTemp = tempMsgs.filter(m => !dbWids.has(m.msgWid))
          return [...res.messages, ...remainingTemp]
        })
      }
    } catch (_) {}
  }

  const selectChat = (chatId) => {
    setSelectedChat(chatId)
    setShowNewChat(false)
    setSearch('')
    setSearchInChat('')
    setSearchResults([])
    navigate(`/session/${sessionId}/chat/${chatId}`, { replace: true })
  }

  const startNewChat = async (e) => {
    e.preventDefault()
    const num = newNumber.replace(/\D/g, '')
    if (!num) return
    const chatId = num.startsWith('62') ? `${num}@c.us` : `62${num}@c.us`
    setNewNumber('')
    setShowNewChat(false)
    await api.sendTextMessage(sessionId, chatId, ' ')
    api.getNumberId(sessionId, num).then(r => {
      if (r.success && r.result?._serialized) selectChat(r.result._serialized)
      else selectChat(chatId)
    }).catch(() => selectChat(chatId))
  }

  const openCatalogSelector = async () => {
    try {
      const res = await api.getCatalogs(sessionId)
      if (res.success) {
        setCatalogProducts(res.data)
        setShowCatalogSelector(true)
      }
    } catch (err) {
      alert(err.message || 'Failed to load catalog')
    }
  }

  const sendCatalogProduct = async (product) => {
    setShowCatalogSelector(false)
    setSending(true)
    try {
      const caption = `*${product.name}*\n\n${product.description}\n\n*Harga:* Rp ${product.price ? product.price.toLocaleString('id-ID') : '0'}`
      if (product.image_base64) {
        await api.sendMediaMessage(sessionId, selectedChat, 'image/jpeg', product.image_base64, `${product.name}.jpg`, caption)
      } else {
        await api.sendTextMessage(sessionId, selectedChat, caption)
      }
      // Reload logs
      setTimeout(loadChats, 500)
    } catch (err) {
      alert('Failed to send product: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const sendMsg = async (e) => {
    e.preventDefault()
    if (!selectedChat || sending) return
    const file = selectedFile
    if (file) {
      setSending(true)
      try {
        const toBase64 = (f) => new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(r.result.split(',')[1])
          r.onerror = reject
          r.readAsDataURL(f)
        })
        const data = await toBase64(file)
        const res = await api.sendMediaMessage(sessionId, selectedChat, file.type, data, file.name)
        if (res.success) {
          setMessages(prev => [...prev, { fromMe: true, body: file.type.startsWith('image/') ? '[Image]' : `[${file.name}]`, timestamp: Math.floor(Date.now() / 1000), id: { _serialized: 'temp-' + Date.now(), id: 'temp-' + Date.now() }, messageType: file.type.startsWith('image/') ? 'image' : 'document' }])
        }
        setSelectedFile(null)
        if (fileRef.current) fileRef.current.value = ''
      } catch (err) { console.error(err) } finally { setSending(false) }
      return
    }
    if (!input.trim()) return
    const text = input
    const quoted = replyingTo
    setInput('')
    setReplyingTo(null)
    try {
      let res
      if (quoted) {
        res = await api.replyMessage(sessionId, selectedChat, quoted.fullId, text)
      } else {
        res = await api.sendTextMessage(sessionId, selectedChat, text)
      }
      if (res.success) {
        setMessages(prev => [...prev, {
          fromMe: true, body: text, timestamp: Math.floor(Date.now() / 1000),
          id: { _serialized: 'temp-' + Date.now(), id: 'temp-' + Date.now() },
          parentMsgId: quoted ? quoted.wid : null,
          parentMsgBody: quoted ? quoted.body : null
        }])
      }
    } catch (err) { console.error(err) }
  }

  const msgFullId = (m) => {
    const wid = m.msgWid || m.id?.id
    if (!wid || wid.startsWith('temp-')) return null
    const fromMe = m.fromMe
    const remote = m.remoteJid || m.remote_jid || m.id?.remote || selectedChat
    return `${fromMe ? 'true' : 'false'}_${remote}_${wid}`
  }

  const handleReact = async (m, emoji) => {
    const fullId = msgFullId(m)
    if (!fullId) return
    setReactingMsg(null)
    try {
      await api.sendReactionDirect(sessionId, selectedChat, fullId, emoji)
      setReactions(prev => {
        const existing = prev[fullId] || []
        const newR = { emoji, senderId: 'me', ts: Math.floor(Date.now() / 1000) }
        return { ...prev, [fullId]: [...existing, newR] }
      })
    } catch (err) { console.error('react error:', err.message) }
  }

  const handleStar = async (m) => {
    const id = msgFullId(m)
    if (!id) return
    try {
      if (m.starred) await api.unstarMessage(sessionId, selectedChat, id)
      else await api.starMessage(sessionId, selectedChat, id)
      setMessages(prev => prev.map(x => (msgFullId(x) === id) ? { ...x, starred: !x.starred } : x))
    } catch (err) { console.error(err.message) }
  }

  const handleDelete = async (m) => {
    const id = msgFullId(m)
    if (!id) return
    try {
      await api.deleteMessage(sessionId, selectedChat, id, false)
      setMessages(prev => prev.filter(x => msgFullId(x) !== id))
    } catch (err) { console.error(err.message) }
  }

  const handleSearchInChat = async (query) => {
    setSearchInChat(query)
    if (!query.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await api.searchMessages(sessionId, query)
      if (res.success && Array.isArray(res.messages)) setSearchResults(res.messages)
    } catch (_) {} finally { setSearching(false) }
  }

  const currentChat = chatList.find(c => chatIdStr(c) === selectedChat)
  const filteredChats = chatList.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return chatName(c).toLowerCase().includes(q) || chatIdStr(c).toLowerCase().includes(q)
  })

  return (
    <div className="flex h-[calc(100vh-4.1rem)] gap-0 overflow-hidden bg-base-200/20 relative">
      {/* Sidebar - Chats List */}
      <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 bg-base-100 flex-col border-r border-base-300/60 shrink-0`}>
        <div className="p-4 border-b border-base-300/60 bg-base-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Chats</h2>
            <button 
              className={`btn btn-ghost btn-xs btn-square size-8 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-600 border border-transparent transition-all ${showNewChat ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}`} 
              onClick={() => setShowNewChat(!showNewChat)} 
              title="Start New Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          </div>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-base-content/40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9 rounded-xl border-base-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs"
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {showNewChat && (
          <form onSubmit={startNewChat} className="p-3 border-b border-base-300/50 bg-emerald-500/5 transition-all">
            <div className="flex gap-2">
              <input 
                type="text" 
                className="input input-bordered input-sm flex-1 rounded-xl text-xs" 
                placeholder="Phone number (e.g. 6281...)" 
                value={newNumber} 
                onChange={e => setNewNumber(e.target.value)} 
                autoFocus 
              />
              <button type="submit" className="btn btn-primary btn-sm rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white text-xs px-4">Start</button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-base-200/60">
          {loadingChats && (
            <div className="flex justify-center py-12">
              <span className="loading loading-ring loading-md text-emerald-500" />
            </div>
          )}
          {filteredChats.map((c, i) => {
            const id = chatIdStr(c)
            const name = chatName(c)
            const phone = name ? extractPhone(id) : id.split('@')[0]
            const pic = profilePics[id]
            const isSelected = selectedChat === id
            return (
              <div
                key={id || i}
                className={`flex items-center gap-3.5 px-4 py-3.5 cursor-pointer transition-all-300 border-l-4 ${
                  isSelected 
                    ? 'bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border-emerald-500 bg-base-200/40' 
                    : 'border-transparent hover:bg-base-200/50'
                }`}
                onClick={() => selectChat(id)}
              >
                <div className="avatar shrink-0">
                  <div className="size-11 rounded-full shadow-sm ring-1 ring-base-300/40">
                    {pic ? (
                      <img src={pic} alt="" className="object-cover" />
                    ) : (
                      <div className="bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
                        {(name || phone || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className={`text-xs font-semibold truncate ${isSelected ? 'text-emerald-700' : 'text-base-content'}`}>{name || phone}</span>
                  </div>
                  <div className="text-[11px] text-base-content/50 truncate flex items-center gap-1">
                    {name && <span className="opacity-70">{phone}</span>}
                    {name && lastMsg(c) && <span className="opacity-40">•</span>}
                    <span className="truncate">{lastMsg(c)}</span>
                  </div>
                </div>
              </div>
            )
          })}
          {!loadingChats && filteredChats.length === 0 && (
            <div className="p-8 text-xs text-center">
              {chatError ? (
                <div className="alert alert-error bg-red-500/10 text-red-700 border-red-500/20 text-xs rounded-xl">{chatError}</div>
              ) : (
                <span className="text-base-content/40">{search ? 'No matches found' : 'Start a chat above'}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`${!selectedChat ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-base-100 min-w-0`}>
        {selectedChat ? (
          <>
            {/* Chat Window Header */}
            <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-base-300/60 bg-base-100/90 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Back to chat list button on mobile */}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square md:hidden text-base-content/70 hover:bg-base-200 -ml-1"
                  onClick={() => setSelectedChat(null)}
                  title="Back to conversation list"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="avatar">
                  <div className="size-10 rounded-full shadow-sm ring-1 ring-base-300/40">
                    {currentChat && profilePics[chatIdStr(currentChat)] ? (
                      <img src={profilePics[chatIdStr(currentChat)]} alt="" className="object-cover" />
                    ) : (
                      <div className="bg-gradient-to-tr from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                        {(chatName(currentChat) || extractPhone(selectedChat) || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-base-content truncate">{chatName(currentChat) || extractPhone(selectedChat) || selectedChat}</div>
                  {chatName(currentChat) && <div className="text-[10px] text-base-content/50 font-medium truncate mt-0.5">{extractPhone(selectedChat)}</div>}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-base-content/40"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input 
                    type="text" 
                    className="input input-bordered input-xs w-32 md:w-44 pl-8 rounded-lg text-[10px] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/25 transition-all" 
                    placeholder="Search in chat..." 
                    value={searchInChat} 
                    onChange={e => handleSearchInChat(e.target.value)} 
                  />
                </div>
                {searching && <span className="loading loading-spinner loading-xs text-emerald-500 shrink-0" />}
              </div>
            </div>

            {/* In-Chat Search Results Panel */}
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto bg-base-200/70 border-b border-base-300/60 px-4 py-2.5 shrink-0 z-10">
                <div className="text-[10px] font-bold mb-1.5 text-base-content/60 uppercase tracking-wider">{searchResults.length} Match{searchResults.length !== 1 ? 'es' : ''} Found</div>
                <div className="space-y-1">
                  {searchResults.slice(0, 10).map((m, i) => (
                    <div key={i} className="text-xs truncate py-1.5 px-3 bg-base-100 hover:bg-base-200 border border-base-300/30 rounded-lg cursor-pointer transition-colors text-base-content/80">{m.body || '[Media]'}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Messages Content Viewport */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-50/50">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-base-content/30 text-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10 mb-2 opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>No messages in this chat</span>
                </div>
              )}
              
              {messages.map((m, i) => {
                const msgId = m.id?.id || m.msgWid
                const fullId = msgFullId(m)
                return (
                  <div key={m.id?._serialized || i} className={`chat ${m.fromMe ? 'chat-end' : 'chat-start'} animate-fade-in`}>
                    <div className="chat-bubble relative group px-3.5 py-2.5 max-w-md md:max-w-lg break-words shadow-sm"
                      style={
                        m.fromMe 
                          ? { background: 'linear-gradient(to bottom right, var(--color-emerald-500), var(--color-teal-600))', color: 'white', borderBottomRightRadius: '4px' } 
                          : { background: 'var(--color-base-100)', color: 'var(--color-base-content)', borderBottomLeftRadius: '4px', border: '1px solid rgba(156, 163, 175, 0.15)' }
                      }
                      onDoubleClick={() => msgId && !msgId.startsWith('temp-') && setReactingMsg(reactingMsg === msgId ? null : msgId)}
                    >
                      {/* Quoted / Reply preview inside bubble */}
                      {m.parentMsgBody && (
                        <div className="mb-2 px-2.5 py-1.5 rounded-lg border-l-3 text-[11px] leading-snug cursor-pointer"
                          style={
                            m.fromMe
                              ? { background: 'rgba(255,255,255,0.15)', borderLeftColor: 'rgba(255,255,255,0.6)', color: 'rgba(255,255,255,0.85)' }
                              : { background: 'rgba(16,185,129,0.08)', borderLeftColor: 'var(--color-emerald-500)', color: 'var(--color-base-content)' }
                          }
                        >
                          <span className="font-semibold opacity-70 block mb-0.5" style={{ fontSize: '10px' }}>Replying to</span>
                          <span className="line-clamp-2 opacity-90">{m.parentMsgBody}</span>
                        </div>
                      )}

                      {/* Media Renderers */}
                      {m.messageType === 'image' && m.mediaPath ? (
                        <img src={m.mediaPath} alt="" className="max-w-xs rounded-xl mb-1.5 shadow-sm" loading="lazy" />
                      ) : m.messageType === 'image' && m.msgWid ? (
                        <MessageImage sessionId={sessionId} chatId={selectedChat} msgWid={m.msgWid} />
                      ) : m.messageType === 'image' ? (
                        <span className="italic opacity-70 text-xs flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>[Image]</span>
                      ) : m.messageType === 'document' || m.messageType === 'ptt' ? (
                        <span className="italic opacity-70 text-xs flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>[{m.messageType === 'ptt' ? 'Audio Clip' : 'Document File'}]</span>
                      ) : m.messageType === 'sticker' ? (
                        <span className="italic opacity-70 text-xs">[Sticker]</span>
                      ) : null}

                      {/* Message Text Body with newline processing */}
                      {m.body && (
                        <span className="text-[13px] leading-relaxed block">
                          {m.body.split('\n').map((line, idx, arr) => (
                            <span key={idx}>
                              {line}
                              {idx < arr.length - 1 && <br />}
                            </span>
                          ))}
                        </span>
                      )}

                      {/* Message Footer Info */}
                      <div className="flex items-center justify-end gap-1 mt-1 opacity-60 text-[9px] select-none">
                        <span>{formatTime(m.timestamp)}</span>
                        {m.fromMe && m.starred && <span>★</span>}
                      </div>

                      {/* Floating actions menu (reveals on hover) */}
                      <div className="absolute top-0 right-0 hidden group-hover:flex gap-1 -translate-y-1/2 translate-x-2 z-20">
                        {msgId && !msgId.startsWith('temp-') && (
                          <>
                            <button className="btn btn-xs btn-circle bg-base-100 hover:bg-emerald-500/15 hover:text-emerald-600 border border-base-300/40 shadow-md size-7 p-0 hover:scale-105 transition-all" onClick={() => setReplyingTo({ wid: msgId, fullId, body: m.body || '[Media]' })} title="Reply Message">
                               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v.5"/></svg>
                             </button>
                            <button className="btn btn-xs btn-circle bg-base-100 hover:bg-base-200 border border-base-300/40 shadow-md size-7 p-0 hover:scale-105 transition-all text-xs" onClick={() => handleStar(m)} title={m.starred ? 'Unstar Message' : 'Star Message'}>
                              <span className={m.starred ? 'text-amber-500 font-bold' : 'text-base-content/60'}>{m.starred ? '★' : '☆'}</span>
                            </button>
                            <button className="btn btn-xs btn-circle bg-base-100 hover:bg-base-200 border border-base-300/40 shadow-md size-7 p-0 hover:scale-105 transition-all" onClick={() => setReactingMsg(reactingMsg === msgId ? null : msgId)} title="Add Reaction">😊</button>
                            <button className="btn btn-xs btn-circle bg-base-100 hover:bg-error/15 border border-base-300/40 shadow-md size-7 p-0 hover:scale-105 transition-all text-error/80" onClick={() => handleDelete(m)} title="Delete Message">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Reaction Picker floating popover */}
                      {reactingMsg === msgId && (
                        <div className="absolute -bottom-10 left-0 flex gap-1 bg-base-100 shadow-xl rounded-2xl p-1.5 z-30 border border-base-300/60 animate-bounce-in">
                          {EMOJIS.map(e => (
                            <button key={e} className="btn btn-xs btn-ghost hover:bg-base-200 rounded-lg hover:scale-125 text-base size-7 p-0 transition-transform" onClick={() => handleReact(m, e)}>{e}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reactions pill */}
                    {(() => {
                      const fId = msgFullId(m)
                      const reacts = fId ? reactions[fId] : null
                      if (reacts && reacts.length) return (
                        <div className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'} mt-0.5 mr-1 ml-1 z-10`}>
                          <div className="bg-base-100 rounded-full shadow-sm px-2.5 py-0.5 flex gap-1 border border-base-300/50 text-[11px] leading-tight select-none">
                            {reacts.map((r, ri) => <span key={ri} title={`Reaction from sender`}>{r.emoji}</span>)}
                          </div>
                        </div>
                      )
                      return null
                    })()}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Attachment preview bar */}
            {selectedFile && (
              <div className="px-5 py-2.5 bg-base-200/60 border-t border-base-300/60 flex items-center justify-between text-xs text-base-content/85 animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-emerald-500"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                  <span className="font-semibold truncate max-w-xs">{selectedFile.name}</span>
                  <span className="opacity-60">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-xs btn-circle text-error/85" 
                  onClick={() => {
                    setSelectedFile(null)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Reply Preview Bar */}
            {replyingTo && (
              <div className="px-5 py-2.5 bg-emerald-500/5 border-t border-emerald-500/20 flex items-center justify-between text-xs text-base-content/85 animate-fade-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-1 h-8 bg-emerald-500 rounded-full shrink-0"></div>
                  <div className="min-w-0">
                    <span className="font-bold text-emerald-600 block text-[10px] uppercase tracking-wider">Reply</span>
                    <span className="truncate block text-xs opacity-75 max-w-xs">{replyingTo.body}</span>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-error" 
                  onClick={() => setReplyingTo(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Input Form Panel */}
            <form onSubmit={sendMsg} className="px-5 py-3.5 border-t border-base-300/60 bg-base-100 flex gap-2 items-center shrink-0">
              <label className="btn btn-ghost btn-circle btn-sm hover:bg-slate-200/50 hover:text-slate-700 transition-colors cursor-pointer shrink-0" title="Attach Media File">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <input 
                  type="file" 
                  ref={fileRef} 
                  className="hidden" 
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-circle btn-sm hover:bg-slate-200/50 hover:text-slate-700 transition-colors shrink-0"
                title="Send Catalog Product"
                onClick={openCatalogSelector}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </button>
              <input
                type="text"
                className="input input-bordered flex-1 rounded-2xl text-xs px-4 py-2 border-base-300/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                placeholder="Type a WhatsApp message..."
                value={input} 
                onChange={e => setInput(e.target.value)}
              />
              <button 
                type="submit" 
                className="btn btn-primary btn-circle btn-sm bg-gradient-to-tr from-emerald-500 to-teal-600 border-none text-white shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all shrink-0 active:scale-95 disabled:bg-slate-100 disabled:text-slate-400" 
                disabled={sending || (!input.trim() && !selectedFile)}
              >
                {sending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Empty Chat state */
          <div className="flex-1 flex items-center justify-center bg-slate-50/50">
            <div className="text-center max-w-sm px-6">
              <div className="size-20 rounded-3xl bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-10 opacity-70"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 className="font-extrabold text-lg text-slate-800 leading-tight">No Active Conversation</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">Select a chat from the sidebar list or start a new connection to begin real-time messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Catalog Selector Modal */}
      {showCatalogSelector && (
        <dialog className="modal modal-open bg-black/40 backdrop-blur-sm" onClick={() => setShowCatalogSelector(false)}>
          <div className="modal-box glass-card border border-base-300/40 rounded-2xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4 border-b border-base-300/40 pb-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="size-5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">Send Catalog Product</h3>
                <p className="text-xs text-base-content/50">Select a product to share directly to this chat</p>
              </div>
            </div>

            {catalogProducts.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-sm font-semibold">Catalog is empty</p>
                <p className="text-xs text-base-content/50">Add products to your catalog from the Catalog menu first.</p>
                <button type="button" className="btn btn-xs btn-outline rounded-lg" onClick={() => { setShowCatalogSelector(false); navigate(`/session/${sessionId}/catalog`) }}>Go to Catalog</button>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                {catalogProducts.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-2 bg-base-200/50 border border-base-300/40 rounded-xl justify-between group hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-11 rounded-lg bg-base-300 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image_base64 ? (
                          <img src={`data:image/jpeg;base64,${p.image_base64}`} alt={p.name} className="size-full object-cover select-none" />
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-6 text-base-content/30"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/></svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs truncate">{p.name}</h4>
                        <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Rp {p.price ? p.price.toLocaleString('id-ID') : '0'}</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-xs bg-gradient-to-r from-emerald-500 to-teal-600 border-none text-white font-bold rounded-lg px-3 h-7 min-h-7" 
                      onClick={() => sendCatalogProduct(p)}
                    >
                      Send
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-action mt-6 justify-center">
              <button type="button" className="btn btn-sm btn-ghost rounded-xl px-5" onClick={() => setShowCatalogSelector(false)}>Close</button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  )
}
