/**
 * ============================================================
 * /api/rpc — Serverless dispatcher (Vercel, Node.js)
 *
 * Frontend memanggil seperti google.script.run:
 *   POST /api/rpc
 *   body: { "action": "saveTask", "args": [ {..task..} ] }
 *
 * Setiap action dipetakan ke fungsi backend di ./_sheets.js,
 * dengan tanda tangan argumen identik dengan versi Apps Script.
 * ============================================================
 */

const backend = require('./_sheets'); // rpc dispatcher

// Whitelist action -> fungsi backend. Argumen diteruskan sesuai urutan
// pemanggilan google.script.run pada versi Apps Script.
const HANDLERS = {
  getBootstrapData: () => backend.getBootstrapData(),
  getTasks: () => backend.getTasks(),
  getOptions: () => backend.getOptions(),
  getActivityLog: (limit) => backend.getActivityLog(limit),
  getComments: (taskId) => backend.getComments(taskId),

  saveTask: (task) => backend.saveTask(task),
  deleteTask: (taskId, actor) => backend.deleteTask(taskId, actor),
  quickUpdateField: (taskId, field, value, actor) => backend.quickUpdateField(taskId, field, value, actor),
  quickUpdateDates: (taskId, startDate, dueDate, actor) => backend.quickUpdateDates(taskId, startDate, dueDate, actor),

  addComment: (payload) => backend.addComment(payload),
  saveOption: (type, value, parent) => backend.saveOption(type, value, parent),
  deleteOption: (type, value, parent) => backend.deleteOption(type, value, parent),
  editOption: (type, oldValue, newValue, parent) => backend.editOption(type, oldValue, newValue, parent),
  seedFormulaTemplate: () => backend.seedFormulaTemplate(),

  setupTaskTracker: () => backend.setupTaskTracker(),
  assignMissingTaskIds: () => backend.assignMissingTaskIds(),
  verifyPin: (user, pin) => backend.verifyPin(user, pin),
  setUserPin: (user, pin) => backend.setUserPin(user, pin),
  deleteUserPin: (user) => backend.deleteUserPin(user),
  listPinUsers: () => backend.listPinUsers(),
  addUserLink: (user, title, url, folder) => backend.addUserLink(user, title, url, folder),
  updateUserLink: (user, row, title, url, folder) => backend.updateUserLink(user, row, title, url, folder),
  deleteUserLink: (user, row) => backend.deleteUserLink(user, row),
  renameUserFolder: (user, oldFolder, newFolder) => backend.renameUserFolder(user, oldFolder, newFolder),
  deleteUserFolder: (user, folder) => backend.deleteUserFolder(user, folder),
  addDashboard: (title, desc, icon, url) => backend.addDashboard(title, desc, icon, url),
  updateDashboard: (row, title, desc, icon, url) => backend.updateDashboard(row, title, desc, icon, url),
  deleteDashboard: (row) => backend.deleteDashboard(row),
  addNote: (user, title, body, folder) => backend.addNote(user, title, body, folder),
  updateNote: (user, row, title, body, folder) => backend.updateNote(user, row, title, body, folder),
  deleteNote: (user, row) => backend.deleteNote(user, row),
  renameNoteFolder: (user, oldFolder, newFolder) => backend.renameNoteFolder(user, oldFolder, newFolder),
  deleteNoteFolder: (user, folder) => backend.deleteNoteFolder(user, folder),
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  // Fallback: baca stream mentah.
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'GET') {
    // Health check sederhana.
    return res.status(200).end(JSON.stringify({ ok: true, service: 'task-tracker-rpc' }));
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).end(JSON.stringify({ __error: true, message: 'Method not allowed' }));
  }

  let action, args, authProvided = '';
  try {
    const body = await readJsonBody(req);
    action = body.action;
    args = Array.isArray(body.args) ? body.args : [];
    authProvided = (req.headers['x-app-password'] || body._auth || '').toString();
  } catch (e) {
    return res.status(400).end(JSON.stringify({ __error: true, message: 'Body tidak valid.' }));
  }

  // Gerbang akses via PIN (env ACCESS_PIN; fallback APP_PASSWORD utk kompatibilitas lama).
  // - PIN benar / gerbang nonaktif -> akses penuh.
  // - PIN salah/kosong             -> mode view-only (Lintas): hanya boleh MEMBACA data
  //                                    terbatas (getBootstrapData) + kirim chat. Aksi tulis ditolak.
  const ACCESS_PIN = (process.env.ACCESS_PIN || process.env.APP_PASSWORD || '').trim();
  const authed = !ACCESS_PIN || authProvided === ACCESS_PIN;
  // Action yang boleh diakses tamu (tanpa PIN benar) untuk mendukung mode view-only.
  const GUEST_ACTIONS = { getBootstrapData: 1, getComments: 1, addComment: 1 };

  if (action === 'login') {
    return res.status(200).end(JSON.stringify({ success: authed, authRequired: !!ACCESS_PIN, message: authed ? 'PIN benar.' : 'PIN salah.' }));
  }
  if (!authed && !GUEST_ACTIONS[action]) {
    return res.status(401).end(JSON.stringify({ __error: true, code: 'AUTH', message: 'Perlu PIN akses penuh.' }));
  }

  const handler = HANDLERS[action];
  if (!handler) {
    return res.status(400).end(JSON.stringify({ __error: true, message: 'Action tidak dikenal: ' + action }));
  }

  try {
    // Tamu (tanpa PIN) hanya menerima data terbatas dari bootstrap.
    const result = (action === 'getBootstrapData')
      ? await backend.getBootstrapData({ viewOnly: !authed })
      : await handler(...args);
    // Hasil bisa berupa objek {success,...}, array, atau primitif.
    return res.status(200).end(JSON.stringify(result === undefined ? null : result));
  } catch (err) {
    // Error tak terduga -> 500, frontend akan memanggil withFailureHandler.
    console.error(`[rpc] action=${action} error:`, err && err.stack ? err.stack : err);
    const message = (err && err.message) ? err.message : 'Terjadi kesalahan di server.';
    return res.status(500).end(JSON.stringify({ __error: true, message }));
  }
};
