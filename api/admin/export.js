const { Redis } = require('@upstash/redis');
const { checkAuth } = require('../_auth');

const redis = Redis.fromEnv();

const FIELD_ORDER = [
  'id', 'submittedAt', 'fullName', 'email', 'role', 'department',
  'projectName', 'projectDescription', 'mainProblem', 'currentSolution',
  'currentDisadvantages', 'targetAudience', 'userCount', 'expectedImprovement',
  'aiTypes', 'requiredData', 'personalized', 'integrations', 'uiTypes',
  'customUI', 'customUIDetails', 'additionalNotes',
];

module.exports = async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).end();

  const raw = (await redis.hgetall('survey:responses')) || {};
  const responses = Object.values(raw).map((v) =>
    typeof v === 'string' ? JSON.parse(v) : v
  );

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
};
