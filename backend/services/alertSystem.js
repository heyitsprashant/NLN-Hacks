const { sendAlertEmail } = require('./emailService');
const { generateTrustedContactEmail } = require('./aiService');

const NEGATIVE_EMOTIONS = new Set(['stress', 'anxiety', 'sadness', 'anger']);

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function deriveWellbeingScore(entry) {
  const sentimentRaw = Number(entry?.sentiment_score);
  const hasSentiment = Number.isFinite(sentimentRaw);
  const sentimentScore = hasSentiment ? clamp01((sentimentRaw + 1) / 2) : null;

  const primaryEmotion = String(entry?.emotion?.primary || 'neutral').toLowerCase();
  const intensity = clamp01(Number(entry?.emotion?.intensity ?? 0.5));
  const emotionScore = NEGATIVE_EMOTIONS.has(primaryEmotion)
    ? clamp01(1 - intensity)
    : clamp01(0.65 + (1 - intensity) * 0.35);

  if (sentimentScore === null) return Number(emotionScore.toFixed(3));
  return Number(Math.min(sentimentScore, emotionScore).toFixed(3));
}

function deriveMoodScore(entry) {
  const sentimentRaw = Number(entry?.sentiment_score);
  if (Number.isFinite(sentimentRaw)) {
    return clamp01((sentimentRaw + 1) / 2);
  }

  const primaryEmotion = String(entry?.emotion?.primary || 'neutral').toLowerCase();
  const intensity = clamp01(Number(entry?.emotion?.intensity ?? 0.5));

  if (['joy', 'calm', 'positive'].includes(primaryEmotion)) return clamp01(0.5 + intensity * 0.5);
  if (['sadness', 'stress', 'anxiety', 'anger', 'negative'].includes(primaryEmotion)) return clamp01(0.5 - intensity * 0.5);
  return 0.5;
}

function shouldTriggerBurnout(entries) {
  const minCount = Number(process.env.ALERT_MIN_STRESS_ENTRIES || 5);
  const minIntensity = Number(process.env.ALERT_MIN_INTENSITY || 0.7);

  const stressEntries = entries.filter((entry) => {
    const emotion = entry.emotion?.primary;
    const intensity = Number(entry.emotion?.intensity || 0);
    return ['stress', 'anxiety'].includes(emotion) && intensity >= minIntensity;
  });

  return stressEntries.length >= minCount
    ? {
        alert_type: 'burnout_risk',
        severity: 'high',
        title: 'Sustained High Stress Detected',
        description: `Detected ${stressEntries.length} high-stress entries recently.`,
      }
    : null;
}

function evaluateLowWellbeingAlert(user, entries, nowIso = new Date().toISOString()) {
  const threshold = Number(process.env.ALERT_WELLBEING_THRESHOLD || 0.5);
  const delayDays = Number(process.env.ALERT_WELLBEING_DELAY_DAYS || 3);
  const delayMs = Math.max(1, delayDays) * 24 * 60 * 60 * 1000;

  const latestEntry = Array.isArray(entries) ? entries[0] : null;
  const existingTracker = user?.settings?.low_wellbeing_tracker || {};
  const nowMs = Date.parse(nowIso) || Date.now();

  if (!latestEntry) {
    return {
      score: null,
      tracker: {
        ...existingTracker,
        lastObservedAt: nowIso,
      },
      alert: null,
    };
  }

  const score = deriveWellbeingScore(latestEntry);

  if (score >= threshold) {
    return {
      score,
      tracker: {
        activeSince: null,
        alertedAt: null,
        lastObservedAt: nowIso,
        lastScore: score,
      },
      alert: null,
    };
  }

  const activeSince = existingTracker.activeSince || latestEntry.created_at || nowIso;
  const activeSinceMs = Date.parse(activeSince) || nowMs;
  const alertedAt = existingTracker.alertedAt || null;
  const alertedAtMs = alertedAt ? (Date.parse(alertedAt) || 0) : 0;
  const shouldAlert = nowMs - activeSinceMs >= delayMs && alertedAtMs < activeSinceMs;

  return {
    score,
    tracker: {
      activeSince,
      alertedAt: shouldAlert ? nowIso : alertedAt,
      lastObservedAt: nowIso,
      lastScore: score,
    },
    alert: shouldAlert
      ? {
          alert_type: 'low_wellbeing_3day',
          severity: 'high',
          title: 'Low Well-being Pattern Sustained For 3 Days',
          description: `Well-being score has remained below ${threshold.toFixed(2)} for at least ${delayDays} days.`,
          trigger_data: {
            score,
            threshold,
            active_since: activeSince,
            delay_days: delayDays,
          },
        }
      : null,
  };
}

function evaluateAverageMoodAlert(user, entries, nowIso = new Date().toISOString()) {
  const threshold = Number(process.env.ALERT_AVG_MOOD_THRESHOLD || 0.4);
  const lookbackDays = Number(process.env.ALERT_AVG_MOOD_LOOKBACK_DAYS || 7);
  const minEntries = Number(process.env.ALERT_AVG_MOOD_MIN_ENTRIES || 3);
  const nowMs = Date.parse(nowIso) || Date.now();
  const cutoffMs = nowMs - Math.max(1, lookbackDays) * 24 * 60 * 60 * 1000;

  const recentEntries = (Array.isArray(entries) ? entries : []).filter((entry) => {
    const ts = Date.parse(entry?.created_at || '');
    return Number.isFinite(ts) && ts >= cutoffMs;
  });

  const existingTracker = user?.settings?.avg_mood_tracker || {};

  if (recentEntries.length < minEntries) {
    return {
      avgMood: null,
      tracker: {
        ...existingTracker,
        lastObservedAt: nowIso,
      },
      alert: null,
    };
  }

  const avgMood = recentEntries.reduce((sum, entry) => sum + deriveMoodScore(entry), 0) / recentEntries.length;
  const avgMoodRounded = Number(clamp01(avgMood).toFixed(3));

  if (avgMoodRounded >= threshold) {
    return {
      avgMood: avgMoodRounded,
      tracker: {
        lastAlertedAt: null,
        lastObservedAt: nowIso,
        lastAverageMood: avgMoodRounded,
      },
      alert: null,
    };
  }

  const lastAlertedAt = existingTracker.lastAlertedAt || null;
  const lastAlertedMs = lastAlertedAt ? (Date.parse(lastAlertedAt) || 0) : 0;
  const shouldAlert = nowMs - lastAlertedMs >= 24 * 60 * 60 * 1000;

  return {
    avgMood: avgMoodRounded,
    tracker: {
      lastAlertedAt: shouldAlert ? nowIso : lastAlertedAt,
      lastObservedAt: nowIso,
      lastAverageMood: avgMoodRounded,
    },
    alert: shouldAlert
      ? {
          alert_type: 'avg_mood_below_40',
          severity: 'high',
          title: 'Average Mood Below 40',
          description: `Average mood is ${(avgMoodRounded * 100).toFixed(0)} over the last ${lookbackDays} days (threshold: ${(threshold * 100).toFixed(0)}).`,
          trigger_data: {
            average_mood: avgMoodRounded,
            threshold,
            lookback_days: lookbackDays,
            entries_considered: recentEntries.length,
          },
        }
      : null,
  };
}

function summarizeRecentSignals(entries) {
  const recent = (entries || []).slice(0, 7);
  if (recent.length === 0) {
    return 'Recent ML signals indicate an ongoing emotional strain.';
  }

  const emotionCounts = recent.reduce((acc, entry) => {
    const key = String(entry?.emotion?.primary || 'neutral').toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'stress';
  const avgIntensity = recent
    .map((entry) => Number(entry?.emotion?.intensity || 0))
    .reduce((sum, value) => sum + value, 0) / recent.length;

  return `Recent ML analysis shows frequent ${dominantEmotion} signals with average intensity ${Math.max(0, Math.min(1, avgIntensity)).toFixed(2)}.`;
}

async function triggerAlertEmails(user, alert, options = {}) {
  const ignoreAlertToggle = options.ignoreAlertToggle === true;
  if (!ignoreAlertToggle && !user?.settings?.alerts_enabled) {
    return [];
  }

  const contacts = (user.trusted_contacts || []).filter((c) => c?.email && c.alertsEnabled !== false);
  const fallbackRecipient =
    options.fallbackRecipient || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null;
  const recipients = contacts.map((contact) => contact.email).filter(Boolean);

  if (recipients.length === 0 && fallbackRecipient && options.allowFallbackRecipient === true) {
    recipients.push(fallbackRecipient);
  }

  if (recipients.length === 0) {
    return [];
  }

  const recentEntries = Array.isArray(options.entries) ? options.entries : [];
  const userHandle = `@${String(user.username || user.id || 'profile').replace(/^@+/, '')}`;
  const userName = user.name || user.displayName || user.id || 'your contact';
  const situationSummary = String(options.situationSummary || summarizeRecentSignals(recentEntries));
  const recommendedSupport = String(
    options.recommendedSupport ||
      'Please check in soon, listen without judgment, and help with one small concrete next step today.',
  );
  const alertTitle = String(alert?.title || options.alertTitle || 'Journal Update');
  const severity = String(alert?.severity || options.severity || 'info').toUpperCase();
  try {
    const emailBody = await generateTrustedContactEmail({
      userName,
      userHandle,
      contactName: 'trusted contact',
      alertTitle,
      situationSummary,
      recommendedSupport,
    });

    const result = await sendAlertEmail({
      to: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      bcc: recipients,
      subject: `[${severity}] ${alertTitle} - ${userHandle}`,
      text: emailBody,
    });

    if (result?.success) {
      return recipients.map((email) => ({ recipient: email, sent_at: new Date(), status: 'sent' }));
    }

    return recipients.map((email) => ({
      recipient: email,
      sent_at: new Date(),
      status: 'failed',
      reason: result?.message || 'Unknown SMTP error',
    }));
  } catch (error) {
    return recipients.map((email) => ({
      recipient: email,
      sent_at: new Date(),
      status: 'failed',
      reason: error.message,
    }));
  }
}

module.exports = {
  shouldTriggerBurnout,
  evaluateLowWellbeingAlert,
  evaluateAverageMoodAlert,
  triggerAlertEmails,
};
