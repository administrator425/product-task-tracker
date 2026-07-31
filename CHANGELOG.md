# Changelog — ProductTrack

Format versi: **MAJOR.MINOR.PATCH**
- PATCH naik untuk perbaikan kecil (mis. 1.22.0 → 1.22.1)
- MINOR naik untuk fitur baru (mis. 1.22.0 → 1.23.0)
- MAJOR naik untuk perubahan besar/breaking

Versi terpasang ditampilkan di **sidebar** (samping logo) dan di **Dropdown Master**.
Sumber versi: konstanta `APP_VERSION` di `public/index.html`.

---

## 1.57.0 — PIN khusus anak magang + tab "Kerjaan Magang" untuk karyawan

### Masalahnya lebih dalam dari sekadar dropdown
Sebelum ini, siapa pun yang tahu `ACCESS_PIN` mendapat level penuh, dan `getBootstrapData`
mengirim **seluruh task, komentar, link, dan catatan** ke browser. Identitas hanyalah pilihan
di dropdown yang tak pernah diverifikasi server. Artinya menyembunyikan switcher **tidak
mengamankan apa pun** — data tim tetap ada di respons jaringan.

### PIN magang: dipangkas DI SERVER
- Env baru **`MAGANG_PIN`**. Masuk dengan PIN itu → level `magang`.
- `getBootstrapData` untuk level ini **hanya mengirim**: task milik anak magang, plus task
  karyawan tempat magang itu terdaftar sebagai PIC/Support. Riwayat aktivitas, dashboard
  eksternal, daftar PIN, link & catatan orang lain **tidak dikirim sama sekali**.
- Aksi administratif diblokir di gerbang (kelola user, kelola opsi, hapus task, setup, dll).
- Header `x-user` (identitas yang diklaim browser) **hanya bisa mempersempit**, tak pernah
  menaikkan hak: backend memastikan nama itu memang ber-peran Magang. Mengaku "Nynda" lewat
  jalur magang tetap hanya menerima data magang.

### Identitas magang terkunci
- Setelah PIN magang, muncul pemilihan **hanya dari daftar magang** yang disiapkan Dev.
- Pilihannya disimpan di **cookie** (`tt_magang_user`, 180 hari) dan **tidak bisa diganti
  dari dalam aplikasi** — kotak "Mode User" disembunyikan, `requestUserSwitch` menolak.
  Ganti orang berarti reset cookie / login ulang.

### Tab "Kerjaan Magang" untuk karyawan
- View baru (pola seperti Lintas Divisi) berisi task anak magang, **dikelompokkan per orang**
  lengkap dengan hitungan selesai & overdue, dan badge overdue di sidebar.
- Karyawan bisa membuka & **menutup (Done)** task magang langsung dari sini.
- Konsekuensinya: **kerjaan magang tidak lagi tercampur** ke daftar & KPI task karyawan —
  dashboard mereka kembali bersih. Sebelumnya Staff melihat task magang menyatu di listnya.
- Magang tetap bisa jadi **Support di task karyawan** dan ikut **Task Kolaborasi**.

### Perbaikan
- `populateUserSelect()` dulu memaksa identitas ke salah satu opsi PIC yang tersedia. Karena
  nama magang belum tentu ada di daftar itu, identitas magang terlempar balik ke user lain.
  Kini mode magang punya jalur terkunci sendiri, seperti mode berbagi Lintas Divisi.

### Pengujian
- `test/vercel-users.test.js` → **55 assertion** (+16): pemangkasan data level magang,
  task Support ikut terkirim hanya ke magang yang bersangkutan, dan **dua uji percobaan
  naik hak** (mengaku Manager/Staff lewat jalur magang tetap ditolak).
- `test/gas.test.js` → **288 assertion** (+9): kunci cookie, switcher tersembunyi, penolakan
  ganti user, header `x-user`, tab Kerjaan Magang, dan pemisahan dari daftar karyawan.
- `npm test` → **115 + 55 + 288 = 458 assertion**.
- Diverifikasi end-to-end melawan backend Vercel asli: dengan PIN magang server mengirim
  **6 task, semuanya PIC magang** (0 task karyawan, 0 activity, 0 dashboard); klaim "Nynda"
  maupun "Ali" tetap 6 task yang sama; UI mengunci identitas ke cookie, lencana "Magang",
  tanpa opsi Done. Sisi karyawan: daftar utama Ali 3 task (bersih), tab Kerjaan Magang berisi
  2 blok anak magang / 6 task, dan Staff berhasil menutup task magang ke Done.

---

## 1.56.0 — Leader melihat task miliknya saja (wewenangnya tetap penuh)
Sebelumnya Leader ikut melihat **semua task tim** seperti Manager di Dashboard, Kanban,
List, Timeline, dan Calendar — v1.54.0 baru mempersempitnya di tab Komunikasi saja.

- **`canSeeAllTasks()` kini hanya Manager & Dev.** Leader turun ke cakupan personal:
  hanya task yang ia **PIC atau Support**-nya, sama seperti Staff.
- **Wewenang Leader TIDAK berubah** — masih boleh **menutup (Done) task siapa pun** dan
  **menyusun Task Kolaborasi**, termasuk mencentang prosesnya sendiri. Yang berubah hanya
  jangkauan lihat, bukan haknya.
- **`commScopedTasks()` dihapus.** Setelah Leader dipersempit, aturan Komunikasi jadi sama
  persis dengan view lain — mempertahankan dua fungsi berbeda hanya mengundang keduanya
  berbeda diam-diam. Komunikasi & badge notifikasi kembali memakai `scopedTasks()`.
- Legenda peran di panel Kelola User diperbarui: Leader kini tertulis *"Task miliknya saja •
  boleh set Done task siapa pun • boleh menyusun Task Kolaborasi"*.

### Pengujian
- `test/gas.test.js` → **279 assertion**; bagian 16c ditulis ulang: memastikan
  `canSeeAllTasks` hanya Manager, tak ada lagi cakupan Komunikasi terpisah, **dan** dua
  assertion penjaga bahwa wewenang Done & kolaborasi Leader tetap ada.
- Diverifikasi di **kedua konfigurasi**:
  - *Vercel/env var* — Dhea 8 task, Alya 9 (persis PIC/Support-nya), Nynda 30; lencana
    Leader; opsi "Done" tetap ada di dropdown & tombol Done Kanban aktif; Dhea berhasil
    membuat, mencentang, dan menghapus Task Kolaborasi.
  - *sheet USERS* — Dhea 3, Alya 6, Manager/Dev 24, Staff 9 (miliknya + task magang),
    Magang 6; Done & kolaborasi Leader tetap jalan.
  - Per-tampilan konsisten: Dashboard, Kanban, List, dan Komunikasi menunjukkan angka
    yang sama untuk tiap peran. Nol error konsol.

---

## 1.55.0 — Kelola user & peran kini ada juga di versi Vercel
Sebelumnya sheet `USERS` + peran (Manager/Leader/Staff/Magang) hanya ada di paket Apps Script,
jadi panel **Kelola User** tak pernah muncul di app Vercel yang dipakai tim sehari-hari.
Sekarang di-port ke `api/_sheets.js` + `api/rpc.js`.

- **Sheet `USERS`** (Nama · Peran · Aktif) jadi sumber peran, dibaca **dalam batch bootstrap
  yang sudah ada** — jadi tidak menambah kuota baca Google Sheets sama sekali.
- **Fungsi peran tetap SINKRON.** Alih-alih membuat semuanya `async` (yang akan membongkar
  seluruh pemanggil dan 78 tes produksi), daftar user dimuat sekali per request ke cache,
  lalu fungsi peran membacanya. `rpc.js` membuang cache di awal tiap request supaya
  perubahan peran langsung berlaku, tidak menunggu cold start instance serverless.
- **Cadangan environment variable dipertahankan**: selama sheet `USERS` kosong/absen,
  peran diambil dari `MANAGERS` / `DONE_APPROVERS` / `COLLAB_MANAGERS` persis seperti dulu.
  Instalasi yang belum menjalankan setup tidak berubah perilakunya sama sekali.
- Ikut ter-port: **izin "Done" berbasis PIC** (Staff boleh menutup task anak magang, tapi
  bukan task karyawan lain), **kelola user hanya oleh Dev**, dan aturan visibilitas Magang.
- Action baru di RPC: `getUsers`, `saveUser`, `deleteUser`.

### Pengujian
- `test/logic.test.js` → **115 assertion** (+37): pengenalan peran, izin Done bergantung PIC,
  user nonaktif kehilangan hak, kelola-user hanya Dev, dan kembalinya ke cadangan env var.
- **`test/vercel-users.test.js` (baru) → 39 assertion**: uji integrasi backend Vercel dengan
  googleapis diganti spreadsheet tiruan — jalur nyata baca/tulis sheet, bootstrap meta,
  gerbang Done lewat `quickUpdateField` & `saveTask`, CRUD user, dan fallback env var.
- `npm test` kini menjalankan tiga suite: **115 + 39 + 277 = 431 assertion**.
- Diverifikasi end-to-end di UI melawan backend Vercel asli: Dev melihat panel Kelola User
  (5 peran bisa dipilih), Manager melihat keterangan saja, menambah "Magang Agustus"
  langsung masuk dropdown PIC & pemilih identitas, task untuknya hanya terlihat sesama
  magang + semua Staff, magang ditolak saat mem-Done-kan task sendiri, dan Staff berhasil
  menutupnya. Lencana peran: Manager/Leader/Staff/Magang/Dev tampil benar.

---

## 1.54.0 — Komunikasi jadi kotak masuk pribadi + notifikasi hilang saat dibaca

### Cakupan tab Komunikasi
- **Leader tidak lagi melihat semua percakapan** seperti Manager. Di tab Komunikasi,
  Leader hanya melihat task yang ia **PIC atau Support**-nya. Di view lain (Dashboard,
  Kanban, List, Timeline, Calendar) Leader tetap melihat semua task seperti sebelumnya —
  yang berubah hanya inbox chat-nya.
- **Manager/Dev tetap bisa memantau semua** percakapan.
- Ditambahkan `commScopedTasks()` yang dipakai daftar Komunikasi **dan** perhitungan badge.

### Notifikasi benar-benar hilang setelah dibaca
- **Akar masalahnya sama**: badge komentar dihitung dari `scopedTasks()`, sehingga bagi
  Manager/Leader ia menghitung percakapan di task siapa pun — termasuk yang tak pernah
  mereka buka. Angkanya jadi seolah tak pernah habis. Sekarang dihitung dari
  `commScopedTasks()`, jadi hanya percakapan miliknya sendiri.
- **Lonceng notifikasi: membuka menunya = menandai terbaca.** Sebelumnya notifikasi hanya
  hilang bila diklik satu per satu atau lewat "Tandai semua dibaca", sehingga badge sering
  menetap. Penanda dikirim ke server tanpa merender ulang daftarnya, supaya penanda "baru"
  tetap terlihat selama menu masih terbuka.
- **Notifikasi mention pada task biasa kini bisa diklik** — langsung membuka percakapan
  task itu di tab Komunikasi (sebelumnya hanya notifikasi kolaborasi yang bisa dibuka).
- Perbandingan penulis komentar dibuat toleran (`same()`), supaya komentar sendiri tak
  pernah terhitung "belum dibaca" karena beda kapital/spasi.

### Pengujian
- `test/gas.test.js` → **277 assertion** (+11 untuk perubahan ini).
- Diverifikasi lewat simulator `google.script.run`: Leader Konten melihat 54 task di view
  lain tapi hanya **9** di Komunikasi (persis yang ia PIC/Support-nya), Leader Sistem 8,
  Manager tetap 54, Staff 12, Magang 4. Badge komentar 1 → **0** begitu chat dibuka;
  badge lonceng 2 → **0** begitu menu dibuka, dan **tetap 0 setelah dimuat ulang dari
  server** (jadi benar-benar tersimpan, bukan sekadar hilang di layar). Klik notifikasi
  mention membuka chat task yang tepat. Nol error konsol.

### Data dummy
- `data-dummy/*.xlsx` dan `csv/` diregenerasi mengikuti v1.53.0 — kini **12 user / 54 task**
  termasuk 2 Magang dan 4 task milik magang.

### Perbaikan lencana peran
- Di deployment **Vercel** (tanpa sheet `USERS`, peran dari env var), lencana "MODE USER"
  salah menulis **Staff** untuk Leader — padahal haknya Leader. Sekarang label diturunkan
  dari hak yang benar-benar berlaku, jadi tertulis **Leader**.
- Diverifikasi pada konfigurasi Vercel (bootstrap tanpa `meta.users`): Nynda → Manager /
  30 percakapan, Dhea → Leader / **8**, Alya → Leader / **9** (persis task yang ia
  PIC/Support-nya), Ali → Staff / 4. Di view lain Dhea & Alya tetap melihat 30 task.

---

## 1.53.0 — Peran "Magang" + izin Done berbasis PIC + perbaikan PIN Dev
Menyiapkan anak magang ikut memakai tracker tanpa melihat pekerjaan tim inti.

### Peran baru: Magang
Daftar peran jadi **Dev · Manager · Leader · Staff · Magang · Lihat Saja**, dipilih Dev
saat menambah user.

| Peran | Task yang terlihat | Set "Done" |
|---|---|---|
| Dev / Manager / Leader | semua | task siapa pun |
| **Staff** | miliknya **+ semua task magang** | **hanya task magang** |
| **Magang** | **hanya task sesama magang** | — |

- **Magang hanya melihat task sesama magang** (termasuk miliknya). Pekerjaan karyawan tidak
  muncul di Dashboard, Kanban, List, Timeline, maupun Calendar mereka.
- **Staff melihat semua task magang** di samping task miliknya — supaya bisa membimbing.
- **Izin "Done" sekarang ditentukan oleh SIAPA PIC task-nya**, bukan hanya peran si penekan
  tombol: Staff boleh menutup task milik magang (pembimbing menyetujui hasil kerjanya), tapi
  tetap tidak boleh menutup task karyawan lain. Magang tak bisa mem-Done-kan apa pun,
  termasuk task miliknya sendiri.
- Ditegakkan **di server** (`canApproveDone_(actor, taskPic)` dipakai `saveTask` &
  `quickUpdateField`), bukan hanya disembunyikan di UI.
- Frontend: `canSetDoneFor(task)` menggantikan `canSetDone()` di seluruh titik keputusan —
  dropdown status inline, form task, dan pindah-massal Kanban. Pada pindah-massal, izin
  dinilai **per task**: yang boleh diproses, yang tidak dilewati dengan pemberitahuan
  jumlahnya; tombol "Done" hanya nonaktif bila tak satu pun task terpilih boleh ditutup.

### Perbaikan PIN Mode Dev
- **Penyebab "PIN salah padahal sudah diisi": pesannya menyesatkan.** Frontend selalu
  menampilkan "PIN salah", padahal server mengirim alasan sebenarnya — biasanya
  *"DEV_PIN belum diset"* karena tombol **Save script properties** di Project Settings
  terlewat. Sekarang pesan dari server yang ditampilkan.
- **Menu baru** di spreadsheet: **⚡ ProductTrack → Atur PIN Mode Dev** (langsung tersimpan,
  tanpa masuk Project Settings) dan **Cek status PIN Mode Dev**.

### Data dummy
- Ditambah **2 user Magang** (Magang Konten, Magang Data) dan **4 task milik magang** —
  di-*append* agar Task ID lama tidak bergeser. Total kini **12 user / 54 task**.

### Pengujian
- `test/gas.test.js` +18 assertion untuk peran Magang: Staff boleh mem-Done-kan task magang,
  Staff ditolak pada task karyawan, magang ditolak pada task sendiri & sesama magang,
  Leader/Manager tetap bebas, penegakan lewat `saveTask` maupun `quickUpdateField`, dan
  magang tak masuk daftar approver.

---

## 1.52.0 — Kelola user dikunci ke mode Dev (Manager tidak bisa)
Menyiapkan onboarding anggota baru (mis. anak magang) dengan kontrol akses satu pintu.

- **Menambah/mengubah/menonaktifkan/menghapus user sekarang HANYA bisa dari mode Dev.**
  Sebelumnya Manager juga bisa. Alasannya: pemberian akses dan kenaikan hak tidak boleh
  bisa dilakukan tanpa sepengetahuan pemilik sistem, dan Manager tak boleh punya jalan
  untuk menaikkan hak siapa pun — termasuk dirinya.
  - Ditegakkan **di backend** (`canManageUsers_` → hanya `dev`), jadi bukan sekadar
    menyembunyikan tombol. Percobaan dari Manager/Leader/Staff ditolak server.
  - Aturan lama "hanya Dev boleh memberi peran Dev/Manager" jadi tidak perlu lagi dan
    **dihapus** (`ROLES_DEV_ONLY`) — sekarang seluruh pengelolaan user memang milik Dev.
- **Manager yang membuka Pengaturan** melihat keterangan singkat: pengelolaan user ada di
  mode Dev, dan alternatifnya mengisi sheet `USERS` langsung — bukan sekadar menemukan
  fiturnya hilang tanpa penjelasan. Leader/Staff tidak melihat apa pun soal ini.
- Panel Kelola User diberi label **MODE DEV**, dan peran **"Dev" tak bisa dipilih** untuk
  baris user (Dev adalah mode ber-PIN, bukan anggota daftar).
- Nama **"Dev"** ditolak sebagai nama user biasa.

### Perbaikan
- **User baru kini langsung muncul di semua pemilih.** Sebelumnya hanya dropdown PIC/Support
  & pemilih identitas yang tersegarkan; **Fokus PIC** dan **form Tambah Task** baru ikut
  setelah muat ulang. Sekarang `populateManagerFocus()` dan `populateModalDropdowns()`
  ikut dipanggil.

### Pengujian
- `test/gas.test.js` → **253 assertion**. Bagian kelola user ditulis ulang mengikuti alur
  onboarding magang: Manager/Leader/Staff ditolak di setiap operasi, Dev berhasil, naik-turun
  peran langsung berlaku, nonaktif mencabut hak tanpa menghilangkan task, plus 7 assertion
  UI (panel Dev-only, keterangan untuk Manager, label MODE DEV).
- Diverifikasi lewat simulator `google.script.run`: sebagai Dev panel muncul; sebagai Manager
  panel hilang & keterangan tampil; sebagai Leader/Staff tak ada apa pun. Alur penuh diuji —
  tambah "Magang", muncul di 3 dropdown, diberi task, magang hanya melihat task itu,
  percobaannya menambah user ditolak, lalu dinonaktifkan & dihapus.

---

## 1.51.1 — Perbaikan: layar "Memuat…" menggantung saat deploy di Apps Script
Dilaporkan dari deployment Apps Script sungguhan: halaman ter-render (KPI, grafik, pengingat
semua muncul) tapi overlay **"Memuat task tracker…" tidak pernah hilang**; pada muat ulang lain
halamannya tampil polos tanpa gaya sama sekali.

**Sebabnya bukan kompleksitas project**, melainkan rapuhnya penanganan library CDN:

- `afterLoad()` menyembunyikan overlay di **baris terakhir**. Kalau ada satu langkah di
  tengahnya melempar error, overlay tak pernah ditutup — padahal semua yang sudah ter-render
  tetap terlihat. Persis gejala yang dilaporkan.
- `renderCharts()` menyentuh `Chart.defaults` **tanpa memeriksa** Chart.js sudah termuat.
  Bila CDN diblokir/lambat (jaringan kantor, sekolah, ISP), ini melempar `ReferenceError`
  dan mematikan seluruh sisa `afterLoad()`.

Perbaikan:

- **`afterLoad()` kini memakai `try/finally`** — layar "Memuat…" dijamin tertutup apa pun yang
  terjadi, dan pesan errornya ditampilkan sebagai notifikasi (bukan diam-diam).
- **`renderCharts()` menjaga `Chart`**; kotak grafik menampilkan penjelasan bila Chart.js gagal
  dimuat. (`Gantt`, `FullCalendar`, dan `Sortable` sudah dijaga sebelumnya.)
- **Deteksi library yang gagal dimuat** (`missingLibs()`) + notifikasi sekali yang menyebut
  jumlahnya, supaya penyebabnya jelas alih-alih halaman rusak tanpa keterangan.
- **Semua akses `localStorage` lewat pembungkus aman `LS`** — di iframe Apps Script,
  `localStorage` bisa melempar `SecurityError` saat cookie pihak ketiga diblokir, dan akses
  di inisialisasi `state` dulu bisa mematikan seluruh script sebelum apa pun ter-render.

Hasilnya: dengan **semua CDN diblokir**, aplikasi tetap memuat 50 task, KPI terisi, dan
14 tab bisa dibuka tanpa error — hanya tampilannya polos dan grafiknya diganti pesan.

### Pengujian
- Simulator baru menjalankan frontend lewat **`google.script.run` tiruan** (jalur Apps Script
  sungguhan, bukan `fetch`) — jalur yang sebelumnya tak pernah diuji dan menjadi celah bug ini.
- `test/gas.test.js` +12 assertion ketahanan (try/finally, penjagaan tiap library, `.hide` tak
  bergantung Tailwind, pembungkus `localStorage`). Total **239 assertion**.

---

## 1.51.0 — Peran user (Manager/Leader/Staff) + file data dummy siap impor
Persiapan agar paket `gas/` bisa **dipublikasikan/dijual** apa adanya.

### Sistem peran & kelola user (versi Apps Script)
- Sheet baru **`USERS`** (Nama · Peran · Aktif) jadi sumber peran, menggantikan
  pengaturan lewat environment variable yang harus disentuh developer.
- Lima peran dengan hak berjenjang:

  | Peran | Lihat semua task | Set "Done" | Setup kolaborasi | Task lintas divisi | Kelola user |
  |---|:--:|:--:|:--:|:--:|:--:|
  | Dev | ✅ | ✅ | ✅ | ✅ | ✅ (termasuk beri peran Dev/Manager) |
  | Manager | ✅ | ✅ | ✅ | ✅ | ✅ (kecuali beri peran Dev/Manager) |
  | Leader | ✅ | ✅ | ✅ | — | — |
  | Staff | hanya miliknya | — | — | — | — |
  | Lihat Saja | terbatas | — | — | — | — |

- Panel baru **Pengaturan → Kelola User & Peran**: tambah user, ubah peran, aktif/nonaktif,
  hapus — lengkap dengan legenda hak tiap peran. User baru **otomatis masuk dropdown
  PIC & Support**, jadi langsung bisa diberi task.
- Pengamanan ditegakkan **di server**, bukan cuma di tampilan: hanya Dev yang boleh
  mengangkat Dev/Manager (mencegah user menaikkan haknya sendiri), Manager tak boleh
  mengubah/menghapus user ber-peran Manager/Dev, dan tak seorang pun bisa menghapus
  akunnya sendiri. User nonaktif langsung kehilangan hak, task lamanya tetap utuh.
- Frontend menurunkan hak dari `state.users`; kalau backend tak mengirim `meta.users`
  (versi Vercel), semuanya **otomatis kembali ke perilaku lama** dan panel Kelola User
  disembunyikan — jadi instalasi lama tidak berubah sama sekali.

### Siap publikasi
- **Tidak ada PIN bawaan lagi.** `DEV_PIN` kosong secara default di kedua versi, dan
  mode Dev menolak PIN apa pun (termasuk kosong) sampai property/env itu diisi sendiri.
  Nilai bawaan `'3108'` yang sebelumnya tertanam di `api/_sheets.js` **dihapus**.
- **Nama contoh diganti generik**: Manager, Leader Konten, Leader Sistem, Staff Materi,
  Staff Soal, Staff QC, Staff Input, Staff Data, Staff Liveclass — tidak ada lagi nama
  orang asli di dalam produk.

### File data dummy siap pakai — `gas/data-dummy/`
- **`ProductTrack-Data-Dummy.xlsx`** — 1 file berisi 13 sheet (header Main tetap di baris 3,
  tanggal tersimpan sebagai tanggal asli, sheet internal sudah tersembunyi). Unggah ke
  Drive → buka dengan Google Sheets → langsung jalan.
- **`csv/`** — satu CSV per sheet untuk impor terpisah.
- **`README.md`** — rincian isi tiap sheet, daftar peran, dan kondisi demo yang disiapkan.

### Perbaikan
- **`@mention` untuk nama ber-spasi.** Parser lama berhenti di spasi, jadi `@Staff Data`
  bisa salah menotifikasi `Staff Soal` — masalah yang sama akan muncul untuk nama asli
  seperti "Budi Santoso". Sekarang nama **terpanjang** dicocokkan lebih dulu, di backend
  maupun pada penyorotan teks di UI. Tag ambigu (`@Staff` saja) tidak menotifikasi siapa pun.

### Pengujian
- `test/gas.test.js` bertambah jadi **227 assertion**, termasuk 7 uji mention nama ber-spasi
  dan ±30 uji peran/kelola user (batas kenaikan peran, nonaktif, hapus, hak per peran).
- `npm test` = 78 + 227 = **305 assertion**.

---

## 1.50.0 — Paket Google Apps Script siap jual + data dummy lengkap
Folder baru **`gas/`** berisi versi ProductTrack yang berjalan **100% di dalam Google**
(Spreadsheet = database, Apps Script = server, Web App = aplikasi). Tidak perlu hosting,
service account, atau kartu kredit — pembeli cukup menyalin satu spreadsheet.

- **`gas/Code.gs`** — backend lengkap, port dari `api/_sheets.js` ke `SpreadsheetApp`:
  seluruh fitur ikut (task, ceklis, task kolaborasi + sub-ceklis, komentar, mention
  `@user`/`@everyone`, notifikasi giliran, link & catatan per-user, dashboard lain,
  PIN per-user, gerbang Done, mode lihat-saja).
  - Bebas dari **kuota baca 60/menit** yang membatasi versi Vercel — SpreadsheetApp
    tidak memakai kuota Sheets API itu.
  - **LockService** pada `saveTask` supaya dua orang menyimpan bersamaan tak saling menimpa baris.
  - Notifikasi **handoff giliran** kini dibuat otomatis saat sebuah proses collab dicentang.
- **`gas/Seed.gs`** — menu "⚡ ProductTrack" + generator data dummy: **50 task, 6 task
  kolaborasi (26 proses), 33 item ceklis, 20 komentar, 34 aktivitas, 9 notifikasi,
  13 link, 9 catatan, 3 dashboard**. Semua tanggal **relatif hari ini**, sehingga demo
  selalu punya task overdue, jatuh tempo hari ini, dan yang akan datang.
  - Sheet "mesin" (`ACTIVITY`, `COMMENTS`, `CHECKLIST`, `COLLAB`, `COLLAB_STEPS`,
    `NOTIFICATIONS`, `AUTH`, `LINKS`, `DASHBOARDS`, `NOTES`) otomatis **disembunyikan**;
    hanya `Main` & `OPTIONS` yang terlihat.
- **`gas/README.md`** — panduan pasang 3 langkah, konfigurasi Script Properties, kuota, dan troubleshooting.

### Perbaikan yang ikut kena ke versi Vercel
- **Link berbagi `?view=lintas` kini juga jalan di Apps Script.** Halaman Apps Script
  berjalan di dalam iframe tanpa query string aslinya, jadi `doGet` menyuntikkan mode ke
  `window.__TT_VIEW` dan `detectViewLock()` membacanya sebagai cadangan (tetap kompatibel
  dengan versi Vercel yang membaca query string).
- **Stempel waktu tidak lagi tampil kacau.** Kolom Created At / Done At / Checked At /
  UpdatedAt dulu dibaca mentah, sehingga bisa muncul sebagai angka serial atau teks
  `"Mon Jul 28 2026 ..."`. Sekarang dirapikan lewat `stampStr_()`.
- **`formatDate_` memakai getter waktu lokal** untuk nilai bertipe Date — memakai getter
  UTC membuat tanggal mundur 1 hari di GMT+7.

### Pengujian
- Test suite baru **`test/gas.test.js`**: menjalankan `Code.gs` + `Seed.gs` sungguhan di
  Node dengan `SpreadsheetApp` tiruan yang meniru perilaku asli Sheets (string→Date,
  `TRUE`→boolean), lalu memverifikasi seed, bootstrap, ketepatan tanggal, gerbang Done,
  kunci sub-ceklis, mode tamu, PIN, dan `doGet`. **179 assertion.**
- `npm test` kini menjalankan kedua suite (78 + 179 = **257 assertion**).

---

## 1.49.0 — Collab: main-ceklis proses terkunci sampai sub-ceklis tuntas
- Di **Proses Beruntun**, checkbox utama sebuah proses **tidak bisa dicentang** selama masih ada **sub-ceklis** yang belum selesai.
  - Checkbox utama tampil **nonaktif** dengan tooltip "Selesaikan semua sub-ceklis dulu (X/Y)".
  - Badge sub-ceklis di baris proses berubah jadi **gembok (amber)** saat belum tuntas, dan **centang hijau** begitu semua sub-ceklis selesai — saat itu checkbox utama otomatis terbuka.
  - Membatalkan centang (undo) **selalu** boleh, meski sub-ceklis belum lengkap (mis. data lama yang terlanjur ter-Done).
  - Proses **tanpa** sub-ceklis tetap bisa dicentang seperti biasa.
- Aturan ini ditegakkan **di frontend dan backend**: `setCollabStepDone` menolak penandaan selesai bila sub-ceklis proses itu belum tuntas (`Selesaikan dulu semua sub-ceklis proses ini (X/Y)`), jadi tak bisa di-bypass lewat ringkasan yang kedaluwarsa.

---

## 1.48.0 — Kanban pilih banyak: perbaikan scroll + "pilih semua per kolom"
- **Perbaikan bug scroll**: memilih kartu setelah men-scroll ke bawah tidak lagi melompat balik ke atas. Toggle satu kartu kini memperbarui **hanya kartu itu** (tanpa membangun ulang board), dan semua render ulang lain (pilih semua, batal, pindah massal) **mempertahankan posisi scroll** tiap kolom.
- **Pilih semua per kolom**: di header tiap kolom (saat mode Pilih Banyak aktif) ada tombol centang:
  - Kosong → **pilih semua** kartu yang bisa dipilih di kolom itu.
  - Terisi/`N/total` → menampilkan berapa yang terpilih; klik saat semua terpilih = **batalkan semua** di kolom itu.
  - Ikon **indeterminate** saat hanya sebagian terpilih.
- Alur yang jadi cepat: klik **pilih semua** di kolom (mis. Review PM), lalu **uncheck** beberapa yang ingin dipertahankan, lalu pindahkan sisanya sekaligus — tak perlu mencentang satu per satu saat yang dipindah jauh lebih banyak dari yang ditahan.

---

## 1.47.0 — Kanban: pilih banyak kartu & pindah status sekaligus
- Tombol **Pilih Banyak** di atas board Kanban. Saat aktif:
  - Tiap kartu (task biasa) muncul **checkbox** di pojok; klik kartu = pilih/batal (bukan buka detail).
  - Bar aksi menampilkan **"N dipilih → pindahkan ke:"** dengan tombol cepat tiap status (Todo, In progress, Review PM, Revisi, Hold, Done) + **Batal pilih**.
  - **Drag salah satu kartu terpilih → semua yang terpilih ikut pindah** ke kolom tujuan sekaligus.
- Kasus utama: manager memindahkan banyak task **Review PM → Done** dalam sekali klik, tak perlu satu per satu.
- **Gerbang "Done" tetap dihormati**: user yang bukan Done-approver melihat tombol Done dalam keadaan nonaktif (dengan alasan di tooltip); percobaan pindah massal ke Done diblokir dan pilihan tetap dipertahankan agar bisa diarahkan ke status lain.
- Kartu **Task Kolaborasi** tidak bisa dipilih (statusnya turunan dari proses, bukan diset manual) — kliknya tetap membuka collab.
- Task yang sudah berada di status tujuan otomatis dilewati; perpindahan dikirim **berurutan** ke backend untuk menghindari tabrakan tulis di spreadsheet, lalu satu notifikasi ringkasan ("N task dipindahkan ke X").

---

## 1.46.0 — Filter Dashboard & Laporan + drill-down per PIC
### Dashboard — filter baru (tersedia untuk SEMUA user, manager maupun user biasa)
- **Rentang tanggal**: pilih dasar tanggalnya lewat toggle **Deadline / Dibuat**, lalu preset **Semua · Hari ini · 7 hari · 30 hari · Bulan ini**, atau isi tanggal dari–sampai sendiri (otomatis jadi mode custom).
  - Arah window ikut field: **Deadline** melihat ke **depan** (hari ini → +7/+30), **Dibuat** melihat ke **belakang** (−7/−30 → hari ini).
- **Beban Kerja**: multi-select PIC. Opsinya diambil dari task yang memang terlihat user itu (bukan master list), jadi tetap relevan buat user biasa.
- **Status** dan **Prioritas**: multi-select.
- Semua filter menyetir **seluruh dashboard sekaligus** — KPI, chart Beban Kerja per PIC, Komposisi Status, Deadline Kritis, Update Terakhir, dan Stage Paling Padat.
- Ada penghitung `X dari Y task • <rentang>` dan tombol **Reset** yang muncul saat ada filter aktif.

### Laporan — filter + interaktif
- **Filter rentang tanggal** (toggle Deadline/Dibuat + preset + custom), **filter PIC**, dan **filter Stage**.
- **Klik baris PIC → panel detail** yang menampilkan **stage apa saja yang dikerjakan user itu**, lengkap dengan bar proporsi, hitungan **aktif / selesai / overdue** per stage, dan **daftar task**-nya (klik task → buka modal task). Klik baris yang sama lagi untuk menutup.
- **Klik baris Stage** → langsung jadi filter stage (toggle), ditandai centang.
- KPI berbasis waktu otomatis ganti label: **"mgg ini"** saat rentang = Semua (perilaku lama, 7 hari terakhir tetap dipertahankan) → **"rentang"** begitu rentang diisi.
- **Export CSV** ikut membawa rentang yang dipakai, dan bila ada PIC yang sedang dibuka, ditambahkan sheet detail **stage + daftar task PIC tersebut**.

### Perbaikan
- `todayStr()` sekarang memakai **tanggal lokal**, bukan `toISOString()` — sebelumnya di UTC+7 tanggalnya mundur 1 hari kalau diakses sebelum jam 07.00 (memengaruhi penanda "telat" dan tanggal dibuat default).

---

## 1.45.0 — Task collab muncul di view task biasa (Hari Ini, List, Kanban)
- Task kolaborasi tempat Anda jadi **PIC salah satu proses** kini **ikut muncul** di **Hari Ini**, **Task List**, dan **Kanban Status** — bukan cuma di tab Task Kolaborasi.
- Ditandai jelas dengan **badge "Kolaborasi"** (ikon alur, aksen warna kartu) sehingga beda dari task biasa.
- Menampilkan **proses Anda + deadline step Anda** dan **deadline project**.
- **Diklik → langsung buka modal Task Kolaborasi** terkait.
- Di **Kanban**, kolomnya dipetakan dari step Anda: belum giliran → Todo, giliran Anda → In progress, semua step Anda selesai → Done. Kartu collab tak bisa di-drag (statusnya dari proses, bukan manual).
- Tidak mengubah Dashboard, Timeline, Calendar (tetap task biasa saja).

## 1.44.0 — Task Kolaborasi: atur ulang urutan proses (drag & tombol)
- Di mode **Edit** proses beruntun, urutan proses kini bisa **diseret (drag pakai handle ⠿)** dan diatur lewat **tombol naik/turun**.
- **Status "done" & catatan tiap proses ikut berpindah** bersama prosesnya saat urutan diubah (tidak mengikuti posisi) — dijaga lewat penanda urutan asal (`srcOrder`) sehingga progres tak tertukar.

## 1.43.2 — Warna kartu collab: tetap aksen samping + tambah Cokelat & Navy
- Warna kartu Task Kolaborasi tetap berupa **aksen garis di sisi kiri** kartu (opsi seluruh-kartu dibatalkan sesuai preferensi).
- Tambah 2 preset warna: **Navy** & **Cokelat** (total 12 warna + "tanpa warna").

## 1.43.0 — Task Kolaborasi: Alya & Dhea bisa setup, filter platform, warna kartu
- **Alya & Dhea kini bisa membuat/mengubah Task Kolaborasi** (setup alur) tanpa jadi manager penuh — konsep terpisah lewat env baru **`COLLAB_MANAGERS`** (default `Nynda,Dhea,Alya`). Manager & Dev otomatis ikut.
- **Filter Platform** ditambahkan di tab Task Kolaborasi (melengkapi filter Tipe/PIC/Status/Giliran Saya/cari).
- **Warna kartu yang bisa diatur**: pemilih warna (10 preset + "tanpa warna") di modal; kartu di **Grid & Kanban** menampilkan aksen warna di sisi kiri. Kolom baru `Color` di sheet COLLAB (otomatis).

## 1.42.0 — Sub-ceklis collab jadi fleksibel (siapa pun bisa menambah)
- **Sub-ceklis per proses** kini bisa **ditambah/dicentang/dihapus oleh siapa pun** (bukan hanya PIC proses/manager) — untuk gotong-royong antar-PIC. Mode lihat-saja tetap tak bisa.
- Tidak mengubah: **centang proses utama** tetap hanya oleh PIC proses tsb, dan **ceklis task biasa** tetap dengan aturan lamanya (PIC/Support tambah/centang, hapus manager).

## 1.41.0 — Task Kolaborasi: fix progres kartu, deadline di kartu, filter
- **Fix**: progres di kartu (mis. 0/9) tak ikut ter-update setelah mencentang proses di modal — kini kartu grid/kanban **segera menyegarkan** progres saat proses dicentang & saat modal ditutup.
- **Deadline di kartu**: deadline project kini tampil di kartu (grid & kanban), dengan flag **"telat"** merah bila lewat.
- **Filter tab Task Kolaborasi**: kotak **cari** (judul/PIC/proses/tipe), plus filter **Tipe**, **PIC**, **Status** (Aktif/Selesai), dan toggle **"Giliran Saya"**. Berlaku di tampilan Grid & Kanban; ada penghitung "X dari Y" + tombol Reset.

## 1.40.0 — Hemat kuota Google Sheets (perbaiki error "Read requests per minute")
- **Penyebab**: app membaca Spreadsheet satu-per-satu; `getBootstrapData` melakukan ~11 pembacaan sekaligus, dan auto-refresh tiap pindah tab mengulanginya → menabrak batas Google (60 read/menit per service account).
- **Perbaikan**:
  - **`getBootstrapData` kini 1 batch** (`values.batchGet`) → dari ~11 read jadi **±2 read** (1 metadata + 1 batch). Bila batch gagal (mis. sheet belum ada), otomatis fallback ke baca satu-satu (tidak error).
  - **`getCollabs` di-batch** (COLLAB + COLLAB_STEPS) → dari 2 read jadi **1**. Dipakai di banyak tempat (modal, refresh, tiap simpan/centang collab).
  - **Auto-refresh dibuat hemat**: throttle **5 dtk → 20 dtk**, dan **dilewati saat tab tak terlihat** (`document.hidden`).
  - **`ensure*Sheet` di-memo per-instance** (collab, checklist, comments, notif): tak baca ulang header pada tiap tulis; reset otomatis tiap cold start.
- Total: pembacaan berulang turun **~10–16×**. Error kuota semestinya hilang di pemakaian normal.

## 1.39.0 — Task Kolaborasi: Kanban per-tipe task
- Tab Task Kolaborasi kini punya **toggle Grid ↔ Kanban**. Kanban mengelompokkan task berdasarkan **tipe** (bukan status): **Course · Tryout/Latsol · Liveclass · Drilling · Journey**, plus kolom **"Tanpa Tipe"**.
- **Seret kartu antar kolom** untuk mengubah tipe task (manager/Dev saja) — mirip Kanban Status.
- Field **Tipe Task** baru di modal (opsional); ditampilkan sebagai chip ungu di kartu.
- Kolom baru **`Type`** di sheet COLLAB (dibuat/ditambah otomatis).

## 1.38.0 — Task Kolaborasi: perbaikan modal panjang + tombol Simpan manager
- **Modal tak lagi "jebol" saat proses banyak**: kartu modal kini dibatasi tinggi layar; kolom kiri (proses) & kanan (komentar) scroll di dalam, footer (Tutup/Simpan/Hapus) tetap menempel di bawah. Sebelumnya proses yang panjang meluber ke bawah footer.
- **Tombol Simpan selalu tersedia untuk manager** — bisa langsung ganti judul/platform/deskripsi/deadline lalu Simpan tanpa harus masuk mode "Edit" dulu. Menyimpan di mode baca mempertahankan proses & progres yang ada (hanya field kepala yang diperbarui).

## 1.37.0 — Task Kolaborasi: platform bisa lebih dari 1
- Pilihan **Platform** di Task Kolaborasi kini **multi-select** (Ctrl/Cmd untuk pilih beberapa) — sama seperti task biasa. Disimpan dipisah koma; di kartu tampil sebagai beberapa chip terpisah.

## 1.36.0 — Tag @everyone + log aktivitas khusus manager
- **`@everyone`** (alias `@semua` / `@all`) di komentar Task Kolaborasi → menotifikasi **semua user** sekaligus (kecuali penulis & mode lihat-saja). Muncul di autocomplete (ikon grup) & tersorot di feed.
- **Log aktivitas** (centang proses, buat/ubah, handoff) kini **hanya tampil untuk manager/Dev**; user biasa cukup melihat **komentar** saja. Judul panel ikut menyesuaikan ("Komentar" vs "Komentar & Aktivitas").
- Baris **"Comment: …"** di log dibuang (duplikat dengan kartu komentar) — feed jadi lebih bersih.

## 1.35.0 — Task Kolaborasi: notes proses, tag @user, sub-ceklis, auto-refresh, deadline project
- **Layout modal 2 kolom**: alur proses + sub-ceklis di kiri, **Komentar & Aktivitas di panel kanan** (seperti referensi), bukan lagi di bawah.
- **Catatan per proses (PIC note)**: tiap proses punya field catatan — mis. minta tambahan deadline. Diisi oleh PIC proses itu atau manager.
- **Tag @user di komentar**: ketik `@` → autocomplete nama; user yang di-tag dapat **notifikasi lonceng** di header (badge angka + daftar; klik → buka collab & tandai terbaca). Mention disorot di feed.
- **Sub-ceklis per proses** (2 tingkat: daftar proses = ceklis utama, tiap proses punya sub-ceklis pengerjaan). Yang bisa menambah/mencentang/menghapus sub-item: **PIC proses itu + manager/Dev**. Disimpan via sheet CHECKLIST (id `COL-xxx#N`).
- **Deadline project keseluruhan** — selain deadline tiap proses, ada 1 deadline untuk seluruh task (flag telat).
- **Auto-refresh** dari Spreadsheet **saat pindah tab** (throttle 5 detik, dilewati saat ada modal terbuka) — progres & notifikasi tag terbaru langsung terlihat.
- Sheet baru **`NOTIFICATIONS`**; kolom baru: `Deadline` (COLLAB), `Note` (COLLAB_STEPS) — dibuat/ditambah otomatis.

## 1.34.0 — Task Kolaborasi (alur proses beruntun antar-PIC)
- Tab baru **"Task Kolaborasi"** (grup Kolaborasi): task dengan **rangkaian proses berurutan**, tiap proses punya **PIC & deadline sendiri** (mis. *"5 Paket TO dan Latsol"* → Alya: kurikulum → Dhika: soal → Uma: QC).
- **Dibuat manager/Dev saja**, ringkas — cukup **platform + judul + daftar proses**; tidak terikat rumus stage/verb/objek task normal, dan **tidak dihitung** di Dashboard/Kanban task biasa.
- **Hanya PIC proses** (atau Dev) yang bisa mencentang prosesnya — ditegakkan di UI **dan** server. Urutan fleksibel (tak dikunci), tapi dipakai untuk logika giliran.
- **Notifikasi dalam-app**: badge angka di tab + banner "Giliran Anda" + highlight kartu. Giliran = proses milik Anda yang belum selesai & proses sebelumnya sudah selesai (handoff sampai ke Anda).
- **Progres X/N + bar**, flag **overdue per proses**, dan panel **Komentar & Aktivitas** (komentar via sheet COMMENTS + log handoff dari ACTIVITY).
- Manager bisa **edit struktur** (tambah/hapus/ubah proses & PIC & deadline) lewat tombol "Edit"; status centang proses lama dipertahankan saat struktur diedit.
- Penyimpanan: sheet baru **`COLLAB`** + **`COLLAB_STEPS`**, dibuat otomatis. Mode lihat-saja tidak melihat tab ini.

## 1.33.0 — Duplikat task (pakai task lama sebagai template)
- Tombol **Duplikat** untuk membuat task baru dari task yang mirip (mis. beda judul saja) tanpa mengisi ulang dari nol. Ada di **footer modal task** dan sebagai **ikon salin di kartu Kanban** (muncul saat hover di desktop, selalu tampil di HP).
- Hasil duplikat adalah **task baru dengan Task ID sendiri** — dihitung terpisah, bukan menimpa/berbagi dengan task asal. Yang diambil hanya isian template-nya.
- **Reset cerdas**: yang disalin = Stage, Kata Kerja, Objek, Jumlah, Detail, Platform, PIC, Support, Priority, Document, PM Notes. Yang di-reset = Status→Todo, Due Date & PIC Notes dikosongkan, Created Date→hari ini, Task ID baru.
- **Ceklis ikut tersalin** (semua item, dalam keadaan belum tercentang) sehingga template langkah kerja terbawa; dikirim ke server setelah task duplikat disimpan.
- Duplikat dari **modal** memakai nilai form saat itu (perubahan yang belum disimpan ikut tersalin, tidak hilang). Task **lintas divisi** hanya bisa diduplikat manager/Dev.

## 1.32.0 — Ceklis pengerjaan per task (PM menyusun, PIC mencentang)
- Tiap task kini punya **Ceklis Pengerjaan** di modal task (di antara detail & chat): PM menuliskan **langkah / output yang diharapkan**, PIC **mencentangnya** sambil mengerjakan. Melengkapi fitur chat yang sudah ada.
- **Hak akses**: PM/Dev **dan** PIC/Support task itu bisa **menambah** & **mencentang**; **hanya PM/Dev yang bisa menghapus** item (item dari PM tak bisa dihilangkan PIC). Ditegakkan di UI **dan** server.
- **Indikator progres**: bar + hitungan `2/4` di modal, plus **chip progres di kartu Kanban** (berubah hijau bila semua tercentang).
- Saat **membuat task baru** (belum ada ID), item ceklis ditampung dulu lalu otomatis dikirim setelah task tersimpan — jadi PM bisa langsung menyusun ceklis sambil membuat tugas.
- Ceklis **tidak memblokir** perpindahan status (mis. ke "Review PM") — murni panduan & indikator.
- Penyimpanan: sheet baru **`CHECKLIST`** (`Task ID | Item | Done | Created By | Checked By | Checked At`), dibuat otomatis. Mode lihat-saja (Lintas) tidak melihat ceklis.

## 1.31.0 — Done approver (Nynda, Dhea, Alya) + tab dikelompokkan
- **Siapa yang boleh set "Done"** kini: **Nynda, Dhea, Alya** (+ Dev). Sebelumnya hanya manager.
- Izin Done dibuat **terpisah dari hak manager**: Dhea & Alya **tetap Member** (hanya lihat task sendiri, tak bisa task lintas divisi / Laporan / Fokus PIC) — mereka **hanya** dapat tambahan wewenang menutup task ke "Done".
- Daftar approver bisa diubah lewat env baru **`DONE_APPROVERS`** (default `Nynda,Dhea,Alya`). Manager (`MANAGERS`) & Dev otomatis ikut boleh. Pesan penolakan menyebut nama approver secara otomatis.
- **Sidebar dikelompokkan** jadi 5 grup berjudul: **Ringkasan** (Hari Ini, Dashboard, Dashboard Lain) · **Task** (Kanban, Task List, Timeline, Calendar) · **Kolaborasi** (Komunikasi) · **Ruang Saya** (Link Saya, Catatan Saya) · **Manajer** (Laporan, Riwayat Aktivitas, Dropdown Master).
- Judul grup **otomatis ikut sembunyi** bila semua tab di dalamnya tak berlaku untuk peran itu (mis. grup "Manajer" tak muncul untuk Member, "Ruang Saya" tak muncul di mode lihat-saja).

## 1.30.0 — Mode Dev tersembunyi (trigger rahasia)
- Opsi **"Dev"** kini **disembunyikan** dari halaman pilih identitas dan dropdown **Mode User** — supaya bisa dites sebagai user biasa. Tidak ada lagi tombol Dev yang terlihat.
- Masuk Mode Dev lewat **trigger rahasia**: **tekan-tahan logo ProductTrack ~2 detik** (di sidebar) → muncul prompt **PIN Dev**. Jalan di desktop maupun HP (di HP: buka menu/sidebar dulu).
- **Tetap butuh kredensial**: PIN Dev diatur via env `DEV_PIN` (nilai tak ditulis di sini), diverifikasi di server — berlaku walau PIN per-user sudah di-set. Login **email dev** (Google) tetap langsung jadi Dev tanpa PIN.
- **Selalu tersembunyi**: setelah pindah dari Dev ke user biasa, harus ulangi trigger + PIN untuk kembali ke Dev. Saat sedang aktif sebagai Dev, mode-nya tetap tampil di switcher agar jelas.
- Dev = super-user testing: melihat semua task & bisa semua aksi (termasuk menetapkan "Done").

## 1.29.0 — Status "Done" hanya untuk manager
- Status **"Done"** kini **hanya bisa ditetapkan oleh manager (Nynda) / Dev**. User biasa (PIC lain) maksimal memindahkan task sampai **"Review PM"** — dari situ manager yang memutuskan Done.
- Opsi "Done" **disembunyikan** dari dropdown status (tabel List & modal task) untuk non-manager, kecuali task-nya memang sudah Done. Mencoba men-drag kartu ke kolom **Done** di Kanban akan ditolak dengan pesan dan kartu kembali ke posisi semula.
- Task yang **sudah** Done tetap **boleh ditarik balik** oleh user biasa (mis. ke Revisi/In progress) — yang dilarang hanya aksi *menetapkan* Done.
- Ditegakkan **dua lapis**: UI (`public/index.html`) dan **backend** (`api/_sheets.js` pada `saveTask` & `quickUpdateField`) sehingga tak bisa diakali lewat request langsung. Daftar manager mengikuti env `MANAGERS` (default `Nynda`).

## 1.28.1 — Perbaikan: PIN identitas selalu diminta
- Fix: di halaman "Masuk sebagai siapa?", memilih identitas yang **kebetulan sama dengan default** (mis. Nynda saat baru reset) tak lagi melewati PIN per-user. Sekarang PIN identitas **selalu** diminta bila di-set (Nynda, Dev, dll.), apa pun default-nya.

## 1.28.0 — Halaman pilih identitas (login PIN)
- Setelah masuk pakai **PIN akses penuh** (env `ACCESS_PIN`), muncul halaman **"Masuk sebagai siapa?"** dulu — tidak langsung jatuh ke mode Manager. Pilih identitas (PIC / Dev), baru masuk dashboard. Pilihan diingat; ada tombol **"Ganti identitas"** di kotak Mode User untuk memilih ulang.
- Menghormati PIN per-user yang sudah ada (kalau identitas terkunci PIN, tetap diminta). **Admin (login Google)** dan **mode lihat-saja** (env `VIEW_PIN`) tidak menampilkan halaman ini — mereka sudah teridentifikasi.

## 1.27.0 — Login Google (OAuth) untuk admin
- Ganti kotak "email admin" (yang bisa dipalsukan) dengan tombol **Masuk dengan Google**. Google memverifikasi email ASLI; backend cek tanda tangan token + daftar email admin, lalu menerbitkan **sesi ber-tanda-tangan (HMAC)** 30 hari. Email admin kini **tidak lagi dipercaya dari header mentah** — hanya dari sesi terverifikasi.
- Nynda & administrator: klik Masuk dengan Google → **langsung akses penuh tanpa PIN**, dan **bisa ganti mode user** (bug "terkunci" saat login email diperbaiki — admin diperlakukan bebas seperti Dev).
- PIN diatur via env: **`ACCESS_PIN`** (akses penuh) & **`VIEW_PIN`** (lihat-saja) untuk yang bukan admin.
- Env baru di Vercel: `GOOGLE_CLIENT_ID` (dari Google Cloud) + `SESSION_SECRET` (teks acak). Bila keduanya kosong, tombol Google tak muncul (app tetap jalan dengan PIN).

## 1.26.0 — Gerbang PIN ganda + auto-login admin
- Gerbang kini **memblokir total** (tak ada isi yang terlihat) sampai lolos salah satu: **PIN penuh** (env `ACCESS_PIN`), **PIN lihat-saja** (env `VIEW_PIN`), atau **email admin terdaftar** (`administrator@officecerebrum.com` / `nyndaramadhanti@cerebrum.id`) yang **langsung masuk tanpa PIN**.
- Popup PIN muncul dari awal untuk selain admin — **PIN saja, tanpa input email**. PIN penuh → kelola task; PIN lihat → mode Lintas (lihat-saja + chat).
- Email admin bisa ditambah/ubah via env `AUTHORIZED_EMAILS` (default sudah berisi dua email di atas). PIN tersimpan di perangkat agar tak perlu ketik ulang.
- Catatan keamanan: karena belum ada login Google, "email admin" dikenali dari yang diketik/diingat perangkat (bisa dipalsukan) — PIN tetap gerbang utama.

## 1.25.0 — Gerbang PIN + fallback lihat-saja
- Akses penuh kini butuh **PIN 6 digit** (di-set lewat env `ACCESS_PIN` di Vercel — bukan di kode, jadi tidak bocor di repo publik). Tanpa/salah PIN, siapa pun yang membuka app otomatis masuk **mode lihat-saja (Lintas)**: hanya melihat task eksternal + yang di-mirror, boleh chat, tidak bisa edit.
- Server hanya mengirim **data terbatas** ke tamu (bukan semua task), dan menolak semua aksi tulis tanpa PIN — jadi link app boleh tetap publik/terhubung GitHub tanpa risiko orang awam mengubah data.
- Tombol **"Masuk penuh (PIN)"** di sidebar untuk tamu; gerbang login diubah jadi input PIN (email opsional untuk memilih mode). Kompatibel mundur dengan `APP_PASSWORD` lama.

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
