import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'

const NODE_TYPES = [
  { type: 'trigger_contains', label: 'Trigger: Kata Kunci (Contains)', color: 'from-emerald-500 to-teal-600', icon: '⚡' },
  { type: 'trigger_exact', label: 'Trigger: Kata Persis (Exact)', color: 'from-emerald-600 to-teal-700', icon: '🎯' },
  { type: 'trigger_time', label: 'Trigger: Jam Kerja (Time Range)', color: 'from-emerald-500 to-green-600', icon: '🕒' },
  { type: 'trigger_media', label: 'Trigger: Tipe Media', color: 'from-emerald-500 to-emerald-700', icon: '📁' },
  { type: 'action_text', label: 'Action: Balas Pesan Teks', color: 'from-blue-500 to-indigo-600', icon: '💬' },
  { type: 'action_condition', label: 'Logic: Percabangan (If / Else)', color: 'from-amber-500 to-orange-600', icon: '🔀' },
]

export default function AutoReply() {
  const { sessionId } = useParams()
  const [activeTab, setActiveTab] = useState('flow') // 'flow' or 'table'
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Visual Nodes & Edges State
  const [nodes, setNodes] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)

  // Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const canvasRef = useRef(null)

  useEffect(() => {
    fetchRules()
  }, [sessionId])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res = await api.getAutoReplyRules(sessionId)
      if (res.success) {
        const fetchedRules = res.rules || []
        setRules(fetchedRules)
        
        // Convert rules into interactive flow nodes
        const generatedNodes = []
        fetchedRules.forEach((rule, idx) => {
          const yPos = 80 + idx * 160
          // Trigger Node
          const triggerId = `trig_${rule.id}`
          generatedNodes.push({
            id: triggerId,
            ruleId: rule.id,
            type: `trigger_${rule.trigger_type}`.includes('trigger_') ? `trigger_${rule.trigger_type}` : 'trigger_contains',
            title: `Trigger: ${rule.name}`,
            value: rule.trigger_value,
            apply_to: rule.apply_to,
            x: 80,
            y: yPos,
            isTrigger: true,
            targetActionId: `act_${rule.id}`
          })
          // Action Node
          generatedNodes.push({
            id: `act_${rule.id}`,
            ruleId: rule.id,
            type: 'action_text',
            title: `Balas: ${rule.name}`,
            value: rule.response_value,
            x: 460,
            y: yPos,
            isTrigger: false,
            sourceTriggerId: triggerId
          })
        })

        if (generatedNodes.length === 0) {
          // Default initial node
          generatedNodes.push(
            { id: 'trig_demo', type: 'trigger_contains', title: 'Trigger: Tanya Price', value: 'harga, pricelist', x: 80, y: 100, isTrigger: true, targetActionId: 'act_demo' },
            { id: 'act_demo', type: 'action_text', title: 'Balas: Info Pricelist', value: 'Halo, harga layanan kami mulai Rp 100rb!', x: 460, y: 100, isTrigger: false, sourceTriggerId: 'trig_demo' }
          )
        }
        setNodes(generatedNodes)
      }
    } catch (err) {
      setError(err.message || 'Gagal memuat aturan auto reply')
    } finally {
      setLoading(false)
    }
  }

  // Handle Dragging Nodes on Canvas
  const handleMouseDown = (e, node) => {
    e.stopPropagation()
    setSelectedNode(node)
    setDraggingNodeId(node.id)
    setDragOffset({
      x: e.clientX - node.x,
      y: e.clientY - node.y
    })
  }

  const handleMouseMove = (e) => {
    if (!draggingNodeId) return
    const newX = Math.max(20, e.clientX - dragOffset.x)
    const newY = Math.max(20, e.clientY - dragOffset.y)
    
    setNodes(nodes.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
  }

  const handleMouseUp = () => {
    setDraggingNodeId(null)
  }

  // Add new node from palette
  const addNode = (nodeType) => {
    const isTrig = nodeType.startsWith('trigger_')
    const newId = `node_${Date.now()}`
    const newNode = {
      id: newId,
      type: nodeType,
      title: isTrig ? 'Trigger Baru' : 'Aksi Balasan Baru',
      value: isTrig ? 'kata, kunci' : 'Tuliskan pesan balasan di sini...',
      x: isTrig ? 100 : 480,
      y: 100 + nodes.length * 40,
      isTrigger: isTrig
    }
    setNodes([...nodes, newNode])
    setSelectedNode(newNode)
  }

  // Delete node
  const deleteSelectedNode = () => {
    if (!selectedNode) return
    setNodes(nodes.filter(n => n.id !== selectedNode.id))
    setSelectedNode(null)
  }

  // Save current workflow nodes to database
  const saveWorkflow = async () => {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // Find pairs of triggers and actions
      const triggers = nodes.filter(n => n.isTrigger)
      
      for (const trig of triggers) {
        const matchingAction = nodes.find(n => n.sourceTriggerId === trig.id || n.id === trig.targetActionId) || nodes.find(n => !n.isTrigger)
        
        const rulePayload = {
          name: trig.title.replace('Trigger: ', ''),
          trigger_type: trig.type.replace('trigger_', ''),
          trigger_value: trig.value || 'kata',
          response_type: 'text',
          response_value: matchingAction ? matchingAction.value : 'Terima kasih',
          apply_to: trig.apply_to || 'all',
          priority: 10,
          is_active: 1
        }

        if (trig.ruleId) {
          await api.updateAutoReplyRule(trig.ruleId, rulePayload)
        } else {
          await api.createAutoReplyRule(sessionId, rulePayload)
        }
      }

      setSuccess('Workflow visual berhasil disimpan dan diaktifkan!')
      fetchRules()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan workflow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-80px)]">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 sm:p-5 rounded-2xl text-white shadow-xl border border-emerald-500/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 sm:size-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-lg sm:text-xl shadow-lg shadow-emerald-500/30 shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold tracking-widest text-emerald-400 uppercase">Workflow Canvas</span>
              <span className="badge badge-emerald badge-xs font-mono truncate max-w-[120px] sm:max-w-none">Session: {sessionId}</span>
            </div>
            <h1 className="text-base sm:text-xl font-black tracking-tight">Visual Auto Reply</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="join bg-base-100/10 p-1 rounded-xl border border-white/10">
            <button 
              className={`btn btn-xs rounded-lg join-item ${activeTab === 'flow' ? 'btn-emerald text-white' : 'btn-ghost text-white/70'}`}
              onClick={() => setActiveTab('flow')}
            >
              🗺 Canvas
            </button>
            <button 
              className={`btn btn-xs rounded-lg join-item ${activeTab === 'table' ? 'btn-emerald text-white' : 'btn-ghost text-white/70'}`}
              onClick={() => setActiveTab('table')}
            >
              📋 Table
            </button>
          </div>

          {activeTab === 'flow' && (
            <button 
              onClick={saveWorkflow}
              disabled={saving}
              className="btn btn-emerald btn-xs sm:btn-sm rounded-xl font-bold gap-1 sm:gap-2 text-white shadow-lg shadow-emerald-500/20"
            >
              {saving ? <span className="loading loading-spinner loading-xs"></span> : '💾 Simpan'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error text-xs shadow-sm rounded-xl shrink-0">{error}</div>}
      {success && <div className="alert alert-success text-xs shadow-sm rounded-xl shrink-0">{success}</div>}

      {/* Main Flow Editor Area */}
      {activeTab === 'flow' ? (
        <div className="flex-1 flex flex-col md:flex-row gap-2 sm:gap-4 overflow-hidden relative rounded-2xl border border-base-300 shadow-inner bg-slate-950/90 text-slate-100">
          
          {/* Left Palette Toolbar */}
          <div className="w-full md:w-64 max-h-40 md:max-h-none bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3 sm:p-4 flex flex-row md:flex-col gap-2 shrink-0 z-10 overflow-x-auto md:overflow-y-auto">
            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1 hidden md:block">Node Components</span>
            <div className="flex md:flex-col gap-2 shrink-0">
              {NODE_TYPES.map((nt) => (
                <div 
                  key={nt.type}
                  onClick={() => addNode(nt.type)}
                  className="group flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 cursor-pointer transition-all hover:scale-[1.02] shadow-sm shrink-0"
                >
                  <span className="text-base sm:text-lg">{nt.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">{nt.label}</p>
                    <p className="text-[10px] text-slate-400 hidden sm:block">Klik untuk tambah</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 space-y-1">
              <p className="font-bold flex items-center gap-1">💡 Petunjuk Drag & Drop:</p>
              <p className="opacity-80">• Drag & geser kotak node ke mana saja di dalam canvas grid.</p>
              <p className="opacity-80">• Garis panah hijau otomatis menghubungkan Trigger ke Action balasan.</p>
            </div>
          </div>

          {/* Interactive Canvas */}
          <div 
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="flex-1 relative overflow-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] cursor-crosshair select-none"
          >
            {/* SVG Connecting Arrows */}
            <svg className="absolute inset-0 size-full pointer-events-none z-0">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
              </defs>

              {nodes.map(node => {
                if (node.isTrigger) {
                  const target = nodes.find(n => n.sourceTriggerId === node.id || n.id === node.targetActionId) || nodes.find(n => !n.isTrigger)
                  if (target) {
                    const startX = node.x + 220
                    const startY = node.y + 40
                    const endX = target.x
                    const endY = target.y + 40

                    // Bezier Curve
                    const dx = Math.abs(endX - startX) * 0.5
                    const pathD = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`

                    return (
                      <g key={`arrow_${node.id}_${target.id}`}>
                        <path 
                          d={pathD} 
                          fill="none" 
                          stroke="#10b981" 
                          strokeWidth="3" 
                          strokeDasharray="6 4"
                          className="animate-pulse"
                          markerEnd="url(#arrow)"
                        />
                      </g>
                    )
                  }
                }
                return null
              })}
            </svg>

            {/* Draggable Nodes */}
            {nodes.map(node => {
              const isSelected = selectedNode?.id === node.id
              const nodeInfo = NODE_TYPES.find(t => t.type === node.type) || NODE_TYPES[0]

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  className={`absolute w-56 p-3.5 rounded-2xl shadow-2xl border transition-shadow cursor-grab active:cursor-grabbing z-10 ${
                    isSelected 
                      ? 'ring-2 ring-emerald-400 border-emerald-500 bg-slate-900' 
                      : 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
                  }`}
                >
                  {/* Node Header */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base">{nodeInfo.icon}</span>
                      <span className="font-extrabold text-xs text-slate-100 truncate">{node.title}</span>
                    </div>
                    <span className={`badge badge-xs text-[9px] font-bold ${node.isTrigger ? 'badge-emerald' : 'badge-primary'}`}>
                      {node.isTrigger ? 'TRIGGER' : 'ACTION'}
                    </span>
                  </div>

                  {/* Node Body */}
                  <div className="space-y-1 text-[11px] text-slate-300">
                    <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800 font-mono text-[10px] break-words text-emerald-400">
                      {node.value || 'Kosong...'}
                    </div>
                  </div>

                  {/* Connection Connectors */}
                  {node.isTrigger && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 size-4 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-md" title="Output Trigger" />
                  )}
                  {!node.isTrigger && (
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 size-4 bg-blue-500 rounded-full border-2 border-slate-900 shadow-md" title="Input Action" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Right Properties Panel */}
          {selectedNode && (
            <div className="w-72 bg-slate-900 border-l border-slate-800 p-4 flex flex-col gap-4 shrink-0 z-10 text-xs overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-extrabold uppercase text-[11px] tracking-wider text-slate-300">Node Configuration</span>
                <button onClick={() => setSelectedNode(null)} className="btn btn-ghost btn-xs btn-circle text-slate-400">✕</button>
              </div>

              <div>
                <label className="label text-slate-400 font-bold">Judul Node</label>
                <input 
                  type="text" 
                  className="input input-sm input-bordered w-full rounded-xl bg-slate-950 border-slate-700 text-slate-100"
                  value={selectedNode.title}
                  onChange={(e) => {
                    const val = e.target.value
                    setSelectedNode({ ...selectedNode, title: val })
                    setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, title: val } : n))
                  }}
                />
              </div>

              <div>
                <label className="label text-slate-400 font-bold">
                  {selectedNode.isTrigger ? 'Kata Pemicu (Trigger Value)' : 'Pesan Balasan Otomatis'}
                </label>
                {selectedNode.isTrigger ? (
                  <input 
                    type="text" 
                    className="input input-sm input-bordered w-full rounded-xl bg-slate-950 border-slate-700 font-mono text-emerald-400"
                    value={selectedNode.value}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedNode({ ...selectedNode, value: val })
                      setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, value: val } : n))
                    }}
                  />
                ) : (
                  <textarea 
                    className="textarea textarea-bordered w-full rounded-xl bg-slate-950 border-slate-700 text-slate-100 h-24"
                    value={selectedNode.value}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedNode({ ...selectedNode, value: val })
                      setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, value: val } : n))
                    }}
                  />
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button 
                  onClick={deleteSelectedNode}
                  className="btn btn-error btn-xs w-full rounded-xl gap-2 text-white"
                >
                  🗑 Hapus Node Ini
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Table View Fallback */
        <div className="bg-base-100 border border-base-300 rounded-2xl p-6">
          <h2 className="font-bold mb-4">Ringkasan Aturan Workflow Auto Reply</h2>
          <table className="table table-zebra w-full text-xs">
            <thead>
              <tr>
                <th>Nama Workflow</th>
                <th>Trigger Value</th>
                <th>Pesan Balasan</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.name}</td>
                  <td className="font-mono text-emerald-600">{r.trigger_value}</td>
                  <td>{r.response_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
