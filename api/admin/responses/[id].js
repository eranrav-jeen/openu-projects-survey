const { Redis } = require('@upstash/redis');
const { checkAuth } = require('../../_auth');

const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'DELETE') return res.status(405).end();

  const { id } = req.query;
  await redis.hdel('survey:responses', id);
  res.json({ success: true });
};
