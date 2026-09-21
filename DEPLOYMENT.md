# Deployment GitHub + Vercel

Gunakan satu repository GitHub dan buat dua project Vercel dari repository yang sama.

## 1. Project API

1. Import repository ke Vercel dan pilih **Root Directory: `backend`**.
2. Framework preset akan mengikuti `backend/vercel.json` (`fastapi`).
3. Isi Environment Variables untuk Preview dan Production:
   - `EMERGENT_LLM_KEY`: kunci OCR Gemini.
   - `CORS_ORIGINS`: domain frontend, misalnya `https://autoplot-lab.vercel.app`.
   - `APP_TZ`: `Asia/Jakarta`.
4. Deploy lalu verifikasi `https://<domain-api>/api/` menghasilkan `status: ready`.

## 2. Project antarmuka

1. Import repository yang sama sebagai project kedua dan pilih **Root Directory: `frontend`**.
2. Framework preset: Vite. Build command: `yarn build`. Output: `dist`.
3. Isi `API_URL` dengan origin project API tanpa trailing slash, misalnya `https://autoplot-lab-api.vercel.app`.
4. `proxy.ts` meneruskan request browser `/api/*` ke project API sehingga aplikasi tetap memakai endpoint relatif.
5. Deploy dan pastikan upload file, AutoPlot, serta unduhan XLSX berfungsi pada Preview dan Production.

## Catatan operasi

- File sumber hanya berada di scratch space sementara selama OCR dan selalu dihapus setelah permintaan selesai.
- Riwayat, cache ekstraksi, dan XLSX berada di IndexedDB browser; tidak ada database server.
- Domain frontend harus tetap sama agar riwayat browser tidak berpindah origin.
- Jangan commit `.env`; gunakan `.env.example` sebagai daftar variabel tanpa nilai rahasia.