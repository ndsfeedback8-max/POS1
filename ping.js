const { send, configured } = require('./_lib');

// 200 only when Redis + POS_PIN are configured; otherwise the register falls back to on-device mode.
module.exports = (req, res) =>
  configured() ? send(res, 200, { ok: true }) : send(res, 503, { ok: false });
