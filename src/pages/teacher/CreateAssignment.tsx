import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'
import { Plus, Trash2, ArrowLeft, Save, Eye, GripVertical, ChevronDown, ChevronUp, Clock, Check, BookOpen, Sparkles, Loader } from 'lucide-react'
import ImportQuestionsModal from '../../components/teacher/ImportQuestionsModal'
import type { ParsedQuestion } from '../../components/teacher/ImportQuestionsModal'
import TranscriptFallbackModal from '../../components/teacher/TranscriptFallbackModal'

const supabase = SupabaseTypes.supabase
type QuestionType = SupabaseTypes.QuestionType
type QuestionOption = SupabaseTypes.QuestionOption

interface QuestionForm {
  id?: string
  timestamp_seconds: number
  question_type: QuestionType
  question_text: string
  options: QuestionOption[]
  correct_answer: string
  points: number
  order_index: number
}

function secondsToTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + (parts[1] || 0)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0)
  return 0
}

function newQuestion(order: number): QuestionForm {
  return {
    timestamp_seconds: 60,
    question_type: 'multiple_choice',
    question_text: '',
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
      { id: 'c', text: '' },
      { id: 'd', text: '' },
    ],
    correct_answer: 'a',
    points: 10,
    order_index: order,
  }
}

const normalize = (str: string) =>
  str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export default function CreateAssignment() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEdit = !!editId

  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [expandedQ, setExpandedQ] = useState<number | null>(0)

  const [title, setTitle] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [isPublished, setIsPublished] = useState(false)

  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedMateria, setSelectedMateria] = useState<string>('')

  const [temasLibro, setTemasLibro] = useState<any[]>([])
  const [selectedTema, setSelectedTema] = useState<any | null>(null)
  const [searchTema, setSearchTema] = useState('')
  const [loadingTemas, setLoadingTemas] = useState(false)

  const [selectedContenido, setSelectedContenido] = useState<any | null>(null)
  const [selectedAprendizaje, setSelectedAprendizaje] = useState<any | null>(null)

  const [questions, setQuestions] = useState<QuestionForm[]>([newQuestion(0)])
  const [showTranscriptFallback, setShowTranscriptFallback] = useState(false)

  // ── Analizar grupos seleccionados ──────────────────────────────────────────
  const { gradosUnicos, materiasUnicas, inferredGrado } = useMemo(() => {
    const selected = groups.filter(g => selectedGroupIds.includes(g.id))
    if (selected.length === 0) return { gradosUnicos: [], materiasUnicas: [], inferredGrado: null }

    const gradosSet = new Set<string>()
    const materiasSet = new Set<string>()

    selected.forEach(g => {
      if (g.grado) gradosSet.add(g.grado)
      const mats = Array.isArray(g.materias) ? g.materias : []
      mats.forEach((m: string) => { if (m) materiasSet.add(m) })
    })

    const gradosArr = [...gradosSet]
    const materiasArr = [...materiasSet]

    return {
      gradosUnicos: gradosArr,
      materiasUnicas: materiasArr,
      inferredGrado: gradosArr.length === 1 ? gradosArr[0] : null,
    }
  }, [selectedGroupIds, groups])

  const materiaFinal = materiasUnicas.length === 1 ? materiasUnicas[0] : selectedMateria
  const necesitaElegirMateria = materiasUnicas.length > 1

  // Resetear materia al cambiar grupos
  useEffect(() => { setSelectedMateria('') }, [selectedGroupIds])

  // ── Cargar temas ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!materiaFinal || !inferredGrado) {
      setTemasLibro([])
      setSelectedTema(null)
      setSelectedContenido(null)
      setSelectedAprendizaje(null)
      return
    }
    setLoadingTemas(true)
    setSelectedTema(null)
    setSelectedContenido(null)
    setSelectedAprendizaje(null)
    setSearchTema('')

    supabase
      .from('temas_libro')
      .select(`
        *,
        contenido:nem_contenidos(id, codigo, nombre),
        aprendizaje:nem_aprendizajes!temas_libro_aprendizaje_id_fkey(id, descripcion)
      `)
      .eq('materia', materiaFinal)
      .eq('grado', inferredGrado)
      .order('orden')
      .then(({ data }) => {
        setTemasLibro(data ?? [])
        setLoadingTemas(false)
      })
  }, [materiaFinal, inferredGrado])

  // ── Al seleccionar tema ────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedTema) { setSelectedContenido(null); setSelectedAprendizaje(null); return }
    setSelectedContenido(selectedTema.contenido ?? null)
    setSelectedAprendizaje(selectedTema.aprendizaje ?? null)
  }, [selectedTema])

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return

    supabase.from('groups')
      .select('id, name, grado, materias, campo_formativo_id')
      .eq('teacher_id', profile!.id)
      .eq('archived', false)
      .order('name')
      .then(({ data }) => setGroups(data ?? []))

    if (isEdit) {
      supabase.from('video_assignments').select('*').eq('id', editId).single()
        .then(async ({ data }) => {
          if (!data) return
          setTitle(data.title ?? '')
          setVideoUrl(data.video_url ?? '')
          setDueDate(data.due_date ? data.due_date.substring(0, 16) : '')
          setPublishAt(data.publish_at ? data.publish_at.substring(0, 16) : '')
          setIsPublished(data.is_published ?? false)

          if (data.tema_libro_id) {
            const { data: tema } = await supabase
              .from('temas_libro')
              .select('*, contenido:nem_contenidos(id, codigo, nombre), aprendizaje:nem_aprendizajes(id, descripcion)')
              .eq('id', data.tema_libro_id).single()
            if (tema) { setSelectedTema(tema); setSelectedMateria(tema.materia ?? '') }
          } else if (data.nem_contenido_id) {
            const { data: contenido } = await supabase
              .from('nem_contenidos').select('*').eq('id', data.nem_contenido_id).single()
            if (contenido) setSelectedContenido(contenido)
          }
        })

      supabase.from('assignment_groups').select('group_id').eq('assignment_id', editId)
        .then(({ data }) => setSelectedGroupIds((data ?? []).map((r: any) => r.group_id)))

      supabase.from('questions').select('*').eq('assignment_id', editId).order('order_index')
        .then(({ data }) => {
          if (data && data.length > 0) {
            setQuestions(data.map((q: any) => ({
              ...q,
              correct_answer: q.correct_answer ?? '',
              options: q.options ?? [{ id: 'a', text: '' }, { id: 'b', text: '' }],
            })))
          }
        })
    }
  }, [profile?.id, isEdit, editId])

  // ── Guardar ────────────────────────────────────────────────────────────────
  const handleSave = async (publish = false) => {
    if (!profile?.id) { alert('No hay sesión activa'); return }
    if (!title.trim()) { alert('El título es obligatorio'); return }
    if (!videoUrl.trim()) { alert('La URL del video es obligatoria'); return }
    if (selectedGroupIds.length === 0) { alert('Selecciona al menos un grupo'); return }
    if (necesitaElegirMateria && !selectedMateria) { alert('Selecciona la materia de esta actividad'); return }

    setSaving(true)
    const payload = {
      teacher_id: profile!.id,
      title: title.trim(),
      topic: title.trim(),
      video_url: videoUrl.trim(),
      due_date: dueDate || null,
      publish_at: publishAt || null,
      is_published: publish || isPublished,
      tema_libro_id: selectedTema?.id ?? null,
      nem_contenido_id: selectedContenido?.id ?? null,
      aprendizaje_id: selectedAprendizaje?.id ?? null,
      campo_formativo_id: selectedContenido?.campo_formativo_id ?? null,
      group_id: null,
    }

    let assignmentId = editId
    if (isEdit) {
      const { error } = await supabase.from('video_assignments').update(payload).eq('id', editId)
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
      await supabase.from('questions').delete().eq('assignment_id', editId)
      await supabase.from('assignment_groups').delete().eq('assignment_id', editId)
    } else {
      const { data, error } = await supabase.from('video_assignments').insert(payload).select().single()
      if (error) { alert(`Error: ${error.message}`); setSaving(false); return }
      assignmentId = data?.id
    }

    if (!assignmentId) { alert('No se pudo obtener el ID'); setSaving(false); return }

    const { error: groupError } = await supabase.from('assignment_groups')
      .insert(selectedGroupIds.map(gid => ({ assignment_id: assignmentId, group_id: gid })))
    if (groupError) { alert(`Error grupos: ${groupError.message}`); setSaving(false); return }

    const qPayload = questions.filter(q => q.question_text.trim()).map((q, i) => ({
      assignment_id: assignmentId,
      timestamp_seconds: q.timestamp_seconds,
      question_type: q.question_type,
      question_text: q.question_text,
      options: q.question_type === 'multiple_choice' ? q.options.filter(o => o.text.trim()) : null,
      correct_answer: q.question_type === 'open' ? null : q.correct_answer,
      points: q.points,
      order_index: i,
    }))
    if (qPayload.length > 0) {
      const { error: qError } = await supabase.from('questions').insert(qPayload)
      if (qError) { alert(`Error preguntas: ${qError.message}`); setSaving(false); return }
    }

    setSaving(false)
    navigate('/teacher/assignments')
  }

  const toggleGroup = (id: string) =>
    setSelectedGroupIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])

  const handleImport = (imported: ParsedQuestion[]) => {
    setQuestions(prev => [
      ...prev.filter(q => q.question_text.trim()),
      ...imported.map((q, i) => ({
        ...q,
        order_index: prev.filter(p => p.question_text.trim()).length + i,
      })),
    ])
    setExpandedQ(null)
  }

  const addQuestion = () => { setQuestions(prev => [...prev, newQuestion(prev.length)]); setExpandedQ(questions.length) }
  const removeQuestion = (idx: number) => { setQuestions(prev => prev.filter((_, i) => i !== idx)); setExpandedQ(null) }
  const updateQuestion = (idx: number, patch: Partial<QuestionForm>) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q))
  const updateOption = (qIdx: number, optId: string, text: string) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map(o => o.id === optId ? { ...o, text } : o) } : q))

  const [generatingAI, setGeneratingAI] = useState(false)
  const [aiError, setAiError] = useState('')

  // ── Generar preguntas con IA ───────────────────────────────────────────────
  const generateWithAI = async () => {
    if (!videoUrl.trim()) return
    setGeneratingAI(true)
    setAiError('')

    try {
      // Construir contexto pedagógico
      const contexto = [
        title && `Título de la actividad: ${title}`,
        materiaFinal && `Materia: ${materiaFinal}`,
        inferredGrado && `Grado: ${inferredGrado}`,
        selectedTema && `Tema del libro: ${selectedTema.tema_principal}`,
        selectedContenido && `Contenido NEM: ${selectedContenido.nombre}`,
        selectedAprendizaje && `PDA: ${selectedAprendizaje.descripcion}`,
      ].filter(Boolean).join('\n')

      // Una sola llamada a la Edge Function — hace transcripción + Claude internamente
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const res = await fetch(
        'https://vioylqkituyzknwfpbhu.supabase.co/functions/v1/get-transcript',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ url: videoUrl.trim(), contexto })
        }
      )
      const data = await res.json()

      if (!res.ok || !data.preguntas?.length) {
        throw new Error(data.error || 'No se pudieron generar preguntas. Verifica que el video tenga subtítulos activados.')
      }

      // Convertir al formato QuestionForm
      const nuevas: QuestionForm[] = data.preguntas.map((p: any, i: number) => ({
        timestamp_seconds: Math.round((p.timestamp_segundos ?? 60) + 10),
        question_type: p.tipo as QuestionType,
        question_text: p.texto ?? '',
        options: p.tipo === 'multiple_choice'
          ? (p.opciones ?? []).map((o: any) => ({ id: o.id, text: o.texto }))
          : [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
        correct_answer: p.tipo === 'open' ? '' : (p.respuesta_correcta ?? 'a'),
        points: p.puntos ?? 10,
        order_index: questions.length + i,
      }))

      setQuestions(prev => [...prev.filter(q => q.question_text.trim()), ...nuevas])
      setExpandedQ(questions.filter(q => q.question_text.trim()).length)

      } catch (err: any) {
        setShowTranscriptFallback(true)
      } finally {
      setGeneratingAI(false)
    }
  }

  const filteredTemas = temasLibro.filter(t => {
    const q = normalize(searchTema)
    if (!q) return true
    return normalize(t.tema_principal || '').includes(q) || normalize(t.subtema || '').includes(q)
  })

  const canShowTemas = inferredGrado && materiaFinal && gradosUnicos.length === 1

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/teacher/assignments')} className="text-ink-400 hover:text-ink-700 p-1.5 rounded hover:bg-sepia-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">{isEdit ? 'Editar actividad' : 'Nueva actividad'}</h1>
          <p className="font-body text-ink-600 mt-0.5">Configura el video y sus preguntas interactivas</p>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Bloque 1: Asignación ── */}
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">1</span>
            Asignación
          </h2>
          <div className="space-y-4">

            <div>
              <label className="label-style">Título de la actividad *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="ej. Teorema de Pitágoras" className="input-style w-full" />
            </div>

            <div>
              <label className="label-style">
                Grupos *
                {selectedGroupIds.length > 0 && (
                  <span className="ml-2 text-xs font-mono text-green-700 font-normal">
                    {selectedGroupIds.length} seleccionado{selectedGroupIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </label>
              {groups.length === 0 ? (
                <p className="text-sm text-ink-400 font-body">No tienes grupos activos. <a href="/teacher/groups" className="text-crimson-500 underline">Crea uno primero.</a></p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {groups.map(g => {
                    const isSelected = selectedGroupIds.includes(g.id)
                    return (
                      <button key={g.id} onClick={() => toggleGroup(g.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-all ${
                          isSelected ? 'border-green-600 bg-green-700/10' : 'border-parchment-300 bg-white hover:border-gold-400 hover:bg-sepia-100'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 ${
                          isSelected ? 'bg-green-600 border-green-600' : 'border-parchment-400'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-body font-medium text-sm truncate text-ink-800">{g.name}</p>
                          {g.grado && <p className="text-xs text-ink-400 truncate">{g.grado}</p>}
                          {g.materias?.length > 0 && <p className="text-xs text-ink-300 truncate">{g.materias.join(', ')}</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Materia+grado detectados */}
              {inferredGrado && materiaFinal && (
                <div className="mt-3 flex items-center gap-2 text-sm font-body text-ink-600 bg-sepia-100 px-3 py-2 rounded border border-parchment-200">
                  <BookOpen className="w-4 h-4 text-ink-400 flex-shrink-0" />
                  <span><strong>{materiaFinal}</strong> · <strong>{inferredGrado}</strong></span>
                </div>
              )}

              {/* Selector de materia cuando hay varias */}
              {necesitaElegirMateria && inferredGrado && (
                <div className="mt-3">
                  <label className="label-style">¿Para qué materia es esta actividad? *</label>
                  <div className="flex flex-wrap gap-2">
                    {materiasUnicas.map(m => (
                      <button key={m} onClick={() => setSelectedMateria(m)}
                        className={`px-3 py-1.5 rounded border text-sm font-body transition-all ${
                          selectedMateria === m
                            ? 'border-green-600 bg-green-700/10 text-green-800 font-medium'
                            : 'border-parchment-300 bg-white text-ink-600 hover:border-gold-400'
                        }`}
                      >{m}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Aviso distintos grados */}
              {gradosUnicos.length > 1 && (
                <div className="mt-3 p-3 bg-gold-400/10 border border-gold-400/30 rounded text-sm font-body text-ink-600">
                  ⚠️ Grupos de distintos grados ({gradosUnicos.join(', ')}). No se podrá vincular un tema del libro.
                </div>
              )}
            </div>

            <div>
              <label className="label-style">Fecha de publicación (opcional)</label>
              <input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)} className="input-style w-full" />
            </div>

            <div>
              <label className="label-style">Fecha límite (opcional)</label>
              <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-style w-full" />
            </div>
          </div>
        </div>

        {/* ── Bloque 2: Tema del libro ── */}
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">2</span>
            Tema del libro de texto
          </h2>

          {!canShowTemas ? (
            <p className="text-sm font-body text-ink-400">
              {selectedGroupIds.length === 0
                ? 'Selecciona al menos un grupo.'
                : gradosUnicos.length > 1
                ? 'Selecciona grupos del mismo grado para vincular un tema.'
                : necesitaElegirMateria && !selectedMateria
                ? 'Elige la materia arriba para ver los temas disponibles.'
                : 'Los grupos no tienen materia o grado configurado.'}
            </p>
          ) : loadingTemas ? (
            <div className="flex items-center gap-2 text-sm text-ink-500 font-body">
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Cargando temas de {materiaFinal}…
            </div>
          ) : (
            <div className="space-y-3">
              {selectedTema ? (
                <>
                  <div className="p-3 bg-green-700/10 border border-green-700/20 rounded">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-body font-medium text-green-800">{selectedTema.tema_principal}</p>
                        {selectedTema.subtema && <p className="text-xs text-green-700 mt-0.5">{selectedTema.subtema}</p>}
                        <p className="text-xs text-ink-400 mt-1 font-mono">p. {selectedTema.pagina}</p>
                      </div>
                      <button onClick={() => { setSelectedTema(null); setSearchTema('') }}
                        className="text-green-700 hover:text-crimson-500 text-xs flex-shrink-0">✕</button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {selectedContenido ? (
                      <div className="p-3 bg-sepia-100 border border-parchment-200 rounded text-sm">
                        <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Contenido NEM</p>
                        <p className="font-body text-ink-700">
                          <span className="font-mono text-xs text-ink-400">[{selectedContenido.codigo}]</span> {selectedContenido.nombre}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400 font-body bg-sepia-100 px-3 py-2 rounded border border-parchment-200">
                        📚 Este tema aún no tiene contenido NEM vinculado.
                      </p>
                    )}
                    {selectedAprendizaje ? (
                      <div className="p-3 bg-sepia-100 border border-parchment-200 rounded text-sm">
                        <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">PDA</p>
                        <p className="font-body text-ink-700">{selectedAprendizaje.descripcion}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400 font-body bg-sepia-100 px-3 py-2 rounded border border-parchment-200">
                        📋 Este tema aún no tiene PDA vinculado.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <input type="text" value={searchTema} onChange={e => setSearchTema(e.target.value)}
                    placeholder={`Buscar tema de ${materiaFinal}…`} className="input-style w-full" />
                  <div className="border border-parchment-200 rounded overflow-hidden max-h-64 overflow-y-auto bg-white">
                    {temasLibro.length === 0 ? (
                      <p className="text-center text-ink-400 font-body text-sm py-4">
                        No hay temas cargados para {materiaFinal} {inferredGrado}.
                      </p>
                    ) : filteredTemas.length === 0 ? (
                      <p className="text-center text-ink-400 font-body text-sm py-4">Sin resultados para "{searchTema}"</p>
                    ) : filteredTemas.map(t => (
                      <button key={t.id} onClick={() => setSelectedTema(t)}
                        className="w-full text-left px-3 py-2.5 text-sm font-body border-b border-parchment-100 last:border-0 hover:bg-sepia-100 transition-colors"
                      >
                        <p className="text-ink-800 font-medium leading-tight">{t.tema_principal}</p>
                        {t.subtema && <p className="text-ink-500 text-xs mt-0.5">{t.subtema}</p>}
                        <p className="text-ink-300 text-xs font-mono mt-0.5">p. {t.pagina}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Bloque 3: Video ── */}
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">3</span>
            Video
          </h2>
          <div>
            <label className="label-style">URL del video *</label>
            <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…" className="input-style w-full font-mono text-sm" />
            <p className="text-xs text-ink-400 mt-1.5 font-body">Compatible con YouTube.</p>
          </div>
        </div>

        {/* ── Bloque 4: Preguntas ── */}
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-ink-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">4</span>
              Preguntas interactivas
              <span className="font-mono text-sm text-ink-400 font-normal">({questions.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              {videoUrl.trim() && (
                <button
                  onClick={generateWithAI}
                  disabled={generatingAI}
                  title="Generar preguntas automáticamente a partir del video"
                  className="flex items-center gap-1.5 text-sm bg-gold-400/20 border border-gold-400/40 text-gold-700 px-3 py-1.5 rounded hover:bg-gold-400/30 disabled:opacity-50 transition-colors font-body font-medium"
                >
                  {generatingAI
                    ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Generando…</>
                    : <><Sparkles className="w-3.5 h-3.5" /> Generar con IA</>
                  }
                </button>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 text-sm bg-gold-400/20 border border-gold-400/40 text-gold-700 px-3 py-1.5 rounded hover:bg-gold-400/30 transition-colors font-body"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Pegar desde doc
                </button>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 text-sm bg-sepia-100 border border-parchment-300 text-ink-700 px-3 py-1.5 rounded hover:bg-sepia-200 transition-colors font-body"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar pregunta
                </button>
              </div>
            </div>
          </div>
          {aiError && (
            <div className="mb-4 p-3 bg-crimson-500/10 border border-crimson-500/20 rounded text-sm font-body text-crimson-600">
              ⚠️ {aiError}
            </div>
          )}
          {generatingAI && (
            <div className="mb-4 p-4 bg-gold-400/10 border border-gold-400/30 rounded text-sm font-body text-ink-600 flex items-center gap-3">
              <Loader className="w-4 h-4 animate-spin text-gold-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-ink-700">Analizando el video con IA…</p>
                <p className="text-xs text-ink-500 mt-0.5">Obteniendo transcripción y generando preguntas. Puede tomar 15-30 segundos.</p>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionEditor key={idx} q={q} idx={idx} isExpanded={expandedQ === idx}
                onToggle={() => setExpandedQ(expandedQ === idx ? null : idx)}
                onUpdate={(patch) => updateQuestion(idx, patch)}
                onUpdateOption={(optId, text) => updateOption(idx, optId, text)}
                onRemove={() => removeQuestion(idx)} />
            ))}
          </div>
          {questions.length === 0 && (
            <div className="text-center py-8 text-ink-400 border-2 border-dashed border-parchment-300 rounded">
              <p className="font-body text-sm">Sin preguntas. El video se reproducirá sin interrupciones.</p>
            </div>
          )}
        </div>

        {/* ── Botones ── */}
        <div className="flex items-center justify-end gap-3 pb-8">
          <button onClick={() => navigate('/teacher/assignments')} className="px-5 py-2.5 border border-parchment-300 text-ink-700 rounded-sm font-body hover:bg-sepia-100 transition-colors">
            Cancelar
          </button>
          <button onClick={() => handleSave(false)} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink-700 text-parchment-100 rounded-sm font-body font-medium hover:bg-ink-800 disabled:opacity-40 transition-colors shadow-manuscript">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-crimson-500 text-parchment-50 rounded-sm font-body font-medium hover:bg-crimson-600 disabled:opacity-40 transition-colors shadow-manuscript">
            <Eye className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Publicar'}
          </button>
        </div>
      </div>

      <style>{`
        .label-style { display: block; font-size: 0.875rem; font-weight: 500; color: #3d2c14; margin-bottom: 0.375rem; font-family: 'Source Serif 4', serif; }
        .input-style { border: 1px solid #e8d3a9; border-radius: 0.25rem; padding: 0.5rem 0.75rem; font-family: 'Source Serif 4', serif; color: #2d1f0e; background: white; transition: border-color 0.15s; }
        .input-style:focus { outline: none; border-color: #3fad6a; box-shadow: 0 0 0 3px rgba(63,173,106,0.15); }
      `}</style>
      {showImport && (
        <ImportQuestionsModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
          currentCount={questions.filter(q => q.question_text.trim()).length}
        />
      )}
      {showTranscriptFallback && (
        <TranscriptFallbackModal
          onImport={handleImport}
          onClose={() => setShowTranscriptFallback(false)}
          currentCount={questions.filter(q => q.question_text.trim()).length}
          contexto={title ? `Título: ${title}` : ''}
        />
      )}
    </div>
  )
}

function QuestionEditor({ q, idx, isExpanded, onToggle, onUpdate, onUpdateOption, onRemove }: {
  q: QuestionForm; idx: number; isExpanded: boolean
  onToggle: () => void; onUpdate: (p: Partial<QuestionForm>) => void
  onUpdateOption: (id: string, text: string) => void; onRemove: () => void
}) {
  const typeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero / Falso',
    open: 'Pregunta abierta',
  }

  return (
    <div className="border border-parchment-300 rounded bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-sepia-100/50" onClick={onToggle}>
        <GripVertical className="w-4 h-4 text-ink-300 flex-shrink-0" />
        <span className="font-mono text-xs text-ink-400 flex-shrink-0">#{idx + 1}</span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs bg-gold-400/20 text-gold-600 px-2 py-0.5 rounded font-mono flex-shrink-0">
            {typeLabels[q.question_type]}
          </span>
          <span className="flex items-center gap-1 text-xs text-ink-400 flex-shrink-0">
            <Clock className="w-3 h-3" />{secondsToTime(q.timestamp_seconds)}
          </span>
          <p className="text-sm text-ink-700 font-body truncate">
            {q.question_text || <span className="text-ink-300 italic">Sin texto…</span>}
          </p>
        </div>
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="text-ink-300 hover:text-crimson-500 p-1 flex-shrink-0">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-ink-400 flex-shrink-0" />}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-parchment-200 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-style">Tipo</label>
              <select value={q.question_type}
                onChange={e => onUpdate({ question_type: e.target.value as QuestionType, correct_answer: e.target.value === 'true_false' ? 'true' : 'a' })}
                className="input-style w-full text-sm">
                <option value="multiple_choice">Opción múltiple</option>
                <option value="true_false">Verdadero / Falso</option>
                <option value="open">Pregunta abierta</option>
              </select>
            </div>
            <div>
              <label className="label-style">Pausa en (mm:ss)</label>
              <input type="text" value={secondsToTime(q.timestamp_seconds)}
                onChange={e => onUpdate({ timestamp_seconds: timeToSeconds(e.target.value) })}
                placeholder="01:30" className="input-style w-full font-mono text-sm" />
            </div>
            <div>
              <label className="label-style">Puntos</label>
              <input type="number" min={1} max={100} value={q.points}
                onChange={e => onUpdate({ points: Number(e.target.value) })}
                className="input-style w-full font-mono text-sm" />
            </div>
          </div>

          <div>
            <label className="label-style">Pregunta</label>
            <textarea value={q.question_text} onChange={e => onUpdate({ question_text: e.target.value })}
              rows={2} className="input-style w-full resize-none" placeholder="Escribe la pregunta…" />
          </div>

          {q.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              <label className="label-style">Opciones (marca la correcta)</label>
              {q.options.map(opt => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${idx}`} checked={q.correct_answer === opt.id}
                    onChange={() => onUpdate({ correct_answer: opt.id })} className="w-4 h-4 accent-gold-500 flex-shrink-0" />
                  <span className="font-mono text-xs text-ink-400 w-4">{opt.id.toUpperCase()})</span>
                  <input value={opt.text} onChange={e => onUpdateOption(opt.id, e.target.value)}
                    placeholder={`Opción ${opt.id.toUpperCase()}`} className="input-style flex-1 text-sm" />
                </div>
              ))}
            </div>
          )}

          {q.question_type === 'true_false' && (
            <div>
              <label className="label-style">Respuesta correcta</label>
              <div className="flex gap-3">
                {['true', 'false'].map(val => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={`tf-${idx}`} checked={q.correct_answer === val}
                      onChange={() => onUpdate({ correct_answer: val })} className="w-4 h-4 accent-gold-500" />
                    <span className="font-body text-sm text-ink-700">{val === 'true' ? '✓ Verdadero' : '✗ Falso'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {q.question_type === 'open' && (
            <div className="bg-sepia-100 rounded p-3 text-sm font-body text-ink-500 border border-parchment-200">
              💬 El estudiante escribirá su respuesta. No se califica automáticamente.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
