import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import { 
  ArrowLeft, GraduationCap, Loader2, Users, Trophy, Clock, 
  TrendingUp, ChevronDown, ChevronUp, CheckCircle, Edit3, 
  X, Save, AlertCircle, Check, MessageSquare
} from 'lucide-react'

function formatTime(seconds) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function ScoreBar({ score }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-12 text-right">{score?.toFixed(1)}%</span>
    </div>
  )
}

export default function QuizResults() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  // Edit Total Score Modal state
  const [editingTotalModal, setEditingTotalModal] = useState(null) // { submission }
  const [inputTotalScore, setInputTotalScore] = useState('')

  // Edit Question Score Modal state
  const [editingQuestionModal, setEditingQuestionModal] = useState(null) 
  // { submission, questionIndex, question, answerItem }
  const [inputQuestionScore, setInputQuestionScore] = useState('')
  const [inputQuestionFeedback, setInputQuestionFeedback] = useState('')

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }

  const fetchResults = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    try {
      const res = await adminApi.get(`/admin/quizzes/${id}/results`)
      setData(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      if (!isSilent) setLoading(false)
    }
  }, [id])

  useEffect(() => { 
    fetchResults() 
  }, [fetchResults])

  // Open modal to edit overall score
  const handleOpenEditTotal = (sub, e) => {
    e.stopPropagation()
    setEditingTotalModal(sub)
    setInputTotalScore(sub.score !== undefined ? sub.score.toString() : '0')
  }

  // Save overall score
  const handleSaveTotalScore = async (e) => {
    e.preventDefault()
    if (!editingTotalModal) return

    const scoreNum = parseFloat(inputTotalScore)
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      showToast('Nilai harus berupa angka antara 0 dan 100.', 'error')
      return
    }

    setSaving(true)
    try {
      await adminApi.put(`/admin/submissions/${editingTotalModal.id}`, {
        score: scoreNum
      })
      showToast(`Nilai total ${editingTotalModal.user_name} berhasil diubah menjadi ${scoreNum}%!`)
      setEditingTotalModal(null)
      await fetchResults(true)
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal mengubah nilai.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Open modal to edit individual question score
  const handleOpenEditQuestion = (sub, qIndex, answerItem, e) => {
    e.stopPropagation()
    setEditingQuestionModal({
      submission: sub,
      questionIndex: qIndex,
      answerItem: answerItem
    })
    const curScore = answerItem.score !== undefined ? answerItem.score : (answerItem.isCorrect ? 100 : 0)
    setInputQuestionScore(curScore.toString())
    setInputQuestionFeedback(answerItem.feedback || '')
  }

  // Save individual question score
  const handleSaveQuestionScore = async (e) => {
    e.preventDefault()
    if (!editingQuestionModal) return

    const qScoreNum = parseFloat(inputQuestionScore)
    if (isNaN(qScoreNum) || qScoreNum < 0 || qScoreNum > 100) {
      showToast('Nilai soal harus berupa angka antara 0 dan 100.', 'error')
      return
    }

    const { submission, questionIndex, answerItem } = editingQuestionModal
    let currentAnswers = Array.isArray(submission.answers) ? [...submission.answers] : []
    if (!currentAnswers.length && typeof submission.answers === 'string') {
      try { currentAnswers = JSON.parse(submission.answers) || [] } catch { currentAnswers = [] }
    }

    // Update the specific answer object
    const updatedAnswers = currentAnswers.map((a, idx) => {
      if (idx === questionIndex) {
        return {
          ...a,
          score: qScoreNum,
          isCorrect: qScoreNum >= 70,
          feedback: inputQuestionFeedback.trim() || a.feedback || ''
        }
      }
      return a
    })

    setSaving(true)
    try {
      // Send updated answers without specifying 'score' so backend recalculates proportional score
      await adminApi.put(`/admin/submissions/${submission.id}`, {
        answers: updatedAnswers
      })
      showToast(`Nilai Soal #${questionIndex + 1} berhasil diperbarui!`)
      setEditingQuestionModal(null)
      await fetchResults(true)
    } catch (err) {
      showToast(err.response?.data?.message || 'Gagal memperbarui nilai soal.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )

  const submissions = data?.submissions || []
  const avgScore = submissions.length ? submissions.reduce((s, r) => s + (r.score || 0), 0) / submissions.length : 0
  const maxScore = submissions.length ? Math.max(...submissions.map(r => r.score || 0)) : 0
  const minScore = submissions.length ? Math.min(...submissions.map(r => r.score || 0)) : 0

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 text-white text-sm font-medium transition-all transform animate-bounce ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <Check className="w-5 h-5 flex-shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate(`/admin/quiz/${id}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke soal
          </button>
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <GraduationCap className="w-5 h-5" /> Ruang tugas Admin
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Hasil Peserta & Kelola Nilai</h1>
            <p className="text-gray-500 mt-1">Kuis: <span className="font-semibold text-gray-700">{data?.quiz?.title}</span></p>
          </div>
          <div className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <Edit3 className="w-4 h-4 flex-shrink-0" />
            <span>Admin dapat mengubah nilai total atau nilai tiap soal secara langsung.</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Peserta', value: submissions.length, icon: Users, color: 'indigo' },
            { label: 'Rata-rata Skor', value: `${avgScore.toFixed(1)}%`, icon: TrendingUp, color: 'blue' },
            { label: 'Skor Tertinggi', value: `${maxScore.toFixed(1)}%`, icon: Trophy, color: 'green' },
            { label: 'Skor Terendah', value: submissions.length ? `${minScore.toFixed(1)}%` : '—', icon: Clock, color: 'orange' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border shadow-sm p-4">
              <div className={`text-${color}-600 mb-2`}><Icon className="w-5 h-5" /></div>
              <div className="text-2xl font-bold text-gray-800">{value}</div>
              <div className="text-sm text-gray-500">{label}</div>
            </div>
          ))}
        </div>

        {submissions.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Belum ada peserta yang mengikuti kuis ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => {
              let answers = Array.isArray(sub.answers) ? sub.answers : []
              if (!answers.length && typeof sub.answers === 'string') {
                try { answers = JSON.parse(sub.answers) || [] } catch { answers = [] }
              }
              const isItemExpanded = expanded === sub.id

              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all">
                  <div 
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-gray-50/80 gap-4"
                    onClick={() => setExpanded(isItemExpanded ? null : sub.id)}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0 shadow-xs">
                        {sub.user_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <span>{sub.user_name}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {sub.user_email} · {new Date(sub.submitted_at).toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="text-right text-xs">
                        <div className="text-gray-600 font-medium">Benar: {sub.correct_count}/{sub.total_questions}</div>
                        <div className="text-gray-400">Waktu: {formatTime(sub.time_taken)}</div>
                        {sub.cheat_violations > 0 && (
                          <div className="text-red-600 font-semibold mt-0.5">
                            Curang: {sub.cheat_violations}x (-{sub.cheat_violations * 5} poin)
                          </div>
                        )}
                      </div>

                      <div className="w-32 md:w-36">
                        <ScoreBar score={sub.score || 0} />
                      </div>

                      {/* Button to edit total score */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditTotal(sub, e)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-200 shadow-2xs flex items-center gap-1.5 text-xs font-semibold"
                        title="Ubah Nilai Total"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ubah Nilai</span>
                      </button>

                      <div className="text-gray-400 pl-1">
                        {isItemExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isItemExpanded && answers.length > 0 && (
                    <div className="border-t p-4 md:p-6 bg-slate-50 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
                        <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-indigo-600" />
                          Rincian Jawaban & Nilai Tiap Soal ({answers.length} Soal)
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            Total Nilai: <span className="font-bold text-gray-900">{sub.score?.toFixed(1)}%</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditTotal(sub, e)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" /> Ubah Total
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3.5">
                        {answers.map((a, i) => {
                          const isEssay = a.questionType === 'essay'
                          const qScore = a.score !== undefined ? a.score : (a.isCorrect ? 100 : 0)

                          let scoreBadge = {
                            bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                            label: `${qScore}/100 (Sempurna)`
                          }
                          if (qScore >= 100) {
                            scoreBadge = { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: '100/100 (Sempurna)' }
                          } else if (qScore >= 70) {
                            scoreBadge = { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: `${qScore}/100 (Mendekati)` }
                          } else if (qScore >= 10) {
                            scoreBadge = { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: `${qScore}/100 (Kurang)` }
                          } else if (qScore > 0) {
                            scoreBadge = { bg: 'bg-orange-100 text-orange-800 border-orange-300', label: `${qScore}/100 (Apa Adanya)` }
                          } else {
                            scoreBadge = { bg: 'bg-red-100 text-red-800 border-red-300', label: '0/100 (Salah/Kosong)' }
                          }

                          const typeBadge = isEssay ? 'Essay' : a.questionType === 'benar_salah' ? 'Benar / Salah' : 'Pilihan Ganda'

                          return (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-2xs">
                              {/* Header: Soal #, Type, Score Badge, and Edit Question Button */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-sm">Soal {i + 1}</span>
                                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                                    {typeBadge}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreBadge.bg}`}>
                                    Nilai: {scoreBadge.label}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditQuestion(sub, i, a, e)}
                                    className="p-1 px-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
                                    title="Ubah Nilai Soal Ini"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Koreksi Nilai</span>
                                  </button>
                                </div>
                              </div>

                              {/* Question Text */}
                              <p className="text-gray-800 font-medium text-sm mb-3">
                                {a.questionText || `Pertanyaan #${i + 1}`}
                              </p>

                              {/* Jawaban Peserta vs Kunci Jawaban */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className={`p-3 rounded-lg border ${
                                  qScore >= 70 ? 'bg-green-50/50 border-green-200 text-green-900' :
                                  qScore >= 10 ? 'bg-amber-50/50 border-amber-200 text-amber-900' :
                                  'bg-red-50/50 border-red-200 text-red-900'
                                }`}>
                                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                                    Jawaban Peserta:
                                  </div>
                                  <div className="font-medium whitespace-pre-wrap">
                                    {a.answer || <span className="italic text-gray-400">(Tidak dijawab)</span>}
                                  </div>
                                </div>

                                <div className="p-3 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-950">
                                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1">
                                    <span>✓ Kunci Jawaban (Nilai Sempurna):</span>
                                  </div>
                                  <div className="font-medium whitespace-pre-wrap">
                                    {a.correctAnswer || <span className="italic text-gray-400">-</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Evaluasi / Feedback if exists */}
                              {a.feedback && (
                                <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs flex items-start gap-2">
                                  <MessageSquare className="w-3.5 h-3.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-bold">Catatan / Evaluasi:</span> {a.feedback}
                                  </div>
                                </div>
                              )}

                              {/* Explanation if exists */}
                              {a.explanation && !isEssay && (
                                <div className="mt-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs">
                                  <span className="font-bold">💡 Pembahasan:</span> {a.explanation}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── MODAL UBAH NILAI TOTAL ─────────────────────────────────────────── */}
      {editingTotalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-800 text-lg">Ubah Nilai Total Peserta</h3>
              </div>
              <button 
                onClick={() => setEditingTotalModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTotalScore} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Nama Peserta
                </label>
                <div className="font-bold text-gray-800 text-base">{editingTotalModal.user_name}</div>
                <div className="text-xs text-gray-400">{editingTotalModal.user_email}</div>
              </div>

              {editingTotalModal.cheat_violations > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold">Catatan Pinalti Curang:</span> Peserta terdeteksi {editingTotalModal.cheat_violations}x keluar halaman/tab.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nilai Akhir Baru (0 - 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={inputTotalScore}
                    onChange={(e) => setInputTotalScore(e.target.value)}
                    placeholder="Contoh: 85"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg font-bold text-gray-800"
                  />
                  <span className="absolute right-4 top-3 text-gray-400 font-bold text-sm">%</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Pilihan Cepat:</label>
                <div className="flex flex-wrap gap-1.5">
                  {[100, 95, 90, 85, 80, 75, 70, 60, 50, 0].map((scorePreset) => (
                    <button
                      key={scorePreset}
                      type="button"
                      onClick={() => setInputTotalScore(scorePreset.toString())}
                      className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 font-semibold text-gray-700 transition-colors"
                    >
                      {scorePreset}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTotalModal(null)}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Simpan Nilai</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL UBAH NILAI SOAL ───────────────────────────────────────────── */}
      {editingQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-gray-800 text-lg">
                  Koreksi Nilai Soal #{editingQuestionModal.questionIndex + 1}
                </h3>
              </div>
              <button 
                onClick={() => setEditingQuestionModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestionScore} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                  Peserta
                </span>
                <span className="font-bold text-gray-800">
                  {editingQuestionModal.submission.user_name}
                </span>
              </div>

              {/* Soal */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-800">
                <span className="font-bold block text-xs text-gray-500 uppercase mb-1">Teks Pertanyaan:</span>
                {editingQuestionModal.answerItem.questionText || `Pertanyaan #${editingQuestionModal.questionIndex + 1}`}
              </div>

              {/* Jawaban Peserta vs Kunci */}
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl text-blue-950">
                  <span className="font-bold block uppercase mb-1 text-blue-700">Jawaban Peserta:</span>
                  <div className="whitespace-pre-wrap font-medium">
                    {editingQuestionModal.answerItem.answer || <span className="italic text-gray-400">(Tidak dijawab)</span>}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950">
                  <span className="font-bold block uppercase mb-1 text-emerald-700">Kunci Jawaban Referensi:</span>
                  <div className="whitespace-pre-wrap font-medium">
                    {editingQuestionModal.answerItem.correctAnswer || '-'}
                  </div>
                </div>
              </div>

              {/* Nilai Soal Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nilai Soal Ini (0 - 100)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    required
                    value={inputQuestionScore}
                    onChange={(e) => setInputQuestionScore(e.target.value)}
                    placeholder="0 - 100"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg font-bold text-gray-800"
                  />
                  <span className="absolute right-4 top-3 text-gray-400 font-bold text-sm">/ 100</span>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1.5">Pilihan Cepat:</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '100 (Sempurna)', val: 100, color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300' },
                    { label: '80 (Mendekati)', val: 80, color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300' },
                    { label: '50 (Cukup)', val: 50, color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300' },
                    { label: '25 (Kurang)', val: 25, color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300' },
                    { label: '0 (Salah)', val: 0, color: 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => setInputQuestionScore(p.val.toString())}
                      className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-colors ${p.color}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Catatan Koreksi Admin */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Catatan Koreksi Admin (Opsional)
                </label>
                <textarea
                  rows="2"
                  value={inputQuestionFeedback}
                  onChange={(e) => setInputQuestionFeedback(e.target.value)}
                  placeholder="Contoh: Jawaban sudah tepat, nilai disesuaikan menjadi 100."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-gray-800"
                />
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  *Total nilai kuis akan dihitung ulang secara otomatis.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQuestionModal(null)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Simpan Nilai</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
