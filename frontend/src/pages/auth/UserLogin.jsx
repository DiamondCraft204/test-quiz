import { useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { GraduationCap, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react'

export default function UserLogin() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const redirectParam = searchParams.get('redirect')
  const isExpired = searchParams.get('expired')

  const redirectPath = redirectParam
    ? decodeURIComponent(redirectParam)
    : location.state?.from?.pathname
    ? location.state.from.pathname + (location.state.from.search || '')
    : '/quizzes'

  const notice = location.state?.message || (isExpired ? 'Sesi login Anda telah berakhir. Silakan masuk kembali.' : '')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Login gagal. Periksa email dan password Anda.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-700 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-indigo-600 mb-2">
            <GraduationCap className="w-8 h-8" />
            <span className="text-2xl font-bold">RuangKuis</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Masuk</h2>
          <p className="text-gray-500 text-sm mt-1">Masuk untuk mengikuti kuis</p>
        </div>

        {notice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" required
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="nama@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Belum punya akun?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline font-medium">Daftar sekarang</Link>
        </p>
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <Link to="/admin/login" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Masuk sebagai Admin RuangKuis
          </Link>
        </div>
      </div>
    </div>
  )
}
