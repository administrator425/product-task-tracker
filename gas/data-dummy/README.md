# Data Dummy ProductTrack

Isi spreadsheet contoh yang sudah jadi — untuk **melihat** datanya tanpa menjalankan script,
atau untuk **mengimpor manual** kalau tidak mau memakai menu ⚡ ProductTrack.

```
ProductTrack-Data-Dummy.xlsx   ← 1 file berisi 13 sheet (cara termudah)
csv/                           ← 1 file CSV per sheet (kalau butuh impor terpisah)
```

> Cara paling praktis tetap: **⚡ ProductTrack → 1. Setup + Isi Data Dummy** di spreadsheet.
> File di sini adalah hasil ekspor dari generator yang sama, isinya identik.

---

## Cara memakai file .xlsx

1. Buka [drive.google.com](https://drive.google.com) → **New → File upload** → pilih `ProductTrack-Data-Dummy.xlsx`.
2. Klik kanan file → **Open with → Google Sheets**.
3. **File → Save as Google Sheets** (kalau masih dalam mode Excel).
4. Lanjutkan pemasangan script seperti di [`../README.md`](../README.md) **Langkah 2**.
   Lewati "Isi Data Dummy" — datanya sudah ada.

Sheet `COMMENTS`, `ACTIVITY`, `CHECKLIST`, `COLLAB`, `COLLAB_STEPS`, `NOTIFICATIONS`,
`AUTH`, `LINKS`, `DASHBOARDS`, dan `NOTES` sudah **tersembunyi** di file ini.
Tampilkan lewat menu **View → Show → Hidden sheets** bila perlu.

---

## Isi tiap sheet

| Sheet | Baris data | Isi | Tampil? |
|---|---:|---|---|
| **Main** | 54 | Database task. **Header di baris 3**, data mulai baris 4, kolom B–V | ✅ |
| **OPTIONS** | 126 | Semua pilihan dropdown + rumus nama task (stage → kata kerja → objek) | ✅ |
| **USERS** | 12 | Daftar anggota tim + perannya | ✅ |
| COMMENTS | 19 | Diskusi per task & per task kolaborasi, termasuk `@mention` | — |
| CHECKLIST | 47 | Ceklis task + sub-ceklis proses kolaborasi | — |
| COLLAB | 6 | Task kolaborasi (proyek dengan proses beruntun) | — |
| COLLAB_STEPS | 25 | Proses tiap task kolaborasi + PIC, deadline, catatan | — |
| NOTIFICATIONS | 8 | Notifikasi mention & giliran (ada yang belum dibaca) | — |
| ACTIVITY | 33 | Riwayat aktivitas — membuat tab Laporan berisi angka | — |
| LINKS | 12 | Link pribadi per user, berfolder | — |
| NOTES | 8 | Catatan pribadi per user, berfolder | — |
| DASHBOARDS | 2 | Tautan dashboard eksternal | — |
| AUTH | 0 | PIN per user (hash). Sengaja **kosong** — atur sendiri nanti | — |

---

## Nama & peran di data contoh

Sengaja memakai nama **generik** agar langsung terbaca sebagai contoh peran.
Ganti sesuka Anda lewat **Pengaturan → Kelola User** (mode Dev), atau langsung di sheet `USERS`.

| Nama | Peran | Hak |
|---|---|---|
| Manager | Manager | Lihat semua task • set Done • setup kolaborasi • task lintas divisi |
| Leader Konten, Leader Sistem | Leader | Lihat semua task • set Done • setup kolaborasi. Di **Komunikasi** hanya melihat percakapan miliknya |
| Staff Materi, Staff Soal, Staff QC, Staff Input, Staff Data, Staff Liveclass | Staff | Task miliknya **+ semua task magang** • boleh mem-Done-kan task magang • task sendiri maksimal "Review PM" |
| Magang Konten, Magang Data | Magang | **Hanya task sesama magang** • tidak melihat kerjaan karyawan • maksimal "Review PM" |
| Lintas Divisi | Lihat Saja | Baca terbatas: task lintas divisi saja |

**Menambah/mengubah user hanya bisa dari mode Dev** — Manager sekalipun tidak bisa.
Lihat [`../README.md`](../README.md) bagian *Menambah anggota tim*.

---

## Kondisi yang sengaja dibuat untuk demo

Semua tanggal **relatif terhadap tanggal file ini dibuat**, jadi begitu diimpor Anda
langsung melihat aplikasi dalam keadaan "hidup":

- **Task overdue, jatuh tempo hari ini, dan ≤3 hari** — semuanya ada
- Semua status terpakai: Done · In progress · Todo · Review PM · Revisi · Hold
- **3 task lintas divisi** (punya Divisi Tujuan + kontak) dan **3 task di-mirror** ke tampilan Lintas Divisi
- **6 task kolaborasi** mencakup semua tipe Kanban: Course, Tryout/Latsol, Liveclass, Drilling, Journey, dan satu tanpa tipe
- **COL-001 proses 2** — sub-ceklis baru 2/5, jadi centang utamanya **terkunci** (mendemokan aturan kunci)
- **COL-002 proses 4** — sub-ceklis 4/4, jadi **siap dicentang**
- **COL-003** — semua proses selesai, statusnya *Selesai*
- **4 task milik anak magang** untuk mencoba aturan peran Magang: masuk sebagai
  `Magang Konten` (hanya melihat task magang), lalu sebagai `Staff QC`
  (melihat task sendiri + semua task magang, dan boleh mem-Done-kannya)
- **Notifikasi & komentar belum terbaca** untuk mencoba badge Komunikasi dan lonceng —
  badge habis begitu percakapannya dibuka
- Tab **Laporan** langsung berisi angka (ada event "→ Done" dan komentar dalam 7 hari terakhir)

> Karena tanggalnya relatif, makin lama file ini disimpan makin "basi" tanggalnya.
> Untuk demo yang selalu segar, pakai menu **⚡ ProductTrack → Setup + Isi Data Dummy**
> yang menghitung ulang semua tanggal terhadap hari ini.

---

## Mengganti data dummy dengan data asli

Setelah puas mencoba: **⚡ ProductTrack → Kosongkan SEMUA data**.
Semua task, komentar, ceklis, dan task kolaborasi terhapus — header sheet, daftar
dropdown (`OPTIONS`), dan daftar user (`USERS`) tetap dipertahankan.
