# ProductTrack — Versi Google Apps Script

Task tracker tim produk yang **100% berjalan di dalam Google**.
Spreadsheet jadi database, Apps Script jadi server, Web App jadi aplikasinya.

**Tanpa hosting. Tanpa domain. Tanpa kartu kredit. Tanpa service account.**

---

## Kenapa versi Apps Script

| | Versi Vercel | **Versi Apps Script (ini)** |
|---|---|---|
| Hosting | Perlu akun Vercel + deploy | Tidak perlu — numpang Google |
| Kredensial | Service account JSON + 6 env var | Tidak ada, pakai akun Google sendiri |
| Biaya | Bisa kena limit/berbayar | Gratis (kuota akun Google) |
| Kuota baca Sheets | ~60 baca/menit (sering kena limit) | **Tidak kena limit itu** |
| Pasang | ±30 menit + risiko salah config | **±5 menit, 3 langkah** |
| Update | Perlu git push + redeploy | Tempel ulang 1 file |

Cocok dijual sebagai **produk siap pakai**: pembeli cukup salin 1 spreadsheet.

---

## Isi paket

```
Code.gs           Backend lengkap (task, kolaborasi, ceklis, peran user, notifikasi, PIN)
Seed.gs           Setup otomatis + data dummy (50 task, 6 task kolaborasi, dst)
Index.html        Aplikasi (1 file: UI + logika frontend)
appsscript.json   Manifest project
data-dummy/       Spreadsheet contoh siap impor (.xlsx + CSV per sheet)
README.md         Panduan ini
```

---

## Cara pasang (5 menit)

### Langkah 1 — Siapkan spreadsheet

1. Buat Google Spreadsheet baru (boleh kosong).
2. Menu **Extensions → Apps Script**. Editor Apps Script terbuka.

### Langkah 2 — Tempel kode

Di editor Apps Script:

1. Hapus isi file `Code.gs` bawaan, tempel isi **`Code.gs`** dari paket ini.
2. Klik **+ → Script**, beri nama `Seed`, tempel isi **`Seed.gs`**.
3. Klik **+ → HTML**, beri nama `Index` (persis, tanpa `.html`), tempel isi **`Index.html`**.
4. Klik ikon gerigi **Project Settings** → centang *"Show appsscript.json manifest file"*, lalu samakan isinya dengan `appsscript.json` di paket ini (opsional; yang penting `runtimeVersion: V8`).
5. **Simpan** (Ctrl+S).

> Nama file harus persis: `Index` untuk HTML. Kalau tidak, `doGet` gagal menemukannya.

### Langkah 3 — Isi data & deploy

1. Kembali ke spreadsheet, **muat ulang halaman**. Akan muncul menu **⚡ ProductTrack**.
2. Klik **⚡ ProductTrack → 1. Setup + Isi Data Dummy**.
   Google akan minta izin sekali — pilih akun, **Advanced → Go to project (unsafe)** → **Allow**.
   (Peringatan itu normal untuk script buatan sendiri yang belum diverifikasi Google.)
3. Tunggu notifikasi "Data dummy siap". Semua sheet terbentuk & terisi.
4. Di editor Apps Script: **Deploy → New deployment → ⚙ → Web app**
   - *Execute as*: **Me**
   - *Who has access*: pilih sesuai kebutuhan
     - `Anyone with Google account` → tim bisa akses dengan link
     - `Anyone within <domain>` → khusus Google Workspace
5. **Deploy** → salin **Web app URL**. Itu aplikasinya. Buka di browser.

Selesai.

> **Sudah punya spreadsheet contoh?** Folder [`data-dummy/`](data-dummy/) berisi
> `ProductTrack-Data-Dummy.xlsx` — unggah ke Drive, buka dengan Google Sheets, lalu
> lanjut ke Langkah 2. Datanya identik dengan hasil menu "Isi Data Dummy".

---

## Peran & hak akses

Peran disimpan di sheet **USERS** dan diatur dari aplikasi:
**Pengaturan → Kelola User & Peran**.

| Peran | Task yang terlihat | Set "Done" | Setup kolaborasi | Task lintas divisi | **Kelola user** |
|---|---|---|:--:|:--:|:--:|
| **Dev** | semua | task siapa pun | ✅ | ✅ | ✅ **(hanya Dev)** |
| **Manager** | semua | task siapa pun | ✅ | ✅ | — |
| **Leader** | semua | task siapa pun | ✅ | — | — |
| **Staff** | miliknya **+ semua task magang** | **hanya task magang** | — | — | — |
| **Magang** | **hanya task sesama magang** | — | — | — | — |
| **Lihat Saja** | task lintas divisi saja | — | — | — | — |

### Tab Komunikasi punya cakupan sendiri

Chat diperlakukan sebagai **kotak masuk pribadi**, jadi lebih sempit dari view lain:

| Peran | Percakapan yang terlihat di Komunikasi |
|---|---|
| Dev / Manager | semua (untuk memantau) |
| **Leader** | **hanya yang ia PIC/Support-nya** — meski di view lain ia melihat semua task |
| Staff | miliknya + task magang |
| Magang | task sesama magang |

Badge notifikasi juga dihitung dari cakupan ini, sehingga angkanya benar-benar habis
begitu percakapan miliknya dibaca — bukan ikut menghitung obrolan orang lain.

### Cara kerja peran Magang

Dibuat untuk anak magang yang ikut memakai tracker tapi tidak perlu melihat pekerjaan tim inti:

- **Magang hanya melihat task sesama magang** (termasuk miliknya). Pekerjaan karyawan
  tidak muncul di Dashboard, Kanban, List, Timeline, maupun Calendar mereka.
- **Karyawan (Staff) melihat semua task magang** di samping task miliknya sendiri —
  supaya bisa membimbing dan memeriksa hasil kerjanya.
- **Task magang boleh ditutup ("Done") oleh Staff**, bukan hanya Manager/Leader.
  Jadi pembimbing langsung bisa menyetujui hasil kerja magang tanpa menunggu Manager.
  Sebaliknya, task milik karyawan tetap tidak bisa ditutup oleh Staff.
- **Magang sendiri tidak bisa mem-Done-kan apa pun** — maksimal "Review PM", termasuk
  untuk task miliknya sendiri. Persetujuan selalu datang dari karyawan.

Ringkasnya, izin "Done" ditentukan oleh **siapa PIC task-nya**, bukan hanya oleh peran
si penekan tombol. Aturan ini ditegakkan di server, bukan cuma disembunyikan di tampilan.

> Catatan teknis: penyaringan tampilan dilakukan di browser (seperti peran lain sejak awal),
> jadi ini pemisahan **kerapian & alur kerja**, bukan enkripsi data. Untuk kerahasiaan
> ketat antar-peran, datanya perlu difilter di server — beri tahu bila itu dibutuhkan.

### Menambah anggota tim (mis. anak magang baru)

**Hanya bisa dari mode Dev** — Manager sekalipun tidak bisa. Ini disengaja: penambahan
akses dan pemberian hak lewat satu pintu, supaya tak ada yang bisa menaikkan hak
sendiri atau menyelipkan user tanpa sepengetahuan pemilik sistem.

1. Masuk mode Dev: **tekan-tahan logo ProductTrack ±2 detik**, masukkan `DEV_PIN`.
2. **Pengaturan → Kelola User & Peran** → isi nama → pilih peran → **Tambah User**.

Nama itu langsung muncul di dropdown **PIC**, **Support**, **Fokus PIC**, dan pemilih
identitas — jadi bisa segera diberi task tanpa muat ulang.

> **Belum punya `DEV_PIN`?** Isi dulu di Script Properties (lihat bagian *Konfigurasi*).
> Alternatif tanpa mode Dev: tambahkan barisnya langsung di sheet **USERS**
> (kolom `Nama` · `Peran` · `Aktif`), lalu muat ulang aplikasinya.

Manager yang membuka Pengaturan akan melihat keterangan singkat ke mana harus pergi,
bukan sekadar menemukan fiturnya hilang.

### Saat masa magang selesai

**Nonaktifkan, jangan hapus.** Klik tombol status **Aktif → Nonaktif** pada barisnya.
Haknya langsung dicabut (tak bisa lagi set Done, tak masuk daftar approver), tapi nama
dan seluruh riwayat task-nya tetap utuh untuk pelaporan.
Hapus hanya bila orangnya memang salah masuk daftar.

Aturan pengaman yang berlaku **di server**, bukan cuma di tampilan:

- Hanya **Dev** yang bisa menambah, mengubah peran, menonaktifkan, dan menghapus user.
  Percobaan dari Manager/Leader/Staff ditolak backend, bukan hanya disembunyikan tombolnya.
- Nama **"Dev"** tak bisa dipakai sebagai user biasa (itu nama khusus mode Dev).
- Tidak bisa menghapus akun sendiri.
- User **nonaktif** langsung kehilangan haknya, task lamanya tetap utuh.

---

## Data dummy yang ikut

Semua tanggal **relatif terhadap hari ini**, jadi demo selalu terlihat hidup
(ada yang telat, jatuh tempo hari ini, dan yang akan datang).

| Isi | Jumlah | Mencakup |
|---|---|---|
| User & peran | **12** | 1 Manager, 2 Leader, 6 Staff, **2 Magang**, 1 Lihat Saja |
| Task | **54** | 6 status, 4 prioritas, 10 stage, 11 PIC, 15 platform — termasuk **4 task anak magang** |
| Task kolaborasi | **6** | 5 tipe (Course/Tryout-Latsol/Liveclass/Drilling/Journey) + 1 tanpa tipe |
| Proses beruntun | 26 | lengkap dgn PIC, deadline, catatan, status selesai |
| Ceklis | 33 item | 7 task + 4 sub-ceklis proses kolaborasi |
| Komentar | 20 | termasuk `@mention` dan `@everyone` |
| Aktivitas | 34 | supaya tab Laporan tidak nol |
| Notifikasi | 9 | mention + giliran (belum & sudah dibaca) |
| Link pribadi | 13 | 5 user, berfolder |
| Catatan pribadi | 9 | 5 user, berfolder |
| Dashboard lain | 3 | |

Kondisi khusus yang sengaja dibuat untuk demo:

- **5 task overdue**, **2 jatuh tempo hari ini**, **7 due ≤3 hari**
- **3 task lintas divisi** (punya Divisi Tujuan + kontak) + **3 task di-mirror**
- **COL-001 proses 2** → sub-ceklis baru 2/5, jadi **main-ceklisnya terkunci** (demo aturan kunci)
- **COL-002 proses 4** → sub-ceklis 4/4, jadi **boleh dicentang**
- **COL-003** → semua proses selesai (status *Selesai*)

Mau mulai bersih? **⚡ ProductTrack → Kosongkan SEMUA data.**
Header sheet & daftar dropdown (OPTIONS) tetap aman.

---

## Sheet tersembunyi

Setelah setup, sheet "mesin" otomatis disembunyikan agar spreadsheet rapi:

**Terlihat:** `Main` (database task), `OPTIONS` (daftar dropdown), `USERS` (anggota tim & peran)
**Tersembunyi:** `ACTIVITY`, `COMMENTS`, `CHECKLIST`, `COLLAB`, `COLLAB_STEPS`, `NOTIFICATIONS`, `AUTH`, `LINKS`, `DASHBOARDS`, `NOTES`

Buka lagi lewat **⚡ ProductTrack → Tampilkan semua sheet**, sembunyikan lagi lewat menu yang sama.
`AUTH` (berisi hash PIN) akan selalu disembunyikan ulang otomatis.

Mau ubah daftarnya? Edit `HIDDEN_SHEETS` di `Seed.gs`.

---

## Konfigurasi (opsional)

Semua diatur lewat **Project Settings → Script Properties** di editor Apps Script.
Kalau tidak diisi, dipakai nilai default.

| Property | Default | Fungsi |
|---|---|---|
| `DEV_PIN` | *(kosong)* | PIN mode Dev. **Mode Dev mati sampai ini diisi** |
| `PIN_SALT` | `pt_pin_salt_v1` | Garam hash PIN. **Jangan diubah setelah ada PIN terdaftar** |
| `MAIN_SHEET_NAME` | `Main` | Nama sheet database task |
| `SPREADSHEET_ID` | *(kosong)* | Isi hanya kalau script berdiri sendiri (bukan bound) |
| `MANAGERS` | `Manager` | *Cadangan* — hanya dipakai bila sheet `USERS` masih kosong |
| `DONE_APPROVERS` | `Manager` | *Cadangan* — idem |
| `COLLAB_MANAGERS` | `Manager` | *Cadangan* — idem |

> Tiga property terakhir hanya jaring pengaman. Begitu sheet `USERS` terisi (otomatis
> setelah setup), peran diambil dari sana dan diatur lewat **Pengaturan → Kelola User**.

### Mengaktifkan mode Dev

Mode Dev **sengaja tidak aktif** di paket ini — tidak ada PIN bawaan, supaya produk
yang Anda kirim ke pembeli tidak punya pintu belakang. Mode Dev penting karena **hanya
Dev yang bisa menambah user & mengatur peran**.

**Cara termudah (disarankan):** di spreadsheet, menu
**⚡ ProductTrack → Atur PIN Mode Dev** → masukkan 4 digit → OK.
Cek kapan pun lewat **⚡ ProductTrack → Cek status PIN Mode Dev**.

Cara manual: Project Settings → **Script Properties** → Add → `DEV_PIN` = PIN Anda →
**jangan lupa klik "Save script properties"**.

Lalu di aplikasi: **tekan-tahan logo ProductTrack ±2 detik**, masukkan PIN itu.

> Selama `DEV_PIN` kosong, PIN apa pun (termasuk kosong) ditolak, dan pesan errornya
> menyebutkan bahwa PIN-nya memang belum diatur — bukan sekadar "PIN salah".

---

## Kustomisasi untuk pembeli

**Ganti nama anggota tim** — cara termudah: **Pengaturan → Kelola User & Peran** di aplikasi.
Nama contoh (Manager, Leader Konten, Staff Soal, …) bisa dihapus dan diganti nama asli tim.
Bisa juga diedit langsung di sheet `USERS`.

Yang lain ada di `Code.gs` bagian **KONFIGURASI**:

```javascript
var DEFAULT_OPTIONS = {
  status:   ['Todo', 'In progress', 'Review PM', 'Revisi', 'Hold', 'Done'],
  priority: ['Urgent', 'High', 'Normal', 'Low'],
  stage:    [...],   // tahapan kerja tim
  platform: [...],   // produk/platform
  pic:      [...],   // nama anggota tim
  ...
};
```

Setelah diubah, jalankan **⚡ ProductTrack → 2. Setup saja** untuk menambahkan opsi baru.
Opsi juga bisa diubah langsung dari dalam aplikasi (tab **Pengaturan**) tanpa menyentuh kode.

Nama tim juga bisa diedit langsung di sheet `OPTIONS` (kolom `Type` = `pic`).

---

## Batas & kuota

| Hal | Batas |
|---|---|
| Waktu jalan 1 fungsi | 6 menit (jauh dari cukup) |
| Sel per spreadsheet | 10 juta (±400.000 task) |
| Panggilan/hari | 20.000 (akun gratis) / 100.000 (Workspace) |
| Pengguna bersamaan | Nyaman untuk tim s.d. ±30 orang |

Sudah dipasang **LockService** pada penyimpanan task, jadi dua orang menyimpan
bersamaan tidak akan saling menimpa baris.

Kalau `ACTIVITY` / `NOTIFICATIONS` sudah puluhan ribu baris (setelah 1–2 tahun
pemakaian intensif), hapus baris lama secara berkala agar tetap ringan.

---

## Kalau bermasalah

| Gejala | Sebab & solusi |
|---|---|
| **"PIN salah" padahal PIN sudah diisi di Script Properties** | Kemungkinan besar tombol **Save script properties** belum ditekan, jadi propertinya tak tersimpan. Pakai menu **⚡ ProductTrack → Atur PIN Mode Dev** (langsung tersimpan), atau cek dengan **Cek status PIN Mode Dev**. Sejak v1.53.0 pesan errornya menyebut sebab sebenarnya. |
| **Layar "Memuat task tracker…" tak hilang** | Sejak v1.51.1 tidak terjadi lagi — layar itu selalu ditutup dan errornya muncul sebagai notifikasi. Kalau masih terjadi, Anda memakai versi lama: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. |
| **Tampilan polos tanpa warna/tata letak** | Library tampilan (Tailwind, Chart.js, dll) diambil dari internet dan sedang gagal dimuat — biasanya diblokir jaringan kantor/sekolah, atau koneksi lambat. Muat ulang; kalau menetap, coba jaringan lain. Aplikasi tetap berfungsi, hanya tampilannya polos. |
| **Grafik Dashboard kosong + ada notifikasi "library gagal dimuat"** | Sama seperti di atas, khusus Chart.js. Fitur lain tetap jalan. |
| Menu ⚡ ProductTrack tak muncul | Muat ulang spreadsheet. Pastikan `Seed.gs` tersimpan. |
| "Script function not found: doGet" | File HTML belum bernama persis `Index`. |
| Halaman kosong / loading terus | Buka **Executions** di editor Apps Script untuk lihat errornya. |
| "You do not have permission" | Deploy ulang, pastikan *Execute as: Me*. |
| Tanggal meleset 1 hari | Samakan zona waktu: **Project Settings → Time zone**. |
| Perubahan kode tak terasa | Deploy → **Manage deployments** → ✏️ → Version: **New version** → Deploy. |

---

## Update aplikasi nanti

Frontend ada di satu file. Untuk memperbarui:

1. Buka file `Index` di editor Apps Script.
2. Ganti seluruh isinya dengan `Index.html` versi baru.
3. Simpan → **Deploy → Manage deployments → ✏️ → New version → Deploy**.

Backend (`Code.gs`) jarang berubah kecuali ada fitur baru yang butuh kolom baru.

---

## Catatan teknis

- **Kompatibel dua arah.** `Index.html` yang sama juga jalan di versi Vercel; ia
  otomatis memakai `google.script.run` saat berada di Apps Script, dan `fetch`
  saat di-host sendiri. Jadi satu file frontend untuk dua model penjualan.
- **Gerbang PIN aplikasi** (`ACCESS_PIN`/`VIEW_PIN`) dan tombol Login Google
  hanya ada di versi Vercel. Di Apps Script, kontrol akses diambil alih oleh
  **pengaturan akses Web App** + **PIN per-user** (sheet `AUTH`, disimpan
  sebagai hash SHA-256, bukan PIN mentah).
- **Link berbagi mode lihat-saja:** tambahkan `?view=lintas` di akhir Web app URL.
  Penerima hanya melihat task lintas divisi & task yang di-mirror, tanpa bisa
  mengubah apa pun. Buka kunci dengan `?unlock=1`.
- Struktur `Main`: header di **baris 3**, data mulai **baris 4**, kolom **B..V**.
  Jangan mengubah urutan kolom — backend memetakan berdasarkan posisi.
