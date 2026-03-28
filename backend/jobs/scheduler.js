const cron = require('node-cron');
const { detectPatternsFromEntries } = require('../services/patternDetector');
const { shouldTriggerBurnout } = require('../services/alertSystem');
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

    await updateDb((nextDb) => {
      ensureUser(nextDb, userId);

      nextDb.patterns = nextDb.patterns.filter((p) => !(p.user_id === userId && p.status === 'active'));
      const nowIso = new Date().toISOString();

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
        nextDb.alerts.unshift({
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
        });
      }
    });
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
