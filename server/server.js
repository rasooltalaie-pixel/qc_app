// server.js — سرور اصلی سامانه طرح کنترل و ثبت نتایج بازرسی
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, requireAuth, requireRole } = require('./auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ============ AUTH ============
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ============ USERS (admin only) ============
app.get('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY id').all();
  res.json(users);
});

app.post('/api/users', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, full_name, role } = req.body || {};
  if (!username || !password || !full_name) return res.status(400).json({ error: 'همه فیلدها الزامی است' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, full_name, role || 'inspector');
    res.json({ id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است' });
  }
});

app.delete('/api/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ PLANS ============
app.get('/api/plans', requireAuth, (req, res) => {
  const plans = db.prepare('SELECT * FROM plans ORDER BY updated_at DESC').all();
  const chars = db.prepare('SELECT * FROM characteristics ORDER BY sort_order ASC').all();
  const byPlan = {};
  chars.forEach(c => {
    (byPlan[c.plan_id] = byPlan[c.plan_id] || []).push(c);
  });
  const result = plans.map(p => ({ ...p, characteristics: byPlan[p.id] || [] }));
  res.json(result);
});

app.post('/api/plans', requireAuth, requireRole('admin', 'qc_manager'), (req, res) => {
  const p = req.body;
  if (!p.name) return res.status(400).json({ error: 'نام محصول الزامی است' });
  const id = p.id || ('p_' + Date.now());

  try {
    db.withTransaction(() => {
      const exists = db.prepare('SELECT id FROM plans WHERE id = ?').get(id);
      if (exists) {
        db.prepare(`UPDATE plans SET name=?, code=?, rev=?, process=?, author=?, plan_date=?, updated_at=datetime('now') WHERE id=?`)
          .run(p.name, p.code || '', p.rev || '', p.process || '', p.author || '', p.date || '', id);
        db.prepare('DELETE FROM characteristics WHERE plan_id = ?').run(id);
      } else {
        db.prepare(`INSERT INTO plans (id, name, code, rev, process, author, plan_date, created_by) VALUES (?,?,?,?,?,?,?,?)`)
          .run(id, p.name, p.code || '', p.rev || '', p.process || '', p.author || '', p.date || '', req.user.id);
      }
      const insertChar = db.prepare(`INSERT INTO characteristics
        (id, plan_id, name, unit, method, lsl, target, usl, freq, reaction, op_no, importance, responsible, record_method, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      (p.characteristics || []).forEach((c, i) => {
        insertChar.run(
          c.id || ('c_' + Date.now() + i), id, c.name, c.unit || '', c.method || '',
          c.lsl === '' || c.lsl == null ? null : parseFloat(c.lsl),
          c.target === '' || c.target == null ? null : parseFloat(c.target),
          c.usl === '' || c.usl == null ? null : parseFloat(c.usl),
          c.freq || '', c.reaction || '',
          c.opNo || '', c.importance || '', c.responsible || '', c.recordMethod || '', i
        );
      });
    });
    res.json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطا در ذخیره‌سازی طرح کنترل' });
  }
});

app.delete('/api/plans/:id', requireAuth, requireRole('admin', 'qc_manager'), (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ ENTRIES ============
app.get('/api/entries', requireAuth, (req, res) => {
  const { planId, from, to } = req.query;
  let sql = `SELECT e.*, p.name AS plan_name, c.name AS char_name, c.unit AS unit, c.lsl AS lsl, c.usl AS usl
             FROM entries e
             JOIN plans p ON p.id = e.plan_id
             JOIN characteristics c ON c.id = e.char_id
             WHERE 1=1`;
  const params = [];
  if (planId) { sql += ' AND e.plan_id = ?'; params.push(planId); }
  if (from) { sql += ' AND e.entry_date >= ?'; params.push(from); }
  if (to) { sql += ' AND e.entry_date <= ?'; params.push(to); }
  sql += ' ORDER BY e.created_at DESC LIMIT 2000';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

app.post('/api/entries', requireAuth, (req, res) => {
  const e = req.body;
  if (!e.planId || !e.charId || e.value === undefined || e.value === '') {
    return res.status(400).json({ error: 'اطلاعات ناقص است' });
  }
  const char = db.prepare('SELECT * FROM characteristics WHERE id = ?').get(e.charId);
  if (!char) return res.status(404).json({ error: 'مشخصه یافت نشد' });

  const v = parseFloat(e.value);
  let status = 'na';
  if (char.lsl != null && char.usl != null) {
    status = (v >= char.lsl && v <= char.usl) ? 'ok' : 'fail';
  }

  const id = 'e_' + Date.now() + Math.random().toString(36).slice(2, 6);
  db.prepare(`INSERT INTO entries (id, plan_id, char_id, value, status, entry_date, shift, operator, note, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      id, e.planId, e.charId, v, status, e.date || '', e.shift || '', e.operator || req.user.full_name, e.note || '', req.user.id
    );

  res.json({ id, status, reaction: char.reaction || null });
});

app.delete('/api/entries/:id', requireAuth, requireRole('admin', 'qc_manager'), (req, res) => {
  db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ STATIC FRONTEND ============
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} اجرا شد → http://localhost:${PORT}`);
});
