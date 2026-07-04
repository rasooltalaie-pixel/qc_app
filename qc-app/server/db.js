// db.js — راه‌اندازی دیتابیس SQLite و تعریف جداول
// از ماژول داخلی node:sqlite استفاده می‌شود (بدون نیاز به کامپایل native)
// نیازمند Node.js نسخه 22.5 یا بالاتر
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'qc.db');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'inspector', -- admin | qc_manager | inspector
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  rev TEXT,
  process TEXT,
  author TEXT,
  plan_date TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS characteristics (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT,
  method TEXT,
  lsl REAL,
  target REAL,
  usl REAL,
  freq TEXT,
  reaction TEXT,
  op_no TEXT,
  importance TEXT,
  responsible TEXT,
  record_method TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  char_id TEXT NOT NULL REFERENCES characteristics(id) ON DELETE CASCADE,
  value REAL NOT NULL,
  status TEXT NOT NULL, -- ok | fail | na
  entry_date TEXT,
  shift TEXT,
  operator TEXT,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_char_plan ON characteristics(plan_id);
CREATE INDEX IF NOT EXISTS idx_entry_plan ON entries(plan_id);
CREATE INDEX IF NOT EXISTS idx_entry_char ON entries(char_id);
CREATE INDEX IF NOT EXISTS idx_entry_date ON entries(entry_date);
`);

// مهاجرت ایمن: اگر دیتابیس از قبل وجود دارد و ستون‌های جدید را ندارد، اضافه می‌شوند
// (برای نصب‌های تازه هیچ اثری ندارد چون CREATE TABLE بالا از قبل این ستون‌ها را دارد)
const existingCols = db.prepare("PRAGMA table_info(characteristics)").all().map(c => c.name);
const migrations = [
  ['op_no', 'ALTER TABLE characteristics ADD COLUMN op_no TEXT'],
  ['importance', 'ALTER TABLE characteristics ADD COLUMN importance TEXT'],
  ['responsible', 'ALTER TABLE characteristics ADD COLUMN responsible TEXT'],
  ['record_method', 'ALTER TABLE characteristics ADD COLUMN record_method TEXT'],
];
migrations.forEach(([col, sql]) => {
  if (!existingCols.includes(col)) db.exec(sql);
});

// helper: اجرای چند دستور به‌صورت تراکنش (node:sqlite هلپر transaction ندارد)
function withTransaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = db;
module.exports.withTransaction = withTransaction;
