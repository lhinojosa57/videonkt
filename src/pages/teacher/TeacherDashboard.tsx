import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { Users, Plus, ArrowRight } from 'lucide-react'

interface Stats { groups: number }

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats>({ groups: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data: groups } = await supabase
        .from('groups')
        .select('id')
        .eq('teacher_id', profile.id)
      
      setStats({ groups: groups?.length ?? 0 })
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink-900">
          Buenos días, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="font-body text-ink-600 mt-1">Plataforma VideoNKT</p>
      </div>

      {loading ? (
        <div className="h-24 bg-parchment-200 rounded-sm animate-pulse" />
      ) : (
        <div className="bg-parchment-50 rounded-sm shadow-manuscript p-5 border border-parchment-200 mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gold-500" />
            <div>
              <p className="font-display text-3xl font-bold text-ink-900">{stats.groups}</p>
              <p className="text-sm text-ink-500 font-body">Grupos</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/teacher/groups" className="flex items-center gap-4 bg-parchment-50 border border-parchment-200 p-5 rounded-sm shadow-manuscript hover:shadow-raised transition-shadow group">
          <div className="w-10 h-10 bg-gold-400/20 rounded flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <p className="font-body font-semibold text-ink-800">Gestionar grupos</p>
            <p className="text-sm text-ink-500">Ver y editar tus grupos</p>
          </div>
          <ArrowRight className="w-5 h-5 ml-auto text-ink-400 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  )
}