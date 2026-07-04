// =====================================================
// QC APP DATABASE v0.2
// Redesigned Database
// =====================================================

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA_DIR =
  process.env.DATA_DIR || path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR))
    fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "qc.db");

const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`

----------------------------------------------------------
USERS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS users(

id INTEGER PRIMARY KEY AUTOINCREMENT,

username TEXT UNIQUE NOT NULL,

password_hash TEXT NOT NULL,

full_name TEXT NOT NULL,

role TEXT NOT NULL DEFAULT 'inspector',

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now'))

);

----------------------------------------------------------
PRODUCTS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS products(

id TEXT PRIMARY KEY,

name TEXT NOT NULL,

technical_code TEXT,

drawing_no TEXT,

material TEXT,

logo TEXT,

image TEXT,

description TEXT,

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now'))

);

----------------------------------------------------------
PROCESSES
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS processes(

id TEXT PRIMARY KEY,

name TEXT NOT NULL,

description TEXT,

sort_order INTEGER DEFAULT 0,

active INTEGER DEFAULT 1

);

----------------------------------------------------------
PRODUCT PROCESS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS product_processes(

id TEXT PRIMARY KEY,

product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,

process_id TEXT NOT NULL REFERENCES processes(id),

sort_order INTEGER DEFAULT 0

);

----------------------------------------------------------
CONTROL PLAN
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS plans(

id TEXT PRIMARY KEY,

product_id TEXT NOT NULL REFERENCES products(id),

process_id TEXT NOT NULL REFERENCES processes(id),

name TEXT NOT NULL,

code TEXT,

version TEXT DEFAULT '1.0',

traceability_code TEXT,

author TEXT,

plan_date TEXT,

sample_interval INTEGER DEFAULT 60,

time_tolerance INTEGER DEFAULT 5,

created_by INTEGER REFERENCES users(id),

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now')),

updated_at TEXT DEFAULT(datetime('now'))

);

----------------------------------------------------------
CHARACTERISTIC TYPES
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS characteristic_types(

id INTEGER PRIMARY KEY,

name TEXT NOT NULL

);

INSERT OR IGNORE INTO characteristic_types(id,name)
VALUES
(1,'Numeric'),
(2,'PassFail'),
(3,'YesNo'),
(4,'List'),
(5,'Text'),
(6,'Date'),
(7,'Time');

----------------------------------------------------------
REACTION PLAN
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS reaction_plans(

id TEXT PRIMARY KEY,

title TEXT NOT NULL,

description TEXT

);

----------------------------------------------------------
OPERATORS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS operators(

id TEXT PRIMARY KEY,

personnel_no TEXT,

full_name TEXT NOT NULL,

shift TEXT,

active INTEGER DEFAULT 1
db.exec(`

----------------------------------------------------------
CHARACTERISTICS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS characteristics(

id TEXT PRIMARY KEY,

plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,

name TEXT NOT NULL,

type_id INTEGER NOT NULL REFERENCES characteristic_types(id),

unit TEXT,

lower_limit REAL,

target REAL,

upper_limit REAL,

list_values TEXT,

method TEXT,

frequency TEXT,

reaction_plan_id TEXT REFERENCES reaction_plans(id),

op_no TEXT,

importance TEXT,

responsible TEXT,

record_method TEXT,

required INTEGER DEFAULT 1,

sort_order INTEGER DEFAULT 0

);

----------------------------------------------------------
INSPECTION HEADER
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS inspection_headers(

id TEXT PRIMARY KEY,

plan_id TEXT NOT NULL REFERENCES plans(id),

product_id TEXT NOT NULL REFERENCES products(id),

process_id TEXT NOT NULL REFERENCES processes(id),

operator_id TEXT REFERENCES operators(id),

inspector_id INTEGER REFERENCES users(id),

inspection_date TEXT,

inspection_time TEXT,

shift TEXT,

traceability_code TEXT,

batch_no TEXT,

serial_no TEXT,

status TEXT DEFAULT 'OPEN',

note TEXT,

created_at TEXT DEFAULT(datetime('now'))

);

----------------------------------------------------------
INSPECTION DETAILS
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS inspection_details(

id TEXT PRIMARY KEY,

header_id TEXT NOT NULL REFERENCES inspection_headers(id) ON DELETE CASCADE,

characteristic_id TEXT NOT NULL REFERENCES characteristics(id),

numeric_value REAL,

text_value TEXT,

status TEXT,

reaction_plan_id TEXT REFERENCES reaction_plans(id),

note TEXT

);

----------------------------------------------------------
AUDIT LOG
----------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_logs(

id INTEGER PRIMARY KEY AUTOINCREMENT,

table_name TEXT,

record_id TEXT,

action TEXT,

old_value TEXT,

new_value TEXT,

user_id INTEGER REFERENCES users(id),

created_at TEXT DEFAULT(datetime('now'))

);

----------------------------------------------------------
INDEXES
----------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_product_name
ON products(name);

CREATE INDEX IF NOT EXISTS idx_process_name
ON processes(name);

CREATE INDEX IF NOT EXISTS idx_plan_product
ON plans(product_id);

CREATE INDEX IF NOT EXISTS idx_plan_process
ON plans(process_id);

CREATE INDEX IF NOT EXISTS idx_char_plan
ON characteristics(plan_id);

CREATE INDEX IF NOT EXISTS idx_header_plan
ON inspection_headers(plan_id);

CREATE INDEX IF NOT EXISTS idx_header_date
ON inspection_headers(inspection_date);

CREATE INDEX IF NOT EXISTS idx_detail_header
ON inspection_details(header_id);

CREATE INDEX IF NOT EXISTS idx_detail_char
ON inspection_details(characteristic_id);

`);
//------------------------------------------------------
// MIGRATIONS
//------------------------------------------------------

function columnExists(table, column) {

    const cols = db.prepare(`PRAGMA table_info(${table})`).all();

    return cols.some(c => c.name === column);

}

// plans

if (!columnExists("plans","version"))
    db.exec("ALTER TABLE plans ADD COLUMN version TEXT DEFAULT '1.0'");

if (!columnExists("plans","traceability_code"))
    db.exec("ALTER TABLE plans ADD COLUMN traceability_code TEXT");

if (!columnExists("plans","sample_interval"))
    db.exec("ALTER TABLE plans ADD COLUMN sample_interval INTEGER DEFAULT 60");

if (!columnExists("plans","time_tolerance"))
    db.exec("ALTER TABLE plans ADD COLUMN time_tolerance INTEGER DEFAULT 5");

// characteristics

if (!columnExists("characteristics","type_id"))
    db.exec("ALTER TABLE characteristics ADD COLUMN type_id INTEGER DEFAULT 1");

if (!columnExists("characteristics","list_values"))
    db.exec("ALTER TABLE characteristics ADD COLUMN list_values TEXT");

if (!columnExists("characteristics","reaction_plan_id"))
    db.exec("ALTER TABLE characteristics ADD COLUMN reaction_plan_id TEXT");

if (!columnExists("characteristics","required"))
    db.exec("ALTER TABLE characteristics ADD COLUMN required INTEGER DEFAULT 1");


//------------------------------------------------------
// TRIGGERS
//------------------------------------------------------

db.exec(`

CREATE TRIGGER IF NOT EXISTS trg_plan_updated

AFTER UPDATE ON plans

BEGIN

UPDATE plans

SET updated_at=datetime('now')

WHERE id=NEW.id;

END;

`);


//------------------------------------------------------
// DEFAULT REACTION PLANS
//------------------------------------------------------

db.exec(`

INSERT OR IGNORE INTO reaction_plans(id,title)

VALUES

('RP001','ادامه تولید'),

('RP002','توقف تولید'),

('RP003','جداسازی قطعات'),

('RP004','اطلاع به سرپرست'),

('RP005','بازرسی مجدد'),

('RP006','اصلاح فرآیند'),

('RP007','تعویض ابزار');

`);


//------------------------------------------------------
// DEFAULT ADMIN
//------------------------------------------------------

const admin=db.prepare("SELECT id FROM users WHERE username='admin'").get();

if(!admin){

db.prepare(`

INSERT INTO users

(username,password_hash,full_name,role)

VALUES

(?,?,?,?)

`).run(

"admin",

"$2b$10$replace_with_hash",

"System Administrator",

"admin"

);

}


//------------------------------------------------------
// VERSION HELPER
//------------------------------------------------------

function nextVersion(version){

    if(!version) return "1.0";

    const p=version.split(".");

    let major=parseInt(p[0]);

    let minor=parseInt(p[1]);

    minor++;

    if(minor>=10){

        major++;

        minor=0;

    }

    return major+"."+minor;

}


//------------------------------------------------------
// TRANSACTION
//------------------------------------------------------

function withTransaction(fn){

    db.exec("BEGIN");

    try{

        const result=fn();

        db.exec("COMMIT");

        return result;

    }

    catch(err){

        db.exec("ROLLBACK");

        throw err;

    }

}


//------------------------------------------------------
// EXPORTS
//------------------------------------------------------

module.exports=db;

module.exports.withTransaction=withTransaction;

module.exports.nextVersion=nextVersion;
);

`);
