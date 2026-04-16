import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Download, Filter, Users, TrendingUp, Clock, CheckSquare, X } from 'lucide-react'

const supabase = SupabaseTypes.supabase

interface ReportRow {
  student_name: string
  student_email: string
  assignment_title: string
  topic: string
  group_name: string
  started_at: string
  completed_at: string | null
  duration_seconds: number
  score: number
  is_completed: boolean
  session_id: string
}

export default function TeacherReports() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [filtered, setFiltered] = useState<ReportRow[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<any | null>(null)
  const [sessionAnswers, setSessionAnswers] = useState<any[]>([])
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [savingScore, setSavingScore] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'matrix'>('general')
  const [matrixData, setMatrixData] = useState<any>(null)
  const [loadingMatrix, setLoadingMatrix] = useState(false)
  const [selectedMatrixAssignment, setSelectedMatrixAssignment] = useState('')

  const load = useCallback(async () => {
  const { data: myAssignments } = await supabase
    .from('video_assignments')
    .select('id, title')
    .eq('teacher_id', profile!.id)
    .order('created_at', { ascending: false })

  const assignmentIds = (myAssignments ?? []).map((a: any) => a.id)
  setAssignments(myAssignments ?? [])

  if (assignmentIds.length === 0) {
    setRows([])
    setFiltered([])
    setLoading(false)
    return
  }

  const { data: sessions } = await supabase
    .from('student_sessions')
    .select(`
      id, started_at, completed_at, duration_seconds, score, is_completed,
      profile:profiles!student_id(full_name, email),
      assignment:video_assignments!assignment_id(title, topic, group:groups(name))
    `)
    .in('assignment_id', assignmentIds)
    .order('started_at', { ascending: false })

  const mapped: ReportRow[] = (sessions ?? []).map((s: any) => ({
    student_name: s.profile?.full_name ?? 'Desconocido',
    student_email: s.profile?.email ?? '',
    assignment_title: s.assignment?.title ?? '',
    topic: s.assignment?.topic ?? '',
    group_name: s.assignment?.group?.name ?? '',
    started_at: s.started_at,
    completed_at: s.completed_at,
    duration_seconds: s.duration_seconds ?? 0,
    score: Math.round(s.score ?? 0),
    is_completed: s.is_completed,
    session_id: s.id,
  }))
  setRows(mapped)
  setFiltered(mapped)
  setLoading(false)
}, [profile?.id])

useEffect(() => {
  if (!profile?.id) return
  load()
}, [profile?.id, load])

  async function loadSessionAnswers(sessionId: string) {
    setLoadingAnswers(true)
    const { data } = await supabase
      .from('student_answers')
      .select('*, question:questions(*)')
      .eq('session_id', sessionId)
      .order('answered_at')
    setSessionAnswers(data ?? [])
    setLoadingAnswers(false)
  }

  async function gradeOpenAnswer(answerId: string, questionPoints: number, multiplier: number) {
    setSavingScore(answerId)
    const pointsEarned = Math.round(questionPoints * multiplier)
    const { error } = await supabase
      .from('student_answers')
      .update({ points_earned: pointsEarned, is_correct: multiplier > 0 })
      .eq('id', answerId)
      const sessionId = sessionAnswers.find(a => a.id === answerId)?.session_id
    if (sessionId) await loadSessionAnswers(sessionId)
    const { data: allAnswers } = await supabase
      .from('student_answers')
      .select('points_earned, question:questions(points)')
      .eq('session_id', sessionId)

    const totalPoints = (allAnswers ?? []).reduce((sum: number, a: any) => sum + (a.question?.points ?? 0), 0)
    const earnedPoints = (allAnswers ?? []).reduce((sum: number, a: any) => sum + (a.points_earned ?? 0), 0)
    const newScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

    await supabase.from('student_sessions').update({ score: newScore }).eq('id', sessionId)
    setSelectedSession((prev: any) => ({ ...prev, score: newScore }))
    await load()
    setSavingScore(null)
  }

  async function loadMatrixData(assignmentId: string) {
    setLoadingMatrix(true)
    const { data: questions } = await supabase
      .from('questions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('timestamp_seconds')
    const { data: sessions } = await supabase
      .from('student_sessions')
      .select('*, profile:profiles!student_id(full_name, email)')
      .eq('assignment_id', assignmentId)
      .order('started_at')
    const sessionIds = (sessions ?? []).map((s: any) => s.id)
    const { data: answers } = await supabase
      .from('student_answers')
      .select('*')
      .in('session_id', sessionIds)
    const answerMap: Record<string, Record<string, any>> = {}
    ;(answers ?? []).forEach((a: any) => {
      const session = (sessions ?? []).find((s: any) => s.id === a.session_id)
      if (!session) return
      if (!answerMap[session.student_id]) answerMap[session.student_id] = {}
      answerMap[session.student_id][a.question_id] = a
    })
    setMatrixData({ questions: questions ?? [], sessions: sessions ?? [], answerMap })
    setLoadingMatrix(false)
  }

async function handleAllowRetry() {
    if (!selectedSession?.session_id) return
    
    const confirmed = confirm(
      `¿Permitir que ${selectedSession.student_name} vuelva a realizar esta actividad?\n\n` +
      `Se borrará su sesión actual (${selectedSession.score}/100) y podrá iniciarla de nuevo.`
    )
    
    if (!confirmed) return

    try {
      // Borrar la sesión actual (esto también borrará las respuestas por CASCADE)
      const { error } = await supabase
        .from('student_sessions')
        .delete()
        .eq('id', selectedSession.session_id)

      if (error) {
        console.error('Error al borrar sesión:', error)
        alert(`Error: ${error.message}\n\nEs posible que no tengas permiso para borrar esta sesión.`)
        return
      }

      alert('✅ Sesión borrada. El estudiante puede volver a hacer la actividad.')

      // Recargar datos
      setSelectedSession(null)
      
      // Recargar la tabla
      if (!profile?.id) return
      const { data: myAssignments } = await supabase
        .from('video_assignments')
        .select('id, title')
        .eq('teacher_id', profile!.id)
        .order('created_at', { ascending: false })

      const assignmentIds = (myAssignments ?? []).map((a: any) => a.id)

      if (assignmentIds.length === 0) return

      const { data: sessions } = await supabase
        .from('student_sessions')
        .select(`
          id, started_at, completed_at, duration_seconds, score, is_completed,
          profile:profiles!student_id(full_name, email),
          assignment:video_assignments!assignment_id(title, topic, group:groups(name))
        `)
        .in('assignment_id', assignmentIds)
        .order('started_at', { ascending: false })

      const mapped: ReportRow[] = (sessions ?? []).map((s: any) => ({
        student_name: s.profile?.full_name ?? 'Desconocido',
        student_email: s.profile?.email ?? '',
        assignment_title: s.assignment?.title ?? '',
        topic: s.assignment?.topic ?? '',
        group_name: s.assignment?.group?.name ?? '',
        started_at: s.started_at,
        completed_at: s.completed_at,
        duration_seconds: s.duration_seconds ?? 0,
        score: Math.round(s.score ?? 0),
        is_completed: s.is_completed,
        session_id: s.id,
      }))
      setRows(mapped)
      setFiltered(mapped)
    } catch (err) {
      console.error('Error inesperado:', err)
      alert('Error inesperado. Ver consola del navegador.')
    }
  }

  useEffect(() => {
    if (selectedAssignment === 'all') {
      setFiltered(rows)
    } else {
      const title = assignments.find(a => a.id === selectedAssignment)?.title
      setFiltered(rows.filter(r => r.assignment_title === title))
    }
  }, [selectedAssignment, rows, assignments])

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const avgScore = avg(filtered.map(r => r.score))
  const completionRate = filtered.length ? Math.round(filtered.filter(r => r.is_completed).length / filtered.length * 100) : 0
  const avgDuration = avg(filtered.map(r => r.duration_seconds))

  function formatDuration(s: number) {
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  const scoreDistribution = [
    { range: '0-20', count: filtered.filter(r => r.score <= 20).length },
    { range: '21-40', count: filtered.filter(r => r.score > 20 && r.score <= 40).length },
    { range: '41-60', count: filtered.filter(r => r.score > 40 && r.score <= 60).length },
    { range: '61-80', count: filtered.filter(r => r.score > 60 && r.score <= 80).length },
    { range: '81-100', count: filtered.filter(r => r.score > 80).length },
  ]

  const exportCSV = () => {
    const headers = ['Estudiante', 'Correo', 'Actividad', 'Tema', 'Grupo', 'Inicio', 'Fin', 'Duración', 'Calificación (0-100)', 'Completada']
    const csvRows = filtered.map(r => [
      r.student_name, r.student_email, r.assignment_title, r.topic, r.group_name,
      new Date(r.started_at).toLocaleString('es-MX'),
      r.completed_at ? new Date(r.completed_at).toLocaleString('es-MX') : '—',
      formatDuration(r.duration_seconds), r.score, r.is_completed ? 'Sí' : 'No',
    ])
    const csv = [headers, ...csvRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-videonkt-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700'
    if (score >= 60) return 'text-gold-600'
    return 'text-crimson-500'
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Reportes</h1>
          <p className="font-body text-ink-600 mt-1">Seguimiento del desempeño estudiantil</p>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 bg-ink-800 text-parchment-100 px-4 py-2.5 rounded-sm font-body font-medium hover:bg-ink-900 transition-colors shadow-manuscript">
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-sm font-body text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-ink-800 text-parchment-100' : 'bg-parchment-50 border border-parchment-300 text-ink-600 hover:bg-sepia-100'}`}
        >
          Vista general
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`px-4 py-2 rounded-sm font-body text-sm font-medium transition-colors ${activeTab === 'matrix' ? 'bg-ink-800 text-parchment-100' : 'bg-parchment-50 border border-parchment-300 text-ink-600 hover:bg-sepia-100'}`}
        >
          Reporte por preguntas
        </button>
      </div>

      {activeTab === 'general' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-4 h-4 text-ink-400" />
            <select
              value={selectedAssignment}
              onChange={e => setSelectedAssignment(e.target.value)}
              className="border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400"
            >
              <option value="all">Todas las actividades</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <span className="text-sm text-ink-400 font-body">{filtered.length} registros</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Promedio general', value: `${avgScore}/100`, icon: TrendingUp, color: 'bg-gold-400/20 text-gold-600' },
              { label: 'Tasa de completado', value: `${completionRate}%`, icon: CheckSquare, color: 'bg-green-700/20 text-green-700' },
              { label: 'Total registros', value: filtered.length, icon: Users, color: 'bg-crimson-500/20 text-crimson-500' },
              { label: 'Duración promedio', value: formatDuration(avgDuration), icon: Clock, color: 'bg-ink-600/20 text-ink-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-5">
                <div className={`w-9 h-9 rounded flex items-center justify-center mb-3 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
                <p className="text-xs text-ink-500 font-body mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6 mb-6">
              <h2 className="font-display text-lg font-semibold text-ink-800 mb-4">Distribución de calificaciones</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDistribution} barSize={40}>
                  <XAxis dataKey="range" tick={{ fontFamily: 'JetBrains Mono', fontSize: 12, fill: '#5c4424' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontFamily: 'JetBrains Mono', fontSize: 11, fill: '#7a5c34' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontFamily: 'Source Serif 4', background: '#fdf8f0', border: '1px solid #e8d3a9', borderRadius: 4 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {scoreDistribution.map((_, i) => (
                      <Cell key={i} fill={['#9b1c1c', '#d4af37', '#d08030', '#2d7a4b', '#1a5c3a'][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-parchment-200">
              <h2 className="font-display text-lg font-semibold text-ink-800">Detalle por estudiante</h2>
            </div>
            {loading ? (
              <div className="p-10 text-center">
                <div className="spinner mx-auto mb-3" />
                <p className="font-body text-ink-500 text-sm">Cargando datos…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-ink-400 font-body">
                No hay datos de actividad todavía.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sepia-100 border-b border-parchment-200">
                      {['Estudiante', 'Correo', 'Actividad / Tema', 'Grupo', 'Inicio', 'Duración', 'Calificación', 'Estado', 'Ver detalle'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-parchment-200">
                    {filtered.map((r, i) => (
                      <tr key={i} className="hover:bg-sepia-100/40 transition-colors">
                        <td className="px-4 py-3 font-body font-medium text-ink-800 whitespace-nowrap">{r.student_name}</td>
                        <td className="px-4 py-3 text-ink-500 font-mono text-xs">{r.student_email}</td>
                        <td className="px-4 py-3">
                          <p className="font-body text-ink-800 leading-tight">{r.assignment_title}</p>
                          <p className="text-xs text-ink-400 mt-0.5">{r.topic}</p>
                        </td>
                        <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{r.group_name}</td>
                        <td className="px-4 py-3 text-ink-500 font-mono text-xs whitespace-nowrap">
                          {new Date(r.started_at).toLocaleString('es-MX')}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-ink-600 whitespace-nowrap">{formatDuration(r.duration_seconds)}</td>
                        <td className="px-4 py-3">
                          <span className={`font-mono font-bold text-base ${scoreColor(r.score)}`}>{r.score}</span>
                          <span className="text-ink-400 font-mono text-xs">/100</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-mono px-2 py-1 rounded ${r.is_completed ? 'bg-green-700/10 text-green-700' : 'bg-gold-400/20 text-gold-600'}`}>
                            {r.is_completed ? 'Completada' : 'En progreso'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => { setSelectedSession(r); loadSessionAnswers(r.session_id) }}
                            className="text-xs text-crimson-500 hover:text-crimson-600 font-body font-medium underline"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="font-display text-lg font-semibold text-ink-800">Reporte por preguntas</h2>
            <select
              value={selectedMatrixAssignment}
              onChange={e => { setSelectedMatrixAssignment(e.target.value); if (e.target.value) loadMatrixData(e.target.value) }}
              className="border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400"
            >
              <option value="">Seleccionar actividad…</option>
              {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>

          {loadingMatrix ? (
            <div className="text-center py-10">
              <div className="spinner mx-auto mb-3" />
              <p className="text-ink-500 font-body text-sm">Cargando reporte…</p>
            </div>
          ) : !matrixData ? (
            <div className="text-center py-10 text-ink-400 font-body">
              Selecciona una actividad para ver el reporte.
            </div>
          ) : matrixData.sessions.length === 0 ? (
            <div className="text-center py-10 text-ink-400 font-body">
              Ningún estudiante ha iniciado esta actividad.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sepia-100 border-b border-parchment-200">
                    <th className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500 whitespace-nowrap sticky left-0 bg-sepia-100">
                      Estudiante
                    </th>
                    {matrixData.questions.map((q: any, i: number) => (
                      <th key={q.id} className="px-3 py-3 text-xs font-mono text-ink-500 text-center whitespace-nowrap">
                        P{i + 1}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-xs font-mono uppercase tracking-wider text-ink-500 text-center whitespace-nowrap">
                      Cal.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment-200">
                  {matrixData.sessions.map((session: any) => (
                    <tr key={session.id} className="hover:bg-sepia-100/40 transition-colors">
                      <td className="px-4 py-3 font-body text-ink-800 whitespace-nowrap sticky left-0 bg-parchment-50">
                        <p className="font-medium">{session.profile?.full_name ?? 'Desconocido'}</p>
                        <p className="text-xs text-ink-400">{session.profile?.email}</p>
                      </td>
                      {matrixData.questions.map((q: any) => {
                        const answer = matrixData.answerMap[session.student_id]?.[q.id]
                        let circle = '⚪'
                        let title = 'Sin respuesta'
                        if (answer) {
                          if (q.question_type === 'open') {
                            if (answer.points_earned > 0) { circle = '🟢'; title = 'Respuesta abierta calificada' }
                            else if (answer.answer_text) { circle = '🟡'; title = 'Pendiente de calificar' }
                            else { circle = '⚪'; title = 'Sin respuesta' }
                          } else {
                            circle = answer.is_correct ? '🟢' : '🔴'
                            title = answer.is_correct ? 'Correcta' : 'Incorrecta'
                          }
                        }
                        return (
                          <td key={q.id} className="px-3 py-3 text-center text-lg" title={title}>
                            {circle}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-center">
                        <span className={`font-mono font-bold text-sm ${session.score >= 80 ? 'text-green-700' : session.score >= 60 ? 'text-gold-600' : 'text-crimson-500'}`}>
                          {Math.round(session.score ?? 0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-parchment-200 text-xs font-body text-ink-500">
                <span>🟢 Correcta</span>
                <span>🔴 Incorrecta</span>
                <span>⚪ Sin respuesta</span>
                <span>🟡 Abierta pendiente</span>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedSession && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-parchment-200">
            <div className="flex items-center justify-between p-6 border-b border-parchment-200 sticky top-0 bg-parchment-50">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink-800">{selectedSession.student_name}</h2>
                <p className="text-sm text-ink-500 font-body">{selectedSession.assignment_title} · {selectedSession.topic}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-ink-400 hover:text-ink-700 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {loadingAnswers ? (
                <div className="text-center py-8">
                  <div className="spinner mx-auto mb-3" />
                  <p className="text-ink-500 font-body text-sm">Cargando respuestas…</p>
                </div>
              ) : sessionAnswers.length === 0 ? (
                <p className="text-ink-400 font-body text-center py-8">Sin respuestas registradas.</p>
              ) : (
                sessionAnswers.map((answer: any) => {
                  const q = answer.question
                  const isOpen = q?.question_type === 'open'
                  return (
                    <div key={answer.id} className="bg-white rounded border border-parchment-200 p-4">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <p className="font-body font-medium text-ink-800 flex-1">{q?.question_text}</p>
                        <span className="text-xs font-mono bg-sepia-100 text-ink-500 px-2 py-1 rounded flex-shrink-0">
                          {Math.floor(q?.timestamp_seconds / 60)}:{String(Math.floor(q?.timestamp_seconds % 60)).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-sm font-body text-ink-600 mb-3">
                        <span className="font-medium">Respuesta: </span>
                        {answer.answer_text ?? <span className="text-ink-300 italic">Sin respuesta</span>}
                      </p>
                      {isOpen ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-500 font-body">Calificación:</span>
                          {[{ label: 'Completa', value: 1 }, { label: 'Parcial', value: 0.5 }, { label: 'Incorrecta', value: 0 }].map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => {
                                gradeOpenAnswer(answer.id, q.points, opt.value)
                              }}
                              disabled={savingScore === answer.id}
                              className={`text-xs px-3 py-1.5 rounded font-body font-medium transition-colors ${answer.points_earned === Math.round(q.points * opt.value) ? 'bg-crimson-500 text-parchment-50' : 'bg-sepia-100 text-ink-600 hover:bg-sepia-200'}`}
                            >
                              {savingScore === answer.id ? '…' : opt.label}
                            </button>
                          ))}
                          <span className="text-xs font-mono text-ink-400 ml-1">{answer.points_earned}/{q.points} pts</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono px-2 py-1 rounded ${answer.is_correct ? 'bg-green-700/10 text-green-700' : 'bg-crimson-500/10 text-crimson-500'}`}>
                            {answer.is_correct ? '✓ Correcta' : '✗ Incorrecta'}
                          </span>
                          <span className="text-xs font-mono text-ink-400">{answer.points_earned}/{q.points} pts</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            <div className="p-6 pt-0 border-t border-parchment-200 mt-4 flex justify-between items-center">
              <div>
                <span className="text-sm font-body text-ink-600">Calificación actual: </span>
                <span className="font-display text-2xl font-bold text-ink-900">{selectedSession.score}</span>
                <span className="font-mono text-ink-400">/100</span>
              </div>
              <div className="flex gap-3">
                {selectedSession.is_completed && (
                  <button
                    onClick={handleAllowRetry}
                    className="bg-gold-400 text-ink-900 px-5 py-2.5 rounded-sm font-body font-medium hover:bg-gold-300 transition-colors"
                  >
                    Permitir reintento
                  </button>
                )}
                <button onClick={() => setSelectedSession(null)} className="bg-ink-800 text-parchment-100 px-5 py-2.5 rounded-sm font-body font-medium hover:bg-ink-900 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}