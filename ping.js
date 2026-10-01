const { send, configured, status } = require('./_lib');

// Public health check. 200 only when Redis + POS_PIN are set; otherwise the register falls back to on-device mode.
module.exports = (req, res) => {
  const st = status();
  send(res, configured() ? 200 : 503, { ok: configured(), missing: st.missing });
};
