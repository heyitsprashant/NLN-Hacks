const express = require('express');
const Joi = require('joi');
const { analyzeJournalEntry, classifyWithMentalBert } = require('../services/aiService');
const { detectPatternsFromEntries } = require('../services/patternDetector');
const { shouldTriggerBurnout, triggerAlertEmails } = require('../services/alertSystem');
const { readDb, updateDb, getUserId, ensureUser, newId } = require('../utils/dataStore');

const router = express.Router();

const entrySchema = Joi.object({
  text: Joi.string().min(3),
  content: Joi.string().min(3),
  entryDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
  source: Joi.string().valid('web', 'mobile', 'upload').default('web'),
}).or('text', 'content');

const classifySchema = Joi.object({
  text: Joi.string().min(3).required(),
});

router.post('/classify', async (req, res) => {
  const { error, value } = classifySchema.validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error.message });

  try {
    const prediction = await classifyWithMentalBert(value.text);
    return res.json({
      success: true,
      label: prediction.label,
      confidence: prediction.confidence,
      scores: prediction.scores,
    });
  } catch (err) {
    return res.status(502).json({ success: false, message: 'MentalBERT service unavailable', detail: err.message });
  }
});

router.post('/entry', async (req, res) => {
  const { error, value } = entrySchema.validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error.message });

  const userId = getUserId(req);
  let createdAt = new Date().toISOString();
  if (value.entryDate) {
    const selectedDate = new Date(`${value.entryDate}T12:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid entryDate format' });
    }
    if (selectedDate.getTime() > Date.now()) {
      return res.status(400).json({ success: false, message: 'entryDate cannot be in the future' });
    }
    createdAt = selectedDate.toISOString();
  }

  const entryText = value.text || value.content;

  const entry = {
    id: newId('entry'),
    user_id: userId,
    content: entryText,
    source: value.source,
    created_at: createdAt,
    processed: false,
  };

  await updateDb((db) => {
    ensureUser(db, userId);
    db.journal_entries.unshift(entry);
  });

  const analysis = await analyzeJournalEntry(entryText);

  await updateDb((db) => {
    const row = db.journal_entries.find((item) => item.id === entry.id);
    if (!row) return;

    row.emotion = analysis.emotion;
    row.context = analysis.context;
    row.sentiment_score = analysis.sentiment_score;
    row.processing_metadata = analysis.processing_metadata;
    row.processed = true;

    const userEntries = db.journal_entries
      .filter((item) => item.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    const patterns = detectPatternsFromEntries(userEntries);
    const nowIso = new Date().toISOString();

    db.patterns = db.patterns.filter((p) => !(p.user_id === userId && p.status === 'active'));

    for (const pattern of patterns) {
      db.patterns.push({
        id: newId('pattern'),
        user_id: userId,
        ...pattern,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    const burnout = shouldTriggerBurnout(userEntries);
    if (burnout) {
      const alert = {
        id: newId('alert'),
        user_id: userId,
        ...burnout,
        trigger_data: {
          pattern_id: null,
          entry_ids: userEntries.slice(0, 10).map((e) => e.id),
          confidence: 0.8,
        },
        status: 'pending',
        created_at: nowIso,
        resolved_at: null,
        emails_sent: [],
      };

      db.alerts.unshift(alert);

      const user = ensureUser(db, userId);
      triggerAlertEmails(user, burnout)
        .then((sent) => {
          updateDb((db2) => {
            const latest = db2.alerts.find((item) => item.id === alert.id);
            if (!latest) return;
            latest.status = 'sent';
            latest.emails_sent = sent;
          });
        })
        .catch(() => {
          updateDb((db2) => {
            const latest = db2.alerts.find((item) => item.id === alert.id);
            if (!latest) return;
            latest.status = 'failed';
          });
        });
    }
  });

  const db = readDb();
  const saved = db.journal_entries.find((item) => item.id === entry.id);

  return res.status(201).json({
    id: saved.id,
    content: saved.content,
    emotion: saved.emotion?.primary || 'neutral',
    createdAt: saved.created_at,
    source: saved.source,
  });
});

router.get('/entries', (req, res) => {
  const userId = getUserId(req);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

  const db = readDb();
  const all = db.journal_entries
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const emotionFilter = req.query.emotion ? String(req.query.emotion).toLowerCase() : null;
  const filtered = emotionFilter
    ? all.filter((item) => (item.emotion?.primary || 'neutral').toLowerCase() === emotionFilter)
    : all;

  const start = (page - 1) * limit;
  const entries = filtered.slice(start, start + limit).map((item) => ({
    id: item.id,
    content: item.content,
    emotion: item.emotion?.primary || 'neutral',
    createdAt: item.created_at,
  }));

  return res.json({
    entries,
    page,
    hasMore: start + limit < filtered.length,
  });
});

router.delete('/entry/:id', async (req, res) => {
  const userId = getUserId(req);
  const entryId = req.params.id;

  let deleted = false;
  await updateDb((db) => {
    const before = db.journal_entries.length;
    db.journal_entries = db.journal_entries.filter((item) => !(item.id === entryId && item.user_id === userId));
    deleted = db.journal_entries.length < before;
  });

  if (!deleted) return res.status(404).json({ success: false, message: 'Entry not found' });
  return res.json({ success: true, message: 'Entry deleted successfully' });
});

router.post('/upload', async (req, res) => {
  const userId = getUserId(req);
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ success: false, message: 'text is required' });

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const createdIds = [];

  for (const line of lines) {
    const analysis = await analyzeJournalEntry(line);
    const id = newId('entry');
    createdIds.push(id);

    await updateDb((db) => {
      ensureUser(db, userId);
      db.journal_entries.unshift({
        id,
        user_id: userId,
        content: line,
        source: 'upload',
        created_at: new Date().toISOString(),
        processed: true,
        emotion: analysis.emotion,
        context: analysis.context,
        sentiment_score: analysis.sentiment_score,
        processing_metadata: analysis.processing_metadata,
      });
    });
  }

  return res.status(201).json({
    success: true,
    entries_created: createdIds.length,
    entry_ids: createdIds,
  });
});

module.exports = router;
