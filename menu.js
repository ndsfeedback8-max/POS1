const { redis, send, staff, route } = require('./_lib');

module.exports = route(async (req, res) => {
  if (req.method === 'GET') {
    const raw = await redis('GET', 'pos:menu');
    return send(res, 200, raw ? JSON.parse(raw) : { name: '', cats: [], items: [] });
  }
  if (req.method === 'PUT') {
    if (!(await staff(req, res))) return;
    const m = req.body;
    if (!m || !Array.isArray(m.items) || !Array.isArray(m.cats)) return send(res, 400, { error: 'Bad menu' });
    if (typeof m.logo === 'string' && m.logo.length > 700000) m.logo = ''; // keep the payload small
    await redis('SET', 'pos:menu', JSON.stringify(m));
    return send(res, 200, { ok: true });
  }
  res.setHeader('Allow', 'GET, PUT');
  send(res, 405, { error: 'Method not allowed' });
});
