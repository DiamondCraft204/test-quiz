import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/axios'
import { GraduationCap, LogOut, BookOpen, Clock, ChevronRight, CheckCircle, Loader2, Trophy } from 'lucide-react'

const DIFF_COLORS = { mudah: 'text-green-600 bg-green-50', sedang: 'text-blue-600 bg-blue-50', sulit: 'text-red-600 bg-red-50' }

export default function QuizList() {
  const [quizzes, setQuizzes] = useState([])
  const [mySubmissions, setMySubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [qRes, sRes] = await Promise.all([
        api.get('/quiz'),
        api.get('/quiz/submissions/my'),
      ])
      setQuizzes(qRes.data.data)
      setMySubmissions(sRes.data.data)
    } catch { } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleLogout = () => { logout(); navigate('/login') }

  const getSubmission = (quizId) => mySubmissions.find(s => s.quiz_id === quizId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <GraduationCap className="w-6 h-6" /> RuangKuis
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm font-medium hidden sm:block">👋 {user?.name}</span>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 transition text-sm">
              <LogOut className="w-4 h-4" /> Keluar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Selamat Datang, {user?.name}! 👋</h1>
          <p className="text-gray-500 mt-1">Pilih kuis yang ingin kamu ikuti.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">Belum ada kuis</h3>
            <p className="text-gray-400 text-sm">Kuis akan muncul di sini setelah admin mempublikasikannya.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {quizzes.map(quiz => {
              const submission = getSubmission(quiz.id)
              return (
                <div key={quiz.id}
                  className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 leading-tight">{quiz.title}</h2>
                        {quiz.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{quiz.description}</p>}
                      </div>
                      {submission && (
                        <span className="ml-2 flex-shrink-0 bg-green-50 text-green-600 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Selesai
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="flex items-center gap-1 text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                        <BookOpen className="w-3.5 h-3.5" /> {quiz.num_questions} soal
                      </span>
                      {quiz.timer_minutes && (
                        <span className="flex items-center gap-1 text-sm text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> {quiz.timer_minutes} menit
                        </span>
                      )}
                      <span className={`text-sm px-2.5 py-1 rounded-full capitalize ${DIFF_COLORS[quiz.difficulty] || 'text-gray-600 bg-gray-100'}`}>
                        {quiz.difficulty}
                      </span>
                    </div>
                    {submission && (
                      <div className="mt-3 flex items-center gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                        <Trophy className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm text-indigo-700">Skor kamu: <span className="font-bold">{submission.score?.toFixed(1)}%</span></span>
                      </div>
                    )}
                  </div>
                  <div className="border-t px-6 py-3 bg-gray-50 flex gap-2">
                    {submission ? (
                      <>
                        <button onClick={() => navigate(`/quiz/${quiz.id}/result/${submission.id}`)}
                          className="flex-1 text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-1">
                          Lihat Hasil
                        </button>
                        <button onClick={() => navigate(`/quiz/${quiz.id}`)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-1.5 rounded-lg flex items-center justify-center gap-1 transition">
                          Ulangi Kuis <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => navigate(`/quiz/${quiz.id}`)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1 transition">
                        Mulai Kuis <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
