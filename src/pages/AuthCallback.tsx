import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  useEffect(() => {
    async function handleCallback() {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        window.location.href = '/login'
        return
      }
      
      const isTeacher = data.session.user.email?.endsWith('@nikolatesla.edu.mx') ?? false
      window.location.href = isTeacher ? '/teacher' : '/student'
    }
    handleCallback()
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-sepia-100">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="font-body text-ink-600">Verificando acceso...</p>
      </div>
    </div>
  )
}