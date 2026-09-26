import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../api/axios'
import { GraduationCap, LogOut, BookOpen, Clock, ChevronRight, CheckCircle, Loader2, Trophy } from 'lucide-react'

const DIFF_COLORS = { mudah: 'text-green-600 bg-green-50', sedang: 'text-blue-600 bg-blue-50', sulit: 'text-red-600 bg-red-50' }

export default function QuizList() {
  const [quizzes, setQuizzes] = useState([])
  const [mySubmissions, setMySubmissions] = useState([])
  const [filterTab, setFilterTab] = useState('all') // 'all', 'unanswered', 'completed'
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

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    logout()
    navigate('/login')
  }

  const getSubmission = (quizId) => mySubmissions.find(s => s.quiz_id === quizId)

  const completed = quizzes.filter(q => !!getSubmission(q.id))
  const unanswered = quizzes.filter(q => !getSubmission(q.id))
  const displayedQuizzes = filterTab === 'unanswered' ? unanswered : filterTab === 'completed' ? completed : quizzes

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Selamat Datang, {user?.name}! 👋</h1>
          <p className="text-gray-500 mt-1">Pilih kuis yang ingin kamu ikuti atau tinjau kuis yang sudah selesai.</p>
        </div>

        {/* Menu Tab: Semua, Belum Dikerjakan, Sudah Dikerjakan */}
        <div className="flex border-b border-gray-200 mb-6 gap-2">
          <button
            onClick={() => setFilterTab('all')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              filterTab === 'all'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Semua Kuis
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{quizzes.length}</span>
          </button>
          <button
            onClick={() => setFilterTab('unanswered')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              filterTab === 'unanswered'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Belum Dikerjakan
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{unanswered.length}</span>
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`pb-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              filterTab === 'completed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Sudah Dikerjakan
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{completed.length}</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : displayedQuizzes.length === 0 ? (
          <div className="bg-white rounded-2xl border shadow-sm p-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">
              {filterTab === 'completed' ? 'Belum ada kuis yang selesai' : filterTab === 'unanswered' ? 'Semua kuis sudah dikerjakan!' : 'Belum ada kuis'}
            </h3>
            <p className="text-gray-400 text-sm">
              {filterTab === 'completed' ? 'Kuis yang kamu selesaikan akan muncul di sini.' : 'Silakan tunggu kuis baru dari admin.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {displayedQuizzes.map(quiz => {
              const submission = getSubmission(quiz.id)
              return (
                <div key={quiz.id}
                  className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-gray-800 leading-tight">{quiz.title}</h2>
                        {quiz.description && <p className="text-gray-500 text-sm mt-1 line-clamp-2">{quiz.description}</p>}
                      </div>
                      {submission && (
                        <span className="ml-2 flex-shrink-0 bg-green-50 text-green-600 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 border border-green-200">
                          <CheckCircle className="w-3.5 h-3.5" /> Selesai
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
                    </div>
                    {submission && (
                      <div className="mt-4 flex items-center gap-2 bg-indigo-50 rounded-xl px-3.5 py-2.5 border border-indigo-100">
                        <Trophy className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm text-indigo-700">Skor kamu: <span className="font-bold text-indigo-900">{submission.score?.toFixed(1)}%</span></span>
                      </div>
                    )}
                  </div>
                  <div className="border-t px-6 py-3.5 bg-gray-50">
                    {submission ? (
                      <button onClick={() => navigate(`/quiz/${quiz.id}/result/${submission.id}`)}
                        className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition border border-emerald-200">
                        <CheckCircle className="w-4 h-4" /> Lihat Pembahasan & Hasil
                      </button>
                    ) : (
                      <button onClick={() => navigate(`/quiz/${quiz.id}`)}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5 transition shadow-sm">
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
