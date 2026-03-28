const express = require('express');
const Joi = require('joi');
const { readDb, updateDb, getUserId, ensureUser } = require('../utils/dataStore');

const router = express.Router();

const contactsSchema = Joi.object({
  contacts: Joi.array()
    .max(4)
    .items(
      Joi.object({
        email: Joi.string().email().required(),
        verified: Joi.boolean().optional(),
        alertsEnabled: Joi.boolean().optional(),
      }),
    )
    .required(),
});

router.get('/user', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();
  const user = ensureUser(db, userId);

  res.json({
    email: user.email,
    timezone: user.timezone,
    notifications: user.notifications,
    contacts: user.trusted_contacts,
    alerts: {
      burnoutRisk: user.settings?.burnoutRisk ?? true,
      anxietyPattern: user.settings?.anxietyPattern ?? true,
      sensitivity: user.settings?.alert_sensitivity || 'medium',
      quietHoursEnabled: user.settings?.quietHoursEnabled ?? false,
      quietHoursStart: user.settings?.quietHoursStart || '22:00',
      quietHoursEnd: user.settings?.quietHoursEnd || '08:00',
    },
    privacy: {
      dataCollectionEnabled: user.privacy?.dataCollectionEnabled ?? true,
    },
  });
});

router.put('/contacts', async (req, res) => {
  const { error, value } = contactsSchema.validate(req.body || {});
  if (error) return res.status(400).json({ success: false, message: error.message });

  const userId = getUserId(req);
  await updateDb((db) => {
    const user = ensureUser(db, userId);
    user.trusted_contacts = value.contacts.map((c) => ({
      email: c.email,
      verified: Boolean(c.verified),
      alertsEnabled: c.alertsEnabled !== false,
      added_at: new Date().toISOString(),
    }));
    user.updated_at = new Date().toISOString();
  });

  res.json({ success: true, contacts: value.contacts });
});

router.put('/alerts', async (req, res) => {
  const userId = getUserId(req);
  await updateDb((db) => {
    const user = ensureUser(db, userId);
    user.settings = {
      ...user.settings,
      burnoutRisk: Boolean(req.body?.burnoutRisk),
      anxietyPattern: Boolean(req.body?.anxietyPattern),
      alert_sensitivity: req.body?.sensitivity || user.settings?.alert_sensitivity || 'medium',
      quietHoursEnabled: Boolean(req.body?.quietHoursEnabled),
      quietHoursStart: req.body?.quietHoursStart || user.settings?.quietHoursStart || '22:00',
      quietHoursEnd: req.body?.quietHoursEnd || user.settings?.quietHoursEnd || '08:00',
      alerts_enabled: true,
    };
    user.updated_at = new Date().toISOString();
  });

  res.json({ success: true });
});

router.put('/privacy', async (req, res) => {
  const userId = getUserId(req);
  await updateDb((db) => {
    const user = ensureUser(db, userId);

    user.email = req.body?.email || user.email;
    user.timezone = req.body?.timezone || user.timezone;
    user.notifications = req.body?.notifications || user.notifications;
    user.privacy = {
      ...user.privacy,
      ...(req.body?.privacy || {}),
    };
    user.updated_at = new Date().toISOString();
  });

  res.json({ success: true });
});

router.delete('/delete-data', async (req, res) => {
  const userId = getUserId(req);

  await updateDb((db) => {
    db.journal_entries = db.journal_entries.filter((item) => item.user_id !== userId);
    db.patterns = db.patterns.filter((item) => item.user_id !== userId);
    db.chat_messages = db.chat_messages.filter((item) => item.user_id !== userId);
    db.calls = db.calls.filter((item) => item.user_id !== userId);
    db.alerts = db.alerts.filter((item) => item.user_id !== userId);
    db.voice_history = db.voice_history.filter((item) => item.user_id !== userId);
  });

  res.json({ success: true, message: 'All user data has been permanently deleted' });
});

router.delete('/delete-account', async (req, res) => {
  const userId = getUserId(req);

  await updateDb((db) => {
    delete db.users[userId];
    db.journal_entries = db.journal_entries.filter((item) => item.user_id !== userId);
    db.patterns = db.patterns.filter((item) => item.user_id !== userId);
    db.chat_messages = db.chat_messages.filter((item) => item.user_id !== userId);
    db.calls = db.calls.filter((item) => item.user_id !== userId);
    db.alerts = db.alerts.filter((item) => item.user_id !== userId);
    db.voice_history = db.voice_history.filter((item) => item.user_id !== userId);
  });

  res.json({ success: true, message: 'Account deleted' });
});

module.exports = router;
