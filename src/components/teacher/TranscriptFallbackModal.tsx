import { useState } from 'react'
import { X, FileText, Sparkles, AlertCircle } from 'lucide-react'
import { type ParsedQuestion } from './ImportQuestionsModal'
import { type AIConfig } from './AIConfigModal' 

interface TranscriptFallbackModalProps {
  onImport: (questions: ParsedQuestion[]) => void
  onClose: () => void
  currentCount: number
  contexto?: string
  config?: AIConfig
}

export default function TranscriptFallbackModal({ onImport, onClose, currentCount, contexto, config }: TranscriptFallbackModalProps) {
  const [transcript, setTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!transcript.trim()) return
    setParsing(true)
    setError('')

    try {
      const prompt = [
        contexto ? `Contexto pedagógico:\n${contexto}` : '',
        config ? `Genera exactamente: ${config.multiple_choice} preguntas de opción múltiple, ${config.true_false} de verdadero/falso, ${config.open} preguntas abiertas.` : '',
        `Transcripción del video:\n${transcript}`,
        `\nGenera preguntas interactivas para este video basándote en la transcripción. Distribuye los timestamps proporcionalmente a lo largo del video.`,
      ].filter(Boolean).join('\n\n')

      const response = await fetch('/api/parse-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: prompt }),
      })

      const clean = (await response.text()).replace(/```json|```/g, '').trim()
      const questions: any[] = JSON.parse(clean)

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No se pudieron generar preguntas. Intenta con una transcripción más completa.')
      }

      const normalized: ParsedQuestion[] = questions.map((q, i) => ({
        timestamp_seconds: Number(q.timestamp_seconds) || (i + 1) * 60,
        question_type: q.question_type ?? 'open',
        question_text: String(q.question_text ?? '').trim(),
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: q.correct_answer ?? (q.question_type === 'multiple_choice' ? 'a' : ''),
        points: 10,
        order_index: currentCount + i,
      }))

      onImport(normalized)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Error al generar preguntas. Intenta de nuevo.')
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-2xl max-h-[92vh] flex flex-col border border-parchment-200 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-gold-500 rounded flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-parchment-50" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-800 leading-tight">Pegar transcripción</h2>
              <p className="text-xs text-ink-400 font-body">El video no tiene subtítulos automáticos — pega la transcripción manualmente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-sepia-100 border border-parchment-200 rounded p-4 text-sm font-body text-ink-600 space-y-1.5">
            <p className="font-medium text-ink-700">¿Cómo obtener la transcripción?</p>
            <p>1. Abre el video en YouTube</p>
            <p>2. Clic en <span className="font-mono text-xs bg-parchment-200 px-1 rounded">⋯ Más</span> → <span className="font-mono text-xs bg-parchment-200 px-1 rounded">Mostrar transcripción</span></p>
            <p>3. Selecciona todo el texto y pégalo aquí</p>
          </div>

          <div>
            <label className="text-sm font-body font-medium text-ink-700 block mb-2">
              Transcripción del video
            </label>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={12}
              placeholder="Pega aquí la transcripción del video..."
              className="w-full border border-parchment-300 rounded px-4 py-3 font-body text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none leading-relaxed"
            />
            <p className="text-xs text-ink-400 font-body mt-1.5">
              {transcript.trim() ? `${transcript.split(' ').filter(w => w.trim()).length} palabras` : 'Mientras más completa, mejores preguntas'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-crimson-500/10 border border-crimson-500/20 rounded p-3">
              <AlertCircle className="w-4 h-4 text-crimson-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-crimson-600 font-body">{error}</p>
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
          <button
            onClick={handleGenerate}
            disabled={!transcript.trim() || parsing}
            className="flex items-center gap-2 px-5 py-2 bg-crimson-500 text-parchment-50 rounded-sm font-body text-sm font-medium hover:bg-crimson-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-manuscript"
          >
            <Sparkles className="w-4 h-4" />
            {parsing ? 'Generando preguntas…' : 'Generar preguntas con IA'}
          </button>
        </div>
      </div>
    </div>
  )
}