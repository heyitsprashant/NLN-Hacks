const express = require('express');
const twilio = require('twilio');
const { readDb, updateDb, getUserId, ensureUser, newId } = require('../utils/dataStore');
const { generateTherapistVoiceReply } = require('../services/aiService');

const router = express.Router();
const voiceSessions = new Map();

const MAX_CALL_TURNS = Number(process.env.TWILIO_MAX_CALL_TURNS || 30);
const MAX_CALL_DURATION_SECONDS = Number(process.env.TWILIO_MAX_CALL_DURATION_SECONDS || 20 * 60);
const MIN_CALL_DURATION_SECONDS = Number(process.env.TWILIO_MIN_CALL_DURATION_SECONDS || 30);

const DEMO_SCENARIOS = [
  {
    id: 'demo-1-academic-anxiety',
    title: 'Academic Anxiety Before Demo',
    opening: 'I feel very nervous about tomorrow\'s demo and I cannot focus.',
    followUps: [
      'My heart races and I keep thinking I will fail.',
      'I slept very little and now I feel stuck.',
      'Can you give me one small plan for the next hour?',
    ],
    expectedOutcome: 'AI validates anxiety, slows pace, and gives one actionable step with supportive follow-up.',
  },
  {
    id: 'demo-2-lonely-adjustment',
    title: 'Loneliness In New Environment',
    opening: 'I feel lonely even when I am around people.',
    followUps: [
      'It feels like nobody really understands what I am carrying.',
      'I want to connect but I overthink every conversation.',
      'What can I try tonight to feel a little better?',
    ],
    expectedOutcome: 'AI reflects emotions, identifies pattern gently, and guides one social/grounding next step.',
  },
];

function respondWithTwiml(res, voiceResponse) {
  res.type('text/xml');
  res.send(voiceResponse.toString());
}

function normalizePhoneUserId(from) {
  const phone = String(from || '').trim();
  return phone ? `phone:${phone}` : 'local-user';
}

function getPublicBaseUrl(req) {
  const configured = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const host = req.get('host');
  return `${req.protocol}://${host}`;
}

function buildVoiceUrls(req) {
  const baseUrl = getPublicBaseUrl(req);
  return {
    gatherUrl: `${baseUrl}/api/call/gather`,
    statusUrl: `${baseUrl}/api/call/status`,
  };
}

function addSpeechGather(voiceResponse, actionUrl) {
  voiceResponse.gather({
    input: 'speech',
    action: actionUrl,
    method: 'POST',
    speechTimeout: 'auto',
    timeout: Number(process.env.TWILIO_GATHER_TIMEOUT || 10),
  });
}

function isStopIntent(text) {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) return false;

  const stopPatterns = [
    /\bbye\b/,
    /\bgoodbye\b/,
    /\bhang\s*up\b/,
    /\bstop\b/,
    /\bend\s+call\b/,
    /\bthat'?s\s+all\b/,
  ];

  return stopPatterns.some((pattern) => pattern.test(normalized));
}

function getOrCreateSession(callSid, from, to) {
  const sid = String(callSid || '').trim() || newId('twilio-call');
  const existing = voiceSessions.get(sid);
  if (existing) return existing;

  const session = {
    callSid: sid,
    from: String(from || ''),
    to: String(to || ''),
    userId: normalizePhoneUserId(from),
    startedAt: Date.now(),
    turns: [],
    lastEmotion: 'neutral',
    finalized: false,
    storedCallId: null,
  };

  voiceSessions.set(sid, session);
  return session;
}

function getRecentJournalContext(userId) {
  const db = readDb();
  const recentEntries = db.journal_entries
    .filter((entry) => entry.user_id === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3)
    .map((entry) => ({
      timestamp: entry.timestamp,
      mood: entry.mood || entry.emotion?.primary || 'neutral',
      emotion: entry.emotion?.primary || 'neutral',
      risk: entry.risk?.burnout || entry.risk?.anxiety || 'low',
    }));

  if (!recentEntries.length) return null;

  return {
    mood: recentEntries[0].mood,
    emotion: recentEntries[0].emotion,
    risk: recentEntries[0].risk,
    recent_entries: recentEntries,
  };
}

function buildCallerMemoryContext(userId, activeCallSid) {
  const db = readDb();
  const recentCalls = db.calls
    .filter((entry) => entry.user_id === userId && entry.callSid !== activeCallSid)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 2);

  if (!recentCalls.length) {
    return {
      has_prior_calls: false,
      prior_call_count: 0,
      recent_call_snippets: [],
    };
  }

  const snippets = recentCalls.map((call) => {
    const transcript = String(call.transcript || '');
    const callerLines = transcript
      .split('\n')
      .filter((line) => /^Caller:/i.test(line))
      .map((line) => line.replace(/^Caller:\s*/i, '').trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ');

    return {
      timestamp: call.timestamp,
      emotion: call.emotion || 'neutral',
      caller_highlights: callerLines || '',
    };
  });

  return {
    has_prior_calls: true,
    prior_call_count: recentCalls.length,
    recent_call_snippets: snippets,
  };
}

async function persistCallRecord(session, extra = {}) {
  if (!session || session.finalized) return;

  const endedAt = Date.now();
  const durationSeconds = Math.max(
    1,
    Number(
      extra.durationSeconds
      || Math.round((endedAt - session.startedAt) / 1000),
    ),
  );

  const transcript = session.turns
    .map((turn) => `${turn.role === 'assistant' ? 'Antara' : 'Caller'}: ${turn.text}`)
    .join('\n');

  const record = {
    id: newId('call'),
    user_id: session.userId || 'local-user',
    timestamp: new Date().toISOString(),
    durationSeconds,
    emotion: session.lastEmotion || 'neutral',
    transcript,
    callSid: session.callSid,
    from: session.from,
    to: session.to,
  };

  await updateDb((db) => {
    ensureUser(db, record.user_id);
    db.calls.unshift(record);
  });

  session.finalized = true;
  session.storedCallId = record.id;

  // Keep session briefly for status callbacks, then clean up.
  setTimeout(() => {
    if (voiceSessions.get(session.callSid)?.finalized) {
      voiceSessions.delete(session.callSid);
    }
  }, 3 * 60 * 1000);
}

router.get('/number', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();
  const user = ensureUser(db, userId);

  const twilioNumber = process.env.TWILIO_PHONE_NUMBER || '';
  const phoneNumber = twilioNumber || user.support_phone_number || process.env.SUPPORT_PHONE_NUMBER || '+1 (000) 000-0000';
  res.json({ phoneNumber, twilioNumber: twilioNumber || undefined });
});

router.get('/history', (req, res) => {
  const userId = getUserId(req);
  const db = readDb();

  const history = db.calls
    .filter((item) => {
      if (item.user_id === userId) return true;
      // Demo-friendly: include phone-origin records for local dashboard.
      if (userId === 'local-user' && String(item.user_id || '').startsWith('phone:')) return true;
      return false;
    })
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

router.get('/demo-scenarios', (req, res) => {
  res.json({
    scenarios: DEMO_SCENARIOS,
    tip: 'Use opening first, then each follow-up after Antara responds to show true multi-turn conversation.',
  });
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

router.post('/voice', (req, res) => {
  const { CallSid, From, To } = req.body || {};
  const session = getOrCreateSession(CallSid, From, To);
  const { gatherUrl, statusUrl } = buildVoiceUrls(req);

  const response = new twilio.twiml.VoiceResponse();
  response.say('Hi, I am Antara. I am here with you and ready to listen. Tell me what is on your mind today.');

  addSpeechGather(response, gatherUrl);
  response.say('I did not catch that. Take your time, and say a few words when you are ready.');
  addSpeechGather(response, gatherUrl);
  response.say('I am still here whenever you are ready to continue.');
  addSpeechGather(response, gatherUrl);
  response.say('Before we end, I would like to hear one small thing that is on your mind.');

  // Twilio can invoke status callbacks if configured in phone-number settings.
  if (!session.statusCallbackNoted) {
    session.statusCallbackNoted = statusUrl;
  }

  return respondWithTwiml(res, response);
});

router.post('/gather', async (req, res) => {
  const { CallSid, From, To, SpeechResult } = req.body || {};
  const spokenText = String(SpeechResult || '').trim();
  const session = getOrCreateSession(CallSid, From, To);
  const { gatherUrl } = buildVoiceUrls(req);
  const response = new twilio.twiml.VoiceResponse();

  const elapsedSeconds = Math.round((Date.now() - session.startedAt) / 1000);
  const assistantTurnCount = session.turns.filter((turn) => turn.role === 'assistant').length;

  if (!spokenText) {
    response.say('I might have missed that. Could you say that again in a short sentence?');
    addSpeechGather(response, gatherUrl);
    return respondWithTwiml(res, response);
  }

  session.turns.push({ role: 'user', text: spokenText, ts: new Date().toISOString() });

  if (isStopIntent(spokenText)) {
    if (elapsedSeconds < MIN_CALL_DURATION_SECONDS) {
      const remainingSeconds = Math.max(1, MIN_CALL_DURATION_SECONDS - elapsedSeconds);
      const keepOpen = `Let us stay together for about ${remainingSeconds} more seconds so I can support you well. Could you share one more thought before we close?`;
      session.turns.push({ role: 'assistant', text: keepOpen, ts: new Date().toISOString() });
      response.say(keepOpen);
      addSpeechGather(response, gatherUrl);
      return respondWithTwiml(res, response);
    }

    const goodbye = 'Thank you for talking with me today. You are not alone, and I am glad you called. Take gentle care, goodbye for now.';
    session.turns.push({ role: 'assistant', text: goodbye, ts: new Date().toISOString() });

    response.say(goodbye);
    response.hangup();

    await persistCallRecord(session);
    return respondWithTwiml(res, response);
  }

  if (assistantTurnCount >= MAX_CALL_TURNS || elapsedSeconds >= MAX_CALL_DURATION_SECONDS) {
    const timeoutGoodbye = 'I want to honor your time for today. Thank you for sharing with me. Please call again anytime you want support. Goodbye for now.';
    session.turns.push({ role: 'assistant', text: timeoutGoodbye, ts: new Date().toISOString() });

    response.say(timeoutGoodbye);
    response.hangup();

    await persistCallRecord(session, { durationSeconds: elapsedSeconds });
    return respondWithTwiml(res, response);
  }

  try {
    const journalContext = getRecentJournalContext(session.userId);
    const callerMemory = buildCallerMemoryContext(session.userId, session.callSid);
    const aiReply = await generateTherapistVoiceReply({
      userSaid: spokenText,
      history: session.turns,
      journalContext,
      callerMemory,
    });

    session.turns.push({ role: 'assistant', text: aiReply, ts: new Date().toISOString() });
    response.say(aiReply);
    addSpeechGather(response, gatherUrl);
    response.say('I am still with you. Say a little more when you are ready.');

    return respondWithTwiml(res, response);
  } catch (error) {
    console.error('Twilio gather handling failed:', error);
    const fallback = 'I am still here with you. Could you repeat that one more time in a short sentence?';
    session.turns.push({ role: 'assistant', text: fallback, ts: new Date().toISOString() });
    response.say(fallback);
    addSpeechGather(response, gatherUrl);
    return respondWithTwiml(res, response);
  }
});

router.post('/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration, From, To } = req.body || {};
  const callSid = String(CallSid || '').trim();
  const status = String(CallStatus || '').toLowerCase();
  const durationSeconds = Number(CallDuration || 0);

  const session = voiceSessions.get(callSid) || null;
  if (session && ['completed', 'canceled', 'busy', 'failed', 'no-answer'].includes(status)) {
    await persistCallRecord(session, { durationSeconds: durationSeconds || undefined });
  }

  await updateDb((db) => {
    const existing = db.calls.find((item) => item.callSid === callSid);
    if (!existing) return;
    existing.callStatus = status || existing.callStatus;
    existing.from = existing.from || From || '';
    existing.to = existing.to || To || '';
    if (durationSeconds > 0) {
      existing.durationSeconds = durationSeconds;
    }
  });

  res.json({ success: true });
});

module.exports = router;
