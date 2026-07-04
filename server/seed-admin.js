// seed-admin.js — ساخت اولین کاربر مدیر سیستم
// اجرا: npm run seed-admin -- --username=admin --password=123456 --name="نام مدیر"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

function argVal(flag, fallback) {
  const found = process.argv.find(a => a.startsWith(`--${flag}=`));
  return found ? found.split('=').slice(1).join('=') : fallback;
}

const username = argVal('username', 'admin');
const password = argVal('password', null);
const fullName = argVal('name', 'مدیر سیستم');

if (!password) {
  console.error('لطفاً رمز عبور را مشخص کنید: npm run seed-admin -- --username=admin --password=... --name="..."');
  process.exit(1);
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  console.log(`کاربر "${username}" از قبل وجود دارد.`);
  process.exit(0);
}

const hash = bcrypt.hashSync(password, 10);
db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)')
  .run(username, hash, fullName, 'admin');

console.log(`کاربر مدیر "${username}" با موفقیت ساخته شد.`);
