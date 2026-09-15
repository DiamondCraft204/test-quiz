import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import {
  GraduationCap, Plus, LogOut, BookOpen, Users, CheckCircle, XCircle,
  Trash2, Eye, BarChart2, Upload, Loader2, X, ChevronDown, RefreshCw, Settings
} from 'lucide-react'

const DIFFICULTIES = ['mudah', 'sedang', 'sulit']
const Q_TYPES = [
  { key: 'pilihan_ganda', label: 'Pilihan Ganda' },
  { key: 'benar_salah', label: 'Benar/Salah' },
  { key: 'essay', label: 'Essay' },
]

function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    gray: 'bg-gray-100 text-gray-600',
    red: 'bg-red-100 text-red-700',
  }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>{children}</span>
}

function CreateQuizModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '', description: '', numQuestions: 30,
    timerMinutes: '', difficulty: 'sedang',
    questionTypes: ['pilihan_ganda', 'benar_salah', 'essay'],
    useTimer: false,
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const fileRef = useRef()

  const toggleType = (key) => {
    setForm(f => ({
      ...f,
      questionTypes: f.questionTypes.includes(key)
        ? f.questionTypes.filter(t => t !== key)
        : [...f.questionTypes, key]
    }))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Pilih file materi terlebih dahulu.'); return }
    if (form.questionTypes.length === 0) { setError('Pilih minimal satu tipe soal.'); return }

    setLoading(true)
    setProgress('Mengupload dan membaca materi...')
    try {
      const fd = new FormData()
      fd.append('material', file)
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('numQuestions', form.numQuestions)
      fd.append('difficulty', form.difficulty)
      fd.append('questionTypes', JSON.stringify(form.questionTypes))
      if (form.useTimer && form.timerMinutes) fd.append('timerMinutes', form.timerMinutes)

      setProgress('Sedang memproses dan membuat soal otomatis... (mungkin butuh 30-60 detik)')
      const res = await adminApi.post('/admin/quizzes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      onSuccess(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat kuis.')
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" /> Buat Kuis Baru
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Judul Kuis *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Contoh: Kuis Sejarah Indonesia" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2} placeholder="Deskripsi singkat tentang kuis ini" />
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File Materi (PDF / DOCX) *</label>
            <div
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition
                ${file ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'}`}>
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => setFile(e.target.files[0])} />
              <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? 'text-indigo-500' : 'text-gray-400'}`} />
              {file ? (
                <div>
                  <p className="font-medium text-indigo-700">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 font-medium">Klik atau drag & drop file di sini</p>
                  <p className="text-sm text-gray-400 mt-1">Format: PDF, DOC, DOCX (maks. 20MB)</p>
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Soal</label>
              <input type="number" min="1" max="100" value={form.numQuestions}
                onChange={e => setForm(f => ({ ...f, numQuestions: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat Kesulitan</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
                {DIFFICULTIES.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Timer */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.useTimer}
                onChange={e => setForm(f => ({ ...f, useTimer: e.target.checked }))}
                className="rounded" />
              <span className="text-sm font-medium text-gray-700">Aktifkan Timer</span>
            </label>
            {form.useTimer && (
              <div className="mt-2">
                <input type="number" min="1" max="300" placeholder="Durasi dalam menit"
                  value={form.timerMinutes}
                  onChange={e => setForm(f => ({ ...f, timerMinutes: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            )}
          </div>

          {/* Question Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipe Soal</label>
            <div className="flex gap-3 flex-wrap">
              {Q_TYPES.map(({ key, label }) => (
                <label key={key} className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition
                  ${form.questionTypes.includes(key) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" checked={form.questionTypes.includes(key)}
                    onChange={() => toggleType(key)} className="hidden" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {loading && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin flex-shrink-0" />
              <span className="text-indigo-700 text-sm">{progress}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Membuat...</> : <><BookOpen className="w-4 h-4" /> Generate Soal Otomatis</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [toggling, setToggling] = useState(null)
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/admin/login')
  }

  const fetchQuizzes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get('/admin/quizzes')
      setQuizzes(res.data.data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQuizzes() }, [fetchQuizzes])

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus kuis ini? Semua soal dan hasil peserta akan ikut terhapus.')) return
    setDeleting(id)
    try {
      await adminApi.delete(`/admin/quizzes/${id}`)
      setQuizzes(qs => qs.filter(q => q.id !== id))
    } catch { alert('Gagal menghapus kuis.') } finally { setDeleting(null) }
  }

  const handleTogglePublish = async (id) => {
    setToggling(id)
    try {
      const res = await adminApi.post(`/admin/quizzes/${id}/publish`)
      setQuizzes(qs => qs.map(q => q.id === id ? { ...q, is_published: res.data.data.is_published } : q))
    } catch { alert('Gagal mengubah status kuis.') } finally { setToggling(null) }
  }

  const diffColor = { mudah: 'green', sedang: 'blue', sulit: 'red' }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <GraduationCap className="w-6 h-6" /> RuangKuis <span className="text-gray-400 font-normal text-sm ml-2">Panel Admin</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-gray-500 hover:text-red-600 transition text-sm">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Manajemen Kuis</h1>
            <p className="text-gray-500 text-sm mt-1">{quizzes.length} kuis tersimpan</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchQuizzes}
              className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition text-sm font-semibold">
              <Plus className="w-4 h-4" /> Buat Kuis Baru
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Kuis', value: quizzes.length, icon: BookOpen, color: 'indigo' },
            { label: 'Dipublikasi', value: quizzes.filter(q => q.is_published).length, icon: CheckCircle, color: 'green' },
            { label: 'Draft', value: quizzes.filter(q => !q.is_published).length, icon: XCircle, color: 'yellow' },
            { label: 'Total Soal', value: quizzes.reduce((s, q) => s + (q.question_count || 0), 0), icon: Users, color: 'purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl shadow-sm border p-4">
              <div className={`text-${color}-600 mb-2`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold text-gray-800">{value}</div>
              <div className="text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Quizzes Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Belum ada kuis</h3>
            <p className="text-gray-400 text-sm mb-6">Buat kuis pertama Anda dengan upload materi untuk membuat soal secara otomatis!</p>
            <button onClick={() => setShowModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg transition font-semibold">
              Buat Kuis Pertama
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Judul Kuis</th>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Soal</th>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Kesulitan</th>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Timer</th>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-gray-600 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quizzes.map(quiz => (
                  <tr key={quiz.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-800">{quiz.title}</div>
                      {quiz.description && <div className="text-xs text-gray-400 truncate max-w-xs">{quiz.description}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{quiz.question_count || 0}</td>
                    <td className="px-6 py-4">
                      <Badge color={diffColor[quiz.difficulty] || 'gray'}>
                        {quiz.difficulty?.charAt(0).toUpperCase() + quiz.difficulty?.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {quiz.timer_minutes ? `${quiz.timer_minutes} menit` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge color={quiz.is_published ? 'green' : 'yellow'}>
                        {quiz.is_published ? 'Dipublikasi' : 'Draft'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded" title="Lihat soal">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => navigate(`/admin/quiz/${quiz.id}/results`)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded" title="Lihat hasil">
                          <BarChart2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleTogglePublish(quiz.id)} disabled={toggling === quiz.id}
                          className={`p-1.5 rounded ${quiz.is_published ? 'text-yellow-500 hover:bg-yellow-50' : 'text-green-500 hover:bg-green-50'}`}
                          title={quiz.is_published ? 'Sembunyikan' : 'Publikasikan'}>
                          {toggling === quiz.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button onClick={() => handleDelete(quiz.id)} disabled={deleting === quiz.id}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="Hapus">
                          {deleting === quiz.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <CreateQuizModal
          onClose={() => setShowModal(false)}
          onSuccess={(data) => {
            setShowModal(false)
            fetchQuizzes()
            navigate(`/admin/quiz/${data.quiz.id}`)
          }}
        />
      )}
    </div>
  )
}
