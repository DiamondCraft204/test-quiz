import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { GraduationCap, Clock, ChevronLeft, ChevronRight, Send, AlertCircle, Loader2 } from 'lucide-react'

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
  const [quiz, setQuiz] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const startTimeRef = useRef(Date.now())

  const fetchQuiz = useCallback(async () => {
    try {
      const res = await api.get(`/quiz/${id}`)
      setQuiz(res.data.data.quiz)
      setQuestions(res.data.data.questions)
    } catch { navigate('/quizzes') } finally { setLoading(false) }
  }, [id, navigate])

  useEffect(() => { fetchQuiz() }, [fetchQuiz])

  const setAnswer = (questionId, value) => {
    setAnswers(a => ({ ...a, [questionId]: value }))
  }

  const handleSubmit = async () => {
    setShowConfirm(false)
    setSubmitting(true)
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000)
    const payload = {
      answers: questions.map(q => ({ questionId: q.id, answer: answers[q.id] || '' })),
      timeTaken,
    }
    try {
      const res = await api.post(`/quiz/${id}/submit`, payload)
      localStorage.removeItem(`quiz_start_${id}`)
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
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== '').length
  let options = []
  try { options = q?.options ? JSON.parse(q.options) : [] } catch { }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Topbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <GraduationCap className="w-5 h-5" />
            <span className="hidden sm:block">{quiz?.title}</span>
          </div>
          <div className="flex items-center gap-3">
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
        {/* Question number dots */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          {questions.map((q, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-8 h-8 rounded-full text-xs font-semibold transition ${
                i === current ? 'bg-indigo-600 text-white' :
                answers[q.id] ? 'bg-green-100 text-green-700 border border-green-300' :
                'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {i + 1}
            </button>
          ))}
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
                  const letter = opt.charAt(0)
                  const selected = answers[q.id] === letter
                  return (
                    <button key={i} onClick={() => setAnswer(q.id, letter)}
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
                <p className="text-xs text-gray-400 mt-1">Jawaban essay tidak dihitung otomatis, akan direview oleh admin.</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </button>

          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium">
              Berikutnya <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setShowConfirm(true)} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kumpulkan
            </button>
          )}
        </div>

        {/* Unanswered warning */}
        {answeredCount < questions.length && (
          <div className="mt-4 flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2.5 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {questions.length - answeredCount} soal belum dijawab
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
              <p className="text-yellow-600 text-sm mb-4 bg-yellow-50 px-3 py-2 rounded-lg">
                ⚠️ {questions.length - answeredCount} soal masih kosong
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition">
                Kembali
              </button>
              <button onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition">
                Ya, Kumpulkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
