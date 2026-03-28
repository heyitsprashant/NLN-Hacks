const express = require('express');
const { generateCopilotReply } = require('../services/aiService');
const { readDb, updateDb, getUserId, ensureUser, newId } = require('../utils/dataStore');

const router = express.Router();

router.get('/history', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const history = db.voice_history
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((item) => ({
      id: item.id,
      userText: item.userText,
      aiText: item.aiText,
      timestamp: item.timestamp,
    }));

  res.json({ history });
});

router.post('/process', async (req, res) => {
  const userId = getUserId(req);
  const transcript = String(req.body?.transcript || '').trim();
  if (!transcript) return res.status(400).json({ success: false, message: 'transcript is required' });

  const aiText = await generateCopilotReply(transcript, {
    recent_entries: [],
    patterns: [],
  });

  const item = {
    id: newId('voice'),
    user_id: userId,
    userText: transcript,
    aiText,
    timestamp: new Date().toISOString(),
  };

  await updateDb((db) => {
    ensureUser(db, userId);
    db.voice_history.unshift(item);
  });

  res.json({ responseText: aiText });
});

module.exports = router;
