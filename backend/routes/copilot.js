const express = require('express');
const Joi = require('joi');
const { generateCopilotReply } = require('../services/aiService');
const { readDb, updateDb, getUserId, newId } = require('../utils/dataStore');

const router = express.Router();

const messageSchema = Joi.object({
  message: Joi.string().min(1).required(),
});

router.post('/message', async (req, res) => {
  const { error, value } = messageSchema.validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error.message });

  const userId = getUserId(req);
  const sessionId = String(req.body?.session_id || 'default');

  const db = readDb();
  const recentEntries = db.journal_entries
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 7);

  const patterns = db.patterns
    .filter((item) => item.user_id === userId && item.status === 'active')
    .slice(0, 10);

  const reply = await generateCopilotReply(value.message, {
    recent_entries: recentEntries,
    patterns: patterns.map((p) => p.description),
  });

  const now = new Date().toISOString();

  await updateDb((nextDb) => {
    nextDb.chat_messages.push({
      id: newId('msg'),
      user_id: userId,
      session_id: sessionId,
      role: 'user',
      content: value.message,
      created_at: now,
    });

    nextDb.chat_messages.push({
      id: newId('msg'),
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      content: reply,
      created_at: now,
    });
  });

  res.json({
    success: true,
    message: reply,
  });
});

router.get('/history', (req, res) => {
  const userId = getUserId(req);
  const sessionId = String(req.query.session_id || 'default');

  const db = readDb();
  const messages = db.chat_messages
    .filter((item) => item.user_id === userId && item.session_id === sessionId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      timestamp: item.created_at,
    }));

  res.json({ messages });
});

router.get('/context', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const patterns = db.patterns
    .filter((item) => item.user_id === userId && item.status === 'active')
    .slice(0, 5)
    .map((item) => item.description);

  const recentEntries = db.journal_entries
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      content: item.content,
      emotion: item.emotion?.primary || 'neutral',
    }));

  const tips = [];
  if (patterns.some((p) => p.toLowerCase().includes('stress') || p.toLowerCase().includes('anxiety'))) {
    tips.push('Try a 4-7-8 breathing cycle before high-pressure moments.');
  }
  if (patterns.some((p) => p.toLowerCase().includes('work'))) {
    tips.push('Plan short recovery breaks between focused work sessions.');
  }
  if (tips.length === 0) {
    tips.push('Keep journaling daily to improve pattern detection and guidance.');
  }

  res.json({
    patterns,
    recentEntries,
    tips,
  });
});

module.exports = router;
