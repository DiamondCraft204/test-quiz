import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { GraduationCap, CheckCircle, XCircle, MessageSquare, ArrowLeft, Trophy, Clock, Loader2, AlertTriangle } from 'lucide-react'

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

        {/* Anti-cheat Penalty Banner */}
        {submission?.cheat_violations > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center gap-3 text-red-800">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm">Penalti Kecurangan: -{submission.cheat_violations * 5} Poin</p>
              <p className="text-xs text-red-600 mt-0.5">
                Terdeteksi berpindah tab/keluar halaman sebanyak <b>{submission.cheat_violations} kali</b> selama ujian. Skor akhir telah dipotong sebesar {submission.cheat_violations * 5} poin.
              </p>
            </div>
          </div>
        )}

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
            const isEssay = q?.type === 'essay' || a.questionType === 'essay'
            const essayScore = a.score !== undefined ? a.score : null
            let status = 'wrong'
            if (isEssay) {
              if (essayScore >= 70) status = 'correct'
              else if (essayScore >= 10) status = 'partial'
              else status = 'wrong'
            } else {
              status = a.isCorrect ? 'correct' : 'wrong'
            }

            const questionScore = isEssay ? (a.score ?? 0) : (a.isCorrect ? 100 : 0)
            const typeLabel = isEssay ? 'Essay' : (q?.type === 'benar_salah' || a.questionType === 'benar_salah') ? 'Benar / Salah' : 'Pilihan Ganda'

            let scoreBadge = {
              bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
              label: '100/100 (Sempurna)'
            }
            if (questionScore === 100) {
              scoreBadge = { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: '100/100 (Sempurna)' }
            } else if (questionScore >= 70) {
              scoreBadge = { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: `${questionScore}/100 (Mendekati)` }
            } else if (questionScore >= 10) {
              scoreBadge = { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: `${questionScore}/100 (Kurang)` }
            } else if (questionScore > 0) {
              scoreBadge = { bg: 'bg-orange-100 text-orange-800 border-orange-300', label: `${questionScore}/100 (Apa Adanya)` }
            } else {
              scoreBadge = { bg: 'bg-red-100 text-red-800 border-red-300', label: '0/100 (Salah/Kosong)' }
            }

            return (
              <div key={idx} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                status === 'correct' ? 'border-l-4 border-l-green-500' :
                status === 'partial' ? 'border-l-4 border-l-amber-500' :
                'border-l-4 border-l-red-400'
              }`}>
                <div className="p-5">
                  {/* Top Bar: Icon, Number, Type, and Score Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2.5">
                      {status === 'correct' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                      {status === 'partial' && <CheckCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                      {status === 'wrong' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-800">Soal {idx + 1}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          {typeLabel}
                        </span>
                      </div>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreBadge.bg}`}>
                      Nilai: {scoreBadge.label}
                    </span>
                  </div>

                  {/* Question Text */}
                  <p className="text-gray-800 font-medium mb-3 ml-7">{a.questionText || q?.text}</p>

                  {/* Pilihan Ganda */}
                  {opts.length > 0 && (
                    <div className="ml-7 space-y-2 mb-3">
                      <div className="space-y-1.5">
                        {opts.map((opt, i) => {
                          const match = typeof opt === 'string' ? opt.match(/^([A-D])[\.\)]\s*/i) : null
                          const letter = match ? match[1].toUpperCase() : (typeof opt === 'string' ? opt.charAt(0) : '')
                          const isCorrectOpt = letter === a.correctAnswer || opt === a.correctAnswer
                          const isUserOpt = letter === a.answer || opt === a.answer
                          return (
                            <div key={i} className={`text-sm px-3 py-2 rounded-lg border ${
                              isCorrectOpt ? 'bg-green-50 border-green-200 text-green-800 font-medium' :
                              (isUserOpt && !isCorrectOpt) ? 'bg-red-50 border-red-200 text-red-700 line-through' :
                              'border-transparent text-gray-600'
                            }`}>
                              {isCorrectOpt && '✓ '}{opt}
                              {isUserOpt && !isCorrectOpt && ' (Jawaban Anda)'}
                            </div>
                          )
                        })}
                      </div>

                      {/* Explicit Correct Answer Banner */}
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-emerald-800">Kunci Jawaban (Nilai Sempurna 100):</span>{' '}
                          <span className="font-semibold">{a.correctAnswer}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Benar / Salah */}
                  {opts.length === 0 && !isEssay && (
                    <div className="ml-7 space-y-2 mb-3">
                      <div className={`p-3 rounded-xl text-sm border flex items-center justify-between ${
                        a.isCorrect ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'
                      }`}>
                        <span>Jawaban kamu: <b className="ml-1">{a.answer || '(Kosong)'}</b></span>
                        <span className="font-bold text-xs">{a.isCorrect ? '✓ Benar' : '✗ Salah'}</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3 text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-emerald-800">Kunci Jawaban (Nilai Sempurna 100):</span>{' '}
                          <span className="font-semibold">{a.correctAnswer}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Essay */}
                  {isEssay && (
                    <div className="ml-7 space-y-3 text-sm">
                      {/* User's Answer */}
                      <div className="bg-gray-50 border border-gray-200 text-gray-800 p-3.5 rounded-xl">
                        <span className="font-bold text-gray-600 block mb-1">Jawaban kamu:</span>
                        <p className="whitespace-pre-wrap font-medium">{a.answer || '(tidak dijawab)'}</p>
                      </div>

                      {/* Perfect Key Answer */}
                      <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 p-4 rounded-xl shadow-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                          <Trophy className="w-4 h-4 text-emerald-600" />
                          <span>Kunci Jawaban Nilai Sempurna (100 Poin):</span>
                        </div>
                        <p className="font-medium whitespace-pre-wrap text-emerald-950 leading-relaxed">
                          {a.correctAnswer || '(Kunci jawaban tidak tersedia)'}
                        </p>
                      </div>

                      {/* Evaluasi AI */}
                      {a.feedback && (
                        <div className="bg-indigo-50 border border-indigo-200 text-indigo-950 p-3.5 rounded-xl">
                          <div className="font-bold text-indigo-800 mb-1 flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-indigo-600" />
                            <span>Evaluasi & Catatan Penilaian:</span>
                          </div>
                          <p className="leading-relaxed">{a.feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation for all types if present */}
                  {a.explanation && !isEssay && (
                    <div className="ml-7 text-sm bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-xl mt-2.5">
                      <span className="font-bold text-blue-800">💡 Penjelasan / Pembahasan:</span>{' '}
                      <span>{a.explanation}</span>
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
