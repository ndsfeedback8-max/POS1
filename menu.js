const { send, staff, route, getMenu, setMenu } = require('./_lib');

module.exports = route(async (req, res) => {
  if (req.method === 'GET') return send(res, 200, (await getMenu()) || { name: '', cats: [], items: [] });
  if (req.method === 'PUT') {
    if (!(await staff(req, res))) return;
    const m = req.body;
    if (!m || !Array.isArray(m.items) || !Array.isArray(m.cats)) return send(res, 400, { error: 'Bad menu' });
    if (typeof m.logo === 'string' && m.logo.length > 400000) m.logo = ''; // Firestore documents are limited to 1 MiB
    await setMenu(m);
    return send(res, 200, { ok: true });
  }
  res.setHeader('Allow', 'GET, PUT');
  send(res, 405, { error: 'Method not allowed' });
});
