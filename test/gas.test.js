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
const delUser = call('deleteUser', 'Anak Magang', 'Dev');
eq('Dev boleh menghapus user', delUser.success, true);
eq('daftar kembali 12 user', delUser.users.length, 12);

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
ok('ada cakupan khusus Komunikasi', /function commScopedTasks\(\)/.test(commHtml));
ok('Leader dipersempit ke PIC/Support', /function commScopedTasks\(\)[\s\S]{0,600}?isLeader\(state\.currentUser\)\) return state\.tasks\.filter\(t=>ownsTask\(t,state\.currentUser\)\)/.test(commHtml));
ok('Manager tetap bisa memantau semua', /function commScopedTasks\(\)[\s\S]{0,400}?isManager\(state\.currentUser\)\)\{[\s\S]{0,200}?return \[\.\.\.state\.tasks\]/.test(commHtml));
ok('daftar Komunikasi memakai commScopedTasks', /const arr=commScopedTasks\(\)/.test(commHtml));
ok('badge unread dihitung dari commScopedTasks', /function totalUnreadTasks\(\)[\s\S]{0,300}?commScopedTasks\(\)/.test(commHtml));
ok('badge TIDAK lagi memakai scopedTasks', !/function totalUnreadTasks\(\)[\s\S]{0,300}?new Set\(scopedTasks\(\)/.test(commHtml));
// Lonceng: dibuka = terbaca, badge habis.
ok('buka lonceng menandai terbaca', /toggleNotifMenu[\s\S]{0,400}?markNotifsReadSilently\(\)/.test(commHtml));
ok('ada penanda-terbaca tanpa render ulang', /function markNotifsReadSilently\(\)/.test(commHtml));
ok('penanda-terbaca memanggil markNotificationsRead', /markNotifsReadSilently\(\)\{[\s\S]{0,400}?markNotificationsRead\(state\.currentUser, ''\)/.test(commHtml));
ok('notifikasi komentar task membuka chat-nya', /function openNotif\(refId\)[\s\S]{0,1500}?selectCommunicationTask\(t\.id\)/.test(commHtml));
ok('komentar sendiri tak dihitung belum-dibaca (toleran)', /!same\(c\.user, state\.currentUser\)/.test(commHtml));

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
