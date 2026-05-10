const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jeen2025';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('Redis error:', err.message));

/* ── Storage helpers ── */
async function loadResponses() {
  const raw = await redis.hgetall('survey:responses');
  if (!raw) return [];
  return Object.values(raw).map((v) => JSON.parse(v));
}

/* ── Auth middleware (returns JSON 401 so the admin login overlay handles it) ── */
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Jeen Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const decoded = Buffer.from(auth.slice(6), 'base64').toString();
  const colon = decoded.indexOf(':');
  const user = decoded.slice(0, colon);
  const pass = decoded.slice(colon + 1);
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Jeen Admin"');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ── Survey submit ── */
app.post('/api/submit', async (req, res) => {
  const entry = {
    id: uuidv4(),
    submittedAt: new Date().toISOString(),
    ...req.body,
  };
  await redis.hset('survey:responses', entry.id, JSON.stringify(entry));
  res.json({ success: true, id: entry.id });
});

/* ── Admin: list responses ── */
app.get('/api/admin/responses', requireAuth, async (req, res) => {
  const responses = await loadResponses();
  responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(responses);
});

/* ── Admin: delete response ── */
app.delete('/api/admin/responses/:id', requireAuth, async (req, res) => {
  await redis.hdel('survey:responses', req.params.id);
  res.json({ success: true });
});

/* ── Admin: export CSV ── */
const FIELD_ORDER = [
  'id', 'submittedAt', 'fullName', 'email', 'role', 'department',
  'projectName', 'projectDescription', 'mainProblem', 'currentSolution',
  'currentDisadvantages', 'targetAudience', 'userCount', 'expectedImprovement',
  'aiTypes', 'requiredData', 'personalized', 'integrations', 'uiTypes',
  'customUI', 'customUIDetails', 'additionalNotes',
];

app.get('/api/admin/export', requireAuth, async (req, res) => {
  const responses = await loadResponses();
  if (responses.length === 0) return res.status(204).end();

  responses.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const csv = [
    FIELD_ORDER.join(','),
    ...responses.map((r) =>
      FIELD_ORDER.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="survey-responses.csv"');
  res.send('﻿' + csv);
});

/* ── Admin panel page ── */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Survey running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
