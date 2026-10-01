const crypto = require('crypto');

const PIN = process.env.POS_PIN;

// ---- Firebase credentials: FIREBASE_SERVICE_ACCOUNT (JSON or base64 of it), or the 3 separate variables ----
let keyInfo; // { key, problem }
function loadKey() {
  if (keyInfo) return keyInfo;
  try {
    const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
    let key = null;
    if (raw) {
      key = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      key = {
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
      };
    }
    if (key && key.private_key) key.private_key = String(key.private_key).replace(/\\n/g, '\n');
    if (key && !(key.project_id && key.client_email && key.private_key)) throw new Error('incomplete');
    keyInfo = { key, problem: null };
  } catch (e) {
    keyInfo = { key: null, problem: 'FIREBASE_SERVICE_ACCOUNT (not valid: paste the whole downloaded JSON file)' };
  }
  return keyInfo;
}

const status = () => {
  const { key, problem } = loadKey();
  const missing = [];
  if (problem) missing.push(problem);
  else if (!key) missing.push('FIREBASE_SERVICE_ACCOUNT');
  if (!PIN) missing.push('POS_PIN');
  return { missing };
};
const configured = () => !status().missing.length;

// ---- Firestore (firebase-admin) ----
let _db;
function db() {
  if (_db) return _db;
  const { initializeApp, getApps, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ credential: cert(loadKey().key) });
  return (_db = getFirestore());
}

const safe = (s) => String(s).replace(/[^\w.-]/g, '_').slice(0, 100);
const col = (n) => db().collection(n);

// Windowed counter (rate limits / PIN lockout). Returns the new count.
async function bump(name, id, ttlSec) {
  const ref = col(name).doc(safe(id));
  return db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const now = Date.now();
    let n = 0, exp = now + ttlSec * 1000;
    if (s.exists) { const d = s.data(); if (d.exp > now) { n = d.n; exp = d.exp; } }
    n += 1;
    tx.set(ref, { n, exp });
    return n;
  });
}
async function peek(name, id) {
  const s = await col(name).doc(safe(id)).get();
  if (!s.exists) return 0;
  const d = s.data();
  return d.exp > Date.now() ? d.n : 0;
}
async function nextSeq() {
  const ref = col('pos_state').doc('seq');
  return db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const n = (s.exists ? s.data().n : 0) + 1;
    tx.set(ref, { n });
    return n;
  });
}

const getMenu = async () => {
  const s = await col('pos_state').doc('menu').get();
  return s.exists ? JSON.parse(s.data().json) : null;
};
const hasMenu = async () => (await col('pos_state').doc('menu').get()).exists;
const setMenu = (m) => col('pos_state').doc('menu').set({ json: JSON.stringify(m) });

const addOrder = (o) => col('pos_orders').doc(o.id).set(o);
const getOrder = async (id) => {
  const s = await col('pos_orders').doc(safe(id)).get();
  return s.exists ? s.data() : null;
};
const saveOrder = (o) => col('pos_orders').doc(o.id).set(o);
const listNew = async () => {
  const q = await col('pos_orders').where('status', '==', 'new').get();
  return q.docs.map((d) => d.data()).sort((a, b) => a.ts - b.ts);
};
// Delete orders older than 3 days (50 at a time) so the collection stays small.
async function trimOrders() {
  const q = await col('pos_orders').where('ts', '<', Date.now() - 3 * 864e5).limit(50).get();
  if (q.empty) return;
  const b = db().batch();
  q.docs.forEach((d) => b.delete(d.ref));
  await b.commit();
}

// Human-readable reason for a Firestore failure (shown by the register's QR order check).
const reasonOf = (e) => {
  const c = e && e.code;
  if (c === 5 || c === 'not-found') return 'Firestore database not created yet (Firebase console → Build → Firestore Database → Create database)';
  if (c === 7 || c === 'permission-denied') return 'Firestore is disabled or this key has no access (check the key belongs to the same Firebase project)';
  if (c === 16 || c === 'unauthenticated') return 'The service-account key was rejected (generate a new key and paste it again)';
  return 'could not reach Firestore';
};

function send(res, code, body) {
  res.status(code).setHeader('Cache-Control', 'no-store').json(body);
}

const ipOf = (req) =>
  String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'x').split(',')[0].trim();

// True if the request has the right staff PIN. Locks an IP out after 10 wrong tries / 15 min.
async function staff(req, res) {
  const ip = ipOf(req);
  if ((await peek('pos_fail', ip)) >= 10) { send(res, 429, { error: 'Too many attempts. Try again later.' }); return false; }
  const a = Buffer.from(String(req.headers['x-pin'] || ''));
  const b = Buffer.from(PIN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  await bump('pos_fail', ip, 900);
  send(res, 401, { error: 'Wrong PIN' });
  return false;
}

const route = (fn) => async (req, res) => {
  try {
    if (!configured()) return send(res, 503, { error: 'Order server not configured' });
    await fn(req, res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
};

module.exports = {
  send, staff, route, ipOf, configured, status, reasonOf,
  bump, nextSeq, getMenu, hasMenu, setMenu, addOrder, getOrder, saveOrder, listNew, trimOrders,
};
