const { redis, send, staff, route, ipOf } = require('../_lib');

const PHONE = /^[+\d][\d\s-]{6,17}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

module.exports = route(async (req, res) => {
  if (req.method === 'GET') {
    if (!(await staff(req, res))) return;
    const all = ((await redis('HVALS', 'pos:orders')) || []).map((x) => JSON.parse(x));
    return send(res, 200, all.filter((o) => o.status === 'new').sort((a, b) => a.ts - b.ts));
  }

  if (req.method === 'POST') {
    // Public endpoint (customer QR page): rate-limit per IP, and price everything from the published menu.
    const rl = 'pos:rl:' + ipOf(req);
    if ((await redis('INCR', rl)) === 1) await redis('EXPIRE', rl, 3600);
    if ((+(await redis('GET', rl)) || 0) > 15) return send(res, 429, { error: 'Too many orders. Try again later.' });

    const b = req.body || {};
    const cust = { n: str(b.cust?.n, 80), ph: str(b.cust?.ph, 18), ad: str(b.cust?.ad, 300) };
    if (cust.n.length < 2 || !PHONE.test(cust.ph) || cust.ad.length < 5) return send(res, 400, { error: 'Invalid details' });
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) return send(res, 400, { error: 'Invalid items' });

    const raw = await redis('GET', 'pos:menu');
    if (!raw) return send(res, 503, { error: 'Menu not published yet' });
    const byId = new Map(JSON.parse(raw).items.map((i) => [String(i.id), i]));

    const items = [];
    for (const it of b.items) {
      const m = byId.get(String(it?.id));
      const q = Math.floor(+it?.q);
      if (!m || m.ok === false || !(q >= 1 && q <= 99)) return send(res, 400, { error: 'Item unavailable' });
      items.push({ id: m.id, n: m.n, q, p: m.p });
    }

    const id = 'Q' + (await redis('INCR', 'pos:seq'));
    const order = { id, status: 'new', ts: Date.now(), items, cust, note: str(b.note, 300) };
    await redis('HSET', 'pos:orders', id, JSON.stringify(order));

    // Keep the hash small: drop the oldest 100 once it passes 300 orders.
    if ((await redis('HLEN', 'pos:orders')) > 300) {
      const keys = (await redis('HKEYS', 'pos:orders')).sort((a, b) => +a.slice(1) - +b.slice(1)).slice(0, 100);
      await redis('HDEL', 'pos:orders', ...keys);
    }
    return send(res, 201, order);
  }

  res.setHeader('Allow', 'GET, POST');
  send(res, 405, { error: 'Method not allowed' });
});
