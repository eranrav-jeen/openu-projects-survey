const express = require('express');
const basicAuth = require('express-basic-auth');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jeen2025';
const DATA_FILE = path.join(__dirname, 'data', 'responses.json');

// Ensure data directory and file exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

function loadResponses() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveResponses(responses) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(responses, null, 2));
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Submit a survey response
app.post('/api/submit', (req, res) => {
  const responses = loadResponses();
  const entry = {
    id: uuidv4(),
    submittedAt: new Date().toISOString(),
    ...req.body,
  };
  responses.push(entry);
  saveResponses(responses);
  res.json({ success: true, id: entry.id });
});

// Admin: list all responses (protected)
app.get(
  '/api/admin/responses',
  basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }),
  (req, res) => {
    res.json(loadResponses());
  }
);

// Admin: delete a response (protected)
app.delete(
  '/api/admin/responses/:id',
  basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }),
  (req, res) => {
    const responses = loadResponses().filter((r) => r.id !== req.params.id);
    saveResponses(responses);
    res.json({ success: true });
  }
);

// Admin: export CSV (protected)
app.get(
  '/api/admin/export',
  basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }),
  (req, res) => {
    const responses = loadResponses();
    if (responses.length === 0) {
      return res.status(204).end();
    }
    const keys = Object.keys(responses[0]);
    const csv = [
      keys.join(','),
      ...responses.map((r) =>
        keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="survey-responses.csv"');
    res.send('﻿' + csv); // BOM for Excel Hebrew support
  }
);

// Admin panel page (protected)
app.get(
  '/admin',
  basicAuth({ users: { [ADMIN_USER]: ADMIN_PASS }, challenge: true }),
  (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  }
);

app.listen(PORT, () => {
  console.log(`Survey running at http://localhost:${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin  (user: ${ADMIN_USER})`);
});
