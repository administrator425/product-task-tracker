/**
 * Harness uji untuk gas/Code.gs + gas/Seed.gs.
 * Menjalankan kode Apps Script di Node dengan SpreadsheetApp tiruan yang meniru
 * perilaku asli Sheets — termasuk konversi otomatis string -> Date / TRUE -> boolean,
 * karena justru di situ bug tanggal & centang biasanya muncul.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

const GAS_DIR = path.join(__dirname, '..', 'gas');

/* ---------------- Spreadsheet tiruan ---------------- */

// Meniru parsing Sheets: "2026-07-28" jadi Date, "TRUE" jadi boolean, "120" jadi number.
function coerce(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = String(v);
  if (s === '') return '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  if (/^(TRUE|FALSE)$/i.test(s)) return s.toUpperCase() === 'TRUE';
  if (/^-?\d+(\.\d+)?$/.test(s) && s.length < 15) return Number(s);
  return s;
}

function displayOf(v) {
  if (v instanceof Date) {
    const p = n => String(n).padStart(2, '0');
    const base = `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    return (v.getHours() || v.getMinutes()) ? `${base} ${p(v.getHours())}:${p(v.getMinutes())}` : base;
  }
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  return String(v === null || v === undefined ? '' : v);
}

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet; this.row = row; this.col = col;
    this.numRows = numRows; this.numCols = numCols;
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) row.push(this.sheet._get(this.row + r, this.col + c));
      out.push(row);
    }
    return out;
  }
  getDisplayValues() { return this.getValues().map(r => r.map(displayOf)); }
  setValues(vals) {
    if (vals.length !== this.numRows) throw new Error(`setValues rows mismatch: got ${vals.length} want ${this.numRows}`);
    for (let r = 0; r < this.numRows; r++) {
      if (vals[r].length !== this.numCols) throw new Error(`setValues cols mismatch row ${r}: got ${vals[r].length} want ${this.numCols}`);
      for (let c = 0; c < this.numCols; c++) this.sheet._set(this.row + r, this.col + c, coerce(vals[r][c]));
    }
    return this;
  }
  setValue(v) { this.sheet._set(this.row, this.col, coerce(v)); return this; }
  clearContent() {
    for (let r = 0; r < this.numRows; r++)
      for (let c = 0; c < this.numCols; c++) this.sheet._set(this.row + r, this.col + c, '');
    return this;
  }
  setDataValidation() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setFontColor() { return this; }
  setFontSize() { return this; }
  setVerticalAlignment() { return this; }
  setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name) {
    this.name = name; this.cells = new Map();
    this.maxRows = 1000; this.maxCols = 26; this.hidden = false;
  }
  _key(r, c) { return r + ':' + c; }
  _get(r, c) { const v = this.cells.get(this._key(r, c)); return v === undefined ? '' : v; }
  _set(r, c, v) {
    if (v === '' || v === null || v === undefined) this.cells.delete(this._key(r, c));
    else this.cells.set(this._key(r, c), v);
  }
  getName() { return this.name; }
  getMaxRows() { return this.maxRows; }
  getMaxColumns() { return this.maxCols; }
  getLastRow() {
    let last = 0;
    for (const k of this.cells.keys()) { const r = +k.split(':')[0]; if (r > last) last = r; }
    return last;
  }
  getLastColumn() {
    let last = 0;
    for (const k of this.cells.keys()) { const c = +k.split(':')[1]; if (c > last) last = c; }
    return last;
  }
  getRange(row, col, numRows, numCols) {
    if (numRows === undefined) { numRows = 1; numCols = 1; }
    if (numCols === undefined) numCols = 1;
    if (row < 1 || col < 1) throw new Error(`getRange out of bounds: row=${row} col=${col}`);
    if (row + numRows - 1 > this.maxRows) throw new Error(`getRange exceeds maxRows on ${this.name}: need ${row + numRows - 1}, have ${this.maxRows}`);
    if (col + numCols - 1 > this.maxCols) throw new Error(`getRange exceeds maxCols on ${this.name}: need ${col + numCols - 1}, have ${this.maxCols}`);
    return new FakeRange(this, row, col, numRows, numCols);
  }
  insertRowsAfter(after, n) { this.maxRows += n; return this; }
  insertColumnsAfter(after, n) { this.maxCols += n; return this; }
  deleteRow(rowNumber) {
    const next = new Map();
    for (const [k, v] of this.cells.entries()) {
      const [r, c] = k.split(':').map(Number);
      if (r === rowNumber) continue;
      next.set((r > rowNumber ? r - 1 : r) + ':' + c, v);
    }
    this.cells = next; this.maxRows -= 1; return this;
  }
  hideSheet() { this.hidden = true; return this; }
  showSheet() { this.hidden = false; return this; }
  isSheetHidden() { return this.hidden; }
  setFrozenRows() { return this; }
  setColumnWidth() { return this; }
}

class FakeSpreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/FAKE/edit'; }
  toast() {}
}

/* ---------------- Layanan Apps Script tiruan ---------------- */

const SS = new FakeSpreadsheet();
SS.insertSheet('Main'); // bound script selalu punya minimal 1 sheet

const crypto = require('crypto');
const sandbox = {
  SpreadsheetApp: {
    getActiveSpreadsheet: () => SS,
    openById: () => SS,
    flush: () => {},
    newDataValidation: () => {
      const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({}) };
      return b;
    },
    getUi: () => { throw new Error('getUi tidak tersedia di harness'); }
  },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      const p = n => String(n).padStart(2, '0');
      return fmt
        .replace('yyyy', d.getFullYear())
        .replace('MM', p(d.getMonth() + 1))
        .replace('dd', p(d.getDate()))
        .replace('HH', p(d.getHours()))
        .replace('mm', p(d.getMinutes()))
        .replace('ss', p(d.getSeconds()));
    },
    computeDigest: (alg, str) => {
      const buf = crypto.createHash('sha256').update(str, 'utf8').digest();
      return Array.from(buf).map(b => (b > 127 ? b - 256 : b)); // GAS mengembalikan byte bertanda
    },
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  },
  Session: { getScriptTimeZone: () => 'Asia/Jakarta' },
  PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({}) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
  Logger: { log: () => {} },
  ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/FAKE/exec' }) },
  HtmlService: {
    createHtmlOutputFromFile: () => ({
      getContent: () => fs.readFileSync(path.join(GAS_DIR, 'Index.html'), 'utf8')
    }),
    createHtmlOutput: (html) => {
      const o = { _html: html, setTitle: () => o, addMetaTag: () => o, setXFrameOptionsMode: () => o };
      return o;
    },
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
  },
  console
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(GAS_DIR, 'Code.gs'), 'utf8');
const seed = fs.readFileSync(path.join(GAS_DIR, 'Seed.gs'), 'utf8');
vm.runInContext(code, sandbox, { filename: 'Code.gs' });
vm.runInContext(seed, sandbox, { filename: 'Seed.gs' });

/* ---------------- Assertions ---------------- */

let passed = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ✓ ' + name); passed++; }
function eq(name, a, b) {
  assert.strictEqual(a, b, `${name} (got=${JSON.stringify(a)} want=${JSON.stringify(b)})`);
  console.log('  ✓ ' + name); passed++;
}
const run = expr => vm.runInContext(expr, sandbox);
const call = (fn, ...args) => {
  sandbox.__args = args;
  return vm.runInContext(`${fn}.apply(null, __args)`, sandbox);
};

const iso = off => {
  const d = new Date(); d.setDate(d.getDate() + off);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

console.log('\n=== 1. Seed data dummy ===');
const seedRes = call('seedDummyData');
ok('seedDummyData sukses', seedRes && seedRes.success === true);
eq('54 task ter-seed', seedRes.counts.task, 54);
eq('6 task kolaborasi ter-seed', seedRes.counts.collab, 6);
ok('ceklis ter-seed (>30)', seedRes.counts.checklist > 30);
ok('komentar ter-seed (>15)', seedRes.counts.comment > 15);
ok('aktivitas ter-seed (>30)', seedRes.counts.activity > 30);
ok('notifikasi ter-seed', seedRes.counts.notif > 5);
ok('link ter-seed', seedRes.counts.link > 10);
ok('catatan ter-seed', seedRes.counts.note > 5);

console.log('\n=== 2. Sheet & penyembunyian ===');
const names = SS.getSheets().map(s => s.name);
['Main', 'OPTIONS', 'COMMENTS', 'ACTIVITY', 'CHECKLIST', 'COLLAB', 'COLLAB_STEPS',
 'NOTIFICATIONS', 'AUTH', 'LINKS', 'DASHBOARDS', 'NOTES'].forEach(n =>
  ok('sheet ' + n + ' ada', names.indexOf(n) >= 0));
ok('Main TERLIHAT', SS.getSheetByName('Main').isSheetHidden() === false);
ok('OPTIONS TERLIHAT', SS.getSheetByName('OPTIONS').isSheetHidden() === false);
['ACTIVITY', 'COMMENTS', 'CHECKLIST', 'COLLAB', 'COLLAB_STEPS', 'NOTIFICATIONS', 'AUTH', 'LINKS', 'DASHBOARDS', 'NOTES']
  .forEach(n => ok('sheet ' + n + ' TERSEMBUNYI', SS.getSheetByName(n).isSheetHidden() === true));

console.log('\n=== 3. Bootstrap (yang dibaca frontend) ===');
const boot = call('getBootstrapData');
eq('bootstrap: 54 task', boot.tasks.length, 54);
eq('bootstrap: 6 collab', boot.collabs.length, 6);
ok('bootstrap: options.status lengkap', boot.options.status.length >= 6);
ok('bootstrap: options.pic lengkap', boot.options.pic.length >= 9);
ok('bootstrap: verbMap terisi (rumus nama task)', Object.keys(boot.options.verbMap).length > 5);
ok('bootstrap: objekMap terisi', Object.keys(boot.options.objekMap).length > 5);
eq('bootstrap: managers default', boot.meta.managers.join(','), 'Manager');
eq('bootstrap: doneApprovers = Manager + Leader', boot.meta.doneApprovers.join(','), 'Manager,Leader Konten,Leader Sistem');
eq('bootstrap: 12 user terdaftar', boot.meta.users.length, 12);
eq('bootstrap: daftar peran', boot.meta.roles.join(','), 'Dev,Manager,Leader,Staff,Magang,Lihat Saja');
ok('bootstrap: activity terbaru di atas', boot.activity.length > 30);
ok('bootstrap: checklistSummary terisi', Object.keys(boot.checklistSummary).length >= 10);
ok('bootstrap: links terisi', boot.links.length > 10);
ok('bootstrap: notes terisi', boot.notes.length > 5);
ok('bootstrap: dashboards terisi', boot.dashboards.length === 3);

console.log('\n=== 4. Ketepatan TANGGAL (titik rawan geser 1 hari) ===');
const t1 = boot.tasks[0];
eq('TSK-001 id', t1.id, 'TSK-001');
eq('TSK-001 createdDate = hari-52', t1.createdDate, iso(-52));
eq('TSK-001 dueDate = hari-40', t1.dueDate, iso(-40));
eq('TSK-001 startDate = createdDate (virtual)', t1.startDate, t1.createdDate);
const dueToday = boot.tasks.filter(t => t.dueDate === iso(0));
ok('ada task jatuh tempo HARI INI', dueToday.length >= 2);
const overdue = boot.tasks.filter(t => t.dueDate < iso(0) && ['Todo', 'In progress', 'Revisi'].indexOf(t.status) >= 0);
ok('ada task OVERDUE (status aktif)', overdue.length >= 4);
const soon = boot.tasks.filter(t => t.dueDate > iso(0) && t.dueDate <= iso(3));
ok('ada task due <= 3 hari', soon.length >= 3);

console.log('\n=== 5. Cakupan fitur di data dummy ===');
const statuses = {}; boot.tasks.forEach(t => statuses[t.status] = (statuses[t.status] || 0) + 1);
['Done', 'In progress', 'Todo', 'Review PM', 'Revisi', 'Hold'].forEach(s =>
  ok('status "' + s + '" ada (' + statuses[s] + ')', statuses[s] > 0));
const prios = {}; boot.tasks.forEach(t => prios[t.priority] = (prios[t.priority] || 0) + 1);
['Urgent', 'High', 'Normal', 'Low'].forEach(p => ok('priority "' + p + '" ada', prios[p] > 0));
const stages = new Set(boot.tasks.map(t => t.stage));
eq('10 stage terpakai', stages.size, 10);
const pics = new Set(boot.tasks.map(t => t.pic));
ok('>=11 PIC terpakai', pics.size >= 11);
ok('ada task lintas divisi (Divisi Tujuan)', boot.tasks.filter(t => t.divisiTujuan).length === 3);
ok('task lintas divisi punya kontak', boot.tasks.filter(t => t.divisiTujuan && t.kontakDivisi).length === 3);
ok('ada task di-mirror ke Lintas Divisi', boot.tasks.filter(t => t.mirror === 'Ya').length === 3);
ok('ada task dgn support', boot.tasks.filter(t => t.support).length >= 15);
ok('ada task dgn rumus nama (verb+objek)', boot.tasks.filter(t => t.verb && t.objek).length >= 25);
ok('ada task dgn catatan PIC', boot.tasks.filter(t => t.picNotes).length >= 10);
ok('ada task dgn catatan PM', boot.tasks.filter(t => t.pmNotes).length >= 10);
ok('semua task punya createdBy', boot.tasks.every(t => !!t.createdBy));

console.log('\n=== 6. Task kolaborasi ===');
const byId = {}; boot.collabs.forEach(c => byId[c.id] = c);
eq('COL-001 judul', byId['COL-001'].title, '5 Paket Tryout & Latsol SNBT 2026');
eq('COL-001 platform multi', byId['COL-001'].platform, 'Cerebrum, JadiASN');
eq('COL-001 tipe', byId['COL-001'].type, 'Tryout/Latsol');
eq('COL-001 warna (Navy)', byId['COL-001'].color, '#1e3a8a');
eq('COL-001 deadline project', byId['COL-001'].deadline, iso(18));
eq('COL-001 punya 5 proses', byId['COL-001'].steps.length, 5);
eq('COL-001 progres 1/5', byId['COL-001'].done + '/' + byId['COL-001'].total, '1/5');
eq('COL-001 status Aktif', byId['COL-001'].status, 'Aktif');
eq('COL-001 proses 1 selesai oleh Leader Konten', byId['COL-001'].steps[0].doneBy, 'Leader Konten');
eq('COL-001 proses 2 PIC Staff Soal', byId['COL-001'].steps[1].pic, 'Staff Soal');
eq('COL-001 proses 2 deadline', byId['COL-001'].steps[1].deadline, iso(2));
ok('COL-001 proses 2 punya catatan', byId['COL-001'].steps[1].note.length > 10);
eq('COL-003 SELESAI (semua proses)', byId['COL-003'].status, 'Selesai');
eq('COL-005 tanpa warna', byId['COL-005'].color, '');
eq('COL-006 TANPA TIPE (kolom "Tanpa Tipe")', byId['COL-006'].type, '');
const types = new Set(boot.collabs.map(c => c.type));
['Course', 'Tryout/Latsol', 'Liveclass', 'Drilling', 'Journey', ''].forEach(t =>
  ok('tipe collab "' + (t || '(kosong)') + '" ada', types.has(t)));
ok('urutan proses rapi 1..n', boot.collabs.every(c => c.steps.every((s, i) => s.order === i + 1)));
ok('doneAt rapi (bukan teks kacau)', boot.collabs.every(c =>
  c.steps.every(s => !s.done || /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s.doneAt))));
ok('createdAt collab rapi', boot.collabs.every(c => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(c.createdAt)));

console.log('\n=== 7. Sub-ceklis & aturan kunci main-ceklis ===');
const subLocked = call('getChecklist', 'COL-001#2');
eq('COL-001#2 punya 5 sub-item', subLocked.length, 5);
eq('COL-001#2 baru 2 selesai', subLocked.filter(i => i.done).length, 2);
const subReady = call('getChecklist', 'COL-002#4');
eq('COL-002#4 punya 4 sub-item', subReady.length, 4);
eq('COL-002#4 SEMUA selesai', subReady.filter(i => i.done).length, 4);
// Aturan v1.49: main-ceklis terkunci selama sub-ceklis belum tuntas.
const lockTry = call('setCollabStepDone', 'COL-001', 2, true, 'Staff Soal');
eq('centang proses TERKUNCI (sub 2/5)', lockTry.success, false);
ok('pesan menyebut sisa sub-ceklis', /sub-ceklis/i.test(lockTry.message) && /2\/5/.test(lockTry.message));
const okTry = call('setCollabStepDone', 'COL-002', 4, true, 'Staff QC');
eq('centang proses BOLEH (sub 4/4)', okTry.success, true);
// Proses tanpa sub-ceklis tetap bebas dicentang.
const noSub = call('setCollabStepDone', 'COL-005', 2, true, 'Leader Sistem');
eq('proses tanpa sub-ceklis bebas dicentang', noSub.success, true);
// Undo selalu boleh walau sub belum tuntas.
const undo = call('setCollabStepDone', 'COL-004', 1, false, 'Leader Konten');
eq('batal centang selalu boleh', undo.success, true);
// PIC lain ditolak.
const wrongPic = call('setCollabStepDone', 'COL-001', 3, true, 'Staff Soal');
eq('PIC lain ditolak', wrongPic.success, false);
ok('pesan sebut PIC yang berhak', /Staff QC/.test(wrongPic.message));

console.log('\n=== 7b. Salin sub-ceklis ke proses lain ===');
// Kasus nyata: satu orang menyusun daftar panjang, proses berikutnya meng-QC daftar sama.
const sumberAwal = call('getChecklist', 'COL-001#2');          // 5 item, 2 tercentang
eq('sumber punya 5 item (2 tercentang)', sumberAwal.length, 5);
eq('tujuan COL-001#4 mula-mula kosong', call('getChecklist', 'COL-001#4').length, 0);
const salin = call('copyChecklist', 'COL-001#2', ['COL-001#4'], 'Leader Konten');
eq('salin berhasil', salin.success, true);
eq('jumlah yang disalin dilaporkan', salin.copied, 5);
eq('jumlah proses tujuan dilaporkan', salin.targets, 1);
const hasil = call('getChecklist', 'COL-001#4');
eq('tujuan kini berisi 5 item', hasil.length, 5);
eq('teksnya sama persis', hasil.map(i => i.item).join('|'), sumberAwal.map(i => i.item).join('|'));
// Status centang TIDAK ikut: pekerjaan di proses tujuan memang belum dikerjakan.
eq('semua item masuk BELUM tercentang', hasil.filter(i => i.done).length, 0);
eq('sumber tidak berubah', call('getChecklist', 'COL-001#2').length, 5);
eq('centang sumber tetap 2', call('getChecklist', 'COL-001#2').filter(i => i.done).length, 2);

// Beberapa tujuan sekaligus, satu kali tulis.
const banyak = call('copyChecklist', 'COL-001#2', ['COL-001#5', 'COL-002#1'], 'Leader Konten');
eq('salin ke 2 proses sekaligus', banyak.success, true);
eq('dilaporkan 2 tujuan', banyak.targets, 2);
eq('COL-001#5 terisi', call('getChecklist', 'COL-001#5').length, 5);
eq('COL-002#1 terisi', call('getChecklist', 'COL-002#1').length, 5);

// Menyalin MENAMBAH, bukan menimpa — sengaja, dan panelnya memberi tahu "sudah ada N".
call('copyChecklist', 'COL-001#2', ['COL-001#4'], 'Leader Konten');
eq('salin kedua menambah, bukan menimpa', call('getChecklist', 'COL-001#4').length, 10);

// Penjagaan.
eq('tujuan kosong ditolak', call('copyChecklist', 'COL-001#2', [], 'Leader Konten').success, false);
eq('sumber = tujuan diabaikan', call('copyChecklist', 'COL-001#2', ['COL-001#2'], 'Leader Konten').success, false);
const kosong = call('copyChecklist', 'COL-003#1', ['COL-001#6'], 'Leader Konten');
eq('sumber kosong ditolak', kosong.success, false);
ok('pesannya menjelaskan sumber kosong', /kosong/i.test(kosong.message));
// Sub-ceklis kolaborasi memang SENGAJA fleksibel di server — canEditChecklist_() untuk id
// "COL-xxx#N" mengembalikan true untuk siapa pun yang bernama, sama seperti addChecklistItem.
// Gerbang mode lihat-saja ada di lapis lain: allowlist GUEST_ACTIONS di api/rpc.js (level
// "view" hanya boleh getBootstrapData/getComments/addComment) + stepChecklistEditable() di UI.
eq('konsisten dgn addChecklistItem: server fleksibel', call('copyChecklist', 'COL-001#2', ['COL-001#6'], 'Siapa Saja').success, true);
eq('ringkasan ceklis ikut diperbarui', typeof salin.checklistSummary, 'object');

console.log('\n=== 7c. Tanggal centang, penanggalan ulang, & Manager boleh membatalkan ===');
// Tanggal centang: dicatat tiap kali dicentang, dikosongkan saat dibatalkan.
const stepAwal = call('getCollabs').find(c => c.id === 'COL-005').steps.find(s => s.order === 2);
ok('proses yang dicentang punya doneAt', !!stepAwal.doneAt);
ok('doneAt berformat tanggal rapi', /^\d{4}-\d{2}-\d{2}/.test(stepAwal.doneAt));
call('setCollabStepDone', 'COL-005', 2, false, 'Leader Sistem');
const stepUndo = call('getCollabs').find(c => c.id === 'COL-005').steps.find(s => s.order === 2);
eq('batal centang mengosongkan doneAt', stepUndo.doneAt, '');
eq('batal centang mengosongkan doneBy', stepUndo.doneBy, '');
call('setCollabStepDone', 'COL-005', 2, true, 'Leader Sistem');
const stepUlang = call('getCollabs').find(c => c.id === 'COL-005').steps.find(s => s.order === 2);
ok('centang ulang mengisi doneAt lagi', /^\d{4}-\d{2}-\d{2}/.test(stepUlang.doneAt));
eq('centang ulang mencatat pencentangnya', stepUlang.doneBy, 'Leader Sistem');

// Penanggalan ulang: sub-item ditambahkan SETELAH proses dicentang, lalu dituntaskan.
const cek = call('getChecklist', 'COL-002#4');                   // 4/4 selesai
eq('COL-002#4 sub-ceklis tuntas', cek.filter(i => i.done).length, 4);
call('setCollabStepDone', 'COL-002', 4, true, 'Staff QC');
const sebelum = call('getCollabs').find(c => c.id === 'COL-002').steps.find(s => s.order === 4);
ok('proses tercentang', sebelum.done);
call('addChecklistItem', 'COL-002#4', 'Item susulan', 'Staff QC');
const belum = call('getChecklist', 'COL-002#4');
eq('sub jadi 4/5 (ada yang belum)', belum.filter(i => !i.done).length, 1);
const barisBaru = belum.filter(i => !i.done)[0].row;
const tuntas = call('setChecklistDone', 'COL-002#4', barisBaru, true, 'Staff QC');
eq('item susulan dicentang', tuntas.success, true);
ok('backend menandai penanggalan ulang', tuntas.stepRestamped === true);
ok('collabs ikut dikirim balik', Array.isArray(tuntas.collabs));
const sesudah = tuntas.collabs.find(c => c.id === 'COL-002').steps.find(s => s.order === 4);
ok('doneAt proses diperbarui', /^\d{4}-\d{2}-\d{2}/.test(sesudah.doneAt));
eq('prosesnya tetap tercentang', sesudah.done, true);
// Proses yang BELUM dicentang tidak ikut ditandai — mencentang tetap tindakan PIC-nya.
call('setCollabStepDone', 'COL-002', 4, false, 'Staff QC');
const tanpa = call('setChecklistDone', 'COL-002#4', barisBaru, false, 'Staff QC');
const tanpa2 = call('setChecklistDone', 'COL-002#4', barisBaru, true, 'Staff QC');
ok('proses belum dicentang tidak ditanggali', !tanpa2.stepRestamped);
ok('sub-ceklis biasa (task non-collab) aman', !call('setChecklistDone', 'TSK-001', 2, true, 'Manager').stepRestamped);

// Manager boleh MEMBATALKAN centang, tapi tidak boleh mencentang milik orang lain.
call('setCollabStepDone', 'COL-005', 2, true, 'Leader Sistem');
const mgrUndo = call('setCollabStepDone', 'COL-005', 2, false, 'Manager');
eq('Manager BOLEH membatalkan centang', mgrUndo.success, true);
const mgrCheck = call('setCollabStepDone', 'COL-005', 2, true, 'Manager');
eq('Manager TIDAK boleh mencentang milik orang lain', mgrCheck.success, false);
ok('pesannya menyebut PIC yang berhak', /Leader Sistem/.test(mgrCheck.message));
const staffUndo = call('setCollabStepDone', 'COL-001', 1, false, 'Staff Soal');
eq('Staff tetap tak boleh membatalkan punya orang lain', staffUndo.success, false);
ok('pesan batal menyebut Manager', /Manager/.test(staffUndo.message));

console.log('\n=== 7d. Stage OPSIONAL di task kolaborasi ===');
const colStage = call('saveCollab', { title: 'Uji Stage', platform: 'JadiASN', stage: 'QC Konten',
  steps: [{ order: 1, name: 'Langkah 1', pic: 'Staff Soal' }] }, 'Manager');
eq('simpan dgn stage berhasil', colStage.success, true);
const dgnStage = call('getCollabs').find(c => c.title === 'Uji Stage');
eq('stage tersimpan', dgnStage.stage, 'QC Konten');
const colTanpa = call('saveCollab', { title: 'Uji Tanpa Stage', platform: 'JadiASN',
  steps: [{ order: 1, name: 'Langkah 1', pic: 'Staff Soal' }] }, 'Manager');
eq('simpan tanpa stage juga berhasil', colTanpa.success, true);
eq('stage kosong = string kosong, bukan error', call('getCollabs').find(c => c.title === 'Uji Tanpa Stage').stage, '');
// Collab lama (di-seed sebelum kolom J ada) tetap terbaca.
eq('collab lama tanpa kolom stage aman', call('getCollabs').find(c => c.id === 'COL-001').stage, '');
const ubah = call('saveCollab', { id: dgnStage.id, title: 'Uji Stage', platform: 'JadiASN', stage: '',
  steps: [{ order: 1, name: 'Langkah 1', pic: 'Staff Soal' }] }, 'Manager');
eq('stage boleh dikosongkan lagi', ubah.success, true);
eq('stage kembali kosong', call('getCollabs').find(c => c.title === 'Uji Stage').stage, '');
ok('header sheet COLLAB memuat Stage', SS.getSheetByName('COLLAB').getRange(1, 10, 1, 1).getValues()[0][0] === 'Stage');
call('deleteCollab', dgnStage.id, 'Manager');
call('deleteCollab', call('getCollabs').find(c => c.title === 'Uji Tanpa Stage').id, 'Manager');

console.log('\n=== 8. Gerbang status "Done" ===');
const denied = call('quickUpdateField', 'TSK-028', 'status', 'Done', 'Staff Soal');
eq('Staff Soal TIDAK boleh set Done', denied.success, false);
ok('pesan Done menyebut approver', /Manager, Leader Konten, Leader Sistem/.test(denied.message));
const allowedD = call('quickUpdateField', 'TSK-028', 'status', 'Done', 'Leader Konten');
eq('Leader BOLEH set Done', allowedD.success, true);
eq('status tersimpan = Done', allowedD.task.status, 'Done');
const allowedN = call('quickUpdateField', 'TSK-029', 'status', 'Done', 'Manager');
eq('Manager (manager) boleh set Done', allowedN.success, true);
const pull = call('quickUpdateField', 'TSK-028', 'status', 'Revisi', 'Staff Soal');
eq('menarik balik dari Done boleh siapa saja', pull.success, true);
const saveDenied = call('saveTask', { id: 'TSK-030', taskName: 'Coba Done via form', status: 'Done', actor: 'Staff QC' });
eq('saveTask ke Done oleh non-approver ditolak', saveDenied.success, false);

console.log('\n=== 9. Tulis data: task baru, ceklis, komentar ===');
const before = call('getTasks').length;
const created = call('saveTask', {
  taskName: 'Task uji dari aplikasi', status: 'Todo', priority: 'High', stage: 'RnD',
  platform: 'Cerebrum', pic: 'Staff Data', support: ['Staff QC', 'Staff Input'], dueDate: iso(5), actor: 'Manager'
});
eq('saveTask sukses', created.success, true);
eq('ID baru berurutan TSK-055', created.task.id, 'TSK-055');
eq('total task bertambah', call('getTasks').length, before + 1);
eq('support array -> teks', created.task.support, 'Staff QC, Staff Input');
eq('dueDate tersimpan benar', created.task.dueDate, iso(5));
eq('createdBy = actor', created.task.createdBy, 'Manager');
eq('createdDate = hari ini', created.task.createdDate, iso(0));

const addCk = call('addChecklistItem', 'TSK-055', 'Item ceklis uji', 'Staff Data');
eq('tambah ceklis oleh PIC sukses', addCk.success, true);
eq('ceklis TSK-055 = 1 item', addCk.checklist.length, 1);
const ckRow = addCk.checklist[0].row;
const setCk = call('setChecklistDone', 'TSK-055', ckRow, true, 'Staff Data');
eq('centang ceklis sukses', setCk.success, true);
eq('item tercentang', setCk.checklist[0].done, true);
eq('checkedBy tercatat', setCk.checklist[0].checkedBy, 'Staff Data');
ok('checkedAt rapi', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(setCk.checklist[0].checkedAt));
const ckOutsider = call('addChecklistItem', 'TSK-055', 'Item dari orang luar', 'Leader Sistem');
eq('non-PIC tidak boleh tambah ceklis task', ckOutsider.success, false);
const delByPic = call('deleteChecklistItem', 'TSK-055', ckRow, 'Staff Data');
eq('PIC tidak boleh hapus item ceklis task', delByPic.success, false);
const delByPm = call('deleteChecklistItem', 'TSK-055', ckRow, 'Manager');
eq('PM boleh hapus item ceklis task', delByPm.success, true);

const cm = call('addComment', { taskId: 'TSK-055', author: 'Manager', message: 'Halo @Staff Data tolong cek ini ya' });
eq('tambah komentar sukses', cm.success, true);
eq('komentar tersimpan', cm.comments.length, 1);
ok('timestamp komentar rapi', /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(cm.comments[0].timestamp));
const noti = call('getNotifications', 'Staff Data');
ok('mention @Staff Data menghasilkan notifikasi', noti.some(n => /men-tag Anda/.test(n.text) && n.refId === 'TSK-055'));
const cmAll = call('addComment', { taskId: 'TSK-055', author: 'Manager', message: '@everyone rapat jam 3' });
eq('komentar @everyone sukses', cmAll.success, true);
const notiUma = call('getNotifications', 'Staff QC');
ok('@everyone menotifikasi user lain', notiUma.some(n => /men-tag semua/.test(n.text)));
const notiSelf = call('getNotifications', 'Manager');
ok('penulis tidak menotifikasi dirinya sendiri', !notiSelf.some(n => n.refId === 'TSK-055' && /men-tag semua/.test(n.text)));

console.log('\n=== 10. Hapus task & baca ulang ===');
const delRes = call('deleteTask', 'TSK-055', 'Manager');
eq('hapus task sukses', delRes.success, true);
eq('jumlah task kembali', delRes.tasks.length, before);
ok('TSK-055 hilang', !delRes.tasks.some(t => t.id === 'TSK-055'));
ok('task lain tidak ikut tergeser', delRes.tasks[0].id === 'TSK-001' && delRes.tasks[9].id === 'TSK-010');

console.log('\n=== 11. Mode lihat-saja (Lintas Divisi) ===');
const guest = call('getBootstrapData', { viewOnly: true });
eq('tamu hanya lihat task lintas/mirror', guest.tasks.length, 6);
ok('tamu: semua task punya divisiTujuan atau mirror',
  guest.tasks.every(t => t.divisiTujuan || t.mirror === 'Ya'));
eq('tamu: tanpa activity', guest.activity.length, 0);
eq('tamu: tanpa catatan', guest.notes.length, 0);
eq('tamu: tanpa link', guest.links.length, 0);
eq('tamu: flag viewOnly', guest.viewOnly, true);
ok('tamu: dashboards tetap ada', guest.dashboards.length === 3);

console.log('\n=== 12. PIN per-user (hash) ===');
const setPin = call('setUserPin', 'Staff Data', '1234');
eq('set PIN sukses', setPin.success, true);
eq('PIN benar diterima', call('verifyPin', 'Staff Data', '1234').ok, true);
eq('PIN salah ditolak', call('verifyPin', 'Staff Data', '9999').ok, false);
eq('user tanpa PIN bebas masuk', call('verifyPin', 'Staff QC', '').noPin, true);
eq('PIN wajib 4 digit', call('setUserPin', 'Staff Data', '12').success, false);
ok('AUTH tersembunyi', SS.getSheetByName('AUTH').isSheetHidden() === true);
const authRows = SS.getSheetByName('AUTH').getRange(2, 1, 1, 2).getValues();
ok('AUTH menyimpan HASH, bukan PIN mentah',
  String(authRows[0][1]).length === 64 && String(authRows[0][1]).indexOf('1234') < 0);
eq('hapus PIN sukses', call('deleteUserPin', 'Staff Data').removed, true);

console.log('\n=== 13. Laporan mingguan punya angka (bukan nol) ===');
const act = boot.activity;
const weekAgo = iso(-7);
const doneEvents = act.filter(a => /→\s*done/i.test(a.detail) && a.timestamp.slice(0, 10) >= weekAgo);
ok('ada event "→ Done" dalam 7 hari terakhir', doneEvents.length >= 3);
const commentEvents = act.filter(a => a.action.toLowerCase() === 'comment' && a.timestamp.slice(0, 10) >= weekAgo);
ok('ada event komentar dalam 7 hari terakhir', commentEvents.length >= 8);
ok('semua timestamp aktivitas rapi', act.every(a => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(a.timestamp)));

console.log('\n=== 14. Link & catatan per-user ===');
const links = call('getAllLinks');
ok('link punya folder', links.filter(l => l.folder).length >= 8);
ok('link milik >=4 user', new Set(links.map(l => l.user)).size >= 4);
const notes = call('getAllNotes');
ok('catatan milik >=4 user', new Set(notes.map(n => n.user)).size >= 4);
ok('updatedAt catatan rapi', notes.every(n => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(n.updatedAt)));
const rn = call('renameUserFolder', 'Staff Data', 'Dashboard', 'Analytics');
eq('rename folder link sukses', rn.success, true);
eq('2 link Staff Data ikut berganti folder', rn.changed, 2);
ok('folder lama hilang', !call('getAllLinks').some(l => l.user === 'Staff Data' && l.folder === 'Dashboard'));
ok('folder baru terpasang', call('getAllLinks').filter(l => l.user === 'Staff Data' && l.folder === 'Analytics').length === 2);
ok('link user lain tidak tersentuh', call('getAllLinks').filter(l => l.user === 'Manager' && l.folder === 'Kerja').length === 2);
const df = call('deleteUserFolder', 'Staff Data', 'Analytics');
eq('hapus folder = link dipindah ke Umum (tidak terhapus)', df.changed, 2);
ok('link Staff Data tetap ada setelah folder dihapus', call('getAllLinks').filter(l => l.user === 'Staff Data').length === 3);

console.log('\n=== 14b. Mention nama ber-spasi (tidak boleh salah sasaran) ===');
const mentionOf = (msg, author) => {
  const before = {};
  ['Staff Data', 'Staff Soal', 'Staff QC', 'Leader Konten', 'Manager'].forEach(u => before[u] = call('getNotifications', u).length);
  call('addComment', { taskId: 'TSK-001', author: author || 'Manager', message: msg });
  const hit = [];
  Object.keys(before).forEach(u => { if (call('getNotifications', u).length > before[u]) hit.push(u); });
  return hit.sort();
};
eq('@Staff Data hanya kena Staff Data', mentionOf('cek ini @Staff Data ya').join('|'), 'Staff Data');
eq('@Staff Soal hanya kena Staff Soal', mentionOf('tolong @Staff Soal').join('|'), 'Staff Soal');
eq('@Leader Konten kena Leader Konten', mentionOf('@Leader Konten mohon review').join('|'), 'Leader Konten');
eq('dua tag sekaligus', mentionOf('@Staff QC dan @Staff Data tolong').join('|'), 'Staff Data|Staff QC');
eq('@Staff saja (ambigu) tidak menotifikasi siapa pun', mentionOf('halo @Staff tolong cek').join('|'), '');
ok('@everyone kena banyak orang', mentionOf('@everyone rapat sore').length >= 4);
eq('penulis tak menotifikasi dirinya', mentionOf('@Staff Data catat ya', 'Staff Data').join('|'), '');

console.log('\n=== 15. Peran user (Dev / Manager / Leader / Staff) ===');
const users = call('getUsers');
eq('12 user ter-seed', users.length, 12);
ok('semua user aktif', users.every(u => u.active === true));
const roleMap = {}; users.forEach(u => roleMap[u.name] = u.role);
eq('Manager berperan Manager', roleMap['Manager'], 'Manager');
eq('Leader Konten berperan Leader', roleMap['Leader Konten'], 'Leader');
eq('Leader Sistem berperan Leader', roleMap['Leader Sistem'], 'Leader');
eq('Staff Soal berperan Staff', roleMap['Staff Soal'], 'Staff');
eq('Magang Konten berperan Magang', roleMap['Magang Konten'], 'Magang');
eq('Magang Data berperan Magang', roleMap['Magang Data'], 'Magang');
eq('Lintas Divisi berperan Lihat Saja', roleMap['Lintas Divisi'], 'Lihat Saja');
ok('TIDAK ada nama orang asli di daftar user',
  !users.some(u => /nynda|alya|dhea|andika|arifah|bilar|kiki/i.test(u.name)));
// Hak per peran.
eq('Manager boleh setup kolaborasi', call('saveCollab', { title: 'Uji Manager', steps: [{ name: 'a', pic: 'Staff QC' }] }, 'Manager').success, true);
eq('Leader boleh setup kolaborasi', call('saveCollab', { title: 'Uji Leader', steps: [{ name: 'a', pic: 'Staff QC' }] }, 'Leader Sistem').success, true);
eq('Staff TIDAK boleh setup kolaborasi', call('saveCollab', { title: 'Uji Staff', steps: [{ name: 'a', pic: 'Staff QC' }] }, 'Staff Soal').success, false);
eq('Staff TIDAK boleh set Done', call('quickUpdateField', 'TSK-030', 'status', 'Done', 'Staff QC').success, false);
eq('Leader Sistem boleh set Done', call('quickUpdateField', 'TSK-030', 'status', 'Done', 'Leader Sistem').success, true);

console.log('\n=== 15b. Peran Magang: visibilitas & Done berbasis PIC ===');
const T = call('getTasks');
const picOf = id => (T.filter(t => t.id === id)[0] || {}).pic;
const magangTasks = T.filter(t => /^Magang /.test(t.pic)).map(t => t.id);
ok('ada 4 task milik magang', magangTasks.length === 4);

// Gerbang Done di server, dinilai per PIC task.
const tMagang = magangTasks[0];                                   // PIC = Magang Konten
const tKaryawan = T.filter(t => t.pic === 'Staff Soal' && t.status !== 'Done')[0].id;
// Staff BOLEH menutup task magang — inti permintaan.
const staffDoneMagang = call('quickUpdateField', tMagang, 'status', 'Done', 'Staff QC');
eq('Staff BOLEH mem-Done-kan task magang', staffDoneMagang.success, true);
// ...tapi TIDAK task karyawan lain.
const staffDoneKaryawan = call('quickUpdateField', tKaryawan, 'status', 'Done', 'Staff QC');
eq('Staff TIDAK boleh mem-Done-kan task karyawan', staffDoneKaryawan.success, false);
// Magang tak boleh menutup apa pun, termasuk task sesama magang & miliknya sendiri.
const magangDoneSendiri = call('quickUpdateField', magangTasks[1], 'status', 'Done', 'Magang Konten');
eq('Magang TIDAK boleh mem-Done-kan task sendiri', magangDoneSendiri.success, false);
ok('pesannya menjelaskan aturan magang', /anak magang/i.test(magangDoneSendiri.message));
eq('Magang TIDAK boleh mem-Done-kan task sesama magang',
  call('quickUpdateField', magangTasks[2], 'status', 'Done', 'Magang Data').success, false);
// Leader & Manager tetap bisa apa pun.
eq('Leader boleh mem-Done-kan task magang', call('quickUpdateField', magangTasks[1], 'status', 'Done', 'Leader Konten').success, true);
eq('Manager boleh mem-Done-kan task karyawan', call('quickUpdateField', tKaryawan, 'status', 'Done', 'Manager').success, true);
// Lewat saveTask (form) juga ditegakkan.
const saveMagangByStaff = call('saveTask', { id: magangTasks[2], taskName: 'Rekap data pendaftar mingguan', pic: 'Magang Data', status: 'Done', actor: 'Staff Data' });
eq('saveTask: Staff boleh menutup task magang', saveMagangByStaff.success, true);
const saveKaryawanByStaff = call('saveTask', { id: 'TSK-020', taskName: 'x', pic: 'Leader Sistem', status: 'Done', actor: 'Staff QC' });
eq('saveTask: Staff tak boleh menutup task karyawan', saveKaryawanByStaff.success, false);
// Magang tidak masuk daftar approver umum.
ok('magang bukan Done-approver', call('getBootstrapData').meta.doneApprovers.every(a => !/^Magang /.test(a)));

console.log('\n=== 16. Kelola user: HANYA Dev (Manager pun tidak boleh) ===');
// Semua peran selain Dev harus ditolak — termasuk Manager.
eq('Staff TIDAK boleh menambah user', call('saveUser', 'Staff Desain', 'Staff', true, 'Staff Soal').success, false);
eq('Leader TIDAK boleh menambah user', call('saveUser', 'Staff Desain', 'Staff', true, 'Leader Konten').success, false);
const addByMgr = call('saveUser', 'Staff Desain', 'Staff', true, 'Manager');
eq('Manager TIDAK boleh menambah user', addByMgr.success, false);
ok('pesannya mengarahkan ke mode Dev', /mode Dev/i.test(addByMgr.message) && /USERS/.test(addByMgr.message));
eq('daftar user tak berubah', call('getUsers').length, 12);

// Dev — satu-satunya yang boleh.
const addByDev = call('saveUser', 'Anak Magang', 'Staff', true, 'Dev');
eq('Dev BOLEH menambah user', addByDev.success, true);
eq('user baru masuk daftar', addByDev.users.length, 13);
ok('user baru otomatis masuk dropdown PIC', (addByDev.options.pic || []).indexOf('Anak Magang') >= 0);
ok('user baru otomatis masuk dropdown Support', (addByDev.options.support || []).indexOf('Anak Magang') >= 0);
eq('user baru berperan Staff', call('getUsers').filter(u => u.name === 'Anak Magang')[0].role, 'Staff');
eq('magang baru belum boleh set Done', call('quickUpdateField', 'TSK-031', 'status', 'Done', 'Anak Magang').success, false);

// Naik/turun peran hanya dari Dev, dan langsung berlaku.
eq('Manager TIDAK boleh mengubah peran', call('saveUser', 'Anak Magang', 'Leader', true, 'Manager').success, false);
eq('Dev boleh menaikkan jadi Leader', call('saveUser', 'Anak Magang', 'Leader', true, 'Dev').success, true);
eq('naik peran langsung berlaku', call('quickUpdateField', 'TSK-031', 'status', 'Done', 'Anak Magang').success, true);
eq('Dev boleh mengangkat Manager', call('saveUser', 'Anak Magang', 'Manager', true, 'Dev').success, true);
eq('peran tersimpan jadi Manager', call('getUsers').filter(u => u.name === 'Anak Magang')[0].role, 'Manager');
eq('Manager baru pun tak bisa kelola user', call('saveUser', 'Orang Lain', 'Staff', true, 'Anak Magang').success, false);
eq('Dev boleh menurunkan lagi', call('saveUser', 'Anak Magang', 'Staff', true, 'Dev').success, true);

// Nonaktif: dipakai saat magang selesai — hak hilang, task lamanya tetap.
eq('Manager TIDAK boleh menonaktifkan', call('saveUser', 'Anak Magang', 'Staff', false, 'Manager').success, false);
eq('Dev boleh menonaktifkan', call('saveUser', 'Anak Magang', 'Leader', false, 'Dev').success, true);
eq('user nonaktif kehilangan hak Done', call('quickUpdateField', 'TSK-032', 'status', 'Done', 'Anak Magang').success, false);
ok('user nonaktif tak masuk daftar approver', call('getBootstrapData').meta.doneApprovers.indexOf('Anak Magang') < 0);

// Validasi.
eq('peran tidak valid ditolak', call('saveUser', 'Staff X', 'Sultan', true, 'Dev').success, false);
eq('nama kosong ditolak', call('saveUser', '', 'Staff', true, 'Dev').success, false);
eq('nama "Dev" tak boleh dipakai sebagai user', call('saveUser', 'Dev', 'Staff', true, 'Dev').success, false);
eq('tidak bisa menghapus diri sendiri', call('deleteUser', 'Dev', 'Dev').success, false);

// Hapus: hanya Dev.
eq('Staff tidak boleh menghapus user', call('deleteUser', 'Anak Magang', 'Staff Soal').success, false);
eq('Manager tidak boleh menghapus user', call('deleteUser', 'Anak Magang', 'Manager').success, false);

// Karyawan tetap yang MASIH AKTIF dilindungi: namanya melekat di task lama, jadi
// mencabutnya dari dropdown PIC akan meninggalkan task yang PIC-nya tak bisa dipilih lagi.
const delAktif = call('deleteUser', 'Staff Soal', 'Dev');
eq('Staff aktif TIDAK bisa dihapus', delAktif.success, false);
ok('pesannya menyuruh nonaktifkan dulu', /Nonaktifkan dulu/.test(delAktif.message || ''));
eq('Manager aktif pun tak bisa dihapus', call('deleteUser', 'Manager', 'Dev').success, false);
ok('yang dilindungi tetap terdaftar', call('getUsers').some(u => u.name === 'Staff Soal'));

// Jalan keluar untuk akun duplikat/salah ketik: "Anak Magang" berperan Leader TAPI
// sudah dinonaktifkan di atas — pengaman dua langkah, jadi sekarang boleh dihapus.
const delUser = call('deleteUser', 'Anak Magang', 'Dev');
eq('karyawan tetap NONAKTIF boleh dihapus', delUser.success, true);
eq('daftar kembali 12 user', delUser.users.length, 12);
// Magang aktif tak perlu dinonaktifkan dulu.
call('saveUser', 'Magang Sementara', 'Magang', true, 'Dev');
eq('Magang aktif langsung boleh dihapus', call('deleteUser', 'Magang Sementara', 'Dev').success, true);
// Inti permintaan: benar-benar hilang dari PIC, bukan cuma dari daftar user.
ok('nama dicabut dari dropdown PIC', (delUser.options.pic || []).indexOf('Anak Magang') < 0);
ok('nama dicabut dari dropdown Support', (delUser.options.support || []).indexOf('Anak Magang') < 0);
ok('pencabutan bertahan saat dibaca ulang', (call('getOptions').pic || []).indexOf('Anak Magang') < 0);
eq('"Dev" tidak bisa dihapus', call('deleteUser', 'Dev', 'Manager Lain').success, false);

// Nama yang cuma nyangkut di dropdown (tanpa baris USERS) tetap sah dibersihkan.
call('saveOption', 'pic', 'Sisa Dropdown', '');
const delSisa = call('deleteUser', 'Sisa Dropdown', 'Dev');
eq('nama sisa di dropdown boleh dihapus', delSisa.success, true);
ok('sisa dropdown benar-benar hilang', (delSisa.options.pic || []).indexOf('Sisa Dropdown') < 0);
eq('nama tak dikenal ditolak', call('deleteUser', 'Hantu', 'Dev').success, false);

console.log('\n=== 16b. UI: panel Kelola User terkunci ke mode Dev ===');
const uiHtml = call('doGet', {})._html;
ok('canManageUsers() memakai isDev()', /function canManageUsers\(\)\{[^}]*isDev\(\)/.test(uiHtml));
ok('canManageUsers() TIDAK memakai isManager()', !/function canManageUsers\(\)\{[^}]*isManager\(/.test(uiHtml));
ok('ada keterangan untuk Manager (userAdminHint)', /id="userAdminHint"/.test(uiHtml));
ok('keterangan menyebut sheet USERS sebagai jalan lain', /userAdminHint[\s\S]{0,700}sheet <b>USERS<\/b>/.test(uiHtml));
ok('panel diberi label MODE DEV', /MODE DEV<\/span>/.test(uiHtml));
ok('peran "Dev" tak bisa dipilih untuk baris user', /assignableRoles\(\)\{[\s\S]{0,200}!=='dev'/.test(uiHtml));
ok('legenda Manager tak lagi menyebut kelola user', /'Manager':'[^']*kelola dropdown/.test(uiHtml));

console.log('\n=== 16c. Komunikasi: cakupan Leader & notifikasi terbaca ===');
const commHtml = call('doGet', {})._html;
// Chat = kotak masuk pribadi. Leader TIDAK ikut melihat semua percakapan.
// Hanya Manager/Dev yang melihat semua task. Leader punya WEWENANG penuh (Done, kolaborasi)
// tapi daftar task-nya sebatas yang ia PIC/Support-nya — sama seperti Staff.
ok('canSeeAllTasks hanya Manager', /function canSeeAllTasks\(user\)\{ return isManager\(user\); \}/.test(commHtml));
ok('Leader TIDAK lagi ikut lihat-semua', !/canSeeAllTasks\(user\)\{ return isManager\(user\) \|\| isLeader\(user\)/.test(commHtml));
ok('scopedTasks memakai canSeeAllTasks', /function scopedTasks\(\)[\s\S]{0,400}?canSeeAllTasks\(state\.currentUser\)/.test(commHtml));
ok('daftar Komunikasi memakai cakupan yang sama', /const arr=scopedTasks\(\)/.test(commHtml));
ok('badge unread dihitung dari scopedTasks', /function totalUnreadTasks\(\)[\s\S]{0,300}?new Set\(scopedTasks\(\)/.test(commHtml));
ok('tak ada lagi cakupan Komunikasi terpisah', !/function commScopedTasks\(\)/.test(commHtml));
// Mode magang: identitas terkunci di cookie, switcher hilang, dan ada tab khusus untuk karyawan.
ok('ada pembungkus cookie identitas magang', /function magangIdentity\(\)\{ return getCookie\('tt_magang_user'\)/.test(commHtml));
ok('pilih identitas magang mengunci ke cookie', /function chooseIdentity\(name\)\{[\s\S]{0,400}?state\.magangMode[\s\S]{0,300}?setCookie\('tt_magang_user'/.test(commHtml));
ok('identitas magang tak bisa dipindah otomatis', /function populateUserSelect\(\)\{[\s\S]{0,600}?state\.magangMode\)\{[\s\S]{0,300}?select\.disabled=true/.test(commHtml));
ok('ganti user ditolak di mode magang', /function requestUserSwitch\(value\)\{[\s\S]{0,300}?state\.magangMode\)\{[\s\S]{0,150}?terkunci/.test(commHtml));
// Kotak Mode User TETAP tampil utk magang (biar tahu masuk sebagai siapa); yang dimatikan
// hanya cara menggantinya — dropdown terkunci + tombol "Ganti identitas" disembunyikan.
ok('kotak Mode User TETAP tampil utk magang', /state\.magangMode\)\{[\s\S]{0,600}?modeUserBox'\); if\(box\) box\.classList\.remove\('hide'\)/.test(commHtml));
ok('applyRoleUI tak lagi menyembunyikannya', !/modeUserBox'\); if\(modeBox\) modeBox\.classList\.toggle\('hide',!!state\.lockView\|\|guest\|\|!!state\.magangMode\)/.test(commHtml));
ok('tombol "Ganti identitas" disembunyikan utk magang', /state\.magangMode\)\{[\s\S]{0,800}?switchIdentityBtn'\); if\(btn\) btn\.classList\.add\('hide'\)/.test(commHtml));
ok('ada keterangan identitas terkunci', /id="magangLockNote"/.test(commHtml) && /Identitas terkunci untuk akun magang/.test(commHtml));
ok('dropdown identitas magang tetap mati', /state\.magangMode\)\{[\s\S]{0,500}?select\.disabled=true/.test(commHtml));
ok('identitas dikirim ke server sbg x-user', /'x-user': magangIdentity\(\)/.test(commHtml));
ok('ada tab Kerjaan Magang utk karyawan', /id="nav-magang"/.test(commHtml) && /function renderMagangView\(\)/.test(commHtml));
ok('tab Kerjaan Magang tak tampil utk magang', /function canSeeMagangView\(\)\{[\s\S]{0,200}?state\.magangMode \|\| isMagang\(state\.currentUser\)\) return false/.test(commHtml));
ok('kerjaan magang tak lagi tercampur ke daftar karyawan', !/isMagang\(me\) \|\| isStaff\(me\)\) return state\.tasks\.filter/.test(commHtml));

// Wewenang Leader HARUS tetap.
ok('Leader tetap boleh set Done', /function canSetDoneFor\(task\)\{[\s\S]{0,400}?isLeader\(me\)\) return true/.test(commHtml));
ok('Leader tetap boleh menyusun Task Kolaborasi', /function canManageCollab\(\)\{[\s\S]{0,300}?isLeader\(state\.currentUser\)\) return true/.test(commHtml));
// Lonceng: dibuka = terbaca, badge habis.
ok('buka lonceng menandai terbaca', /toggleNotifMenu[\s\S]{0,400}?markNotifsReadSilently\(\)/.test(commHtml));
ok('ada penanda-terbaca tanpa render ulang', /function markNotifsReadSilently\(\)/.test(commHtml));
ok('penanda-terbaca memanggil markNotificationsRead', /markNotifsReadSilently\(\)\{[\s\S]{0,400}?markNotificationsRead\(state\.currentUser, ''\)/.test(commHtml));
ok('notifikasi komentar task membuka chat-nya', /function openNotif\(refId\)[\s\S]{0,1500}?selectCommunicationTask\(t\.id\)/.test(commHtml));
ok('komentar sendiri tak dihitung belum-dibaca (toleran)', /!same\(c\.user, state\.currentUser\)/.test(commHtml));

console.log('\n=== 16d. Penanda "Giliran Anda" pada kartu kolaborasi ===');
// Dulu cuma teks merah 11px di antara belasan baris proses — praktis tak terlihat.
ok('teks kecil lama sudah dibuang', !/mt-1\.5 text-\[11px\] font-semibold text-rose-600 flex items-center gap-1"><span class="material-icons-round text-\[13px\]">notifications_active<\/span>Giliran Anda/.test(commHtml));
// Lapis 1: pita solid penuh-lebar di puncak kartu.
ok('ada pita giliran', /const turnRibbon = mineTurn \?/.test(commHtml));
ok('pita berlatar solid rose + teks putih', /turnRibbon[\s\S]{0,300}?bg-rose-500 dark:bg-rose-600[\s\S]{0,60}?text-white/.test(commHtml));
ok('pita memakai huruf tebal & kapital', /turnRibbon[\s\S]{0,500}?font-bold uppercase tracking-wide/.test(commHtml));
ok('ikon pita berdenyut', /turnRibbon[\s\S]{0,400}?notifications_active<\/span>/.test(commHtml) && /animate-pulse/.test(commHtml));
ok('pita menyebut proses mana yang menunggu', /myTurns\.length>1\?`\$\{myTurns\.length\} proses menunggu`:myTurns\[0\]\.name/.test(commHtml));
ok('pita dipasang di puncak kartu', /hover:ring-indigo-200 transition">\s*\$\{turnRibbon\}/.test(commHtml));
// Lapis 2: baris proses yang jadi giliran ikut disorot.
ok('baris giliran diberi latar', /const box=turn\?'bg-rose-50 dark:bg-rose-900\/25/.test(commHtml));
ok('baris giliran ditebalkan', /const txt=s\.done\?[\s\S]{0,80}?turn\?'text-rose-700 dark:text-rose-200 font-semibold'/.test(commHtml));
ok('ikon baris giliran diperbesar', /turn\?'text-\[16px\]':'text-\[14px\]'/.test(commHtml));
// Lapis 3: kartunya sendiri diberi cincin.
ok('kartu bergiliran diberi cincin', /mineTurn\?'border-rose-300 dark:border-rose-800 ring-2 ring-rose-200/.test(commHtml));
// Penentu terpenting: kartu bergiliran tak boleh terkubur di bawah kartu Selesai.
ok('ada peringkat urutan kartu', /function collabRank\(c\)/.test(commHtml));
ok('giliran Anda peringkat teratas', /function collabRank\(c\)[\s\S]{0,200}?isMyTurnStep\(c,s\)\)\) return 0/.test(commHtml));
ok('yang Selesai jatuh ke bawah', /function collabRank\(c\)[\s\S]{0,250}?c\.status==='Selesai' \? 2 : 1/.test(commHtml));
ok('filteredCollabs mengurutkan', /arr\.sort\(\(a,b\)=>collabRank\(a\)-collabRank\(b\)\)/.test(commHtml));

console.log('\n=== 16d-1. UI: tanggal centang, stage opsional, Manager membatalkan ===');
// Tanggal centang tampil di baris proses, lengkap dgn putusan tepat waktu / telat.
ok('ada penampil tanggal centang', /function stepDoneStamp\(s\)/.test(commHtml));
ok('dipasang di baris proses', /\$\{stepDoneStamp\(s\)\}/.test(commHtml));
ok('membandingkan doneAt dgn deadline proses', /const telat = tgl > s\.deadline/.test(commHtml));
ok('menandai telat & tepat waktu', /telat\?'\(telat\)':'\(tepat waktu\)'/.test(commHtml));
ok('tanpa deadline tetap tampilkan tanggalnya', /if\(!s\.deadline\) return/.test(commHtml));
ok('doneAt kacau tidak dirender', /if\(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(tgl\)\) return ''/.test(commHtml));
// Stage OPSIONAL.
ok('ada input stage di modal collab', /id="collabStage"/.test(commHtml));
ok('stage ditandai opsional', /Stage <span class="font-normal text-gray-400">\(opsional\)<\/span>/.test(commHtml));
ok('ada pilihan tanpa stage', /\(Tanpa stage\)/.test(commHtml));
ok('memakai daftar stage task biasa', /state\.options&&state\.options\.stage\)\|\|\[\]/.test(commHtml));
ok('stage lama di luar dropdown tetap ditawarkan', /daftar\.includes\(nilai\)\|\|!nilai\?daftar:daftar\.concat\(\[nilai\]\)/.test(commHtml));
ok('stage ikut dikirim saat simpan', /stage:getVal\('collabStage'\)/.test(commHtml));
ok('stage tampil di kartu', /c\.stage\?`<span[^`]*?Stage">\$\{escapeHtml\(c\.stage\)\}/.test(commHtml));
// Manager boleh membatalkan centang.
ok('Manager boleh batalkan centang di klien', /if\(s && s\.done && isManager\(state\.currentUser\)\) return true/.test(commHtml));
ok('mencentang tetap khusus PIC', /return !!s && same\(s\.pic, state\.currentUser\)/.test(commHtml));

console.log('\n=== 16d-2. UI: salin sub-ceklis ke proses lain ===');
ok('tombol salin ada di kepala sub-ceklis', /toggleCopyChecklistPanel\(\$\{order\}\)/.test(commHtml));
ok('tombol hanya muncul bila ada proses lain', /editable&&otherStepsFor\(order\)\.length\?/.test(commHtml));
ok('ada wadah panel salin', /id="collab-subck-copy-\$\{order\}"/.test(commHtml));
ok('panel mendaftar proses selain sumber', /function otherStepsFor\(order\)[\s\S]{0,200}?s\.order!==order/.test(commHtml));
ok('tiap tujuan menampilkan PIC-nya', /renderCopyChecklistPanel[\s\S]{0,1200}?escapeHtml\(s\.pic\|\|'—'\)/.test(commHtml));
// Menyalin MENAMBAH, bukan menimpa — user harus tahu sebelum menekan tombol.
ok('tujuan yang sudah berisi diberi tanda', /sudah ada \$\{punya\}/.test(commHtml));
ok('diberi tahu item masuk belum tercentang', /item masuk belum tercentang/.test(commHtml));
ok('tanpa tujuan terpilih ditolak di klien', /submitCopyChecklist\(order\)[\s\S]{0,300}?Pilih dulu proses tujuannya/.test(commHtml));
ok('tombol dikunci selama menyalin', /submitCopyChecklist\(order\)[\s\S]{0,600}?btn\.disabled=true; btn\.textContent='Menyalin…'/.test(commHtml));
ok('memanggil copyChecklist sekali utk semua tujuan', /\.copyChecklist\(collabStepTaskId\(order\), picked\.map\(o=>collabStepTaskId\(o\)\), state\.currentUser\)/.test(commHtml));
ok('proses tujuan disegarkan setelah salin', /picked\.forEach\(o=>\{ if\(state\._collabExpanded&&state\._collabExpanded\[o\]\) loadStepChecklist\(o\); else syncStepMainCheckbox\(o\)/.test(commHtml));
ok('copyChecklist terdaftar di BACKEND_ACTIONS', /'addChecklistItem','copyChecklist','setChecklistDone'/.test(commHtml));

console.log('\n=== 16e. Kelola User memuat SEMUA nama, bukan cuma yang terdaftar ===');
const uaHtml = call('doGet', {})._html;
// Masalah yang diperbaiki: begitu sheet USERS terisi, roleOf() mengembalikan '' untuk
// nama yang belum tercatat — haknya hilang diam-diam DAN ia tak muncul di panel mana pun,
// jadi Dev tak punya cara membetulkannya tanpa menyunting sheet/kode.
ok('ada pengumpul semua nama yang dikenal', /function knownPeople\(\)/.test(uaHtml));
ok('nama diambil dari dropdown PIC', /function knownPeople\(\)[\s\S]{0,900}?state\.options&&state\.options\.pic\|\|\[\]\)\.forEach\(add\)/.test(uaHtml));
ok('nama diambil dari dropdown Support', /function knownPeople\(\)[\s\S]{0,900}?state\.options&&state\.options\.support\|\|\[\]\)\.forEach\(add\)/.test(uaHtml));
// SENGAJA tidak membaca PIC/Support dari task lama: kalau dibaca, user yang baru dihapus
// akan muncul lagi sebagai "Belum diatur" dan penghapusannya terasa gagal.
ok('nama TIDAK dipungut dari task lama', !/function knownPeople\(\)[\s\S]{0,900}?state\.tasks\|\|\[\]\)\.forEach/.test(uaHtml));
ok('"dev" tak ikut jadi baris user', /function knownPeople\(\)[\s\S]{0,400}?k==='dev'\) return/.test(uaHtml));
ok('baris = gabungan terdaftar + belum terdaftar', /function userAdminRows\(\)[\s\S]{0,700}?registered:true[\s\S]{0,200}?registered:false/.test(uaHtml));
// Urutan tabel = hierarki peran aplikasi: Manager teratas → Magang → Lihat Saja.
ok('urutan memakai peringkat peran', /function roleRank\(u\)/.test(uaHtml));
ok('peringkat diambil dari daftar ROLES aplikasi', /function roleRank\(u\)[\s\S]{0,300}?state\.roles\|\|\[\]\)\.filter\(r=>!same\(r,'Dev'\)\)/.test(uaHtml));
ok('yang belum diatur tetap paling atas', /function roleRank\(u\)[\s\S]{0,200}?!u\.registered\) return -1/.test(uaHtml));
ok('peran asing jatuh ke paling bawah', /function roleRank\(u\)[\s\S]{0,400}?i<0 \? order\.length : i/.test(uaHtml));
ok('sort memakai roleRank lalu nama', /sort\(\(a,b\)=> \(roleRank\(a\)-roleRank\(b\)\) \|\| a\.name\.localeCompare/.test(uaHtml));
ok('tak ada lagi urutan terdaftar-vs-belum', !/a\.registered!==b\.registered \? \(a\.registered\?1:-1\)/.test(uaHtml));
// Karyawan tetap dilindungi dari penghapusan; magang & sisa dropdown boleh dibersihkan.
ok('ada daftar peran karyawan tetap', /const PERMANENT_ROLES=\['Manager','Leader','Staff'\]/.test(uaHtml));
ok('ada penjaga boleh-hapus', /function canDeleteUser\(u\)/.test(uaHtml));
ok('ada penanda user terlindungi', /function isProtectedUser\(u\)/.test(uaHtml));
ok('terlindungi = karyawan tetap yang MASIH AKTIF', /function isProtectedUser\(u\)\{ return !!u && u\.registered && isPermanentRole\(u\.role\) && u\.active!==false; \}/.test(uaHtml));
ok('karyawan tetap aktif tak bisa dihapus', /function canDeleteUser\(u\)[\s\S]{0,300}?return !isProtectedUser\(u\)/.test(uaHtml));
ok('gembok hanya utk yang terlindungi', /isProtectedUser\(u\)&&!same\(u\.name,state\.currentUser\)/.test(uaHtml));
ok('diri sendiri & Dev tak bisa dihapus', /function canDeleteUser\(u\)[\s\S]{0,300}?same\(u\.name,state\.currentUser\) \|\| baseName\(u\.name\)==='dev'\) return false/.test(uaHtml));
ok('karyawan tetap diberi ikon gembok', /lock_outline/.test(uaHtml));
ok('gembok menjelaskan cara membukanya', /Karyawan tetap yang masih aktif tidak bisa dihapus[\s\S]{0,250}?Nonaktifkan dulu/.test(uaHtml));
ok('removeUser dijaga canDeleteUser', /function removeUser\(i\)[\s\S]{0,300}?!canDeleteUser\(u\)\)\{/.test(uaHtml));
ok('konfirmasi menyebut pencabutan dari PIC', /function removeUser\(i\)[\s\S]{0,600}?dropdown PIC & Support/.test(uaHtml));
ok('tabel memakai userAdminRows, bukan state.users', /const people=userAdminRows\(\)/.test(uaHtml));
ok('tabel TIDAK lagi memetakan state.users langsung', !/const users=\(state\.users\|\|\[\]\);\s*if\(!users\.length\)/.test(uaHtml));
// Memilih peran untuk nama yang belum terdaftar = sekaligus mendaftarkannya.
ok('ada opsi "belum diatur" utk yang tak terdaftar', /— belum diatur —/.test(uaHtml));
ok('ada lencana peringatan "Belum diatur"', /Belum diatur<\/span>/.test(uaHtml));
ok('ada spanduk jumlah yang belum berperan', /belum punya peran/.test(uaHtml));
// Handler harus membaca daftar gabungan yang sama, kalau tidak indeksnya meleset ke orang lain.
ok('changeUserRole memakai userAdminRows', /function changeUserRole\(i,role\)\{\s*const u=userAdminRows\(\)\[i\]/.test(uaHtml));
ok('toggleUserActive memakai userAdminRows', /function toggleUserActive\(i\)\{\s*const u=userAdminRows\(\)\[i\]/.test(uaHtml));
ok('removeUser memakai userAdminRows', /function removeUser\(i\)\{\s*const u=userAdminRows\(\)\[i\]/.test(uaHtml));
ok('tak ada lagi handler yang indeks ke state.users', !/const u=\(state\.users\|\|\[\]\)\[i\]/.test(uaHtml));
// Aksi yang mustahil untuk baris belum terdaftar harus dijaga, bukan cuma disembunyikan.
ok('nonaktifkan dijaga utk yg belum terdaftar', /function toggleUserActive\(i\)[\s\S]{0,200}?!u\.registered\) return/.test(uaHtml));
// Yang belum berperan JUSTRU boleh dihapus — itulah cara membersihkan sisa nama di dropdown.
ok('yang belum berperan boleh dihapus', /function isProtectedUser\(u\)\{ return !!u && u\.registered &&/.test(uaHtml));
// Akun duplikat: nonaktifkan dulu, tombol hapus lalu muncul.
ok('nonaktif melepas kuncian', /isPermanentRole\(u\.role\) && u\.active!==false/.test(uaHtml));
ok('memilih opsi kosong bukan perintah simpan', /function changeUserRole\(i,role\)[\s\S]{0,300}?if\(!role\)\{ renderUserAdmin\(\); return; \}/.test(uaHtml));
ok('keterangan panel menyebut semua nama dikenal', /semua nama yang dikenal sistem/.test(uaHtml));

console.log('\n=== 17. Mode Dev TIDAK aktif sebelum DEV_PIN diisi ===');
eq('PIN kosong ditolak saat DEV_PIN belum diset', call('verifyPin', '__dev__', '').ok, false);
eq('PIN apa pun ditolak', call('verifyPin', '__dev__', '3108').ok, false);
ok('pesannya menjelaskan sebabnya', /DEV_PIN/.test(call('verifyPin', '__dev__', '1234').message || ''));

console.log('\n=== 17b. Ketahanan halaman (Apps Script tanpa CDN) ===');
const pageHtml = call('doGet', {})._html;
// Layar "Memuat…" harus dijamin hilang lewat finally, apa pun yang gagal di tengah.
ok('afterLoad memakai try/finally', /function afterLoad\(\)[\s\S]{0,3000}?\}\s*finally\s*\{[\s\S]{0,200}?getElementById\('loading'\)[\s\S]{0,80}?add\('hide'\)/.test(pageHtml));
ok('error afterLoad dilaporkan ke user', /afterLoad gagal/.test(pageHtml));
// Library CDN dipakai dengan penjagaan, bukan telanjang.
ok('Chart.js dijaga sebelum dipakai', /typeof Chart==='undefined'/.test(pageHtml));
ok('Gantt dijaga', /if\(!window\.Gantt\)/.test(pageHtml));
ok('Sortable dijaga', /window\.Sortable\s*&&/.test(pageHtml));
ok('ada deteksi library yang gagal dimuat', /function missingLibs\(\)/.test(pageHtml));
// .hide tidak boleh bergantung Tailwind (kalau tidak, overlay tak bisa disembunyikan).
ok('.hide didefinisikan di CSS inline', /\.hide\{display:none!important\}/.test(pageHtml));
// localStorage bisa melempar di iframe Apps Script -> semua akses harus aman.
ok('ada pembungkus localStorage aman', /var LS = \{[\s\S]{0,300}catch\(e\)\{ return null; \}/.test(pageHtml));
// Yang paling berbahaya: akses yang jalan SEBELUM/DI LUAR try — kalau melempar, seluruh script mati.
ok('state awal pakai LS.get', /currentUser: LS\.get\('tt_current_user'\)/.test(pageHtml));
ok('applyTheme pakai LS.get', /LS\.get\('theme'\)/.test(pageHtml));
ok('toggleTheme pakai LS.set', /function toggleTheme\(\)\{LS\.set\('theme'/.test(pageHtml));
ok('setCurrentUser pakai LS.set', /setCurrentUser\(user\)\{state\.currentUser=user;LS\.set\('tt_current_user',user\)/.test(pageHtml));

console.log('\n=== 18. doGet: halaman web app ===');
const page = call('doGet', {});
ok('doGet mengembalikan halaman', !!page && typeof page._html === 'string');
ok('halaman = frontend lengkap', page._html.indexOf('<!DOCTYPE html>') === 0 && page._html.indexOf('ProductTrack') > 0);
ok('halaman polos TANPA suntikan mode', !/window\.__TT_VIEW\s*=/.test(page._html));
const pageLintas = call('doGet', { parameter: { view: 'lintas' } });
ok('?view=lintas menyuntikkan __TT_VIEW', /window\.__TT_VIEW="lintas"/.test(pageLintas._html));
ok('suntikan diletakkan sebelum </head>', pageLintas._html.indexOf('__TT_VIEW') < pageLintas._html.indexOf('</head>'));
const pageUnlock = call('doGet', { parameter: { unlock: '1' } });
ok('?unlock=1 -> mode normal', /window\.__TT_VIEW="normal"/.test(pageUnlock._html));
const pageEvil = call('doGet', { parameter: { view: '"><script>alert(1)</script>' } });
ok('parameter berbahaya dibersihkan', !/alert\(1\)/.test(pageEvil._html));
ok('frontend membaca __TT_VIEW', fs.readFileSync(path.join(GAS_DIR, 'Index.html'), 'utf8').indexOf('window.__TT_VIEW') > 0);

console.log(`\n✅ Semua ${passed} assertion lulus.`);
