import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

export const MATERIAS = ["Español", "Inglés", "Artes", "Matemáticas", "Biología", "Física", "Química", "Geografía", "Historia", "Formación Cívica y Ética", "Tecnología", "Educación Socioemocional", "Educación Física"] as const

export type Materia = typeof MATERIAS[number]

export function getCampoFormativoCodigo(materia: Materia): string {
  const map = {
    "Español": "LEN",
    "Inglés": "LEN",
    "Artes": "LEN",
    "Matemáticas": "SAB",
    "Biología": "SAB",
    "Física": "SAB",
    "Química": "SAB",
    "Geografía": "ETI",
    "Historia": "HUM",
    "Formación Cívica y Ética": "ETI",
    "Tecnología": "HUM",
    "Educación Socioemocional": "HUM",
    "Educación Física": "HUM"
  }
  return map[materia]
}

export type Role = 'teacher' | 'student'
export type QuestionType = 'multiple_choice' | 'true_false' | 'open'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: Role
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  teacher_id: string
  name: string
  description: string | null
  subject: string
  materia: Materia | null
  grade: string | null
  school_year: string | null
  invite_code: string
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  student_id: string
  joined_at: string
  profile?: Profile
  group?: Group
}

export interface VideoAssignment {
  id: string
  teacher_id: string
  group_id: string
  title: string
  topic: string
  objective: string | null
  nem_proceso: string | null
  nem_campo_formativo_id: string | null
  nem_contenido_id: string | null
  nem_aprendizaje_id: string | null
  video_url: string
  video_duration_seconds: number | null
  due_date: string | null
  is_published: boolean
  created_at: string
  updated_at: string
  group?: Group
  questions?: Question[]
}

export interface QuestionOption {
  id: string
  text: string
}

export interface Question {
  id: string
  assignment_id: string
  timestamp_seconds: number
  question_type: QuestionType
  question_text: string
  options: QuestionOption[] | null
  correct_answer: string | null
  points: number
  order_index: number
  created_at: string
}

export interface StudentSession {
  id: string
  assignment_id: string
  student_id: string
  started_at: string
  completed_at: string | null
  duration_seconds: number
  score: number
  max_video_position: number
  is_completed: boolean
  profile?: Profile
  assignment?: VideoAssignment
}

export interface StudentAnswer {
  id: string
  session_id: string
  question_id: string
  student_id: string
  answer_text: string | null
  is_correct: boolean | null
  points_earned: number
  answered_at: string
  question?: Question
}

export interface NEMCampoFormativo {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  created_at: string
}

export interface NEMContenido {
  id: string
  campo_formativo_id: string
  codigo: string
  materia: Materia
  nombre: string
  created_at: string
  campo_formativo?: NEMCampoFormativo
}

export interface NEMAprendizaje {
  id: string
  contenido_id: string
  grado: string | null
  codigo_completo: string | null
  descripcion: string
  orden: number | null
  created_at: string
  contenido?: NEMContenido
}