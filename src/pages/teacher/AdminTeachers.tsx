import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, X, ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Teacher {
  id: string
  email: string
  created_at: string
}

const ADMIN_EMAIL = 'sistemas@nikolatesla.edu.mx'

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { data } = await supabase
      .from('teachers')
      .select('*')
      .order('created_at', { ascending: true })
    setTeachers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    if (!email.endsWith('@nikolatesla.edu.mx')) {
      setError('Solo se permiten correos @nikolatesla.edu.mx')
      return
    }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('teachers').insert({ email })
    if (err?.code === '23505') {
      setError('Este correo ya es docente.')
    } else if (err) {
      setError('Error al agregar. Intenta de nuevo.')
    } else {
      setNewEmail('')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string, email: string) => {
    if (email === ADMIN_EMAIL) return // no borrar al admin
    if (!confirm(`¿Quitar acceso docente a ${email}?`)) return
    await supabase.from('teachers').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Gestión de docentes</h1>
          <p className="font-body text-ink-600 mt-1">Administra quién tiene acceso como docente</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(''); setNewEmail('') }}
          className="flex items-center gap-2 bg-crimson-500 text-parchment-50 px-4 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors shadow-manuscript"
        >
          <Plus className="w-4 h-4" />
          Agregar docente
        </button>
      </div>

      <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-parchment-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gold-500" />
          <h2 className="font-display text-lg font-semibold text-ink-800">
            Docentes autorizados
            <span className="font-mono text-sm text-ink-400 font-normal ml-2">({teachers.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="p-10 text-center">
            <div className="spinner mx-auto mb-3" />
            <p className="font-body text-ink-500 text-sm">Cargando…</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sepia-100 border-b border-parchment-200">
                <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Correo</th>
                <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Agregado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-200">
              {teachers.map(t => (
                <tr key={t.id} className="hover:bg-sepia-100/40 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-sm text-ink-800">{t.email}</span>
                    {t.email === ADMIN_EMAIL && (
                      <span className="ml-2 text-xs bg-gold-400/20 text-gold-600 px-2 py-0.5 rounded font-mono">admin</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-500 font-body text-sm">
                    {format(new Date(t.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {t.email !== ADMIN_EMAIL && (
                      <button
                        onClick={() => handleDelete(t.id, t.email)}
                        className="text-ink-300 hover:text-crimson-500 transition-colors p-1.5 rounded hover:bg-sepia-100"
                        title="Quitar acceso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 p-4 bg-sepia-100 rounded border border-parchment-200">
        <p className="text-xs text-ink-500 font-body">
          💡 Al agregar un correo aquí, la próxima vez que esa persona inicie sesión con Google se le asignará automáticamente el rol de docente.
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-md border border-parchment-200 animate-slide-up">
            <div className="flex items-center justify-between p-6 border-b border-parchment-200">
              <h2 className="font-display text-xl font-semibold text-ink-800">Agregar docente</h2>
              <button onClick={() => setShowModal(false)} className="text-ink-400 hover:text-ink-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="text-sm font-body font-medium text-ink-700 block mb-1.5">
                Correo institucional
              </label>
              <input
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="nombre@nikolatesla.edu.mx"
                className="w-full border border-parchment-300 rounded px-3 py-2.5 font-mono text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20"
                autoFocus
              />
              {error && <p className="text-crimson-500 text-sm font-body mt-2">{error}</p>}
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-parchment-300 text-ink-700 py-2.5 rounded-sm font-body hover:bg-sepia-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={!newEmail.trim() || saving}
                className="flex-1 bg-crimson-500 text-parchment-50 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
