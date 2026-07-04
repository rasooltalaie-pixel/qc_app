// auth.js — احراز هویت با JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('خطا: متغیر محیطی JWT_SECRET تنظیم نشده است. فایل .env را بررسی کنید.');
  process.exit(1);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ورود الزامی است' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'نشست منقضی شده — دوباره وارد شوید' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز' });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
