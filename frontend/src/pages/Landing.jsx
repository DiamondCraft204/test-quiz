import { Link } from 'react-router-dom'
import { BookOpen, Users, Clock, BarChart2, ChevronRight, GraduationCap } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-700 to-purple-700">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-white text-2xl font-bold">
          <GraduationCap className="w-8 h-8 text-yellow-300" />
          RuangKuis
        </div>
        <div className="flex gap-3">
          <Link to="/login" className="px-4 py-2 text-white border border-white/30 rounded-lg hover:bg-white/10 transition">
            Masuk
          </Link>
          <Link to="/register" className="px-4 py-2 bg-white text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition">
            Daftar
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center py-20 px-4">
        <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight mb-4">
          Platform Kuis Cerdas<br />
          <span className="text-yellow-300">Otomatis dari Materi Anda</span>
        </h1>
        <p className="text-indigo-200 text-xl max-w-2xl mx-auto mb-10">
          Upload materi PDF atau Word, dan sistem akan membuat soal kuis secara otomatis dalam Bahasa Indonesia.
        </p>

        {/* CTA Cards */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-xl mx-auto">
          <Link to="/login"
            className="flex-1 bg-white text-indigo-700 rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
            <Users className="w-10 h-10 mx-auto mb-3 text-indigo-500" />
            <div className="text-xl font-bold mb-1">Masuk sebagai Peserta</div>
            <div className="text-sm text-gray-500">Ikuti kuis yang tersedia</div>
            <ChevronRight className="w-5 h-5 mx-auto mt-3 text-indigo-400" />
          </Link>
          <Link to="/admin/login"
            className="flex-1 bg-indigo-800/60 text-white border border-white/20 rounded-2xl p-6 text-center shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all backdrop-blur">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-yellow-300" />
            <div className="text-xl font-bold mb-1">Masuk sebagai Admin</div>
            <div className="text-sm text-indigo-300">Kelola kuis & materi</div>
            <ChevronRight className="w-5 h-5 mx-auto mt-3 text-indigo-300" />
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {[
          { icon: BookOpen, title: 'Pembuat Soal Otomatis', desc: 'Sistem membuat soal otomatis dari materi PDF/Word Anda dalam hitungan detik.', color: 'text-yellow-300' },
          { icon: Clock, title: 'Timer Fleksibel', desc: 'Atur durasi kuis sesuai kebutuhan. Timer otomatis submit ketika habis.', color: 'text-green-300' },
          { icon: BarChart2, title: 'Analisis Hasil', desc: 'Lihat statistik lengkap peserta: skor, waktu pengerjaan, dan jawaban detail.', color: 'text-pink-300' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-6 text-white">
            <Icon className={`w-8 h-8 mb-3 ${color}`} />
            <div className="text-lg font-bold mb-2">{title}</div>
            <div className="text-indigo-200 text-sm">{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
