# Changelog — ProductTrack

Format versi: **MAJOR.MINOR.PATCH**
- PATCH naik untuk perbaikan kecil (mis. 1.22.0 → 1.22.1)
- MINOR naik untuk fitur baru (mis. 1.22.0 → 1.23.0)
- MAJOR naik untuk perubahan besar/breaking

Versi terpasang ditampilkan di **sidebar** (samping logo) dan di **Dropdown Master**.
Sumber versi: konstanta `APP_VERSION` di `public/index.html`.

---

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
