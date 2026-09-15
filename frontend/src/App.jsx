import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
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
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const adminToken = localStorage.getItem('adminToken')
  return adminToken ? children : <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<UserLogin />} />
      <Route path="/register" element={<UserRegister />} />
      <Route path="/admin/login" element={<AdminLogin />} />

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
