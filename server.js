const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { randomUUID } = require('crypto');
const initSqlJs = require('sql.js');

const APP_NAME = 'PersonalDashboard';
const APP_VERSION = require('./package.json').version;
const LOOPBACK_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;

function defaultDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), APP_NAME);
}

const DATA_DIR = process.env.DASHBOARD_DATA_DIR || defaultDataDir();
const DB_PATH = process.env.DASHBOARD_DB_PATH || path.join(DATA_DIR, 'data.db');

let db;
let SQL;

function ensureDbDirectory() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

function ensureSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      body TEXT,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT,
      hours REAL DEFAULT 0,
      date_key TEXT,
      order_num REAL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT,
      time TEXT,
      desc TEXT,
      date_key TEXT
    );
    CREATE TABLE IF NOT EXISTS note_assets (
      id TEXT PRIMARY KEY,
      note_id TEXT,
      mime TEXT,
      data BLOB,
      created_at INTEGER
    );
  `);

  // Add order_num if missing.
  const cols = all("PRAGMA table_info('tasks')");
  const hasOrder = cols.some((c) => c.name === 'order_num');
  if (!hasOrder) {
    db.run('ALTER TABLE tasks ADD COLUMN order_num REAL DEFAULT 0;');
    db.run('UPDATE tasks SET order_num = rowid WHERE order_num IS NULL OR order_num = 0;');
  }
}

async function loadDb() {
  SQL = await initSqlJs({ locateFile: (f) => path.join(__dirname, 'node_modules/sql.js/dist/', f) });
  ensureDbDirectory();
  const fileBuffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  db = fileBuffer ? new SQL.Database(new Uint8Array(fileBuffer)) : new SQL.Database();
  ensureSchema();
  if (!fileBuffer) persist();
}

function persist() {
  ensureDbDirectory();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function all(stmt, params = []) {
  const res = [];
  const q = db.prepare(stmt, params);
  while (q.step()) res.push(q.getAsObject());
  q.free();
  return res;
}

function get(stmt, params = []) {
  const q = db.prepare(stmt, params);
  const row = q.step() ? q.getAsObject() : null;
  q.free();
  return row;
}

function run(stmt, params = []) {
  db.run(stmt, params);
  persist();
}

function hasRequiredTables(candidateDb) {
  const required = new Set(['notes', 'tasks', 'events', 'note_assets']);
  const q = candidateDb.prepare("SELECT name FROM sqlite_master WHERE type='table'");
  while (q.step()) {
    const row = q.getAsObject();
    required.delete(row.name);
  }
  q.free();
  return Array.from(required);
}

async function main() {
  await loadDb();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || origin === 'null') return cb(null, true);
      try {
        const u = new URL(origin);
        if (u.protocol === 'chrome-extension:' || u.protocol === 'moz-extension:') return cb(null, true);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return cb(null, true);
      } catch {}
      return cb(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
  app.use(express.json());
  app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    if (
      p === '/data.db' ||
      p === '/server.js' ||
      p === '/package.json' ||
      p === '/package-lock.json' ||
      p.startsWith('/node_modules') ||
      p.startsWith('/.git') ||
      p.startsWith('/.env')
    ) {
      return res.status(404).end();
    }
    next();
  });
  app.use(express.static(path.join(__dirname), { dotfiles: 'ignore' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
  const dbImportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      version: APP_VERSION,
      uptime_sec: Math.floor(process.uptime())
    });
  });

  app.get('/api/version', (_req, res) => {
    res.json({
      name: APP_NAME,
      version: APP_VERSION
    });
  });

  app.get('/api/db/export', (_req, res) => {
    const buffer = Buffer.from(db.export());
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="data.db"');
    res.end(buffer);
  });

  app.post('/api/db/import', dbImportUpload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    try {
      const candidateDb = new SQL.Database(new Uint8Array(req.file.buffer));
      const missing = hasRequiredTables(candidateDb);
      if (missing.length > 0) {
        candidateDb.close();
        return res.status(400).json({ error: `missing required tables: ${missing.join(', ')}` });
      }

      if (db?.close) db.close();
      db = candidateDb;
      ensureSchema();
      persist();
      return res.json({ ok: true, db_path: DB_PATH });
    } catch (err) {
      return res.status(400).json({ error: 'invalid sqlite database file' });
    }
  });

  // Notes
  app.get('/api/notes', (_req, res) => {
    res.json(all('SELECT * FROM notes ORDER BY updated_at DESC'));
  });

  app.post('/api/notes', (req, res) => {
    const id = randomUUID();
    const { title = 'Untitled', body = '' } = req.body || {};
    const updated_at = Date.now();
    run('INSERT INTO notes (id, title, body, updated_at) VALUES (?, ?, ?, ?)', [id, title, body, updated_at]);
    res.json({ id, title, body, updated_at });
  });

  app.put('/api/notes/:id', (req, res) => {
    const { id } = req.params;
    const { title = 'Untitled', body = '' } = req.body || {};
    const updated_at = Date.now();
    run('UPDATE notes SET title=?, body=?, updated_at=? WHERE id=?', [title, body, updated_at, id]);
    res.json({ id, title, body, updated_at });
  });

  app.delete('/api/notes/:id', (req, res) => {
    run('DELETE FROM notes WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  });

  // Note assets
  app.post('/api/notes/:id/assets', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'file required' });
    if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'image uploads only' });
    }
    const { id: note_id } = req.params;
    const assetId = randomUUID();
    const mime = req.file.mimetype || 'application/octet-stream';
    const created_at = Date.now();
    run('INSERT INTO note_assets (id, note_id, mime, data, created_at) VALUES (?, ?, ?, ?, ?)', [
      assetId,
      note_id,
      mime,
      req.file.buffer,
      created_at
    ]);
    res.json({ assetId, mime, created_at });
  });

  app.get('/api/assets/:id', (req, res) => {
    const row = get('SELECT mime, data FROM note_assets WHERE id=?', [req.params.id]);
    if (!row) return res.status(404).end();
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const buf = Buffer.from(row.data);
    res.end(buf);
  });

  // Tasks
  app.get('/api/tasks', (req, res) => {
    const { date } = req.query;
    const rows = date
      ? all('SELECT * FROM tasks WHERE date_key=? ORDER BY order_num ASC, rowid ASC', [date])
      : all('SELECT * FROM tasks ORDER BY date_key ASC, order_num ASC, rowid ASC');
    res.json(rows);
  });

  app.post('/api/tasks', (req, res) => {
    const { name = 'Untitled task', hours = 0, date_key = null } = req.body || {};
    const id = randomUUID();
    const next = get('SELECT COALESCE(MAX(order_num),0)+1 AS n FROM tasks WHERE date_key=?', [date_key])?.n || 1;
    run('INSERT INTO tasks (id, name, hours, date_key, order_num) VALUES (?, ?, ?, ?, ?)', [id, name, hours, date_key, next]);
    res.json({ id, name, hours, date_key, order_num: next });
  });

  app.put('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { name, hours, order_num } = req.body || {};
    if (name !== undefined) run('UPDATE tasks SET name=? WHERE id=?', [name, id]);
    if (hours !== undefined) run('UPDATE tasks SET hours=? WHERE id=?', [hours, id]);
    if (order_num !== undefined) run('UPDATE tasks SET order_num=? WHERE id=?', [order_num, id]);
    res.json(get('SELECT * FROM tasks WHERE id=?', [id]) || {});
  });

  app.delete('/api/tasks/:id', (req, res) => {
    run('DELETE FROM tasks WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  });

  app.post('/api/tasks/reorder', (req, res) => {
    const { date_key, order } = req.body || {};
    if (!date_key || !Array.isArray(order)) return res.status(400).json({ error: 'date_key and order[] required' });
    order.forEach((id, idx) => {
      run('UPDATE tasks SET order_num=? WHERE id=? AND date_key=?', [idx + 1, id, date_key]);
    });
    res.json({ ok: true });
  });

  // Events
  app.get('/api/events', (req, res) => {
    const { date } = req.query;
    const rows = date
      ? all('SELECT * FROM events WHERE date_key=? ORDER BY time ASC', [date])
      : all('SELECT * FROM events ORDER BY date_key ASC, time ASC');
    res.json(rows);
  });

  app.post('/api/events', (req, res) => {
    const { title = 'Untitled event', time = '', desc = '', date_key = null } = req.body || {};
    const id = randomUUID();
    run('INSERT INTO events (id, title, time, desc, date_key) VALUES (?, ?, ?, ?, ?)', [id, title, time, desc, date_key]);
    res.json({ id, title, time, desc, date_key });
  });

  app.put('/api/events/:id', (req, res) => {
    const { id } = req.params;
    const { title, time, desc } = req.body || {};
    if (title !== undefined) run('UPDATE events SET title=? WHERE id=?', [title, id]);
    if (time !== undefined) run('UPDATE events SET time=? WHERE id=?', [time, id]);
    if (desc !== undefined) run('UPDATE events SET desc=? WHERE id=?', [desc, id]);
    res.json(get('SELECT * FROM events WHERE id=?', [id]) || {});
  });

  app.delete('/api/events/:id', (req, res) => {
    run('DELETE FROM events WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  });

  const PORT = Number(process.env.PORT) || DEFAULT_PORT;
  app.listen(PORT, LOOPBACK_HOST, () => {
    console.log(`[dashboard] API running at http://${LOOPBACK_HOST}:${PORT}`);
    console.log(`[dashboard] DB path: ${DB_PATH}`);
    console.log(`[dashboard] Version: ${APP_VERSION}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
