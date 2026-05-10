const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Redis = require('ioredis');
const { Resend } = require('resend');
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

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'dana@jeen.ai';
const FROM_EMAIL   = process.env.FROM_EMAIL   || 'survey@jeen.ai';

async function sendNotification(entry) {
  if (!resend) return;
  const roleMap = { 'סטודנט': 'Student', 'מרצה': 'Lecturer', 'צוות מנהלי': 'Admin Staff', 'אחר': 'Other' };
  await resend.emails.send({
    from: `Jeen Survey <${FROM_EMAIL}>`,
    to: NOTIFY_EMAIL,
    subject: `New AI Project Proposal: ${entry.projectName || '(no title)'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#4a1060,#e0368c);padding:24px 32px;border-radius:10px 10px 0 0">
          <h1 style="color:#fff;margin:0;font-size:1.3rem">New Survey Response</h1>
          <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:0.9rem">Open University AI Project Proposal</p>
        </div>
        <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px">
          <table style="width:100%;border-collapse:collapse;font-size:0.92rem">
            <tr><td style="padding:8px 0;color:#6b7280;width:40%">Name</td>
                <td style="padding:8px 0;font-weight:600">${entry.fullName || '—'}</td></tr>
            <tr style="background:#fafafa"><td style="padding:8px 0;color:#6b7280">Email</td>
                <td style="padding:8px 0"><a href="mailto:${entry.email}">${entry.email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Role</td>
                <td style="padding:8px 0">${roleMap[entry.role] || entry.role || '—'}</td></tr>
            <tr style="background:#fafafa"><td style="padding:8px 0;color:#6b7280">Department</td>
                <td style="padding:8px 0">${entry.department || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Project Name</td>
                <td style="padding:8px 0;font-weight:600;color:#4a1060">${entry.projectName || '—'}</td></tr>
            <tr style="background:#fafafa"><td style="padding:8px 0;color:#6b7280">Description</td>
                <td style="padding:8px 0">${entry.projectDescription || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Problem</td>
                <td style="padding:8px 0">${entry.mainProblem || '—'}</td></tr>
            <tr style="background:#fafafa"><td style="padding:8px 0;color:#6b7280">Target Audience</td>
                <td style="padding:8px 0">${entry.targetAudience || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">AI Type(s)</td>
                <td style="padding:8px 0">${entry.aiTypes || '—'}</td></tr>
            <tr style="background:#fafafa"><td style="padding:8px 0;color:#6b7280">Submitted</td>
                <td style="padding:8px 0">${new Date(entry.submittedAt).toLocaleString('en-IL')}</td></tr>
          </table>
          <div style="margin-top:24px;text-align:center">
            <a href="${process.env.ADMIN_URL || '#'}/admin"
               style="background:linear-gradient(135deg,#4a1060,#e0368c);color:#fff;padding:12px 28px;
                      border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem">
              View in Admin Panel →
            </a>
          </div>
        </div>
      </div>`,
  }).catch((err) => console.error('Email send error:', err.message));
}

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
  sendNotification(entry); // fire-and-forget, don't block the response
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
