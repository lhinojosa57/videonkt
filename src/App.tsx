import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherGroups from './pages/teacher/TeacherGroups'
import TeacherAssignments from './pages/teacher/TeacherAssignments'
import CreateAssignment from './pages/teacher/CreateAssignment'
import TeacherReports from './pages/teacher/TeacherReports'
import StudentDashboard from './pages/student/StudentDashboard'
import WatchVideo from './pages/student/WatchVideo'
import Layout from './components/shared/Layout'
import TeacherPlanning from './pages/teacher/TeacherPlanning'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sepia-100">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="font-body text-ink-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile?.role) return <Navigate to="/login" replace />
  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />
  }

  return <>{children}</>
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-sepia-100">
        <div className="spinner mx-auto" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={
        user && profile ? (
          <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />
        ) : <LoginPage />
      } />
      <Route path="/auth/callback" element={<AuthCallback />} />
      
      <Route path="/teacher" element={
        <ProtectedRoute role="teacher"><Layout /></ProtectedRoute>
      }>
        <Route index element={<TeacherDashboard />} />
        <Route path="groups" element={<TeacherGroups />} />
        <Route path="assignments" element={<TeacherAssignments />} />
        <Route path="assignments/new" element={<CreateAssignment />} />
        <Route path="assignments/:id/edit" element={<CreateAssignment />} />
        <Route path="planning" element={<TeacherPlanning />} />
        <Route path="reports" element={<TeacherReports />} />
      </Route>

      <Route path="/student" element={
        <ProtectedRoute role="student"><Layout /></ProtectedRoute>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="watch/:assignmentId" element={<WatchVideo />} />
      </Route>

      <Route path="/" element={
        user && profile
          ? <Navigate to={profile.role === 'teacher' ? '/teacher' : '/student'} replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}