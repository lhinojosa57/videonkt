import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import * as SupabaseTypes from '../../lib/supabase'
import { CheckCircle, ArrowLeft, Send, Volume2, VolumeX } from 'lucide-react'

const supabase = SupabaseTypes.supabase

type ActivityState = 'playing' | 'paused_question' | 'time_up'

// ─── URL helpers ──────────────────────────────────────────────────────────────

function getEmbedUrl(url: string, autoplay: boolean, startSecond = 0): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) {
    const start = startSecond > 0 ? `&start=${startSecond}` : ''
    const params = autoplay
      ? `?autoplay=1&rel=0&modestbranding=1&iv_load_policy=3&controls=0${start}`
      : `?autoplay=0&rel=0&modestbranding=1&iv_load_policy=3&controls=0${start}`
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}` + params
  }
  return url
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WatchVideo() {
  const { assignmentId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const lastUpdateRef = useRef<number>(Date.now())
  const durationAccRef = useRef<number>(0)
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const questionElapsedRef = useRef<number>(0)
  const videoSecondsRef = useRef<number>(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [assignment, setAssignment] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [session, setSession] = useState<any>(null)

  const [activityState, setActivityState] = useState<ActivityState>('playing')
  const [activeQuestion, setActiveQuestion] = useState<any>(null)
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set())
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isTimeUp, setIsTimeUp] = useState(false)

  const [videoStarted, setVideoStarted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [pausedAtSecond, setPausedAtSecond] = useState(0)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id || !assignmentId) return
    async function load() {
      const [asgRes, qRes] = await Promise.all([
        supabase.from('video_assignments').select('*, group:groups(name)').eq('id', assignmentId).single(),
        supabase.from('questions').select('*').eq('assignment_id', assignmentId).order('timestamp_seconds'),
      ])
      if (!asgRes.data) { navigate('/student'); return }
      setAssignment(asgRes.data)
      setQuestions(qRes.data ?? [])

      let { data: sess } = await supabase
        .from('student_sessions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', profile!.id)
        .single()

      if (!sess) {
        const { data: newSess } = await supabase
          .from('student_sessions')
          .insert({ assignment_id: assignmentId, student_id: profile!.id })
          .select()
          .single()
        sess = newSess
      }
      setSession(sess)

     if (sess && (sess.is_completed || sess.duration_seconds > 0 || sess.max_video_position > 0)) {
        // Recalcular score desde las respuestas reales, no confiar en sess.score
        const { data: answers } = await supabase
          .from('student_answers')
          .select('points_earned, question:questions(points)')
          .eq('session_id', sess.id)

        const totalPoints = (answers ?? []).reduce((sum: number, a: any) => sum + (a.question?.points ?? 0), 0)
        const earnedPoints = (answers ?? []).reduce((sum: number, a: any) => sum + (a.points_earned ?? 0), 0)
        const realScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

        // Actualizar el score en Supabase también
        await supabase.from('student_sessions').update({ score: realScore }).eq('id', sess.id)

        setFinalScore(realScore)
        setSessionCompleted(sess.is_completed)
        setCompleted(true)
        setLoading(false)
        return
      }

      if (sess?.id) {
        const { data: existingAnswers } = await supabase
          .from('student_answers').select('*').eq('session_id', sess.id)
        const answeredSet = new Set<string>()
        ;(existingAnswers ?? []).forEach((a: any) => answeredSet.add(a.question_id))
        setAnsweredQuestions(answeredSet)
      }

      lastUpdateRef.current = Date.now()
      durationAccRef.current = sess?.duration_seconds ?? 0
      setLoading(false)
    }
    load()
  }, [profile?.id, assignmentId])

  // ── Duration tracker ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || completed) return
    const interval = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000)
      lastUpdateRef.current = Date.now()
      durationAccRef.current += elapsed
      await supabase.from('student_sessions')
        .update({ duration_seconds: durationAccRef.current })
        .eq('id', session.id)
    }, 15000)
    return () => clearInterval(interval)
  }, [session, completed])

 // ── Trigger question ───────────────────────────────────────────────────────
  const triggerQuestion = useCallback((q: any, videoUrl: string) => {
    const currentSecond = Math.floor(videoSecondsRef.current)
    setPausedAtSecond(currentSecond)
    if (iframeRef.current) {
      iframeRef.current.src = getEmbedUrl(videoUrl, false)
    }
    setActiveQuestion(q)
    setCurrentAnswer('')
    setIsTimeUp(false)
    setActivityState('paused_question')

    if (questionTimerRef.current) clearInterval(questionTimerRef.current)
    const limit = q.question_type === 'open' ? 60 : 20
    questionElapsedRef.current = 0
    questionTimerRef.current = setInterval(() => {
      questionElapsedRef.current++
      if (questionElapsedRef.current >= limit) {
        clearInterval(questionTimerRef.current!)
        questionTimerRef.current = null
        setIsTimeUp(true)
        setActivityState('time_up')
        setAnsweredQuestions(prev => new Set([...prev, q.id]))
        if (session && profile?.id) {
          supabase.from('student_answers').upsert({
            session_id: session.id,
            question_id: q.id,
            student_id: profile.id,
            answer_text: null,
            is_correct: q.question_type === 'open' ? null : false,
            points_earned: 0,
          })
        }
      }
    }, 1000)
  }, [session, profile])

  // ── Start video timer ──────────────────────────────────────────────────────
  const startVideoTimer = useCallback((currentQuestions: any[], currentAnswered: Set<string>, videoUrl: string) => {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current)
    videoTimerRef.current = setInterval(() => {
      videoSecondsRef.current += 0.5
      for (const q of currentQuestions) {
        if (currentAnswered.has(q.id)) continue
        if (
          videoSecondsRef.current >= q.timestamp_seconds) {
          clearInterval(videoTimerRef.current!)
          videoTimerRef.current = null
          triggerQuestion(q, videoUrl)
          break
        }
      }
    }, 500)
  }, [triggerQuestion])

  // ── Start video ────────────────────────────────────────────────────────────
  const handleStartVideo = () => {
  videoSecondsRef.current = 0
  setVideoStarted(true)
  setTimeout(() => {
      startVideoTimer(questions, answeredQuestions, assignment?.video_url ?? '')
  }, 3000)
}

  // ── Submit answer ──────────────────────────────────────────────────────────
  const submitAnswer = async () => {
    if (!activeQuestion || !session || !profile?.id) return
    if (activeQuestion.question_type !== 'open' && !currentAnswer.trim()) return
    setSubmitting(true)

    if (questionTimerRef.current) {
      clearInterval(questionTimerRef.current)
      questionTimerRef.current = null
    }

    let isCorrect: boolean | null = null
    let pointsEarned = 0

    if (activeQuestion.question_type === 'multiple_choice') {
      isCorrect = currentAnswer === activeQuestion.correct_answer
      pointsEarned = isCorrect ? activeQuestion.points : 0
    } else if (activeQuestion.question_type === 'true_false') {
      isCorrect = currentAnswer === activeQuestion.correct_answer
      pointsEarned = isCorrect ? activeQuestion.points : 0
    } else {
      isCorrect = null
      pointsEarned = Math.floor(activeQuestion.points * 0.5)
    }

   const { error } = await supabase.from('student_answers').upsert({
      session_id: session.id,
      question_id: activeQuestion.id,
      student_id: profile!.id,
      answer_text: currentAnswer,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    })

    if (error) {
      console.error('Error guardando respuesta:', error)
      setSubmitting(false)
      return
    }

    setAnsweredQuestions(prev => new Set([...prev, activeQuestion.id]))
    setSubmitting(false)
    setIsTimeUp(false)
    setActivityState('time_up')
  }

  // ── Add time to question timer (used by TTS) ───────────────────────────────
  const addQuestionTime = useCallback((seconds: number) => {
    questionElapsedRef.current = Math.max(0, questionElapsedRef.current - seconds)
  }, [])
  const continueVideo = useCallback(() => {
  const newAnswered = new Set([...answeredQuestions, activeQuestion?.id ?? ''])
  setActivityState('playing')
  setActiveQuestion(null)
  setCurrentAnswer('')

  if (iframeRef.current && assignment?.video_url) {
    iframeRef.current.src = getEmbedUrl(assignment.video_url, true, pausedAtSecond)
  }

  startVideoTimer(questions, newAnswered, assignment?.video_url ?? '')
}, [answeredQuestions, activeQuestion, assignment, questions, startVideoTimer, pausedAtSecond])

  // ── Finish activity ────────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!session) return
    if (videoTimerRef.current) clearInterval(videoTimerRef.current)
    if (questionTimerRef.current) clearInterval(questionTimerRef.current)

    const elapsed = Math.floor((Date.now() - lastUpdateRef.current) / 1000)
    durationAccRef.current += elapsed

    const { data: updatedSess } = await supabase
      .from('student_sessions')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        duration_seconds: durationAccRef.current,
      })
      .eq('id', session.id)
      .select()
      .single()

    setFinalScore(Math.round(updatedSess?.score ?? 0))
    setSessionCompleted(true) 
    setCompleted(true)
  }

  // ── Completed screen ───────────────────────────────────────────────────────
  if (completed) {
  return (
    <div className="min-h-screen bg-sepia-100 flex items-center justify-center p-4">
      <div className="bg-parchment-50 rounded-sm shadow-raised border border-parchment-200 p-10 max-w-md w-full text-center">
        {sessionCompleted ? (
          <>
            <div className="w-16 h-16 bg-green-700/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-9 h-9 text-green-700" />
            </div>
            <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">¡Actividad completada!</h2>
            <p className="font-body text-ink-600 mb-6">{assignment?.title}</p>
            <div className="bg-sepia-100 rounded p-4 mb-6 border border-parchment-200">
              <p className="text-xs text-ink-500 font-mono uppercase tracking-wider mb-1">Tu calificación</p>
              <p className={`font-display text-5xl font-bold ${finalScore >= 80 ? 'text-green-700' : finalScore >= 60 ? 'text-gold-600' : 'text-crimson-500'}`}>
                {finalScore}
              </p>
              <p className="font-mono text-ink-400 text-sm">/100</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-crimson-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-9 h-9 text-crimson-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7" />
              </svg>
            </div>
            <h2 className="font-display text-2xl font-bold text-ink-900 mb-2">Actividad no disponible</h2>
            <p className="font-body text-ink-600 mb-6">{assignment?.title}</p>
            <div className="bg-sepia-100 rounded p-4 mb-6 border border-parchment-200">
              <p className="text-sm text-ink-600 font-body leading-relaxed">
                Esta actividad ya fue iniciada. Recuerda que solo tienes una oportunidad.
              </p>
            </div>
          </>
        )}
        <button onClick={() => navigate('/student')} className="w-full bg-crimson-500 text-parchment-50 py-3 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors">
          Volver al inicio
        </button>
      </div>
    </div>
  )
}

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" style={{ borderColor: '#e8c07e', borderTopColor: '#d4af37' }} />
          <p className="text-parchment-200 font-body">Cargando actividad…</p>
        </div>
      </div>
    )
  }

  const showOverlay = activityState === 'paused_question' || activityState === 'time_up'

  return (
    <div className="min-h-screen bg-ink-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-ink-700">
        <button onClick={() => navigate('/student')} className="text-ink-400 hover:text-parchment-200 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display text-parchment-100 font-semibold truncate">{assignment?.title}</p>
          <p className="text-ink-400 text-xs font-body truncate">{assignment?.topic} · {(assignment as any)?.group?.name}</p>
        </div>
        {videoStarted && activityState === 'playing' && (
          <button
            onClick={handleFinish}
            className="flex items-center gap-2 bg-tesla-500 text-parchment-50 px-4 py-2 rounded-sm font-body text-sm font-medium hover:bg-tesla-600 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Terminar actividad
          </button>
        )}
      </div>

      {/* Video */}
      <div className="flex-1 bg-black relative flex items-center justify-center">
        <div className="w-full aspect-video max-h-[calc(100vh-64px)] relative">
          <iframe
            ref={iframeRef}
            src={videoStarted ? getEmbedUrl(assignment?.video_url ?? '', true) : 'about:blank'}
            width="100%"
            height="100%"
            allow="autoplay; encrypted-media"
            allowFullScreen={false}
            style={{ border: 'none', display: 'block' }}
          />

          {/* Capa bloqueadora de clics al iframe — evita que el estudiante pause el video */}
          {videoStarted && activityState === 'playing' && (
            <div
              className="absolute inset-0"
              style={{ zIndex: 1 }}
              onClick={e => e.preventDefault()}
            />
          )}

          {/* Start overlay */}
          {!videoStarted && (
            <div className="absolute inset-0 bg-ink-900 flex items-center justify-center">
              <button
                onClick={handleStartVideo}
                className="flex items-center gap-3 bg-tesla-500 text-parchment-50 px-10 py-5 rounded-sm font-display text-2xl font-semibold hover:bg-tesla-600 transition-colors shadow-raised"
              >
                ▶ Iniciar video
              </button>
            </div>
          )}

          {/* Question overlay */}
          {showOverlay && activeQuestion && (
            <div className="absolute inset-0 bg-ink-900 flex items-center justify-center p-4">
              <div className="w-full max-w-lg">
                <QuestionOverlay
                  question={activeQuestion}
                  currentAnswer={currentAnswer}
                  onAnswer={setCurrentAnswer}
                  onSubmit={submitAnswer}
                  submitting={submitting}
                  isTimeUp={isTimeUp}
                  activityState={activityState}
                  onContinue={continueVideo}
                  onAddTime={addQuestionTime}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Text-to-Speech hook ──────────────────────────────────────────────────────

function useTTS() {
  const [speaking, setSpeaking] = useState(false)

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-MX'
    utterance.rate = 0.9
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  // Cancelar al desmontar
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel() }
  }, [])

  return { speak, stop, speaking }
}

// ─── Question Overlay ─────────────────────────────────────────────────────────

function QuestionOverlay({ question, currentAnswer, onAnswer, onSubmit, submitting, isTimeUp, activityState, onContinue, onAddTime }: {
  question: any
  currentAnswer: string
  onAnswer: (a: string) => void
  onSubmit: () => void
  submitting: boolean
  isTimeUp: boolean
  activityState: string
  onContinue: () => void
  onAddTime: (seconds: number) => void
}) {
  const { speak, stop, speaking } = useTTS()
  const [ttsUsed, setTtsUsed] = useState(false)

  const typeLabel: Record<string, string> = {
    multiple_choice: 'Opción múltiple',
    true_false: 'Verdadero / Falso',
    open: 'Pregunta abierta',
  }
  const label = typeLabel[question.question_type] || 'Pregunta'

  const showForm = activityState === 'paused_question'
  const showContinue = activityState === 'time_up'

  const buildSpeechText = () => {
    let text = question.question_text
    if (question.question_type === 'multiple_choice' && question.options) {
      const opts = question.options
        .filter((o: any) => o.text.trim())
        .map((o: any) => `${o.id.toUpperCase()}: ${o.text}`)
        .join('. ')
      text += `. Las opciones son: ${opts}`
    } else if (question.question_type === 'true_false') {
      text += '. Responde verdadero o falso.'
    }
    return text
  }

  const handleTTS = () => {
    if (speaking) { stop(); return }
    if (!ttsUsed) {
      onAddTime(30)
      setTtsUsed(true)
    }
    speak(buildSpeechText())
  }

  return (
    <div className="bg-parchment-50 rounded-sm shadow-raised border border-parchment-200 overflow-hidden">
      <div className="bg-crimson-500 px-5 py-3 flex items-center justify-between">
        <span className="text-parchment-100 text-xs font-mono uppercase tracking-wider">⏸ {label}</span>
      </div>

      <div className="p-5" style={{ userSelect: 'none' }}>
        {/* Pregunta con botón TTS */}
        <div className="flex items-start gap-3 mb-5">
          <p className="font-display text-lg font-semibold text-ink-800 leading-snug flex-1">
            {question.question_text}
          </p>
          {'speechSynthesis' in window && (
            <button
              onClick={handleTTS}
              title={speaking ? 'Detener lectura' : ttsUsed ? 'Escuchar de nuevo' : 'Escuchar pregunta (+30s)'}
              className={`flex-shrink-0 mt-0.5 p-2 rounded-full transition-colors ${
                speaking
                  ? 'bg-crimson-500/10 text-crimson-500 hover:bg-crimson-500/20'
                  : ttsUsed
                  ? 'bg-ink-100 text-ink-400 hover:bg-ink-200'
                  : 'bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-700'
              }`}
            >
              {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
        </div>

        {isTimeUp && (
          <div className="rounded p-4 mb-4 border bg-crimson-500/10 border-crimson-500/20">
            <p className="font-body font-semibold text-crimson-500">⏱ Tiempo agotado</p>
            <p className="text-sm text-ink-600 font-body mt-1">No se registró respuesta correcta.</p>
          </div>
        )}

        {showContinue && !isTimeUp && (
          <div className="rounded p-4 mb-4 border bg-sepia-100 border-parchment-300">
            <p className="font-body font-semibold text-ink-600">Respuesta registrada</p>
          </div>
        )}

        {showForm && (
          <>
            {question.question_type === 'multiple_choice' && question.options && (
              <div className="space-y-2 mb-4">
                {question.options.filter((o: any) => o.text.trim()).map((opt: any) => (
                  <label key={opt.id} className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-all ${currentAnswer === opt.id ? 'border-gold-400 bg-gold-400/10' : 'border-parchment-300 hover:border-gold-300 bg-white'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${currentAnswer === opt.id ? 'border-gold-500 bg-gold-500' : 'border-parchment-400'}`} />
                    <span className="text-xs font-mono text-ink-400">{opt.id.toUpperCase()})</span>
                    <span className="font-body text-sm text-ink-800">{opt.text}</span>
                    <input type="radio" className="sr-only" checked={currentAnswer === opt.id} onChange={() => onAnswer(opt.id)} />
                  </label>
                ))}
              </div>
            )}

            {question.question_type === 'true_false' && (
              <div className="flex gap-3 mb-4">
                {[{ val: 'true', label: '✓ Verdadero' }, { val: 'false', label: '✗ Falso' }].map(({ val, label }) => (
                  <button key={val} onClick={() => onAnswer(val)} className={`flex-1 py-3 rounded border font-body font-medium transition-all ${currentAnswer === val ? 'border-gold-400 bg-gold-400/10 text-ink-800' : 'border-parchment-300 bg-white text-ink-600 hover:border-gold-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {question.question_type === 'open' && (
              <textarea
                value={currentAnswer}
                onChange={e => onAnswer(e.target.value)}
                onPaste={e => e.preventDefault()}
                rows={4}
                placeholder="Escribe tu respuesta aquí…"
                className="w-full border border-parchment-300 rounded px-3 py-2.5 font-body text-sm text-ink-800 bg-white focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 resize-none mb-4"
              />
            )}

            <button
              onClick={onSubmit}
              disabled={submitting || (question.question_type !== 'open' && !currentAnswer.trim())}
              className="w-full flex items-center justify-center gap-2 bg-ink-800 text-parchment-100 py-3 rounded-sm font-body font-medium hover:bg-ink-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Enviando…' : 'Responder'}
            </button>
          </>
        )}

       {showContinue && (
          <button
            onClick={onContinue}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-crimson-500 text-parchment-50 py-3 rounded-sm font-body font-medium hover:bg-crimson-600 transition-colors mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando…' : 'Continuar video ▶'}
          </button>
        )} 
      </div>
    </div>
  )
}