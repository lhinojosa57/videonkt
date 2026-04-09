// import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { LogOut, Users, Home, Video, BarChart2, BookOpen } from 'lucide-react'

export default function Layout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const isTeacher = profile?.role === 'teacher'

  const teacherLinks = [
  { to: '/teacher', label: 'Inicio', icon: Home, end: true },
  { to: '/teacher/groups', label: 'Grupos', icon: Users },
  { to: '/teacher/assignments', label: 'Actividades', icon: Video },
  { to: '/teacher/planning', label: 'Planeación', icon: BookOpen },
  { to: '/teacher/reports', label: 'Reportes', icon: BarChart2 },
]

  const links = isTeacher ? teacherLinks : []

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-60 bg-gray-900 flex flex-col shadow-raised flex-shrink-0">
        <div className="p-5 border-b border-ink-700">
          <div className="flex items-center gap-3">
            <img src="/logo-nikola-tesla.png" alt="Colegio Nikola Tesla" className="w-10 h-10 object-contain" />
            <div>
              <span className="font-display text-lg font-bold text-parchment-100 block leading-tight">VideoNKT</span>
              <span className="text-[10px] text-ink-400 uppercase tracking-wider font-mono">Colegio Nikola Tesla</span>
            </div>
          </div>
          <p className="text-ink-500 text-xs font-mono mt-2 ml-0.5 uppercase tracking-wider">
            {isTeacher ? 'Panel Docente' : 'Panel Estudiante'}
          </p>
        </div>

        <div className="p-4 border-b border-ink-700">
          <div className="flex items-center gap-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-gold-400/40" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-ink-900 font-bold text-sm">
                {profile?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-parchment-100 text-sm font-body font-medium truncate">{profile?.full_name}</p>
              <p className="text-ink-400 text-xs truncate">{profile?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body transition-all ${
                  isActive
                    ? 'bg-gold-500/20 text-gold-300 font-medium border-l-2 border-gold-400'
                    : 'text-parchment-300 hover:text-parchment-100 hover:bg-ink-800'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-ink-700">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body text-parchment-300 hover:text-crimson-400 hover:bg-ink-800 w-full transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}