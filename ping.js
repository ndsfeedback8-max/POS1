const { send } = require('./_lib');

// Public health check. 200 only when Redis + POS_PIN are set; otherwise the register falls back to on-device mode.
module.exports = (req, res) => {
  const missing = [];
  if (!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)) missing.push('REDIS_URL');
  if (!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)) missing.push('REDIS_TOKEN');
  if (!process.env.POS_PIN) missing.push('POS_PIN');
  send(res, missing.length ? 503 : 200, { ok: !missing.length, missing });
};
