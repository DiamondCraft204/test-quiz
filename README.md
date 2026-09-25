# RuangKuis - Platform Kuis & Ujian Online

Platform kuis full-stack yang dapat membuat soal kuis otomatis dari materi PDF/Word, mendukung penyimpanan cloud di **Supabase (PostgreSQL)** dan deployment di **Vercel**.

- **Frontend**: https://ruangkuis-frontend.vercel.app/
- **Backend API**: https://ruangkuis-backend.vercel.app/

---

## 🛠️ Stack Teknologi
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Axios
- **Backend**: Node.js, Express, Vercel Serverless Function
- **Database**: PostgreSQL di Supabase (via driver `pg`)
- **AI Service**: Google Gemini API (`gemini-flash-latest`)
- **File Parsing**: `pdf-parse` (PDF) dan `mammoth` (Word .docx/.doc)

---

## 🚀 Konfigurasi Environment Variables di Vercel

### 1. Backend (`ruangkuis-backend`)
Tambahkan di menu **Project Settings** → **Environment Variables**:

| Variable | Nilai |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` |
| `GEMINI_API_KEY` | *(Gemini API Key Anda)* |
| `ADMIN_PASSWORD` | `admin123` *(atau password admin pilihan Anda)* |
| `JWT_SECRET` | `kuis_ai_secret_super_secure_key_2026_xyz` |

### 2. Frontend (`ruangkuis-frontend`)
*(Opsional karena sudah default ke backend Vercel)*:
| Variable | Nilai |
|---|---|
| `VITE_API_URL` | `https://ruangkuis-backend.vercel.app/api` |

---

## 💻 Menjalankan Secara Lokal (Opsional)

1. Buka folder backend dan pasang `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:password@localhost:5432/ruangkuis
   GEMINI_API_KEY=AIzaSy...
   ADMIN_PASSWORD=admin123
   JWT_SECRET=kuis_ai_secret_super_secure_key_2026_xyz
   PORT=5000
   ```
2. Jalankan backend:
   ```bash
   cd backend
   npm start
   ```
3. Jalankan frontend:
   ```bash
   cd frontend
   npm run dev
   ```
