/**
 * ============================================================
 * TASK TRACKER — BACKEND (Google Sheets API)
 * Port dari Code_TaskTracker_New.gs (Apps Script) ke Node.js + googleapis.
 * Menulis ke Google Spreadsheet yang SAMA seperti versi Apps Script.
 *
 * Database utama:
 *   Sheet  : Main
 *   Header : baris 3, mulai kolom B  (B3:Q3)
 *   Data   : mulai baris 4
 *   Kolom  : Task ID, Created Date, Due Date, Start Date, Status, Priority,
 *            Task Name, Stage, Platform, PIC, Support, Document,
 *            Approval Gate, Last Update, PIC Notes, PM Notes
 *
 * Sheet pendukung: OPTIONS, COMMENTS, ACTIVITY (header di baris 1).
 * ============================================================
 */

const { google } = require('googleapis');
const crypto = require('crypto');
const DEV_PIN = String(process.env.DEV_PIN || '3108').trim();
const PIN_SALT = String(process.env.PIN_SALT || 'pt_pin_salt_v1');
function hashPin(user, pin) {
  return crypto.createHash('sha256').update(String(user || '').toLowerCase().trim() + ':' + String(pin || '') + ':' + PIN_SALT).digest('hex');
}

const CONFIG = {
  TASK_SHEET: process.env.MAIN_SHEET_NAME || 'Main',
  OPTIONS_SHEET: 'OPTIONS',
  COMMENTS_SHEET: 'COMMENTS',
  ACTIVITY_SHEET: 'ACTIVITY',
  AUTH_SHEET: 'AUTH',
  LINKS_SHEET: 'LINKS',
  DASHBOARDS_SHEET: 'DASHBOARDS',
  NOTES_SHEET: 'NOTES',
  CHECKLIST_SHEET: 'CHECKLIST',
  COLLAB_SHEET: 'COLLAB',
  COLLAB_STEP_SHEET: 'COLLAB_STEPS',
  HEADER_ROW: 3,
  FIRST_DATA_ROW: 4,
  FIRST_COL_LETTER: 'B',
  LAST_COL_LETTER: 'V',
};

const TASK_HEADERS = [
  'Task ID', 'Created Date', 'Due Date', 'Status', 'Priority',
  'Task Name', 'Stage', 'Platform', 'PIC', 'Support', 'Document',
  'PIC Notes', 'PM Notes', 'Divisi Tujuan', 'Kontak Divisi', 'Kata Kerja', 'Jumlah', 'Objek', 'Detail', 'Dibuat Oleh', 'Lintas View',
];

// Pemetaan field -> kolom (B..V). Urutan tetap.
const COL = {
  taskId: 'B', createdDate: 'C', dueDate: 'D', status: 'E',
  priority: 'F', taskName: 'G', stage: 'H', platform: 'I', pic: 'J',
  support: 'K', document: 'L', picNotes: 'M', pmNotes: 'N',
  divisiTujuan: 'O', kontakDivisi: 'P', verb: 'Q', jumlah: 'R', objek: 'S', detail: 'T', createdBy: 'U', mirror: 'V',
};

// Rumus nama task: Kata Kerja (verb, parent=stage) -> Objek (object, parent="stage||verb"). Jumlah & Detail diisi manual.
const OPTION_TYPES = ['status', 'priority', 'stage', 'platform', 'pic', 'support', 'division', 'verb', 'object'];

const DEFAULT_OPTIONS = {
  status: ['Todo', 'In progress', 'Review PM', 'Revisi', 'Hold', 'Done'],
  priority: ['Urgent', 'High', 'Normal', 'Low'],
  stage: [
    'RnD', 'Develop Materi', 'Develop Soal', 'QC Konten', 'Input',
    'Liveclass', 'Report', 'Data & Intelligence', 'Manajemen Sistem', 'Manajemen Guru',
  ],
  platform: [
    'All Platform', 'Cerebrum', 'JadiASN', 'JadiPPPK', 'JadiBUMN', 'JadiSekdin',
    'JadiBeasiswa', 'JadiOJK', 'JadiPCPM', 'JadiPrajurit', 'JadiPolisi',
    'Jago TPA', 'Siadu', 'Markaz', 'Toefl Academy',
    'IT', 'Marketing', 'Sales',
  ],
  pic: ['Nynda', 'Andika', 'Alya', 'Kiki', 'Bilar', 'Ali', 'Dhea', 'Uma', 'Arifah', 'Lintas Divisi'],
  support: ['Nynda', 'Andika', 'Alya', 'Kiki', 'Bilar', 'Ali', 'Dhea', 'Uma', 'Arifah', 'Lintas Divisi'],
  division: ['IT', 'Marketing', 'Sales'],
};

// Validasi dropdown di dalam Spreadsheet (header -> tipe opsi).
const VALIDATION_MAP = {
  Status: 'status', Priority: 'priority', Stage: 'stage',
  Platform: 'platform', PIC: 'pic', Support: 'support',
  'Divisi Tujuan': 'division',
};

/* ------------------------------------------------------------------ */
/* Auth & client                                                       */
/* ------------------------------------------------------------------ */

let _sheetsClient = null;

function getSpreadsheetId() {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('Env SPREADSHEET_ID belum diset.');
  return id.trim();
}

function getCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Env GOOGLE_SERVICE_ACCOUNT_JSON belum diset.');
  let creds;
  try {
    creds = JSON.parse(raw);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON bukan JSON yang valid.');
  }
  // Vercel kadang menyimpan newline private key sebagai "\\n".
  if (creds.private_key) creds.private_key = String(creds.private_key).replace(/\\n/g, '\n');
  return creds;
}

async function getSheets() {
  if (_sheetsClient) return _sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  _sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return _sheetsClient;
}

function getManagers() {
  const raw = process.env.MANAGERS || 'Nynda';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// Nama tanpa suffix "(...)" -> lowercase, untuk perbandingan yang toleran.
function baseName(s) {
  return String(s || '').replace(/\s*\(.*?\)\s*$/, '').trim().toLowerCase();
}

// Apakah actor seorang manager? (daftar MANAGERS atau akun Dev). Dipakai untuk
// menegakkan aturan: hanya manager yang boleh menetapkan status "Done".
function isManagerActor(name) {
  const n = baseName(name);
  if (!n) return false;
  if (n === 'dev') return true;
  return getManagers().some(m => baseName(m) === n);
}

// Status "Done" bersifat final dan hanya boleh diset oleh "Done approver".
function isDoneStatus(v) {
  return String(v || '').trim().toLowerCase() === 'done';
}

// Siapa yang boleh MENETAPKAN status "Done". Sengaja TERPISAH dari hak manager:
// Dhea & Alya boleh meng-approve Done tanpa ikut jadi manager (tetap Member).
// Manager (MANAGERS) & Dev selalu ikut boleh.
function getDoneApprovers() {
  const raw = process.env.DONE_APPROVERS || 'Nynda,Dhea,Alya';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}
function canApproveDone(name) {
  if (!baseName(name)) return false;
  if (isManagerActor(name)) return true;
  const n = baseName(name);
  return getDoneApprovers().some(a => baseName(a) === n);
}
function doneDeniedMessage() {
  return 'Hanya ' + getDoneApprovers().join(', ') + ' yang bisa menandai task sebagai "Done". Set ke "Review PM" agar diteruskan.';
}

/* ------------------------------------------------------------------ */
/* Low-level Sheets helpers                                            */
/* ------------------------------------------------------------------ */

async function valuesGet(range, opts = {}) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueRenderOption: opts.valueRenderOption || 'UNFORMATTED_VALUE',
    dateTimeRenderOption: opts.dateTimeRenderOption || 'SERIAL_NUMBER',
  });
  return res.data.values || [];
}

async function valuesUpdate(range, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

async function valuesAppend(range, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

async function getSheetMeta() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: getSpreadsheetId(),
    fields: 'sheets.properties(sheetId,title,gridProperties)',
  });
  const map = {};
  (res.data.sheets || []).forEach(s => {
    map[s.properties.title] = s.properties;
  });
  return map;
}

async function batchUpdate(requests) {
  const sheets = await getSheets();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: { requests },
  });
}

/* ------------------------------------------------------------------ */
/* Date helpers (port formatDate_ / toDateOrString_)                   */
/* ------------------------------------------------------------------ */

function pad(n) { return String(n).padStart(2, '0'); }

function serialToDate(serial) {
  // Google Sheets serial -> JS Date. Pakai getter UTC agar komponen = wall clock.
  const ms = Math.round((Number(serial) - 25569) * 86400 * 1000);
  return new Date(ms);
}

function formatDate(value, withTime) {
  if (value === '' || value === null || value === undefined) return '';
  let d = null;
  if (typeof value === 'number') {
    d = serialToDate(value);
  } else if (value instanceof Date) {
    d = value;
  } else {
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (iso) {
      d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0), +(iso[6] || 0)));
    } else if (dmy) {
      d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1], +(dmy[4] || 0), +(dmy[5] || 0)));
    } else {
      return s; // teks tak dikenal -> kembalikan apa adanya
    }
  }
  if (!d || isNaN(d)) return String(value || '');
  const Y = d.getUTCFullYear(), Mo = pad(d.getUTCMonth() + 1), Da = pad(d.getUTCDate());
  if (withTime) return `${Y}-${Mo}-${Da} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return `${Y}-${Mo}-${Da}`;
}

// Untuk ditulis ke sheet (USER_ENTERED). Sheets mengenali format ISO yyyy-mm-dd.
function toSheetDate(value) {
  if (!value) return '';
  if (typeof value === 'number') return formatDate(value, false);
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return s;
}

function nowStamp() {
  const offsetMin = parseInt(process.env.TIMEZONE_OFFSET_MINUTES || '420', 10);
  const local = new Date(Date.now() + offsetMin * 60000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())} `
    + `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`;
}

/* ------------------------------------------------------------------ */
/* Mapping baris <-> task                                              */
/* ------------------------------------------------------------------ */

function rowToTask(row, rowNumber) {
  const g = i => (row[i] === undefined || row[i] === null ? '' : row[i]);
  const createdDate = formatDate(g(1), false);
  return {
    rowNumber,
    id: String(g(0)).trim(),
    createdDate,
    dueDate: formatDate(g(2), false),
    status: String(g(3)).trim(),
    priority: String(g(4)).trim(),
    taskName: String(g(5)).trim(),
    stage: String(g(6)).trim(),
    platform: String(g(7)).trim(),
    pic: String(g(8)).trim(),
    support: String(g(9)).trim(),
    document: String(g(10)).trim(),
    picNotes: String(g(11)).trim(),
    pmNotes: String(g(12)).trim(),
    divisiTujuan: String(g(13)).trim(),
    kontakDivisi: String(g(14)).trim(),
    verb: String(g(15)).trim(),
    jumlah: String(g(16)).trim(),
    objek: String(g(17)).trim(),
    detail: String(g(18)).trim(),
    createdBy: String(g(19)).trim(),
    mirror: String(g(20)).trim(),
    // Field virtual (tidak ada kolomnya di sheet ini) — disediakan agar UI lama tetap jalan.
    startDate: createdDate,
    approvalGate: '',
    lastUpdate: '',
  };
}

function taskToRow(task, existingTask) {
  const id = task.id || null; // di-resolve oleh pemanggil bila perlu generate
  const createdDate = task.createdDate || (existingTask && existingTask.createdDate) || toSheetDate(new Date());
  const support = Array.isArray(task.support) ? task.support.join(', ') : String(task.support || '');
  // Sheet ini 15 kolom (B..P): tanpa Start Date, Approval Gate, Last Update.
  return [
    id || '',
    toSheetDate(createdDate),
    toSheetDate(task.dueDate || ''),
    task.status || 'Todo',
    task.priority || 'Normal',
    task.taskName || '',
    task.stage || '',
    task.platform || '',
    task.pic || '',
    support,
    task.document || '',
    task.picNotes || '',
    task.pmNotes || '',
    task.divisiTujuan || '',
    task.kontakDivisi || '',
    task.verb || '',
    task.jumlah || '',
    task.objek || '',
    task.detail || '',
    (task.createdBy || (existingTask && existingTask.createdBy) || ''),
    (task.mirror ? 'Ya' : ''),
  ];
}

/* ------------------------------------------------------------------ */
/* TASKS                                                               */
/* ------------------------------------------------------------------ */

const MAIN_DATA_RANGE = () =>
  `${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${CONFIG.FIRST_DATA_ROW}:${CONFIG.LAST_COL_LETTER}`;

async function getTasks() {
  const rows = await valuesGet(MAIN_DATA_RANGE());
  return rows
    .map((row, idx) => rowToTask(row, CONFIG.FIRST_DATA_ROW + idx))
    .filter(t => t.id || t.taskName);
}

async function getTaskIdColumn() {
  // Hanya kolom Task ID (B4:B) untuk cari baris & generate ID.
  const rows = await valuesGet(`${CONFIG.TASK_SHEET}!${COL.taskId}${CONFIG.FIRST_DATA_ROW}:${COL.taskId}`);
  return rows.map(r => String((r && r[0]) || '').trim());
}

function findRowByTaskId(ids, taskId) {
  if (!taskId) return -1;
  const needle = String(taskId).trim();
  const idx = ids.findIndex(v => v === needle);
  return idx === -1 ? -1 : CONFIG.FIRST_DATA_ROW + idx;
}

function generateTaskId(ids) {
  let max = 0;
  ids.forEach(v => {
    const m = String(v || '').match(/(\d+)\s*$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'TSK-' + String(max + 1).padStart(3, '0');
}

async function saveTask(task) {
  if (!task) return { success: false, message: 'Data task kosong.' };
  if (!String(task.taskName || '').trim()) return { success: false, message: 'Task Name wajib diisi.' };

  const ids = await getTaskIdColumn();
  let rowNumber = -1;
  let existingTask = null;

  if (task.id) {
    rowNumber = findRowByTaskId(ids, task.id);
    if (rowNumber !== -1) {
      const cur = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`);
      existingTask = rowToTask(cur[0] || [], rowNumber);
    }
  }
  const isUpdate = rowNumber !== -1;
  const actor = String(task.actor || '').trim() || 'Unknown';

  // Gerbang "Done": hanya Done approver yang boleh MENETAPKAN status ke Done.
  // Perpindahan KE Done oleh yang tak berhak ditolak; task yang sudah Done boleh
  // tetap Done atau ditarik balik (bukan aksi "membuat Done").
  const oldStatus = (existingTask && existingTask.status) || '';
  if (isDoneStatus(task.status) && !isDoneStatus(oldStatus) && !canApproveDone(actor)) {
    return { success: false, message: doneDeniedMessage() };
  }

  // Pastikan ID terisi. createdBy = pembuat task (di-set saat create, dipertahankan saat update).
  const finalId = task.id || generateTaskId(ids);
  const createdBy = isUpdate ? ((existingTask && existingTask.createdBy) || task.createdBy || '') : actor;
  const rowData = taskToRow(Object.assign({}, task, { id: finalId, createdBy }), existingTask);

  if (!isUpdate) {
    rowNumber = CONFIG.FIRST_DATA_ROW + ids.length; // baris kosong berikutnya
  }
  await valuesUpdate(
    `${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`,
    [rowData],
  );

  const savedRows = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`);
  const saved = rowToTask(savedRows[0] || rowData, rowNumber);
  await logActivity(actor, isUpdate ? 'Update Task' : 'Create Task', saved.id,
    `${saved.taskName} • Status: ${saved.status} • PIC: ${saved.pic}`);

  const tasks = await getTasks();
  return { success: true, message: 'Task berhasil disimpan.', task: saved, tasks };
}

async function deleteTask(taskId, actor) {
  const ids = await getTaskIdColumn();
  const rowNumber = findRowByTaskId(ids, taskId);
  if (rowNumber === -1) return { success: false, message: 'Task ID tidak ditemukan.' };

  const cur = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`);
  const removed = rowToTask(cur[0] || [], rowNumber);

  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.TASK_SHEET] && meta[CONFIG.TASK_SHEET].sheetId;
  if (sheetId === undefined || sheetId === null) return { success: false, message: 'Sheet Main tidak ditemukan.' };

  await batchUpdate([{
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber },
    },
  }]);

  await logActivity(String(actor || '').trim() || 'Unknown', 'Delete Task', taskId, removed.taskName || '');
  const tasks = await getTasks();
  return { success: true, message: 'Task berhasil dihapus.', tasks };
}

const QUICK_FIELD_COL = {
  status: COL.status, priority: COL.priority, pic: COL.pic, stage: COL.stage, mirror: COL.mirror,
};

async function quickUpdateField(taskId, field, value, actor) {
  const f = String(field || '');
  const ids = await getTaskIdColumn();
  const row = findRowByTaskId(ids, taskId);
  if (row === -1) return { success: false, message: 'Task ID tidak ditemukan.' };

  const col = QUICK_FIELD_COL[f];
  if (!col) {
    // Field 'virtual' tanpa kolom di sheet ini: no-op sukses agar UI tidak menampilkan error.
    if (['startDate', 'approvalGate', 'lastUpdate'].includes(f)) {
      const cur0 = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${row}:${CONFIG.LAST_COL_LETTER}${row}`);
      return { success: true, message: `${f} dinonaktifkan (tidak disimpan).`, task: rowToTask(cur0[0] || [], row) };
    }
    return { success: false, message: 'Field tidak didukung: ' + field };
  }

  // Gerbang "Done": yang bukan Done approver tak boleh memindahkan task KE Done.
  // Task yang sudah Done tetap boleh diubah (mis. ditarik balik) — yang dilarang
  // hanya aksi menetapkan Done. Baca status lama dulu untuk membedakannya.
  if (f === 'status' && isDoneStatus(value) && !canApproveDone(actor)) {
    const cur0 = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${row}:${CONFIG.LAST_COL_LETTER}${row}`);
    const existing = rowToTask(cur0[0] || [], row);
    if (!isDoneStatus(existing.status)) {
      return { success: false, message: doneDeniedMessage() };
    }
  }

  await valuesUpdate(`${CONFIG.TASK_SHEET}!${col}${row}`, [[value]]);
  await logActivity(String(actor || '').trim() || 'Unknown', 'Update Task', taskId, `${field} → ${value}`);

  const cur = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${row}:${CONFIG.LAST_COL_LETTER}${row}`);
  const saved = rowToTask(cur[0] || [], row);
  return { success: true, message: `${field} diperbarui.`, task: saved };
}

async function quickUpdateDates(taskId, startDate, dueDate, actor) {
  const ids = await getTaskIdColumn();
  const row = findRowByTaskId(ids, taskId);
  if (row === -1) return { success: false, message: 'Task ID tidak ditemukan.' };

  // Sheet ini hanya punya kolom Due Date (tanpa Start Date / Last Update).
  const data = [];
  if (dueDate) data.push({ range: `${CONFIG.TASK_SHEET}!${COL.dueDate}${row}`, values: [[toSheetDate(dueDate)]] });

  if (data.length) {
    const sheets = await getSheets();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    });
  }

  await logActivity(String(actor || '').trim() || 'Unknown', 'Update Task', taskId,
    `Jadwal: ${startDate || '?'} → ${dueDate || '?'}`);

  const cur = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${row}:${CONFIG.LAST_COL_LETTER}${row}`);
  const saved = rowToTask(cur[0] || [], row);
  return { success: true, message: 'Jadwal diperbarui.', task: saved };
}

/* ------------------------------------------------------------------ */
/* OPTIONS                                                             */
/* ------------------------------------------------------------------ */

async function readOptionsRaw() {
  const rows = await valuesGet(`${CONFIG.OPTIONS_SHEET}!A2:D`, { valueRenderOption: 'UNFORMATTED_VALUE' });
  return rows
    .map((r, i) => ({
      row: i + 2,
      type: String((r && r[0]) || '').trim(),
      value: String((r && r[1]) || '').trim(),
      active: r && (r[2] === true || String(r[2]).toUpperCase() === 'TRUE'),
      parent: String((r && r[3]) || '').trim(),
    }))
    .filter(r => r.type && r.value);
}

async function getOptions() {
  let raw = [];
  try {
    raw = (await readOptionsRaw()).filter(r => r.active);
  } catch (e) {
    raw = [];
  }
  const options = {};
  OPTION_TYPES.forEach(t => (options[t] = []));
  const verbMap = {};  // { stage: [kata kerja, ...] }
  const objekMap = {}; // { "stage||verb": [objek, ...] }
  raw.forEach(row => {
    if (!options[row.type]) options[row.type] = [];
    if (!options[row.type].includes(row.value)) options[row.type].push(row.value);
    if (row.type === 'verb' && row.parent) { (verbMap[row.parent] = verbMap[row.parent] || []); if (!verbMap[row.parent].includes(row.value)) verbMap[row.parent].push(row.value); }
    if (row.type === 'object' && row.parent) { (objekMap[row.parent] = objekMap[row.parent] || []); if (!objekMap[row.parent].includes(row.value)) objekMap[row.parent].push(row.value); }
  });
  OPTION_TYPES.forEach(t => {
    if (!options[t] || !options[t].length) options[t] = DEFAULT_OPTIONS[t] || [];
  });
  options.verbMap = verbMap;
  options.objekMap = objekMap;
  return options;
}

const USES_PARENT = ['verb', 'object']; // tipe opsi bertingkat (punya induk di kolom Parent): kata kerja & objek

async function saveOption(type, value, parent) {
  type = String(type || '').trim();
  value = String(value || '').trim();
  parent = String(parent || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };
  if (!value) return { success: false, message: 'Nilai opsi tidak boleh kosong.' };
  if (USES_PARENT.includes(type) && !parent) return { success: false, message: 'Opsi ini wajib punya induk (parent).' };

  await ensureOptionsSheet();
  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === value.toLowerCase() && (!USES_PARENT.includes(type) || r.parent.toLowerCase() === parent.toLowerCase()));
  if (found) {
    await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!C${found.row}:D${found.row}`, [[true, parent]]);
  } else {
    await valuesAppend(`${CONFIG.OPTIONS_SHEET}!A:D`, [[type, value, true, parent]]);
  }
  await applySheetValidations().catch(() => {});
  return { success: true, message: 'Opsi berhasil disimpan.', options: await getOptions() };
}

async function deleteOption(type, value, parent) {
  type = String(type || '').trim();
  value = String(value || '').trim();
  parent = String(parent || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };

  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === value.toLowerCase() && (!USES_PARENT.includes(type) || r.parent.toLowerCase() === parent.toLowerCase()));
  if (found) await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!C${found.row}`, [[false]]);
  await applySheetValidations().catch(() => {});
  return { success: true, message: 'Opsi berhasil dinonaktifkan.', options: await getOptions() };
}

// Edit (rename) nilai opsi + cascade ke task yang masih memakai nilai lama.
async function editOption(type, oldValue, newValue, parent) {
  type = String(type || '').trim();
  oldValue = String(oldValue || '').trim();
  newValue = String(newValue || '').trim();
  parent = String(parent || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };
  if (!oldValue || !newValue) return { success: false, message: 'Nilai lama/baru tidak boleh kosong.' };
  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === oldValue.toLowerCase() && (!USES_PARENT.includes(type) || r.parent.toLowerCase() === parent.toLowerCase()));
  if (!found) return { success: false, message: 'Opsi tidak ditemukan.' };
  await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!B${found.row}`, [[newValue]]);

  if (USES_PARENT.includes(type)) {
    // Kata kerja / objek: cukup ganti nama opsi. Nama task lama tidak diubah otomatis.
    await applySheetValidations().catch(() => {});
    return { success: true, message: `"${oldValue}" diubah menjadi "${newValue}".`, options: await getOptions() };
  }

  const col = COL[type];
  if (col) {
    const taskRows = await valuesGet(MAIN_DATA_RANGE());
    const colIdx = col.charCodeAt(0) - 'B'.charCodeAt(0);
    const data = [];
    taskRows.forEach((row, idx) => {
      const cur = String((row && row[colIdx]) || '');
      if (!cur) return;
      const rowNumber = CONFIG.FIRST_DATA_ROW + idx;
      if (type === 'support') {
        const parts = cur.split(',').map(s => s.trim()).filter(Boolean);
        if (parts.some(p => p.toLowerCase() === oldValue.toLowerCase())) {
          const np = parts.map(p => p.toLowerCase() === oldValue.toLowerCase() ? newValue : p).join(', ');
          data.push({ range: `${CONFIG.TASK_SHEET}!${col}${rowNumber}`, values: [[np]] });
        }
      } else if (cur.toLowerCase() === oldValue.toLowerCase()) {
        data.push({ range: `${CONFIG.TASK_SHEET}!${col}${rowNumber}`, values: [[newValue]] });
      }
    });
    if (data.length) {
      const sheets = await getSheets();
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: getSpreadsheetId(), requestBody: { valueInputOption: 'USER_ENTERED', data } });
    }
  }
  await applySheetValidations().catch(() => {});
  return { success: true, message: `"${oldValue}" diubah menjadi "${newValue}".`, options: await getOptions(), tasks: await getTasks() };
}

/* ------------------------------------------------------------------ */
/* COMMENTS                                                            */
/* ------------------------------------------------------------------ */

async function getComments(taskId) {
  let rows = [];
  try {
    rows = await valuesGet(`${CONFIG.COMMENTS_SHEET}!A2:D`);
  } catch (e) {
    return [];
  }
  return rows
    .filter(r => String((r && r[1]) || '') === String(taskId || ''))
    .map(r => ({
      timestamp: formatDate(r[0], true),
      taskId: String(r[1] || ''),
      author: String(r[2] || ''),
      message: String(r[3] || ''),
    }));
}

async function addComment(payload) {
  const taskId = String((payload && payload.taskId) || '').trim();
  const author = String((payload && payload.author) || 'Unknown').trim();
  const message = String((payload && payload.message) || '').trim();
  if (!taskId) return { success: false, message: 'Task ID tidak valid.' };
  if (!message) return { success: false, message: 'Komentar tidak boleh kosong.' };

  await ensureCommentsSheet();
  await valuesAppend(`${CONFIG.COMMENTS_SHEET}!A:D`, [[nowStamp(), taskId, author, message]]);
  await logActivity(author, 'Comment', taskId, message.length > 120 ? message.slice(0, 117) + '...' : message);
  return { success: true, message: 'Komentar berhasil ditambahkan.', comments: await getComments(taskId) };
}

/* ------------------------------------------------------------------ */
/* CHECKLIST (ceklis per task: PM menyusun, PIC mencentang)            */
/* ------------------------------------------------------------------ */

async function ensureChecklistSheet() {
  await ensureSheetExists(CONFIG.CHECKLIST_SHEET);
  const head = await valuesGet(`${CONFIG.CHECKLIST_SHEET}!A1:F1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.CHECKLIST_SHEET}!A1:F1`,
      [['Task ID', 'Item', 'Done', 'Created By', 'Checked By', 'Checked At']]);
  }
}

function isChecked(v) {
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === 'ya' || s === 'yes' || s === '1' || s === 'x';
}

// Actor adalah PIC atau Support dari task ini? (server-side, mencerminkan ownsTask di UI)
function ownsTaskActor(task, actor) {
  const a = baseName(actor);
  if (!a || !task) return false;
  if (baseName(task.pic) === a) return true;
  return String(task.support || '').split(',').map(s => baseName(s)).filter(Boolean).includes(a);
}

async function getTaskById(taskId) {
  const ids = await getTaskIdColumn();
  const row = findRowByTaskId(ids, taskId);
  if (row === -1) return null;
  const cur = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${row}:${CONFIG.LAST_COL_LETTER}${row}`);
  return rowToTask(cur[0] || [], row);
}

// Boleh menambah item & mencentang: manager/Dev, atau PIC/Support task itu.
// Boleh menghapus item: manager/Dev SAJA (item dari PM tak boleh dihilangkan PIC).
async function canEditChecklist(taskId, actor) {
  if (isManagerActor(actor)) return true;
  const task = await getTaskById(taskId);
  return ownsTaskActor(task, actor);
}

async function getChecklist(taskId) {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.CHECKLIST_SHEET}!A2:F`); } catch (e) { return []; }
  return rows
    .map((r, i) => ({
      row: i + 2,
      taskId: String((r && r[0]) || '').trim(),
      item: String((r && r[1]) || '').trim(),
      done: isChecked(r && r[2]),
      createdBy: String((r && r[3]) || '').trim(),
      checkedBy: String((r && r[4]) || '').trim(),
      checkedAt: String((r && r[5]) || '').trim(),
    }))
    .filter(c => c.taskId === String(taskId || '').trim() && c.item);
}

async function addChecklistItem(taskId, item, actor) {
  taskId = String(taskId || '').trim();
  item = String(item || '').trim();
  actor = String(actor || '').trim() || 'Unknown';
  if (!taskId) return { success: false, message: 'Task ID tidak valid.' };
  if (!item) return { success: false, message: 'Item ceklis tidak boleh kosong.' };
  if (!(await canEditChecklist(taskId, actor))) {
    return { success: false, message: 'Hanya PM atau PIC/Support task ini yang bisa menambah item ceklis.' };
  }
  await ensureChecklistSheet();
  await valuesAppend(`${CONFIG.CHECKLIST_SHEET}!A:F`, [[taskId, item, 'FALSE', actor, '', '']]);
  await logActivity(actor, 'Checklist Add', taskId, item.length > 120 ? item.slice(0, 117) + '...' : item);
  return { success: true, message: 'Item ceklis ditambahkan.', checklist: await getChecklist(taskId) };
}

async function setChecklistDone(taskId, row, done, actor) {
  taskId = String(taskId || '').trim();
  row = parseInt(row, 10);
  actor = String(actor || '').trim() || 'Unknown';
  const val = !!done;
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!(await canEditChecklist(taskId, actor))) {
    return { success: false, message: 'Hanya PM atau PIC/Support task ini yang bisa mencentang ceklis.' };
  }
  // Pastikan baris ini benar milik task tsb (hindari salah-centang bila baris bergeser).
  const cur = await valuesGet(`${CONFIG.CHECKLIST_SHEET}!A${row}:B${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner !== taskId) return { success: false, message: 'Item ceklis tidak cocok dengan task ini. Muat ulang.' };
  await valuesUpdate(`${CONFIG.CHECKLIST_SHEET}!C${row}:F${row}`,
    [[val ? 'TRUE' : 'FALSE', String((cur[0] && cur[0][1]) || ''), val ? actor : '', val ? nowStamp() : '']]);
  return { success: true, message: val ? 'Item dicentang.' : 'Centang dibatalkan.', checklist: await getChecklist(taskId) };
}

async function deleteChecklistItem(taskId, row, actor) {
  taskId = String(taskId || '').trim();
  row = parseInt(row, 10);
  actor = String(actor || '').trim() || 'Unknown';
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!isManagerActor(actor)) return { success: false, message: 'Hanya PM/Dev yang bisa menghapus item ceklis.' };
  const cur = await valuesGet(`${CONFIG.CHECKLIST_SHEET}!A${row}:B${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner !== taskId) return { success: false, message: 'Item ceklis tidak cocok dengan task ini. Muat ulang.' };
  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.CHECKLIST_SHEET] && meta[CONFIG.CHECKLIST_SHEET].sheetId;
  if (sheetId == null) return { success: false, message: 'Sheet CHECKLIST tidak ditemukan.' };
  await batchUpdate([{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }]);
  await logActivity(actor, 'Checklist Delete', taskId, String((cur[0] && cur[0][1]) || ''));
  return { success: true, message: 'Item ceklis dihapus.', checklist: await getChecklist(taskId) };
}

// Ringkasan progres semua task (untuk bootstrap): { taskId: {done, total} }
async function getChecklistSummary() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.CHECKLIST_SHEET}!A2:C`); } catch (e) { return {}; }
  const out = {};
  rows.forEach(r => {
    const id = String((r && r[0]) || '').trim();
    if (!id || !String((r && r[1]) || '').trim()) return;
    if (!out[id]) out[id] = { done: 0, total: 0 };
    out[id].total++;
    if (isChecked(r && r[2])) out[id].done++;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* COLLAB (task kolaborasi: alur proses beruntun antar-PIC)            */
/* Manager menyusun proses (nama + PIC + deadline); tiap proses hanya  */
/* bisa dicentang oleh PIC-nya. Urutan dipakai untuk handoff/notif.    */
/* ------------------------------------------------------------------ */

async function ensureCollabSheets() {
  await ensureSheetExists(CONFIG.COLLAB_SHEET);
  let head = await valuesGet(`${CONFIG.COLLAB_SHEET}!A1:F1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.COLLAB_SHEET}!A1:F1`, [['Collab ID', 'Platform', 'Title', 'Description', 'Created By', 'Created At']]);
  }
  await ensureSheetExists(CONFIG.COLLAB_STEP_SHEET);
  head = await valuesGet(`${CONFIG.COLLAB_STEP_SHEET}!A1:H1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.COLLAB_STEP_SHEET}!A1:H1`, [['Collab ID', 'Order', 'Step', 'PIC', 'Deadline', 'Done', 'Done By', 'Done At']]);
  }
}

function genCollabId(ids) {
  let max = 0;
  (ids || []).forEach(v => { const m = String(v || '').match(/(\d+)\s*$/); if (m) max = Math.max(max, Number(m[1])); });
  return 'COL-' + String(max + 1).padStart(3, '0');
}

// Boleh mencentang proses ini? Hanya PIC proses tsb, atau Dev (super-user).
function canCheckStep(stepPic, actor) {
  if (baseName(actor) === 'dev') return true;
  const p = baseName(stepPic);
  return !!p && p === baseName(actor);
}

async function getCollabs() {
  let crows = [], srows = [];
  try { crows = await valuesGet(`${CONFIG.COLLAB_SHEET}!A2:F`); } catch (e) { return []; }
  try { srows = await valuesGet(`${CONFIG.COLLAB_STEP_SHEET}!A2:H`); } catch (e) { srows = []; }
  const steps = {};
  srows.forEach((r, i) => {
    const cid = String((r && r[0]) || '').trim(); if (!cid) return;
    (steps[cid] = steps[cid] || []).push({
      row: i + 2,
      order: Number((r && r[1]) || 0),
      name: String((r && r[2]) || '').trim(),
      pic: String((r && r[3]) || '').trim(),
      deadline: (r && r[4] != null && r[4] !== '') ? formatDate(r[4], false) : '',
      done: isChecked(r && r[5]),
      doneBy: String((r && r[6]) || '').trim(),
      doneAt: String((r && r[7]) || '').trim(),
    });
  });
  Object.values(steps).forEach(list => list.sort((a, b) => a.order - b.order));
  return crows.map((r, i) => {
    const id = String((r && r[0]) || '').trim();
    const list = steps[id] || [];
    const done = list.filter(s => s.done).length;
    return {
      row: i + 2, id,
      platform: String((r && r[1]) || '').trim(),
      title: String((r && r[2]) || '').trim(),
      description: String((r && r[3]) || '').trim(),
      createdBy: String((r && r[4]) || '').trim(),
      createdAt: String((r && r[5]) || '').trim(),
      steps: list, done, total: list.length,
      status: (list.length && done >= list.length) ? 'Selesai' : 'Aktif',
    };
  }).filter(c => c.id);
}

// Hapus semua baris step milik satu collab (descending agar index tak bergeser).
async function deleteStepRowsForCollab(collabId) {
  let srows = [];
  try { srows = await valuesGet(`${CONFIG.COLLAB_STEP_SHEET}!A2:A`); } catch (e) { return; }
  const rowsToDelete = [];
  srows.forEach((r, i) => { if (String((r && r[0]) || '').trim() === collabId) rowsToDelete.push(i + 2); });
  if (!rowsToDelete.length) return;
  const meta = await getSheetMeta();
  const sid = meta[CONFIG.COLLAB_STEP_SHEET] && meta[CONFIG.COLLAB_STEP_SHEET].sheetId;
  if (sid == null) return;
  const reqs = rowsToDelete.sort((a, b) => b - a)
    .map(rn => ({ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: rn - 1, endIndex: rn } } }));
  await batchUpdate(reqs);
}

async function saveCollab(payload, actor) {
  actor = String(actor || '').trim() || 'Unknown';
  if (!isManagerActor(actor)) return { success: false, message: 'Hanya manager/Dev yang bisa membuat/mengubah task kolaborasi.' };
  const platform = String((payload && payload.platform) || '').trim();
  const title = String((payload && payload.title) || '').trim();
  const description = String((payload && payload.description) || '').trim();
  const steps = Array.isArray(payload && payload.steps) ? payload.steps : [];
  if (!title) return { success: false, message: 'Judul task kolaborasi wajib diisi.' };
  const clean = steps.map(s => ({ name: String((s && s.name) || '').trim(), pic: String((s && s.pic) || '').trim(), deadline: String((s && s.deadline) || '').trim() }))
    .filter(s => s.name);
  if (!clean.length) return { success: false, message: 'Minimal 1 proses (nama proses wajib diisi).' };

  await ensureCollabSheets();
  let crows = [];
  try { crows = await valuesGet(`${CONFIG.COLLAB_SHEET}!A2:F`); } catch (e) { crows = []; }
  const ids = crows.map(r => String((r && r[0]) || '').trim());
  let id = String((payload && payload.id) || '').trim();
  const isUpdate = id && ids.includes(id);

  // Simpan status "done" proses lama agar tidak hilang saat manager mengedit struktur.
  let prevDone = {};
  if (isUpdate) {
    const existing = (await getCollabs()).find(c => c.id === id);
    if (existing) existing.steps.forEach(s => { prevDone[s.order] = { done: s.done, doneBy: s.doneBy, doneAt: s.doneAt }; });
  }

  if (isUpdate) {
    const rn = ids.indexOf(id) + 2;
    const keepBy = String((crows[rn - 2] && crows[rn - 2][4]) || actor);
    const keepAt = String((crows[rn - 2] && crows[rn - 2][5]) || nowStamp());
    await valuesUpdate(`${CONFIG.COLLAB_SHEET}!A${rn}:F${rn}`, [[id, platform, title, description, keepBy, keepAt]]);
    await deleteStepRowsForCollab(id);
  } else {
    id = genCollabId(ids);
    await valuesAppend(`${CONFIG.COLLAB_SHEET}!A:F`, [[id, platform, title, description, actor, nowStamp()]]);
  }

  const stepRows = clean.map((s, i) => {
    const order = i + 1;
    const pd = prevDone[order] || {};
    return [id, order, s.name, s.pic, s.deadline ? toSheetDate(s.deadline) : '', pd.done ? 'TRUE' : 'FALSE', pd.doneBy || '', pd.doneAt || ''];
  });
  if (stepRows.length) await valuesAppend(`${CONFIG.COLLAB_STEP_SHEET}!A:H`, stepRows);

  await logActivity(actor, isUpdate ? 'Collab Update' : 'Collab Create', id, `${title} • ${clean.length} proses`);
  return { success: true, message: isUpdate ? 'Task kolaborasi diperbarui.' : 'Task kolaborasi dibuat.', collabs: await getCollabs() };
}

async function setCollabStepDone(collabId, order, done, actor) {
  collabId = String(collabId || '').trim();
  order = Number(order);
  actor = String(actor || '').trim() || 'Unknown';
  const val = !!done;
  await ensureCollabSheets();
  let srows = [];
  try { srows = await valuesGet(`${CONFIG.COLLAB_STEP_SHEET}!A2:H`); } catch (e) { srows = []; }
  let idx = -1;
  for (let i = 0; i < srows.length; i++) {
    const r = srows[i];
    if (String((r && r[0]) || '').trim() === collabId && Number((r && r[1]) || 0) === order) { idx = i; break; }
  }
  if (idx < 0) return { success: false, message: 'Proses tidak ditemukan. Muat ulang.' };
  const r = srows[idx];
  const pic = String((r && r[3]) || '').trim();
  if (!canCheckStep(pic, actor)) {
    return { success: false, message: `Hanya ${pic || 'PIC proses ini'} yang bisa mencentang proses ini.` };
  }
  const rn = idx + 2;
  await valuesUpdate(`${CONFIG.COLLAB_STEP_SHEET}!F${rn}:H${rn}`, [[val ? 'TRUE' : 'FALSE', val ? actor : '', val ? nowStamp() : '']]);
  await logActivity(actor, val ? 'Collab Step Done' : 'Collab Step Undone', collabId, `Proses ${order}: ${String((r && r[2]) || '')}`);
  return { success: true, message: val ? 'Proses dicentang.' : 'Centang dibatalkan.', collabs: await getCollabs() };
}

async function deleteCollab(id, actor) {
  actor = String(actor || '').trim() || 'Unknown';
  if (!isManagerActor(actor)) return { success: false, message: 'Hanya manager/Dev yang bisa menghapus task kolaborasi.' };
  id = String(id || '').trim();
  await ensureCollabSheets();
  await deleteStepRowsForCollab(id);
  let crows = [];
  try { crows = await valuesGet(`${CONFIG.COLLAB_SHEET}!A2:F`); } catch (e) { crows = []; }
  const ci = crows.findIndex(r => String((r && r[0]) || '').trim() === id);
  if (ci >= 0) {
    const meta = await getSheetMeta();
    const sid = meta[CONFIG.COLLAB_SHEET] && meta[CONFIG.COLLAB_SHEET].sheetId;
    if (sid != null) await batchUpdate([{ deleteDimension: { range: { sheetId: sid, dimension: 'ROWS', startIndex: (ci + 2) - 1, endIndex: (ci + 2) } } }]);
  }
  await logActivity(actor, 'Collab Delete', id, '');
  return { success: true, message: 'Task kolaborasi dihapus.', collabs: await getCollabs() };
}

/* ------------------------------------------------------------------ */
/* ACTIVITY                                                            */
/* ------------------------------------------------------------------ */

async function logActivity(user, action, taskId, detail) {
  try {
    await valuesAppend(`${CONFIG.ACTIVITY_SHEET}!A:E`,
      [[nowStamp(), String(user || 'Unknown'), String(action || ''), String(taskId || ''), String(detail || '')]]);
  } catch (e) {
    // Logging tidak boleh menggagalkan operasi utama.
  }
}

async function getActivityLog(limit) {
  let rows = [];
  try {
    rows = await valuesGet(`${CONFIG.ACTIVITY_SHEET}!A2:E`);
  } catch (e) {
    return [];
  }
  const out = rows
    .map(r => ({
      timestamp: formatDate(r[0], true),
      user: String(r[1] || ''),
      action: String(r[2] || ''),
      taskId: String(r[3] || ''),
      detail: String(r[4] || ''),
    }))
    .filter(r => r.timestamp || r.user);
  out.reverse(); // terbaru di atas
  const max = Number(limit) > 0 ? Number(limit) : 200;
  return out.slice(0, max);
}

/* ------------------------------------------------------------------ */
/* BOOTSTRAP                                                           */
/* ------------------------------------------------------------------ */

async function getAllCommentsLite() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.COMMENTS_SHEET}!A2:D`); } catch (e) { return []; }
  return rows
    .map(r => ({ timestamp: formatDate(r && r[0], true), taskId: String((r && r[1]) || ''), author: String((r && r[2]) || '') }))
    .filter(c => c.taskId);
}

async function getBootstrapData(opts) {
  const viewOnly = !!(opts && opts.viewOnly);
  const [tasks, options, activity, commentsSummary, pinUsers, links, dashboards, notes, checklistSummary, collabs] = await Promise.all([
    getTasks(),
    getOptions(),
    getActivityLog(200),
    getAllCommentsLite(),
    listPinUsers(),
    getAllLinks(),
    getAllDashboards(),
    getAllNotes(),
    getChecklistSummary(),
    getCollabs().catch(() => []),
  ]);
  if (viewOnly) {
    // Tamu tanpa PIN: hanya task yang di-set Lintas (punya Divisi Tujuan) atau di-mirror,
    // plus opsi (utk label/warna), dashboards, dan ringkasan chat pada task tsb.
    const isShown = (t) => {
      const ext = String((t && t.divisiTujuan) || '').trim() !== '';
      const mir = /^(ya|yes|true|1)$/i.test(String((t && t.mirror) || '').trim());
      return ext || mir;
    };
    const shown = (tasks || []).filter(isShown);
    const shownIds = new Set(shown.map(t => t.id));
    return {
      tasks: shown,
      options,
      activity: [],
      commentsSummary: (commentsSummary || []).filter(c => shownIds.has(c.taskId)),
      pinUsers: [],
      links: [],
      dashboards: dashboards || [],
      notes: [],
      viewOnly: true,
      meta: {
        sheetName: CONFIG.TASK_SHEET,
        managers: getManagers(),
        doneApprovers: getDoneApprovers(),
        generatedAt: nowStamp(),
      },
    };
  }
  return {
    tasks,
    options,
    activity,
    commentsSummary,
    pinUsers,
    links,
    dashboards,
    notes,
    checklistSummary,
    collabs,
    meta: {
      sheetName: CONFIG.TASK_SHEET,
      managers: getManagers(),
      doneApprovers: getDoneApprovers(),
      generatedAt: nowStamp(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* SETUP (buat sheet/header/opsi default bila belum ada)               */
/* ------------------------------------------------------------------ */

async function ensureSheetExists(title) {
  const meta = await getSheetMeta();
  if (meta[title]) return meta[title];
  await batchUpdate([{ addSheet: { properties: { title } } }]);
  const meta2 = await getSheetMeta();
  return meta2[title];
}

async function ensureOptionsSheet() {
  await ensureSheetExists(CONFIG.OPTIONS_SHEET);
  const head = await valuesGet(`${CONFIG.OPTIONS_SHEET}!A1:D1`);
  const h0 = head[0] || [];
  if (!h0[0]) await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!A1:D1`, [['Type', 'Value', 'Active', 'Parent']]);
  else if (!h0[3]) await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!D1`, [['Parent']]);
  // Seed opsi default yang belum ada.
  const existing = await readOptionsRaw();
  const toAppend = [];
  OPTION_TYPES.forEach(type => {
    (DEFAULT_OPTIONS[type] || []).forEach(value => {
      const exists = existing.some(r => r.type === type && r.value.toLowerCase() === String(value).toLowerCase());
      if (!exists) toAppend.push([type, value, true, '']);
    });
  });
  if (toAppend.length) await valuesAppend(`${CONFIG.OPTIONS_SHEET}!A:D`, toAppend);
}

// Template rumus nama task (dari tabel "RUMUS DETAIL TASK"): Stage -> Kata Kerja -> Objek.
const FORMULA_TEMPLATE = {
  'RND': { 'Menyusun': ['kurikulum', 'product knowledge', 'silabus', 'sistem penilaian', 'panduan'], 'Membuat': ['mapping', 'prompt'], 'Melakukan': ['riset'] },
  'Develop Konten (Materi/Soal)': { 'Menyusun': ['materi', 'journey'], 'Membuat': ['soal'], 'Melakukan': ['syuting', 'retake'], 'Mengambil (take)': ['video pembahasan'] },
  'Manajemen Sistem': { 'Merapikan': ['subbab'], 'Menyusun': ['kerangka kategori'], 'Generate/regenerate': ['paket'], 'Menampilkan/menyembunyikan': ['kategori'], 'Mengelompokkan': ['data'], 'Menyelesaikan': ['report'] },
  'QC': { 'Memperbarui': ['bumper', 'thumbnail'], 'Melakukan': ['QC'] },
  'Operasional': { 'Menginput': ['soal', 'video pembahasan', 'jadwal'], 'Membangun': ['sistem otomatis'], 'Memonitor': ['liveclass'] },
  'Manajemen Guru': { 'Mendistribusikan': ['proyek video pembahasan', 'proyek komplit'], 'Menyusun': ['jadwal'] },
  'Data & Intelligence': { 'Membuat': ['query'], 'Melakukan': ['scraping'], 'Membangun': ['dashboard'] },
  'Kreatif': { 'Mengedit': ['PDF', 'video'], 'Membuat': ['icon'] },
};
async function seedFormulaTemplate() {
  await ensureOptionsSheet();
  const existing = await readOptionsRaw();
  const has = (type, value, parent) => existing.some(r => r.type === type && r.value.toLowerCase() === String(value).toLowerCase() && (!USES_PARENT.includes(type) || r.parent.toLowerCase() === String(parent || '').toLowerCase()));
  const toAppend = [];
  Object.keys(FORMULA_TEMPLATE).forEach(stage => {
    if (!has('stage', stage)) toAppend.push(['stage', stage, true, '']);
    Object.keys(FORMULA_TEMPLATE[stage]).forEach(verb => {
      if (!has('verb', verb, stage)) toAppend.push(['verb', verb, true, stage]);
      FORMULA_TEMPLATE[stage][verb].forEach(objek => {
        const p = stage + '||' + verb;
        if (!has('object', objek, p)) toAppend.push(['object', objek, true, p]);
      });
    });
  });
  if (toAppend.length) await valuesAppend(`${CONFIG.OPTIONS_SHEET}!A:D`, toAppend);
  await applySheetValidations().catch(() => {});
  return { success: true, message: `Template terisi: ${toAppend.length} baris baru (stage + kata kerja + objek).`, options: await getOptions() };
}

async function ensureCommentsSheet() {
  await ensureSheetExists(CONFIG.COMMENTS_SHEET);
  const head = await valuesGet(`${CONFIG.COMMENTS_SHEET}!A1:D1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.COMMENTS_SHEET}!A1:D1`, [['Timestamp', 'Task ID', 'Author', 'Message']]);
  }
}

async function ensureActivitySheet() {
  await ensureSheetExists(CONFIG.ACTIVITY_SHEET);
  const head = await valuesGet(`${CONFIG.ACTIVITY_SHEET}!A1:E1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.ACTIVITY_SHEET}!A1:E1`, [['Timestamp', 'User', 'Action', 'Task ID', 'Detail']]);
  }
}

async function ensureTaskHeaders() {
  await ensureSheetExists(CONFIG.TASK_SHEET);
  const range = `${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${CONFIG.HEADER_ROW}:${CONFIG.LAST_COL_LETTER}${CONFIG.HEADER_ROW}`;
  const cur = await valuesGet(range, { valueRenderOption: 'FORMATTED_VALUE' });
  const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const have = (cur[0] || []).map(norm);
  const ok = TASK_HEADERS.every((h, i) => norm(have[i]) === norm(h));
  if (!ok) await valuesUpdate(range, [TASK_HEADERS]);
}

async function colLetterToIndex(letter) {
  let n = 0;
  for (const ch of letter.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1; // 0-based
}

async function applySheetValidations() {
  const meta = await getSheetMeta();
  const props = meta[CONFIG.TASK_SHEET];
  if (!props) return;
  const sheetId = props.sheetId;
  const maxRows = (props.gridProperties && props.gridProperties.rowCount) || 1000;
  const options = await getOptions();

  const requests = [];
  for (const header of Object.keys(VALIDATION_MAP)) {
    const list = options[VALIDATION_MAP[header]] || [];
    if (!list.length) continue;
    const headerIdx = TASK_HEADERS.indexOf(header);
    if (headerIdx === -1) continue;
    const colIndex = await colLetterToIndex(CONFIG.FIRST_COL_LETTER) + headerIdx;
    requests.push({
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: CONFIG.FIRST_DATA_ROW - 1,
          endRowIndex: maxRows,
          startColumnIndex: colIndex,
          endColumnIndex: colIndex + 1,
        },
        rule: {
          condition: { type: 'ONE_OF_LIST', values: list.map(v => ({ userEnteredValue: String(v) })) },
          showCustomUi: true,
          strict: false,
        },
      },
    });
  }
  if (requests.length) await batchUpdate(requests);
}

/* ------------------------------------------------------------------ */
/* PIN per-user (sheet AUTH tersembunyi, hash, validasi di server)     */
/* ------------------------------------------------------------------ */

async function ensureAuthSheet() {
  const p = await ensureSheetExists(CONFIG.AUTH_SHEET);
  const head = await valuesGet(`${CONFIG.AUTH_SHEET}!A1:B1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.AUTH_SHEET}!A1:B1`, [['User', 'PinHash']]);
  }
  try {
    if (p && p.sheetId != null) {
      await batchUpdate([{ updateSheetProperties: { properties: { sheetId: p.sheetId, hidden: true }, fields: 'hidden' } }]);
    }
  } catch (e) { /* abaikan bila gagal menyembunyikan */ }
}

async function readAuthRaw() {
  try {
    const rows = await valuesGet(`${CONFIG.AUTH_SHEET}!A2:B`);
    return rows
      .map(r => ({ user: String((r && r[0]) || '').trim(), hash: String((r && r[1]) || '').trim() }))
      .filter(r => r.user);
  } catch (e) { return []; }
}

// Verifikasi PIN di server.
//  - Mode Dev (user === '__dev__'): cocokkan dengan DEV_PIN (default 3108).
//  - Mode user biasa: jika user punya PIN khusus -> wajib cocok; jika belum -> bebas (tanpa PIN).
async function verifyPin(user, pin) {
  user = String(user || '').trim();
  if (user === '__dev__') return { ok: String(pin || '').trim() === DEV_PIN };
  const rows = await readAuthRaw();
  const found = rows.find(r => r.user.toLowerCase() === user.toLowerCase());
  if (!found) return { ok: true, noPin: true };
  return { ok: hashPin(user, pin) === found.hash };
}

// Set/ubah PIN seorang user (dipanggil oleh dev). Hanya hash yang disimpan.
async function setUserPin(user, pin) {
  user = String(user || '').trim();
  pin = String(pin || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!/^\d{4}$/.test(pin)) return { success: false, message: 'PIN harus 4 digit angka.' };
  await ensureAuthSheet();
  const rows = await readAuthRaw();
  const hash = hashPin(user, pin);
  const idx = rows.findIndex(r => r.user.toLowerCase() === user.toLowerCase());
  if (idx === -1) await valuesAppend(`${CONFIG.AUTH_SHEET}!A:B`, [[user, hash]]);
  else await valuesUpdate(`${CONFIG.AUTH_SHEET}!B${idx + 2}`, [[hash]]);
  return { success: true, message: `PIN untuk ${user} disimpan.` };
}

// Hapus PIN seorang user (kembali bebas tanpa PIN).
async function deleteUserPin(user) {
  user = String(user || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.AUTH_SHEET}!A2:B`); } catch (e) { return { success: true, message: 'Tidak ada PIN.', removed: false }; }
  const i = rows.findIndex(r => String((r && r[0]) || '').trim().toLowerCase() === user.toLowerCase());
  if (i === -1) return { success: true, message: 'User belum punya PIN.', removed: false };
  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.AUTH_SHEET] && meta[CONFIG.AUTH_SHEET].sheetId;
  if (sheetId == null) return { success: false, message: 'Sheet AUTH tidak ditemukan.' };
  const rowNumber = 2 + i;
  await batchUpdate([{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } } }]);
  return { success: true, message: `PIN untuk ${user} dihapus.`, removed: true };
}

// Daftar user yang sudah punya PIN khusus (hash TIDAK dikirim).
async function listPinUsers() {
  const rows = await readAuthRaw();
  return rows.map(r => r.user);
}

/* ------------------------------------------------------------------ */
/* LINK per-user (sheet LINKS: User, Title, URL)                       */
/* ------------------------------------------------------------------ */

async function ensureLinksSheet() {
  await ensureSheetExists(CONFIG.LINKS_SHEET);
  const head = await valuesGet(`${CONFIG.LINKS_SHEET}!A1:D1`);
  const h0 = head[0] || [];
  if (!h0[0]) await valuesUpdate(`${CONFIG.LINKS_SHEET}!A1:D1`, [['User', 'Title', 'URL', 'Folder']]);
  else if (!h0[3]) await valuesUpdate(`${CONFIG.LINKS_SHEET}!D1`, [['Folder']]);
}

async function getAllLinks() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.LINKS_SHEET}!A2:D`); } catch (e) { return []; }
  return rows
    .map((r, i) => ({ row: i + 2, user: String((r && r[0]) || '').trim(), title: String((r && r[1]) || '').trim(), url: String((r && r[2]) || '').trim(), folder: String((r && r[3]) || '').trim() }))
    .filter(l => l.user && l.url);
}

async function addUserLink(user, title, url, folder) {
  user = String(user || '').trim();
  title = String(title || '').trim();
  url = String(url || '').trim();
  folder = String(folder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!url) return { success: false, message: 'URL wajib diisi.' };
  await ensureLinksSheet();
  await valuesAppend(`${CONFIG.LINKS_SHEET}!A:D`, [[user, title || url, url, folder]]);
  return { success: true, message: 'Link ditambahkan.', links: await getAllLinks() };
}

async function updateUserLink(user, row, title, url, folder) {
  user = String(user || '').trim();
  row = parseInt(row, 10);
  title = String(title || '').trim();
  url = String(url || '').trim();
  folder = String(folder || '').trim();
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!url) return { success: false, message: 'URL wajib diisi.' };
  const cur = await valuesGet(`${CONFIG.LINKS_SHEET}!A${row}:A${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner.toLowerCase() !== user.toLowerCase()) return { success: false, message: 'Bukan link Anda.' };
  await valuesUpdate(`${CONFIG.LINKS_SHEET}!B${row}:D${row}`, [[title || url, url, folder]]);
  return { success: true, message: 'Link diperbarui.', links: await getAllLinks() };
}

async function deleteUserLink(user, row) {
  user = String(user || '').trim();
  row = parseInt(row, 10);
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  const cur = await valuesGet(`${CONFIG.LINKS_SHEET}!A${row}:A${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner.toLowerCase() !== user.toLowerCase()) return { success: false, message: 'Bukan link Anda.' };
  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.LINKS_SHEET] && meta[CONFIG.LINKS_SHEET].sheetId;
  if (sheetId == null) return { success: false, message: 'Sheet LINKS tidak ditemukan.' };
  await batchUpdate([{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }]);
  return { success: true, message: 'Link dihapus.', links: await getAllLinks() };
}

// Operasi massal pada kolom Folder milik 1 user: ganti semua link berfolder oldFolder -> newFolder.
async function _bulkFolderOp(user, oldFolder, newFolder) {
  await ensureLinksSheet();
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.LINKS_SHEET}!A2:D`); } catch (e) { rows = []; }
  if (!rows.length) return { success: true, changed: 0, links: [] };
  let changed = 0;
  const dCol = rows.map(r => {
    const u = String((r && r[0]) || '').trim();
    const f = String((r && r[3]) || '').trim();
    if (u.toLowerCase() === user.toLowerCase() && f === oldFolder) { changed++; return [newFolder]; }
    return [f];
  });
  if (changed > 0) await valuesUpdate(`${CONFIG.LINKS_SHEET}!D2:D${rows.length + 1}`, dCol);
  return { success: true, changed, links: await getAllLinks() };
}

async function renameUserFolder(user, oldFolder, newFolder) {
  user = String(user || '').trim();
  oldFolder = String(oldFolder || '').trim();
  newFolder = String(newFolder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!oldFolder) return { success: false, message: 'Folder asal tidak valid.' };
  if (!newFolder) return { success: false, message: 'Nama folder baru wajib diisi.' };
  const res = await _bulkFolderOp(user, oldFolder, newFolder);
  return { ...res, message: `Folder "${oldFolder}" diganti jadi "${newFolder}" (${res.changed} link).` };
}

async function deleteUserFolder(user, folder) {
  user = String(user || '').trim();
  folder = String(folder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!folder) return { success: false, message: 'Folder tidak valid.' };
  // Pindahkan semua link di folder ini ke root (Umum). Link TIDAK dihapus.
  const res = await _bulkFolderOp(user, folder, '');
  return { ...res, message: `Folder "${folder}" dihapus. ${res.changed} link dipindah ke Umum (tidak terhapus).` };
}

/* ------------------------------------------------------------------ */
/* DASHBOARD LAIN (dashboard eksternal — CRUD khusus Dev)              */
/* ------------------------------------------------------------------ */
const DEFAULT_DASHBOARDS = [
  ['Monitoring Liveclass', 'Pantau jadwal & progress liveclass divisi produk.', 'live_tv', 'https://script.google.com/a/macros/officecerebrum.com/s/AKfycbyT316LqY077YmfhPCAzEgyw9yUQ-pscC_hcW_e1T3mRliSZBhdXQPWxxorwkxD5FDLMA/exec'],
];
async function ensureDashboardsSheet() {
  await ensureSheetExists(CONFIG.DASHBOARDS_SHEET);
  const head = await valuesGet(`${CONFIG.DASHBOARDS_SHEET}!A1:D1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.DASHBOARDS_SHEET}!A1:D1`, [['Title', 'Desc', 'Icon', 'URL']]);
    if (DEFAULT_DASHBOARDS.length) await valuesAppend(`${CONFIG.DASHBOARDS_SHEET}!A:D`, DEFAULT_DASHBOARDS); // seed agar dashboard awal tak hilang
  }
}
async function getAllDashboards() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.DASHBOARDS_SHEET}!A2:D`); } catch (e) { return []; }
  return rows
    .map((r, i) => ({ row: i + 2, title: String((r && r[0]) || '').trim(), desc: String((r && r[1]) || '').trim(), icon: String((r && r[2]) || '').trim(), url: String((r && r[3]) || '').trim() }))
    .filter(d => d.title || d.url);
}
async function addDashboard(title, desc, icon, url) {
  title = String(title || '').trim();
  desc = String(desc || '').trim();
  icon = String(icon || '').trim() || 'dashboard';
  url = String(url || '').trim();
  if (!title) return { success: false, message: 'Judul dashboard wajib diisi.' };
  if (!url) return { success: false, message: 'URL dashboard wajib diisi.' };
  await ensureDashboardsSheet();
  await valuesAppend(`${CONFIG.DASHBOARDS_SHEET}!A:D`, [[title, desc, icon, url]]);
  return { success: true, message: 'Dashboard ditambahkan.', dashboards: await getAllDashboards() };
}
async function updateDashboard(row, title, desc, icon, url) {
  row = parseInt(row, 10);
  title = String(title || '').trim();
  desc = String(desc || '').trim();
  icon = String(icon || '').trim() || 'dashboard';
  url = String(url || '').trim();
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!title) return { success: false, message: 'Judul dashboard wajib diisi.' };
  if (!url) return { success: false, message: 'URL dashboard wajib diisi.' };
  await ensureDashboardsSheet();
  await valuesUpdate(`${CONFIG.DASHBOARDS_SHEET}!A${row}:D${row}`, [[title, desc, icon, url]]);
  return { success: true, message: 'Dashboard diperbarui.', dashboards: await getAllDashboards() };
}
async function deleteDashboard(row) {
  row = parseInt(row, 10);
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.DASHBOARDS_SHEET] && meta[CONFIG.DASHBOARDS_SHEET].sheetId;
  if (sheetId == null) return { success: false, message: 'Sheet DASHBOARDS tidak ditemukan.' };
  await batchUpdate([{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }]);
  return { success: true, message: 'Dashboard dihapus.', dashboards: await getAllDashboards() };
}

/* ------------------------------------------------------------------ */
/* CATATAN SAYA (sheet NOTES: User, Title, Body, UpdatedAt, Folder)    */
/* ------------------------------------------------------------------ */
async function ensureNotesSheet() {
  await ensureSheetExists(CONFIG.NOTES_SHEET);
  const head = await valuesGet(`${CONFIG.NOTES_SHEET}!A1:E1`);
  const h0 = head[0] || [];
  if (!h0[0]) await valuesUpdate(`${CONFIG.NOTES_SHEET}!A1:E1`, [['User', 'Title', 'Body', 'UpdatedAt', 'Folder']]);
  else if (!h0[4]) await valuesUpdate(`${CONFIG.NOTES_SHEET}!E1`, [['Folder']]);
}
async function getAllNotes() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.NOTES_SHEET}!A2:E`); } catch (e) { return []; }
  return rows
    .map((r, i) => ({ row: i + 2, user: String((r && r[0]) || '').trim(), title: String((r && r[1]) || '').trim(), body: String((r && r[2]) || '').trim(), updatedAt: String((r && r[3]) || '').trim(), folder: String((r && r[4]) || '').trim() }))
    .filter(n => n.user && (n.title || n.body));
}
async function addNote(user, title, body, folder) {
  user = String(user || '').trim();
  title = String(title || '').trim();
  body = String(body || '').trim();
  folder = String(folder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!title && !body) return { success: false, message: 'Catatan tidak boleh kosong.' };
  await ensureNotesSheet();
  await valuesAppend(`${CONFIG.NOTES_SHEET}!A:E`, [[user, title || '(tanpa judul)', body, nowStamp(), folder]]);
  return { success: true, message: 'Catatan ditambahkan.', notes: await getAllNotes() };
}
async function updateNote(user, row, title, body, folder) {
  user = String(user || '').trim();
  row = parseInt(row, 10);
  title = String(title || '').trim();
  body = String(body || '').trim();
  folder = String(folder || '').trim();
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!title && !body) return { success: false, message: 'Catatan tidak boleh kosong.' };
  const cur = await valuesGet(`${CONFIG.NOTES_SHEET}!A${row}:A${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner.toLowerCase() !== user.toLowerCase()) return { success: false, message: 'Bukan catatan Anda.' };
  await valuesUpdate(`${CONFIG.NOTES_SHEET}!B${row}:E${row}`, [[title || '(tanpa judul)', body, nowStamp(), folder]]);
  return { success: true, message: 'Catatan diperbarui.', notes: await getAllNotes() };
}
async function deleteNote(user, row) {
  user = String(user || '').trim();
  row = parseInt(row, 10);
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  const cur = await valuesGet(`${CONFIG.NOTES_SHEET}!A${row}:A${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner.toLowerCase() !== user.toLowerCase()) return { success: false, message: 'Bukan catatan Anda.' };
  const meta = await getSheetMeta();
  const sheetId = meta[CONFIG.NOTES_SHEET] && meta[CONFIG.NOTES_SHEET].sheetId;
  if (sheetId == null) return { success: false, message: 'Sheet NOTES tidak ditemukan.' };
  await batchUpdate([{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }]);
  return { success: true, message: 'Catatan dihapus.', notes: await getAllNotes() };
}
// Operasi massal folder catatan milik 1 user (kolom E).
async function _bulkNoteFolderOp(user, oldFolder, newFolder) {
  await ensureNotesSheet();
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.NOTES_SHEET}!A2:E`); } catch (e) { rows = []; }
  if (!rows.length) return { success: true, changed: 0, notes: [] };
  let changed = 0;
  const eCol = rows.map(r => {
    const u = String((r && r[0]) || '').trim();
    const f = String((r && r[4]) || '').trim();
    if (u.toLowerCase() === user.toLowerCase() && f === oldFolder) { changed++; return [newFolder]; }
    return [f];
  });
  if (changed > 0) await valuesUpdate(`${CONFIG.NOTES_SHEET}!E2:E${rows.length + 1}`, eCol);
  return { success: true, changed, notes: await getAllNotes() };
}
async function renameNoteFolder(user, oldFolder, newFolder) {
  user = String(user || '').trim();
  oldFolder = String(oldFolder || '').trim();
  newFolder = String(newFolder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!oldFolder) return { success: false, message: 'Folder asal tidak valid.' };
  if (!newFolder) return { success: false, message: 'Nama folder baru wajib diisi.' };
  const res = await _bulkNoteFolderOp(user, oldFolder, newFolder);
  return { ...res, message: `Folder "${oldFolder}" diganti jadi "${newFolder}" (${res.changed} catatan).` };
}
async function deleteNoteFolder(user, folder) {
  user = String(user || '').trim();
  folder = String(folder || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!folder) return { success: false, message: 'Folder tidak valid.' };
  const res = await _bulkNoteFolderOp(user, folder, ''); // catatan dipindah ke Umum, tidak dihapus
  return { ...res, message: `Folder "${folder}" dihapus. ${res.changed} catatan dipindah ke Umum.` };
}

async function setupTaskTracker() {
  await ensureTaskHeaders();
  await ensureOptionsSheet();
  await ensureCommentsSheet();
  await ensureChecklistSheet();
  await ensureCollabSheets();
  await ensureActivitySheet();
  await ensureAuthSheet();
  await ensureLinksSheet();
  await ensureDashboardsSheet();
  await ensureNotesSheet();
  await applySheetValidations().catch(() => {});
  return {
    success: true,
    message: 'Setup selesai. Sheet Main, OPTIONS, COMMENTS, ACTIVITY, dropdown, dan header dasar sudah siap.',
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${getSpreadsheetId()}/edit`,
  };
}

// Isi Task ID untuk baris yang punya Task Name tapi kolom Task ID-nya kosong
// (mis. baris yang diketik langsung di spreadsheet). ID dilanjutkan dari nomor tertinggi.
async function assignMissingTaskIds() {
  const rows = await valuesGet(MAIN_DATA_RANGE());
  let max = 0;
  rows.forEach(r => { const m = String((r && r[0]) || '').match(/(\d+)\s*$/); if (m) max = Math.max(max, Number(m[1])); });
  const data = [];
  rows.forEach((row, idx) => {
    const tid = String((row && row[0]) || '').trim();
    const name = String((row && row[5]) || '').trim(); // kolom G (Task Name) = indeks 5 dari B
    if (!tid && name) {
      max += 1;
      const rowNumber = CONFIG.FIRST_DATA_ROW + idx;
      data.push({ range: `${CONFIG.TASK_SHEET}!${COL.taskId}${rowNumber}`, values: [['TSK-' + String(max).padStart(3, '0')]] });
    }
  });
  if (data.length) {
    const sheets = await getSheets();
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: { valueInputOption: 'RAW', data },
    });
  }
  const tasks = await getTasks();
  return { success: true, message: `${data.length} Task ID baru dibuat untuk baris yang belum punya ID.`, assigned: data.length, tasks };
}

module.exports = {
  // bootstrap & reads
  getBootstrapData, getTasks, getOptions, getComments, getActivityLog,
  // writes
  saveTask, deleteTask, quickUpdateField, quickUpdateDates,
  addComment, saveOption, deleteOption, editOption,
  // ceklis per task (PM menyusun, PIC mencentang)
  getChecklist, addChecklistItem, setChecklistDone, deleteChecklistItem,
  // task kolaborasi (alur beruntun antar-PIC)
  getCollabs, saveCollab, setCollabStepDone, deleteCollab,
  // setup
  setupTaskTracker, assignMissingTaskIds,
  // auth (PIN)
  verifyPin, setUserPin, deleteUserPin, listPinUsers,
  // link per-user
  addUserLink, updateUserLink, deleteUserLink, getAllLinks,
  renameUserFolder, deleteUserFolder,
  // dashboard lain (CRUD Dev)
  getAllDashboards, addDashboard, updateDashboard, deleteDashboard,
  // catatan saya (per user)
  getAllNotes, addNote, updateNote, deleteNote, renameNoteFolder, deleteNoteFolder,
  // rumus nama task (kata kerja/objek)
  seedFormulaTemplate,
  // (exported for tests)
  _internals: { formatDate, toSheetDate, generateTaskId, rowToTask, taskToRow, findRowByTaskId, serialToDate, nowStamp,
    isManagerActor, canApproveDone, getDoneApprovers, getManagers, isDoneStatus,
    ownsTaskActor, isChecked, canCheckStep, genCollabId },
};
