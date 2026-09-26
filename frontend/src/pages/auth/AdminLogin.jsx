import { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import { GraduationCap, Shield, Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react'

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const redirectPath = location.state?.from?.pathname || '/admin'
  const notice = location.state?.message || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminApi.post('/auth/admin/login', { password })
      const token = res.data.data.token
      localStorage.setItem('adminToken', token)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Password admin salah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 text-indigo-600 mb-3">
            <GraduationCap className="w-8 h-8" />
            <span className="text-2xl font-bold">RuangKuis</span>
          </div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-medium mb-3">
            <Shield className="w-4 h-4" /> Panel Admin
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Masuk Admin</h2>
          <p className="text-gray-500 text-sm mt-1">Masukkan password admin untuk mengakses panel</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Admin</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'} required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Masukkan password admin"
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
            {loading ? 'Memproses...' : 'Masuk sebagai Admin'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Bukan admin?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline font-medium">Masuk sebagai Peserta</Link>
        </p>
      </div>
    </div>
  )
}
