const express = require('express');
const { generateSupportiveSummary } = require('../services/aiService');
const { readDb, getUserId } = require('../utils/dataStore');

const router = express.Router();

function trendFromSeries(series) {
  if (series.length < 2) return 'stable';
  const first = series[0].moodScore;
  const last = series[series.length - 1].moodScore;
  const delta = last - first;
  if (delta > 0.08) return 'improving';
  if (delta < -0.08) return 'declining';
  return 'stable';
}

router.get('/mood-data', (req, res) => {
  const userId = getUserId(req);
  const days = Math.min(90, Math.max(1, Number(req.query.days || 7)));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const db = readDb();
  const rows = db.journal_entries
    .filter((item) => item.user_id === userId && new Date(item.created_at).getTime() >= cutoff)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const grouped = new Map();
  for (const row of rows) {
    const date = new Date(row.created_at).toISOString().slice(0, 10);
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(row);
  }

  const points = Array.from(grouped.entries()).map(([date, list]) => {
    const avg = list.reduce((sum, item) => sum + Number(item.emotion?.intensity || 0.5), 0) / list.length;

    const emotions = {};
    for (const item of list) {
      const emotion = item.emotion?.primary || 'neutral';
      emotions[emotion] = (emotions[emotion] || 0) + 1;
    }

    const topEmotion = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    return {
      timestamp: `${date}T00:00:00.000Z`,
      moodScore: Number(avg.toFixed(2)),
      emotion: topEmotion,
    };
  });

  res.json({ points, trend: trendFromSeries(points) });
});

router.get('/summary', async (req, res) => {
  const userId = getUserId(req);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const db = readDb();
  const entries = db.journal_entries
    .filter((item) => item.user_id === userId && new Date(item.created_at).getTime() >= cutoff)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 100);

  const patterns = db.patterns
    .filter((item) => item.user_id === userId && item.status === 'active')
    .slice(0, 10);

  const dominantEmotions = {};
  const contexts = {};

  for (const entry of entries) {
    const emotion = entry.emotion?.primary || 'neutral';
    const category = entry.context?.category || 'general';
    dominantEmotions[emotion] = (dominantEmotions[emotion] || 0) + 1;
    contexts[category] = (contexts[category] || 0) + 1;
  }

  const summary = await generateSupportiveSummary({
    entries_count: entries.length,
    dominant_emotions: dominantEmotions,
    contexts,
    patterns: patterns.map((p) => ({ description: p.description, confidence: p.confidence })),
  });

  res.json({
    summary,
    generatedAt: new Date().toISOString(),
  });
});

router.get('/patterns', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const patterns = db.patterns
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 30)
    .map((item) => ({
      id: item.id,
      description: item.description,
      confidenceScore: Number(item.confidence || 0),
      entriesCount: Number(item.metadata?.frequency || item.supporting_entries?.length || 0),
    }));

  res.json({ patterns });
});

router.get('/alerts', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const alerts = db.alerts
    .filter((item) => item.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((item) => ({
      id: item.id,
      type: item.alert_type || item.type || 'info',
      severity: item.severity || 'low',
      message: item.description || item.message || 'Alert generated',
      timestamp: item.created_at,
    }));

  res.json({ alerts });
});

module.exports = router;
