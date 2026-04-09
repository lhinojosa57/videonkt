import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'
import { FileText, Filter, Save, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const supabase = SupabaseTypes.supabase

const CAMPOS_FORMATIVOS = [
  { id: '3730c0b8-e7e0-4135-8ad2-3ae7a6052ec9', nombre: 'Ética, Naturaleza y Sociedades' },
  { id: '7cbb64da-4f46-4928-9848-fb68e31e67f8', nombre: 'De lo Humano y lo Comunitario' },
  { id: '1ab5aaed-340c-4beb-a848-2f9e93c99c40', nombre: 'Lenguajes' },
  { id: 'b7e106ae-e7ff-4da9-852c-d0b01e13b688', nombre: 'Saberes y Pensamiento Científico' },
]

const GRADOS = ['Primer grado', 'Segundo grado', 'Tercer grado']

export default function TeacherPlanning() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Filtros
  const [filterCampo, setFilterCampo] = useState('')
  const [filterGrado, setFilterGrado] = useState('')
  const [filterMateria, setFilterMateria] = useState('')

  // Materias únicas disponibles
  const [materias, setMaterias] = useState<string[]>([])

  useEffect(() => {
    if (!profile?.id) return
    loadAssignments()
  }, [profile?.id])

  async function loadAssignments() {
    setLoading(true)
    const { data } = await supabase
      .from('video_assignments')
      .select(`
        id, title, topic, is_published, created_at, observaciones,
        tema_libro:temas_libro(id, materia, grado, tema_principal, subtema, pagina),
        contenido:nem_contenidos(id, codigo, nombre, campo_formativo_id),
        aprendizaje:nem_aprendizajes(id, descripcion),
        questions(id, question_text, question_type, points, timestamp_seconds),
        student_sessions(score)
      `)
      .eq('teacher_id', profile!.id)
      .order('created_at', { ascending: false })

    const enriched = (data ?? []).map((a: any) => {
      const sessions = a.student_sessions ?? []
      const avgScore = sessions.length
        ? Math.round(sessions.reduce((s: number, sess: any) => s + (sess.score ?? 0), 0) / sessions.length)
        : null
      return { ...a, avgScore, sessionCount: sessions.length }
    })

    setAssignments(enriched)
    setFiltered(enriched)

    // Extraer materias únicas
    const mats = new Set<string>()
    enriched.forEach((a: any) => { if (a.tema_libro?.materia) mats.add(a.tema_libro.materia) })
    setMaterias([...mats].sort())
    setLoading(false)
  }

  // Aplicar filtros
  useEffect(() => {
    let result = assignments
    if (filterCampo) result = result.filter(a => a.contenido?.campo_formativo_id === filterCampo)
    if (filterGrado) result = result.filter(a => a.tema_libro?.grado === filterGrado)
    if (filterMateria) result = result.filter(a => a.tema_libro?.materia === filterMateria)
    setFiltered(result)
  }, [filterCampo, filterGrado, filterMateria, assignments])

  const handleSaveObservaciones = async (id: string, obs: string) => {
    setSavingId(id)
    await supabase.from('video_assignments').update({ observaciones: obs }).eq('id', id)
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, observaciones: obs } : a))
    setSavingId(null)
    setSavedId(id)
    setTimeout(() => setSavedId(null), 2000)
  }

  const handleGeneratePDF = (assignment: any) => {
    const campoNombre = CAMPOS_FORMATIVOS.find(c => c.id === assignment.contenido?.campo_formativo_id)?.nombre
      ?? CAMPOS_FORMATIVOS.find(c => c.id === assignment.tema_libro?.campo_formativo_id)?.nombre
      ?? '—'
    const materia = assignment.tema_libro?.materia ?? '—'
    const grado = assignment.tema_libro?.grado ?? '—'
    const questions = assignment.questions ?? []
    const logoUrl = `${window.location.origin}/logo-nikola-tesla.png`

    const typeLabel: Record<string, string> = {
      multiple_choice: 'Opción múltiple',
      true_false: 'Verdadero / Falso',
      open: 'Pregunta abierta',
    }

    const questionsHtml = questions.map((q: any, i: number) => {
      const mins = Math.floor(q.timestamp_seconds / 60)
      const secs = q.timestamp_seconds % 60
      const time = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
      const optionsHtml = q.question_type === 'multiple_choice' && Array.isArray(q.options)
        ? `<div class="options">${q.options.filter((o: any) => o.text?.trim()).map((o: any) =>
            `<div class="option"><span class="opt-id">${o.id.toUpperCase()})</span> ${o.text}</div>`
          ).join('')}</div>`
        : q.question_type === 'true_false'
        ? `<div class="options"><div class="option">✓ Verdadero</div><div class="option">✗ Falso</div></div>`
        : ''
      return `
      <div class="question">
        <div class="q-header">
          <span class="q-type">${typeLabel[q.question_type] ?? q.question_type} · ${q.points} pts</span>
          <span class="q-time">⏱ ${time}</span>
        </div>
        <div class="q-text">${i + 1}. ${q.question_text}</div>
        ${optionsHtml}
      </div>`
    }).join('')

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Planeación – ${assignment.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; color: #555758; background: white; padding: 40px; font-size: 13px; }

    /* Header institucional */
    .header { display: flex; align-items: flex-start; gap: 20px; border-bottom: 3px solid #218b45; padding-bottom: 16px; margin-bottom: 24px; }
    .header-logo { width: 60px; height: 60px; object-fit: contain; flex-shrink: 0; }
    .header-info { flex: 1; }
    .school-name { font-size: 11px; color: #218b45; text-transform: uppercase; letter-spacing: 1.5px; font-family: 'Courier New', monospace; margin-bottom: 4px; }
    .header h1 { font-size: 20px; color: #15853a; margin-bottom: 4px; line-height: 1.3; }
    .header .meta { color: #555758; font-size: 11px; }
    .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-family: 'Courier New', monospace; margin-left: 8px; }
    .status-pub { background: #93c5a1; color: #15853a; }
    .status-draft { background: #e5e7eb; color: #555758; }

    /* Secciones */
    .section { margin-bottom: 18px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #218b45; border-bottom: 1px solid #93c5a1; padding-bottom: 4px; margin-bottom: 10px; font-family: 'Courier New', monospace; }

    /* Campos */
    .field { margin-bottom: 8px; }
    .field label { font-size: 10px; color: #93c5a1; display: block; margin-bottom: 2px; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 0.5px; }
    .field p { color: #555758; line-height: 1.5; }

    /* Grids */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

    /* Info boxes */
    .info-box { background: #fdfefd; border: 1px solid #93c5a1; border-radius: 4px; padding: 10px; }
    .info-box .ib-label { font-size: 10px; font-family: 'Courier New', monospace; text-transform: uppercase; letter-spacing: 0.5px; color: #93c5a1; margin-bottom: 3px; }
    .info-box .ib-value { color: #555758; font-size: 13px; font-weight: bold; }

    /* Preguntas */
    .question { border: 1px solid #93c5a1; border-radius: 4px; padding: 10px; margin-bottom: 8px; background: #fdfefd; }
    .q-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .q-type { font-family: 'Courier New', monospace; font-size: 10px; color: #218b45; text-transform: uppercase; }
    .q-time { font-family: 'Courier New', monospace; font-size: 10px; color: #93c5a1; }
    .q-text { line-height: 1.4; color: #555758; margin-bottom: 6px; }
    .options { margin-top: 6px; padding-left: 8px; border-left: 2px solid #93c5a1; }
    .option { font-size: 12px; color: #555758; padding: 2px 0; }
    .opt-id { font-family: 'Courier New', monospace; font-size: 10px; color: #218b45; margin-right: 4px; }

    /* Resultados */
    .score-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; }
    .score-high { background: #93c5a1; color: #15853a; }
    .score-mid { background: #fef9c3; color: #854d0e; }
    .score-low { background: #fee2e2; color: #991b1b; }

    /* Observaciones */
    .observaciones { border: 1px solid #93c5a1; border-radius: 4px; padding: 12px; min-height: 80px; background: #fdfefd; line-height: 1.6; white-space: pre-wrap; color: #555758; }
    .obs-empty { color: #93c5a1; font-style: italic; }

    /* Footer */
    .footer { margin-top: 32px; padding-top: 10px; border-top: 2px solid #218b45; font-size: 10px; color: #93c5a1; display: flex; justify-content: space-between; font-family: 'Courier New', monospace; }

    @media print { body { padding: 20px; } }
  </style>
</head>
<body>

  <div class="header">
    <img src="${logoUrl}" class="header-logo" alt="Colegio Nikola Tesla" />
    <div class="header-info">
      <div class="school-name">Colegio Nikola Tesla · VideoNKT</div>
      <h1>${assignment.title} <span class="status-badge ${assignment.is_published ? 'status-pub' : 'status-draft'}">${assignment.is_published ? 'Publicada' : 'Borrador'}</span></h1>
      <div class="meta">Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })} &nbsp;·&nbsp; Docente: ${profile?.full_name ?? ''}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Información general</div>
    <div class="grid-3">
      <div class="info-box">
        <div class="ib-label">Materia</div>
        <div class="ib-value">${materia}</div>
      </div>
      <div class="info-box">
        <div class="ib-label">Grado</div>
        <div class="ib-value">${grado}</div>
      </div>
      <div class="info-box">
        <div class="ib-label">Campo formativo</div>
        <div class="ib-value" style="font-size:11px;">${campoNombre}</div>
      </div>
    </div>
  </div>

  ${assignment.tema_libro ? `
  <div class="section">
    <div class="section-title">Tema del libro de texto</div>
    <div class="field">
      <label>Tema principal</label>
      <p>${assignment.tema_libro.tema_principal}</p>
    </div>
    ${assignment.tema_libro.subtema ? `<div class="field"><label>Subtema</label><p>${assignment.tema_libro.subtema}</p></div>` : ''}
    <div class="field"><label>Página</label><p>${assignment.tema_libro.pagina}</p></div>
  </div>` : ''}

  ${assignment.contenido ? `
  <div class="section">
    <div class="section-title">Contenido NEM</div>
    <div class="field"><p><span style="font-family:'Courier New';font-size:11px;color:#93c5a1;">[${assignment.contenido.codigo}]</span> ${assignment.contenido.nombre}</p></div>
  </div>` : ''}

  ${assignment.aprendizaje ? `
  <div class="section">
    <div class="section-title">Proceso de Desarrollo de Aprendizaje (PDA)</div>
    <div class="field">
      <p>${assignment.aprendizaje.descripcion}</p>
    </div>
  </div>` : ''}

  ${questions.length > 0 ? `
  <div class="section">
    <div class="section-title">Preguntas interactivas (${questions.length})</div>
    ${questionsHtml}
  </div>` : ''}

  ${assignment.sessionCount > 0 ? `
  <div class="section">
    <div class="section-title">Resultados del grupo</div>
    <div class="grid-2">
      <div class="info-box">
        <div class="ib-label">Estudiantes que realizaron la actividad</div>
        <div class="ib-value">${assignment.sessionCount}</div>
      </div>
      <div class="info-box">
        <div class="ib-label">Promedio de calificación</div>
        <div class="ib-value">
          <span class="score-badge ${assignment.avgScore >= 80 ? 'score-high' : assignment.avgScore >= 60 ? 'score-mid' : 'score-low'}">
            ${assignment.avgScore}/100
          </span>
        </div>
      </div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Observaciones del docente</div>
    <div class="observaciones">${
      assignment.observaciones
        ? assignment.observaciones.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        : '<span class="obs-empty">Sin observaciones registradas.</span>'
    }</div>
  </div>

  <div class="footer">
    <span>VideoNKT · Colegio Nikola Tesla</span>
    <span>${format(new Date(), "dd/MM/yyyy HH:mm")}</span>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => { win.print() }, 500)
    }
  }

  const getCampoNombre = (id: string) => CAMPOS_FORMATIVOS.find(c => c.id === id)?.nombre ?? '—'

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink-900">Planeación</h1>
        <p className="font-body text-ink-600 mt-1">Gestiona y documenta tus actividades didácticas</p>
      </div>

      {/* Filtros */}
      <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-ink-400" />
          <span className="text-sm font-body font-medium text-ink-700">Filtrar actividades</span>
          {(filterCampo || filterGrado || filterMateria) && (
            <button
              onClick={() => { setFilterCampo(''); setFilterGrado(''); setFilterMateria('') }}
              className="ml-auto text-xs text-crimson-500 hover:underline font-body"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-mono text-ink-400 uppercase tracking-wider block mb-1">Campo formativo</label>
            <select
              value={filterCampo}
              onChange={e => setFilterCampo(e.target.value)}
              className="w-full border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400 cursor-pointer"
            >
              <option value="">Todos</option>
              {CAMPOS_FORMATIVOS.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-ink-400 uppercase tracking-wider block mb-1">Grado</label>
            <select
              value={filterGrado}
              onChange={e => setFilterGrado(e.target.value)}
              className="w-full border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400 cursor-pointer"
            >
              <option value="">Todos</option>
              {GRADOS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-ink-400 uppercase tracking-wider block mb-1">Materia</label>
            <select
              value={filterMateria}
              onChange={e => setFilterMateria(e.target.value)}
              className="w-full border border-parchment-300 rounded px-3 py-2 text-sm font-body text-ink-700 bg-white focus:outline-none focus:border-gold-400 cursor-pointer"
            >
              <option value="">Todas</option>
              {materias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-400 font-body mt-3">{filtered.length} actividade{filtered.length !== 1 ? 's' : ''} encontrada{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Lista de actividades */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-parchment-200 rounded-sm animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-parchment-50 rounded-sm border border-parchment-200">
          <FileText className="w-16 h-16 mx-auto mb-4 text-parchment-300" />
          <p className="font-display text-xl text-ink-700 mb-2">Sin actividades</p>
          <p className="font-body text-ink-500">
            {assignments.length === 0
              ? 'Crea actividades para verlas aquí.'
              : 'No hay actividades con los filtros seleccionados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a: any) => (
            <div key={a.id} className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display text-lg font-semibold text-ink-800">{a.title}</h3>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded flex-shrink-0 ${
                      a.is_published ? 'bg-green-700/10 text-green-700' : 'bg-ink-600/10 text-ink-500'
                    }`}>
                      {a.is_published ? 'Publicada' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 font-body">
                    {format(new Date(a.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
                <button
                  onClick={() => handleGeneratePDF(a)}
                  className="flex items-center gap-2 bg-ink-800 text-parchment-100 px-4 py-2 rounded-sm font-body text-sm font-medium hover:bg-ink-900 transition-colors flex-shrink-0"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-sepia-100 rounded p-2.5 border border-parchment-200">
                  <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Materia</p>
                  <p className="text-sm font-body text-ink-700 font-medium">{a.tema_libro?.materia ?? '—'}</p>
                </div>
                <div className="bg-sepia-100 rounded p-2.5 border border-parchment-200">
                  <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Grado</p>
                  <p className="text-sm font-body text-ink-700 font-medium">{a.tema_libro?.grado ?? '—'}</p>
                </div>
                <div className="bg-sepia-100 rounded p-2.5 border border-parchment-200">
                  <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Campo formativo</p>
                  <p className="text-sm font-body text-ink-700 font-medium leading-tight">{getCampoNombre(a.contenido?.campo_formativo_id)}</p>
                </div>
                <div className="bg-sepia-100 rounded p-2.5 border border-parchment-200">
                  <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Preguntas</p>
                  <p className="text-sm font-body text-ink-700 font-medium">{a.questions?.length ?? 0}</p>
                </div>
              </div>

              {/* Tema del libro */}
              {a.tema_libro && (
                <div className="mb-4 p-3 bg-white border border-parchment-200 rounded text-sm">
                  <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Tema del libro</p>
                  <p className="font-body text-ink-800 font-medium">{a.tema_libro.tema_principal}</p>
                  {a.tema_libro.subtema && <p className="text-ink-500 text-xs mt-0.5">{a.tema_libro.subtema}</p>}
                  <p className="text-ink-300 text-xs font-mono mt-0.5">p. {a.tema_libro.pagina}</p>
                </div>
              )}

              {/* NEM y PDA */}
              {(a.contenido || a.aprendizaje) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {a.contenido && (
                    <div className="p-3 bg-white border border-parchment-200 rounded text-sm">
                      <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Contenido NEM</p>
                      <p className="font-body text-ink-700">
                        <span className="font-mono text-xs text-ink-300">[{a.contenido.codigo}]</span> {a.contenido.nombre}
                      </p>
                    </div>
                  )}
                  {a.aprendizaje && (
                    <div className="p-3 bg-white border border-parchment-200 rounded text-sm">
                      <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">PDA</p>
                      <p className="font-body text-ink-700">{a.aprendizaje.descripcion}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Resultado del grupo (si hay sesiones) */}
              {a.sessionCount > 0 && (
                <div className="flex items-center gap-4 mb-4 p-3 bg-white border border-parchment-200 rounded text-sm">
                  <div>
                    <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Estudiantes</p>
                    <p className="font-body font-medium text-ink-700">{a.sessionCount}</p>
                  </div>
                  <div className="w-px h-8 bg-parchment-200" />
                  <div>
                    <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-0.5">Promedio</p>
                    <span className={`font-mono font-bold text-lg ${
                      a.avgScore >= 80 ? 'text-green-700' : a.avgScore >= 60 ? 'text-gold-600' : 'text-crimson-500'
                    }`}>{a.avgScore}</span>
                    <span className="font-mono text-ink-400 text-xs">/100</span>
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div>
                <label className="text-xs font-mono text-ink-400 uppercase tracking-wider block mb-1.5">
                  Observaciones del docente
                </label>
                <textarea
                  defaultValue={a.observaciones ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (a.observaciones ?? '')) {
                      handleSaveObservaciones(a.id, e.target.value)
                    }
                  }}
                  rows={3}
                  placeholder="Escribe tus observaciones sobre esta actividad…"
                  className="w-full border border-parchment-300 rounded px-3 py-2.5 font-body text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none"
                />
                <div className="flex items-center justify-end mt-1 h-5">
                  {savingId === a.id && (
                    <p className="text-xs text-ink-400 font-body flex items-center gap-1">
                      <Save className="w-3 h-3" /> Guardando…
                    </p>
                  )}
                  {savedId === a.id && (
                    <p className="text-xs text-green-600 font-body">✓ Guardado</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
