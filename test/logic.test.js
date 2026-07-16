/**
 * Tes ringan untuk fungsi-fungsi murni di _sheets.js (tanpa jaringan/credential).
 * Jalankan: node test/logic.test.js
 */
const assert = require('assert');
const { _internals } = require('../api/_sheets');
const { formatDate, toSheetDate, generateTaskId, rowToTask, taskToRow, findRowByTaskId, serialToDate } = _internals;

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ✓ ' + name);
  passed++;
}
function eq(name, a, b) {
  assert.strictEqual(a, b, `${name} (got=${JSON.stringify(a)} want=${JSON.stringify(b)})`);
  console.log('  ✓ ' + name);
  passed++;
}

console.log('formatDate (serial number -> tanggal):');
// 2026-06-02 sebagai serial Google Sheets = 46175
eq('serial 46175 -> 2026-06-02', formatDate(46175, false), '2026-06-02');
// serial dengan pecahan waktu (2026-06-02 10:10) -> 46175 + 10:10/24
const serialDT = 46175 + (10 * 60 + 10) / (24 * 60);
eq('serial+time -> 2026-06-02 10:10', formatDate(serialDT, true), '2026-06-02 10:10');

console.log('formatDate (string -> tanggal):');
eq('ISO string', formatDate('2026-06-17', false), '2026-06-17');
eq('ISO datetime trunc ke menit', formatDate('2026-06-17 09:20:33', true), '2026-06-17 09:20');
eq('dd/mm/yyyy', formatDate('17/06/2026', false), '2026-06-17');
eq('empty -> empty', formatDate('', false), '');
eq('teks bebas dikembalikan apa adanya', formatDate('belum ditentukan', false), 'belum ditentukan');

console.log('toSheetDate (nilai -> string utk USER_ENTERED):');
eq('ISO tetap ISO', toSheetDate('2026-06-02'), '2026-06-02');
eq('dd/mm/yyyy -> ISO', toSheetDate('02/06/2026'), '2026-06-02');
eq('kosong -> kosong', toSheetDate(''), '');

console.log('generateTaskId:');
eq('dari [TSK-001, TSK-007, TSK-017] -> TSK-018', generateTaskId(['TSK-001', 'TSK-007', 'TSK-017']), 'TSK-018');
eq('list kosong -> TSK-001', generateTaskId([]), 'TSK-001');
eq('abaikan baris kosong', generateTaskId(['TSK-003', '', 'TSK-010', '']), 'TSK-011');

console.log('findRowByTaskId (data mulai baris 4):');
eq('TSK-007 ada di indeks 1 -> baris 5', findRowByTaskId(['TSK-001', 'TSK-007', 'TSK-017'], 'TSK-007'), 5);
eq('tidak ada -> -1', findRowByTaskId(['TSK-001'], 'TSK-999'), -1);
eq('id kosong -> -1', findRowByTaskId(['TSK-001'], ''), -1);

console.log('rowToTask / taskToRow (round-trip kolom B..V):');
const row = ['TSK-002', 46176, 46194, 'In progress', 'Urgent', 'Bikin dashboard',
  'Manajemen Sistem', 'All Platform', 'Ali', 'Nynda, Kiki', 'Spreadsheet',
  'Backend siap', 'Cek dropdown'];
const t = rowToTask(row, 5);
eq('id', t.id, 'TSK-002');
eq('status', t.status, 'In progress');
eq('pic', t.pic, 'Ali');
eq('support', t.support, 'Nynda, Kiki');
eq('rowNumber', t.rowNumber, 5);
eq('createdDate diformat', t.createdDate, '2026-06-03');
eq('startDate = createdDate (virtual)', t.startDate, '2026-06-03');

const back = taskToRow({
  id: 'TSK-002', createdDate: '2026-06-03', dueDate: '2026-06-21',
  status: 'In progress', priority: 'Urgent', taskName: 'Bikin dashboard', stage: 'Manajemen Sistem',
  platform: 'All Platform', pic: 'Ali', support: ['Nynda', 'Kiki'], document: 'Spreadsheet',
  picNotes: 'Backend siap', pmNotes: 'Cek dropdown',
}, null);
eq('taskToRow panjang 21 kolom (B..V)', back.length, 21);
eq('taskToRow[0] id', back[0], 'TSK-002');
eq('taskToRow support array -> string', back[9], 'Nynda, Kiki');
eq('taskToRow status', back[3], 'In progress');

console.log('\nDefault saat field kosong:');
const def = taskToRow({ taskName: 'X' }, null);
eq('status default Todo', def[3], 'Todo');
eq('priority default Normal', def[4], 'Normal');

console.log('\nIzin "Done" (Done approver terpisah dari hak manager):');
const { canApproveDone, isManagerActor, isDoneStatus } = _internals;
// Yang berwenang menutup task ke "Done".
ok('Nynda (manager) boleh Done', canApproveDone('Nynda') === true);
ok('Dhea boleh Done', canApproveDone('Dhea') === true);
ok('Alya boleh Done', canApproveDone('Alya') === true);
ok('Dev boleh Done', canApproveDone('Dev') === true);
// Yang TIDAK berwenang.
ok('Ali tidak boleh Done', canApproveDone('Ali') === false);
ok('Andika tidak boleh Done', canApproveDone('Andika') === false);
ok('Uma tidak boleh Done', canApproveDone('Uma') === false);
ok('nama kosong tidak boleh Done', canApproveDone('') === false);
// Toleran spasi/kapitalisasi.
ok('"  dhea  " tetap boleh Done', canApproveDone('  dhea  ') === true);
ok('"ALYA" tetap boleh Done', canApproveDone('ALYA') === true);
// Kunci pemisahan: Dhea & Alya boleh Done TAPI bukan manager.
ok('Dhea BUKAN manager', isManagerActor('Dhea') === false);
ok('Alya BUKAN manager', isManagerActor('Alya') === false);
ok('Nynda manager', isManagerActor('Nynda') === true);
// Pengenalan status Done.
ok('"Done" dikenali', isDoneStatus('Done') === true);
ok('" done " dikenali', isDoneStatus(' done ') === true);
ok('"Review PM" bukan Done', isDoneStatus('Review PM') === false);

console.log('\nCeklis task (kepemilikan & parsing centang):');
const { ownsTaskActor, isChecked } = _internals;
const tugasAli = { pic: 'Ali', support: 'Uma, Kiki' };
// PIC & Support boleh menambah/mencentang ceklis task-nya.
ok('PIC (Ali) memiliki task', ownsTaskActor(tugasAli, 'Ali') === true);
ok('Support (Uma) memiliki task', ownsTaskActor(tugasAli, 'Uma') === true);
ok('Support (Kiki) memiliki task', ownsTaskActor(tugasAli, 'Kiki') === true);
ok('support case-insensitive', ownsTaskActor(tugasAli, 'kiki') === true);
// Orang luar tidak.
ok('Andika bukan pemilik task', ownsTaskActor(tugasAli, 'Andika') === false);
ok('actor kosong bukan pemilik', ownsTaskActor(tugasAli, '') === false);
ok('task null aman', ownsTaskActor(null, 'Ali') === false);
// Support kosong tidak boleh cocok dengan nama kosong.
ok('task tanpa support', ownsTaskActor({ pic: 'Ali', support: '' }, 'Uma') === false);
// Parsing kolom Done dari sheet (bisa TRUE/ya/1/x).
ok('"TRUE" tercentang', isChecked('TRUE') === true);
ok('"true" tercentang', isChecked('true') === true);
ok('"ya" tercentang', isChecked('ya') === true);
ok('"1" tercentang', isChecked('1') === true);
ok('"FALSE" tidak tercentang', isChecked('FALSE') === false);
ok('kosong tidak tercentang', isChecked('') === false);

console.log(`\n✅ Semua ${passed} assertion lulus.`);
