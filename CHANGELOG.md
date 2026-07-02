# Changelog — ProductTrack

Format versi: **MAJOR.MINOR.PATCH**
- PATCH naik untuk perbaikan kecil (mis. 1.22.0 → 1.22.1)
- MINOR naik untuk fitur baru (mis. 1.22.0 → 1.23.0)
- MAJOR naik untuk perubahan besar/breaking

Versi terpasang ditampilkan di **sidebar** (samping logo) dan di **Dropdown Master**.
Sumber versi: konstanta `APP_VERSION` di `public/index.html`.

---

## 1.24.1 — Legend warna di Timeline & Calendar
- Tambah keterangan warna (status) di **Timeline** dan **Calendar** agar semua user (termasuk Lintas Divisi) paham arti tiap warna bar/acara. Hanya menampilkan status yang sedang tampil.

## 1.24.0 — Folder untuk Catatan Saya
- Catatan Saya kini punya **folder + pencarian** (sama seperti Link Saya): kelompokkan per folder, cari cepat, ubah nama/hapus folder (catatan pindah ke Umum), pindahkan catatan antar folder.

## 1.23.0 — Hari Ini, Catatan Saya, Laporan
- **Hari Ini**: layar fokus harian pribadi (overdue, jatuh tempo hari ini, sedang dikerjakan, due ≤3 hari).
- **Catatan Saya**: catatan pribadi per user (sheet NOTES) — tambah/edit/hapus.
- **Laporan** (manager/Dev): digest mingguan (ringkasan + per PIC + per stage) dengan **Export CSV** & Print/PDF.

## 1.22.0 — Versi aplikasi
- Tampilkan nomor versi app di sidebar & Dropdown Master.
- Tambah CHANGELOG ini (riwayat versi dari awal).

## 1.21.0 — Peran PIC vs Support
- Bedakan warna task saat jadi **PIC** (indigo) vs hanya **Support** (amber) di chart beban kerja & di Komunikasi, plus chip "Support" di Kanban/Task List.

## 1.20.1 — Perbaikan icon picker
- Ganti ikon dashboard ke set klasik yang pasti termuat (tidak meluber jadi teks).

## 1.20.0 — Kelola dashboard + objek fleksibel
- Dashboard Lain bisa dikelola **manager + Dev** (bukan Dev saja), pilih ikon dari picker (bukan ketik).
- Objek saat input task jadi **opsional** dan bisa **diketik bebas** (tidak terbatas pilihan).

## 1.19.0 — Mirror ke Lintas Divisi
- PM/Dev bisa memilih task internal tertentu untuk **di-mirror** ke view Lintas Divisi (ikon cast).

## 1.18.0 — Template rumus bawaan
- Dropdown Kata Kerja & Objek langsung terisi dari template bawaan (jalan tanpa perlu "Isi dari template").

## 1.17.0 — Rumus nama task + pembuat
- Nama task tersusun otomatis: **Stage → Kata Kerja → Objek** (+ Jumlah & Detail opsional).
- Tampilkan **"Dari: <user>"** (pembuat task) di kartu, popup, dan visual.

## 1.16.0 — Kategori & Subkategori (bertingkat)
- Kategori → Subkategori bertingkat + tombol isi dari template (kemudian disempurnakan jadi rumus di 1.17.0).

## 1.15.0 — Dashboard Lain (CRUD) + diagnostik
- Tambah/edit/hapus dashboard eksternal (awalnya Dev) tersimpan di sheet DASHBOARDS.
- Diagnostik untuk view `?view=lintas`.

## 1.14.0 — Task Lintas Divisi
- Tipe task **Internal/Eksternal**, kolom **Divisi Tujuan** + **Kontak Divisi**; buat/edit task lintas divisi khusus PM/Dev.

## 1.13.0 — Mode Lintas Divisi (lihat-saja) + link berbagi
- View-only untuk divisi lain + link berbagi `?view=lintas` (switcher terkunci) + Komunikasi tetap bisa chat.
- Link Saya: ubah nama folder, hapus folder (link pindah ke Umum), pindahkan link.

## 1.12.0 — Link Saya: folder & pencarian
- Kelompokkan link per folder + kotak pencarian.

## 1.11.0 — Link Saya
- Penyimpanan link pribadi per mode user (tersimpan di sheet LINKS).

## 1.10.0 — Dashboard Lain
- Tab dashboard eksternal + tombol menuju dashboard (mis. Monitoring Liveclass).

## 1.9.0 — Lintas Divisi & divisi
- Mode user "Lintas Divisi" + divisi IT, Marketing, Sales.

## 1.8.0 — Chart beban kerja
- Member: 4 bar per prioritas. Manager: stacked per prioritas (tanpa "Tanpa Data").

## 1.7.0 — Kontrol akses & PIN
- Dropdown Master khusus manager; mode **Dev** (PIN); PIN per user (set/hapus); edit opsi dropdown.

## 1.6.0 — Logika deadline + status Revisi
- Review PM/Hold/Done tidak dihitung telat; tambah status **Revisi**.

## 1.5.0 — Penyempurnaan Komunikasi
- Tidak auto-buka chat, penanda belum dibaca, komentar terbaru di atas, Enter=kirim / Shift+Enter=baris baru, Esc=tutup, default kosong.

## 1.4.0 — Perbaikan peran & notifikasi
- Deteksi manager "Nynda (PM)"; notifikasi dari sheet COMMENTS; Kanban muat tanpa scroll; kunci mode lewat email; email dev akses penuh.

## 1.3.0 — Revisi UI & filter
- Platform multi-select; urutan kolom Kanban; notif komentar ke PIC; mapping email→mode user; Task List wrap; fix dropdown dark-mode; filter fokus deadline.

## 1.2.0 — Fitur inti
- Login/auth, notifikasi komentar, perbaikan mobile/UX, UI chat-bubble, filter Komunikasi.

## 1.1.0 — Adaptasi struktur sheet
- Menyesuaikan layout sheet (Main, header baris 3, 13 kolom) + generate Task ID yang kosong.

## 1.0.0 — Rilis awal (Vercel)
- Port dari Apps Script ke Vercel dengan Google Spreadsheet sebagai database; README & tombol Setup.
