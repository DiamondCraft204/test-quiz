import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import {
  GraduationCap, ArrowLeft, Plus, Trash2, Edit3, RefreshCw, Save,
  X, Loader2, CheckCircle, BookOpen, MessageSquare, ToggleLeft, BarChart2
} from 'lucide-react'

const TYPE_LABELS = { pilihan_ganda: 'Pilihan Ganda', benar_salah: 'Benar/Salah', essay: 'Essay' }
const TYPE_COLORS = { pilihan_ganda: 'blue', benar_salah: 'green', essay: 'purple' }

function Badge({ type }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700'
  }
  const color = TYPE_COLORS[type] || 'blue'
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>{TYPE_LABELS[type] || type}</span>
}

const parseOptions = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function QuestionCard({ q, onEdit, onDelete, idx }) {
  const [deleting, setDeleting] = useState(false)
  const options = parseOptions(q.options)

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-400 w-6">{idx + 1}.</span>
          <Badge type={q.type} />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(q)} className="p-1.5 text-indigo-400 hover:bg-indigo-50 rounded">
            <Edit3 className="w-4 h-4" />
          </button>
          <button onClick={async () => {
            if (!confirm('Hapus soal ini?')) return
            setDeleting(true)
            try { await onDelete(q.id) } finally { setDeleting(false) }
          }} className="p-1.5 text-red-400 hover:bg-red-50 rounded" disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <p className="text-gray-800 font-medium mb-3">{q.text}</p>
      {options.length > 0 && (
        <div className="space-y-1 mb-3">
          {options.map((opt, i) => (
            <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${
              q.correct_answer && opt.startsWith(q.correct_answer)
                ? 'bg-green-50 text-green-700 font-medium'
                : 'bg-gray-50 text-gray-600'
            }`}>
              {q.correct_answer && opt.startsWith(q.correct_answer) && <CheckCircle className="w-3 h-3 inline mr-1" />}
              {opt}
            </div>
          ))}
        </div>
      )}
      {q.correct_answer && options.length === 0 && (
        <div className="text-sm bg-green-50 text-green-700 px-3 py-1.5 rounded-lg mb-2">
          <span className="font-medium">Jawaban: </span>{q.correct_answer}
        </div>
      )}
      {q.explanation && (
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg">
          <span className="font-medium text-gray-600">Penjelasan: </span>{q.explanation}
        </div>
      )}
    </div>
  )
}

function EditModal({ question, onClose, onSave }) {
  const [form, setForm] = useState({
    text: question?.text || '',
    type: question?.type || 'pilihan_ganda',
    correct_answer: question?.correct_answer || '',
    explanation: question?.explanation || '',
    options: parseOptions(question?.options)
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ ...form, options: form.options }) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-bold">{question ? 'Edit Soal' : 'Tambah Soal Manual'}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Soal</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teks Pertanyaan</label>
            <textarea value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3} />
          </div>
          {form.type === 'pilihan_ganda' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opsi Jawaban</label>
              {['A', 'B', 'C', 'D'].map((letter, i) => (
                <div key={letter} className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-gray-500 w-6">{letter}.</span>
                  <input value={form.options[i]?.replace(/^[A-D]\.\s*/, '') || ''}
                    onChange={e => {
                      const opts = [...(form.options || [])]
                      opts[i] = `${letter}. ${e.target.value}`
                      setForm(f => ({ ...f, options: opts }))
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
              ))}
              <div className="mt-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Jawaban Benar</label>
                <select value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">-- Pilih --</option>
                  {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          )}
          {form.type === 'benar_salah' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jawaban Benar</label>
              <select value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">-- Pilih --</option>
                <option value="Benar">Benar</option>
                <option value="Salah">Salah</option>
              </select>
            </div>
          )}
          {form.type === 'essay' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunci Jawaban / Poin Penting</label>
              <textarea value={form.correct_answer} onChange={e => setForm(f => ({ ...f, correct_answer: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={3} placeholder="Tuliskan poin-poin yang harus ada dalam jawaban..." />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Penjelasan (opsional)</label>
            <textarea value={form.explanation} onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={2} />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50">Batal</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuizDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [editQ, setEditQ] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/quizzes/${id}`)
      setQuiz(res.data.data.quiz)
      setQuestions(res.data.data.questions)
    } catch { } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (qid) => {
    await adminApi.delete(`/admin/questions/${qid}`)
    setQuestions(qs => qs.filter(q => q.id !== qid))
  }

  const handleSaveEdit = async (form) => {
    const payload = {
      text: form.text, type: form.type,
      options: form.options?.length ? JSON.stringify(form.options) : null,
      correct_answer: form.correct_answer,
      explanation: form.explanation,
    }
    if (editQ.id) {
      await adminApi.put(`/admin/questions/${editQ.id}`, payload)
      setQuestions(qs => qs.map(q => q.id === editQ.id ? { ...q, ...payload } : q))
    } else {
      const res = await adminApi.post(`/admin/quizzes/${id}/questions`, payload)
      setQuestions(qs => [...qs, res.data.data])
    }
    setEditQ(null)
    setShowAddModal(false)
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerasi akan menghapus semua soal saat ini dan membuat soal baru dari materi. Lanjutkan?')) return
    setRegenerating(true)
    try {
      const res = await adminApi.post(`/admin/quizzes/${id}/regenerate`)
      setQuestions(res.data.data)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal regenerasi soal.')
    } finally { setRegenerating(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </button>
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <GraduationCap className="w-5 h-5" /> RuangKuis Admin
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Quiz Info */}
        {quiz && (
          <div className="bg-white rounded-2xl border shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">{quiz.title}</h1>
            {quiz.description && <p className="text-gray-500 mb-4">{quiz.description}</p>}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full">{questions.length} soal</span>
              <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full capitalize">{quiz.difficulty}</span>
              {quiz.timer_minutes && <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full">{quiz.timer_minutes} menit</span>}
              <span className={`px-3 py-1 rounded-full ${quiz.is_published ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                {quiz.is_published ? 'Dipublikasi' : 'Draft'}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
            <Plus className="w-4 h-4" /> Tambah Soal Manual
          </button>
          <button onClick={handleRegenerate} disabled={regenerating}
            className="flex items-center gap-2 border border-indigo-300 text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm transition disabled:opacity-60">
            {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Regenerasi Soal Otomatis
          </button>
          <button onClick={() => navigate(`/admin/quiz/${id}/results`)}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm transition">
            <BarChart2 className="w-4 h-4" /> Lihat Hasil Peserta
          </button>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl border p-12 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Belum ada soal. Tambah manual atau gunakan regenerasi otomatis.</p>
            </div>
          ) : questions.map((q, idx) => (
            <QuestionCard key={q.id} q={q} idx={idx} onEdit={setEditQ} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {(editQ !== null) && (
        <EditModal question={editQ.id ? editQ : null} onClose={() => setEditQ(null)} onSave={handleSaveEdit} />
      )}
      {showAddModal && (
        <EditModal question={null} onClose={() => setShowAddModal(false)} onSave={handleSaveEdit} />
      )}
    </div>
  )
}
