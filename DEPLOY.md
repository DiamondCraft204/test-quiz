# Deploy RuangKuis ke Vercel (Gratis)

Aplikasi ini di-deploy sebagai **2 project Vercel terpisah** dalam 1 repo:
- **Backend** (folder `backend/`) → jadi 1 Vercel Function (Express) yang isinya API (`/api/...`)
- **Frontend** (folder `frontend/`) → jadi static site (React + Vite)

Kenapa dipisah? Karena Vercel adalah platform *serverless* — tidak ada disk permanen. Backend project ini tadinya pakai SQLite (file database), yang sudah diubah supaya pakai **Turso** (database SQLite yang di-hosting di cloud, gratis) supaya data (user, kuis, hasil) tidak hilang setiap function-nya "tidur" atau pindah server. Kedua project tetap 100% jalan di Vercel, tidak perlu Railway/Render.

---

## 0. Push project ini ke GitHub
Vercel deploy langsung dari repo Git. Buat repo baru di GitHub, lalu:
```bash
cd quiz-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/quiz-app.git
git push -u origin main
```
(`node_modules`, `.env`, dan `dist` sudah otomatis diabaikan lewat `.gitignore` yang sudah ada.)

---

## 1. Bikin database Turso (gratis)

Install Turso CLI:
```bash
# macOS
brew install tursodatabase/tap/turso

# Linux / WSL
curl -sSfL https://get.tur.so/install.sh | bash
```

Login & buat database:
```bash
turso auth login
turso db create ruangkuis
```

Ambil URL & token-nya (dua command ini hasilnya akan dipakai di langkah 3):
```bash
turso db show ruangkuis --url
turso db tokens create ruangkuis
```
Simpan dulu kedua hasilnya (URL diawali `libsql://...`, token string panjang) — nanti dipakai sebagai environment variable di Vercel.

> Kalau nanti Turso mengubah tampilan/CLI-nya, cek dokumentasi resmi mereka di docs.turso.tech — konsepnya tetap sama: kamu butuh sebuah **database URL** dan **auth token**.

---

## 2. Deploy Backend ke Vercel

1. Buka https://vercel.com/new, pilih repo GitHub project ini.
2. Saat konfigurasi **"Root Directory"**, pilih folder **`backend`**.
3. Framework Preset biarkan default (Vercel otomatis mendeteksi ini sebagai Express app / Node).
4. Di bagian **Environment Variables**, tambahkan:
   | Key | Value |
   |---|---|
   | `GEMINI_API_KEY` | API key Gemini kamu |
   | `JWT_SECRET` | string acak yang panjang, bebas (jangan dikosongkan) |
   | `ADMIN_PASSWORD` | password login admin yang kamu mau |
   | `TURSO_DATABASE_URL` | hasil `turso db show ruangkuis --url` |
   | `TURSO_AUTH_TOKEN` | hasil `turso db tokens create ruangkuis` |
5. Klik **Deploy**.
6. Setelah selesai, catat URL-nya, misal: `https://ruangkuis-backend.vercel.app`. Cek berhasil dengan buka `https://ruangkuis-backend.vercel.app/api/health` di browser — harusnya muncul `{"success":true,...}`.

---

## 3. Deploy Frontend ke Vercel

1. Buka https://vercel.com/new lagi, import repo yang sama (jadi project Vercel kedua).
2. Root Directory pilih folder **`frontend`**.
3. Framework Preset: **Vite** (biasanya otomatis terdeteksi).
4. Environment Variables, tambahkan satu:
   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://ruangkuis-backend.vercel.app/api` (pakai URL backend dari langkah 2, jangan lupa akhiran `/api`) |
5. Klik **Deploy**.
6. Selesai — buka URL frontend-nya (misal `https://ruangkuis.vercel.app`), coba register, login, dan buat kuis dari sisi admin.

---

## 4. Setelah deploy — hal yang perlu diingat

- **Ganti nama project Vercel** kalau mau URL yang lebih rapi (Project Settings → General → Project Name), lalu update `VITE_API_URL` di frontend kalau URL backend berubah, dan redeploy frontend-nya.
- **Redeploy otomatis**: setiap kali kamu `git push` ke branch `main`, kedua project Vercel ini otomatis build ulang.
- **Password admin**: jangan pakai `admin123` di production — set `ADMIN_PASSWORD` yang kuat di environment variable backend.
- Kalau mau kembangkan lagi secara lokal, `npm run dev` di folder `backend` tetap bisa jalan tanpa Turso (otomatis pakai file `quiz.db` lokal) — isi `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` di `.env` hanya kalau mau tes langsung ke database Turso dari lokal.
