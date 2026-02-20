const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { connect, isConnected, getModels } = require('./mongo');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Simple JSON file store
function readJSON(name, fallback) {
  try {
    const p = path.join(DATA_DIR, name);
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJSON(name, data) {
  const p = path.join(DATA_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// Minimal HMAC token (JWT-like) – no external deps
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function parseB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}
function createToken(payload, secret) {
  const body = { ...payload };
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', String(secret || '')).update(`${h}.${p}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${h}.${p}.${sig}`;
}
function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expect = crypto.createHmac('sha256', String(secret || '')).update(`${h}.${p}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  if (s !== expect) return null;
  try {
    const payload = JSON.parse(parseB64url(p));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function authOptional(req, _res, next) {
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7).trim();
    const user = verifyToken(token, process.env.JWT_SECRET || 'change-me');
    if (user && user.username) {
      req.user = { username: user.username, role: user.role || 'Admin' };
    }
  }
  // Fallback: cookie
  if (!req.user && req.headers.cookie) {
    const parts = String(req.headers.cookie).split(';').map(s => s.trim());
    const kv = Object.fromEntries(parts.map(p => {
      const i = p.indexOf('=');
      if (i === -1) return [p, ''];
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    }));
    const ctok = kv['smbank_token'];
    if (ctok) {
      const user = verifyToken(ctok, process.env.JWT_SECRET || 'change-me');
      if (user && user.username) {
        req.user = { username: user.username, role: user.role || 'Admin' };
      }
    }
  }
  next();
}
// Attach auth parsing early
app.use(authOptional);

// Try MongoDB connection if available
(async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connect(process.env.MONGODB_URI);
      console.log('connected to mongodb');
      try {
        const { User } = getModels();
        const uname = String(process.env.SEED_SUPER_USERNAME || '').trim();
        const pwd = String(process.env.SEED_SUPER_PASSWORD || '');
        if (uname && pwd) {
          const existing = await User.findOne({ username: uname });
          if (!existing) {
            const employeeNumber = 'IT00001';
            const accountCreatedAt = new Date().toISOString();
            const passwordHash = await bcrypt.hash(pwd, 10);
            await User.create({
              username: uname,
              passwordHash,
              role: 'Super Admin',
              enabled: true,
              department: 'IT',
              position: 'Super Admin',
              employeeNumber,
              accountCreatedAt,
              permsAdd: [],
              permsRemove: [],
            });
            console.log(`seeded Super Admin account: ${uname}`);
          } else {
            const updates = {};
            const tools = String(process.env.ALLOW_ADMIN_TOOLS).toLowerCase() === 'true';
            if (tools) updates.passwordHash = await bcrypt.hash(pwd, 10);
            else if (!existing.passwordHash) updates.passwordHash = await bcrypt.hash(pwd, 10);
            if (existing.role !== 'Super Admin') updates.role = 'Super Admin';
            if (existing.enabled !== true) updates.enabled = true;
            if (Object.keys(updates).length) {
              await User.updateOne({ username: uname }, { $set: updates });
              console.log(`ensured Super Admin account: ${uname}`);
            }
          }
        }
      } catch (e) {
        console.log('super admin seed skipped:', e.message || String(e));
      }
    }
  } catch (e) {
    console.log('MongoDB connection failed, using file store');
  }
})();

// Seed users (file store fallback)
const USERS_FILE = 'users.json';
let users = readJSON(USERS_FILE, [
  { username: 'super', role: 'Super Admin', permsAdd: [], permsRemove: [] },
  { username: 'admin', role: 'Admin', permsAdd: [], permsRemove: [] },
]);

const CONFIG_FILE = 'config.json';
let config = readJSON(CONFIG_FILE, {
  appName: 'smBank',
  footerText: '© smBank',
  primary: '#0f172a',
  primaryContrast: '#ffffff',
  darkMode: false,
  defaultLoanRate: 0,
  bankCode: '07',
  branches: [
    { code: '001', name: 'Head office', active: true },
  ],
  accountTypes: [
    { code: '10', name: 'Savings Account', supportsIndividual: true, active: true },
    { code: '13', name: 'Susu Account', supportsIndividual: true, active: true },
    { code: '16', name: 'Current Account', supportsIndividual: true, active: true },
    { code: '19', name: 'Fix Deposit', supportsIndividual: true, active: true },
    { code: '22', name: 'Mmofra Daakye Account', supportsIndividual: true, active: true },
    { code: '60', name: 'Business Account', supportsIndividual: false, active: true },
  ],
  lastCustomerSerial: 0,
});

const BIN_FILE = 'superbin.json';
let superBin = readJSON(BIN_FILE, []);

const ACTIVITY_FILE = 'activity.json';
let activity = readJSON(ACTIVITY_FILE, []);

// Helpers
function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`;
}
function randomDigits(n) {
  let s = '';
  while (s.length < n) s += Math.floor(Math.random() * 10);
  return s.slice(0, n);
}
function newLoanId() {
  return `L${randomDigits(7)}`;
}
function newTxnId(kind) {
  const digits = randomDigits(12);
  if (kind === 'deposit') return `D-${digits}`;
  if (kind === 'withdraw') return `W-${digits}`;
  return `TX-${digits}`;
}
function newRepayId() {
  return `LRP-${randomDigits(12)}`;
}
function tenDigit() {
  let s = '';
  while (s.length < 10) s += Math.floor(Math.random() * 10);
  return s.slice(0, 10);
}
function padDigits(s, n) {
  const only = String(s || '').replace(/\D/g, '');
  return only.padStart(n, '0').slice(-n);
}
function deriveCodesFromAccountNumber(acct) {
  const s = String(acct || '');
  if (/^\d{13}$/.test(s)) {
    return {
      bankCode: s.slice(0, 2),
      branchCode: s.slice(2, 5),
      accountTypeCode: s.slice(5, 7),
      serialNumber: s.slice(7, 13),
    };
  }
  return {};
}
async function nextCustomerSerial() {
  if (isConnected()) {
    const { Config } = getModels();
    const doc = await Config.findOneAndUpdate({}, { $inc: { lastCustomerSerial: 1 } }, { upsert: true, new: true });
    return Number(doc.lastCustomerSerial || 0);
  }
  config.lastCustomerSerial = Number(config.lastCustomerSerial || 0) + 1;
  writeJSON(CONFIG_FILE, config);
  return config.lastCustomerSerial;
}
async function makeAccountNumber(branchCode, accountTypeCode) {
  let bankCode = (isConnected() ? (await (async () => {
    const { Config } = getModels();
    const doc = await Config.findOne().lean();
    return (doc && doc.bankCode) || config.bankCode || '00';
  })()) : (config.bankCode || '00'));
  const branches = isConnected() ? (await (async () => {
    const { Config } = getModels();
    const doc = await Config.findOne().lean();
    return (doc && doc.branches) || config.branches || [];
  })()) : (config.branches || []);
  const types = isConnected() ? (await (async () => {
    const { Config } = getModels();
    const doc = await Config.findOne().lean();
    return (doc && doc.accountTypes) || config.accountTypes || [];
  })()) : (config.accountTypes || []);
  const b = branches.find(x => x.code === branchCode) || branches[0] || { code: '000' };
  const t = types.find(x => x.code === accountTypeCode) || types[0] || { code: '00' };
  const serial = await nextCustomerSerial();
  const parts = [
    padDigits(bankCode, 2),
    padDigits(b.code, 3),
    padDigits(t.code, 2),
    padDigits(serial, 6),
  ];
  return parts.join('');
}
function calcBalanceFrom(tx) {
  const n = v => Number(v || 0);
  const sum = (arr, pred) => (arr || []).filter(pred).reduce((s, x) => s + n(x.amount), 0);
  const deposits = sum(tx, t => t.kind === 'deposit');
  const withdrawals = sum(tx, t => t.kind === 'withdraw');
  // Loans are excluded from main account balance
  return deposits - withdrawals;
}
async function computeAccountBalance(accountNumber) {
  const acct = String(accountNumber || '').trim();
  if (!acct) return 0;
  if (isConnected()) {
    const { PostedTxn } = getModels();
    const tx = await PostedTxn.find({ accountNumber: acct }).lean();
    return calcBalanceFrom(tx);
  }
  const tx = postedTx.filter(t => String(t.accountNumber) === acct);
  return calcBalanceFrom(tx);
}
function utcDateStr(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function nextMidnightUTC(d = new Date()) {
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0);
  return new Date(t).toISOString();
}
function getDailyApprovalCode(username, onDate = new Date()) {
  const user = String(username || '').trim().toLowerCase();
  const secret = String(process.env.APPROVAL_CODE_SECRET || process.env.JWT_SECRET || 'change-me');
  const seed = `${user}|${utcDateStr(onDate)}`;
  const h = crypto.createHmac('sha256', secret).update(seed).digest();
  // Use first 4 bytes as a number to derive 6 digits
  const num = (h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3];
  const six = (Math.abs(num) % 1000000).toString().padStart(6, '0');
  return six;
}
function verifyApprovalCode(username, code) {
  const exp = String(code || '').trim();
  if (!exp) return false;
  const now = new Date();
  // Accept code for today; optionally accept yesterday for brief grace around midnight
  const today = getDailyApprovalCode(username, now);
  if (exp === today) return true;
  const yday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return exp === getDailyApprovalCode(username, yday);
}
function canApproveTxn(role) {
  const r = String(role || '');
  return r === 'Admin' || r === 'Super Admin' || r === 'Account Manager';
}
function canApproveLoan(role) {
  const r = String(role || '');
  return r === 'Admin' || r === 'Super Admin' || r === 'Loan Manager';
}
const canApproveRepay = canApproveLoan;
async function nextEmployeeNumber(dept, UserModel) {
  const prefix = (String(dept || '').trim().toUpperCase().slice(0, 2) || 'XX');
  // Find the highest existing sequence for this prefix
  const re = new RegExp(`^${prefix}[0-9]{5}$`);
  const docs = await UserModel.find({ employeeNumber: { $regex: re } }, { employeeNumber: 1 }).lean();
  let max = 0;
  for (const d of docs) {
    const num = parseInt(String(d.employeeNumber || '').slice(2), 10);
    if (!Number.isNaN(num)) max = Math.max(max, num);
  }
  const seq = (max + 1).toString().padStart(5, '0');
  return `${prefix}${seq}`;
}
function collectContacts(obj) {
  const emails = [];
  const phones = [];
  const ids = [];
  const pushIf = (v, arr) => { if (v) arr.push(String(v).trim()); };
  if (!obj || typeof obj !== 'object') return { emails, phones, ids };
  pushIf(obj.email, emails);
  pushIf(obj.contactEmail, emails);
  pushIf(obj.nok1Email, emails);
  pushIf(obj.nok2Email, emails);
  pushIf(obj.phone, phones);
  pushIf(obj.companyPhone, phones);
  pushIf(obj.contactPhone, phones);
  pushIf(obj.nok1Phone, phones);
  pushIf(obj.nok2Phone, phones);
  pushIf(obj.nationalId, ids);
  pushIf(obj.registrationNumber, ids);
  const arrays = ['directors', 'shareholders', 'signatories'];
  for (const k of arrays) {
    const arr = Array.isArray(obj[k]) ? obj[k] : [];
    for (const it of arr) {
      pushIf(it.email, emails);
      pushIf(it.phone, phones);
      pushIf(it.nationalId, ids);
      pushIf(it.idFront && it.idFrontNumber, ids);
    }
  }
  return { emails, phones, ids };
}
function hasDuplicates(arr) {
  const set = new Set();
  for (const v of arr.map(x => String(x || '').trim()).filter(Boolean)) {
    const key = v.toLowerCase();
    if (set.has(key)) return true;
    set.add(key);
  }
  return false;
}

function actorOf(req) {
  if (req && req.user && req.user.username) return { actor: req.user.username, role: req.user.role || 'Admin' };
  return { actor: 'system', role: 'System' };
}
async function logActivity(req, action, entityType, entityId, details) {
  const hdrs = (req && req.headers) || {};
  const meta = {
    ts: new Date(),
    actor: actorOf(req).actor,
    role: actorOf(req).role,
    action,
    entityType: entityType || '',
    entityId: entityId || '',
    details: details || {},
    ip: hdrs['x-forwarded-for'] || (req && req.socket && req.socket.remoteAddress) || '',
    ua: hdrs['user-agent'] || '',
    method: (req && req.method) || '',
    path: (req && req.path) || '',
  };
  if (isConnected()) {
    const { ActivityLog } = getModels();
    try { await ActivityLog.create(meta); } catch {}
    return;
  }
  const item = { ...meta, ts: meta.ts.toISOString ? meta.ts.toISOString() : String(meta.ts) };
  activity.unshift(item);
  writeJSON(ACTIVITY_FILE, activity);
}
function requireAdmin(req, res, next) {
  if (req.user && (String(req.user.role) === 'Admin' || String(req.user.role) === 'Super Admin')) return next();
  return res.status(403).json({ error: 'forbidden' });
}

// Domain stores
const CLIENTS_FILE = 'clients.json';
let clients = readJSON(CLIENTS_FILE, []);

const PENDING_TX_FILE = 'pending_txn.json';
const POSTED_TX_FILE = 'posted_txn.json';
let pendingTx = readJSON(PENDING_TX_FILE, []);
let postedTx = readJSON(POSTED_TX_FILE, []);

const LOANS_FILE = 'loans.json';
let loans = readJSON(LOANS_FILE, []);
const LOAN_REPAY_PENDING_FILE = 'loan_repay_pending.json';
const LOAN_REPAY_POSTED_FILE = 'loan_repay_posted.json';
let loanRepayPending = readJSON(LOAN_REPAY_PENDING_FILE, []);
let loanRepayPosted = readJSON(LOAN_REPAY_POSTED_FILE, []);

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), db: isConnected() });
});

// Current user profile, including daily approval code
app.get('/me', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const uname = req.user.username;
  let profile = { username: uname, role: req.user.role || 'Admin' };
  if (isConnected()) {
    try {
      const { User } = getModels();
      const u = await User.findOne({ username: uname }).lean();
      if (u) {
        profile = {
          username: u.username,
          role: u.role,
          enabled: u.enabled,
          fullName: u.fullName || '',
          email: u.email || '',
          phone: u.phone || '',
          department: u.department || '',
          position: u.position || '',
          employeeNumber: u.employeeNumber || '',
        };
      }
    } catch {}
  } else {
    const u = users.find(x => x.username === uname);
    if (u) {
      profile = { ...profile, fullName: u.fullName || '', email: u.email || '', phone: u.phone || '', department: u.department || '', position: u.position || '', employeeNumber: u.employeeNumber || '' };
    }
  }
  const code = getDailyApprovalCode(uname);
  res.json({ ...profile, approvalCode: code, approvalCodeExpiresAt: nextMidnightUTC() });
});

// Auth
app.post('/auth/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const uname = String(username).trim();
  // Enforce strict DB-backed login when connected (or STRICT_AUTH enabled)
  if (isConnected() || String(process.env.STRICT_AUTH).toLowerCase() === 'true') {
    if (!isConnected()) {
      const tools = String(process.env.ALLOW_ADMIN_TOOLS).toLowerCase() === 'true';
      const envU = String(process.env.SEED_SUPER_USERNAME || '').trim();
      const envP = String(process.env.SEED_SUPER_PASSWORD || '');
      if (tools && envU && envP && uname === envU && String(password) === envP) {
        const role = 'Super Admin';
        const now = Date.now();
        const token = createToken({ username: uname, role, iat: now, exp: now + 7 * 24 * 60 * 60 * 1000 }, process.env.JWT_SECRET || 'change-me');
        res.setHeader('Set-Cookie', `smbank_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
        await logActivity({ ...req, user: { username: uname, role } }, 'login', 'auth', uname, { mode: 'env-fallback' });
        return res.json({ username: uname, role, token });
      }
      return res.status(503).json({ error: 'db_unavailable' });
    }
    const { User } = getModels();
    const existing = await User.findOne({ username: uname }).lean();
    if (!existing || !existing.enabled || !existing.passwordHash) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const ok = await bcrypt.compare(String(password), existing.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const role = existing.role || 'Admin';
    const now = Date.now();
    const token = createToken({ username: uname, role, iat: now, exp: now + 7 * 24 * 60 * 60 * 1000 }, process.env.JWT_SECRET || 'change-me');
    res.setHeader('Set-Cookie', `smbank_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    await logActivity({ ...req, user: { username: uname, role } }, 'login', 'auth', uname, {});
    return res.json({ username: uname, role, token });
  }
  // Non-strict fallback (file store) – dev only when DB disabled
  const candidate = users.find(u => u.username === uname);
  if (!candidate) return res.status(401).json({ error: 'invalid_credentials' });
  const role = candidate.role || 'Admin';
  const now = Date.now();
  const token = createToken({ username: uname, role, iat: now, exp: now + 7 * 24 * 60 * 60 * 1000 }, process.env.JWT_SECRET || 'change-me');
  res.setHeader('Set-Cookie', `smbank_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  await logActivity({ ...req, user: { username: uname, role } }, 'login', 'auth', uname, {});
  return res.json({ username: uname, role, token });
});

app.post('/auth/logout', async (req, res) => {
  res.setHeader('Set-Cookie', `smbank_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  await logActivity(req, 'logout', 'auth', actorOf(req).actor, {});
  res.json({ ok: true });
});

// Admin wipe endpoint removed to prevent accidental data loss

// Admin seed-super endpoint removed to avoid unexpected overwrites

// Users
app.get('/users', async (req, res) => {
  if (isConnected()) {
    const { department, role, empno, q } = req.query;
    const { User } = getModels();
    const filter = {};
    if (department) filter.department = { $regex: String(department), $options: 'i' };
    if (role) filter.role = String(role);
    if (empno) filter.employeeNumber = { $regex: `^${String(empno)}`, $options: 'i' };
    if (q) {
      const s = String(q);
      filter.$or = [
        { username: { $regex: s, $options: 'i' } },
        { fullName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
      ];
    }
    const list = await User.find(filter).sort({ username: 1 }).lean();
    const redacted = list.map(u => {
      const { passwordHash, ...rest } = u;
      return rest;
    });
    return res.json(redacted);
  }
  return res.json(users);
});
app.post('/users', async (req, res) => {
  const payload = req.body || {};
  if (isConnected()) {
    const { User } = getModels();
    const uname = String(payload.username || '').trim();
    if (!uname) return res.status(400).json({ error: 'username_required' });
    let doc = await User.findOne({ username: uname });
    let createdFlag = false;
    const base = {
      fullName: payload.fullName || (doc && doc.fullName) || '',
      email: payload.email || (doc && doc.email) || '',
      phone: payload.phone || (doc && doc.phone) || '',
      department: payload.department || (doc && doc.department) || '',
      position: payload.position || (doc && doc.position) || '',
      dateEmployed: payload.dateEmployed || (doc && doc.dateEmployed) || '',
      contractEndDate: payload.contractEndDate || (doc && doc.contractEndDate) || '',
      role: payload.role || (doc && doc.role) || 'Admin',
      enabled: typeof payload.enabled === 'boolean' ? payload.enabled : (doc ? doc.enabled : true),
      permsAdd: payload.permsAdd || (doc && doc.permsAdd) || [],
      permsRemove: payload.permsRemove || (doc && doc.permsRemove) || [],
    };
    if (!doc) {
      let created = null;
      let attempts = 0;
      while (!created && attempts < 5) {
        attempts++;
        const employeeNumber = await nextEmployeeNumber(base.department, User);
        const accountCreatedAt = new Date().toISOString();
        const toCreate = {
          username: uname,
          ...base,
          employeeNumber,
          accountCreatedAt,
        };
        if (!payload.password) return res.status(400).json({ error: 'password_required' });
        toCreate.passwordHash = await bcrypt.hash(String(payload.password), 10);
        try {
          created = await User.create(toCreate);
        } catch (e) {
          // retry on duplicate employeeNumber or username
          if (e && e.code === 11000) {
            created = null;
            continue;
          }
          throw e;
        }
      }
      doc = created;
      createdFlag = true;
    } else {
      // Update fields; update password if provided
      if (payload.password) {
        doc.passwordHash = await bcrypt.hash(String(payload.password), 10);
      }
      Object.assign(doc, base);
      await doc.save();
    }
    const obj = doc.toObject ? doc.toObject() : doc;
    delete obj.passwordHash;
    await logActivity(req, createdFlag ? 'user.create' : 'user.update', 'user', uname, { department: obj.department || '', role: obj.role || '' });
    return res.json(obj);
  }
  // File-store fallback (dev only)
  const idx = users.findIndex(u => u.username === payload.username);
  if (idx >= 0) users[idx] = { ...users[idx], ...payload };
  else users.push(payload);
  writeJSON(USERS_FILE, users);
  await logActivity(req, idx >= 0 ? 'user.update' : 'user.create', 'user', String(payload.username || ''), {});
  res.json(payload);
});
app.post('/users/:username/password', async (req, res) => {
  const uname = req.params.username;
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'password_required' });
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  const { User } = getModels();
  const doc = await User.findOne({ username: uname });
  if (!doc) return res.status(404).json({ error: 'not_found' });
  doc.passwordHash = await bcrypt.hash(String(password), 10);
  await doc.save();
  await logActivity(req, 'user.password_change', 'user', uname, {});
  return res.json({ ok: true });
});
app.post('/users/:username/enable', async (req, res) => {
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  const { User } = getModels();
  const doc = await User.findOneAndUpdate({ username: req.params.username }, { $set: { enabled: true } }, { new: true }).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const { passwordHash, ...rest } = doc;
  await logActivity(req, 'user.enable', 'user', String(req.params.username), {});
  return res.json(rest);
});
app.post('/users/:username/disable', async (req, res) => {
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  const { User } = getModels();
  const doc = await User.findOneAndUpdate({ username: req.params.username }, { $set: { enabled: false } }, { new: true }).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const { passwordHash, ...rest } = doc;
  await logActivity(req, 'user.disable', 'user', String(req.params.username), {});
  return res.json(rest);
});
app.delete('/users/:username', async (req, res) => {
  const uname = req.params.username;
  if (isConnected()) {
    const { User, SuperBin } = getModels();
    const user = await User.findOneAndDelete({ username: uname }).lean();
    if (user) {
      await SuperBin.create({ by: 'system', deletedAt: new Date(), kind: 'user', payload: user });
    }
    await logActivity(req, 'user.delete', 'user', uname, {});
    return res.json({ ok: true });
  }
  const user = users.find(u => u.username === uname);
  users = users.filter(u => u.username !== uname);
  writeJSON(USERS_FILE, users);
  if (user) {
    const item = {
      id: `BIN-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      by: 'system',
      deletedAt: new Date().toISOString(),
      kind: 'user',
      payload: user,
    };
    superBin.unshift(item);
    writeJSON(BIN_FILE, superBin);
  }
  await logActivity(req, 'user.delete', 'user', uname, {});
  res.json({ ok: true });
});

// Config
app.get('/config', async (req, res) => {
  if (isConnected()) {
    const { Config } = getModels();
    let doc = await Config.findOne().lean();
    if (!doc) doc = await Config.create(config);
    // Merge with in-memory defaults to ensure new fields are present
    return res.json({ ...config, ...doc });
  }
  res.json(config);
});
app.put('/config', async (req, res) => {
  if (isConnected()) {
    const { Config } = getModels();
    const saved = await Config.findOneAndUpdate({}, { $set: req.body }, { upsert: true, new: true });
    await logActivity(req, 'config.update', 'config', '', {});
    return res.json(saved);
  }
  config = { ...config, ...req.body };
  writeJSON(CONFIG_FILE, config);
  await logActivity(req, 'config.update', 'config', '', {});
  res.json(config);
});

// Super Bin
function requireSuperBinAuth(req, res, next) {
  // Allow if authenticated user has 'Super Admin' role
  if (req.user && String(req.user.role) === 'Super Admin') return next();
  // Fallback header gate for tools/scripts
  const token = req.headers['x-superbin-token'] || req.headers['x-admin-reset'];
  const expect = process.env.ADMIN_RESET_TOKEN || '';
  if (expect && token === expect) return next();
  return res.status(403).json({ error: 'forbidden' });
}
app.get('/super-bin', requireSuperBinAuth, async (req, res) => {
  if (isConnected()) {
    const { SuperBin } = getModels();
    const list = await SuperBin.find().sort({ deletedAt: -1, _id: -1 }).lean();
    await logActivity(req, 'superbin.list', 'superbin', '', {});
    return res.json(list);
  }
  await logActivity(req, 'superbin.list', 'superbin', '', {});
  res.json(superBin);
});
app.post('/super-bin', requireSuperBinAuth, async (req, res) => {
  const entry = req.body;
  if (isConnected()) {
    const { SuperBin } = getModels();
    const item = await SuperBin.create({
      by: entry.by || 'api',
      deletedAt: new Date(),
      kind: entry.kind || 'unknown',
      payload: entry.payload || {},
    });
    await logActivity(req, 'superbin.add', 'superbin', String(item && item._id ? item._id : ''), { kind: entry.kind || '' });
    return res.json(item);
  }
  const item = {
    id: `BIN-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    by: entry.by || 'api',
    deletedAt: new Date().toISOString(),
    kind: entry.kind || 'unknown',
    payload: entry.payload || {},
  };
  superBin.unshift(item);
  writeJSON(BIN_FILE, superBin);
  await logActivity(req, 'superbin.add', 'superbin', item.id, { kind: item.kind || '' });
  res.json(item);
});
app.post('/super-bin/:id/restore', requireSuperBinAuth, async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { SuperBin } = getModels();
    const item = await SuperBin.findByIdAndDelete(id).lean();
    if (!item) return res.status(404).json({ error: 'not found' });
    await logActivity(req, 'superbin.restore', 'superbin', id, { kind: item.kind || '' });
    return res.json(item);
  }
  const idx = superBin.findIndex(i => i.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [item] = superBin.splice(idx, 1);
  writeJSON(BIN_FILE, superBin);
  await logActivity(req, 'superbin.restore', 'superbin', id, { kind: item && item.kind || '' });
  res.json(item);
});
app.delete('/super-bin/:id', requireSuperBinAuth, async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { SuperBin } = getModels();
    await SuperBin.findByIdAndDelete(id);
    await logActivity(req, 'superbin.delete', 'superbin', id, {});
    return res.json({ ok: true });
  }
  superBin = superBin.filter(i => i.id !== id);
  writeJSON(BIN_FILE, superBin);
  await logActivity(req, 'superbin.delete', 'superbin', id, {});
  res.json({ ok: true });
});

// Clients
app.get('/clients', async (req, res) => {
  const { q, accountNumber } = req.query;
  if (isConnected()) {
    const { Client } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (q) {
      const s = String(q);
      filter.$or = [
        { fullName: { $regex: s, $options: 'i' } },
        { companyName: { $regex: s, $options: 'i' } },
        { nationalId: { $regex: s, $options: 'i' } },
        { accountNumber: { $regex: s, $options: 'i' } },
      ];
    }
    const docs = await Client.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    const list = docs.map(d => ({ ...(d.data || {}), id: d.id, accountNumber: d.accountNumber, createdAt: d.createdAt, fullName: d.fullName, companyName: d.companyName, nationalId: d.nationalId, dob: d.dob, phone: d.phone, companyPhone: d.companyPhone, registrationDate: d.registrationDate }));
    return res.json(list);
  }
  let result = clients;
  if (accountNumber) result = result.filter(c => c.accountNumber === accountNumber);
  if (q) {
    const s = String(q).toLowerCase();
    result = result.filter(c =>
      (c.fullName || c.companyName || '').toLowerCase().includes(s) ||
      (c.nationalId || '').toLowerCase().includes(s) ||
      (c.accountNumber || '').includes(s)
    );
  }
  res.json(result);
});
app.get('/clients/:id', async (req, res) => {
  if (isConnected()) {
    const { Client } = getModels();
    const d = await Client.findOne({ $or: [{ accountNumber: req.params.id }, { id: req.params.id }] }).lean();
    if (!d) return res.status(404).json({ error: 'not found' });
    const derived = deriveCodesFromAccountNumber(d.accountNumber);
    const base = { ...(d.data || {}) };
    if (!base.branchCode && derived.branchCode) base.branchCode = derived.branchCode;
    if (!base.accountTypeCode && derived.accountTypeCode) base.accountTypeCode = derived.accountTypeCode;
    const obj = { ...base, id: d.id, accountNumber: d.accountNumber, createdAt: d.createdAt, fullName: d.fullName, companyName: d.companyName, nationalId: d.nationalId, dob: d.dob, phone: d.phone, companyPhone: d.companyPhone, registrationDate: d.registrationDate };
    // Persist normalized codes if newly derived
    if ((derived.branchCode && !((d.data || {}).branchCode)) || (derived.accountTypeCode && !((d.data || {}).accountTypeCode))) {
      try {
        await Client.updateOne({ _id: d._id }, { $set: { 'data.branchCode': obj.branchCode, 'data.accountTypeCode': obj.accountTypeCode } });
      } catch {}
    }
    await logActivity(req, 'client.view', 'client', String(d.accountNumber || d.id || ''), {});
    return res.json(obj);
  }
  const it = clients.find(c => c.accountNumber === req.params.id || c.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'not found' });
  const derived = deriveCodesFromAccountNumber(it.accountNumber);
  let mutated = false;
  if (!it.branchCode && derived.branchCode) { it.branchCode = derived.branchCode; mutated = true; }
  if (!it.accountTypeCode && derived.accountTypeCode) { it.accountTypeCode = derived.accountTypeCode; mutated = true; }
  if (mutated) { writeJSON(CLIENTS_FILE, clients); }
  await logActivity(req, 'client.view', 'client', String(it.accountNumber || it.id || ''), {});
  res.json(it);
});
app.post('/clients', async (req, res) => {
  const body = req.body || {};
  const c = { ...body };
  c.id = c.id || newId('C');
  // Accept preferred branchCode and accountTypeCode from payload, otherwise pick first active
  let bCode = c.branchCode || (Array.isArray(config.branches) && config.branches.find(b => b.active)?.code) || '001';
  let tCode = c.accountTypeCode || (Array.isArray(config.accountTypes) && config.accountTypes.find(a => a.active)?.code) || '10';
  try {
    c.accountNumber = c.accountNumber || await makeAccountNumber(bCode, tCode);
  } catch {
    c.accountNumber = c.accountNumber || tenDigit();
  }
  c.createdAt = c.createdAt || new Date().toISOString();
  const contacts = collectContacts(c);
  if (hasDuplicates(contacts.emails)) return res.status(400).json({ error: 'duplicate_contact', field: 'email' });
  if (hasDuplicates(contacts.phones)) return res.status(400).json({ error: 'duplicate_contact', field: 'phone' });
  if (hasDuplicates(contacts.ids)) return res.status(400).json({ error: 'duplicate_contact', field: 'id' });
  if (isConnected()) {
    const { Client } = getModels();
    const doc = await Client.create({
      id: c.id,
      accountNumber: c.accountNumber,
      fullName: c.fullName || '',
      companyName: c.companyName || '',
      nationalId: c.nationalId || '',
      dob: c.dob || '',
      phone: c.phone || '',
      companyPhone: c.companyPhone || '',
      registrationDate: c.registrationDate || '',
      createdAt: c.createdAt,
      data: c,
    });
    await logActivity(req, 'client.create', 'client', String(doc.accountNumber || ''), {});
    return res.status(201).json({ ...(doc.data || {}), id: doc.id, accountNumber: doc.accountNumber, createdAt: doc.createdAt });
  }
  clients.push(c);
  writeJSON(CLIENTS_FILE, clients);
  await logActivity(req, 'client.create', 'client', String(c.accountNumber || ''), {});
  res.status(201).json(c);
});
app.put('/clients/:id', async (req, res) => {
  if (isConnected()) {
    const { Client } = getModels();
    const d = await Client.findOne({ $or: [{ accountNumber: req.params.id }, { id: req.params.id }] });
    if (!d) return res.status(404).json({ error: 'not found' });
    const next = { ...(d.data || {}), ...req.body, id: d.id, accountNumber: d.accountNumber };
    const contacts = collectContacts(next);
    if (hasDuplicates(contacts.emails)) return res.status(400).json({ error: 'duplicate_contact', field: 'email' });
    if (hasDuplicates(contacts.phones)) return res.status(400).json({ error: 'duplicate_contact', field: 'phone' });
    if (hasDuplicates(contacts.ids)) return res.status(400).json({ error: 'duplicate_contact', field: 'id' });
    d.fullName = next.fullName || d.fullName || '';
    d.companyName = next.companyName || d.companyName || '';
    d.nationalId = next.nationalId || d.nationalId || '';
    d.dob = next.dob || d.dob || '';
    d.phone = next.phone || d.phone || '';
    d.companyPhone = next.companyPhone || d.companyPhone || '';
    d.registrationDate = next.registrationDate || d.registrationDate || '';
    d.data = next;
    await d.save();
    await logActivity(req, 'client.update', 'client', String(d.accountNumber || d.id || ''), {});
    return res.json(next);
  }
  const idx = clients.findIndex(c => c.accountNumber === req.params.id || c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  clients[idx] = { ...clients[idx], ...req.body, id: clients[idx].id, accountNumber: clients[idx].accountNumber };
  writeJSON(CLIENTS_FILE, clients);
  await logActivity(req, 'client.update', 'client', String(clients[idx].accountNumber || ''), {});
  res.json(clients[idx]);
});
app.delete('/clients/:id', async (req, res) => {
  if (isConnected()) {
    const { Client, SuperBin } = getModels();
    const d = await Client.findOneAndDelete({ $or: [{ accountNumber: req.params.id }, { id: req.params.id }] }).lean();
    if (!d) return res.status(404).json({ error: 'not found' });
    const item = await SuperBin.create({ by: 'api', deletedAt: new Date(), kind: 'client', payload: d.data || d });
    await logActivity(req, 'client.delete', 'client', String(req.params.id), {});
    return res.json({ ok: true, item });
  }
  const idx = clients.findIndex(c => c.accountNumber === req.params.id || c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [deleted] = clients.splice(idx, 1);
  writeJSON(CLIENTS_FILE, clients);
  const item = {
    id: newId('BIN'),
    by: 'api',
    deletedAt: new Date().toISOString(),
    kind: 'client',
    payload: deleted,
  };
  superBin.unshift(item);
  writeJSON(BIN_FILE, superBin);
  await logActivity(req, 'client.delete', 'client', String(req.params.id), {});
  res.json({ ok: true, item });
});

// Directory lookup (basic fields for quick verification)
app.get('/directory/:accountNumber', async (req, res) => {
  const acct = req.params.accountNumber;
  if (isConnected()) {
    const { Client } = getModels();
    const d = await Client.findOne({ accountNumber: acct }).lean();
    if (!d) return res.status(404).json({ error: 'not found' });
    const c = { ...(d.data || {}), accountNumber: d.accountNumber, fullName: d.fullName, companyName: d.companyName, nationalId: d.nationalId, dob: d.dob, phone: d.phone, companyPhone: d.companyPhone, registrationDate: d.registrationDate };
    const name = c.fullName || c.companyName || '';
    await logActivity(req, 'directory.lookup', 'client', String(d.accountNumber || ''), {});
    return res.json({
      accountNumber: d.accountNumber,
      name,
      nationalId: c.nationalId || c.companyRegistrationNumber || '',
      dob: c.dob || c.registrationDate || '',
      phone: c.phone || c.companyPhone || '',
    });
  }
  const c = clients.find(x => x.accountNumber === acct);
  if (!c) return res.status(404).json({ error: 'not found' });
  const name = c.fullName || c.companyName || '';
  await logActivity(req, 'directory.lookup', 'client', String(c.accountNumber || ''), {});
  res.json({
    accountNumber: c.accountNumber,
    name,
    nationalId: c.nationalId || c.companyRegistrationNumber || '',
    dob: c.dob || c.registrationDate || '',
    phone: c.phone || c.companyPhone || '',
  });
});

// Transactions: deposit & withdraw with two-step approvals
app.get('/transactions/pending', async (req, res) => {
  const { type } = req.query;
  if (isConnected()) {
    const { PendingTxn } = getModels();
    const filter = {};
    if (type) {
      const set = new Set(String(type).split(','));
      filter.kind = { $in: Array.from(set) };
    }
    const docs = await PendingTxn.find(filter).sort({ initiatedAt: -1, _id: -1 }).lean();
    return res.json(docs);
  }
  let result = pendingTx;
  if (type) {
    const set = new Set(String(type).split(','));
    result = result.filter(t => set.has(t.kind));
  }
  res.json(result);
});
app.get('/transactions/posted', async (req, res) => {
  const { accountNumber, type, from, to, id } = req.query;
  if (isConnected()) {
    const { PostedTxn } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (type) filter.kind = type;
    if (from || to) {
      filter.approvedAt = {};
      if (from) filter.approvedAt.$gte = from;
      if (to) filter.approvedAt.$lte = to;
    }
    if (id) filter.id = { $regex: String(id), $options: 'i' };
    const docs = await PostedTxn.find(filter).sort({ approvedAt: -1, _id: -1 }).lean();
    await logActivity(req, 'statements.view', 'transactions', String(accountNumber || ''), { type: type || '' });
    return res.json(docs);
  }
  let result = postedTx;
  if (accountNumber) result = result.filter(t => t.accountNumber === accountNumber);
  if (type) result = result.filter(t => t.kind === type);
  if (from) result = result.filter(t => t.approvedAt >= from);
  if (to) result = result.filter(t => t.approvedAt <= to);
  if (id) { const s = String(id).toLowerCase(); result = result.filter(t => String(t.id || '').toLowerCase().includes(s)); }
  await logActivity(req, 'statements.view', 'transactions', String(accountNumber || ''), { type: type || '' });
  res.json(result);
});
function addPending(kind) {
  return async (req, res) => {
    const body = req.body || {};
    const amountNum = Number(body.amount);
    if (kind === 'withdraw') {
      const bal = await computeAccountBalance(body.accountNumber);
      if (amountNum > bal) {
        await logActivity(req, 'txn.withdraw.create.blocked', 'transaction', '', { accountNumber: body.accountNumber, amount: amountNum, available: bal });
        return res.status(400).json({ error: 'insufficient_funds', available: bal });
      }
    }
    const txn = {
      id: body.id || newTxnId(kind),
      kind, // 'deposit' | 'withdraw'
      status: 'Pending',
      initiatorName: body.initiatorName || 'api',
      initiatedAt: body.initiatedAt || new Date().toISOString(),
      accountNumber: body.accountNumber,
      amount: body.amount,
      meta: body.meta || {},
    };
    if (isConnected()) {
      const { PendingTxn } = getModels();
      await PendingTxn.create(txn);
    } else {
      pendingTx.unshift(txn);
      writeJSON(PENDING_TX_FILE, pendingTx);
    }
    const io = req.app.get('io');
    if (io) io.emit('transactions:pending:new', txn);
    await logActivity(req, kind === 'deposit' ? 'txn.deposit.create' : 'txn.withdraw.create', 'transaction', txn.id, { accountNumber: txn.accountNumber, amount: txn.amount });
    res.status(201).json(txn);
  };
}
app.post('/transactions/deposit', addPending('deposit'));
app.post('/transactions/withdraw', addPending('withdraw'));
app.post('/transactions/pending/:id/approve', async (req, res) => {
  const id = req.params.id;
  let txn = null;
  if (isConnected()) {
    const { PendingTxn, PostedTxn, LoanRepayPosted } = getModels();
    if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
    if (!canApproveTxn(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    const code = req.body && req.body.approvalCode;
    if (!code) return res.status(400).json({ error: 'approval_code_required' });
    if (!verifyApprovalCode(req.user.username, code)) {
      await logActivity(req, 'approval.code.invalid', 'transaction', id, {});
      return res.status(401).json({ error: 'approval_code_invalid' });
    }
    txn = await PendingTxn.findOne({ id }).lean();
    if (!txn) return res.status(404).json({ error: 'not found' });
    if (txn.kind === 'withdraw') {
      // Recompute balance at approval time
      const bal = await computeAccountBalance(txn.accountNumber);
      if (Number(txn.amount) > bal) {
        await logActivity(req, 'txn.approve.blocked', 'transaction', id, { accountNumber: txn.accountNumber, amount: txn.amount, available: bal });
        return res.status(400).json({ error: 'insufficient_funds', available: bal });
      }
    }
    await PendingTxn.deleteOne({ id });
    const posted = {
      ...txn,
      approvedAt: new Date().toISOString(),
      approverName: (req.body && req.body.approverName) || 'api',
      status: 'Approved',
    };
    await PostedTxn.create(posted);
    const io = req.app.get('io');
    if (io) io.emit('transactions:posted:new', posted);
    await logActivity(req, 'txn.approve', 'transaction', id, { accountNumber: posted.accountNumber, amount: posted.amount });
    return res.json(posted);
  }
  const idx = pendingTx.findIndex(t => t.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  txn = pendingTx[idx];
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canApproveTxn(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const code = req.body && req.body.approvalCode;
  if (!code) return res.status(400).json({ error: 'approval_code_required' });
  if (!verifyApprovalCode(req.user.username, code)) {
    await logActivity(req, 'approval.code.invalid', 'transaction', id, {});
    return res.status(401).json({ error: 'approval_code_invalid' });
  }
  if (txn.kind === 'withdraw') {
    const bal = await computeAccountBalance(txn.accountNumber);
    if (Number(txn.amount) > bal) {
      await logActivity(req, 'txn.approve.blocked', 'transaction', id, { accountNumber: txn.accountNumber, amount: txn.amount, available: bal });
      return res.status(400).json({ error: 'insufficient_funds', available: bal });
    }
  }
  pendingTx.splice(idx, 1);
  const posted = {
    ...txn,
    approvedAt: new Date().toISOString(),
    approverName: (req.body && req.body.approverName) || 'api',
    status: 'Approved',
  };
  postedTx.unshift(posted);
  writeJSON(PENDING_TX_FILE, pendingTx);
  writeJSON(POSTED_TX_FILE, postedTx);
  const io = req.app.get('io');
  if (io) io.emit('transactions:posted:new', posted);
  await logActivity(req, 'txn.approve', 'transaction', id, { accountNumber: posted.accountNumber, amount: posted.amount });
  res.json(posted);
});
app.post('/transactions/pending/:id/reject', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { PendingTxn, SuperBin } = getModels();
    const txn = await PendingTxn.findOneAndDelete({ id }).lean();
    if (!txn) return res.status(404).json({ error: 'not found' });
    const item = await SuperBin.create({
      by: (req.body && req.body.by) || 'api',
      deletedAt: new Date(),
      kind: 'pending_txn',
      payload: { ...txn, reason: (req.body && req.body.reason) || '' },
    });
    const io = req.app.get('io');
    if (io) io.emit('transactions:pending:rejected', txn);
    await logActivity(req, 'txn.reject', 'transaction', id, {});
    return res.json({ ok: true, item });
  }
  const idx = pendingTx.findIndex(t => t.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [txn] = pendingTx.splice(idx, 1);
  writeJSON(PENDING_TX_FILE, pendingTx);
  const item = {
    id: newId('BIN'),
    by: (req.body && req.body.by) || 'api',
    deletedAt: new Date().toISOString(),
    kind: 'pending_txn',
    payload: { ...txn, reason: (req.body && req.body.reason) || '' },
  };
  superBin.unshift(item);
  writeJSON(BIN_FILE, superBin);
  const io = req.app.get('io');
  if (io) io.emit('transactions:pending:rejected', txn);
  await logActivity(req, 'txn.reject', 'transaction', id, {});
  res.json({ ok: true, item });
});

// Loans and approvals
app.get('/loans', async (req, res) => {
  const { accountNumber, status } = req.query;
  if (isConnected()) {
    const { Loan } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (status) filter.status = status;
    const docs = await Loan.find(filter).sort({ createdAt: -1, _id: -1 }).lean();
    return res.json(docs);
  }
  let result = loans;
  if (accountNumber) result = result.filter(l => l.accountNumber === accountNumber);
  if (status) result = result.filter(l => l.status === status);
  res.json(result);
});
app.get('/loans/approvals', async (req, res) => {
  if (isConnected()) {
    const { Loan } = getModels();
    const docs = await Loan.find({ status: 'Pending' }).sort({ createdAt: -1, _id: -1 }).lean();
    return res.json(docs);
  }
  res.json(loans.filter(l => l.status === 'Pending'));
});
app.post('/loans', async (req, res) => {
  const body = req.body || {};
  const rateNum = Number(body.rate || 0);
  const principalNum = Number(body.principal || 0);
  const monthsNum = Number(body.termMonths || 0);
  const totalInterest = Math.max(0, (principalNum * (rateNum / 100) * (monthsNum / 12)));
  const loan = {
    id: body.id || newLoanId(),
    accountNumber: body.accountNumber,
    principal: principalNum,
    rate: rateNum || 0,
    termMonths: monthsNum || 0,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalDue: Math.round((principalNum + totalInterest) * 100) / 100,
    guarantors: body.guarantors || [],
    collateral: body.collateral || {},
    attachments: body.attachments || [],
    createdAt: new Date().toISOString(),
    status: 'Pending',
  };
  try {
    let c = null;
    if (isConnected()) {
      const { Client } = getModels();
      c = await Client.findOne({ accountNumber: loan.accountNumber }).lean();
    } else {
      c = clients.find(x => x.accountNumber === loan.accountNumber);
    }
    if (!c) return res.status(400).json({ error: 'client_not_found' });
    const cp = String(c.phone || c.companyPhone || '').trim();
    const cid = String(c.nationalId || c.registrationNumber || '').trim();
    const g1p = String(body.guarantor1?.phone || body.g1Phone || '').trim();
    const g1id = String(body.guarantor1?.id || body.g1Id || '').trim();
    const g2p = String(body.guarantor2?.phone || body.g2Phone || '').trim();
    const g2id = String(body.guarantor2?.id || body.g2Id || '').trim();
    const phones = [cp, g1p, g2p].filter(Boolean);
    const idsSet = [cid, g1id, g2id].filter(Boolean);
    if (hasDuplicates(phones)) return res.status(400).json({ error: 'duplicate_contact', field: 'phone' });
    if (hasDuplicates(idsSet)) return res.status(400).json({ error: 'duplicate_contact', field: 'id' });
  } catch (e) {
    return res.status(500).json({ error: 'validation_failed' });
  }
  if (isConnected()) {
    const { Loan } = getModels();
    await Loan.create(loan);
  } else {
    loans.unshift(loan);
    writeJSON(LOANS_FILE, loans);
  }
  const io = req.app.get('io');
  if (io) io.emit('loans:pending:new', loan);
  await logActivity(req, 'loan.create', 'loan', loan.id, { accountNumber: loan.accountNumber, amount: loan.principal });
  res.status(201).json(loan);
});
app.post('/loans/:id/approve', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { Loan, PostedTxn } = getModels();
    if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
    if (!canApproveLoan(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    const code = req.body && req.body.approvalCode;
    if (!code) return res.status(400).json({ error: 'approval_code_required' });
    if (!verifyApprovalCode(req.user.username, code)) {
      await logActivity(req, 'approval.code.invalid', 'loan', id, {});
      return res.status(401).json({ error: 'approval_code_invalid' });
    }
    const loan = await Loan.findOneAndUpdate({ id }, { $set: { status: 'Active', approvedAt: new Date().toISOString(), approverName: 'api' } }, { new: true }).lean();
    if (!loan) return res.status(404).json({ error: 'not found' });
    const disbursed = {
      id: newTxnId('loan_disbursement'),
      kind: 'loan_disbursement',
      status: 'Approved',
      initiatorName: 'api',
      initiatedAt: loan.createdAt || new Date().toISOString(),
      accountNumber: loan.accountNumber,
      amount: loan.principal,
      approverName: 'api',
      approvedAt: loan.approvedAt,
      meta: { loanId: loan.id, rate: loan.rate || 0, termMonths: loan.termMonths || 0 },
    };
    await PostedTxn.create(disbursed);
    const io = req.app.get('io');
    if (io) {
      io.emit('loans:approved', loan);
      io.emit('transactions:posted:new', disbursed);
    }
    await logActivity(req, 'loan.approve', 'loan', id, {});
    return res.json(loan);
  }
  const idx = loans.findIndex(l => l.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canApproveLoan(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const code = req.body && req.body.approvalCode;
  if (!code) return res.status(400).json({ error: 'approval_code_required' });
  if (!verifyApprovalCode(req.user.username, code)) {
    await logActivity(req, 'approval.code.invalid', 'loan', id, {});
    return res.status(401).json({ error: 'approval_code_invalid' });
  }
  loans[idx] = { ...loans[idx], status: 'Active', approvedAt: new Date().toISOString(), approverName: 'api' };
  const loan = loans[idx];
  const disbursed = {
    id: newTxnId('loan_disbursement'),
    kind: 'loan_disbursement',
    status: 'Approved',
    initiatorName: 'api',
    initiatedAt: loan.createdAt || new Date().toISOString(),
    accountNumber: loan.accountNumber,
    amount: loan.principal,
    approverName: 'api',
    approvedAt: loan.approvedAt,
    meta: { loanId: loan.id, rate: loan.rate || 0, termMonths: loan.termMonths || 0 },
  };
  postedTx.unshift(disbursed);
  writeJSON(POSTED_TX_FILE, postedTx);
  writeJSON(LOANS_FILE, loans);
  const io = req.app.get('io');
  if (io) {
    io.emit('loans:approved', loan);
    io.emit('transactions:posted:new', disbursed);
  }
  await logActivity(req, 'loan.approve', 'loan', id, {});
  res.json(loans[idx]);
});
app.post('/loans/:id/reject', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { Loan, SuperBin } = getModels();
    const loan = await Loan.findOneAndDelete({ id }).lean();
    if (!loan) return res.status(404).json({ error: 'not found' });
    const item = await SuperBin.create({
      by: 'api',
      deletedAt: new Date(),
      kind: 'loan',
      payload: { ...loan, reason: (req.body && req.body.reason) || '' },
    });
    const io = req.app.get('io');
    if (io) io.emit('loans:rejected', loan);
    await logActivity(req, 'loan.reject', 'loan', id, {});
    return res.json({ ok: true, item });
  }
  const idx = loans.findIndex(l => l.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [loan] = loans.splice(idx, 1);
  writeJSON(LOANS_FILE, loans);
  const item = {
    id: newId('BIN'),
    by: 'api',
    deletedAt: new Date().toISOString(),
    kind: 'loan',
    payload: { ...loan, reason: (req.body && req.body.reason) || '' },
  };
  superBin.unshift(item);
  writeJSON(BIN_FILE, superBin);
  const io = req.app.get('io');
  if (io) io.emit('loans:rejected', loan);
  await logActivity(req, 'loan.reject', 'loan', id, {});
  res.json({ ok: true, item });
});

// Loan repayments with two-step approvals
app.get('/loans/repay/pending', async (req, res) => {
  if (isConnected()) {
    const { LoanRepayPending } = getModels();
    const docs = await LoanRepayPending.find().sort({ initiatedAt: -1, _id: -1 }).lean();
    return res.json(docs);
  }
  return res.json(loanRepayPending);
});
app.get('/loans/repay/posted', async (req, res) => {
  const { accountNumber, id } = req.query;
  if (isConnected()) {
    const { LoanRepayPosted } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (id) filter.id = { $regex: String(id), $options: 'i' };
    const docs = await LoanRepayPosted.find(filter).sort({ approvedAt: -1, _id: -1 }).lean();
    await logActivity(req, 'statements.view', 'loan_repay', String(accountNumber || ''), {});
    return res.json(docs);
  }
  let result = loanRepayPosted;
  if (accountNumber) result = result.filter(r => r.accountNumber === accountNumber);
  if (id) { const s = String(id).toLowerCase(); result = result.filter(r => String(r.id || '').toLowerCase().includes(s)); }
  await logActivity(req, 'statements.view', 'loan_repay', String(accountNumber || ''), {});
  res.json(result);
});
app.post('/loans/:id/repay', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { Loan, LoanRepayPending } = getModels();
    const loan = await Loan.findOne({ id }).lean();
    if (!loan) return res.status(404).json({ error: 'loan not found' });
    const body = req.body || {};
    const r = {
      id: newRepayId(),
      loanId: id,
      accountNumber: loan.accountNumber,
      mode: body.mode, // full | partial | writeoff
      amount: body.amount || 0,
      initiatorName: body.initiatorName || 'api',
      initiatedAt: new Date().toISOString(),
      status: 'Pending',
    };
    await LoanRepayPending.create(r);
    const io = req.app.get('io');
    if (io) io.emit('loans:repay:pending:new', r);
    await logActivity(req, 'loan.repay.create', 'loan_repay', r.id, { accountNumber: r.accountNumber, amount: r.amount });
    return res.status(201).json(r);
  }
  const loan = loans.find(l => l.id === id);
  if (!loan) return res.status(404).json({ error: 'loan not found' });
  const body = req.body || {};
  const r = {
    id: newId('LRP'),
    loanId: id,
    accountNumber: loan.accountNumber,
    mode: body.mode, // full | partial | writeoff
    amount: body.amount || 0,
    initiatorName: body.initiatorName || 'api',
    initiatedAt: new Date().toISOString(),
    status: 'Pending',
  };
  loanRepayPending.unshift(r);
  writeJSON(LOAN_REPAY_PENDING_FILE, loanRepayPending);
  const io = req.app.get('io');
  if (io) io.emit('loans:repay:pending:new', r);
  await logActivity(req, 'loan.repay.create', 'loan_repay', r.id, { accountNumber: r.accountNumber, amount: r.amount });
  res.status(201).json(r);
});
app.post('/loans/repay/pending/:id/approve', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { LoanRepayPending, LoanRepayPosted } = getModels();
    if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
    if (!canApproveRepay(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    const code = req.body && req.body.approvalCode;
    if (!code) return res.status(400).json({ error: 'approval_code_required' });
    if (!verifyApprovalCode(req.user.username, code)) {
      await logActivity(req, 'approval.code.invalid', 'loan_repay', id, {});
      return res.status(401).json({ error: 'approval_code_invalid' });
    }
    const r = await LoanRepayPending.findOneAndDelete({ id }).lean();
    if (!r) return res.status(404).json({ error: 'not found' });
    const posted = { ...r, status: 'Approved', approvedAt: new Date().toISOString(), approverName: 'api' };
    await LoanRepayPosted.create(posted);
    const io = req.app.get('io');
    if (io) io.emit('loans:repay:posted:new', posted);
    await logActivity(req, 'loan.repay.approve', 'loan_repay', id, { accountNumber: posted.accountNumber, amount: posted.amount });
    return res.json(posted);
  }
  const idx = loanRepayPending.findIndex(r => r.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canApproveRepay(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const code = req.body && req.body.approvalCode;
  if (!code) return res.status(400).json({ error: 'approval_code_required' });
  if (!verifyApprovalCode(req.user.username, code)) {
    await logActivity(req, 'approval.code.invalid', 'loan_repay', id, {});
    return res.status(401).json({ error: 'approval_code_invalid' });
  }
  const [r] = loanRepayPending.splice(idx, 1);
  const posted = { ...r, status: 'Approved', approvedAt: new Date().toISOString(), approverName: 'api' };
  loanRepayPosted.unshift(posted);
  writeJSON(LOAN_REPAY_PENDING_FILE, loanRepayPending);
  writeJSON(LOAN_REPAY_POSTED_FILE, loanRepayPosted);
  const io = req.app.get('io');
  if (io) io.emit('loans:repay:posted:new', posted);
  await logActivity(req, 'loan.repay.approve', 'loan_repay', id, { accountNumber: posted.accountNumber, amount: posted.amount });
  res.json(posted);
});
app.post('/loans/repay/pending/:id/reject', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { LoanRepayPending, SuperBin } = getModels();
    const r = await LoanRepayPending.findOneAndDelete({ id }).lean();
    if (!r) return res.status(404).json({ error: 'not found' });
    const item = await SuperBin.create({
      id: newId('BIN'),
      by: 'api',
      deletedAt: new Date(),
      kind: 'loan_repay',
      payload: { ...r, reason: (req.body && req.body.reason) || '' },
    });
    const io = req.app.get('io');
    if (io) io.emit('loans:repay:pending:rejected', r);
    await logActivity(req, 'loan.repay.reject', 'loan_repay', id, {});
    return res.json({ ok: true, item });
  }
  const idx = loanRepayPending.findIndex(r => r.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [r] = loanRepayPending.splice(idx, 1);
  writeJSON(LOAN_REPAY_PENDING_FILE, loanRepayPending);
  const item = {
    id: newId('BIN'),
    by: 'api',
    deletedAt: new Date().toISOString(),
    kind: 'loan_repay',
    payload: { ...r, reason: (req.body && req.body.reason) || '' },
  };
  superBin.unshift(item);
  writeJSON(BIN_FILE, superBin);
  const io = req.app.get('io');
  if (io) io.emit('loans:repay:pending:rejected', r);
  await logActivity(req, 'loan.repay.reject', 'loan_repay', id, {});
  res.json({ ok: true, item });
});

app.get('/activity', requireAdmin, async (req, res) => {
  const { actor, action, entity, q, from, to, limit = '200' } = req.query || {};
  const lim = Math.max(1, Math.min(parseInt(String(limit), 10) || 200, 1000));
  if (isConnected()) {
    const { ActivityLog } = getModels();
    const filter = {};
    if (actor) filter.actor = { $regex: String(actor), $options: 'i' };
    if (action) filter.action = { $regex: String(action), $options: 'i' };
    if (entity) filter.entityType = { $regex: String(entity), $options: 'i' };
    if (q) {
      const s = String(q);
      filter.$or = [
        { actor: { $regex: s, $options: 'i' } },
        { action: { $regex: s, $options: 'i' } },
        { entityType: { $regex: s, $options: 'i' } },
        { entityId: { $regex: s, $options: 'i' } },
      ];
    }
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = new Date(from);
      if (to) filter.ts.$lte = new Date(to);
    }
    const docs = await ActivityLog.find(filter).sort({ ts: -1, _id: -1 }).limit(lim).lean();
    return res.json(docs);
  }
  let list = activity.slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  if (actor) list = list.filter(x => String(x.actor || '').toLowerCase().includes(String(actor).toLowerCase()));
  if (action) list = list.filter(x => String(x.action || '').toLowerCase().includes(String(action).toLowerCase()));
  if (entity) list = list.filter(x => String(x.entityType || '').toLowerCase().includes(String(entity).toLowerCase()));
  if (q) {
    const s = String(q).toLowerCase();
    list = list.filter(x =>
      String(x.actor || '').toLowerCase().includes(s) ||
      String(x.action || '').toLowerCase().includes(s) ||
      String(x.entityType || '').toLowerCase().includes(s) ||
      String(x.entityId || '').toLowerCase().includes(s)
    );
  }
  if (from) list = list.filter(x => String(x.ts) >= String(from));
  if (to) list = list.filter(x => String(x.ts) <= String(to));
  res.json(list.slice(0, lim));
});

const port = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
  },
});
app.set('io', io);
io.on('connection', (socket) => {
  socket.emit('server:hello', { ts: new Date().toISOString() });
});
server.listen(port, () => {
  console.log(`smBank API listening on port ${port}`);
  console.log('socket running');
});
