const { Redis } = require('@upstash/redis');
const { v4: uuidv4 } = require('uuid');

const redis = Redis.fromEnv();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const entry = {
    id: uuidv4(),
    submittedAt: new Date().toISOString(),
    ...req.body,
  };

  await redis.hset('survey:responses', { [entry.id]: JSON.stringify(entry) });
  res.json({ success: true, id: entry.id });
};
