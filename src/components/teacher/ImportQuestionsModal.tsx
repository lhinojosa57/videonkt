// src/components/teacher/ImportQuestionsModal.tsx
// Pegar aquí y en CreateAssignment.tsx importar con:
//   import ImportQuestionsModal from '@/components/teacher/ImportQuestionsModal'

import { useState } from 'react'
import { X, Clipboard, Sparkles, CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

// ─── Types (must match QuestionForm in CreateAssignment.tsx) ──────────────────
export interface QuestionOption {
  id: string
  text: string
}

export interface ParsedQuestion {
  timestamp_seconds: number
  question_type: 'multiple_choice' | 'true_false' | 'open'
  question_text: string
  options: QuestionOption[]
  correct_answer: string
  points: number
  order_index: number
}

interface ImportQuestionsModalProps {
  onImport: (questions: ParsedQuestion[]) => void
  onClose: () => void
  currentCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function secondsToTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function timeToSeconds(t: string): number {
  const parts = t.split(':').map(Number)
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  return 0
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero / Falso',
  open: 'Pregunta abierta',
}

const TYPE_COLORS: Record<string, string> = {
  multiple_choice: 'bg-gold-400/20 text-gold-600',
  true_false: 'bg-crimson-500/10 text-crimson-500',
  open: 'bg-ink-600/10 text-ink-600',
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImportQuestionsModal({ onImport, onClose, currentCount }: ImportQuestionsModalProps) {
  const [step, setStep] = useState<'paste' | 'parsing' | 'preview'>('paste')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedQuestion[]>([])
  const [error, setError] = useState('')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [editingTimestamp, setEditingTimestamp] = useState<Record<number, string>>({})

  // ── Call Claude API to parse ───────────────────────────────────────────────
  const handleParse = async () => {
    if (!rawText.trim()) return
    setError('')
    setStep('parsing')

    const systemPrompt = `Eres un parser de preguntas para una plataforma educativa de video interactivo.
Tu tarea: analizar el texto pegado por un docente y extraer preguntas estructuradas.

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin backticks, sin texto adicional.

Formato de salida (array de objetos):
[
  {
    "question_text": "¿Texto de la pregunta?",
    "question_type": "multiple_choice" | "true_false" | "open",
    "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
    "correct_answer": "a" | "b" | "c" | "d" | "true" | "false" | null,
    "points": 10,
    "timestamp_seconds": 60
  }
]

Reglas:
- Si el texto incluye [mm:ss] o mm:ss al inicio de la pregunta, úsalo como timestamp_seconds
- Si no hay timestamp, distribuye las preguntas equitativamente (primera en segundo 60, siguientes en incrementos de 120s)
- Si hay 4 opciones → multiple_choice
- Si solo hay 2 opciones que sean Verdadero/Falso, Sí/No, Cierto/Falso → true_false, correct_answer = "true" o "false"
- Si no hay opciones → open, correct_answer = null, options = []
- La respuesta correcta puede venir marcada con: *, →, (correcta), negrita, o "Respuesta: X" al final
- Si no se detecta respuesta correcta → correct_answer = "a" para multiple_choice
- points siempre = 10
- Normaliza el texto: quita numeración del inicio (1., 2., a), b), etc.)
- Para multiple_choice, options SIEMPRE debe tener exactamente los elementos con texto no vacío`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: rawText }],
        }),
      })

      const data = await response.json()
      const text = data.content?.map((c: any) => c.text || '').join('') ?? ''

      // Strip any accidental markdown fences
      const clean = text.replace(/```json|```/g, '').trim()
      const questions: any[] = JSON.parse(clean)

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No se detectaron preguntas en el texto.')
      }

      // Normalize & add order_index
      const normalized: ParsedQuestion[] = questions.map((q, i) => ({
        timestamp_seconds: Number(q.timestamp_seconds) || (i + 1) * 60,
        question_type: q.question_type ?? 'open',
        question_text: String(q.question_text ?? '').trim(),
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: q.correct_answer ?? (q.question_type === 'multiple_choice' ? 'a' : ''),
        points: 10,
        order_index: currentCount + i,
      }))

      setParsed(normalized)
      setStep('preview')
    } catch (e: any) {
      setError(e.message ?? 'Error al parsear. Intenta de nuevo o ajusta el formato.')
      setStep('paste')
    }
  }

  // ── Update timestamp from editable field ───────────────────────────────────
  const applyTimestamp = (idx: number) => {
    const val = editingTimestamp[idx]
    if (!val) return
    const secs = timeToSeconds(val)
    setParsed(prev => prev.map((q, i) => i === idx ? { ...q, timestamp_seconds: secs } : q))
    setEditingTimestamp(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  // ── Confirm import ─────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onImport(parsed)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-2xl max-h-[92vh] flex flex-col border border-parchment-200 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-crimson-500 rounded flex items-center justify-center">
              <Clipboard className="w-3.5 h-3.5 text-parchment-50" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-800 leading-tight">Importar preguntas</h2>
              <p className="text-xs text-ink-400 font-body">Pega tu banco de preguntas y la IA las detecta automáticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-parchment-200 bg-sepia-100/60 flex-shrink-0">
          {[
            { key: 'paste', label: '1. Pegar texto' },
            { key: 'parsing', label: '2. Analizando' },
            { key: 'preview', label: '3. Confirmar' },
          ].map((s, i) => {
            const isActive = step === s.key
            const isDone = (step === 'preview' && s.key !== 'preview') || (step === 'parsing' && s.key === 'paste')
            return (
              <div key={s.key} className="flex items-center gap-0">
                {i > 0 && <div className={`w-8 h-px ${isDone ? 'bg-gold-400' : 'bg-parchment-300'}`} />}
                <span className={`text-xs font-mono px-2 py-0.5 rounded transition-colors ${
                  isActive ? 'bg-crimson-500 text-parchment-50' :
                  isDone ? 'text-gold-600 font-medium' :
                  'text-ink-400'
                }`}>{s.label}</span>
              </div>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP: PASTE ── */}
          {step === 'paste' && (
            <div className="p-6 space-y-4">
              <div className="bg-sepia-100 border border-parchment-200 rounded p-4 text-sm font-body text-ink-600 space-y-1.5">
                <p className="font-medium text-ink-700">Formatos aceptados:</p>
                <p>• <span className="font-mono text-xs bg-parchment-200 px-1 rounded">1. ¿Pregunta? / a) Op1 b) Op2 c) Op3 d) Op4</span></p>
                <p>• Respuesta correcta marcada con <span className="font-mono text-xs bg-parchment-200 px-1 rounded">*</span>, <span className="font-mono text-xs bg-parchment-200 px-1 rounded">→</span> o <span className="font-mono text-xs bg-parchment-200 px-1 rounded">Respuesta: a</span></p>
                <p>• Timestamp opcional al inicio: <span className="font-mono text-xs bg-parchment-200 px-1 rounded">[02:30] ¿Pregunta?</span></p>
                <p>• Preguntas sin opciones → se detectan como abiertas</p>
              </div>

              <div>
                <label className="text-sm font-body font-medium text-ink-700 block mb-2">
                  Texto a importar
                </label>
                <textarea
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  rows={12}
                  placeholder={`Ejemplo:\n\n1. ¿Cuál fue la causa principal de la Revolución Mexicana?\na) La modernización económica\nb) La desigualdad social y el régimen de Díaz *\nc) La invasión extranjera\nd) El conflicto religioso\n\n[03:20] 2. ¿Verdadero o Falso? Porfirio Díaz gobernó más de 30 años.\nVerdadero *\nFalso\n\n3. ¿Qué papel jugaron los campesinos en la Revolución?`}
                  className="w-full border border-parchment-300 rounded px-4 py-3 font-body text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none leading-relaxed"
                />
                <p className="text-xs text-ink-400 font-body mt-1.5">
                  {rawText.trim() ? `${rawText.split('\n').filter(l => l.trim()).length} líneas` : 'Pega cualquier texto con preguntas'}
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-crimson-500/10 border border-crimson-500/20 rounded p-3">
                  <AlertCircle className="w-4 h-4 text-crimson-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-crimson-600 font-body">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: PARSING ── */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-2 border-gold-400/30 border-t-gold-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-gold-500 absolute inset-0 m-auto" />
              </div>
              <div className="text-center">
                <p className="font-display text-lg font-semibold text-ink-800">Analizando con IA…</p>
                <p className="text-sm text-ink-500 font-body mt-1">Detectando preguntas, tipos y respuestas correctas</p>
              </div>
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-green-700" />
                <p className="text-sm font-body text-ink-700">
                  Se detectaron <span className="font-semibold text-ink-900">{parsed.length} pregunta{parsed.length !== 1 ? 's' : ''}</span>. Revisa los timestamps antes de importar.
                </p>
              </div>

              {parsed.map((q, idx) => (
                <div key={idx} className="border border-parchment-300 rounded bg-white overflow-hidden">
                  {/* Header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-sepia-100/40 transition-colors"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    <span className="font-mono text-xs text-ink-400 flex-shrink-0 w-5 text-center">#{idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-mono flex-shrink-0 ${TYPE_COLORS[q.question_type]}`}>
                      {TYPE_LABELS[q.question_type]}
                    </span>

                    {/* Timestamp editable inline */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <Clock className="w-3 h-3 text-ink-400" />
                      <input
                        type="text"
                        value={editingTimestamp[idx] !== undefined ? editingTimestamp[idx] : secondsToTime(q.timestamp_seconds)}
                        onChange={e => setEditingTimestamp(prev => ({ ...prev, [idx]: e.target.value }))}
                        onBlur={() => applyTimestamp(idx)}
                        onKeyDown={e => e.key === 'Enter' && applyTimestamp(idx)}
                        className="w-14 text-xs font-mono text-center border border-parchment-200 rounded px-1 py-0.5 focus:outline-none focus:border-gold-400 bg-sepia-100"
                      />
                    </div>

                    <p className="text-sm text-ink-700 font-body flex-1 truncate">{q.question_text}</p>
                    {expandedIdx === idx
                      ? <ChevronUp className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" />
                      : <ChevronDown className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" />
                    }
                  </div>

                  {/* Expanded detail */}
                  {expandedIdx === idx && (
                    <div className="px-4 pb-4 pt-1 border-t border-parchment-100 bg-sepia-100/30">
                      <p className="text-sm font-body text-ink-800 mb-3 font-medium">{q.question_text}</p>

                      {q.question_type === 'multiple_choice' && q.options.length > 0 && (
                        <div className="space-y-1.5">
                          {q.options.map(opt => (
                            <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-body ${q.correct_answer === opt.id ? 'bg-green-700/10 border border-green-700/20 text-green-800' : 'bg-white border border-parchment-200 text-ink-700'}`}>
                              <span className="font-mono text-xs text-ink-400 w-4">{opt.id.toUpperCase()})</span>
                              <span>{opt.text}</span>
                              {q.correct_answer === opt.id && <span className="ml-auto text-xs text-green-700 font-mono">✓ correcta</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'true_false' && (
                        <div className="flex gap-2">
                          {[{ val: 'true', label: 'Verdadero' }, { val: 'false', label: 'Falso' }].map(({ val, label }) => (
                            <div key={val} className={`px-3 py-1.5 rounded text-sm font-body border ${q.correct_answer === val ? 'bg-green-700/10 border-green-700/20 text-green-800' : 'bg-white border-parchment-200 text-ink-600'}`}>
                              {label} {q.correct_answer === val && '✓'}
                            </div>
                          ))}
                        </div>
                      )}

                      {q.question_type === 'open' && (
                        <p className="text-xs text-ink-400 font-body italic">Pregunta abierta — el estudiante escribe su respuesta</p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={() => { setStep('paste'); setError('') }}
                className="text-xs text-ink-400 hover:text-ink-600 font-body underline mt-2 block"
              >
                ← Volver a editar el texto
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-parchment-200 bg-parchment-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-parchment-300 text-ink-700 rounded-sm font-body text-sm hover:bg-sepia-100 transition-colors"
          >
            Cancelar
          </button>

          {step === 'paste' && (
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-crimson-500 text-parchment-50 rounded-sm font-body text-sm font-medium hover:bg-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-manuscript"
            >
              <Sparkles className="w-4 h-4" />
              Analizar con IA
            </button>
          )}

          {step === 'preview' && (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 bg-ink-800 text-parchment-100 rounded-sm font-body text-sm font-medium hover:bg-ink-900 transition-colors shadow-manuscript"
            >
              <CheckCircle className="w-4 h-4" />
              Agregar {parsed.length} pregunta{parsed.length !== 1 ? 's' : ''} al formulario
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
