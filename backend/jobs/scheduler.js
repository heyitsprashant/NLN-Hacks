const cron = require('node-cron');
const { detectPatternsFromEntries } = require('../services/patternDetector');
const {
  shouldTriggerBurnout,
  evaluateLowWellbeingAlert,
  evaluateAverageMoodAlert,
  triggerAlertEmails,
} = require('../services/alertSystem');
const { readDb, updateDb, ensureUser, newId } = require('../utils/dataStore');

async function runPatternSweep() {
  const db = readDb();
  const userIds = Object.keys(db.users || {});

  for (const userId of userIds) {
    const entries = db.journal_entries
      .filter((item) => item.user_id === userId && item.processed)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    const patterns = detectPatternsFromEntries(entries);
    const burnout = shouldTriggerBurnout(entries);
    const nowIso = new Date().toISOString();
    const pendingAlertSends = [];

    await updateDb((nextDb) => {
      const user = ensureUser(nextDb, userId);

      nextDb.patterns = nextDb.patterns.filter((p) => !(p.user_id === userId && p.status === 'active'));

      for (const pattern of patterns) {
        nextDb.patterns.push({
          id: newId('pattern'),
          user_id: userId,
          ...pattern,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      if (burnout) {
        const alert = {
          id: newId('alert'),
          user_id: userId,
          ...burnout,
          trigger_data: {
            pattern_id: null,
            entry_ids: entries.slice(0, 10).map((e) => e.id),
            confidence: 0.75,
          },
          status: 'pending',
          created_at: nowIso,
          resolved_at: null,
          emails_sent: [],
        };

        nextDb.alerts.unshift(alert);
        pendingAlertSends.push({ id: alert.id, payload: burnout });
      }

      const lowWellbeing = evaluateLowWellbeingAlert(user, entries, nowIso);
      const avgMoodAlert = evaluateAverageMoodAlert(user, entries, nowIso);
      user.settings = {
        ...user.settings,
        low_wellbeing_tracker: lowWellbeing.tracker,
        avg_mood_tracker: avgMoodAlert.tracker,
      };

      if (lowWellbeing.alert) {
        const alert = {
          id: newId('alert'),
          user_id: userId,
          ...lowWellbeing.alert,
          status: 'pending',
          created_at: nowIso,
          resolved_at: null,
          emails_sent: [],
        };

        nextDb.alerts.unshift(alert);
        pendingAlertSends.push({ id: alert.id, payload: lowWellbeing.alert });
      }

      if (avgMoodAlert.alert) {
        const alert = {
          id: newId('alert'),
          user_id: userId,
          ...avgMoodAlert.alert,
          status: 'pending',
          created_at: nowIso,
          resolved_at: null,
          emails_sent: [],
        };

        nextDb.alerts.unshift(alert);
        pendingAlertSends.push({ id: alert.id, payload: avgMoodAlert.alert });
      }
    });

    if (pendingAlertSends.length > 0) {
      const latestDb = readDb();
      const user = ensureUser(latestDb, userId);

      for (const pending of pendingAlertSends) {
        try {
          const sent = await triggerAlertEmails(user, pending.payload, { entries });
          await updateDb((db2) => {
            const target = db2.alerts.find((item) => item.id === pending.id);
            if (!target) return;
            target.status = sent.some((item) => item.status === 'sent') ? 'sent' : 'failed';
            target.emails_sent = sent;
          });
        } catch {
          await updateDb((db2) => {
            const target = db2.alerts.find((item) => item.id === pending.id);
            if (!target) return;
            target.status = 'failed';
          });
        }
      }
    }
  }
}

function startScheduler() {
  cron.schedule('0 2 * * *', async () => {
    console.log('[scheduler] Daily pattern sweep started');
    await runPatternSweep();
  });

  cron.schedule('0 */6 * * *', async () => {
    console.log('[scheduler] 6-hour alert sweep started');
    await runPatternSweep();
  });
}

module.exports = {
  startScheduler,
  runPatternSweep,
};
