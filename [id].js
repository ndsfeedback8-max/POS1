const { redis, send, staff, route } = require('../_lib');

module.exports = route(async (req, res) => {
  const id = String(req.query.id || '').slice(0, 20);
  const raw = await redis('HGET', 'pos:orders', id);
  if (!raw) return send(res, 404, { error: 'Not found' });
  const o = JSON.parse(raw);

  if (req.method === 'GET') return send(res, 200, { id: o.id, status: o.status }); // public: status only, no personal data

  if (req.method === 'PATCH') {
    if (!(await staff(req, res))) return;
    const status = req.body?.status;
    if (!['new', 'accepted', 'declined'].includes(status)) return send(res, 400, { error: 'Bad status' });
    o.status = status;
    await redis('HSET', 'pos:orders', id, JSON.stringify(o));
    return send(res, 200, o);
  }

  res.setHeader('Allow', 'GET, PATCH');
  send(res, 405, { error: 'Method not allowed' });
});
