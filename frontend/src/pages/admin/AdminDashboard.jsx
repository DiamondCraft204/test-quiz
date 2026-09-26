import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import {
  GraduationCap, Plus, LogOut, BookOpen, Users, CheckCircle, XCircle,
  Trash2, Eye, BarChart2, Upload, Loader2, X, ChevronDown, RefreshCw, Settings, FileQuestion
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
    title: '', description: '',
    timerMinutes: '', difficulty: 'sedang',
    useTimer: false,
  })
  const [typeConfigs, setTypeConfigs] = useState({
    pilihan_ganda: { enabled: true, count: 10 },
    benar_salah: { enabled: true, count: 5 },
    essay: { enabled: true, count: 5 },
  })
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const fileRef = useRef()

  const toggleType = (key) => {
    setTypeConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: !prev[key].enabled,
        count: prev[key].count || 5,
      }
    }))
  }

  const updateCount = (key, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0)
    setTypeConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        count: num,
      }
    }))
  }

  const totalQuestions = Object.entries(typeConfigs)
    .filter(([_, cfg]) => cfg.enabled)
    .reduce((sum, [_, cfg]) => sum + (parseInt(cfg.count, 10) || 0), 0)

  const activeQuestionTypes = Object.entries(typeConfigs)
    .filter(([_, cfg]) => cfg.enabled && (parseInt(cfg.count, 10) || 0) > 0)
    .map(([key]) => key)

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!file) { setError('Pilih file materi terlebih dahulu.'); return }
    if (file.size > 4.5 * 1024 * 1024) {
      setError(`Ukuran file terlalu besar (${(file.size / 1024 / 1024).toFixed(1)} MB). Batas upload server Vercel adalah maksimal 4.5 MB. Silakan gunakan modul/bab materi atau ringkasan PDF.`);
      return;
    }
    if (activeQuestionTypes.length === 0 || totalQuestions <= 0) {
      setError('Tentukan minimal 1 tipe soal dengan jumlah soal minimal 1 butir.');
      return;
    }

    setLoading(true)
    setProgress('Mengupload dan membaca materi...')
    try {
      const typeCounts = {}
      Object.entries(typeConfigs).forEach(([k, cfg]) => {
        if (cfg.enabled && (parseInt(cfg.count, 10) || 0) > 0) {
          typeCounts[k] = parseInt(cfg.count, 10) || 0
        }
      })

      const fd = new FormData()
      fd.append('material', file)
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('numQuestions', totalQuestions)
      fd.append('difficulty', form.difficulty)
      fd.append('questionTypes', JSON.stringify(activeQuestionTypes))
      fd.append('typeCounts', JSON.stringify(typeCounts))
      if (form.useTimer && form.timerMinutes) fd.append('timerMinutes', form.timerMinutes)

      const breakdownSummary = Object.entries(typeCounts)
        .map(([k, c]) => `${c} ${k === 'pilihan_ganda' ? 'PG' : k === 'benar_salah' ? 'B/S' : 'Essay'}`)
        .join(', ')

      setProgress(`Sedang membuat ${totalQuestions} butir soal (${breakdownSummary})... (mungkin butuh 30-60 detik)`)
      const res = await adminApi.post('/admin/quizzes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      })
      onSuccess(res.data.data)
    } catch (err) {
      if (err.response?.status === 413) {
        setError('Ukuran file melebihi batas upload Vercel (maksimal 4.5 MB). Silakan gunakan bab/modul materi tertentu.');
      } else if (err.response?.status === 504) {
        setError('Waktu pemrosesan melebihi batas timeout Vercel. Coba gunakan materi yang lebih ringkas.');
      } else {
        setError(err.response?.data?.message || err.message || 'Gagal membuat kuis.');
      }
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

          {/* Settings: Difficulty & Timer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tingkat Kesulitan</label>
              <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize">
                {DIFFICULTIES.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer select-none mb-1">
                <input type="checkbox" checked={form.useTimer}
                  onChange={e => setForm(f => ({ ...f, useTimer: e.target.checked }))}
                  className="rounded text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-medium text-gray-700">Aktifkan Timer (Menit)</span>
              </label>
              <input type="number" min="1" max="300" placeholder="Durasi dalam menit (misal: 60)"
                disabled={!form.useTimer}
                value={form.timerMinutes}
                onChange={e => setForm(f => ({ ...f, timerMinutes: e.target.value }))}
                className={`w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  form.useTimer ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                }`} />
            </div>
          </div>

          {/* Question Types & Exact Count Input */}
          <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-gray-800">
                  Komposisi Tipe & Jumlah Soal
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Tentukan berapa banyak butir soal yang ingin dibuat untuk setiap tipenya
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                  totalQuestions > 0 ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 'bg-red-100 text-red-700 border-red-200'
                }`}>
                  Total: {totalQuestions} Soal
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {Q_TYPES.map(({ key, label }) => {
                const isEnabled = typeConfigs[key]?.enabled;
                const count = typeConfigs[key]?.count ?? 0;
                return (
                  <div key={key} className={`p-3 rounded-xl border transition-all ${
                    isEnabled
                      ? 'border-indigo-500 bg-white shadow-xs ring-2 ring-indigo-500/10'
                      : 'border-gray-200 bg-gray-100/60 opacity-60'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleType(key)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-sm font-bold ${isEnabled ? 'text-indigo-900' : 'text-gray-600'}`}>
                        {label}
                      </span>
                    </label>

                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Jumlah Soal:
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          disabled={!isEnabled}
                          value={isEnabled ? count : 0}
                          onChange={(e) => updateCount(key, e.target.value)}
                          className={`w-full text-sm border rounded-lg pl-3 pr-10 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            isEnabled
                              ? 'bg-white border-gray-300 text-gray-900 font-semibold'
                              : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1.5 text-xs text-gray-400 pointer-events-none">
                          soal
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
            <button type="submit" disabled={loading || totalQuestions <= 0}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: 'Total Kuis',
              value: quizzes.length,
              icon: BookOpen,
              bg: 'bg-indigo-50',
              text: 'text-indigo-600',
              border: 'border-indigo-100',
            },
            {
              label: 'Dipublikasi',
              value: quizzes.filter(q => q.is_published).length,
              icon: CheckCircle,
              bg: 'bg-emerald-50',
              text: 'text-emerald-600',
              border: 'border-emerald-100',
            },
            {
              label: 'Draft',
              value: quizzes.filter(q => !q.is_published).length,
              icon: XCircle,
              bg: 'bg-amber-50',
              text: 'text-amber-600',
              border: 'border-amber-100',
            },
            {
              label: 'Total Soal',
              value: quizzes.reduce((s, q) => s + (parseInt(q.question_count, 10) || 0), 0),
              icon: FileQuestion,
              bg: 'bg-purple-50',
              text: 'text-purple-600',
              border: 'border-purple-100',
            },
          ].map(({ label, value, icon: Icon, bg, text, border }) => (
            <div
              key={label}
              className={`bg-white rounded-2xl shadow-sm border ${border} p-5 flex items-center justify-between hover:shadow-md transition`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
                <div className="text-3xl font-extrabold text-gray-800 tracking-tight">{value}</div>
              </div>
              <div className={`w-12 h-12 rounded-xl ${bg} ${text} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
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
