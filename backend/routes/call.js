const express = require('express');
const { readDb, updateDb, getUserId, ensureUser, newId } = require('../utils/dataStore');

const router = express.Router();

router.get('/number', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();
  const user = ensureUser(db, userId);

  const phoneNumber = user.support_phone_number || process.env.SUPPORT_PHONE_NUMBER || '+1 (000) 000-0000';
  res.json({ phoneNumber });
});

router.get('/history', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const history = db.calls
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      durationSeconds: item.durationSeconds,
      emotion: item.emotion,
      transcript: item.transcript,
    }));

  res.json({ history });
});

router.post('/log', async (req, res) => {
  const userId = getUserId(req);
  const durationSeconds = Number(req.body?.durationSeconds || 0);
  const emotion = String(req.body?.emotion || 'neutral');
  const transcript = String(req.body?.transcript || '');

  const record = {
    id: newId('call'),
    user_id: userId,
    timestamp: new Date().toISOString(),
    durationSeconds,
    emotion,
    transcript,
  };

  await updateDb((db) => {
    ensureUser(db, userId);
    db.calls.unshift(record);
  });

  res.status(201).json({ success: true, call: record });
});

module.exports = router;
