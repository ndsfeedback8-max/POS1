const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PIN = process.env.POS_PIN;

const configured = () => !!(URL_ && TOKEN && PIN);

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || 'redis ' + r.status);
  return j.result;
}

function send(res, code, body) {
  res.status(code).setHeader('Cache-Control', 'no-store').json(body);
}

const ipOf = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();

// Returns true if the request carries the right staff PIN. Locks an IP out after 10 wrong tries / 15 min.
async function staff(req, res) {
  const key = 'pos:fail:' + ipOf(req);
  if ((+(await redis('GET', key)) || 0) >= 10) {
    send(res, 429, { error: 'Too many attempts. Try again later.' });
    return false;
  }
  const a = Buffer.from(String(req.headers['x-pin'] || ''));
  const b = Buffer.from(PIN);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  if ((await redis('INCR', key)) === 1) await redis('EXPIRE', key, 900);
  send(res, 401, { error: 'Wrong PIN' });
  return false;
}

// Wraps a handler: checks configuration, handles errors and CORS-free JSON responses.
const route = (fn) => async (req, res) => {
  try {
    if (!configured()) return send(res, 503, { error: 'Order server not configured' });
    await fn(req, res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
};

module.exports = { redis, send, staff, route, ipOf, configured };
