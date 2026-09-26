import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { GraduationCap, Clock, ChevronLeft, ChevronRight, Send, AlertCircle, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'

function Timer({ minutes, onExpire, quizId }) {
  const startKey = `quiz_start_${quizId}`
  const startTime = useRef(parseInt(localStorage.getItem(startKey)) || Date.now())

  useEffect(() => {
    if (!localStorage.getItem(startKey)) {
      localStorage.setItem(startKey, Date.now().toString())
      startTime.current = Date.now()
    }
  }, [startKey])

  const totalSeconds = minutes * 60
  const [remaining, setRemaining] = useState(() => {
    const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
    return Math.max(0, totalSeconds - elapsed)
  })

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const t = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
      const rem = Math.max(0, totalSeconds - elapsed)
      setRemaining(rem)
      if (rem <= 0) { clearInterval(t); onExpire() }
    }, 1000)
    return () => clearInterval(t)
  }, [onExpire, totalSeconds, remaining])

  const m = Math.floor(remaining / 60)
  const s = remaining % 60
  const urgent = remaining < 120

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${
      urgent ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-orange-50 text-orange-700'
    }`}>
      <Clock className="w-4 h-4" />
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  )
}

export default function QuizPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Key for storing live progress in localStorage
  const progressKey = `quiz_progress_${id}`

  // Retrieve saved progress from localStorage on initial load
  const getSavedProgress = useCallback(() => {
    try {
      const data = localStorage.getItem(`quiz_progress_${id}`)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  }, [id])

  const initialDraft = useRef(getSavedProgress())

  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState(() => initialDraft.current?.answers || {})
  const [current, setCurrent] = useState(() => initialDraft.current?.current || 0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [restoredNotice, setRestoredNotice] = useState(() => {
    const draft = initialDraft.current
    return !!(draft && (Object.keys(draft.answers || {}).length > 0 || (draft.cheatViolations || 0) > 0))
  })

  const startTimeRef = useRef(
    initialDraft.current?.startTime ||
    parseInt(localStorage.getItem(`quiz_start_${id}`), 10) ||
    Date.now()
  )

  // Anti-cheat state: restored from storage to prevent evasion by reload
  const [cheatViolations, setCheatViolations] = useState(() => initialDraft.current?.cheatViolations || 0)
  const [cheatWarningModal, setCheatWarningModal] = useState(() => !!initialDraft.current?.warningActive)
  const [warningMessage, setWarningMessage] = useState(() => initialDraft.current?.warningMessage || '')
  const lastViolationTime = useRef(0)

  // Centralized helper to persist current progress
  const saveProgress = useCallback((override = {}) => {
    try {
      const currentStored = (() => {
        try {
          const item = localStorage.getItem(`quiz_progress_${id}`)
          return item ? JSON.parse(item) : {}
        } catch {
          return {}
        }
      })()

      const toSave = {
        ...currentStored,
        answers,
        current,
        cheatViolations,
        warningActive: cheatWarningModal,
        warningMessage,
        startTime: startTimeRef.current,
        ...override,
      }
      localStorage.setItem(`quiz_progress_${id}`, JSON.stringify(toSave))
    } catch (e) {
      console.error('Gagal menyimpan progres kuis:', e)
    }
  }, [id, answers, current, cheatViolations, cheatWarningModal, warningMessage])

  // Save whenever state changes once loaded
  useEffect(() => {
    if (!loading && quiz) {
      saveProgress()
    }
  }, [answers, current, cheatViolations, cheatWarningModal, warningMessage, loading, quiz, saveProgress])

  // Warn and save immediately on page reload or close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitting && questions.length > 0) {
        saveProgress()
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [submitting, questions.length, saveProgress])

  const recordViolation = useCallback((reason) => {
    const now = Date.now()
    // Debounce to prevent duplicate triggers within 2 seconds
    if (now - lastViolationTime.current < 2000) return
    lastViolationTime.current = now

    setCheatViolations(prev => {
      const nextCount = prev + 1
      const msg = `Pelanggaran ke-${nextCount}: Anda terdeteksi ${reason}. Nilai ujian Anda dikurangi -5 poin untuk setiap pelanggaran! (Total Penalti: -${nextCount * 5} poin).`
      setWarningMessage(msg)
      setCheatWarningModal(true)

      // Save immediately to ensure reload cannot erase violation
      saveProgress({
        cheatViolations: nextCount,
        warningActive: true,
        warningMessage: msg,
      })

      return nextCount
    })
  }, [saveProgress])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('berpindah tab atau me-minimize browser')
      }
    }

    const handleWindowBlur = () => {
      recordViolation('keluar dari jendela ujian atau membuka aplikasi lain')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [recordViolation])

  const fetchQuiz = useCallback(async () => {
    try {
      const res = await api.get(`/quiz/${id}`)
      if (res.data.data.alreadySubmitted) {
        localStorage.removeItem(`quiz_start_${id}`)
        localStorage.removeItem(`quiz_progress_${id}`)
        alert('Anda sudah menyelesaikan kuis ini. Kuis hanya dapat dikerjakan 1 kali.')
        navigate(`/quiz/${id}/result/${res.data.data.submissionId}`)
        return
      }
      setQuiz(res.data.data.quiz)
      const qList = res.data.data.questions || []
      setQuestions(qList)

      // Ensure current index is within bounds
      if (initialDraft.current?.current && initialDraft.current.current >= qList.length) {
        setCurrent(0)
      }
    } catch { navigate('/quizzes') } finally { setLoading(false) }
  }, [id, navigate])

  useEffect(() => { fetchQuiz() }, [fetchQuiz])

  const setAnswer = (questionId, value) => {
    setAnswers(a => {
      const next = { ...a, [questionId]: value }
      saveProgress({ answers: next })
      return next
    })
  }

  const goToQuestion = (idx) => {
    setCurrent(idx)
    saveProgress({ current: idx })
  }

  const prevQuestion = () => {
    setCurrent(c => {
      const nextIdx = Math.max(0, c - 1)
      saveProgress({ current: nextIdx })
      return nextIdx
    })
  }

  const nextQuestion = () => {
    setCurrent(c => {
      const nextIdx = Math.min(questions.length - 1, c + 1)
      saveProgress({ current: nextIdx })
      return nextIdx
    })
  }

  const closeWarningModal = () => {
    setCheatWarningModal(false)
    saveProgress({ warningActive: false })
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000)
    const payload = {
      answers: questions.map(q => ({ questionId: q.id, answer: answers[q.id] || '' })),
      timeTaken,
      cheatViolations,
    }
    try {
      const res = await api.post(`/quiz/${id}/submit`, payload)
      localStorage.removeItem(`quiz_start_${id}`)
      localStorage.removeItem(`quiz_progress_${id}`)
      navigate(`/quiz/${id}/result/${res.data.data.submission.id}`)
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengirim jawaban.')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )

  const q = questions[current]
  const answeredCount = Object.keys(answers).filter(k => answers[k] && String(answers[k]).trim() !== '').length
  let options = []
  if (Array.isArray(q?.options)) {
    options = q.options
  } else if (typeof q?.options === 'string') {
    try { options = JSON.parse(q.options) } catch { options = [] }
  }

  return (
    <div
      className="min-h-screen bg-gray-50 flex flex-col select-none"
      onContextMenu={e => e.preventDefault()}
      onCopy={e => e.preventDefault()}
      onPaste={e => e.preventDefault()}
    >
      {/* Topbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <GraduationCap className="w-5 h-5" />
            <span className="hidden sm:block">{quiz?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            {cheatViolations > 0 ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-700 bg-red-100 border border-red-200 px-3 py-1.5 rounded-full animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5" /> {cheatViolations}x Curang (-{cheatViolations * 5} poin)
              </span>
            ) : (
              <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                🛡️ Anti-Cheat Aktif
              </span>
            )}
            <span className="text-sm text-gray-500">{answeredCount}/{questions.length} dijawab</span>
            {quiz?.timer_minutes && <Timer minutes={quiz.timer_minutes} onExpire={handleSubmit} quizId={id} />}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div className="h-1 bg-indigo-500 transition-all"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto px-4 py-8 w-full">
        {/* Restored Session Notification */}
        {restoredNotice && (
          <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-4 py-3 rounded-2xl text-xs font-semibold mb-6 flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2">
              <span className="text-base">💾</span>
              <span>Sesi pengerjaan sebelumnya dipulihkan:</span>
              <span className="font-bold text-indigo-900">{answeredCount} jawaban tersimpan</span>
              {cheatViolations > 0 && (
                <span className="text-red-600 font-bold ml-1">({cheatViolations}x pelanggaran tercatat)</span>
              )}
            </span>
            <button
              onClick={() => setRestoredNotice(false)}
              className="text-indigo-400 hover:text-indigo-600 font-bold ml-2 px-2 py-0.5 rounded hover:bg-indigo-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Question number dots & Answered vs Unanswered navigation */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                Sudah dijawab: <b className="text-emerald-800">{answeredCount}</b>
              </span>
              <span className="flex items-center gap-1.5 font-medium text-gray-500">
                <span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 inline-block"></span>
                Belum dijawab: <b className="text-gray-700">{questions.length - answeredCount}</b>
              </span>
            </div>
            <span className="text-gray-400 hidden sm:inline">Klik nomor untuk berpindah soal</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {questions.map((qItem, i) => {
              const isAnswered = answers[qItem.id] && String(answers[qItem.id]).trim() !== ''
              const isCurrent = i === current
              return (
                <button
                  key={i}
                  onClick={() => goToQuestion(i)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition flex items-center justify-center relative ${
                    isCurrent
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 shadow-md'
                      : isAnswered
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {i + 1}
                  {isAnswered && !isCurrent && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white"></span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Question Card */}
        {q && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm font-bold text-indigo-600">Soal {current + 1} dari {questions.length}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                q.type === 'pilihan_ganda' ? 'bg-blue-100 text-blue-700' :
                q.type === 'benar_salah' ? 'bg-green-100 text-green-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {q.type === 'pilihan_ganda' ? 'Pilihan Ganda' : q.type === 'benar_salah' ? 'Benar/Salah' : 'Essay'}
              </span>
            </div>
            <p className="text-gray-800 font-medium text-lg leading-relaxed mb-6">{q.text}</p>

            {/* Pilihan Ganda */}
            {q.type === 'pilihan_ganda' && options.length > 0 && (
              <div className="space-y-3">
                {options.map((opt, i) => {
                  const match = typeof opt === 'string' ? opt.match(/^([A-D])[\.\)]\s*/i) : null
                  const letter = match ? match[1].toUpperCase() : (typeof opt === 'string' ? opt.charAt(0) : '')
                  const selected = answers[q.id] === letter || answers[q.id] === opt
                  return (
                    <button key={i} onClick={() => setAnswer(q.id, letter || opt)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition font-medium ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-gray-700'
                      }`}>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Benar/Salah */}
            {q.type === 'benar_salah' && (
              <div className="flex gap-4">
                {['Benar', 'Salah'].map(opt => (
                  <button key={opt} onClick={() => setAnswer(q.id, opt)}
                    className={`flex-1 py-4 rounded-xl border-2 font-semibold text-lg transition ${
                      answers[q.id] === opt
                        ? opt === 'Benar'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-indigo-300 text-gray-600'
                    }`}>
                    {opt === 'Benar' ? '✓ Benar' : '✗ Salah'}
                  </button>
                ))}
              </div>
            )}

            {/* Essay */}
            {q.type === 'essay' && (
              <div>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  rows={5}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-400 resize-none text-gray-800"
                  placeholder="Tulis jawaban kamu di sini..."
                />
                <p className="text-xs text-indigo-600 mt-2 font-medium">💡 Jawaban essay dinilai otomatis berdasarkan ketepatan dan kelengkapan inti jawaban.</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={prevQuestion} disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>

          {current < questions.length - 1 ? (
            <button onClick={nextQuestion}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium">
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setShowConfirm(true)} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold shadow-md">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kumpulkan
            </button>
          )}
        </div>

        {/* Unanswered warning */}
        {answeredCount < questions.length && (
          <div className="mt-4 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span><b>{questions.length - answeredCount}</b> dari {questions.length} soal belum dijawab.</span>
          </div>
        )}
      </div>

      {/* Submit Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <Send className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Kumpulkan Jawaban?</h3>
            <p className="text-gray-500 text-sm mb-2">
              Kamu sudah menjawab <span className="font-semibold text-gray-700">{answeredCount}</span> dari <span className="font-semibold text-gray-700">{questions.length}</span> soal.
            </p>
            {answeredCount < questions.length && (
              <p className="text-amber-700 text-xs mb-2 bg-amber-50 px-3 py-2 rounded-lg font-medium border border-amber-200">
                ⚠️ {questions.length - answeredCount} soal masih belum dijawab
              </p>
            )}
            {cheatViolations > 0 && (
              <p className="text-red-700 text-xs mb-3 bg-red-50 px-3 py-2 rounded-lg font-semibold border border-red-200">
                ⚠️ Terdeteksi {cheatViolations}x pelanggaran keluar halaman (Penalti: -{cheatViolations * 5} poin)
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 transition font-medium">
                Kembali
              </button>
              <button onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-semibold transition shadow-md">
                Ya, Kumpulkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anti-cheat Violation Warning Modal */}
      {cheatWarningModal && (
        <div className="fixed inset-0 bg-red-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center border-2 border-red-500">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-red-700 mb-2">Peringatan Pelanggaran!</h3>
            <p className="text-gray-700 text-sm mb-4 leading-relaxed font-medium">
              {warningMessage}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-xs text-red-800 font-semibold text-left">
              ⚠️ Aturan Ujian: Dilarang berpindah tab, membuka jendela aplikasi lain, atau meninggalkan layar ujian. Setiap pelanggaran akan otomatis terekam dan mengurangi nilai Anda sebesar -5 poin!
            </div>
            <button
              onClick={closeWarningModal}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition shadow-md"
            >
              Saya Mengerti & Kembali ke Soal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
