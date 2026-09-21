# Rencana Perubahan AutoPlot Lab

## Tujuan

Menyederhanakan AutoPlot Lab menjadi antarmuka administrasi UKM/laboratorium yang bersih, ringan, dan fokus pada alur kerja utama: upload jadwal, koreksi hasil pembacaan, atur plotting, periksa hasil, lalu unduh spreadsheet. Identitas visual tetap milik AutoPlot Lab; situs ENT PENS hanya menjadi referensi palet dan nuansa.

## Format nama file

- Format baru menggantikan format lama menjadi `KODENAMA_DIVISI_ANGKATAN`, diikuti ekstensi file.
- Contoh valid: `VAL_CW_21.pdf`, `VAL_CW_21.png`, dan `VAL_CW_21.jpg`.
- `VAL` dibaca sebagai kode anggota, `CW` sebagai kode divisi, dan `21` sebagai angkatan.
- Kode anggota dan divisi menerima huruf kapital serta angka tanpa spasi. Angkatan wajib dua digit.
- Nama file dengan bagian kurang, bagian berlebih, spasi, atau angkatan nonnumerik ditolak dengan pesan yang menyebutkan pola benar beserta contoh.
- Kode divisi disimpan sebagaimana tertulis pada nama file; tidak ada penerjemahan otomatis seperti `CW` menjadi nama panjang divisi.
- Hanya delapan kode divisi yang dianggap valid: `RP`, `FG`, `VG`, `CW`, `IL`, `WM`, `PK`, dan `DG`. Kode lain ditandai sebagai tidak valid sebelum OCR dijalankan.
- Angkatan ditampilkan pada area review anggota dan disertakan dalam hasil plotting serta spreadsheet agar identitas anggota tidak kehilangan konteks.

## Penyederhanaan alur halaman

- Tombol **Data contoh** dihapus sepenuhnya dari kartu antrian file.
- Area upload dan antrian file tetap menjadi pintu masuk utama. Antrian hanya menampilkan informasi yang berguna: nama file, status validasi nama, ukuran file, dan aksi hapus.
- Hero dipadatkan menjadi judul utama dan satu kalimat penjelas. Kicker, angka statistik, grid dekoratif, badge status mesin, dan elemen promosi dihapus.
- Sidebar workflow dan kartu “Tech stack” dihapus. Tahapan kerja ditampilkan sebagai penanda langkah horizontal yang ringkas dan hanya berfungsi sebagai orientasi pengguna.
- Label tahap, bantuan format file, status proses, error, dan tombol aksi tetap dipertahankan karena mendukung penyelesaian tugas.
- Dekorasi besar, animasi berulang, ikon berlebih, bayangan berat, latar berpola, serta informasi teknis yang tidak diperlukan pengguna administrasi dihilangkan.
- Setiap bagian hanya memiliki satu aksi utama yang jelas: Ekstrak, Simpan Koreksi, Jalankan AutoPlot, dan Unduh Spreadsheet.

## Arah visual

- Tampilan berubah dari dark dashboard menjadi antarmuka terang yang terasa formal, rapi, dan sesuai aplikasi administrasi lab UKM.
- Palet referensi ENT PENS digunakan secara terbatas:
  - Navy utama `#134679` untuk header, tombol utama, judul penting, dan status aktif.
  - Biru pendukung `#226DB8` untuk fokus, tautan, dan indikator proses.
  - Teal digunakan hemat untuk status berhasil dan coverage lengkap.
  - Latar abu-biru sangat muda, panel putih, teks abu gelap, dan border tipis menjadi fondasi halaman.
- Tidak menggunakan gradient mencolok, glassmorphism, ilustrasi stok, ornamen abstrak, atau kombinasi warna yang memberi kesan “AI-generated”.
- Tipografi menggunakan sans-serif netral dengan hierarki jelas: judul tegas tetapi tidak terlalu besar, label ringkas, dan data kode/jam memakai gaya monospace seperlunya.
- Card dibuat datar dengan radius kecil, border halus, jarak konsisten, dan bayangan minimal. Tombol memakai bentuk administratif yang tegas, bukan pill besar.
- Divisi tetap dapat dibedakan dengan badge, tetapi warna badge dibuat lembut dan tidak mengalahkan informasi utama.

## Penataan setiap area kerja

### Upload dan antrian

- Area pilih file dibuat kompak dan berada dekat dengan petunjuk pola `VAL_CW_21`.
- File valid langsung menampilkan tiga hasil parsing: kode nama, divisi, dan angkatan.
- File tidak valid ditandai pada baris yang sama tanpa menutupi seluruh halaman.
- File baru dapat terus ditambahkan ke batch aktif selama belum ada duplikat nama atau isi. Jika ditemukan duplikat, pengguna memilih mempertahankan file lama atau menggantinya; tidak ada penggantian otomatis.
- Tombol ekstraksi menjadi satu-satunya aksi utama pada area ini.

### Review jadwal

- Identitas anggota diringkas menjadi kode, divisi, angkatan, sumber file, dan tingkat keyakinan OCR.
- Editor jadwal tetap mendukung perubahan hari, jam, dan mata kuliah serta penambahan/penghapusan baris.
- Informasi OCR yang tidak membutuhkan tindakan disederhanakan agar tabel jadwal menjadi fokus.

### Aturan dan plotting

- Durasi shift, jam operasional, dan hari aktif disusun dalam satu form ringkas.
- Penjelasan aturan hanya memuat dua hal inti: tidak boleh bentrok kuliah dan semua divisi harus terwakili pada hari yang diplot.
- Hasil coverage menggunakan indikator status sederhana, diikuti tabel assignment yang mudah dipindai.
- Validasi sukses tidak diulang berlebihan; ringkasan status ditampilkan sekali, sedangkan detail hanya muncul untuk peringatan atau error.

### Ekspor

- Area ekspor dipadatkan menjadi ringkasan jumlah shift, kelengkapan delapan divisi, status validasi, dan tombol unduh.
- Spreadsheet tetap memiliki sheet plotting utama dan sheet validasi/error, dengan tambahan kolom angkatan dan identitas batch.
- File XLSX dibuat hanya ketika pengguna menekan Unduh. Setelah selesai dibuat, file dikirim langsung ke browser dan disimpan pada riwayat lokal batch tersebut.

## Logika dan batas minimum ekspor spreadsheet

- Tidak ada minimum berdasarkan ukuran file. Batasnya ditentukan oleh kelengkapan data.
- Karena satu file mewakili satu anggota dan satu divisi, minimum praktis adalah **8 file valid**: setidaknya satu file untuk masing-masing `RP`, `FG`, `VG`, `CW`, `IL`, `WM`, `PK`, dan `DG`.
- Batch boleh berisi lebih dari delapan file dan boleh memiliki beberapa anggota dalam divisi yang sama.
- Tombol AutoPlot tetap dapat digunakan untuk melihat masalah batch, tetapi status batch dinyatakan belum lengkap bila ada divisi wajib yang belum memiliki anggota.
- Spreadsheet final hanya dapat diekspor jika:
  1. seluruh delapan divisi tersedia dalam batch;
  2. hasil OCR sudah direview dan tidak memiliki jadwal dengan jam yang tidak valid;
  3. minimal satu hari berhasil memuat kedelapan divisi tanpa bentrok jadwal kuliah; dan
  4. hasil plotting terbaru masih sesuai dengan isi batch aktif.
- Hari yang gagal memenuhi delapan divisi tidak menghasilkan assignment parsial. Hari tersebut dicatat pada sheet validasi/error.
- Jika tidak ada satu pun hari yang memenuhi aturan, ekspor diblokir dan alasan kegagalan ditampilkan di halaman.

## Temporary storage di server

- Server hanya menggunakan ruang sementara selama satu file diproses atau satu spreadsheet dibuat.
- Setiap file diberi ruang sementara yang terisolasi per permintaan dan selalu dihapus setelah OCR selesai, termasuk ketika proses gagal atau dibatalkan.
- PDF/PNG/JPG asli tidak menjadi arsip server dan tidak dimasukkan ke riwayat browser.
- Spreadsheet dibuat di memori atau ruang sementara, dikirim langsung ke browser, lalu salinan server dihapus.
- Upload diproses per file, bukan menahan seluruh batch dalam memori server. Hasil setiap file langsung dikembalikan dan ditambahkan ke batch aktif sehingga kegagalan satu file tidak mengulang file lain.
- Batas tetap dipertahankan pada 12 MB per file dan 20 file per sekali pemilihan untuk mencegah lonjakan resource. Batch aktif dapat ditambah melalui pemilihan berikutnya.

## Riwayat dan cache di browser

- Browser menyimpan maksimal 20 batch terbaru tanpa akun dan tanpa sinkronisasi lintas perangkat.
- Setiap riwayat menyimpan identitas batch, waktu pembuatan, daftar anggota, hasil ekstraksi, hasil review, konfigurasi plotting, hasil plotting, log validasi, dan file XLSX terakhir.
- File sumber PDF/PNG/JPG tidak disimpan setelah proses selesai untuk mengurangi penggunaan ruang dan risiko privasi.
- Riwayat menampilkan status lengkap/belum lengkap, jumlah anggota, coverage divisi, waktu terakhir diperbarui, serta aksi buka kembali, unduh XLSX, dan hapus.
- Membuka riwayat tidak menghapus batch aktif. Jika ada pekerjaan aktif yang belum tersimpan, pengguna diminta memilih menyimpannya sebagai riwayat atau membatalkan perpindahan.
- Saat jumlah riwayat mencapai 20, tidak ada data yang dihapus diam-diam. Pengguna memilih menghapus batch tertentu atau mengganti batch tertua sebelum batch baru disimpan.
- Penggunaan kuota browser dipantau. Peringatan muncul sebelum kuota mendekati penuh dan menunjukkan batch/file XLSX yang paling banyak memakai ruang.
- Hash isi file digunakan untuk mengenali upload yang pernah diproses. Jika hasil ekstraksi yang sama masih ada di cache, pengguna dapat memakai ulang hasil tersebut tanpa membayar proses OCR kedua kali.
- Jika penyimpanan browser dibersihkan oleh pengguna/perangkat, riwayat lokal ikut hilang. Hal ini dijelaskan secara singkat pada area riwayat.

## Tombol Clear / Batch Baru

- Tombol diberi label **Batch Baru / Clear** dan selalu membuka dialog; tidak pernah langsung menghapus data.
- Dialog menyediakan tiga pilihan:
  1. **Bersihkan batch aktif** — menghapus antrian, hasil OCR, koreksi, hasil plotting, dan spreadsheet yang belum disimpan, tetapi mempertahankan seluruh riwayat;
  2. **Bersihkan batch aktif dan semua riwayat** — menghapus seluruh cache AutoPlot Lab setelah konfirmasi kedua; atau
  3. **Batal** — tidak mengubah apa pun.
- Penghapusan semua riwayat membutuhkan konfirmasi eksplisit dan menampilkan jumlah batch serta file XLSX yang akan hilang.
- Daftar kode divisi wajib dan preferensi tampilan tidak ikut terhapus oleh pembersihan batch.
- Setiap item riwayat juga memiliki aksi hapus tersendiri agar pengguna tidak harus membersihkan semuanya.

## Optimasi resource dan biaya operasional

- OCR hanya dijalankan untuk file baru atau file yang isinya berubah. File identik menggunakan kembali hasil ekstraksi lokal setelah persetujuan pengguna.
- Proses OCR dilakukan per file agar dapat dilanjutkan, dicoba ulang secara selektif, dan tidak mengulang satu batch penuh ketika satu dokumen gagal.
- Tidak ada penyimpanan file permanen, worker yang selalu aktif, atau database server tambahan untuk riwayat browser-local.
- Spreadsheet hanya dibuat saat diminta dan hasil yang sama dapat diunduh ulang dari cache browser tanpa meminta server membuat ulang.
- Payload ke server hanya memuat data yang diperlukan untuk operasi aktif; file sumber tidak dikirim ulang saat review, plotting, atau ekspor.
- Permintaan paralel dibatasi agar lonjakan upload tidak menghabiskan memori atau memicu banyak OCR berbayar sekaligus.
- Status proses per file memungkinkan pengguna membatalkan sisa antrian tanpa membatalkan file yang sudah selesai.
- Kegagalan jaringan dapat dilanjutkan dari file terakhir yang belum selesai, bukan memulai ulang seluruh batch.

## Deployment melalui GitHub dan Vercel

- Satu repository GitHub digunakan untuk dua project Vercel yang terpisah: satu project antarmuka dan satu project API.
- Kedua project menunjuk ke folder root masing-masing dan dapat membuat preview deployment dari branch/pull request yang sama.
- Project antarmuka meneruskan path `/api` ke URL project API agar browser tetap memakai satu pola endpoint dan konfigurasi CORS tetap sederhana.
- Project API menyediakan entrypoint FastAPI yang dikenali Vercel dan menggunakan `/tmp` hanya sebagai scratch space. Proses satu file dirancang tetap jauh di bawah batas scratch space Vercel 500 MB.
- OCR per file menjaga durasi setiap function tetap terukur dan tidak menahan satu function untuk seluruh batch. Durasi maksimum dikonfigurasi secukupnya, bukan dinaikkan tanpa batas.
- Kunci OCR dan URL origin tidak ditaruh di repository. Template environment variables menjelaskan nilai yang harus diisi pada project API dan antarmuka.
- Dokumentasi deployment mencakup: menghubungkan repository, memilih root directory untuk masing-masing project, mengisi environment variables, menetapkan domain API pada rewrite, dan memverifikasi preview serta production deployment.
- Dependency produksi dibuat minimal agar bundle function kecil, cold start lebih cepat, dan tidak membawa layanan database yang tidak dipakai oleh alur browser-local.
- Riwayat tetap berada di browser yang sama walaupun deployment server berganti, selama domain antarmuka tidak berubah dan pengguna tidak membersihkan data situs.

## Batas perubahan

- Integrasi Resend tidak termasuk dalam perubahan ini dan ditunda.
- Kemampuan OCR, review, AutoPlot, dan ekspor tetap dipertahankan.
- Aturan solver diperketat agar hari yang diplot wajib memuat seluruh `RP`, `FG`, `VG`, `CW`, `IL`, `WM`, `PK`, dan `DG`, serta membawa informasi angkatan ke hasil.
- Tidak ada aset, logo, teks, atau struktur halaman ENT PENS yang disalin; hanya palet warna dan nuansa institusional yang dijadikan referensi.

## Asumsi yang perlu diperhatikan

- Format lama dua bagian seperti `AHL_FRONTEND.pdf` tidak lagi dianggap valid.
- Angkatan selalu ditulis dua digit, misalnya `21`, bukan `2021`.
- Satu file tetap mewakili satu anggota dan satu divisi.
- Delapan kode divisi sudah dipahami oleh pengurus lab sehingga belum memerlukan nama panjang divisi.
- Riwayat lokal tidak dianggap sebagai backup permanen; kehilangan data browser tidak dapat dipulihkan dari server.