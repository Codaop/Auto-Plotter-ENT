# AutoPlot Lab — Living Specification

## Purpose
Prototype end-to-end untuk mengubah PDF/PNG/JPG jadwal kuliah anggota lab menjadi plot absensi bebas bentrok dan spreadsheet XLSX.

## Core flow
1. Pengguna mengunggah hingga 20 file per pemilihan, maksimal 12 MB/file, dengan nama `KODENAMA_DIVISI_ANGKATAN.pdf|png|jpg|jpeg`, misalnya `VAL_CW_21.pdf`.
2. Divisi wajib adalah `RP`, `FG`, `VG`, `CW`, `IL`, `WM`, `PK`, dan `DG`. Gemini 3 Flash Preview memproses setiap file baru secara berurutan; hasil identik dapat digunakan ulang dari cache hash lokal.
3. Pengguna mereview serta mengoreksi kode, divisi, hari, jam, dan mata kuliah.
4. AutoPlot memilih satu slot bebas untuk seluruh delapan divisi pada setiap hari aktif. Jika satu divisi tidak tersedia atau tidak memiliki slot, hari tersebut tidak menghasilkan assignment parsial.
5. Ekspor hanya aktif setelah review disimpan, jam valid, delapan divisi tersedia, sedikitnya satu hari lengkap, dan plot masih sesuai batch aktif.
6. Browser menyimpan maksimal 20 batch, cache hasil ekstraksi berbasis SHA-256, dan XLSX terakhir di IndexedDB; file sumber tidak disimpan.

## Data model
- `MemberSchedule`: kode, divisi, angkatan dua digit, sumber file, confidence, catatan OCR, dan daftar `ClassSlot`.
- `ClassSlot`: hari, jam mulai, jam selesai, mata kuliah.
- `PlotConfig`: durasi shift, jam operasional, hari aktif.
- `PlotResponse`: assignment beserta angkatan, validasi, delapan divisi wajib, divisi hilang, coverage, hari lengkap, status ekspor, dan waktu pembuatan.

## Key API routes
- `POST /api/roster/extract`
- `POST /api/roster/plot`
- `POST /api/roster/export`

## Authentication
Belum ada autentikasi pada prototype ini.

## Deployment
Satu repository mendukung dua project Vercel dengan root `frontend` dan `backend`. Frontend mempertahankan path relatif `/api` melalui Routing Middleware dan variabel `API_URL`. Detail ada di `DEPLOYMENT.md`.

## Mobile navigation
- Header mobile hanya memuat identitas AutoPlot Lab dan tombol `Riwayat (n)`.
- Tombol `Batch Baru / Clear` berada di area kontrol upload bersama `Tambah file`, bukan di navbar, agar tidak menyebabkan overflow dan tetap dekat dengan awal batch.