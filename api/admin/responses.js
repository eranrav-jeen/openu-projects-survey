const { Redis } = require('@upstash/redis');
const { checkAuth } = require('../_auth');

const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const raw = (await redis.hgetall('survey:responses')) || {};
  const responses = Object.values(raw).map((v) =>
    typeof v === 'string' ? JSON.parse(v) : v
  );
  responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(responses);
};
