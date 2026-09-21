# AutoPlot Lab — Living Specification

## Purpose
Prototype end-to-end untuk mengubah PDF/PNG/JPG jadwal kuliah anggota lab menjadi plot absensi bebas bentrok dan spreadsheet XLSX.

## Core flow
1. Pengguna mengunggah hingga 20 file, maksimal 12 MB/file, dengan nama `KODENAMA_DIVISI.pdf|png|jpg|jpeg`.
2. Gemini 3 Flash Preview mengekstrak jadwal menjadi JSON. Kode dan divisi selalu diambil dari nama file.
3. Pengguna mereview serta mengoreksi kode, divisi, hari, jam, dan mata kuliah.
4. AutoPlot memilih satu slot bebas per divisi untuk setiap hari aktif. Jika satu divisi tidak memiliki slot, seluruh hari tersebut tidak diplot.
5. Pengguna mengunduh XLSX dengan sheet `Plotting Utama` dan `Validasi & Error`.

## Data model
- `MemberSchedule`: kode, divisi, sumber file, confidence, catatan OCR, dan daftar `ClassSlot`.
- `ClassSlot`: hari, jam mulai, jam selesai, mata kuliah.
- `PlotConfig`: durasi shift, jam operasional, hari aktif.
- `PlotResponse`: assignment, validasi, daftar divisi, coverage per hari, waktu pembuatan.

## Key API routes
- `POST /api/roster/extract`
- `GET /api/roster/sample`
- `POST /api/roster/plot`
- `POST /api/roster/export`

## Authentication
Belum ada autentikasi pada prototype ini.