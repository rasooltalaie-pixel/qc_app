// =====================================================
// QC APP Database v1.0
// =====================================================

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DATA_DIR =
process.env.DATA_DIR ||
path.join(__dirname,"data");

if(!fs.existsSync(DATA_DIR)){

fs.mkdirSync(DATA_DIR,{
recursive:true
});

}

const DB_PATH=path.join(
DATA_DIR,
"qc.db"
);

const db=new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode=WAL");

db.exec("PRAGMA foreign_keys=ON");

db.exec("PRAGMA synchronous=NORMAL");
CREATE TABLE IF NOT EXISTS users(

id INTEGER PRIMARY KEY AUTOINCREMENT,

username TEXT UNIQUE NOT NULL,

password_hash TEXT NOT NULL,

full_name TEXT NOT NULL,

personnel_no TEXT,

role TEXT NOT NULL,

department TEXT,

mobile TEXT,

email TEXT,

active INTEGER DEFAULT 1,

last_login TEXT,

created_at TEXT DEFAULT(datetime('now')),

updated_at TEXT DEFAULT(datetime('now'))

);
CREATE TABLE IF NOT EXISTS products(

id TEXT PRIMARY KEY,

name TEXT NOT NULL,

technical_code TEXT,

drawing_no TEXT,

material TEXT,

customer TEXT,

logo TEXT,

image TEXT,

description TEXT,

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now'))

);
CREATE TABLE IF NOT EXISTS processes(

id TEXT PRIMARY KEY,

code TEXT,

name TEXT NOT NULL,

description TEXT,

sort_order INTEGER DEFAULT 0,

active INTEGER DEFAULT 1

);
CREATE TABLE IF NOT EXISTS product_processes(

id TEXT PRIMARY KEY,

product_id TEXT,

process_id TEXT,

sort_order INTEGER DEFAULT 0,

FOREIGN KEY(product_id)
REFERENCES products(id)
ON DELETE CASCADE,

FOREIGN KEY(process_id)
REFERENCES processes(id)
ON DELETE CASCADE

);
CREATE INDEX IF NOT EXISTS idx_products_name
ON products(name);

CREATE INDEX IF NOT EXISTS idx_process_name
ON processes(name);

CREATE INDEX IF NOT EXISTS idx_product_process
ON product_processes(product_id);

db.exec("PRAGMA temp_store=MEMORY");

db.exec("PRAGMA cache_size=10000");
CREATE TABLE IF NOT EXISTS operators(

id TEXT PRIMARY KEY,

personnel_no TEXT UNIQUE,

full_name TEXT NOT NULL,

department TEXT,

shift TEXT,

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now'))

);
CREATE TABLE IF NOT EXISTS characteristic_types(

id INTEGER PRIMARY KEY,

name TEXT NOT NULL,

description TEXT

);
const typeCount=db.prepare(
"SELECT COUNT(*) cnt FROM characteristic_types"
).get();

if(typeCount.cnt===0){

const insert=db.prepare(`
INSERT INTO characteristic_types
(id,name,description)
VALUES(?,?,?)
`);

insert.run(1,"Numeric","اندازه گیری عددی");

insert.run(2,"PassFail","قبول / رد");

insert.run(3,"YesNo","بله / خیر");

insert.run(4,"List","لیست انتخابی");

insert.run(5,"Text","متنی");

insert.run(6,"Date","تاریخ");

insert.run(7,"Time","زمان");

}
CREATE TABLE IF NOT EXISTS reaction_plans(

id TEXT PRIMARY KEY,

title TEXT NOT NULL,

description TEXT,

active INTEGER DEFAULT 1,

created_at TEXT DEFAULT(datetime('now'))

);
CREATE TABLE IF NOT EXISTS settings(

key TEXT PRIMARY KEY,

value TEXT,

description TEXT

);
const settingCount=db.prepare(
"SELECT COUNT(*) cnt FROM settings"
).get();

if(settingCount.cnt===0){

const insert=db.prepare(`
INSERT INTO settings
(key,value,description)
VALUES(?,?,?)
`);

insert.run(
"company_name",
"",
"نام شرکت"
);

insert.run(
"default_interval",
"60",
"دوره نمونه برداری"
);

insert.run(
"default_tolerance",
"5",
"تلرانس زمانی"
);

insert.run(
"calendar",
"jalali",
"نوع تقویم"
);

insert.run(
"language",
"fa",
"زبان نرم افزار"
);

}
CREATE INDEX IF NOT EXISTS idx_operator_name
ON operators(full_name);

CREATE INDEX IF NOT EXISTS idx_reaction_title
ON reaction_plans(title);
CREATE TABLE IF NOT EXISTS plans(

id TEXT PRIMARY KEY,

product_id TEXT NOT NULL,

process_id TEXT NOT NULL,

name TEXT NOT NULL,

code TEXT,

version TEXT DEFAULT '1.0',

revision INTEGER DEFAULT 0,

traceability_code TEXT,

author TEXT,

plan_date TEXT,

sample_interval INTEGER DEFAULT 60,

time_tolerance INTEGER DEFAULT 5,

status TEXT DEFAULT 'ACTIVE',

active INTEGER DEFAULT 1,

created_by INTEGER,

created_at TEXT DEFAULT(datetime('now')),

updated_at TEXT DEFAULT(datetime('now')),

FOREIGN KEY(product_id)
REFERENCES products(id),

FOREIGN KEY(process_id)
REFERENCES processes(id),

FOREIGN KEY(created_by)
REFERENCES users(id)

);
CREATE TABLE IF NOT EXISTS plan_versions(

id TEXT PRIMARY KEY,

plan_id TEXT NOT NULL,

version TEXT NOT NULL,

description TEXT,

created_by INTEGER,

created_at TEXT DEFAULT(datetime('now')),

FOREIGN KEY(plan_id)
REFERENCES plans(id)
ON DELETE CASCADE,

FOREIGN KEY(created_by)
REFERENCES users(id)

);
CREATE TABLE IF NOT EXISTS characteristics(

id TEXT PRIMARY KEY,

plan_id TEXT NOT NULL,

name TEXT NOT NULL,

type_id INTEGER NOT NULL,

unit TEXT,

lower_limit REAL,

target REAL,

upper_limit REAL,

list_values TEXT,

method TEXT,

frequency TEXT,

reaction_plan_id TEXT,

op_no TEXT,

importance TEXT,

responsible TEXT,

record_method TEXT,

required INTEGER DEFAULT 1,

spc INTEGER DEFAULT 0,

msa INTEGER DEFAULT 0,

remark TEXT,

sort_order INTEGER DEFAULT 0,

created_at TEXT DEFAULT(datetime('now')),

FOREIGN KEY(plan_id)
REFERENCES plans(id)
ON DELETE CASCADE,

FOREIGN KEY(type_id)
REFERENCES characteristic_types(id),

FOREIGN KEY(reaction_plan_id)
REFERENCES reaction_plans(id)

);
CREATE INDEX IF NOT EXISTS idx_plan_product
ON plans(product_id);

CREATE INDEX IF NOT EXISTS idx_plan_process
ON plans(process_id);

CREATE INDEX IF NOT EXISTS idx_plan_status
ON plans(status);

CREATE INDEX IF NOT EXISTS idx_characteristics_plan
ON characteristics(plan_id);

CREATE INDEX IF NOT EXISTS idx_characteristics_sort
ON characteristics(sort_order);

CREATE INDEX IF NOT EXISTS idx_characteristics_type
ON characteristics(type_id);
