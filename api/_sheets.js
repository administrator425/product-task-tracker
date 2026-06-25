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
  HEADER_ROW: 3,
  FIRST_DATA_ROW: 4,
  FIRST_COL_LETTER: 'B',
  LAST_COL_LETTER: 'N',
};

const TASK_HEADERS = [
  'Task ID', 'Created Date', 'Due Date', 'Status', 'Priority',
  'Task Name', 'Stage', 'Platform', 'PIC', 'Support', 'Document',
  'PIC Notes', 'PM Notes',
];

// Pemetaan field -> kolom (B..Q). Urutan tetap, sama seperti Apps Script.
const COL = {
  taskId: 'B', createdDate: 'C', dueDate: 'D', status: 'E',
  priority: 'F', taskName: 'G', stage: 'H', platform: 'I', pic: 'J',
  support: 'K', document: 'L', picNotes: 'M', pmNotes: 'N',
};

const OPTION_TYPES = ['status', 'priority', 'stage', 'platform', 'pic', 'support'];

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
};

// Validasi dropdown di dalam Spreadsheet (header -> tipe opsi).
const VALIDATION_MAP = {
  Status: 'status', Priority: 'priority', Stage: 'stage',
  Platform: 'platform', PIC: 'pic', Support: 'support',
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
  // Sheet ini 13 kolom (B..N): tanpa Start Date, Approval Gate, Last Update.
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

  // Pastikan ID terisi.
  const finalId = task.id || generateTaskId(ids);
  const rowData = taskToRow(Object.assign({}, task, { id: finalId }), existingTask);

  if (!isUpdate) {
    rowNumber = CONFIG.FIRST_DATA_ROW + ids.length; // baris kosong berikutnya
  }
  await valuesUpdate(
    `${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`,
    [rowData],
  );

  const savedRows = await valuesGet(`${CONFIG.TASK_SHEET}!${CONFIG.FIRST_COL_LETTER}${rowNumber}:${CONFIG.LAST_COL_LETTER}${rowNumber}`);
  const saved = rowToTask(savedRows[0] || rowData, rowNumber);
  const actor = String(task.actor || '').trim() || 'Unknown';
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
  status: COL.status, priority: COL.priority, pic: COL.pic, stage: COL.stage,
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
  const rows = await valuesGet(`${CONFIG.OPTIONS_SHEET}!A2:C`, { valueRenderOption: 'UNFORMATTED_VALUE' });
  return rows
    .map((r, i) => ({
      row: i + 2,
      type: String((r && r[0]) || '').trim(),
      value: String((r && r[1]) || '').trim(),
      active: r && (r[2] === true || String(r[2]).toUpperCase() === 'TRUE'),
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
  raw.forEach(row => {
    if (!options[row.type]) options[row.type] = [];
    if (!options[row.type].includes(row.value)) options[row.type].push(row.value);
  });
  OPTION_TYPES.forEach(t => {
    if (!options[t] || !options[t].length) options[t] = DEFAULT_OPTIONS[t] || [];
  });
  return options;
}

async function saveOption(type, value) {
  type = String(type || '').trim();
  value = String(value || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };
  if (!value) return { success: false, message: 'Nilai opsi tidak boleh kosong.' };

  await ensureOptionsSheet();
  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === value.toLowerCase());
  if (found) {
    await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!C${found.row}`, [[true]]);
  } else {
    await valuesAppend(`${CONFIG.OPTIONS_SHEET}!A:C`, [[type, value, true]]);
  }
  await applySheetValidations().catch(() => {});
  return { success: true, message: 'Opsi berhasil disimpan.', options: await getOptions() };
}

async function deleteOption(type, value) {
  type = String(type || '').trim();
  value = String(value || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };

  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === value.toLowerCase());
  if (found) await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!C${found.row}`, [[false]]);
  await applySheetValidations().catch(() => {});
  return { success: true, message: 'Opsi berhasil dinonaktifkan.', options: await getOptions() };
}

// Edit (rename) nilai opsi + cascade ke task yang masih memakai nilai lama.
async function editOption(type, oldValue, newValue) {
  type = String(type || '').trim();
  oldValue = String(oldValue || '').trim();
  newValue = String(newValue || '').trim();
  if (!OPTION_TYPES.includes(type)) return { success: false, message: 'Tipe opsi tidak valid.' };
  if (!oldValue || !newValue) return { success: false, message: 'Nilai lama/baru tidak boleh kosong.' };
  const rows = await readOptionsRaw();
  const found = rows.find(r => r.type === type && r.value.toLowerCase() === oldValue.toLowerCase());
  if (!found) return { success: false, message: 'Opsi tidak ditemukan.' };
  await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!B${found.row}`, [[newValue]]);
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

async function getBootstrapData() {
  const [tasks, options, activity, commentsSummary, pinUsers, links] = await Promise.all([
    getTasks(),
    getOptions(),
    getActivityLog(200),
    getAllCommentsLite(),
    listPinUsers(),
    getAllLinks(),
  ]);
  return {
    tasks,
    options,
    activity,
    commentsSummary,
    pinUsers,
    links,
    meta: {
      sheetName: CONFIG.TASK_SHEET,
      managers: getManagers(),
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
  const head = await valuesGet(`${CONFIG.OPTIONS_SHEET}!A1:C1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.OPTIONS_SHEET}!A1:C1`, [['Type', 'Value', 'Active']]);
  }
  // Seed opsi default yang belum ada.
  const existing = await readOptionsRaw();
  const toAppend = [];
  OPTION_TYPES.forEach(type => {
    (DEFAULT_OPTIONS[type] || []).forEach(value => {
      const exists = existing.some(r => r.type === type && r.value.toLowerCase() === String(value).toLowerCase());
      if (!exists) toAppend.push([type, value, true]);
    });
  });
  if (toAppend.length) await valuesAppend(`${CONFIG.OPTIONS_SHEET}!A:C`, toAppend);
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
  const head = await valuesGet(`${CONFIG.LINKS_SHEET}!A1:C1`);
  if (!head.length || !head[0] || !head[0][0]) {
    await valuesUpdate(`${CONFIG.LINKS_SHEET}!A1:C1`, [['User', 'Title', 'URL']]);
  }
}

async function getAllLinks() {
  let rows = [];
  try { rows = await valuesGet(`${CONFIG.LINKS_SHEET}!A2:C`); } catch (e) { return []; }
  return rows
    .map((r, i) => ({ row: i + 2, user: String((r && r[0]) || '').trim(), title: String((r && r[1]) || '').trim(), url: String((r && r[2]) || '').trim() }))
    .filter(l => l.user && l.url);
}

async function addUserLink(user, title, url) {
  user = String(user || '').trim();
  title = String(title || '').trim();
  url = String(url || '').trim();
  if (!user) return { success: false, message: 'User tidak boleh kosong.' };
  if (!url) return { success: false, message: 'URL wajib diisi.' };
  await ensureLinksSheet();
  await valuesAppend(`${CONFIG.LINKS_SHEET}!A:C`, [[user, title || url, url]]);
  return { success: true, message: 'Link ditambahkan.', links: await getAllLinks() };
}

async function updateUserLink(user, row, title, url) {
  user = String(user || '').trim();
  row = parseInt(row, 10);
  title = String(title || '').trim();
  url = String(url || '').trim();
  if (!row || row < 2) return { success: false, message: 'Baris tidak valid.' };
  if (!url) return { success: false, message: 'URL wajib diisi.' };
  const cur = await valuesGet(`${CONFIG.LINKS_SHEET}!A${row}:A${row}`);
  const owner = String((cur[0] && cur[0][0]) || '').trim();
  if (owner.toLowerCase() !== user.toLowerCase()) return { success: false, message: 'Bukan link Anda.' };
  await valuesUpdate(`${CONFIG.LINKS_SHEET}!B${row}:C${row}`, [[title || url, url]]);
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

async function setupTaskTracker() {
  await ensureTaskHeaders();
  await ensureOptionsSheet();
  await ensureCommentsSheet();
  await ensureActivitySheet();
  await ensureAuthSheet();
  await ensureLinksSheet();
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
  // setup
  setupTaskTracker, assignMissingTaskIds,
  // auth (PIN)
  verifyPin, setUserPin, deleteUserPin, listPinUsers,
  // link per-user
  addUserLink, updateUserLink, deleteUserLink, getAllLinks,
  // (exported for tests)
  _internals: { formatDate, toSheetDate, generateTaskId, rowToTask, taskToRow, findRowByTaskId, serialToDate, nowStamp },
};
