const { send, status, hasMenu, reasonOf } = require('./_lib');

// Public health check used by the register's "QR order check". Reveals setup state only, never secrets.
module.exports = async (req, res) => {
  const { missing } = status();
  if (missing.length) return send(res, 503, { ok: false, missing });
  try {
    return send(res, 200, { ok: true, missing: [], db: 'ok', menu: await hasMenu() });
  } catch (e) {
    console.error(e);
    return send(res, 503, { ok: false, missing: [], db: 'fail', reason: reasonOf(e) });
  }
};
