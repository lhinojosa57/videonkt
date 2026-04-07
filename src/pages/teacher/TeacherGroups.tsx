import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Plus, Users, Copy, Check, X, Edit2 } from 'lucide-react'

interface GroupWithCount {
  id: string
  teacher_id: string
  name: string
  description: string | null
  grado: string | null
  materias: string[]
  school_year: string | null
  invite_code: string
  archived: boolean
  created_at: string
  updated_at: string
  student_count: number
}

export default function TeacherGroups() {
  const { profile } = useAuth()
  const [groups, setGroups] = useState<GroupWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [form, setForm] = useState({ 
    name: '', 
    description: '', 
    grado: '', 
    materias: [] as string[], 
    school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) 
  })

  const GRADOS = ['1° Secundaria', '2° Secundaria', '3° Secundaria', 'Multigrado']

  const MATERIAS = [
    'Historia', 'Geografía', 'Formación Cívica y Ética',
    'Biología', 'Física', 'Química',
    'Matemáticas', 'Español', 'Inglés',
    'Artes', 'Educación Física', 'Tecnología'
  ]

  const [saving, setSaving] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)

  async function loadGroups() {
    if (!profile) return
    const { data } = await supabase
      .from('groups')
      .select('*, group_members(count)')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })
    setGroups((data ?? []).map((g: any) => ({ ...g, student_count: g.group_members?.[0]?.count ?? 0 })))
    setLoading(false)
  }

  useEffect(() => { loadGroups() }, [profile])

  const handleOpenCreate = () => {
    setEditingGroup(null)
    setForm({ name: '', description: '', grado: '', materias: [], school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) })
    setShowModal(true)
  }  

  const handleOpenEdit = (group: GroupWithCount) => {
    setEditingGroup(group.id)
    setForm({
      name: group.name,
      description: group.description ?? '',
      grado: group.grado ?? '',
      materias: group.materias ?? [],
      school_year: group.school_year ?? new Date().getFullYear() + '-' + (new Date().getFullYear() + 1),
    })
    setShowModal(true)
  }

 const handleSave = async () => {
    if (!profile || !form.name.trim()) return
    setSaving(true)

    try {
      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update({
            name: form.name,
            description: form.description || null,
            grado: form.grado || null,
            materias: form.materias,
            school_year: form.school_year,
          })
          .eq('id', editingGroup)
        
        if (error) {
          console.error('Error al actualizar:', error)
          alert(`Error: ${error.message}`)
          setSaving(false)
          return
        }
      } else {
        const { error } = await supabase.from('groups').insert({ 
          name: form.name,
          description: form.description || null,
          grado: form.grado || null,
          materias: form.materias,
          school_year: form.school_year,
          teacher_id: profile.id 
        })
        
        if (error) {
          console.error('Error al crear:', error)
          alert(`Error: ${error.message}`)
          setSaving(false)
          return
        }
      }

      setSaving(false)
      setShowModal(false)
      setForm({ name: '', description: '', grado: '', materias: [], school_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) })
      setEditingGroup(null)
      loadGroups()
    } catch (err) {
      console.error('Error inesperado:', err)
      alert('Error inesperado. Ver consola.')
      setSaving(false)
    }
  }

  const handleArchive = async (id: string, currentArchived: boolean) => {
    const action = currentArchived ? 'desarchivar' : 'archivar'
    if (!confirm(`¿Seguro que quieres ${action} este grupo?`)) return
    await supabase.from('groups').update({ archived: !currentArchived }).eq('id', id)
    loadGroups()
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const filteredGroups = showArchived ? groups.filter(g => g.archived) : groups.filter(g => !g.archived)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-900">Grupos</h1>
            <p className="font-body text-ink-600 mt-1">Administra tus grupos de estudiantes</p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-crimson-500 text-parchment-50 px-4 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors shadow-manuscript"
          >
            <Plus className="w-4 h-4" />
            Nuevo grupo
          </button>
        </div>
        
        {/* Toggle archivados */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(false)}
            className={`px-4 py-2 rounded-sm text-sm font-body font-medium transition-colors ${!showArchived ? 'bg-ink-800 text-parchment-100' : 'bg-parchment-100 text-ink-600 border border-parchment-300 hover:bg-sepia-100'}`}
          >
            Activos ({groups.filter(g => !g.archived).length})
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`px-4 py-2 rounded-sm text-sm font-body font-medium transition-colors ${showArchived ? 'bg-ink-800 text-parchment-100' : 'bg-parchment-100 text-ink-600 border border-parchment-300 hover:bg-sepia-100'}`}
          >
            Archivados ({groups.filter(g => g.archived).length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-parchment-200 rounded-sm animate-pulse" />)}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-20 bg-parchment-50 rounded-sm border border-parchment-200 shadow-manuscript">
          <Users className="w-16 h-16 mx-auto mb-4 text-parchment-300" />
          <p className="font-display text-xl text-ink-700 mb-2">
            {showArchived ? 'Sin grupos archivados' : 'Sin grupos activos'}
          </p>
          <p className="font-body text-ink-500 mb-6">
            {showArchived 
              ? 'Los grupos archivados aparecerán aquí' 
              : 'Crea tu primer grupo para comenzar a asignar actividades'}
          </p>
          <button onClick={handleOpenCreate} className="bg-crimson-500 text-parchment-50 px-5 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors">
            Crear grupo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGroups.map(group => (
            <div key={group.id} className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-5 hover:shadow-raised transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-display text-lg font-semibold text-ink-800">{group.name}</h3>
                  <div className="text-sm text-ink-500 font-body space-y-0.5">
                    {group.grado && <p>{group.grado} · {group.school_year}</p>}
                    {group.materias && group.materias.length > 0 && (
                      <p className="text-xs text-gold-600">📚 {group.materias.join(', ')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(group)}
                    className="text-ink-400 hover:text-gold-500 transition-colors p-1.5"
                    title="Editar grupo"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleArchive(group.id, group.archived)} 
                    className="text-ink-300 hover:text-gold-500 transition-colors p-1"
                    title={group.archived ? 'Desarchivar' : 'Archivar'}
                  >
                    {group.archived ? '📂' : '📁'}
                  </button>
                </div>
              </div>

              {group.description && (
                <p className="text-sm text-ink-600 font-body mb-3 line-clamp-2">{group.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-ink-500 mb-4">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {group.student_count} estudiante{group.student_count !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-sepia-100 rounded px-3 py-2 flex items-center justify-between border border-parchment-200">
                <div>
                  <p className="text-xs text-ink-400 font-mono uppercase">Código de acceso</p>
                  <p className="font-mono font-bold text-ink-800 tracking-widest text-lg">{group.invite_code}</p>
                </div>
                <button onClick={() => copyCode(group.invite_code)} className="text-ink-400 hover:text-gold-500 transition-colors p-1.5">
                  {copiedCode === group.invite_code ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-md animate-slide-up border border-parchment-200">
            <div className="flex items-center justify-between p-6 border-b border-parchment-200">
              <h2 className="font-display text-xl font-semibold text-ink-800">
                {editingGroup ? 'Editar grupo' : 'Nuevo grupo'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-ink-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-body font-medium text-ink-700 block mb-1.5">Nombre del grupo *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej. Historia 2° A"
                  className="w-full border border-parchment-300 rounded px-3 py-2 font-body text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-1 focus:ring-gold-400/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-body font-medium text-ink-700 block mb-1.5">Grado</label>
                  <select 
                    value={form.grado} 
                    onChange={e => setForm(f => ({ ...f, grado: e.target.value }))} 
                    className="w-full border border-parchment-300 rounded px-3 py-2 font-body text-ink-800 bg-white focus:outline-none focus:border-gold-400 cursor-pointer"
                  >
                    <option value="">Seleccionar…</option>
                    {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-body font-medium text-ink-700 block mb-1.5">Ciclo escolar</label>
                  <input value={form.school_year} onChange={e => setForm(f => ({ ...f, school_year: e.target.value }))} placeholder="2025-2026" className="w-full border border-parchment-300 rounded px-3 py-2 font-body text-ink-800 bg-white focus:outline-none focus:border-gold-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-body font-medium text-ink-700 block mb-1.5">Descripción (opcional)</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-parchment-300 rounded px-3 py-2 font-body text-ink-800 bg-white focus:outline-none focus:border-gold-400 resize-none" />
              </div>
              <div>
                <label className="text-sm font-body font-medium text-ink-700 block mb-2">Materias (selecciona hasta 3)</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-parchment-200 rounded p-3 bg-white">
                  {MATERIAS.map(m => (
                    <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-sepia-100 p-1.5 rounded transition-colors">
                      <input
                        type="checkbox"
                        checked={form.materias.includes(m)}
                        onChange={e => {
                          if (e.target.checked && form.materias.length < 3) {
                            setForm(f => ({ ...f, materias: [...f.materias, m] }))
                          } else if (!e.target.checked) {
                            setForm(f => ({ ...f, materias: f.materias.filter(mat => mat !== m) }))
                          }
                        }}
                        disabled={!form.materias.includes(m) && form.materias.length >= 3}
                        className="w-4 h-4 accent-gold-500"
                      />
                      <span className="text-sm text-ink-700">{m}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-ink-400 mt-1.5">Seleccionadas: {form.materias.join(', ') || 'Ninguna'}</p>
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-parchment-300 text-ink-700 py-2.5 rounded-sm font-body hover:bg-sepia-100 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={!form.name.trim() || saving} className="flex-1 bg-crimson-500 text-parchment-50 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 disabled:opacity-40 transition-colors">
                {saving ? 'Guardando...' : editingGroup ? 'Guardar cambios' : 'Crear grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}