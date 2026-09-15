# RuangKuis - Platform Kuis & Ujian Online

Website kuis full-stack yang menggunakan **Gemini** untuk membuat soal secara otomatis dari materi PDF/Word.

## Fitur
- 🤖 **Generate Soal Otomatis** — Upload PDF/DOCX → Gemini membuat soal otomatis
- 📝 **3 Tipe Soal** — Pilihan Ganda, Benar/Salah, Essay
- ⏱️ **Timer Kuis** — Dapat diatur oleh admin, auto-submit saat habis
- 👤 **Auth Lengkap** — Register & login user, login admin
- 📊 **Hasil Detail** — Skor, jawaban benar/salah, penjelasan
- ✏️ **Edit Soal** — Admin bisa edit/hapus/tambah soal manual
- 🔄 **Regenerasi** — Generate ulang soal dari materi yang sama

---

## Cara Setup

### 1. Dapatkan Gemini API Key (Gratis)
1. Buka https://aistudio.google.com
2. Login dengan akun Google
3. Klik **"Get API key"** → Create API key
4. Copy API key tersebut

### 2. Setup Backend
```powershell
cd quiz-app\backend

# Edit file .env dan isi API key
notepad .env
```

Isi file `.env`:
```env
GEMINI_API_KEY=AIza...paste_key_anda_disini...
JWT_SECRET=ganti_dengan_string_random_panjang
ADMIN_PASSWORD=password_admin_anda
PORT=5000
```

Jalankan backend:
```powershell
npm run dev
```

### 3. Setup Frontend
```powershell
cd quiz-app\frontend
npm run dev
```

### 4. Buka Browser
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000

---

## Cara Pakai

### Sebagai Admin
1. Buka http://localhost:5173 → **Masuk sebagai Admin**
2. Masukkan password (dari `.env` `ADMIN_PASSWORD`, default: `admin123`)
3. Klik **"Buat Kuis Baru"**
4. Isi judul, upload file PDF/DOCX (materi)
5. Atur jumlah soal (default 30), timer, kesulitan, tipe soal
6. Klik **"Generate Soal Otomatis"** — tunggu 30-60 detik
7. Review dan edit soal jika perlu
8. Klik ikon ✓ untuk **Publikasikan** kuis

### Sebagai Peserta
1. Buka http://localhost:5173 → **Daftar** akun baru
2. Pilih kuis yang tersedia
3. Jawab soal (timer berjalan jika diaktifkan)
4. **Kumpulkan** jawaban → lihat skor dan pembahasan

---

## Struktur Proyek
```
quiz-app/
├── backend/
│   ├── .env                  # Konfigurasi (GEMINI_API_KEY dll)
│   ├── server.js             # Express server
│   ├── db.js                 # SQLite database
│   ├── middleware/auth.js    # JWT middleware
│   ├── routes/
│   │   ├── auth.js           # Register, login
│   │   ├── admin.js          # Admin CRUD quiz
│   │   └── quiz.js           # User ambil & submit kuis
│   └── services/
│       ├── fileParser.js     # Parse PDF & Word
│       └── aiService.js      # Gemini - generate soal
└── frontend/
    └── src/
        ├── pages/
        │   ├── Landing.jsx
        │   ├── auth/         # Login, Register, Admin Login
        │   ├── admin/        # Dashboard, Quiz Detail, Results
        │   └── user/         # Quiz List, Quiz Page, Result
        └── contexts/
            └── AuthContext.jsx
```

---

## API Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | /api/auth/register | Daftar user |
| POST | /api/auth/login | Login user |
| POST | /api/auth/admin/login | Login admin |
| GET | /api/quiz | Daftar kuis dipublikasi |
| GET | /api/quiz/:id | Detail kuis (tanpa jawaban) |
| POST | /api/quiz/:id/submit | Submit jawaban |
| GET | /api/quiz/submissions/my | Riwayat kuis user |
| GET | /api/admin/quizzes | Semua kuis (admin) |
| POST | /api/admin/quizzes | Buat kuis baru + generate soal otomatis |
| POST | /api/admin/quizzes/:id/publish | Toggle publish |
| POST | /api/admin/quizzes/:id/regenerate | Regenerasi soal |
| GET | /api/admin/quizzes/:id/results | Hasil peserta |
