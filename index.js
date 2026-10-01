const { send, staff, route, ipOf, bump, nextSeq, getMenu, addOrder, listNew, trimOrders } = require('../_lib');

const PHONE = /^[+\d][\d\s-]{6,17}$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

module.exports = route(async (req, res) => {
  if (req.method === 'GET') {
    if (!(await staff(req, res))) return;
    return send(res, 200, await listNew());
  }

  if (req.method === 'POST') {
    // Public endpoint (customer QR page): rate-limit per IP and price everything from the published menu.
    if ((await bump('pos_rl', ipOf(req), 3600)) > 15) return send(res, 429, { error: 'Too many orders. Try again later.' });

    const b = req.body || {};
    const c = b.cust || {};
    const cust = { n: str(c.n, 80), ph: str(c.ph, 18), ad: str(c.ad, 300) };
    if (cust.n.length < 2 || !PHONE.test(cust.ph) || cust.ad.length < 5) return send(res, 400, { error: 'Invalid details' });
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 50) return send(res, 400, { error: 'Invalid items' });

    const menu = await getMenu();
    if (!menu) return send(res, 503, { error: 'Menu not published yet' });
    const byId = new Map(menu.items.map((i) => [String(i.id), i]));

    const items = [];
    for (const it of b.items) {
      const m = byId.get(String(it && it.id));
      const q = Math.floor(+(it && it.q));
      if (!m || m.ok === false || !(q >= 1 && q <= 99)) return send(res, 400, { error: 'Item unavailable' });
      items.push({ id: m.id, n: m.n, q, p: m.p });
    }

    const id = 'Q' + (await nextSeq());
    const order = { id, status: 'new', ts: Date.now(), items, cust, note: str(b.note, 300) };
    await addOrder(order);
    trimOrders().catch(() => {});
    return send(res, 201, order);
  }

  res.setHeader('Allow', 'GET, POST');
  send(res, 405, { error: 'Method not allowed' });
});
