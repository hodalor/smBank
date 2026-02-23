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
let multer = null;
let admin = null;
try { multer = require('multer'); } catch {}
try { admin = require('firebase-admin'); } catch {}

dotenv.config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));

let fb = { ready: false, bucket: null };
if (admin && process.env.FB_PROJECT_ID && process.env.FB_CLIENT_EMAIL && process.env.FB_PRIVATE_KEY && process.env.FB_STORAGE_BUCKET) {
  try {
    const pk = String(process.env.FB_PRIVATE_KEY).replace(/\\n/g, '\n');
    const cred = admin.credential.cert({
      projectId: process.env.FB_PROJECT_ID,
      clientEmail: process.env.FB_CLIENT_EMAIL,
      privateKey: pk,
    });
    if (!admin.apps || !admin.apps.length) {
      admin.initializeApp({ credential: cred, storageBucket: process.env.FB_STORAGE_BUCKET });
    }
    fb.bucket = admin.storage().bucket(process.env.FB_STORAGE_BUCKET);
    fb.ready = true;
  } catch {}
}

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

app.use((req, res, next) => {
  try {
    if (req.path && req.path.startsWith('/server-logs')) return next();
    const started = Date.now();
    const actor = (req.user && req.user.username) || 'anon';
    const role = (req.user && req.user.role) || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const params = req.params || {};
    const query = req.query || {};
    const body = (() => {
      const b = req.body && typeof req.body === 'object' ? { ...req.body } : null;
      if (!b) return b;
      ['password', 'approvalCode', 'token'].forEach(k => { if (Object.prototype.hasOwnProperty.call(b, k)) b[k] = '***'; });
      return b;
    })();
    res.on('finish', async () => {
      try {
        const entry = {
          id: newId('LOG'),
          ts: new Date().toISOString(),
          level: res.statusCode >= 500 ? 'error' : 'info',
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Date.now() - started,
          actor,
          role,
          ip,
          ua,
          params,
          query,
          body,
        };
        if (isConnected()) {
          const { ServerLog } = getModels();
          await ServerLog.create({ ...entry, id: undefined });
        } else {
          serverLogs.unshift(entry);
          if (serverLogs.length > 5000) serverLogs = serverLogs.slice(0, 5000);
          writeJSON(SERVER_LOGS_FILE, serverLogs);
        }
      } catch {}
    });
  } catch {}
  next();
});

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
  serviceFeeRate: 0,
  adminFeeRate: 0,
  commitmentFeeRate: 0,
  withdrawalFeeRate: 0,
  loanOverdueGraceDays: 0,
  loanOverdueDailyPenaltyRate: 0,
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

const SERVER_LOGS_FILE = 'server_logs.json';
let serverLogs = readJSON(SERVER_LOGS_FILE, []);

const NOTIFICATIONS_FILE = 'notifications.json';
let notifications = readJSON(NOTIFICATIONS_FILE, []);

// Helpers
function newId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`;
}
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_GRACE_DAYS = 3;
function validatePasswordPolicy(pw) {
  const s = String(pw || '');
  if (s.length < PASSWORD_MIN_LENGTH) return { ok: false, code: 'too_short', details: String(PASSWORD_MIN_LENGTH) };
  if (!/[A-Z]/.test(s)) return { ok: false, code: 'no_upper' };
  if (!/[a-z]/.test(s)) return { ok: false, code: 'no_lower' };
  if (!/[0-9]/.test(s)) return { ok: false, code: 'no_digit' };
  if (!/[^A-Za-z0-9]/.test(s)) return { ok: false, code: 'no_special' };
  return { ok: true };
}
async function isPasswordReused(newPw, doc) {
  if (!doc) return false;
  const hashes = [];
  if (doc.passwordHash) hashes.push(doc.passwordHash);
  const hist = Array.isArray(doc.passwordHistory) ? doc.passwordHistory : [];
  for (const h of hist.slice(0, 5)) hashes.push(h);
  for (const h of hashes) {
    try { if (await bcrypt.compare(String(newPw), h)) return true; } catch {}
  }
  return false;
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
function normalizePhone(p) {
  let s = String(p || '').trim();
  s = s.replace(/\s+/g, '');
  if (!s) return '';
  if (s.startsWith('+')) return s;
  const cc = String(process.env.SMS_DEFAULT_COUNTRY_CODE || '').trim();
  if (cc) {
    if (s.startsWith('0')) return `+${cc}${s.slice(1)}`;
    if (/^\d+$/.test(s)) return `+${cc}${s}`;
  }
  return s;
}
async function sendSMS(to, text) {
  const provider = String(process.env.SMS_PROVIDER || '').toLowerCase();
  const dest = normalizePhone(to);
  if (!dest || !text) return { ok: false, skipped: true };
  if (provider === 'twilio') {
    const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = String(process.env.TWILIO_FROM || '').trim();
    if (!sid || !token || !from) return { ok: false, error: 'twilio_env_missing' };
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({ From: from, To: dest, Body: String(text) }).toString();
    try {
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!resp.ok) {
        const t = await resp.text();
        return { ok: false, status: resp.status, text: t };
        }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  }
  return { ok: false, error: 'provider_unsupported' };
}
async function sendBulkSMS(numbers, message, opts = {}) {
  const results = [];
  for (const n of numbers) {
    try {
      const r = await sendSMS(n, message);
      results.push({ to: n, ...r });
      try {
        await logNotification({
          channel: 'sms',
          type: opts.type || '',
          sender: opts.sender || '',
          receiver: n,
          subject: '',
          message: String(message || ''),
          status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
          error: r.error || r.text || '',
          campaignId: opts.campaignId || '',
          entityType: opts.entityType || '',
          entityId: opts.entityId || '',
          originalId: opts.originalId || '',
        });
      } catch {}
    } catch {
      results.push({ to: n, ok: false, error: 'send_failed' });
      try {
        await logNotification({
          channel: 'sms',
          type: opts.type || '',
          sender: opts.sender || '',
          receiver: n,
          subject: '',
          message: String(message || ''),
          status: 'failed',
          error: 'send_failed',
          campaignId: opts.campaignId || '',
          entityType: opts.entityType || '',
          entityId: opts.entityId || '',
          originalId: opts.originalId || '',
        });
      } catch {}
    }
  }
  return results;
}
async function logNotification(item) {
  const data = {
    id: item.id || newId('NTF'),
    ts: item.ts || new Date(),
    channel: item.channel || '',
    type: item.type || '',
    sender: item.sender || '',
    receiver: item.receiver || '',
    subject: item.subject || '',
    message: item.message || '',
    status: item.status || '',
    error: item.error || '',
    campaignId: item.campaignId || '',
    entityType: item.entityType || '',
    entityId: item.entityId || '',
    originalId: item.originalId || '',
  };
  if (isConnected()) {
    try {
      const { Notification } = getModels();
      await Notification.create(data);
      return data;
    } catch {}
  }
  const record = { ...data, ts: data.ts.toISOString ? data.ts.toISOString() : String(data.ts) };
  notifications.unshift(record);
  if (notifications.length > 5000) notifications = notifications.slice(0, 5000);
  writeJSON(NOTIFICATIONS_FILE, notifications);
  return record;
}
async function sendEmail(to, subject, text) {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim() || 'no-reply@smbank.local';
  if (!host || !port || !user || !pass) return { ok: false, error: 'smtp_env_missing' };
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const info = await transporter.sendMail({ from, to, subject: String(subject || ''), text: String(text || '') });
    return { ok: true, messageId: info && info.messageId ? info.messageId : '' };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}
async function sendBulkEmail(addresses, subject, text, opts = {}) {
  const out = [];
  for (const a of addresses) {
    try {
      const r = await sendEmail(a, subject, text);
      out.push({ to: a, ...r });
      try {
        await logNotification({
          channel: 'email',
          type: opts.type || '',
          sender: opts.sender || '',
          receiver: a,
          subject: String(subject || ''),
          message: String(text || ''),
          status: r.ok ? 'sent' : 'failed',
          error: r.error || '',
          campaignId: opts.campaignId || '',
          entityType: opts.entityType || '',
          entityId: opts.entityId || '',
          originalId: opts.originalId || '',
        });
      } catch {}
    } catch {
      out.push({ to: a, ok: false, error: 'send_failed' });
      try {
        await logNotification({
          channel: 'email',
          type: opts.type || '',
          sender: opts.sender || '',
          receiver: a,
          subject: String(subject || ''),
          message: String(text || ''),
          status: 'failed',
          error: 'send_failed',
          campaignId: opts.campaignId || '',
          entityType: opts.entityType || '',
          entityId: opts.entityId || '',
          originalId: opts.originalId || '',
        });
      } catch {}
    }
  }
  return out;
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
function canManageAccounts(role) {
  const r = String(role || '');
  return r === 'Admin' || r === 'Super Admin' || r === 'Account Manager';
}
function canManageAssets(role) {
  const r = String(role || '');
  return r === 'Admin' || r === 'Super Admin';
}
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

const ASSETS_FILE = 'assets.json';
let assets = readJSON(ASSETS_FILE, []);
const upload = multer ? multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }) : null;

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), db: isConnected(), media: !!(fb && fb.ready), bucket: fb && fb.bucket ? fb.bucket.name : '' });
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
    // Password expiry and must-change enforcement with grace
    const nowDate = new Date();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const pwdAt = existing.passwordUpdatedAt ? new Date(existing.passwordUpdatedAt) : null;
    const mustChange = !!existing.passwordMustChange;
    let mustChangeFlag = null;
    if (mustChange) {
      await logActivity({ ...req, user: { username: uname, role: existing.role || 'Admin' } }, 'login.password_must_change', 'auth', uname, { mustChange: true });
      mustChangeFlag = { passwordChangeRequired: true };
    }
    let grace = null;
    if (pwdAt) {
      const expiresAt = new Date(pwdAt.getTime() + thirtyDaysMs);
      const graceUntil = new Date(expiresAt.getTime() + PASSWORD_GRACE_DAYS * 24 * 60 * 60 * 1000);
      if (nowDate > expiresAt) {
        if (nowDate <= graceUntil) {
          grace = { passwordGrace: true, passwordGraceUntil: graceUntil.toISOString(), passwordChangeRequired: true };
        } else {
          await logActivity({ ...req, user: { username: uname, role: existing.role || 'Admin' } }, 'login.password_expired', 'auth', uname, { expired: true });
          return res.status(403).json({ error: 'password_expired' });
        }
      }
    }
    const role = existing.role || 'Admin';
    const now = Date.now();
    const token = createToken({ username: uname, role, iat: now, exp: now + 7 * 24 * 60 * 60 * 1000 }, process.env.JWT_SECRET || 'change-me');
    res.setHeader('Set-Cookie', `smbank_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
    await logActivity({ ...req, user: { username: uname, role } }, 'login', 'auth', uname, {});
    return res.json({ username: uname, role, token, ...(grace || {}), ...(mustChangeFlag || {}) });
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
        toCreate.passwordUpdatedAt = new Date();
        toCreate.passwordMustChange = false;
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
        doc.passwordUpdatedAt = new Date();
        doc.passwordMustChange = false;
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
  const { oldPassword, newPassword } = req.body || {};
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.username !== uname) return res.status(403).json({ error: 'forbidden' });
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'old_and_new_required' });
  const { User } = getModels();
  const doc = await User.findOne({ username: uname });
  if (!doc || !doc.passwordHash) return res.status(404).json({ error: 'not_found' });
  const ok = await bcrypt.compare(String(oldPassword), doc.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_old_password' });
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) return res.status(400).json({ error: 'weak_password', details: policy.code, minLen: PASSWORD_MIN_LENGTH });
  if (await isPasswordReused(newPassword, doc)) return res.status(400).json({ error: 'password_reused' });
  // push old hash to history, cap at 5
  const hist = Array.isArray(doc.passwordHistory) ? doc.passwordHistory : [];
  if (doc.passwordHash) hist.unshift(doc.passwordHash);
  doc.passwordHistory = hist.slice(0, 5);
  doc.passwordHash = await bcrypt.hash(String(newPassword), 10);
  doc.passwordUpdatedAt = new Date();
  doc.passwordMustChange = false;
  await doc.save();
  await logActivity(req, 'user.password_change', 'user', uname, { self: true });
  return res.json({ ok: true });
});

// Admin reset another user's password (requires admin approval code). Forces user to change on next login.
app.post('/users/:username/password/reset', async (req, res) => {
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  const target = req.params.username;
  const { newPassword, approvalCode } = req.body || {};
  if (!newPassword) return res.status(400).json({ error: 'password_required' });
  if (!approvalCode) return res.status(400).json({ error: 'approval_code_required' });
  if (!verifyApprovalCode(req.user.username, approvalCode)) return res.status(401).json({ error: 'approval_code_invalid' });
  const { User } = getModels();
  const doc = await User.findOne({ username: target });
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) return res.status(400).json({ error: 'weak_password', details: policy.code, minLen: PASSWORD_MIN_LENGTH });
  if (await isPasswordReused(newPassword, doc)) return res.status(400).json({ error: 'password_reused' });
  // history
  const hist = Array.isArray(doc.passwordHistory) ? doc.passwordHistory : [];
  if (doc.passwordHash) hist.unshift(doc.passwordHash);
  doc.passwordHistory = hist.slice(0, 5);
  doc.passwordHash = await bcrypt.hash(String(newPassword), 10);
  doc.passwordUpdatedAt = new Date();
  doc.passwordMustChange = true;
  await doc.save();
  await logActivity(req, 'user.password_reset', 'user', target, { by: req.user.username });
  return res.json({ ok: true });
});

// Public endpoint to change own password using old password (for expired password cases)
app.post('/auth/password/change', async (req, res) => {
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  const { username, oldPassword, newPassword } = req.body || {};
  if (!username || !oldPassword || !newPassword) return res.status(400).json({ error: 'username_old_new_required' });
  const { User } = getModels();
  const doc = await User.findOne({ username: String(username).trim() });
  if (!doc || !doc.passwordHash) return res.status(404).json({ error: 'not_found' });
  const ok = await bcrypt.compare(String(oldPassword), doc.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_old_password' });
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) return res.status(400).json({ error: 'weak_password', details: policy.code, minLen: PASSWORD_MIN_LENGTH });
  if (await isPasswordReused(newPassword, doc)) return res.status(400).json({ error: 'password_reused' });
  // history
  const hist = Array.isArray(doc.passwordHistory) ? doc.passwordHistory : [];
  if (doc.passwordHash) hist.unshift(doc.passwordHash);
  doc.passwordHistory = hist.slice(0, 5);
  doc.passwordHash = await bcrypt.hash(String(newPassword), 10);
  doc.passwordUpdatedAt = new Date();
  doc.passwordMustChange = false;
  await doc.save();
  await logActivity(req, 'auth.password_change', 'user', String(username), { via: 'public' });
  res.json({ ok: true });
});

// Public admin-assisted reset for locked-out users from the login page
app.post('/auth/password/reset-by-admin', async (req, res) => {
  if (!isConnected()) return res.status(503).json({ error: 'db_unavailable' });
  const { adminUsername, approvalCode, username, newPassword } = req.body || {};
  if (!adminUsername || !approvalCode || !username || !newPassword) return res.status(400).json({ error: 'fields_required' });
  const { User } = getModels();
  const adminDoc = await User.findOne({ username: String(adminUsername).trim() });
  if (!adminDoc) return res.status(404).json({ error: 'admin_not_found' });
  const role = String(adminDoc.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  if (!verifyApprovalCode(adminUsername, approvalCode)) return res.status(401).json({ error: 'approval_code_invalid' });
  const doc = await User.findOne({ username: String(username).trim() });
  if (!doc) return res.status(404).json({ error: 'not_found' });
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.ok) return res.status(400).json({ error: 'weak_password', details: policy.code, minLen: PASSWORD_MIN_LENGTH });
  if (await isPasswordReused(newPassword, doc)) return res.status(400).json({ error: 'password_reused' });
  const hist = Array.isArray(doc.passwordHistory) ? doc.passwordHistory : [];
  if (doc.passwordHash) hist.unshift(doc.passwordHash);
  doc.passwordHistory = hist.slice(0, 5);
  doc.passwordHash = await bcrypt.hash(String(newPassword), 10);
  doc.passwordUpdatedAt = new Date();
  doc.passwordMustChange = true;
  await doc.save();
  await logActivity({ ...req, user: { username: adminUsername, role } }, 'auth.password_reset_public', 'user', String(username), { admin: adminUsername });
  res.json({ ok: true });
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
app.post('/notify/test-sms', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  const { to, message } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'to_and_message_required' });
  const r = await sendSMS(to, message);
  try {
    await logNotification({
      channel: 'sms',
      type: 'test',
      sender: (req.user && req.user.username) || 'api',
      receiver: to,
      subject: '',
      message: String(message || ''),
      status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
      error: r.error || r.status || '',
      entityType: 'notify',
      entityId: '',
    });
  } catch {}
  if (!r.ok) return res.status(400).json({ error: 'send_failed', details: r.error || r.status || '' });
  await logActivity(req, 'notify.sms.test', 'notify', '', {});
  res.json({ ok: true });
});
app.post('/notify/email/test', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  const { to, subject, text } = req.body || {};
  if (!to || !subject || !text) return res.status(400).json({ error: 'to_subject_text_required' });
  const r = await sendEmail(to, subject, text);
  try {
    await logNotification({
      channel: 'email',
      type: 'test',
      sender: (req.user && req.user.username) || 'api',
      receiver: to,
      subject: String(subject || ''),
      message: String(text || ''),
      status: r.ok ? 'sent' : 'failed',
      error: r.error || '',
      entityType: 'notify',
      entityId: '',
    });
  } catch {}
  if (!r.ok) return res.status(400).json({ error: 'send_failed', details: r.error || '' });
  await logActivity(req, 'notify.email.test', 'notify', '', {});
  res.json({ ok: true });
});
app.post('/notify/promotions', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  const { message, numbers, segment, filters } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message_required' });
  let dest = [];
  if (Array.isArray(numbers) && numbers.length) {
    dest = numbers.map(x => String(x || '').trim()).filter(Boolean);
  } else if (String(segment || '') === 'all-clients') {
    if (isConnected()) {
      const { Client } = getModels();
      const docs = await Client.find({}, { phone: 1, companyPhone: 1 }).lean();
      dest = docs.map(d => d.phone || d.companyPhone).filter(Boolean);
    } else {
      dest = (clients || []).map(c => c.phone || c.companyPhone).filter(Boolean);
    }
  } else if (String(segment || '') === 'filtered-clients' || (filters && typeof filters === 'object')) {
    const f = filters || {};
    const bCode = String(f.branchCode || '').trim();
    const aCode = String(f.accountTypeCode || '').trim();
    const mgr = String(f.manager || '').trim();
    const activeStatus = String(f.activeStatus || '').trim();
    const branchCodes = Array.isArray(f.branchCodes) ? f.branchCodes.map(x => String(x || '').trim()).filter(Boolean) : [];
    const accountTypeCodes = Array.isArray(f.accountTypeCodes) ? f.accountTypeCodes.map(x => String(x || '').trim()).filter(Boolean) : [];
    if (isConnected()) {
      const { Client, Config } = getModels();
      let bank = config.bankCode;
      try {
        const cfg = await Config.findOne().lean();
        bank = (cfg && cfg.bankCode) || bank;
      } catch {}
      const pad = (s, n) => String(s || '').replace(/\D/g, '').padStart(n, '0').slice(-n);
      const bankPad = pad(bank, 2);
      const regexes = [];
      if (branchCodes.length && accountTypeCodes.length) {
        for (const b of branchCodes) for (const a of accountTypeCodes) regexes.push(new RegExp(`^${bankPad}${pad(b, 3)}${pad(a, 2)}`));
      } else if (branchCodes.length) {
        for (const b of branchCodes) regexes.push(new RegExp(`^${bankPad}${pad(b, 3)}`));
      } else if (accountTypeCodes.length) {
        for (const a of accountTypeCodes) regexes.push(new RegExp(`^${bankPad}\\d{3}${pad(a, 2)}`));
      } else {
        const reStart = [bankPad];
        if (bCode) reStart.push(pad(bCode, 3));
        if (aCode && bCode) reStart.push(pad(aCode, 2));
        regexes.push(new RegExp(`^${reStart.join('')}`));
        if (aCode && !bCode) regexes.push(new RegExp(`^${bankPad}\\d{3}${pad(aCode, 2)}`));
      }
      const q = {};
      if (regexes.length === 1) q.accountNumber = { $regex: regexes[0] };
      if (regexes.length > 1) q.$or = regexes.map(r => ({ accountNumber: { $regex: r } }));
      if (mgr) q.manager = mgr;
      if (activeStatus) q.accountStatus = activeStatus;
      const docs = await Client.find(q, { phone: 1, companyPhone: 1, accountNumber: 1 }).lean();
      dest = docs.map(d => d.phone || d.companyPhone).filter(Boolean);
    } else {
      const pad = (s, n) => String(s || '').replace(/\D/g, '').padStart(n, '0').slice(-n);
      const bank = config.bankCode || '';
      const bankPad = pad(bank, 2);
      const bPad = bCode ? pad(bCode, 3) : '';
      const aPad = aCode ? pad(aCode, 2) : '';
      dest = (clients || []).filter(c => {
        if (mgr && String(c.manager || '') !== mgr) return false;
        if (activeStatus && String(c.accountStatus || c.status || '') !== activeStatus) return false;
        const num = String(c.accountNumber || '');
        if (!/^\d{13}$/.test(num)) return true; // fallback include if legacy
        if (Array.isArray(branchCodes) && branchCodes.length) {
          const matchBranch = branchCodes.some(b => num.startsWith(`${bankPad}${pad(b, 3)}`));
          if (!matchBranch) return false;
        } else if (bPad && !Array.isArray(branchCodes)) {
          if (!num.startsWith(`${bankPad}${bPad}`)) return false;
        }
        if (Array.isArray(accountTypeCodes) && accountTypeCodes.length) {
          const matchType = accountTypeCodes.some(a => new RegExp(`^${bankPad}\\d{3}${pad(a, 2)}`).test(num));
          if (!matchType) return false;
        } else if (aPad && !Array.isArray(accountTypeCodes)) {
          if (!new RegExp(`^${bankPad}\\d{3}${aPad}`).test(num)) return false;
        }
        return true;
      }).map(c => c.phone || c.companyPhone).filter(Boolean);
    }
  } else {
    return res.status(400).json({ error: 'numbers_or_segment_required' });
  }
  dest = Array.from(new Set(dest.map(n => String(n || '').trim()).filter(Boolean)));
  if (dest.length === 0) return res.status(400).json({ error: 'no_recipients' });
  const results = await sendBulkSMS(dest, String(message), { sender: (req.user && req.user.username) || 'api', type: 'promotion', entityType: 'notify' });
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  await logActivity(req, 'notify.sms.promotions', 'notify', '', { recipients: results.length, ok, fail });
  res.json({ ok: true, recipients: results.length, sent: ok, failed: fail });
});
app.post('/notify/email/promotions', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  const { subject, text, emails, segment, filters } = req.body || {};
  if (!subject || !text) return res.status(400).json({ error: 'subject_text_required' });
  let dest = [];
  if (Array.isArray(emails) && emails.length) {
    dest = emails.map(x => String(x || '').trim().toLowerCase()).filter(Boolean);
  } else if (String(segment || '') === 'all-clients' || String(segment || '') === 'filtered-clients' || (filters && typeof filters === 'object')) {
    const f = filters || {};
    const bCode = String(f.branchCode || '').trim();
    const aCode = String(f.accountTypeCode || '').trim();
    const mgr = String(f.manager || '').trim();
    const activeStatus = String(f.activeStatus || '').trim();
    const branchCodes = Array.isArray(f.branchCodes) ? f.branchCodes.map(x => String(x || '').trim()).filter(Boolean) : [];
    const accountTypeCodes = Array.isArray(f.accountTypeCodes) ? f.accountTypeCodes.map(x => String(x || '').trim()).filter(Boolean) : [];
    if (isConnected()) {
      const { Client, Config } = getModels();
      let bank = config.bankCode;
      try {
        const cfg = await Config.findOne().lean();
        bank = (cfg && cfg.bankCode) || bank;
      } catch {}
      const pad = (s, n) => String(s || '').replace(/\D/g, '').padStart(n, '0').slice(-n);
      const bankPad = pad(bank, 2);
      const regexes = [];
      if (branchCodes.length && accountTypeCodes.length) {
        for (const b of branchCodes) for (const a of accountTypeCodes) regexes.push(new RegExp(`^${bankPad}${pad(b, 3)}${pad(a, 2)}`));
      } else if (branchCodes.length) {
        for (const b of branchCodes) regexes.push(new RegExp(`^${bankPad}${pad(b, 3)}`));
      } else if (accountTypeCodes.length) {
        for (const a of accountTypeCodes) regexes.push(new RegExp(`^${bankPad}\\d{3}${pad(a, 2)}`));
      } else if (bCode || aCode) {
        const reStart = [bankPad];
        if (bCode) reStart.push(pad(bCode, 3));
        if (aCode && bCode) reStart.push(pad(aCode, 2));
        regexes.push(new RegExp(`^${reStart.join('')}`));
        if (aCode && !bCode) regexes.push(new RegExp(`^${bankPad}\\d{3}${pad(aCode, 2)}`));
      }
      const q = {};
      if (regexes.length === 1) q.accountNumber = { $regex: regexes[0] };
      if (regexes.length > 1) q.$or = regexes.map(r => ({ accountNumber: { $regex: r } }));
      if (mgr) q.manager = mgr;
      if (activeStatus) q.accountStatus = activeStatus;
      const docs = await Client.find(q, { data: 1 }).lean();
      for (const d of docs) {
        const contacts = collectContacts(d.data || {});
        for (const em of contacts.emails) dest.push(String(em || '').trim().toLowerCase());
      }
    } else {
      const pad = (s, n) => String(s || '').replace(/\D/g, '').padStart(n, '0').slice(-n);
      const bank = config.bankCode || '';
      const bankPad = pad(bank, 2);
      const bPad = bCode ? pad(bCode, 3) : '';
      const aPad = aCode ? pad(aCode, 2) : '';
      for (const c of (clients || [])) {
        if (mgr && String(c.manager || '') !== mgr) continue;
        if (activeStatus && String(c.accountStatus || c.status || '') !== activeStatus) continue;
        const num = String(c.accountNumber || '');
        if (/^\d{13}$/.test(num)) {
          if (Array.isArray(branchCodes) && branchCodes.length) {
            const matchBranch = branchCodes.some(b => num.startsWith(`${bankPad}${pad(b, 3)}`));
            if (!matchBranch) continue;
          } else if (bPad && !Array.isArray(branchCodes)) {
            if (!num.startsWith(`${bankPad}${bPad}`)) continue;
          }
          if (Array.isArray(accountTypeCodes) && accountTypeCodes.length) {
            const matchType = accountTypeCodes.some(a => new RegExp(`^${bankPad}\\d{3}${pad(a, 2)}`).test(num));
            if (!matchType) continue;
          } else if (aPad && !Array.isArray(accountTypeCodes)) {
            if (!new RegExp(`^${bankPad}\\d{3}${aPad}`).test(num)) continue;
          }
        }
        const contacts = collectContacts(c);
        for (const em of contacts.emails) dest.push(String(em || '').trim().toLowerCase());
      }
    }
  } else {
    return res.status(400).json({ error: 'emails_or_segment_required' });
  }
  dest = Array.from(new Set(dest.filter(Boolean)));
  if (dest.length === 0) return res.status(400).json({ error: 'no_recipients' });
  const results = await sendBulkEmail(dest, String(subject), String(text), { sender: (req.user && req.user.username) || 'api', type: 'promotion', entityType: 'notify' });
  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;
  await logActivity(req, 'notify.email.promotions', 'notify', '', { recipients: results.length, ok, fail });
  res.json({ ok: true, recipients: results.length, sent: ok, failed: fail });
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
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const role = String(req.user.role || '');
  if (!(role === 'Admin' || role === 'Super Admin')) return res.status(403).json({ error: 'forbidden' });
  if (isConnected()) {
    const { Config } = getModels();
    const body = { ...req.body };
    // Coerce numeric fields explicitly
    const numKeys = ['defaultLoanRate', 'serviceFeeRate', 'adminFeeRate', 'commitmentFeeRate', 'withdrawalFeeRate', 'lastCustomerSerial', 'loanOverdueGraceDays', 'loanOverdueDailyPenaltyRate'];
    numKeys.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(body, k)) body[k] = Number(body[k] ?? 0);
    });
    if (Array.isArray(body.accountTypes)) {
      body.accountTypes = body.accountTypes.map(a => ({
        code: String(a.code || '').trim(),
        name: String(a.name || '').trim(),
        supportsIndividual: a.supportsIndividual !== false,
        active: a.active !== false,
      }));
    }
    if (Array.isArray(body.branches)) {
      body.branches = body.branches.map(b => ({
        code: String(b.code || '').trim(),
        name: String(b.name || '').trim(),
        active: b.active !== false,
      }));
    }
    const saved = await Config.findOneAndUpdate({}, { $set: body }, { upsert: true, new: true });
    await logActivity(req, 'config.update', 'config', '', {});
    const obj = saved && saved.toObject ? saved.toObject() : saved;
    return res.json({ ...config, ...obj });
  }
  const body = { ...req.body };
  const numKeys = ['defaultLoanRate', 'serviceFeeRate', 'adminFeeRate', 'commitmentFeeRate', 'withdrawalFeeRate', 'lastCustomerSerial', 'loanOverdueGraceDays', 'loanOverdueDailyPenaltyRate'];
  numKeys.forEach(k => {
    if (Object.prototype.hasOwnProperty.call(body, k)) body[k] = Number(body[k] ?? 0);
  });
  if (Array.isArray(body.accountTypes)) {
    body.accountTypes = body.accountTypes.map(a => ({
      code: String(a.code || '').trim(),
      name: String(a.name || '').trim(),
      supportsIndividual: a.supportsIndividual !== false,
      active: a.active !== false,
    }));
  }
  if (Array.isArray(body.branches)) {
    body.branches = body.branches.map(b => ({
      code: String(b.code || '').trim(),
      name: String(b.name || '').trim(),
      active: b.active !== false,
    }));
  }
  config = { ...config, ...body };
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
function requireSuperAdmin(req, res, next) {
  if (req.user && String(req.user.role) === 'Super Admin') return next();
  return res.status(403).json({ error: 'forbidden' });
}
app.get('/super-bin', requireSuperBinAuth, async (req, res) => {
  if (isConnected()) {
    const { SuperBin } = getModels();
    const docs = await SuperBin.find().sort({ deletedAt: -1, _id: -1 }).lean();
    const list = (docs || []).map(d => ({
      id: String(d._id || d.id || ''),
      by: d.by || '',
      deletedAt: d.deletedAt instanceof Date ? d.deletedAt.toISOString() : (d.deletedAt || ''),
      kind: d.kind || 'unknown',
      payload: d.payload || {},
    }));
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
    const doc = await SuperBin.create({
      by: entry.by || 'api',
      deletedAt: new Date(),
      kind: entry.kind || 'unknown',
      payload: entry.payload || {},
    });
    const item = {
      id: String(doc && doc._id ? doc._id : ''),
      by: doc.by || '',
      deletedAt: doc.deletedAt instanceof Date ? doc.deletedAt.toISOString() : (doc.deletedAt || ''),
      kind: doc.kind || 'unknown',
      payload: doc.payload || {},
    };
    await logActivity(req, 'superbin.add', 'superbin', item.id, { kind: entry.kind || '' });
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
  if (!id || typeof id !== 'string' || (isConnected() && !/^[0-9a-fA-F]{24}$/.test(id))) {
    return res.status(400).json({ error: 'invalid id' });
  }
  if (isConnected()) {
    const { SuperBin, User, Client, PendingTxn, Loan, LoanRepayPending } = getModels();
    const item = await SuperBin.findById(id).lean();
    if (!item) return res.status(404).json({ error: 'not found' });
    const kind = String(item.kind || '');
    const payload = item.payload || {};
    let restored = null;
    try {
      if (kind === 'user') {
        if (!payload || !payload.username) return res.status(400).json({ error: 'invalid_payload_user' });
        await User.updateOne({ username: payload.username }, { $set: payload }, { upsert: true });
        restored = { username: payload.username };
      } else if (kind === 'client') {
        const p = payload || {};
        if (!p.accountNumber) return res.status(400).json({ error: 'invalid_payload_client' });
        const doc = {
          id: p.id || p.accountNumber || newId('C'),
          accountNumber: p.accountNumber,
          fullName: p.fullName || '',
          companyName: p.companyName || '',
          nationalId: p.nationalId || '',
          dob: p.dob || '',
          phone: p.phone || '',
          companyPhone: p.companyPhone || '',
          registrationDate: p.registrationDate || '',
          createdAt: p.createdAt || new Date().toISOString(),
          data: p,
        };
        await Client.updateOne({ accountNumber: doc.accountNumber }, { $set: doc }, { upsert: true });
        restored = { accountNumber: doc.accountNumber };
      } else if (kind === 'pending_txn') {
        const p = { ...(payload || {}) };
        if (!p.id || !p.accountNumber || !p.kind) return res.status(400).json({ error: 'invalid_payload_txn' });
        p.status = 'Pending';
        await PendingTxn.updateOne({ id: p.id }, { $set: p }, { upsert: true });
        restored = { id: p.id };
      } else if (kind === 'loan') {
        const p = { ...(payload || {}) };
        if (!p.id || !p.accountNumber) return res.status(400).json({ error: 'invalid_payload_loan' });
        p.status = p.status || 'Pending';
        await Loan.updateOne({ id: p.id }, { $set: p }, { upsert: true });
        restored = { id: p.id };
      } else if (kind === 'loan_repay') {
        const p = { ...(payload || {}) };
        if (!p.id || !p.loanId || !p.accountNumber) return res.status(400).json({ error: 'invalid_payload_loan_repay' });
        p.status = 'Pending';
        await LoanRepayPending.updateOne({ id: p.id }, { $set: p }, { upsert: true });
        restored = { id: p.id };
      } else {
        return res.status(400).json({ error: 'unsupported_kind' });
      }
      await SuperBin.findByIdAndDelete(id);
      await logActivity(req, 'superbin.restore', 'superbin', id, { kind });
      return res.json({ ok: true, kind, restored });
    } catch (e) {
      return res.status(500).json({ error: 'restore_failed', details: String(e && e.message || e) });
    }
  }
  const idx = superBin.findIndex(i => i.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const item = superBin[idx];
  const kind = String(item && item.kind || '');
  const payload = (item && item.payload) || {};
  try {
    if (kind === 'user') {
      const uidx = users.findIndex(u => u.username === payload.username);
      if (uidx >= 0) users[uidx] = payload; else users.unshift(payload);
      writeJSON(USERS_FILE, users);
    } else if (kind === 'client') {
      if (!payload.accountNumber) return res.status(400).json({ error: 'invalid_payload_client' });
      const cidx = clients.findIndex(c => c.accountNumber === payload.accountNumber || c.id === payload.id);
      if (cidx >= 0) clients[cidx] = payload; else clients.unshift(payload);
      writeJSON(CLIENTS_FILE, clients);
    } else if (kind === 'pending_txn') {
      const tidx = pendingTx.findIndex(t => t.id === payload.id);
      const p = { ...payload, status: 'Pending' };
      if (tidx >= 0) pendingTx[tidx] = p; else pendingTx.unshift(p);
      writeJSON(PENDING_TX_FILE, pendingTx);
    } else if (kind === 'loan') {
      const lidx = loans.findIndex(l => l.id === payload.id);
      const p = { ...payload, status: payload.status || 'Pending' };
      if (lidx >= 0) loans[lidx] = p; else loans.unshift(p);
      writeJSON(LOANS_FILE, loans);
    } else if (kind === 'loan_repay') {
      const ridx = loanRepayPending.findIndex(r => r.id === payload.id);
      const p = { ...payload, status: 'Pending' };
      if (ridx >= 0) loanRepayPending[ridx] = p; else loanRepayPending.unshift(p);
      writeJSON(LOAN_REPAY_PENDING_FILE, loanRepayPending);
    } else {
      return res.status(400).json({ error: 'unsupported_kind' });
    }
    superBin.splice(idx, 1);
    writeJSON(BIN_FILE, superBin);
    await logActivity(req, 'superbin.restore', 'superbin', id, { kind });
    return res.json({ ok: true, kind });
  } catch (e) {
    return res.status(500).json({ error: 'restore_failed', details: String(e && e.message || e) });
  }
});
app.delete('/super-bin/:id', requireSuperBinAuth, async (req, res) => {
  const id = req.params.id;
  if (!id || typeof id !== 'string' || (isConnected() && !/^[0-9a-fA-F]{24}$/.test(id))) {
    return res.status(400).json({ error: 'invalid id' });
  }
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

app.get('/server-logs', requireSuperAdmin, async (req, res) => {
  const { level, method, status, q, from, to, limit } = req.query || {};
  const lim = Math.min(1000, Math.max(1, Number(limit || 200)));
  if (isConnected()) {
    const { ServerLog } = getModels();
    const filter = {};
    if (level) filter.level = String(level);
    if (method) filter.method = String(method);
    if (status) filter.status = Number(status);
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = new Date(from);
      if (to) filter.ts.$lte = new Date(to);
    }
    if (q) {
      const rx = new RegExp(String(q), 'i');
      filter.$or = [{ path: rx }, { errorMessage: rx }, { actor: rx }, { ua: rx }];
    }
    const docs = await ServerLog.find(filter).sort({ ts: -1, _id: -1 }).limit(lim).lean();
    const list = docs.map(d => ({ ...d, id: String(d._id || d.id || '') }));
    return res.json(list);
  }
  let result = serverLogs.slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  if (level) result = result.filter(x => String(x.level) === String(level));
  if (method) result = result.filter(x => String(x.method) === String(method));
  if (status) result = result.filter(x => Number(x.status) === Number(status));
  if (from) result = result.filter(x => String(x.ts) >= String(from));
  if (to) result = result.filter(x => String(x.ts) <= String(to));
  if (q) {
    const s = String(q).toLowerCase();
    result = result.filter(x =>
      String(x.path || '').toLowerCase().includes(s) ||
      String(x.errorMessage || '').toLowerCase().includes(s) ||
      String(x.actor || '').toLowerCase().includes(s) ||
      String(x.ua || '').toLowerCase().includes(s));
  }
  res.json(result.slice(0, lim));
});
app.post('/media/upload', requireAdmin, upload ? upload.single('file') : (req, res, next) => next(), async (req, res) => {
  try {
    if (!fb || !fb.ready || !fb.bucket || !admin || !upload) return res.status(503).json({ error: 'media_upload_unavailable' });
    const f = req.file;
    if (!f || !f.buffer || !f.originalname) return res.status(400).json({ error: 'no_file' });
    const actor = (req.user && req.user.username) || 'api';
    const ext = String(f.originalname).split('.').pop() || 'bin';
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).slice(2, 8);
    const dest = `uploads/${yyyy}/${mm}/${Date.now()}-${rand}.${ext}`;
    const file = fb.bucket.file(dest);
    const dlToken = crypto.randomBytes(16).toString('hex');
    await file.save(f.buffer, {
      metadata: {
        contentType: f.mimetype,
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: dlToken },
      },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${fb.bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${dlToken}`;
    let updated = false;
    const record = { url, path: dest, bucket: fb.bucket.name, contentType: f.mimetype || '', size: f.size || 0, name: f.originalname, uploadedAt: now.toISOString(), uploadedBy: actor, tag: req.body && req.body.tag ? String(req.body.tag) : '' };
    const entityType = req.body && req.body.entityType ? String(req.body.entityType) : '';
    const entityId = req.body && req.body.entityId ? String(req.body.entityId) : '';
    if (entityType && entityId) {
      if (isConnected()) {
        const { Client, Loan } = getModels();
        if (entityType === 'client') {
          const match = { $or: [{ accountNumber: entityId }, { id: entityId }] };
          await Client.updateOne(match, { $push: { 'data.attachments': record } });
          updated = true;
        } else if (entityType === 'loan') {
          await Loan.updateOne({ id: entityId }, { $push: { attachments: record } });
          updated = true;
        }
      } else {
        if (entityType === 'client') {
          const idx = clients.findIndex(c => c.accountNumber === entityId || c.id === entityId);
          if (idx >= 0) {
            const a = Array.isArray(clients[idx].attachments) ? clients[idx].attachments : (Array.isArray(clients[idx].data && clients[idx].data.attachments) ? clients[idx].data.attachments : []);
            const nextA = [...a, record];
            if (!clients[idx].data) clients[idx].data = {};
            clients[idx].data.attachments = nextA;
            writeJSON(CLIENTS_FILE, clients);
            updated = true;
          }
        } else if (entityType === 'loan') {
          const idx = loans.findIndex(l => l.id === entityId);
          if (idx >= 0) {
            const a = Array.isArray(loans[idx].attachments) ? loans[idx].attachments : [];
            loans[idx].attachments = [...a, record];
            writeJSON(LOANS_FILE, loans);
            updated = true;
          }
        }
      }
    }
    await logActivity(req, 'media.upload', entityType || 'media', entityId || dest, { name: f.originalname, size: f.size || 0, contentType: f.mimetype || '' });
    res.status(201).json({ ...record, entityUpdated: updated });
  } catch (e) {
    const msg = String(e && e.message || e);
    try { await logActivity(req, 'media.upload.error', 'media', '', { message: msg }); } catch {}
    return res.status(500).json({ error: 'upload_failed', details: msg });
  }
});
app.get('/server-logs/:id', requireSuperAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'invalid id' });
  if (isConnected()) {
    const { ServerLog } = getModels();
    const doc = await ServerLog.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    return res.json({ ...doc, id: String(doc._id || doc.id || '') });
  }
  const it = serverLogs.find(x => x.id === id);
  if (!it) return res.status(404).json({ error: 'not found' });
  res.json(it);
});

// Notifications
app.get('/notifications', requireAdmin, async (req, res) => {
  const { channel, type, status, q, from, to, limit } = req.query || {};
  const lim = Math.min(1000, Math.max(1, Number(limit || 200)));
  if (isConnected()) {
    const { Notification } = getModels();
    const filter = {};
    if (channel) filter.channel = String(channel);
    if (type) filter.type = String(type);
    if (status) filter.status = String(status);
    if (from || to) {
      filter.ts = {};
      if (from) filter.ts.$gte = new Date(from);
      if (to) filter.ts.$lte = new Date(to);
    }
    if (q) {
      const rx = new RegExp(String(q), 'i');
      filter.$or = [{ receiver: rx }, { sender: rx }, { subject: rx }, { message: rx }, { channel: rx }, { type: rx }, { status: rx }];
    }
    const docs = await Notification.find(filter).sort({ ts: -1, _id: -1 }).limit(lim).lean();
    const list = docs.map(d => ({ ...d, id: String(d.id || d._id || ''), ts: d.ts instanceof Date ? d.ts.toISOString() : String(d.ts || '') }));
    await logActivity(req, 'notify.list', 'notify', '', { count: list.length });
    return res.json(list);
  }
  let result = notifications.slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  if (channel) result = result.filter(x => String(x.channel) === String(channel));
  if (type) result = result.filter(x => String(x.type) === String(type));
  if (status) result = result.filter(x => String(x.status) === String(status));
  if (from) result = result.filter(x => String(x.ts) >= String(from));
  if (to) result = result.filter(x => String(x.ts) <= String(to));
  if (q) {
    const s = String(q).toLowerCase();
    result = result.filter(x =>
      String(x.receiver || '').toLowerCase().includes(s) ||
      String(x.sender || '').toLowerCase().includes(s) ||
      String(x.subject || '').toLowerCase().includes(s) ||
      String(x.message || '').toLowerCase().includes(s) ||
      String(x.channel || '').toLowerCase().includes(s) ||
      String(x.type || '').toLowerCase().includes(s) ||
      String(x.status || '').toLowerCase().includes(s));
  }
  await logActivity(req, 'notify.list', 'notify', '', { count: Math.min(lim, result.length) });
  res.json(result.slice(0, lim));
});
app.get('/notifications/:id', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'invalid id' });
  if (isConnected()) {
    const { Notification } = getModels();
    const doc = await Notification.findOne({ $or: [{ id }, { _id: id }] }).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    const item = { ...doc, id: String(doc.id || doc._id || ''), ts: doc.ts instanceof Date ? doc.ts.toISOString() : String(doc.ts || '') };
    return res.json(item);
  }
  const it = notifications.find(x => String(x.id) === id);
  if (!it) return res.status(404).json({ error: 'not found' });
  res.json(it);
});
app.post('/notifications/:id/resend', requireAdmin, async (req, res) => {
  const id = String(req.params.id || '');
  if (!id) return res.status(400).json({ error: 'invalid id' });
  let item = null;
  if (isConnected()) {
    const { Notification } = getModels();
    item = await Notification.findOne({ $or: [{ id }, { _id: id }] }).lean();
  } else {
    item = notifications.find(x => String(x.id) === id) || null;
  }
  if (!item) return res.status(404).json({ error: 'not found' });
  const channel = String(item.channel || '');
  const receiver = String(item.receiver || '');
  const subject = String(item.subject || '');
  const message = String(item.message || '');
  let r = { ok: false, error: 'unsupported_channel' };
  try {
    if (channel === 'sms') r = await sendSMS(receiver, message);
    else if (channel === 'email') r = await sendEmail(receiver, subject, message);
  } catch (e) {
    r = { ok: false, error: e && e.message ? e.message : String(e) };
  }
  try {
    await logNotification({
      channel,
      type: 'resend',
      sender: (req.user && req.user.username) || 'api',
      receiver,
      subject,
      message,
      status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
      error: r.error || '',
      entityType: 'notify',
      entityId: '',
      originalId: id,
    });
  } catch {}
  await logActivity(req, 'notify.resend', 'notify', id, { channel, ok: !!r.ok });
  if (!r.ok) return res.status(400).json({ error: 'send_failed', details: r.error || '' });
  res.json({ ok: true });
});

// Clients
app.get('/clients', async (req, res) => {
  const { q, accountNumber, manager } = req.query;
  if (isConnected()) {
    const { Client } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (manager) filter.manager = String(manager);
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
    const list = docs.map(d => ({
      ...(d.data || {}),
      id: d.id,
      accountNumber: d.accountNumber,
      createdAt: d.createdAt,
      fullName: d.fullName,
      companyName: d.companyName,
      nationalId: d.nationalId,
      dob: d.dob,
      phone: d.phone,
      companyPhone: d.companyPhone,
      registrationDate: d.registrationDate,
      manager: d.manager || '',
      status: d.accountStatus || ((d.data || {}).status) || 'Active',
    }));
    return res.json(list);
  }
  let result = clients;
  if (accountNumber) result = result.filter(c => c.accountNumber === accountNumber);
  if (manager) result = result.filter(c => String(c.manager || '').trim() === String(manager).trim());
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
    const obj = {
      ...base,
      id: d.id,
      accountNumber: d.accountNumber,
      createdAt: d.createdAt,
      fullName: d.fullName,
      companyName: d.companyName,
      nationalId: d.nationalId,
      dob: d.dob,
      phone: d.phone,
      companyPhone: d.companyPhone,
      registrationDate: d.registrationDate,
      manager: d.manager || '',
      managerHistory: Array.isArray(d.managerHistory) ? d.managerHistory : [],
    };
    obj.status = d.accountStatus || obj.status || 'Active';
    if (Array.isArray(d.statusHistory)) obj.statusHistory = d.statusHistory;
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
  const out = { ...it };
  out.status = it.accountStatus || it.status || 'Active';
  out.manager = it.manager || '';
  out.managerHistory = Array.isArray(it.managerHistory) ? it.managerHistory : [];
  res.json(out);
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
    const { Client, PostedTxn } = getModels();
    let d = await Client.findOne({ accountNumber: acct }).lean();
    if (!d) return res.status(404).json({ error: 'not found' });
    const c = { ...(d.data || {}), accountNumber: d.accountNumber, fullName: d.fullName, companyName: d.companyName, nationalId: d.nationalId, dob: d.dob, phone: d.phone, companyPhone: d.companyPhone, registrationDate: d.registrationDate };
    const name = c.fullName || c.companyName || '';
    // Auto-dormant: if no transactions in 3 months
    try {
      const latest = await PostedTxn.findOne({ accountNumber: acct }).sort({ approvedAt: -1, _id: -1 }).lean();
      const ref = (latest && latest.approvedAt) || (d.lastTxnAt) || (d.createdAt) || (c.createdAt) || '';
      if (ref) {
        const last = new Date(ref);
        const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
        if ((d.accountStatus || c.status || 'Active') === 'Active' && days >= 90) {
          const nowIso = new Date().toISOString();
          await Client.updateOne({ _id: d._id }, {
            $set: { accountStatus: 'Dormant', lastTxnAt: ref },
            $push: { statusHistory: { status: 'Dormant', by: 'system', at: nowIso, remarks: 'Inactive for three months or more', via: 'system' } },
          });
          d = await Client.findOne({ _id: d._id }).lean();
          await logActivity(req, 'client.status.auto_dormant', 'client', String(d.accountNumber || ''), {});
        }
      }
    } catch {}
    await logActivity(req, 'directory.lookup', 'client', String(d.accountNumber || ''), {});
    return res.json({
      accountNumber: d.accountNumber,
      name,
      nationalId: c.nationalId || c.companyRegistrationNumber || '',
      dob: c.dob || c.registrationDate || '',
      phone: c.phone || c.companyPhone || '',
      status: d.accountStatus || c.status || 'Active',
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
    status: c.accountStatus || c.status || 'Active',
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
app.get('/transactions/records', async (req, res) => {
  const role = (req.user && req.user.role) || '';
  const actor = (req.user && req.user.username) || '';
  const seeAll = canApproveTxn(role);
  const { accountNumber, kind, status, id, initiator } = req.query || {};
  if (isConnected()) {
    const { PendingTxn, PostedTxn, SuperBin } = getModels();
    const records = [];
    const pFilter = {};
    if (accountNumber) pFilter.accountNumber = accountNumber;
    if (kind) pFilter.kind = kind;
    const pend = await PendingTxn.find(pFilter).lean();
    pend.forEach(p => {
      if (!seeAll && p.initiatorName !== actor) return;
      records.push({ ...p, status: 'Pending' });
    });
    const sFilter = {};
    if (accountNumber) sFilter.accountNumber = accountNumber;
    if (kind) sFilter.kind = kind;
    if (id) sFilter.id = { $regex: String(id), $options: 'i' };
    const post = await PostedTxn.find(sFilter).lean();
    post.forEach(p => {
      if (!seeAll && p.initiatorName !== actor) return;
      records.push({ ...p, status: 'Approved' });
    });
    const bin = await SuperBin.find({ kind: 'pending_txn' }).lean();
    bin.forEach(b => {
      const p = b.payload || {};
      if (accountNumber && p.accountNumber !== accountNumber) return;
      if (kind && p.kind !== kind) return;
      if (id && String(p.id || '').indexOf(String(id)) === -1) return;
      if (!seeAll && p.initiatorName !== actor) return;
      records.push({ ...p, status: 'Rejected', rejectedAt: b.deletedAt, reason: p.reason || '' });
    });
    let out = records;
    if (status) out = out.filter(r => r.status === status);
    if (initiator) out = out.filter(r => r.initiatorName === initiator);
    out.sort((a, b) => {
      const ta = new Date(a.approvedAt || a.initiatedAt || a.rejectedAt || 0).getTime();
      const tb = new Date(b.approvedAt || b.initiatedAt || b.rejectedAt || 0).getTime();
      return tb - ta;
    });
    await logActivity(req, 'txn.records.view', 'transactions', '', {});
    return res.json(out);
  }
  const records = [];
  let pend = pendingTx;
  let post = postedTx;
  let bin = superBin.filter(b => b.kind === 'pending_txn');
  if (accountNumber) {
    pend = pend.filter(p => p.accountNumber === accountNumber);
    post = post.filter(p => p.accountNumber === accountNumber);
    bin = bin.filter(b => (b.payload && b.payload.accountNumber) === accountNumber);
  }
  if (kind) {
    pend = pend.filter(p => p.kind === kind);
    post = post.filter(p => p.kind === kind);
    bin = bin.filter(b => (b.payload && b.payload.kind) === kind);
  }
  if (id) {
    const s = String(id);
    pend = pend.filter(p => String(p.id || '').includes(s));
    post = post.filter(p => String(p.id || '').includes(s));
    bin = bin.filter(b => String((b.payload && b.payload.id) || '').includes(s));
  }
  pend.forEach(p => {
    if (!seeAll && p.initiatorName !== actor) return;
    records.push({ ...p, status: 'Pending' });
  });
  post.forEach(p => {
    if (!seeAll && p.initiatorName !== actor) return;
    records.push({ ...p, status: 'Approved' });
  });
  bin.forEach(b => {
    const p = b.payload || {};
    if (!seeAll && p.initiatorName !== actor) return;
    records.push({ ...p, status: 'Rejected', rejectedAt: b.deletedAt, reason: p.reason || '' });
  });
  let out = records;
  if (status) out = out.filter(r => r.status === status);
  if (initiator) out = out.filter(r => r.initiatorName === initiator);
  out.sort((a, b) => {
    const ta = new Date(a.approvedAt || a.initiatedAt || a.rejectedAt || 0).getTime();
    const tb = new Date(b.approvedAt || b.initiatedAt || b.rejectedAt || 0).getTime();
    return tb - ta;
  });
  await logActivity(req, 'txn.records.view', 'transactions', '', {});
  res.json(out);
});
function addPending(kind) {
  return async (req, res) => {
    const body = req.body || {};
    const amountNum = Number(body.amount);
    // Enforce account status rules
    try {
      let status = 'Active';
      if (isConnected()) {
        const { Client } = getModels();
        const c = await Client.findOne({ accountNumber: body.accountNumber }).lean();
        status = (c && (c.accountStatus || (c.data && c.data.status))) || 'Active';
      } else {
        const c = clients.find(x => x.accountNumber === body.accountNumber);
        status = (c && (c.accountStatus || c.status)) || 'Active';
      }
      if (status === 'Inactive') {
        await logActivity(req, `txn.${kind}.create.blocked.inactive`, 'transaction', '', { accountNumber: body.accountNumber, amount: amountNum });
        return res.status(400).json({ error: 'account_inactive' });
      }
      if (status === 'Dormant' && kind === 'withdraw') {
        await logActivity(req, `txn.${kind}.create.blocked.dormant`, 'transaction', '', { accountNumber: body.accountNumber, amount: amountNum });
        return res.status(400).json({ error: 'account_dormant' });
      }
      if (kind === 'withdraw' && status === 'NDS') {
        await logActivity(req, `txn.${kind}.create.blocked.nds`, 'transaction', '', { accountNumber: body.accountNumber, amount: amountNum });
        return res.status(400).json({ error: 'account_non_debit' });
      }
    } catch {}
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
      initiatorName: (req.user && req.user.username) || body.initiatorName || 'api',
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

// Manual account status change (requires remarks)
app.post('/clients/:id/status', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const next = String(body.status || '');
  const remarks = String(body.remarks || '').trim();
  if (!next) return res.status(400).json({ error: 'status_required' });
  if (!remarks) return res.status(400).json({ error: 'remarks_required' });
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  const allowed = new Set(['Active', 'Inactive', 'Dormant', 'NDS']);
  if (!allowed.has(next)) return res.status(400).json({ error: 'invalid_status' });
  if (isConnected()) {
    const { Client } = getModels();
    const d = await Client.findOne({ $or: [{ accountNumber: id }, { id }] });
    if (!d) return res.status(404).json({ error: 'not_found' });
    const prev = d.accountStatus || (d.data && d.data.status) || 'Active';
    if (prev === next) return res.json({ ok: true, status: next });
    const nowIso = new Date().toISOString();
    await Client.updateOne({ _id: d._id }, {
      $set: { accountStatus: next },
      $push: { statusHistory: { status: next, by: req.user.username, at: nowIso, remarks, via: 'user' } },
    });
    await logActivity(req, 'client.status.change', 'client', String(d.accountNumber || id), { from: prev, to: next, remarks });
    return res.json({ ok: true, status: next });
  }
  const idx = clients.findIndex(c => c.accountNumber === id || c.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not_found' });
  const prev = clients[idx].accountStatus || clients[idx].status || 'Active';
  clients[idx].accountStatus = next;
  clients[idx].statusHistory = Array.isArray(clients[idx].statusHistory) ? clients[idx].statusHistory : [];
  clients[idx].statusHistory.push({ status: next, by: (req.user && req.user.username) || 'user', at: new Date().toISOString(), remarks, via: 'user' });
  writeJSON(CLIENTS_FILE, clients);
  await logActivity(req, 'client.status.change', 'client', String(id), { from: prev, to: next, remarks });
  res.json({ ok: true, status: next });
});

// Assets registry
app.get('/assets', async (req, res) => {
  const { q, status, assignedTo, condition, category } = req.query || {};
  if (isConnected()) {
    const { Asset } = getModels();
    const filter = {};
    if (status) filter.status = String(status);
    if (assignedTo) filter.assignedTo = String(assignedTo);
    if (condition) filter.condition = String(condition);
    if (category) filter.category = String(category);
    if (q) {
      const s = String(q);
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { category: { $regex: s, $options: 'i' } },
        { serialNumber: { $regex: s, $options: 'i' } },
      ];
    }
    const docs = await Asset.find(filter).sort({ updatedAt: -1, _id: -1 }).lean();
    return res.json(docs);
  }
  let result = assets;
  if (status) result = result.filter(a => String(a.status || '') === String(status));
  if (assignedTo) result = result.filter(a => String(a.assignedTo || '') === String(assignedTo));
  if (condition) result = result.filter(a => String(a.condition || '') === String(condition));
  if (category) result = result.filter(a => String(a.category || '') === String(category));
  if (q) {
    const s = String(q).toLowerCase();
    result = result.filter(a =>
      String(a.name || '').toLowerCase().includes(s) ||
      String(a.category || '').toLowerCase().includes(s) ||
      String(a.serialNumber || '').toLowerCase().includes(s)
    );
  }
  res.json(result);
});
app.get('/assets/:id', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { Asset } = getModels();
    const d = await Asset.findOne({ $or: [{ id }, { _id: id }, { serialNumber: id }] }).lean();
    if (!d) return res.status(404).json({ error: 'not_found' });
    await logActivity(req, 'asset.view', 'asset', String(d.id || id), {});
    return res.json(d);
  }
  const it = assets.find(a => String(a.id) === id || String(a.serialNumber) === id);
  if (!it) return res.status(404).json({ error: 'not_found' });
  await logActivity(req, 'asset.view', 'asset', String(it.id || id), {});
  res.json(it);
});
app.post('/assets', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canManageAssets(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const body = req.body || {};
  const nowIso = new Date().toISOString();
  const name = String(body.name || '').trim();
  const serialNumber = String(body.serialNumber || '').trim();
  const category = String(body.category || '').trim();
  if (!name) return res.status(400).json({ error: 'name_required' });
  if (!serialNumber) return res.status(400).json({ error: 'serial_required' });
  if (!category) return res.status(400).json({ error: 'category_required' });
  if (isConnected()) {
    const { Asset } = getModels();
    const payload = {
      id: body.id || newId('AS'),
      name,
      category,
      serialNumber,
      purchaseDate: body.purchaseDate || '',
      condition: body.condition || 'New',
      status: body.status || 'Available',
      assignedTo: body.assignedTo || '',
      notes: body.notes || '',
      createdAt: body.createdAt || nowIso,
      updatedAt: nowIso,
      history: [{
        action: 'create',
        by: req.user.username,
        at: nowIso,
        remarks: body.remarks || 'Asset created',
        fromStatus: '',
        toStatus: body.status || 'Available',
        fromAssignee: '',
        toAssignee: body.assignedTo || '',
      }],
    };
    let doc;
    try {
      doc = await Asset.create(payload);
    } catch (e) {
      return res.status(400).json({ error: 'create_failed', details: e.message || 'Failed to create asset' });
    }
    await logActivity(req, 'asset.create', 'asset', String(doc.id || ''), {});
    return res.status(201).json(doc.toObject());
  }
  const payload = {
    id: body.id || newId('AS'),
    name,
    category,
    serialNumber,
    purchaseDate: body.purchaseDate || '',
    condition: body.condition || 'New',
    status: body.status || 'Available',
    assignedTo: body.assignedTo || '',
    notes: body.notes || '',
    createdAt: body.createdAt || nowIso,
    updatedAt: nowIso,
    history: [{
      action: 'create',
      by: (req.user && req.user.username) || 'user',
      at: nowIso,
      remarks: body.remarks || 'Asset created',
      fromStatus: '',
      toStatus: body.status || 'Available',
      fromAssignee: '',
      toAssignee: body.assignedTo || '',
    }],
  };
  assets.unshift(payload);
  writeJSON(ASSETS_FILE, assets);
  await logActivity(req, 'asset.create', 'asset', String(payload.id || ''), {});
  res.status(201).json(payload);
});
app.post('/assets/:id/status', async (req, res) => {
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canManageAssets(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  const id = req.params.id;
  const body = req.body || {};
  const nextStatus = typeof body.status === 'string' ? String(body.status) : undefined;
  const nextAssignee = typeof body.assignedTo === 'string' ? String(body.assignedTo) : undefined;
  const remarks = String(body.remarks || '').trim();
  if (!remarks) return res.status(400).json({ error: 'remarks_required' });
  const nowIso = new Date().toISOString();
  if (isConnected()) {
    const { Asset } = getModels();
    const d = await Asset.findOne({ $or: [{ id }, { _id: id }, { serialNumber: id }] });
    if (!d) return res.status(404).json({ error: 'not_found' });
    const fromStatus = d.status || '';
    const fromAssignee = d.assignedTo || '';
    const updates = { updatedAt: nowIso };
    if (nextStatus != null) updates.status = nextStatus;
    if (nextAssignee != null) updates.assignedTo = nextAssignee;
    await Asset.updateOne({ _id: d._id }, {
      $set: updates,
      $push: {
        history: {
          action: 'status',
          by: req.user.username,
          at: nowIso,
          remarks,
          fromStatus,
          toStatus: nextStatus != null ? nextStatus : fromStatus,
          fromAssignee,
          toAssignee: nextAssignee != null ? nextAssignee : fromAssignee,
        },
      },
    });
    await logActivity(req, 'asset.update', 'asset', String(d.id || id), { fromStatus, toStatus: updates.status || fromStatus, fromAssignee, toAssignee: updates.assignedTo || fromAssignee, remarks });
    return res.json({ ok: true });
  }
  const idx = assets.findIndex(a => String(a.id) === id || String(a.serialNumber) === id);
  if (idx < 0) return res.status(404).json({ error: 'not_found' });
  const fromStatus = assets[idx].status || '';
  const fromAssignee = assets[idx].assignedTo || '';
  if (nextStatus != null) assets[idx].status = nextStatus;
  if (nextAssignee != null) assets[idx].assignedTo = nextAssignee;
  assets[idx].updatedAt = nowIso;
  assets[idx].history = Array.isArray(assets[idx].history) ? assets[idx].history : [];
  assets[idx].history.push({
    action: 'status',
    by: (req.user && req.user.username) || 'user',
    at: nowIso,
    remarks,
    fromStatus,
    toStatus: nextStatus != null ? nextStatus : fromStatus,
    fromAssignee,
    toAssignee: nextAssignee != null ? nextAssignee : fromAssignee,
  });
  writeJSON(ASSETS_FILE, assets);
  await logActivity(req, 'asset.update', 'asset', String(assets[idx].id || id), { fromStatus, toStatus: assets[idx].status, fromAssignee, toAssignee: assets[idx].assignedTo, remarks });
  res.json({ ok: true });
});
// Manual account manager assignment (assign, unassign, reassign) with remarks
app.post('/clients/:id/manager', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const target = String(body.manager || '').trim(); // empty means unassign
  const remarks = String(body.remarks || '').trim();
  if (!req.user || !req.user.username) return res.status(401).json({ error: 'unauthorized' });
  if (!canManageAccounts(req.user.role)) return res.status(403).json({ error: 'forbidden' });
  if (!remarks) return res.status(400).json({ error: 'remarks_required' });
  const nowIso = new Date().toISOString();
  if (isConnected()) {
    const { Client } = getModels();
    const d = await Client.findOne({ $or: [{ accountNumber: id }, { id }] });
    if (!d) return res.status(404).json({ error: 'not_found' });
    const current = String(d.manager || '').trim();
    let action = 'assign';
    if (!current && target) action = 'assign';
    else if (current && !target) action = 'unassign';
    else if (current && target && current !== target) action = 'reassign';
    else if (current === target) {
      return res.json({ ok: true, manager: current, action: 'noop' });
    }
    await Client.updateOne({ _id: d._id }, {
      $set: { manager: target },
      $push: { managerHistory: { action, manager: target, by: req.user.username, at: nowIso, remarks } },
    });
    await logActivity(req, `client.manager.${action}`, 'client', String(d.accountNumber || id), { from: current, to: target, remarks });
    return res.json({ ok: true, manager: target, action });
  }
  const idx = clients.findIndex(c => c.accountNumber === id || c.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not_found' });
  const current = String(clients[idx].manager || '').trim();
  let action = 'assign';
  if (!current && target) action = 'assign';
  else if (current && !target) action = 'unassign';
  else if (current && target && current !== target) action = 'reassign';
  else if (current === target) {
    return res.json({ ok: true, manager: current, action: 'noop' });
  }
  clients[idx].manager = target;
  clients[idx].managerHistory = Array.isArray(clients[idx].managerHistory) ? clients[idx].managerHistory : [];
  clients[idx].managerHistory.push({ action, manager: target, by: (req.user && req.user.username) || 'user', at: nowIso, remarks });
  writeJSON(CLIENTS_FILE, clients);
  await logActivity(req, `client.manager.${action}`, 'client', String(clients[idx].accountNumber || id), { from: current, to: target, remarks });
  res.json({ ok: true, manager: target, action });
});
app.post('/transactions/pending/:id/approve', async (req, res) => {
  const id = req.params.id;
  let txn = null;
  if (isConnected()) {
    const { PendingTxn, PostedTxn, LoanRepayPosted, Config } = getModels();
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
      const cfg = (await Config.findOne().lean()) || {};
      const feeRate = Number(cfg.withdrawalFeeRate || 0);
      const fee = Math.round((Number(txn.amount || 0) * (feeRate / 100)) * 100) / 100;
      const total = Number(txn.amount) + fee;
      const bal = await computeAccountBalance(txn.accountNumber);
      if (total > bal) {
        await logActivity(req, 'txn.approve.blocked', 'transaction', id, { accountNumber: txn.accountNumber, amount: txn.amount, available: bal });
        return res.status(400).json({ error: 'insufficient_funds', available: bal });
      }
      txn = { ...txn, meta: { ...(txn.meta || {}), feeRate, feeAmount: fee, baseAmount: Number(txn.amount) }, amount: total };
    }
    await PendingTxn.deleteOne({ id });
    const posted = {
      ...txn,
      approvedAt: new Date().toISOString(),
      approverName: (req.user && req.user.username) || 'api',
      status: 'Approved',
    };
    await PostedTxn.create(posted);
    try {
      const { Client } = getModels();
      await Client.updateOne({ accountNumber: posted.accountNumber }, { $set: { lastTxnAt: posted.approvedAt } });
      try {
        const c = await Client.findOne({ accountNumber: posted.accountNumber }).lean();
        const phone = c && (c.phone || c.companyPhone);
        if (phone) {
          const bal = await computeAccountBalance(posted.accountNumber);
          const base = (posted.meta && typeof posted.meta.baseAmount === 'number') ? posted.meta.baseAmount : posted.amount;
          const fee = (posted.meta && typeof posted.meta.feeAmount === 'number') ? posted.meta.feeAmount : 0;
          const kind = posted.kind === 'withdraw' ? 'Debit' : 'Credit';
          const parts = [];
          parts.push(`${kind} ${Number(base || 0).toFixed(2)}`);
          if (fee > 0) parts.push(`Fee ${Number(fee).toFixed(2)}`);
          parts.push(`Acct ${posted.accountNumber}`);
          parts.push(`Bal ${Number(bal || 0).toFixed(2)}`);
          const text = parts.join(' | ');
          const r = await sendSMS(phone, text);
          try {
            await logNotification({
              channel: 'sms',
              type: 'transaction',
              sender: (req.user && req.user.username) || 'api',
              receiver: phone,
              subject: '',
              message: String(text || ''),
              status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
              error: r.error || r.status || r.text || '',
              entityType: 'transaction',
              entityId: String(posted.id || ''),
            });
          } catch {}
        }
      } catch {}
    } catch {}
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
    const feeRate = Number(config.withdrawalFeeRate || 0);
    const fee = Math.round((Number(txn.amount || 0) * (feeRate / 100)) * 100) / 100;
    const total = Number(txn.amount) + fee;
    const bal = await computeAccountBalance(txn.accountNumber);
    if (total > bal) {
      await logActivity(req, 'txn.approve.blocked', 'transaction', id, { accountNumber: txn.accountNumber, amount: txn.amount, available: bal });
      return res.status(400).json({ error: 'insufficient_funds', available: bal });
    }
    txn = { ...txn, meta: { ...(txn.meta || {}), feeRate, feeAmount: fee, baseAmount: Number(txn.amount) }, amount: total };
  }
  pendingTx.splice(idx, 1);
  const posted = {
    ...txn,
    approvedAt: new Date().toISOString(),
    approverName: (req.user && req.user.username) || 'api',
    status: 'Approved',
  };
  postedTx.unshift(posted);
  writeJSON(PENDING_TX_FILE, pendingTx);
  writeJSON(POSTED_TX_FILE, postedTx);
  try {
    const cidx = clients.findIndex(x => x.accountNumber === posted.accountNumber);
    if (cidx >= 0) {
      clients[cidx].lastTxnAt = posted.approvedAt;
      writeJSON(CLIENTS_FILE, clients);
    }
  } catch {}
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
      by: (req.user && req.user.username) || (req.body && req.body.by) || 'api',
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
    by: (req.user && req.user.username) || (req.body && req.body.by) || 'api',
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
app.get('/loans/:id', async (req, res) => {
  const id = req.params.id;
  if (isConnected()) {
    const { Loan, Client, LoanRepayPosted } = getModels();
    const loan = await Loan.findOne({ id }).lean();
    if (!loan) return res.status(404).json({ error: 'not found' });
    const client = await Client.findOne({ accountNumber: loan.accountNumber }).lean();
    const repayments = await LoanRepayPosted.find({ loanId: id }).sort({ approvedAt: -1, _id: -1 }).lean();
    const totalRepaid = (repayments || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const term = Number(loan.termMonths || 0);
    const start = loan.approvedAt ? new Date(loan.approvedAt) : null;
    let dueDate = null;
    if (start && !Number.isNaN(start.getTime())) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + term);
      dueDate = d.toISOString();
    }
    const now = new Date();
    let daysToDue = null;
    let overdueDays = 0;
    if (dueDate) {
      const dd = new Date(dueDate);
      const ms = dd.getTime() - now.getTime();
      daysToDue = Math.ceil(ms / (24 * 3600 * 1000));
      overdueDays = Math.max(0, Math.floor((now.getTime() - dd.getTime()) / (24 * 3600 * 1000)));
    }
    const grace = Number(config.loanOverdueGraceDays || 0);
    const effOverdue = Math.max(0, overdueDays - grace);
    const outstanding = Math.max(0, Number(loan.totalDue || 0) - Number(totalRepaid || 0));
    const ratePerDay = Number(config.loanOverdueDailyPenaltyRate || 0);
    const penaltyAccrued = Math.round(outstanding * (ratePerDay / 100) * effOverdue * 100) / 100;
    const summary = {
      totalRepaid,
      dueDate,
      daysToDue,
      overdueDays,
      graceDays: grace,
      overdueDailyRate: ratePerDay,
      outstanding,
      penaltyAccrued,
      outstandingWithPenalty: outstanding + penaltyAccrued,
    };
    return res.json({ loan, client, repayments, summary });
  }
  const loan = loans.find(l => l.id === id);
  if (!loan) return res.status(404).json({ error: 'not found' });
  const client = clients.find(c => c.accountNumber === loan.accountNumber) || null;
  const repayments = loanRepayPosted.filter(r => r.loanId === id).sort((a, b) => (String(b.approvedAt || '').localeCompare(String(a.approvedAt || ''))));
  const totalRepaid = (repayments || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const term = Number(loan.termMonths || 0);
  const start = loan.approvedAt ? new Date(loan.approvedAt) : null;
  let dueDate = null;
  if (start && !Number.isNaN(start.getTime())) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + term);
    dueDate = d.toISOString();
  }
  const now = new Date();
  let daysToDue = null;
  let overdueDays = 0;
  if (dueDate) {
    const dd = new Date(dueDate);
    const ms = dd.getTime() - now.getTime();
    daysToDue = Math.ceil(ms / (24 * 3600 * 1000));
    overdueDays = Math.max(0, Math.floor((now.getTime() - dd.getTime()) / (24 * 3600 * 1000)));
  }
  const grace = Number(config.loanOverdueGraceDays || 0);
  const effOverdue = Math.max(0, overdueDays - grace);
  const outstanding = Math.max(0, Number(loan.totalDue || 0) - Number(totalRepaid || 0));
  const ratePerDay = Number(config.loanOverdueDailyPenaltyRate || 0);
  const penaltyAccrued = Math.round(outstanding * (ratePerDay / 100) * effOverdue * 100) / 100;
  const summary = {
    totalRepaid,
    dueDate,
    daysToDue,
    overdueDays,
    graceDays: grace,
    overdueDailyRate: ratePerDay,
    outstanding,
    penaltyAccrued,
    outstandingWithPenalty: outstanding + penaltyAccrued,
  };
  return res.json({ loan, client, repayments, summary });
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
  let cfg = null;
  if (isConnected()) {
    try {
      const { Config } = getModels();
      cfg = await Config.findOne().lean();
    } catch { cfg = null; }
  }
  cfg = cfg || config || {};
  const serviceFee = Math.round((principalNum * (Number(cfg.serviceFeeRate || 0) / 100)) * 100) / 100;
  const adminFee = Math.round((principalNum * (Number(cfg.adminFeeRate || 0) / 100)) * 100) / 100;
  const commitmentFee = Math.round((principalNum * (Number(cfg.commitmentFeeRate || 0) / 100)) * 100) / 100;
  const totalFees = Math.round((serviceFee + adminFee + commitmentFee) * 100) / 100;
  const loan = {
    id: body.id || newLoanId(),
    accountNumber: body.accountNumber,
    principal: principalNum,
    rate: rateNum || 0,
    termMonths: monthsNum || 0,
    totalInterest: Math.round(totalInterest * 100) / 100,
    serviceFee,
    adminFee,
    commitmentFee,
    totalFees,
    totalDue: Math.round((principalNum + totalInterest + totalFees) * 100) / 100,
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
    const u = req.user && req.user.username ? req.user.username : 'api';
    await Loan.create({ ...loan, initiatorName: u });
  } else {
    const u = req.user && req.user.username ? req.user.username : 'api';
    loans.unshift({ ...loan, initiatorName: u });
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
    const loan = await Loan.findOneAndUpdate(
      { id },
      { $set: { status: 'Active', approvedAt: new Date().toISOString(), approverName: (req.user && req.user.username) || 'api' } },
      { new: true }
    ).lean();
    if (!loan) return res.status(404).json({ error: 'not found' });
    const disbursed = {
      id: newTxnId('loan_disbursement'),
      kind: 'loan_disbursement',
      status: 'Approved',
      initiatorName: loan.initiatorName || 'api',
      initiatedAt: loan.createdAt || new Date().toISOString(),
      accountNumber: loan.accountNumber,
      amount: loan.principal,
      approverName: (req.user && req.user.username) || 'api',
      approvedAt: loan.approvedAt,
      meta: { loanId: loan.id, rate: loan.rate || 0, termMonths: loan.termMonths || 0 },
    };
    await PostedTxn.create(disbursed);
    try {
      const { Client } = getModels();
      const c = await Client.findOne({ accountNumber: loan.accountNumber }).lean();
      const phone = c && (c.phone || c.companyPhone);
      if (phone) {
        const text = `Loan disbursement ${Number(loan.principal || 0).toFixed(2)} | Acct ${loan.accountNumber}`;
        const r = await sendSMS(phone, text);
        try {
          await logNotification({
            channel: 'sms',
            type: 'loan',
            sender: (req.user && req.user.username) || 'api',
            receiver: phone,
            subject: '',
            message: String(text || ''),
            status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
            error: r.error || r.status || r.text || '',
            entityType: 'loan',
            entityId: String(loan.id || ''),
          });
        } catch {}
    }
    } catch {}
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
  loans[idx] = { ...loans[idx], status: 'Active', approvedAt: new Date().toISOString(), approverName: (req.user && req.user.username) || 'api' };
  const loan = loans[idx];
  const disbursed = {
    id: newTxnId('loan_disbursement'),
    kind: 'loan_disbursement',
    status: 'Approved',
    initiatorName: loan.initiatorName || 'api',
    initiatedAt: loan.createdAt || new Date().toISOString(),
    accountNumber: loan.accountNumber,
    amount: loan.principal,
    approverName: (req.user && req.user.username) || 'api',
    approvedAt: loan.approvedAt,
    meta: { loanId: loan.id, rate: loan.rate || 0, termMonths: loan.termMonths || 0 },
  };
  postedTx.unshift(disbursed);
  writeJSON(POSTED_TX_FILE, postedTx);
  writeJSON(LOANS_FILE, loans);
  try {
    const c = clients.find(x => x.accountNumber === loan.accountNumber);
    const phone = c && (c.phone || c.companyPhone);
    if (phone) {
      const text = `Loan disbursement ${Number(loan.principal || 0).toFixed(2)} | Acct ${loan.accountNumber}`;
      const r = await sendSMS(phone, text);
      try {
        await logNotification({
          channel: 'sms',
          type: 'loan',
          sender: (req.user && req.user.username) || 'api',
          receiver: phone,
          subject: '',
          message: String(text || ''),
          status: r.ok ? 'sent' : (r.skipped ? 'skipped' : 'failed'),
          error: r.error || r.status || r.text || '',
          entityType: 'loan',
          entityId: String(loan.id || ''),
        });
      } catch {}
    }
  } catch {}
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
  const { accountNumber, id, loanId } = req.query;
  if (isConnected()) {
    const { LoanRepayPosted } = getModels();
    const filter = {};
    if (accountNumber) filter.accountNumber = accountNumber;
    if (loanId) filter.loanId = loanId;
    if (id) filter.id = { $regex: String(id), $options: 'i' };
    const docs = await LoanRepayPosted.find(filter).sort({ approvedAt: -1, _id: -1 }).lean();
    await logActivity(req, 'statements.view', 'loan_repay', String(accountNumber || ''), {});
    return res.json(docs);
  }
  let result = loanRepayPosted;
  if (accountNumber) result = result.filter(r => r.accountNumber === accountNumber);
  if (loanId) result = result.filter(r => r.loanId === loanId);
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
      initiatorName: (req.user && req.user.username) || body.initiatorName || 'api',
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
    initiatorName: (req.user && req.user.username) || body.initiatorName || 'api',
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
    const posted = { ...r, status: 'Approved', approvedAt: new Date().toISOString(), approverName: (req.user && req.user.username) || 'api' };
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
  const posted = { ...r, status: 'Approved', approvedAt: new Date().toISOString(), approverName: (req.user && req.user.username) || 'api' };
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

app.use((err, req, res, next) => {
  try {
    const actor = (req.user && req.user.username) || 'anon';
    const role = (req.user && req.user.role) || '';
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const entry = {
      id: newId('LOG'),
      ts: new Date().toISOString(),
      level: 'error',
      method: req.method,
      path: req.path,
      status: Number(err && err.status) || 500,
      durationMs: 0,
      actor,
      role,
      ip,
      ua,
      params: req.params || {},
      query: req.query || {},
      body: null,
      errorMessage: String(err && err.message || ''),
      errorStack: String(err && err.stack || ''),
    };
    if (isConnected()) {
      const { ServerLog } = getModels();
      ServerLog.create({ ...entry, id: undefined }).catch(() => {});
    } else {
      serverLogs.unshift(entry);
      if (serverLogs.length > 5000) serverLogs = serverLogs.slice(0, 5000);
      writeJSON(SERVER_LOGS_FILE, serverLogs);
    }
  } catch {}
  next(err);
});

const port = process.env.PORT || 5000;
// Lightweight daily job: auto-dormant scan at startup and every 24h
async function autoDormantSweep() {
  try {
    if (!isConnected()) return;
    const { Client, PostedTxn } = getModels();
    const clients = await Client.find({}).select({ accountNumber: 1, accountStatus: 1, lastTxnAt: 1, createdAt: 1 }).lean();
    const now = Date.now();
    for (const c of clients) {
      try {
        let ref = c.lastTxnAt;
        if (!ref) {
          const latest = await PostedTxn.findOne({ accountNumber: c.accountNumber }).sort({ approvedAt: -1, _id: -1 }).lean();
          ref = (latest && latest.approvedAt) || c.createdAt || null;
        }
        if (!ref) continue;
        const days = (now - new Date(ref).getTime()) / (1000 * 60 * 60 * 24);
        if ((c.accountStatus || 'Active') === 'Active' && days >= 90) {
          const nowIso = new Date().toISOString();
          await Client.updateOne({ accountNumber: c.accountNumber }, {
            $set: { accountStatus: 'Dormant', lastTxnAt: ref },
            $push: { statusHistory: { status: 'Dormant', by: 'system', at: nowIso, remarks: 'Inactive for three months or more', via: 'system' } },
          });
        }
      } catch {}
    }
  } catch {}
}
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
  autoDormantSweep().catch(() => {});
  setInterval(() => { autoDormantSweep().catch(() => {}); }, 24 * 60 * 60 * 1000);
});
