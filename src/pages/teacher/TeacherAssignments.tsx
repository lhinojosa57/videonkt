import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'

const supabase = SupabaseTypes.supabase

import { Plus, Video, Edit2, Trash2, Eye, EyeOff, Users, Copy } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TeacherAssignments() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!profile) return

    // Traer actividades con preguntas y sesiones
    const { data: rawAssignments } = await supabase
      .from('video_assignments')
      .select('*, questions(count), student_sessions(count)')
      .eq('teacher_id', profile.id)
      .order('created_at', { ascending: false })

    if (!rawAssignments || rawAssignments.length === 0) {
      setAssignments([])
      setLoading(false)
      return
    }

    // Traer grupos desde assignment_groups para cada actividad
    const assignmentIds = rawAssignments.map((a: any) => a.id)
    const { data: agRows } = await supabase
      .from('assignment_groups')
      .select('assignment_id, group:groups(name)')
      .in('assignment_id', assignmentIds)

    // Agrupar nombres de grupos por assignment_id
    const groupsByAssignment: Record<string, string[]> = {}
    ;(agRows ?? []).forEach((row: any) => {
      if (!groupsByAssignment[row.assignment_id]) {
        groupsByAssignment[row.assignment_id] = []
      }
      if (row.group?.name) {
        groupsByAssignment[row.assignment_id].push(row.group.name)
      }
    })

    // Combinar
    const enriched = rawAssignments.map((a: any) => ({
      ...a,
      groupNames: groupsByAssignment[a.id] ?? [],
    }))

    setAssignments(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [profile])

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from('video_assignments').update({ is_published: !current }).eq('id', id)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta actividad? No se puede deshacer.')) return
    await supabase.from('video_assignments').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Actividades de video</h1>
          <p className="font-body text-ink-600 mt-1">Gestiona tus videos con preguntas interactivas</p>
        </div>
        <Link
          to="/teacher/assignments/new"
          className="flex items-center gap-2 bg-crimson-500 text-parchment-50 px-4 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors shadow-manuscript"
        >
          <Plus className="w-4 h-4" />
          Nueva actividad
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-parchment-200 rounded-sm animate-pulse" />)}
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-20 bg-parchment-50 rounded-sm border border-parchment-200 shadow-manuscript">
          <Video className="w-16 h-16 mx-auto mb-4 text-parchment-300" />
          <p className="font-display text-xl text-ink-700 mb-2">Sin actividades</p>
          <p className="font-body text-ink-500 mb-6">Crea una actividad y asígnala a un grupo</p>
          <Link to="/teacher/assignments/new" className="bg-crimson-500 text-parchment-50 px-5 py-2.5 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors">
            Crear actividad
          </Link>
        </div>
      ) : (
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-parchment-200 bg-sepia-100">
                <th className="text-left px-5 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Actividad</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Grupos</th>
                <th className="text-center px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Preguntas</th>
                <th className="text-center px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Respuestas</th>
                <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Estado</th>
                <th className="text-right px-5 py-3 text-xs font-mono uppercase tracking-wider text-ink-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-parchment-200">
              {assignments.map((a: any) => (
                <tr key={a.id} className="hover:bg-sepia-100/40 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-body font-medium text-ink-800">{a.title}</p>
                    <p className="text-xs text-ink-500 mt-0.5">{a.topic}</p>
                    <p className="text-xs text-ink-400">{format(new Date(a.created_at), "d MMM yyyy", { locale: es })}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-start gap-1.5">
                      <Users className="w-3.5 h-3.5 text-ink-400 mt-0.5 flex-shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        {a.groupNames.length > 0
                          ? a.groupNames.map((name: string) => (
                              <span key={name} className="text-sm text-ink-600 font-body leading-tight">{name}</span>
                            ))
                          : <span className="text-sm text-ink-400">—</span>
                        }
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-ink-700">{a.questions?.[0]?.count ?? 0}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-mono text-sm text-ink-700">{a.student_sessions?.[0]?.count ?? 0}</span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => togglePublish(a.id, a.is_published)}
                      className={`flex items-center gap-1.5 text-xs font-mono px-2.5 py-1.5 rounded transition-colors ${
                        a.is_published
                          ? 'bg-green-700/10 text-green-700 hover:bg-green-700/20'
                          : 'bg-ink-600/10 text-ink-500 hover:bg-ink-600/20'
                      }`}
                    >
                      {a.is_published ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {a.is_published ? 'Publicada' : 'Borrador'}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/student/watch/${a.id}`)
                          alert('¡Liga copiada! Pégala en Google Classroom.')
                        }}
                        className="text-ink-400 hover:text-gold-500 transition-colors p-1.5 rounded hover:bg-sepia-100"
                        title="Copiar liga para estudiantes"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <Link to={`/teacher/assignments/${a.id}/edit`} className="text-ink-400 hover:text-gold-500 transition-colors p-1.5 rounded hover:bg-sepia-100">
                        <Edit2 className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleDelete(a.id)} className="text-ink-400 hover:text-crimson-500 transition-colors p-1.5 rounded hover:bg-sepia-100">
                        <Trash2 className="w-4 h-4" />
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
  )
}
