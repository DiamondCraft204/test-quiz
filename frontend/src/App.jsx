import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import Landing from './pages/Landing'
import UserLogin from './pages/auth/UserLogin'
import UserRegister from './pages/auth/UserRegister'
import AdminLogin from './pages/auth/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import QuizDetail from './pages/admin/QuizDetail'
import QuizResults from './pages/admin/QuizResults'
import QuizList from './pages/user/QuizList'
import QuizPage from './pages/user/QuizPage'
import ResultPage from './pages/user/ResultPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          message: 'Akses dibatasi. Anda harus login terlebih dahulu untuk mengakses halaman tersebut.'
        }}
        replace
      />
    )
  }
  return children
}

function AdminRoute({ children }) {
  const adminToken = localStorage.getItem('adminToken')
  const location = useLocation()

  if (!adminToken) {
    return (
      <Navigate
        to="/admin/login"
        state={{
          from: location,
          message: 'Akses dibatasi. Anda harus login sebagai admin terlebih dahulu.'
        }}
        replace
      />
    )
  }
  return children
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/quizzes" replace />
  }
  return children
}

function AdminPublicOnlyRoute({ children }) {
  const adminToken = localStorage.getItem('adminToken')
  if (adminToken) {
    return <Navigate to="/admin" replace />
  }
  return children
}

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth()
  const adminToken = localStorage.getItem('adminToken')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (adminToken) {
    return <Navigate to="/admin" replace />
  }
  if (isAuthenticated) {
    return <Navigate to="/quizzes" replace />
  }
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<PublicOnlyRoute><UserLogin /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><UserRegister /></PublicOnlyRoute>} />
      <Route path="/admin/login" element={<AdminPublicOnlyRoute><AdminLogin /></AdminPublicOnlyRoute>} />

      {/* Admin routes */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/quiz/:id" element={<AdminRoute><QuizDetail /></AdminRoute>} />
      <Route path="/admin/quiz/:id/results" element={<AdminRoute><QuizResults /></AdminRoute>} />

      {/* User routes */}
      <Route path="/quizzes" element={<ProtectedRoute><QuizList /></ProtectedRoute>} />
      <Route path="/quiz/:id" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
      <Route path="/quiz/:id/result/:submissionId" element={<ProtectedRoute><ResultPage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
