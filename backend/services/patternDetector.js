function daysBetween(now, dateValue) {
  const date = typeof dateValue?.toDate === 'function' ? dateValue.toDate() : new Date(dateValue);
  const diff = now.getTime() - date.getTime();
  return Math.max(0, diff / (1000 * 60 * 60 * 24));
}

function calculateConfidence(entries) {
  if (!entries.length) return 0;
  const now = new Date();
  const recency = entries
    .map((entry) => Math.exp(-daysBetween(now, entry.created_at) / 14))
    .reduce((sum, n) => sum + n, 0) / entries.length;

  const frequency = Math.min(entries.length / 10, 1);
  return Number(((recency * 0.5) + (frequency * 0.5)).toFixed(2));
}

function detectPatternsFromEntries(entries) {
  const groups = new Map();

  for (const entry of entries) {
    const emotion = entry.emotion?.primary || 'neutral';
    const category = entry.context?.category || 'general';
    const key = `${emotion}__${category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const patterns = [];

  for (const [key, grouped] of groups.entries()) {
    if (grouped.length < 3) continue;

    const [emotion, context] = key.split('__');
    const confidence = calculateConfidence(grouped);
    if (confidence < 0.6) continue;

    const keywordCount = {};
    for (const row of grouped) {
      for (const kw of row.context?.keywords || []) {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      }
    }

    const topKeyword = Object.entries(keywordCount).sort((a, b) => b[1] - a[1])[0]?.[0];
    const firstObserved = grouped
      .map((g) => (typeof g.created_at?.toDate === 'function' ? g.created_at.toDate() : new Date(g.created_at)))
      .sort((a, b) => a - b)[0];
    const lastObserved = grouped
      .map((g) => (typeof g.created_at?.toDate === 'function' ? g.created_at.toDate() : new Date(g.created_at)))
      .sort((a, b) => b - a)[0];

    patterns.push({
      pattern_type: 'emotion_trigger',
      description: `${emotion} related to ${context}${topKeyword ? ` (especially ${topKeyword})` : ''}`,
      confidence,
      supporting_entries: grouped.map((g) => ({ entry_id: g.id, relevance: 1 })),
      metadata: {
        emotion,
        context,
        frequency: grouped.length,
        first_observed: firstObserved,
        last_observed: lastObserved,
      },
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  return patterns;
}

module.exports = {
  detectPatternsFromEntries,
};
