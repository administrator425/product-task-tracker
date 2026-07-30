/**
 * ============================================================
 * PRODUCTTRACK — SETUP & DATA DUMMY
 *
 * Jalankan sekali setelah menyalin spreadsheet:
 *   Menu "⚡ ProductTrack" > "Setup + Isi Data Dummy"
 *
 * Semua tanggal dibuat RELATIF terhadap hari ini, jadi demo selalu terlihat
 * hidup: ada yang overdue, jatuh tempo hari ini, dan yang akan datang.
 * ============================================================
 */

/* ================================================================== */
/* MENU                                                               */
/* ================================================================== */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚡ ProductTrack')
    .addItem('1. Setup + Isi Data Dummy', 'seedDummyData')
    .addItem('2. Setup saja (tanpa data dummy)', 'setupOnly')
    .addSeparator()
    .addItem('Sembunyikan sheet internal', 'hideInternalSheets')
    .addItem('Tampilkan semua sheet', 'showAllSheets')
    .addSeparator()
    .addItem('Kosongkan SEMUA data', 'clearAllDataConfirm')
    .addToUi();
}

function setupOnly() {
  setupTaskTracker();
  seedFormulaTemplate();
  hideInternalSheets();
  toast_('Setup selesai. Sheet & dropdown siap dipakai.');
}

/* ================================================================== */
/* SHEET YANG DISEMBUNYIKAN                                           */
/* ================================================================== */

// Sheet "mesin" — dikelola aplikasi, tidak perlu dilihat/diedit manual.
// Main, OPTIONS, dan USERS sengaja dibiarkan terlihat karena memang sering dilihat/diedit.
var HIDDEN_SHEETS = [
  'ACTIVITY', 'COMMENTS', 'CHECKLIST', 'COLLAB', 'COLLAB_STEPS',
  'NOTIFICATIONS', 'AUTH', 'LINKS', 'DASHBOARDS', 'NOTES'
];

function hideInternalSheets() {
  var ss = ss_();
  var hidden = 0;
  HIDDEN_SHEETS.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && !sh.isSheetHidden()) { sh.hideSheet(); hidden++; }
  });
  toast_(hidden + ' sheet internal disembunyikan.');
}

function showAllSheets() {
  var ss = ss_();
  ss.getSheets().forEach(function (sh) { if (sh.isSheetHidden()) sh.showSheet(); });
  toast_('Semua sheet ditampilkan.');
}

function toast_(msg) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'ProductTrack', 8); }
  catch (e) { Logger.log(msg); }
}

/* ================================================================== */
/* HELPER TANGGAL RELATIF                                             */
/* ================================================================== */

function seedDate_(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function seedStamp_(offsetDays, hhmm) {
  return seedDate_(offsetDays) + ' ' + (hhmm || '09:00') + ':00';
}

/* ================================================================== */
/* DATA DUMMY — TASK                                                  */
/* ================================================================== */
/*
 * c  = dibuat (hari relatif)      d   = deadline (hari relatif)
 * st = status                     pr  = priority
 * n  = nama task                  sg  = stage           pf = platform
 * pic= PIC                        sup = support         doc= dokumen
 * pn = catatan PIC                mn  = catatan PM
 * dv = divisi tujuan (lintas)     kd  = kontak divisi
 * vb/jm/ob/dt = rumus nama task (kata kerja / jumlah / objek / detail)
 * by = dibuat oleh                mr  = tampil di Lintas Divisi ('Ya')
 */
var DUMMY_TASKS = [
  // ---------- Selesai (14) ----------
  { c: -52, d: -40, st: 'Done', pr: 'Normal', n: 'Melakukan QC 50 video pembahasan BAPPENAS', sg: 'QC Konten', pf: 'JadiASN', pic: 'Staff QC', sup: '', doc: 'Paket 5 — Batch A', pn: 'Semua lolos QC, 3 video retake ringan.', mn: '', vb: 'Melakukan', jm: '50', ob: 'QC', dt: 'video pembahasan BAPPENAS', by: 'Manager' },
  { c: -48, d: -38, st: 'Done', pr: 'High', n: 'Menyusun kurikulum SNBT 2026', sg: 'RnD', pf: 'Cerebrum', pic: 'Leader Konten', sup: 'Manager', doc: 'Draft Kurikulum SNBT', pn: 'Sudah disetujui PM.', mn: 'Bagus, lanjut ke blueprint soal.', vb: 'Menyusun', jm: '1', ob: 'kurikulum', dt: 'SNBT 2026', by: 'Manager' },
  { c: -45, d: -35, st: 'Done', pr: 'Normal', n: 'Menginput 120 soal TIU ke SIADU', sg: 'Input', pf: 'Siadu', pic: 'Staff Input', sup: 'Staff Materi', doc: 'Bank Soal TIU Batch 7', pn: '', mn: '', vb: 'Menginput', jm: '120', ob: 'soal', dt: 'TIU batch 7', by: 'Manager' },
  { c: -44, d: -33, st: 'Done', pr: 'Low', n: 'Membuat query rekap pembelian per platform', sg: 'Data & Intelligence', pf: 'All Platform', pic: 'Staff Data', sup: '', doc: 'Query Rekap v2', pn: 'Query sudah dipakai tim Sales.', mn: '', vb: 'Membuat', jm: '1', ob: 'query', dt: 'rekap pembelian', by: 'Staff Data' },
  { c: -40, d: -30, st: 'Done', pr: 'Urgent', n: 'Generate ulang paket Tryout JadiPPPK', sg: 'Manajemen Sistem', pf: 'JadiPPPK', pic: 'Leader Sistem', sup: 'Staff Input', doc: '', pn: 'Paket 1—12 sudah regenerate.', mn: 'Cek ulang skor template.', vb: 'Generate/regenerate', jm: '12', ob: 'paket', dt: 'Tryout JadiPPPK', by: 'Manager' },
  { c: -38, d: -28, st: 'Done', pr: 'Normal', n: 'Mengambil video pembahasan Numerik 40 soal', sg: 'Develop Materi', pf: 'JadiASN', pic: 'Staff Soal', sup: 'Staff Liveclass', doc: 'Studio Booking #22', pn: '', mn: '', vb: 'Mengambil (take)', jm: '40', ob: 'video pembahasan', dt: 'Numerik', by: 'Manager' },
  { c: -35, d: -25, st: 'Done', pr: 'High', n: 'Mendistribusikan proyek komplit ke 12 guru', sg: 'Manajemen Guru', pf: 'All Platform', pic: 'Staff Liveclass', sup: '', doc: 'Sheet Distribusi Juni', pn: 'Semua guru sudah konfirmasi.', mn: '', vb: 'Mendistribusikan', jm: '12', ob: 'proyek komplit', dt: 'batch Juni', by: 'Manager' },
  { c: -33, d: -22, st: 'Done', pr: 'Normal', n: 'Menyelesaikan report bulanan progres konten', sg: 'Report', pf: 'All Platform', pic: 'Manager', sup: 'Staff Data', doc: 'Report Konten Mei', pn: '', mn: '', vb: 'Menyelesaikan', jm: '1', ob: 'report', dt: 'bulanan Mei', by: 'Manager' },
  { c: -30, d: -20, st: 'Done', pr: 'Normal', n: 'Melakukan QC 80 soal Verbal Analogi', sg: 'QC Konten', pf: 'JadiBUMN', pic: 'Staff QC', sup: '', doc: '', pn: '12 soal dikembalikan untuk revisi.', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -28, d: -18, st: 'Done', pr: 'High', n: 'Menyusun silabus Liveclass TWK', sg: 'RnD', pf: 'JadiASN', pic: 'Leader Konten', sup: 'Staff Materi', doc: 'Silabus TWK v3', pn: '', mn: 'Sudah sesuai kisi-kisi terbaru.', vb: 'Menyusun', jm: '1', ob: 'silabus', dt: 'Liveclass TWK', by: 'Manager' },
  { c: -25, d: -15, st: 'Done', pr: 'Normal', n: 'Melakukan scraping tren pembahasan SNBT di X', sg: 'Data & Intelligence', pf: 'Cerebrum', pic: 'Staff Data', sup: '', doc: 'Dataset Scraping SNBT', pn: '4.200 post terkumpul.', mn: '', vb: 'Melakukan', jm: '1', ob: 'scraping', dt: 'tren SNBT', by: 'Staff Data' },
  { c: -22, d: -12, st: 'Done', pr: 'Low', n: 'Memperbarui thumbnail 30 video Jago TPA', sg: 'QC Konten', pf: 'Jago TPA', pic: 'Staff Input', sup: '', doc: '', pn: '', mn: '', vb: 'Memperbarui', jm: '30', ob: 'thumbnail', dt: 'Jago TPA', by: 'Manager' },
  { c: -20, d: -9, st: 'Done', pr: 'Normal', n: 'Menginput jadwal liveclass Juli', sg: 'Input', pf: 'JadiPPPK', pic: 'Staff Materi', sup: 'Staff Liveclass', doc: 'Kalender Liveclass', pn: '', mn: '', vb: 'Menginput', jm: '1', ob: 'jadwal', dt: 'liveclass Juli', by: 'Manager' },
  { c: -18, d: -6, st: 'Done', pr: 'High', n: 'Membuat 60 soal Penalaran Umum', sg: 'Develop Soal', pf: 'JadiSekdin', pic: 'Staff Soal', sup: 'Staff QC', doc: 'Bank Soal PU', pn: 'Selesai + pembahasan.', mn: '', vb: 'Membuat', jm: '60', ob: 'soal', dt: 'Penalaran Umum', by: 'Manager' },

  // ---------- Sedang dikerjakan (12) ----------
  { c: -30, d: -8, st: 'In progress', pr: 'Urgent', n: 'Membuat 200 soal Latsol JadiOJK', sg: 'Develop Soal', pf: 'JadiOJK', pic: 'Staff Soal', sup: 'Staff Materi', doc: 'Bank Soal OJK', pn: 'Baru 120 soal, butuh 3 hari lagi.', mn: 'Prioritaskan, ini blocker paket TO.', vb: 'Membuat', jm: '200', ob: 'soal', dt: 'Latsol JadiOJK', by: 'Manager' },
  { c: -26, d: -5, st: 'In progress', pr: 'High', n: 'Melakukan QC 100 video pembahasan Kedinasan', sg: 'QC Konten', pf: 'JadiSekdin', pic: 'Staff QC', sup: '', doc: '', pn: '68/100 selesai.', mn: '', vb: 'Melakukan', jm: '100', ob: 'QC', dt: 'video Kedinasan', by: 'Manager' },
  { c: -24, d: -3, st: 'In progress', pr: 'Normal', n: 'Menyusun materi Journey JadiPolisi', sg: 'Develop Materi', pf: 'JadiPolisi', pic: 'Leader Konten', sup: 'Staff Materi', doc: 'Journey Polisi v1', pn: 'Menunggu approval struktur bab.', mn: '', vb: 'Menyusun', jm: '1', ob: 'journey', dt: 'JadiPolisi', by: 'Manager' },
  { c: -20, d: 0, st: 'In progress', pr: 'Urgent', n: 'Menginput 150 soal Latsol ke Markaz', sg: 'Input', pf: 'Markaz', pic: 'Staff Input', sup: 'Leader Sistem', doc: 'Batch Input Markaz', pn: 'Deadline hari ini, 130 sudah masuk.', mn: '', vb: 'Menginput', jm: '150', ob: 'soal', dt: 'Latsol Markaz', by: 'Manager' },
  { c: -18, d: 1, st: 'In progress', pr: 'High', n: 'Membangun dashboard retensi siswa', sg: 'Data & Intelligence', pf: 'All Platform', pic: 'Staff Data', sup: 'Manager', doc: 'Dashboard Retensi', pn: 'Chart cohort sudah jalan.', mn: 'Tambahkan filter per platform.', vb: 'Membangun', jm: '1', ob: 'dashboard', dt: 'retensi siswa', by: 'Staff Data', mr: 'Ya' },
  { c: -16, d: 2, st: 'In progress', pr: 'Normal', n: 'Merapikan subbab kategori JadiBUMN', sg: 'Manajemen Sistem', pf: 'JadiBUMN', pic: 'Leader Sistem', sup: '', doc: '', pn: '', mn: '', vb: 'Merapikan', jm: '1', ob: 'subbab', dt: 'JadiBUMN', by: 'Manager' },
  { c: -14, d: 3, st: 'In progress', pr: 'Normal', n: 'Mengambil video pembahasan TWK 35 soal', sg: 'Develop Materi', pf: 'JadiASN', pic: 'Staff Soal', sup: 'Staff Liveclass', doc: 'Studio Booking #31', pn: '', mn: '', vb: 'Mengambil (take)', jm: '35', ob: 'video pembahasan', dt: 'TWK', by: 'Manager' },
  { c: -12, d: 6, st: 'In progress', pr: 'High', n: 'Menyusun paket Tryout Beasiswa LPDP', sg: 'Develop Soal', pf: 'JadiBeasiswa', pic: 'Staff Materi', sup: 'Staff Soal', doc: 'Paket TO LPDP', pn: 'Paket 1—3 siap.', mn: '', vb: 'Menyusun', jm: '5', ob: 'paket tryout', dt: 'Beasiswa LPDP', by: 'Manager', mr: 'Ya' },
  { c: -10, d: 8, st: 'In progress', pr: 'Normal', n: 'Memonitor liveclass batch Agustus', sg: 'Liveclass', pf: 'JadiPPPK', pic: 'Staff Liveclass', sup: 'Staff Materi', doc: '', pn: '', mn: '', vb: 'Memonitor', jm: '1', ob: 'liveclass', dt: 'batch Agustus', by: 'Manager' },
  { c: -9, d: 10, st: 'In progress', pr: 'Low', n: 'Membuat prompt AI untuk draft soal', sg: 'RnD', pf: 'Cerebrum', pic: 'Staff Data', sup: 'Leader Konten', doc: 'Prompt Library', pn: 'Uji coba di 3 tipe soal.', mn: '', vb: 'Membuat', jm: '1', ob: 'prompt', dt: 'draft soal otomatis', by: 'Staff Data' },
  { c: -8, d: 12, st: 'In progress', pr: 'Normal', n: 'Melakukan QC 60 soal Figural', sg: 'QC Konten', pf: 'Jago TPA', pic: 'Staff QC', sup: '', doc: '', pn: '', mn: '', vb: 'Melakukan', jm: '60', ob: 'QC', dt: 'soal Figural', by: 'Manager' },
  { c: -7, d: 14, st: 'In progress', pr: 'High', n: 'Menyusun kerangka kategori Toefl Academy', sg: 'Manajemen Sistem', pf: 'Toefl Academy', pic: 'Leader Sistem', sup: 'Leader Konten', doc: '', pn: '', mn: 'Samakan dengan struktur Markaz.', vb: 'Menyusun', jm: '1', ob: 'kerangka kategori', dt: 'Toefl Academy', by: 'Manager' },

  // ---------- Belum dikerjakan (10) ----------
  { c: -6, d: -2, st: 'Todo', pr: 'Urgent', n: 'Menginput 90 video pembahasan Prajurit', sg: 'Input', pf: 'JadiPrajurit', pic: 'Staff Input', sup: '', doc: '', pn: '', mn: 'Sudah lewat deadline, mohon dikejar.', vb: 'Menginput', jm: '90', ob: 'video pembahasan', dt: 'JadiPrajurit', by: 'Manager' },
  { c: -6, d: 0, st: 'Todo', pr: 'High', n: 'Membuat 45 soal Numerik Deret', sg: 'Develop Soal', pf: 'JadiASN', pic: 'Staff Soal', sup: '', doc: '', pn: '', mn: '', vb: 'Membuat', jm: '45', ob: 'soal', dt: 'Numerik Deret', by: 'Manager' },
  { c: -5, d: 2, st: 'Todo', pr: 'Normal', n: 'Menyusun panduan belajar JadiPCPM', sg: 'RnD', pf: 'JadiPCPM', pic: 'Leader Konten', sup: '', doc: '', pn: '', mn: '', vb: 'Menyusun', jm: '1', ob: 'panduan', dt: 'JadiPCPM', by: 'Manager' },
  { c: -5, d: 5, st: 'Todo', pr: 'Normal', n: 'Mendistribusikan proyek video ke 8 guru', sg: 'Manajemen Guru', pf: 'All Platform', pic: 'Staff Liveclass', sup: '', doc: '', pn: '', mn: '', vb: 'Mendistribusikan', jm: '8', ob: 'proyek video pembahasan', dt: 'batch Agustus', by: 'Manager' },
  { c: -4, d: 7, st: 'Todo', pr: 'Low', n: 'Membuat query funnel pembayaran', sg: 'Data & Intelligence', pf: 'All Platform', pic: 'Staff Data', sup: '', doc: '', pn: '', mn: '', vb: 'Membuat', jm: '1', ob: 'query', dt: 'funnel pembayaran', by: 'Staff Data' },
  { c: -4, d: 9, st: 'Todo', pr: 'Normal', n: 'Melakukan QC 40 soal Verbal Silogisme', sg: 'QC Konten', pf: 'JadiBUMN', pic: 'Staff QC', sup: '', doc: '', pn: '', mn: '', vb: 'Melakukan', jm: '40', ob: 'QC', dt: 'Verbal Silogisme', by: 'Manager' },
  { c: -3, d: 11, st: 'Todo', pr: 'High', n: 'Menyusun materi Drilling Numerik', sg: 'Develop Materi', pf: 'Cerebrum', pic: 'Staff Materi', sup: 'Leader Konten', doc: '', pn: '', mn: '', vb: 'Menyusun', jm: '1', ob: 'materi', dt: 'Drilling Numerik', by: 'Manager', mr: 'Ya' },
  { c: -3, d: 15, st: 'Todo', pr: 'Normal', n: 'Menginput jadwal liveclass September', sg: 'Input', pf: 'JadiPPPK', pic: 'Staff Input', sup: 'Staff Liveclass', doc: '', pn: '', mn: '', vb: 'Menginput', jm: '1', ob: 'jadwal', dt: 'liveclass September', by: 'Manager' },
  { c: -2, d: 18, st: 'Todo', pr: 'Low', n: 'Melakukan riset kompetitor platform CPNS', sg: 'RnD', pf: 'Cerebrum', pic: 'Manager', sup: 'Staff Data', doc: '', pn: '', mn: '', vb: 'Melakukan', jm: '1', ob: 'riset', dt: 'kompetitor CPNS', by: 'Manager' },
  { c: -2, d: 21, st: 'Todo', pr: 'Normal', n: 'Generate paket TO SNBT batch 4', sg: 'Manajemen Sistem', pf: 'Cerebrum', pic: 'Leader Sistem', sup: '', doc: '', pn: '', mn: '', vb: 'Generate/regenerate', jm: '4', ob: 'paket', dt: 'TO SNBT batch 4', by: 'Manager' },

  // ---------- Menunggu review PM (6) ----------
  { c: -15, d: -1, st: 'Review PM', pr: 'High', n: 'Review materi Liveclass Numerik', sg: 'Liveclass', pf: 'JadiASN', pic: 'Staff Data', sup: '', doc: 'Materi Liveclass Numerik', pn: 'Menunggu review PM.', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -13, d: 3, st: 'Review PM', pr: 'Normal', n: 'Review 120 soal Latsol JadiASN', sg: 'Develop Soal', pf: 'JadiASN', pic: 'Staff Soal', sup: 'Staff QC', doc: '', pn: 'Sudah lengkap dengan pembahasan.', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -11, d: 4, st: 'Review PM', pr: 'High', n: 'Review kurikulum Journey PPPK', sg: 'RnD', pf: 'JadiPPPK', pic: 'Leader Konten', sup: '', doc: 'Kurikulum Journey PPPK', pn: '', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -10, d: 6, st: 'Review PM', pr: 'Normal', n: 'Review report mingguan konten', sg: 'Report', pf: 'All Platform', pic: 'Staff Materi', sup: '', doc: '', pn: '', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -9, d: 8, st: 'Review PM', pr: 'Urgent', n: 'Review dashboard Data Intelligence', sg: 'Data & Intelligence', pf: 'All Platform', pic: 'Staff Data', sup: 'Leader Sistem', doc: 'Dashboard v3', pn: '', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Staff Data' },
  { c: -8, d: 9, st: 'Review PM', pr: 'Normal', n: 'Review 50 video pembahasan OJK', sg: 'QC Konten', pf: 'JadiOJK', pic: 'Staff QC', sup: '', doc: '', pn: '', mn: '', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },

  // ---------- Revisi (3) ----------
  { c: -17, d: -4, st: 'Revisi', pr: 'High', n: 'Perbaikan 30 soal Verbal hasil review PM', sg: 'Develop Soal', pf: 'JadiASN', pic: 'Staff Soal', sup: '', doc: '', pn: '', mn: 'Perbaiki opsi pengecoh di 30 soal ini.', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -12, d: 2, st: 'Revisi', pr: 'Normal', n: 'Revisi materi TWK sesuai masukan PM', sg: 'Develop Materi', pf: 'JadiASN', pic: 'Leader Konten', sup: '', doc: '', pn: '', mn: 'Tambahkan contoh kasus terbaru.', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -10, d: 5, st: 'Revisi', pr: 'Normal', n: 'Revisi thumbnail seri Drilling', sg: 'QC Konten', pf: 'Cerebrum', pic: 'Staff Input', sup: '', doc: '', pn: '', mn: 'Samakan font dengan brand guide.', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },

  // ---------- Ditunda (2) ----------
  { c: -21, d: 20, st: 'Hold', pr: 'Low', n: 'Integrasi API bank soal eksternal', sg: 'Manajemen Sistem', pf: 'Siadu', pic: 'Leader Sistem', sup: 'Staff Data', doc: '', pn: 'Menunggu kontrak vendor.', mn: 'Hold sampai Q4.', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -19, d: 25, st: 'Hold', pr: 'Normal', n: 'Riset fitur adaptive learning', sg: 'RnD', pf: 'Cerebrum', pic: 'Manager', sup: 'Staff Data', doc: '', pn: '', mn: 'Ditunda, fokus ke TO dulu.', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },

  // ---------- Lintas divisi (3) — punya Divisi Tujuan ----------
  { c: -7, d: 4, st: 'In progress', pr: 'High', n: 'Request banner promo Tryout Akbar SNBT', sg: 'Manajemen Sistem', pf: 'Marketing', pic: 'Manager', sup: '', doc: 'Brief Banner TO Akbar', pn: '', mn: 'Butuh 3 ukuran: feed, story, web.', dv: 'Marketing', kd: 'Kontak Marketing', vb: '', jm: '', ob: '', dt: '', by: 'Manager' },
  { c: -6, d: 6, st: 'Todo', pr: 'Normal', n: 'Request perbaikan bug login Siadu', sg: 'Manajemen Sistem', pf: 'Siadu', pic: 'Leader Sistem', sup: '', doc: 'Tiket #4412', pn: '', mn: '', dv: 'IT', kd: 'Kontak IT', vb: '', jm: '', ob: '', dt: '', by: 'Leader Sistem' },
  { c: -5, d: 8, st: 'Review PM', pr: 'Normal', n: 'Request data closing penjualan Juli', sg: 'Data & Intelligence', pf: 'All Platform', pic: 'Staff Data', sup: '', doc: '', pn: 'Data sudah dikirim, menunggu konfirmasi.', mn: '', dv: 'Sales', kd: 'Kontak Sales', vb: '', jm: '', ob: '', dt: '', by: 'Staff Data' }
];

/* ================================================================== */
/* DATA DUMMY — CEKLIS TASK                                           */
/* ================================================================== */
// t = nomor task (TSK-0xx), items = [teks, sudahDicentang, olehSiapa]
var DUMMY_CHECKLIST = [
  { t: 15, by: 'Manager', items: [['Kumpulkan referensi kisi-kisi OJK', true, 'Staff Soal'], ['Buat 50 soal batch 1', true, 'Staff Soal'], ['Buat 50 soal batch 2', true, 'Staff Soal'], ['Buat 50 soal batch 3', false, ''], ['Buat 50 soal batch 4', false, ''], ['Tulis pembahasan semua soal', false, '']] },
  { t: 18, by: 'Manager', items: [['Siapkan file sumber 150 soal', true, 'Staff Input'], ['Input soal 1—50', true, 'Staff Input'], ['Input soal 51—100', true, 'Staff Input'], ['Input soal 101—150', true, 'Staff Input'], ['Cek tampilan di preview Markaz', false, '']] },
  { t: 19, by: 'Staff Data', items: [['Tarik data aktivitas 6 bulan', true, 'Staff Data'], ['Bangun chart cohort retensi', true, 'Staff Data'], ['Tambah filter per platform', false, ''], ['Uji akses untuk tim PM', false, '']] },
  { t: 22, by: 'Manager', items: [['Susun blueprint 5 paket', true, 'Staff Materi'], ['Paket 1 — 100 soal', false, ''], ['Paket 2 — 100 soal', false, ''], ['Paket 3 — 100 soal', false, ''], ['QC silang antar paket', false, '']] },
  { t: 28, by: 'Manager', items: [['Kumpulkan pola deret populer', false, ''], ['Buat 45 soal', false, ''], ['Tulis pembahasan', false, ''], ['Cek tingkat kesulitan', false, '']] },
  { t: 33, by: 'Manager', items: [['Tentukan struktur bab', true, 'Staff Materi'], ['Tulis materi bab 1—3', true, 'Staff Materi'], ['Tulis materi bab 4—6', true, 'Staff Materi'], ['Sisipkan contoh soal', true, 'Staff Materi'], ['Proofread akhir', true, 'Leader Konten']] },
  { t: 43, by: 'Manager', items: [['Identifikasi 30 soal bermasalah', true, 'Staff Soal'], ['Perbaiki opsi pengecoh', false, ''], ['Kirim ulang untuk review', false, '']] }
];

/* ================================================================== */
/* DATA DUMMY — TASK KOLABORASI                                       */
/* ================================================================== */
/*
 * Alur beruntun antar-PIC. Tiap proses punya PIC + deadline sendiri,
 * dan hanya PIC proses itu yang boleh mencentangnya.
 * sub = sub-ceklis proses (dipakai untuk menguji aturan "main-ceklis
 *       terkunci sampai sub-ceklis tuntas").
 */
var DUMMY_COLLABS = [
  {
    id: 'COL-001', platform: 'Cerebrum, JadiASN', title: '5 Paket Tryout & Latsol SNBT 2026',
    desc: 'Produksi 5 paket TO + Latsol lengkap untuk musim SNBT 2026.',
    by: 'Manager', createdAt: -30, deadline: 18, type: 'Tryout/Latsol', color: '#1e3a8a',
    steps: [
      { n: 'Menyusun kurikulum & blueprint', pic: 'Leader Konten', d: -6, done: true, note: 'Blueprint final, 5 paket x 100 soal.' },
      { n: 'Membuat 250 soal', pic: 'Staff Soal', d: 2, done: false, note: 'Butuh tambahan 3 hari, soal Numerik lebih berat dari perkiraan.', sub: [['Soal Penalaran Umum (60)', true], ['Soal Pengetahuan Kuantitatif (60)', true], ['Soal Literasi Bahasa (60)', false], ['Soal Penalaran Matematika (70)', false], ['Tulis pembahasan semua soal', false]] },
      { n: 'QC soal & pembahasan', pic: 'Staff QC', d: 7, done: false },
      { n: 'Input ke SIADU', pic: 'Staff Input', d: 12, done: false },
      { n: 'Generate paket & publish', pic: 'Leader Sistem', d: 18, done: false }
    ]
  },
  {
    id: 'COL-002', platform: 'JadiASN', title: 'Course Persiapan CPNS 2026',
    desc: 'Course lengkap 12 bab + 40 video untuk persiapan CPNS.',
    by: 'Manager', createdAt: -45, deadline: 30, type: 'Course', color: '#6366f1',
    steps: [
      { n: 'Riset kebutuhan & silabus', pic: 'Leader Konten', d: -20, done: true },
      { n: 'Menyusun materi 12 bab', pic: 'Staff Materi', d: -10, done: true, note: 'Semua bab sudah proofread.' },
      { n: 'Take video 40 sesi', pic: 'Staff Soal', d: -2, done: true },
      { n: 'QC video & materi', pic: 'Staff QC', d: 6, done: false, sub: [['Cek audio 40 video', true], ['Cek sinkron materi & video', true], ['Cek bumper & thumbnail', true], ['Buat laporan QC', true]] },
      { n: 'Input & atur akses course', pic: 'Staff Input', d: 15, done: false },
      { n: 'Launch & monitoring minggu pertama', pic: 'Staff Liveclass', d: 30, done: false }
    ]
  },
  {
    id: 'COL-003', platform: 'JadiPPPK', title: 'Liveclass Series TWK Batch 3',
    desc: 'Rangkaian 8 sesi liveclass TWK.',
    by: 'Manager', createdAt: -40, deadline: -3, type: 'Liveclass', color: '#10b981',
    steps: [
      { n: 'Menyusun jadwal & pengajar', pic: 'Staff Liveclass', d: -25, done: true },
      { n: 'Menyiapkan materi presentasi', pic: 'Leader Konten', d: -18, done: true },
      { n: 'Pelaksanaan 8 sesi liveclass', pic: 'Staff Materi', d: -8, done: true, note: 'Rata-rata kehadiran 82%.' },
      { n: 'Rekap absensi & report', pic: 'Manager', d: -3, done: true }
    ]
  },
  {
    id: 'COL-004', platform: 'JadiPPPK, JadiSekdin', title: 'Journey Belajar JadiPPPK',
    desc: 'Alur belajar bertahap dengan rekomendasi otomatis.',
    by: 'Leader Konten', createdAt: -14, deadline: 45, type: 'Journey', color: '#92400e',
    steps: [
      { n: 'Mapping journey & milestone', pic: 'Leader Konten', d: 3, done: true },
      { n: 'Menyusun konten tiap tahap', pic: 'Staff Materi', d: 12, done: false, sub: [['Tahap 1 — Dasar', true], ['Tahap 2 — Menengah', false], ['Tahap 3 — Mahir', false]] },
      { n: 'Membuat soal diagnostik', pic: 'Staff Soal', d: 20, done: false },
      { n: 'Bangun logika rekomendasi', pic: 'Staff Data', d: 32, done: false },
      { n: 'QC & uji coba journey', pic: 'Staff QC', d: 45, done: false }
    ]
  },
  {
    id: 'COL-005', platform: 'Jago TPA', title: 'Drilling Numerik Intensif',
    desc: 'Set drilling 500 soal dengan tingkat kesulitan bertahap.',
    by: 'Staff Materi', createdAt: -8, deadline: 25, type: 'Drilling', color: '',
    steps: [
      { n: 'Kurasi 500 soal drilling', pic: 'Staff Soal', d: 5, done: false, sub: [['Kurasi soal mudah (200)', false], ['Kurasi soal sedang (200)', false], ['Kurasi soal sulit (100)', false], ['Validasi duplikasi', false]] },
      { n: 'Kategorisasi tingkat kesulitan', pic: 'Leader Sistem', d: 14, done: false },
      { n: 'Publish set drilling', pic: 'Staff Input', d: 25, done: false }
    ]
  },
  {
    id: 'COL-006', platform: 'Toefl Academy', title: 'Rebranding Materi Toefl Academy',
    desc: 'Penyegaran struktur & tampilan materi Toefl.',
    by: 'Manager', createdAt: -10, deadline: 20, type: '', color: '#ec4899',
    steps: [
      { n: 'Audit materi lama', pic: 'Staff QC', d: 4, done: true, note: 'Ada 18 materi yang perlu ditulis ulang.' },
      { n: 'Desain ulang struktur bab', pic: 'Leader Konten', d: 11, done: false },
      { n: 'Update video & thumbnail', pic: 'Staff Input', d: 20, done: false }
    ]
  }
];

/* ================================================================== */
/* DATA DUMMY — KOMENTAR, AKTIVITAS, NOTIFIKASI, LINK, CATATAN        */
/* ================================================================== */
// [hariRelatif, jam, refId, penulis, pesan]
var DUMMY_COMMENTS = [
  [-9, '09:15', 'TSK-015', 'Manager', 'Progres soal OJK gimana? Ini blocker untuk paket TO.'],
  [-9, '10:02', 'TSK-015', 'Staff Soal', 'Baru 120 dari 200. Numerik makan waktu, @Manager boleh minta tambahan 3 hari?'],
  [-8, '08:40', 'TSK-015', 'Manager', 'Oke, saya geser deadline. Fokus selesaikan dulu batch 3.'],
  [-6, '13:20', 'TSK-018', 'Staff Input', 'Input Markaz sudah 130/150, sisanya besok pagi.'],
  [-5, '09:05', 'TSK-018', 'Manager', '@everyone tolong bantu cek preview Markaz sore ini ya.'],
  [-4, '11:30', 'TSK-019', 'Staff Data', 'Chart cohort retensi sudah jalan, tinggal filter platform.'],
  [-4, '14:10', 'TSK-019', 'Manager', 'Mantap @Staff Data. Tambahin juga breakdown per stage kalau bisa.'],
  [-3, '10:45', 'TSK-017', 'Staff Materi', '@Leader Konten struktur bab Journey Polisi sudah oke belum?'],
  [-3, '15:00', 'TSK-017', 'Leader Konten', 'Masih nunggu approval PM untuk bab 4—6.'],
  [-2, '09:30', 'TSK-043', 'Manager', 'Opsi pengecoh di 30 soal ini terlalu mudah ditebak, mohon diperbaiki.'],
  [-2, '16:20', 'TSK-020', 'Staff Data', '@Leader Sistem subbab JadiBUMN ada duplikat di kategori Numerik.'],
  [-1, '08:55', 'TSK-020', 'Leader Sistem', 'Sudah saya rapikan, terima kasih infonya.'],
  [-1, '13:40', 'COL-001', 'Manager', 'Update dong progres paket TO SNBT, @Staff Soal @Staff QC.'],
  [-1, '14:25', 'COL-001', 'Staff Soal', 'Soal PU & PK selesai. Literasi + Matematika jalan minggu ini.'],
  [0, '09:10', 'COL-001', 'Staff QC', 'Siap, begitu soal masuk saya langsung QC.'],
  [-5, '10:00', 'COL-002', 'Staff QC', 'QC video course CPNS sudah selesai semua, laporan menyusul.'],
  [-4, '11:15', 'COL-002', 'Manager', 'Bagus. @Staff Input siap-siap untuk input & atur akses ya.'],
  [-7, '09:45', 'TSK-048', 'Manager', 'Brief banner sudah dikirim ke tim Marketing.'],
  [-2, '10:30', 'TSK-050', 'Staff Data', 'Data closing Juli sudah saya kirim ke Sales Ops.'],
  [-6, '15:50', 'TSK-022', 'Staff Materi', 'Paket 1—3 siap, paket 4—5 menyusul minggu depan.']
];

// [hariRelatif, jam, user, action, refId, detail]
var DUMMY_ACTIVITY = [
  [-14, '09:00', 'Manager', 'Create Task', 'TSK-021', 'Mengambil video pembahasan TWK 35 soal • Status: Todo • PIC: Staff Soal'],
  [-12, '10:15', 'Manager', 'Create Task', 'TSK-022', 'Menyusun paket Tryout Beasiswa LPDP • Status: Todo • PIC: Staff Materi'],
  [-10, '08:30', 'Staff Data', 'Update Task', 'TSK-019', 'status → In progress'],
  [-9, '09:15', 'Manager', 'Comment', 'TSK-015', 'Progres soal OJK gimana? Ini blocker untuk paket TO.'],
  [-9, '10:02', 'Staff Soal', 'Comment', 'TSK-015', 'Baru 120 dari 200. Numerik makan waktu...'],
  [-8, '11:00', 'Staff QC', 'Update Task', 'TSK-009', 'status → Done'],
  [-8, '11:30', 'Manager', 'Checklist Add', 'TSK-015', 'Buat 50 soal batch 4'],
  [-7, '09:45', 'Manager', 'Comment', 'TSK-048', 'Brief banner sudah dikirim ke tim Marketing.'],
  [-7, '14:00', 'Leader Konten', 'Collab Step Done', 'COL-001', 'Proses 1: Menyusun kurikulum & blueprint'],
  [-6, '13:20', 'Staff Input', 'Comment', 'TSK-018', 'Input Markaz sudah 130/150, sisanya besok pagi.'],
  [-6, '15:50', 'Staff Materi', 'Comment', 'TSK-022', 'Paket 1—3 siap, paket 4—5 menyusul minggu depan.'],
  [-5, '09:05', 'Manager', 'Comment', 'TSK-018', '@everyone tolong bantu cek preview Markaz sore ini ya.'],
  [-5, '10:00', 'Staff QC', 'Comment', 'COL-002', 'QC video course CPNS sudah selesai semua.'],
  [-5, '16:30', 'Manager', 'Update Task', 'TSK-013', 'status → Done'],
  [-4, '11:15', 'Manager', 'Comment', 'COL-002', 'Bagus. @Staff Input siap-siap untuk input & atur akses ya.'],
  [-4, '11:30', 'Staff Data', 'Comment', 'TSK-019', 'Chart cohort retensi sudah jalan, tinggal filter platform.'],
  [-4, '14:10', 'Manager', 'Comment', 'TSK-019', 'Mantap @Staff Data. Tambahin juga breakdown per stage kalau bisa.'],
  [-4, '17:00', 'Staff Soal', 'Collab Step Done', 'COL-002', 'Proses 3: Take video 40 sesi'],
  [-3, '10:45', 'Staff Materi', 'Comment', 'TSK-017', '@Leader Konten struktur bab Journey Polisi sudah oke belum?'],
  [-3, '15:00', 'Leader Konten', 'Comment', 'TSK-017', 'Masih nunggu approval PM untuk bab 4—6.'],
  [-3, '16:10', 'Manager', 'Update Task', 'TSK-014', 'status → Done'],
  [-2, '09:30', 'Manager', 'Comment', 'TSK-043', 'Opsi pengecoh di 30 soal ini terlalu mudah ditebak.'],
  [-2, '10:30', 'Staff Data', 'Comment', 'TSK-050', 'Data closing Juli sudah saya kirim ke Sales Ops.'],
  [-2, '13:00', 'Staff Input', 'Update Task', 'TSK-018', 'status → In progress'],
  [-2, '16:20', 'Staff Data', 'Comment', 'TSK-020', '@Leader Sistem subbab JadiBUMN ada duplikat di kategori Numerik.'],
  [-1, '08:55', 'Leader Sistem', 'Comment', 'TSK-020', 'Sudah saya rapikan, terima kasih infonya.'],
  [-1, '09:30', 'Manager', 'Update Task', 'TSK-012', 'status → Done'],
  [-1, '13:40', 'Manager', 'Comment', 'COL-001', 'Update dong progres paket TO SNBT, @Staff Soal @Staff QC.'],
  [-1, '14:25', 'Staff Soal', 'Comment', 'COL-001', 'Soal PU & PK selesai. Literasi + Matematika jalan minggu ini.'],
  [-1, '15:30', 'Staff QC', 'Collab Step Done', 'COL-006', 'Proses 1: Audit materi lama'],
  [0, '08:15', 'Manager', 'Create Task', 'TSK-050', 'Request data closing penjualan Juli • Status: Review PM • PIC: Staff Data'],
  [0, '09:10', 'Staff QC', 'Comment', 'COL-001', 'Siap, begitu soal masuk saya langsung QC.'],
  [0, '09:40', 'Staff Soal', 'Checklist Add', 'COL-001#2', 'Tulis pembahasan semua soal'],
  [0, '10:20', 'Manager', 'Update Task', 'TSK-011', 'status → Done']
];

// [untukUser, tipe, refId, dari, teks, hariRelatif, jam, sudahDibaca]
var DUMMY_NOTIF = [
  ['Staff Soal', 'turn', 'COL-001', 'Leader Konten', 'Giliran Anda: "Membuat 250 soal" (setelah Leader Konten menyelesaikan proses 1)', -7, '14:00', false],
  ['Staff QC', 'turn', 'COL-002', 'Staff Soal', 'Giliran Anda: "QC video & materi" (setelah Staff Soal menyelesaikan proses 3)', -4, '17:00', false],
  ['Staff Data', 'mention', 'TSK-019', 'Manager', 'Manager men-tag Anda: "Mantap @Staff Data. Tambahin juga breakdown per stage kalau bisa."', -4, '14:10', false],
  ['Leader Konten', 'mention', 'TSK-017', 'Staff Materi', 'Staff Materi men-tag Anda: "@Leader Konten struktur bab Journey Polisi sudah oke belum?"', -3, '10:45', true],
  ['Leader Sistem', 'mention', 'TSK-020', 'Staff Data', 'Staff Data men-tag Anda: "@Leader Sistem subbab JadiBUMN ada duplikat di kategori Numerik."', -2, '16:20', true],
  ['Staff Input', 'mention', 'TSK-018', 'Manager', 'Manager men-tag semua: "@everyone tolong bantu cek preview Markaz sore ini ya."', -5, '09:05', false],
  ['Staff Materi', 'mention', 'TSK-018', 'Manager', 'Manager men-tag semua: "@everyone tolong bantu cek preview Markaz sore ini ya."', -5, '09:05', false],
  ['Staff Soal', 'mention', 'COL-001', 'Manager', 'Manager men-tag Anda: "Update dong progres paket TO SNBT, @Staff Soal @Staff QC."', -1, '13:40', false],
  ['Staff Input', 'mention', 'COL-002', 'Manager', 'Manager men-tag Anda: "Bagus. @Staff Input siap-siap untuk input & atur akses ya."', -4, '11:15', false]
];

// [user, judul, url, folder]
var DUMMY_LINKS = [
  ['Manager', 'Spreadsheet Master Konten', 'https://docs.google.com/spreadsheets/', 'Kerja'],
  ['Manager', 'Kalender Liveclass', 'https://calendar.google.com/', 'Kerja'],
  ['Manager', 'Brand Guide Cerebrum', 'https://drive.google.com/', 'Referensi'],
  ['Staff Data', 'Dashboard Data Intelligence', 'https://lookerstudio.google.com/', 'Dashboard'],
  ['Staff Data', 'Query Library', 'https://docs.google.com/document/', 'Dashboard'],
  ['Staff Data', 'Dokumentasi API Internal', 'https://drive.google.com/', 'Teknis'],
  ['Staff Soal', 'Bank Soal TIU', 'https://drive.google.com/', 'Bank Soal'],
  ['Staff Soal', 'Kisi-kisi SNBT Resmi', 'https://drive.google.com/', 'Referensi'],
  ['Staff Soal', 'Template Pembahasan', 'https://docs.google.com/document/', 'Bank Soal'],
  ['Staff QC', 'Checklist QC Standar', 'https://docs.google.com/document/', ''],
  ['Staff QC', 'Folder Video Pembahasan', 'https://drive.google.com/', 'QC'],
  ['Leader Konten', 'Kurikulum Semua Platform', 'https://drive.google.com/', 'Kurikulum'],
  ['Staff Input', 'Panduan Input SIADU', 'https://docs.google.com/document/', '']
];

// [user, judul, isi, folder, hariRelatif]
var DUMMY_NOTES = [
  ['Manager', 'Agenda rapat mingguan', 'Bahas: progres paket TO SNBT, beban kerja Staff Soal, rencana liveclass September.', 'Rapat', -2],
  ['Manager', 'Ide fitur baru', 'Adaptive learning + rekomendasi soal berbasis performa siswa. Riset dulu Q4.', 'Ide', -8],
  ['Staff Data', 'Catatan query retensi', 'Cohort dihitung dari tanggal pembelian pertama, bukan tanggal daftar. Jangan tertukar.', 'Teknis', -4],
  ['Staff Data', 'Kredensial dashboard', 'Akses Looker via akun tim, minta ke IT kalau expired.', 'Teknis', -12],
  ['Staff Soal', 'Pola soal yang sering keluar', 'Deret aritmatika bertingkat, silogisme 2 premis, analogi hubungan fungsi.', 'Soal', -6],
  ['Staff Soal', 'To-do pribadi', 'Kejar batch 3 OJK, lalu Numerik Deret 45 soal.', '', -1],
  ['Staff QC', 'Standar QC video', 'Cek audio, sinkron materi, bumper, thumbnail, dan durasi maksimal 12 menit.', 'QC', -10],
  ['Leader Konten', 'Struktur journey', 'Tahap: Dasar → Menengah → Mahir. Tiap tahap ada diagnostik di awal & akhir.', 'Kurikulum', -5],
  ['Staff Materi', 'Progres paket LPDP', 'Paket 1—3 selesai. Paket 4—5 target minggu depan.', '', -3]
];

/* ================================================================== */
/* DATA DUMMY — USER & PERAN                                          */
/* ================================================================== */
/*
 * Nama sengaja dibuat generik (bukan nama orang) agar langsung terbaca
 * sebagai contoh peran. Pembeli tinggal mengganti namanya lewat
 * tab Pengaturan > Kelola User, atau langsung di sheet USERS.
 *
 * Manager — lihat semua task, set Done, setup kolaborasi, kelola user
 * Leader  — lihat semua task, set Done, setup kolaborasi
 * Staff   — hanya task miliknya, status maksimal "Review PM"
 */
// [nama, peran, aktif]
var DUMMY_USERS = [
  ['Manager', 'Manager', true],
  ['Leader Konten', 'Leader', true],
  ['Leader Sistem', 'Leader', true],
  ['Staff Materi', 'Staff', true],
  ['Staff Soal', 'Staff', true],
  ['Staff QC', 'Staff', true],
  ['Staff Input', 'Staff', true],
  ['Staff Data', 'Staff', true],
  ['Staff Liveclass', 'Staff', true],
  ['Lintas Divisi', 'Lihat Saja', true]
];

// [judul, deskripsi, ikon, url]
var DUMMY_DASHBOARDS = [
  ['Monitoring Liveclass', 'Pantau jadwal & progress liveclass divisi produk.', 'live_tv', 'https://docs.google.com/spreadsheets/'],
  ['Dashboard Penjualan', 'Rekap closing & funnel pembayaran semua platform.', 'payments', 'https://lookerstudio.google.com/'],
  ['Retensi Siswa', 'Cohort retensi bulanan per platform.', 'insights', 'https://lookerstudio.google.com/']
];

/* ================================================================== */
/* EKSEKUSI SEED                                                      */
/* ================================================================== */

function taskIdOf_(n) { return 'TSK-' + ('00' + n).slice(-3); }

function seedDummyData() {
  var t0 = new Date().getTime();

  // 1. Pastikan semua sheet + header + dropdown ada.
  setupTaskTracker();
  seedFormulaTemplate();

  // 2. Kosongkan data lama (header tetap).
  clearAllData_();

  // 3. Isi semua sheet.
  var counts = {};
  counts.user = seedUsers_();
  counts.task = seedTasks_();
  counts.checklist = seedChecklist_();
  counts.collab = seedCollabs_();
  counts.comment = seedComments_();
  counts.activity = seedActivity_();
  counts.notif = seedNotifications_();
  counts.link = seedLinks_();
  counts.note = seedNotes_();
  counts.dashboard = seedDashboards_();

  // 4. Rapikan tampilan + sembunyikan sheet internal.
  prettifyMain_();
  hideInternalSheets();
  SpreadsheetApp.flush();

  var secs = Math.round((new Date().getTime() - t0) / 100) / 10;
  var msg = counts.user + ' user, ' + counts.task + ' task, ' + counts.collab + ' task kolaborasi, ' + counts.checklist + ' item ceklis, '
    + counts.comment + ' komentar, ' + counts.activity + ' aktivitas, ' + counts.notif + ' notifikasi, '
    + counts.link + ' link, ' + counts.note + ' catatan, ' + counts.dashboard + ' dashboard. (' + secs + ' detik)';
  toast_('Data dummy siap — ' + msg);
  return { success: true, message: msg, counts: counts };
}

function seedUsers_() {
  ensureUsersSheet_();
  var rows = DUMMY_USERS.map(function (u) { return [u[0], u[1], u[2] ? 'TRUE' : 'FALSE']; });
  if (rows.length) valuesUpdate_(CONFIG.USERS_SHEET + '!A2', rows);
  invalidateUsers_();
  return rows.length;
}

function seedTasks_() {
  var rows = DUMMY_TASKS.map(function (t, i) {
    return [
      taskIdOf_(i + 1),
      seedDate_(t.c),
      seedDate_(t.d),
      t.st, t.pr, t.n, t.sg, t.pf, t.pic,
      t.sup || '', t.doc || '', t.pn || '', t.mn || '',
      t.dv || '', t.kd || '', t.vb || '', t.jm || '', t.ob || '', t.dt || '',
      t.by || 'Manager', t.mr || ''
    ];
  });
  if (rows.length) {
    valuesUpdate_(CONFIG.TASK_SHEET + '!' + CONFIG.FIRST_COL_LETTER + CONFIG.FIRST_DATA_ROW, rows);
  }
  return rows.length;
}

function seedChecklist_() {
  var rows = [];
  DUMMY_CHECKLIST.forEach(function (c) {
    c.items.forEach(function (it) {
      rows.push([taskIdOf_(c.t), it[0], it[1] ? 'TRUE' : 'FALSE', c.by, it[1] ? (it[2] || c.by) : '', it[1] ? seedStamp_(-3, '10:00') : '']);
    });
  });
  // Sub-ceklis proses kolaborasi (id "COL-xxx#N").
  DUMMY_COLLABS.forEach(function (c) {
    c.steps.forEach(function (s, i) {
      if (!s.sub) return;
      s.sub.forEach(function (it) {
        rows.push([c.id + '#' + (i + 1), it[0], it[1] ? 'TRUE' : 'FALSE', s.pic, it[1] ? s.pic : '', it[1] ? seedStamp_(-2, '11:00') : '']);
      });
    });
  });
  if (rows.length) valuesUpdate_(CONFIG.CHECKLIST_SHEET + '!A2', rows);
  return rows.length;
}

function seedCollabs_() {
  var cRows = [], sRows = [];
  DUMMY_COLLABS.forEach(function (c) {
    cRows.push([c.id, c.platform, c.title, c.desc || '', c.by, seedStamp_(c.createdAt, '09:00'),
      (c.deadline === '' || c.deadline === undefined) ? '' : seedDate_(c.deadline), c.type || '', c.color || '']);
    c.steps.forEach(function (s, i) {
      sRows.push([c.id, i + 1, s.n, s.pic,
        (s.d === '' || s.d === undefined) ? '' : seedDate_(s.d),
        s.done ? 'TRUE' : 'FALSE',
        s.done ? s.pic : '',
        s.done ? seedStamp_(Math.min(s.d + 1, 0), '16:00') : '',
        s.note || '']);
    });
  });
  if (cRows.length) valuesUpdate_(CONFIG.COLLAB_SHEET + '!A2', cRows);
  if (sRows.length) valuesUpdate_(CONFIG.COLLAB_STEP_SHEET + '!A2', sRows);
  return cRows.length;
}

function seedComments_() {
  var rows = DUMMY_COMMENTS.map(function (c) {
    return [seedStamp_(c[0], c[1]), c[2], c[3], c[4]];
  });
  if (rows.length) valuesUpdate_(CONFIG.COMMENTS_SHEET + '!A2', rows);
  return rows.length;
}

function seedActivity_() {
  var rows = DUMMY_ACTIVITY.map(function (a) {
    return [seedStamp_(a[0], a[1]), a[2], a[3], a[4], a[5]];
  });
  if (rows.length) valuesUpdate_(CONFIG.ACTIVITY_SHEET + '!A2', rows);
  return rows.length;
}

function seedNotifications_() {
  var rows = DUMMY_NOTIF.map(function (n, i) {
    return ['N-SEED-' + (i + 1), n[0], n[1], n[2], n[3], n[4], seedStamp_(n[5], n[6]), n[7] ? 'TRUE' : 'FALSE'];
  });
  if (rows.length) valuesUpdate_(CONFIG.NOTIF_SHEET + '!A2', rows);
  return rows.length;
}

function seedLinks_() {
  var rows = DUMMY_LINKS.map(function (l) { return [l[0], l[1], l[2], l[3]]; });
  if (rows.length) valuesUpdate_(CONFIG.LINKS_SHEET + '!A2', rows);
  return rows.length;
}

function seedNotes_() {
  var rows = DUMMY_NOTES.map(function (n) { return [n[0], n[1], n[2], seedStamp_(n[4], '14:00'), n[3]]; });
  if (rows.length) valuesUpdate_(CONFIG.NOTES_SHEET + '!A2', rows);
  return rows.length;
}

function seedDashboards_() {
  var rows = DUMMY_DASHBOARDS.map(function (d) { return [d[0], d[1], d[2], d[3]]; });
  if (rows.length) valuesUpdate_(CONFIG.DASHBOARDS_SHEET + '!A2', rows);
  return rows.length;
}

/* ================================================================== */
/* KOSONGKAN DATA                                                     */
/* ================================================================== */

function clearAllDataConfirm() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert('Kosongkan semua data?',
    'Semua task, komentar, ceklis, task kolaborasi, catatan, dan link akan DIHAPUS.\n'
    + 'Header sheet & daftar opsi (OPTIONS) tetap dipertahankan.\n\nLanjutkan?',
    ui.ButtonSet.YES_NO);
  if (res !== ui.Button.YES) return;
  clearAllData_();
  toast_('Semua data dikosongkan.');
}

// Hapus baris data (header tetap). OPTIONS sengaja TIDAK dikosongkan
// karena berisi daftar dropdown yang dipakai aplikasi.
function clearAllData_() {
  clearBelow_(CONFIG.TASK_SHEET, CONFIG.FIRST_DATA_ROW);
  [CONFIG.COMMENTS_SHEET, CONFIG.ACTIVITY_SHEET, CONFIG.CHECKLIST_SHEET,
   CONFIG.COLLAB_SHEET, CONFIG.COLLAB_STEP_SHEET, CONFIG.NOTIF_SHEET,
   CONFIG.LINKS_SHEET, CONFIG.DASHBOARDS_SHEET, CONFIG.NOTES_SHEET,
   CONFIG.USERS_SHEET].forEach(function (name) {
    clearBelow_(name, 2);
  });
  invalidateUsers_();
}

function clearBelow_(sheetName, firstRow) {
  var sh = sheet_(sheetName, false);
  if (!sh) return;
  var last = sh.getLastRow();
  if (last < firstRow) return;
  sh.getRange(firstRow, 1, last - firstRow + 1, sh.getMaxColumns()).clearContent();
}

/* ================================================================== */
/* TAMPILAN SHEET MAIN                                                */
/* ================================================================== */

function prettifyMain_() {
  var sh = sheet_(CONFIG.TASK_SHEET, false);
  if (!sh) return;
  try {
    var firstCol = colToIdx_(CONFIG.FIRST_COL_LETTER) + 1;
    sh.getRange(CONFIG.HEADER_ROW, firstCol, 1, TASK_HEADERS.length)
      .setFontWeight('bold').setBackground('#eef2ff').setFontColor('#3730a3');
    sh.setFrozenRows(CONFIG.HEADER_ROW);
    // Lebar kolom secukupnya: Task Name & catatan lebih lebar.
    var widths = [90, 100, 100, 100, 80, 320, 140, 130, 90, 130, 180, 220, 220, 110, 160, 120, 70, 140, 200, 100, 90];
    widths.forEach(function (w, i) { sh.setColumnWidth(firstCol + i, w); });
    sh.getRange(CONFIG.FIRST_DATA_ROW, firstCol, Math.max(sh.getMaxRows() - CONFIG.FIRST_DATA_ROW + 1, 1), TASK_HEADERS.length)
      .setVerticalAlignment('top');
    // Judul kecil di atas tabel.
    sh.getRange(1, firstCol).setValue('PRODUCTTRACK — DATABASE TASK').setFontSize(13).setFontWeight('bold').setFontColor('#4f46e5');
    sh.getRange(2, firstCol).setValue('Baris 3 = header. Data mulai baris 4. Jangan mengubah urutan kolom.').setFontSize(9).setFontColor('#94a3b8');
  } catch (e) { /* kosmetik saja, jangan menggagalkan seed */ }
}
