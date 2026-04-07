import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'

const supabase = SupabaseTypes.supabase
const MATERIAS = SupabaseTypes.MATERIAS
type Question = SupabaseTypes.Question
type QuestionType = SupabaseTypes.QuestionType
type QuestionOption = SupabaseTypes.QuestionOption
type NEMContenido = SupabaseTypes.NEMContenido
type NEMAprendizaje = SupabaseTypes.NEMAprendizaje

import { Plus, Trash2, ArrowLeft, Save, Eye, GripVertical, ChevronDown, ChevronUp, Clock } from 'lucide-react'

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
export default function CreateAssignment() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEdit = !!editId

  const [groups, setGroups] = useState<any[]>([])
  const [contenidos, setContenidos] = useState<NEMContenido[]>([])
  const [filteredContenidos, setFilteredContenidos] = useState<NEMContenido[]>([])
  const [searchContenido, setSearchContenido] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedQ, setExpandedQ] = useState<number | null>(0)

  const [form, setForm] = useState({
    group_id: '',
    title: '',
    nem_contenido_id: '',
    nem_aprendizaje_id: '',
    video_url: '',
    due_date: '',
    is_published: false,
  })

  const [questions, setQuestions] = useState<QuestionForm[]>([newQuestion(0)])
  const [selectedMateria, setSelectedMateria] = useState<string>('')
  const [selectedCampoFormativo, setSelectedCampoFormativo] = useState('')
  const [aprendizajes, setAprendizajes] = useState<any[]>([])

  useEffect(() => {
    if (!profile?.id) return
    supabase.from('groups').select('id, name, materia').eq('teacher_id', profile!.id).then(({ data }) => setGroups(data ?? []))
    supabase.from('nem_contenidos').select('*, campo_formativo:nem_campos_formativos(codigo, nombre)').then(({ data }) => setContenidos(data ?? []))
    supabase.from('nem_aprendizajes').select('*').then(({ data }) => setAprendizajes(data ?? []))
    
    if (isEdit) {
      supabase.from('video_assignments').select('*').eq('id', editId).single().then(({ data }) => {
        if (data) {
          setForm({
            group_id: data.group_id,
            title: data.title,
            topic: data.topic,
            objective: data.objective ?? '',
            nem_proceso: data.nem_proceso ?? '',
            nem_contenido_id: data.nem_contenido_id ?? '',
            video_url: data.video_url,
            due_date: data.due_date ? data.due_date.substring(0, 16) : '',
            is_published: data.is_published,
          })
        }
      })
      supabase.from('questions').select('*').eq('assignment_id', editId).order('order_index').then(({ data }) => {
        if (data && data.length > 0) {
          setQuestions(data.map((q: Question) => ({
            ...q,
            correct_answer: q.correct_answer ?? '',
            options: q.options ?? [{ id: 'a', text: '' }, { id: 'b', text: '' }],
          })))
        }
      })
    }
  }, [profile?.id, isEdit, editId])

  useEffect(() => {
    const selected = groups.find(g => g.id === form.group_id)
    if (selected?.materia) {
      setSelectedMateria(selected.materia)
      const campoCode = SupabaseTypes.getCampoFormativoCodigo(selected.materia as any)
      const campo = ['LEN', 'SAB', 'ETI', 'HUM'].find(c => c === campoCode)
      const nombres: any = {
        'LEN': 'Lenguajes',
        'SAB': 'Saberes y Pensamiento Científico',
        'ETI': 'Ética, Naturaleza y Sociedades',
        'HUM': 'De lo Humano y lo Comunitario'
      }
      setSelectedCampoFormativo(campo ? nombres[campo] : '')
    } else {
      setSelectedMateria('')
      setSelectedCampoFormativo('')
    }
  }, [form.group_id, groups])

  useEffect(() => {
    if (!selectedMateria) {
      setFilteredContenidos([])
      return
    }
    const filtered = contenidos.filter(c => c.materia === selectedMateria)
    if (searchContenido.trim()) {
      const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const searchNorm = normalize(searchContenido)
      setFilteredContenidos(filtered.filter(c => {
        const codigo = normalize(c.codigo || '')
        const contenido = normalize(c.nombre || '')
        return codigo.includes(searchNorm) || nombre.includes(searchNorm)
      }))
    } else {
      setFilteredContenidos(filtered)
    }
  }, [selectedMateria, searchContenido, contenidos])

  const handleSave = async (publish = false) => {
    if (!profile?.id || !form.group_id || !form.title || !form.video_url) {
      alert('Completa: grupo, título y URL del video')
      return
    }
    setSaving(true)
    const payload = { 
      group_id: form.group_id,
      teacher_id: profile!.id,
      title: form.title,
      topic: form.title,
      nem_contenido_id: form.nem_contenido_id || null,
      aprendizaje_id: form.nem_aprendizaje_id || null,
      video_url: form.video_url,
      due_date: form.due_date || null,
      is_published: publish || form.is_published
    }
   console.log('📤 Enviando payload:', payload)
    let assignmentId = editId

    if (isEdit) {
      await supabase.from('video_assignments').update(payload).eq('id', editId)
      await supabase.from('questions').delete().eq('assignment_id', editId)
    } else {
      const { data, error } = await supabase.from('video_assignments').insert(payload).select().single()
      if (error) {
        console.error('❌ Error al crear actividad:', error)
        alert(`Error: ${error.message}`)
        setSaving(false)
        return
    }

      assignmentId = data?.id
    }

    if (assignmentId) {
      const qPayload = questions
        .filter(q => q.question_text.trim())
        .map((q, i) => ({
          assignment_id: assignmentId,
          timestamp_seconds: q.timestamp_seconds,
          question_type: q.question_type,
          question_text: q.question_text,
          options: q.question_type === 'multiple_choice' ? q.options.filter(o => o.text.trim()) : null,
          correct_answer: q.question_type === 'open' ? null : q.correct_answer,
          points: q.points,
          order_index: i,
        }))
      if (qPayload.length > 0) await supabase.from('questions').insert(qPayload)
    }

    setSaving(false)
    navigate('/teacher/assignments')
  }

  const addQuestion = () => {
    const newQ = newQuestion(questions.length)
    setQuestions(prev => [...prev, newQ])
    setExpandedQ(questions.length)
  }

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx))
    setExpandedQ(null)
  }

  const updateQuestion = (idx: number, patch: Partial<QuestionForm>) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q))
  }

  const updateOption = (qIdx: number, optId: string, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map(o => o.id === optId ? { ...o, text } : o) }
      : q
    ))
  }
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
        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">1</span>
            Información general
          </h2>

<div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="label-style">Grupo *</label>
                <select value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))} className="input-style w-full">
                  <option value="">Seleccionar grupo…</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} · {g.materia}</option>)}
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="label-style">Fecha límite (opcional)</label>
                <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input-style w-full" />
              </div>
            </div>

            {selectedCampoFormativo && (
              <div>
                <label className="label-style">Campo Formativo</label>
                <input 
                  type="text" 
                  value={selectedCampoFormativo}
                  disabled
                  className="input-style w-full bg-sepia-100 text-ink-600 cursor-not-allowed"
                />
              </div>
            )}

            <div>
              <label className="label-style">Título de la actividad *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="ej. La célula y sus organelos" className="input-style w-full" />
            </div>

            {selectedMateria && (
              <>
                <div>
                  <label className="label-style">Contenido NEM ({selectedMateria})</label>
                  <input 
                    type="text" 
                    value={searchContenido}
                    onChange={e => setSearchContenido(e.target.value)}
                    placeholder="Buscar por código o contenido..."
                    className="input-style w-full mb-2"
                  />
                  <select value={form.nem_contenido_id} onChange={e => setForm(f => ({ ...f, nem_contenido_id: e.target.value, nem_aprendizaje_id: '' }))} className="input-style w-full">
                    <option value="">Seleccionar contenido (opcional)…</option>
                    {filteredContenidos.map(c => (
                      <option key={c.id} value={c.id}>
                      [{c.codigo}] {c.nombre || 'Sin descripción'}
                      </option>
                    ))}
                  </select>
                </div>

                {form.nem_contenido_id && (
                  <div>
                    <label className="label-style">Proceso de Desarrollo de Aprendizaje (PDA)</label>
                    <select 
                      value={form.nem_aprendizaje_id} 
                      onChange={e => setForm(f => ({ ...f, nem_aprendizaje_id: e.target.value }))} 
                      className="input-style w-full"
                    >
                      <option value="">Seleccionar PDA (opcional)…</option>
                      {aprendizajes
                        .filter(a => a.contenido_id === form.nem_contenido_id)
                        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
                        .map(a => (
                          <option key={a.id} value={a.id}>
                            {a.descripcion}
                          </option>
                       ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </div>
        </div>          

        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <h2 className="font-display text-lg font-semibold text-ink-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">2</span>
            Video
          </h2>
          <div>
            <label className="label-style">URL del video *</label>
            <input value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://www.youtube.com/watch?v=…" className="input-style w-full font-mono text-sm" />
            <p className="text-xs text-ink-400 mt-1.5 font-body">Compatible con YouTube</p>
          </div>
        </div>

        <div className="bg-parchment-50 rounded-sm shadow-manuscript border border-parchment-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-ink-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-crimson-500 text-parchment-50 rounded text-xs flex items-center justify-center font-mono font-bold">3</span>
              Preguntas interactivas
              <span className="font-mono text-sm text-ink-400 font-normal">({questions.length})</span>
            </h2>
            <button onClick={addQuestion} className="flex items-center gap-1.5 text-sm bg-sepia-100 border border-parchment-300 text-ink-700 px-3 py-1.5 rounded hover:bg-sepia-200 transition-colors font-body">
              <Plus className="w-3.5 h-3.5" />
              Agregar pregunta
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionEditor
                key={idx}
                q={q}
                idx={idx}
                isExpanded={expandedQ === idx}
                onToggle={() => setExpandedQ(expandedQ === idx ? null : idx)}
                onUpdate={(patch) => updateQuestion(idx, patch)}
                onUpdateOption={(optId, text) => updateOption(idx, optId, text)}
                onRemove={() => removeQuestion(idx)}
              />
            ))}
          </div>

          {questions.length === 0 && (
            <div className="text-center py-8 text-ink-400 border-2 border-dashed border-parchment-300 rounded">
              <p className="font-body text-sm">Sin preguntas. El video se reproducirá sin interrupciones.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pb-8">
          <button onClick={() => navigate('/teacher/assignments')} className="px-5 py-2.5 border border-parchment-300 text-ink-700 rounded-sm font-body hover:bg-sepia-100 transition-colors">
            Cancelar
          </button>
          <button onClick={() => handleSave(false)} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-ink-700 text-parchment-100 rounded-sm font-body font-medium hover:bg-ink-800 disabled:opacity-40 transition-colors shadow-manuscript">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-crimson-500 text-parchment-50 rounded-sm font-body font-medium hover:bg-crimson-600 disabled:opacity-40 transition-colors shadow-manuscript">
            <Eye className="w-4 h-4" />
            {saving ? 'Guardando…' : 'Publicar'}
          </button>
        </div>
      </div>

      <style>{`
        .label-style { display: block; font-size: 0.875rem; font-weight: 500; color: #3d2c14; margin-bottom: 0.375rem; font-family: 'Source Serif 4', serif; }
        .input-style { border: 1px solid #e8d3a9; border-radius: 0.25rem; padding: 0.5rem 0.75rem; font-family: 'Source Serif 4', serif; color: #2d1f0e; background: white; transition: border-color 0.15s; }
        .input-style:focus { outline: none; border-color: #d4af37; box-shadow: 0 0 0 3px rgba(212,175,55,0.15); }
        select.input-style { cursor: pointer; }
      `}</style>
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
            <Clock className="w-3 h-3" />
            {secondsToTime(q.timestamp_seconds)}
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
              <select value={q.question_type} onChange={e => onUpdate({ question_type: e.target.value as QuestionType, correct_answer: e.target.value === 'true_false' ? 'true' : 'a' })} className="input-style w-full text-sm">
                <option value="multiple_choice">Opción múltiple</option>
                <option value="true_false">Verdadero / Falso</option>
                <option value="open">Pregunta abierta</option>
              </select>
            </div>
            <div>
              <label className="label-style">Pausa en (mm:ss)</label>
              <input
                type="text"
                value={secondsToTime(q.timestamp_seconds)}
                onChange={e => onUpdate({ timestamp_seconds: timeToSeconds(e.target.value) })}
                placeholder="01:30"
                className="input-style w-full font-mono text-sm"
              />
            </div>
            <div>
              <label className="label-style">Puntos</label>
              <input type="number" min={1} max={100} value={q.points} onChange={e => onUpdate({ points: Number(e.target.value) })} className="input-style w-full font-mono text-sm" />
            </div>
          </div>

          <div>
            <label className="label-style">Pregunta</label>
            <textarea value={q.question_text} onChange={e => onUpdate({ question_text: e.target.value })} rows={2} className="input-style w-full resize-none" placeholder="Escribe la pregunta…" />
          </div>

          {q.question_type === 'multiple_choice' && (
            <div className="space-y-2">
              <label className="label-style">Opciones (marca la correcta)</label>
              {q.options.map(opt => (
                <div key={opt.id} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${idx}`} checked={q.correct_answer === opt.id} onChange={() => onUpdate({ correct_answer: opt.id })} className="w-4 h-4 accent-gold-500 flex-shrink-0" />
                  <span className="font-mono text-xs text-ink-400 w-4">{opt.id.toUpperCase()})</span>
                  <input value={opt.text} onChange={e => onUpdateOption(opt.id, e.target.value)} placeholder={`Opción ${opt.id.toUpperCase()}`} className="input-style flex-1 text-sm" />
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
                    <input type="radio" name={`tf-${idx}`} checked={q.correct_answer === val} onChange={() => onUpdate({ correct_answer: val })} className="w-4 h-4 accent-gold-500" />
                    <span className="font-body text-sm text-ink-700">{val === 'true' ? '✓ Verdadero' : '✗ Falso'}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {q.question_type === 'open' && (
            <div className="bg-sepia-100 rounded p-3 text-sm font-body text-ink-500 border border-parchment-200">
              💬 El estudiante escribirá su respuesta. Se registra para revisión del docente.
            </div>
          )}
        </div>
      )}
    </div>
  )
}