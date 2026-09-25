import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { GraduationCap, CheckCircle, XCircle, MessageSquare, ArrowLeft, Trophy, Clock, Loader2 } from 'lucide-react'

function ScoreCircle({ score }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626'
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-gray-800">{score?.toFixed(0)}</span>
        <span className="text-sm text-gray-500">%</span>
      </div>
    </div>
  )
}

export default function ResultPage() {
  const { id, submissionId } = useParams()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchResult = useCallback(async () => {
    try {
      const res = await api.get(`/quiz/submissions/${submissionId}`)
      setSubmission(res.data.data.submission)
      setQuestions(res.data.data.questions)
    } catch { navigate('/quizzes') } finally { setLoading(false) }
  }, [submissionId, navigate])

  useEffect(() => { fetchResult() }, [fetchResult])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  )

  const answers = (() => { try { return JSON.parse(submission?.answers) || [] } catch { return [] } })()
  const score = submission?.score || 0

  const statusLabel = score >= 80 ? { text: 'Luar Biasa! 🎉', color: 'text-green-600' }
    : score >= 60 ? { text: 'Cukup Baik! 👍', color: 'text-yellow-600' }
    : { text: 'Perlu Belajar Lagi 💪', color: 'text-red-600' }

  function formatTime(s) {
    if (!s) return '—'
    return s < 60 ? `${s} detik` : `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 text-indigo-600 font-bold">
          <GraduationCap className="w-5 h-5" /> RuangKuis
        </div>
      </div>


      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Score Card */}
        <div className="bg-white rounded-2xl shadow-sm border p-8 mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Hasil Kuis</h1>
          <p className={`text-lg font-semibold mb-6 ${statusLabel.color}`}>{statusLabel.text}</p>
          <ScoreCircle score={score} />
          <div className="flex justify-center gap-8 mt-6 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">{submission?.correct_count || 0}</div>
              <div className="text-sm text-gray-500">Benar</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-500">
                {(submission?.total_questions || 0) - (submission?.correct_count || 0)}
              </div>
              <div className="text-sm text-gray-500">Salah/Kosong</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-700">{formatTime(submission?.time_taken)}</div>
              <div className="text-sm text-gray-500">Waktu</div>
            </div>
          </div>
        </div>

        {/* Per Question Review */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Pembahasan Soal</h2>
        <div className="space-y-4">
          {answers.map((a, idx) => {
            const q = questions.find(q => q.id === a.questionId)
            let opts = []
            if (Array.isArray(q?.options)) {
              opts = q.options
            } else if (typeof q?.options === 'string') {
              try { opts = JSON.parse(q.options) } catch { opts = [] }
            }
            const isEssay = q?.type === 'essay'
            const status = isEssay ? 'essay' : a.isCorrect ? 'correct' : 'wrong'

            return (
              <div key={idx} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                status === 'correct' ? 'border-l-4 border-l-green-400' :
                status === 'wrong' ? 'border-l-4 border-l-red-400' :
                'border-l-4 border-l-purple-400'
              }`}>
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    {status === 'correct' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                    {status === 'wrong' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                    {status === 'essay' && <MessageSquare className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <span className="text-xs font-bold text-gray-400 mb-1 block">Soal {idx + 1}</span>
                      <p className="text-gray-800 font-medium">{a.questionText || q?.text}</p>
                    </div>
                  </div>

                  {/* Options highlight */}
                  {opts.length > 0 && (
                    <div className="space-y-1.5 mb-3 ml-8">
                      {opts.map((opt, i) => {
                        const match = typeof opt === 'string' ? opt.match(/^([A-D])[\.\)]\s*/i) : null
                        const letter = match ? match[1].toUpperCase() : (typeof opt === 'string' ? opt.charAt(0) : '')
                        const isCorrectOpt = letter === a.correctAnswer || opt === a.correctAnswer
                        const isUserOpt = letter === a.answer || opt === a.answer
                        return (
                          <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${
                            isCorrectOpt ? 'bg-green-50 text-green-800 font-medium' :
                            (isUserOpt && !isCorrectOpt) ? 'bg-red-50 text-red-700 line-through' :
                            'text-gray-500'
                          }`}>
                            {isCorrectOpt && '✓ '}{opt}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Jawaban user untuk benar/salah & essay */}
                  {opts.length === 0 && !isEssay && (
                    <div className="ml-8 space-y-1 mb-2 text-sm">
                      <div className={`px-3 py-1.5 rounded-lg ${a.isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        Jawaban kamu: <span className="font-semibold">{a.answer || '(kosong)'}</span>
                        {!a.isCorrect && a.correctAnswer && <span className="ml-2 text-green-700"> · Benar: {a.correctAnswer}</span>}
                      </div>
                    </div>
                  )}

                  {isEssay && (
                    <div className="ml-8 space-y-2 text-sm">
                      <div className="bg-purple-50 text-purple-800 px-3 py-2 rounded-lg">
                        <span className="font-medium">Jawaban kamu:</span> {a.answer || '(tidak dijawab)'}
                      </div>
                      {a.correctAnswer && (
                        <div className="bg-gray-50 text-gray-700 px-3 py-2 rounded-lg">
                          <span className="font-medium">Kunci jawaban:</span> {a.correctAnswer}
                        </div>
                      )}
                      <div className="text-xs text-purple-600 italic">* Essay tidak dihitung otomatis dalam skor</div>
                    </div>
                  )}

                  {/* Explanation */}
                  {a.explanation && !isEssay && (
                    <div className="ml-8 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg mt-2">
                      <span className="font-medium">💡 Penjelasan:</span> {a.explanation}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <button onClick={() => navigate('/quizzes')}
            className="flex items-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition">
            <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kuis
          </button>
        </div>
      </div>
    </div>
  )
}
