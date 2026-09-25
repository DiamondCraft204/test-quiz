import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import { ArrowLeft, GraduationCap, Loader2, Users, Trophy, Clock, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

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
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${score}%` }} />
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

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.get(`/admin/quizzes/${id}/results`)
      setData(res.data.data)
    } catch { } finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetchResults() }, [fetchResults])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>

  const submissions = data?.submissions || []
  const avgScore = submissions.length ? submissions.reduce((s, r) => s + (r.score || 0), 0) / submissions.length : 0
  const maxScore = submissions.length ? Math.max(...submissions.map(r => r.score || 0)) : 0
  const minScore = submissions.length ? Math.min(...submissions.map(r => r.score || 0)) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(`/admin/quiz/${id}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 text-sm">
            <ArrowLeft className="w-4 h-4" /> Kembali ke soal
          </button>
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <GraduationCap className="w-5 h-5" /> RuangKuis Admin
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Hasil Peserta</h1>
        <p className="text-gray-500 mb-6">Kuis: <span className="font-medium text-gray-700">{data?.quiz?.title}</span></p>

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
          <div className="space-y-3">
            {submissions.map((sub) => {
              let answers = []
              try { answers = JSON.parse(sub.answers) } catch { }
              return (
                <div key={sub.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm">
                        {sub.user_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{sub.user_name}</div>
                        <div className="text-xs text-gray-400">{sub.user_email} · {new Date(sub.submitted_at).toLocaleString('id-ID')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden md:block">
                        <div className="text-sm text-gray-500">Benar: {sub.correct_count}/{sub.total_questions}</div>
                        <div className="text-xs text-gray-400">Waktu: {formatTime(sub.time_taken)}</div>
                      </div>
                      <div className="w-32">
                        <ScoreBar score={sub.score || 0} />
                      </div>
                      {expanded === sub.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {expanded === sub.id && answers.length > 0 && (
                    <div className="border-t p-4 bg-gray-50 space-y-2">
                      {answers.map((a, i) => {
                        const isEssay = a.questionType === 'essay';
                        return (
                          <div key={i} className={`text-sm px-3 py-2 rounded-lg ${
                            a.isCorrect === true ? 'bg-green-50 text-green-800' :
                            a.isCorrect === 'partial' || (isEssay && (a.score || 0) >= 40) ? 'bg-amber-50 text-amber-800' :
                            a.isCorrect === false ? 'bg-red-50 text-red-800' :
                            'bg-yellow-50 text-yellow-800'
                          }`}>
                            <span className="font-medium">Soal {i + 1}:</span> {a.questionText?.substring(0, 60)}...
                            <span className="ml-2">→ Jawaban: <span className="font-medium">{a.answer || '(kosong)'}</span></span>
                            {isEssay && (
                              <span className="ml-2 font-semibold">
                                [Essay: Nilai {a.score ?? 0}/100{a.feedback ? ` - ${a.feedback}` : ''}]
                              </span>
                            )}
                            {!isEssay && a.isCorrect === true && ' ✓'}
                            {!isEssay && a.isCorrect === false && ` ✗ (Benar: ${a.correctAnswer})`}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
