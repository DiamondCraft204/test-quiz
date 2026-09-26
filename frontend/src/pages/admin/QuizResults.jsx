import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../../api/axios'
import { ArrowLeft, GraduationCap, Loader2, Users, Trophy, Clock, TrendingUp, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'

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
              let answers = Array.isArray(sub.answers) ? sub.answers : []
              if (!answers.length && typeof sub.answers === 'string') {
                try { answers = JSON.parse(sub.answers) || [] } catch { answers = [] }
              }
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
                        {sub.cheat_violations > 0 && (
                          <div className="text-xs text-red-600 font-semibold mt-0.5">
                            Curang: {sub.cheat_violations}x (-{sub.cheat_violations * 5} poin)
                          </div>
                        )}
                      </div>
                      <div className="w-32">
                        <ScoreBar score={sub.score || 0} />
                      </div>
                      {expanded === sub.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                  {expanded === sub.id && answers.length > 0 && (
                    <div className="border-t p-4 md:p-6 bg-slate-50 space-y-4">
                      <div className="flex items-center justify-between border-b pb-3">
                        <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-indigo-600" />
                          Rincian Jawaban & Nilai Tiap Soal ({answers.length} Soal)
                        </div>
                        <div className="text-xs text-gray-500">
                          Total Nilai: <span className="font-bold text-gray-800">{sub.score?.toFixed(1)}%</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {answers.map((a, i) => {
                          const isEssay = a.questionType === 'essay';
                          const qScore = a.score !== undefined ? a.score : (a.isCorrect ? 100 : 0);

                          let scoreBadge = {
                            bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                            label: '100/100 (Sempurna)'
                          };
                          if (qScore === 100) {
                            scoreBadge = { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: '100/100 (Sempurna)' };
                          } else if (qScore >= 70) {
                            scoreBadge = { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: `${qScore}/100 (Mendekati)` };
                          } else if (qScore >= 10) {
                            scoreBadge = { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: `${qScore}/100 (Kurang)` };
                          } else if (qScore > 0) {
                            scoreBadge = { bg: 'bg-orange-100 text-orange-800 border-orange-300', label: `${qScore}/100 (Apa Adanya)` };
                          } else {
                            scoreBadge = { bg: 'bg-red-100 text-red-800 border-red-300', label: '0/100 (Salah/Kosong)' };
                          }

                          const typeBadge = isEssay ? 'Essay' : a.questionType === 'benar_salah' ? 'Benar / Salah' : 'Pilihan Ganda';

                          return (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
                              {/* Header: Soal #, Type, and Nilai */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-100">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900 text-sm">Soal {i + 1}</span>
                                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600">
                                    {typeBadge}
                                  </span>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${scoreBadge.bg}`}>
                                  Nilai: {scoreBadge.label}
                                </span>
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

                              {/* Evaluasi / Feedback if essay */}
                              {isEssay && a.feedback && (
                                <div className="mt-2.5 p-2.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                                  <span className="font-bold">💬 Catatan Evaluasi AI:</span> {a.feedback}
                                </div>
                              )}

                              {/* Explanation if exists */}
                              {a.explanation && !isEssay && (
                                <div className="mt-2.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-900 text-xs">
                                  <span className="font-bold">💡 Pembahasan:</span> {a.explanation}
                                </div>
                              )}
                            </div>
                          );
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
    </div>
  )
}
