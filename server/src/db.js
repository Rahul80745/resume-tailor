import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/* Uses node:sqlite, built into Node 22.5+ and stable in Node 24.
   No native module to compile, so no Visual Studio / Xcode toolchain needed. */

const file = process.env.DB_PATH || resolve(process.cwd(), 'data/app.db');
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS master_resume (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  name        TEXT NOT NULL DEFAULT 'Master resume',
  source_name TEXT,
  content     TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tailorings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT,
  company      TEXT,
  mode         TEXT NOT NULL,
  instructions TEXT,
  jd           TEXT NOT NULL,
  source_name  TEXT,
  source_text  TEXT,
  ats_score    INTEGER,
  analysis     TEXT,
  resume_json  TEXT,
  cover_letter TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);
`);

/* node:sqlite binds null but not undefined, so normalise before every write */
const nz = (v) => (v === undefined || v === '' ? null : v);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/* ---------- settings ---------- */
const DEFAULTS = {
  api_key: '',
  base_url: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  template: 'classic',
  theme: 'light',
  // empty string means "use the built-in default from prompts.js"
  prompt_normal: '',
  prompt_skills: '',
  prompt_high: '',
  prompt_cover: '',
};

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function saveSettings(patch) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  db.exec('BEGIN');
  try {
    for (const [k, v] of Object.entries(patch)) {
      if (k in DEFAULTS) stmt.run(k, String(v ?? ''));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return getSettings();
}

/* ---------- master resume ---------- */
export function getMaster() {
  return db.prepare('SELECT * FROM master_resume WHERE id = 1').get() ?? null;
}

export function saveMaster({ name, sourceName, content }) {
  db.prepare(`
    INSERT INTO master_resume (id, name, source_name, content, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      source_name = excluded.source_name,
      content = excluded.content,
      updated_at = datetime('now')
  `).run(name || 'Master resume', nz(sourceName), content);
  return getMaster();
}

export function deleteMaster() {
  db.prepare('DELETE FROM master_resume WHERE id = 1').run();
}

/* ---------- history ---------- */
export function insertTailoring(row) {
  const info = db.prepare(`
    INSERT INTO tailorings
      (title, company, mode, instructions, jd, source_name, source_text,
       ats_score, analysis, resume_json, cover_letter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    nz(row.title), nz(row.company), row.mode, nz(row.instructions), row.jd,
    nz(row.source_name), nz(row.source_text), num(row.ats_score),
    nz(row.analysis), nz(row.resume_json), nz(row.cover_letter)
  );
  return getTailoring(Number(info.lastInsertRowid));
}

export function getTailoring(id) {
  return db.prepare('SELECT * FROM tailorings WHERE id = ?').get(Number(id)) ?? null;
}

export function listTailorings(limit = 50) {
  return db.prepare(`
    SELECT id, title, company, mode, ats_score, created_at, updated_at
    FROM tailorings ORDER BY id DESC LIMIT ?
  `).all(Number(limit) || 50);
}

export function updateTailoring(id, patch) {
  const fields = [];
  const values = [];
  for (const k of ['title', 'company', 'resume_json', 'cover_letter', 'ats_score']) {
    if (k in patch) {
      fields.push(`${k} = ?`);
      values.push(k === 'ats_score' ? num(patch[k]) : nz(patch[k]));
    }
  }
  if (!fields.length) return getTailoring(id);
  db.prepare(`UPDATE tailorings SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...values, Number(id));
  return getTailoring(id);
}

export function deleteTailoring(id) {
  db.prepare('DELETE FROM tailorings WHERE id = ?').run(Number(id));
}
