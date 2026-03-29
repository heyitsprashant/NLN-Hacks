const { GoogleGenerativeAI } = require('@google/generative-ai');

const MENTALBERT_API_URL = process.env.MENTALBERT_API_URL || 'http://127.0.0.1:8001/predict';
const MENTALBERT_TIMEOUT_MS = Number(process.env.MENTALBERT_TIMEOUT_MS || 8000);
const GEMINI_MODEL_CANDIDATES = (process.env.GEMINI_MODEL_CANDIDATES || 'gemini-2.0-flash,gemini-2.0-flash-lite')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

function toEmotionFromLabel(label, text = '') {
  const normalized = String(label || '').toLowerCase();
  const content = String(text || '').toLowerCase();

  const stressKeywords = [
    'stress', 'stressed', 'overwhelm', 'overwhelmed', 'anxious', 'anxiety', 'panic',
    'deadline', 'pressure', 'burnout', 'workload', 'racing thoughts', 'can\'t sleep',
  ];
  const sadnessKeywords = [
    'sad', 'depressed', 'depression', 'hopeless', 'empty', 'lonely', 'worthless',
    'cry', 'crying', 'numb', 'tired of life', 'nothing matters', 'grief',
  ];

  const stressHits = stressKeywords.reduce((count, keyword) => (
    content.includes(keyword) ? count + 1 : count
  ), 0);
  const sadnessHits = sadnessKeywords.reduce((count, keyword) => (
    content.includes(keyword) ? count + 1 : count
  ), 0);

  const inferNegativeEmotion = () => {
    if (sadnessHits > stressHits) return 'sadness';
    if (stressHits > sadnessHits) return 'stress';
    // For ambiguous negative content, sadness is safer than neutral.
    return 'sadness';
  };

  if (
    normalized === 'positive' ||
    normalized === 'label_1' ||
    normalized.includes('positive')
  ) return 'calm';

  if (
    normalized === 'negative' ||
    normalized === 'label_0' ||
    normalized.includes('depress') ||
    normalized.includes('sad')
  ) return inferNegativeEmotion();

  if (normalized.includes('stress') || normalized.includes('anx')) return 'stress';
  return 'neutral';
}

async function classifyWithMentalBert(text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MENTALBERT_TIMEOUT_MS);

  try {
    const response = await fetch(MENTALBERT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`MentalBERT API ${response.status}: ${body}`);
    }

    const data = await response.json();
    return {
      label: String(data.label || 'neutral').toLowerCase(),
      confidence: Number(data.confidence ?? 0.5),
      scores: data.scores && typeof data.scores === 'object' ? data.scores : {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function getModel() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  for (const modelName of GEMINI_MODEL_CANDIDATES) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return { model, modelName };
    } catch {
      // Keep trying model candidates.
    }
  }

  return null;
}

function inferCopingTipFromEmotion(emotion) {
  if (emotion === 'stress' || emotion === 'anxiety') {
    return 'Try one 4-7-8 breathing cycle and break your next task into a 10-minute step.';
  }
  if (emotion === 'sadness') {
    return 'Try a small grounding action now: water, short walk, or messaging someone you trust.';
  }
  if (emotion === 'anger') {
    return 'Pause before reacting; write one sentence about what boundary feels crossed.';
  }
  return 'Keep journaling daily and notice what activities make you feel a little lighter.';
}

function buildContextAwareFallbackReply(message, context) {
  const recentEntries = Array.isArray(context?.recent_entries) ? context.recent_entries : [];
  const emotions = recentEntries
    .map((entry) => String(entry?.emotion?.primary || entry?.emotion || 'neutral').toLowerCase())
    .filter(Boolean);

  const counts = emotions.reduce((acc, emotion) => {
    acc[emotion] = (acc[emotion] || 0) + 1;
    return acc;
  }, {});

  const dominantEmotion = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
  const latestEmotion = emotions[0] || dominantEmotion;
  const patternCount = counts[dominantEmotion] || 0;

  const userMessage = String(message || '').toLowerCase();
  const asksForMoodInsight = /(mood|journal|pattern|how am i|how is my|feeling lately)/i.test(userMessage);

  if (asksForMoodInsight && recentEntries.length > 0) {
    return `From your recent journals, your dominant pattern looks like ${dominantEmotion} (${patternCount}/${recentEntries.length} entries), and your latest entry leans ${latestEmotion}. ${inferCopingTipFromEmotion(latestEmotion)} Want me to suggest a simple plan for today based on this?`;
  }

  if (recentEntries.length > 0) {
    return `I am here with you. Based on your recent journals, I am noticing more ${dominantEmotion} lately, with the latest entry showing ${latestEmotion}. ${inferCopingTipFromEmotion(latestEmotion)} What felt hardest today?`;
  }

  return 'I am here with you. Share what happened today, and I will help you reflect on your mood pattern and suggest one practical next step.';
}

function safeParseJson(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function analyzeJournalEntry(text) {
  const fallback = {
    emotion: { primary: 'neutral', secondary: [], intensity: 0.5 },
    context: { category: 'general', keywords: [], entities: [] },
    sentiment_score: 0,
    processing_metadata: {
      model_used: 'fallback',
      processing_time_ms: 0,
      confidence: 0.4,
    },
  };

  try {
    const prediction = await classifyWithMentalBert(text);
    return {
      emotion: {
        primary: toEmotionFromLabel(prediction.label, text),
        secondary: [],
        intensity: Number(Math.max(0, Math.min(1, prediction.confidence || 0.5)).toFixed(3)),
      },
      context: {
        category: 'general',
        keywords: [],
        entities: [],
      },
      sentiment_score:
        prediction.label === 'positive' ? prediction.confidence : prediction.label === 'negative' ? -prediction.confidence : 0,
      processing_metadata: {
        model_used: 'mental/mental-bert-base-uncased',
        processing_time_ms: 0,
        confidence: Number(Math.max(0, Math.min(1, prediction.confidence || 0.5)).toFixed(3)),
        raw_scores: prediction.scores,
      },
    };
  } catch (error) {
    console.error('MentalBERT analysis failed:', error.message);
  }

  const model = getModel();
  if (!model) return fallback;

  const start = Date.now();
  const prompt = `You are a senior psychologist. Analyze the following journal entry as a human expert would—consider context, subtle cues, and emotional nuance. Return ONLY valid JSON in this shape:\n{\n  "primary_emotion": "anxiety|sadness|joy|stress|calm|neutral",\n  "secondary_emotions": ["string"],\n  "intensity": 0.0,\n  "category": "work|relationships|health|general",\n  "keywords": ["string"],\n  "entities": ["string"],\n  "sentiment": 0.0,\n  "confidence": 0.0\n}\n\nEntry: "${text}"`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = safeParseJson(result.response.text());
    if (!parsed) return fallback;

    return {
      emotion: {
        primary: parsed.primary_emotion || 'neutral',
        secondary: Array.isArray(parsed.secondary_emotions) ? parsed.secondary_emotions : [],
        intensity: Number(parsed.intensity ?? 0.5),
      },
      context: {
        category: parsed.category || 'general',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      },
      sentiment_score: Number(parsed.sentiment ?? 0),
      processing_metadata: {
        model_used: 'gemini-1.5-flash',
        processing_time_ms: Date.now() - start,
        confidence: Number(parsed.confidence ?? 0.7),
      },
    };
  } catch (error) {
    console.error('Gemini analysis failed:', error.message);
    return fallback;
  }
}

async function generateSupportiveSummary(input) {
  const modelConfig = getModel();
  if (!modelConfig) {
    return 'You have been doing your best through recent emotional ups and downs. Try to notice what situations increase stress and also what helps you feel calmer.';
  }

  const prompt = `Write a supportive 2-3 sentence summary for the user.\nData:\n${JSON.stringify(input, null, 2)}\nConstraints: empathetic, no diagnosis, actionable.`;
  try {
    const result = await modelConfig.model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini summary failed:', {
      model: modelConfig.modelName,
      message: error.message,
    });
    return 'You have shown both challenges and moments of recovery this week. Keep tracking what is helping you feel better and reduce pressure where possible.';
  }
}

async function generateCopilotReply(message, context) {
  const modelConfig = getModel();
  if (!modelConfig) {
    return buildContextAwareFallbackReply(message, context);
  }

  const prompt = `You are an empathetic mental health companion. No diagnosis. Keep under 100 words.\nContext:\n${JSON.stringify(context, null, 2)}\nUser message: ${message}`;
  try {
    const result = await modelConfig.model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini copilot failed:', {
      model: modelConfig.modelName,
      message: error.message,
    });
    return buildContextAwareFallbackReply(message, context);
  }
}

const THERAPIST_CALL_SYSTEM_PROMPT = `You are "Antara", a calm and supportive emotional-support companion on a phone call. Speak like a warm therapist-style listener: reflective, gentle, non-judgmental.
Do NOT claim to be a licensed therapist or doctor. Do not diagnose. Do not provide medical/legal instructions.
Primary goal: help the caller feel heard, clarify what they feel, and guide them to one small next step.
Keep responses short and spoken: 1-3 sentences, maximum ~35 words. No bullet points. No markdown. No labels.
Ask one open-ended question at the end most of the time.
Use the conversation history to avoid repeating yourself.
If the transcript is unclear, ask a brief clarifying question.
If the user says they want to stop (bye/stop/hang up), respond with a short caring goodbye.

SAFETY RULE:
If the caller mentions self-harm, suicide, wanting to die, or harming others, respond calmly and directly:
- Encourage immediate help (local emergency services / trusted person nearby).
- Ask if they are in immediate danger right now.
- Do not continue normal coaching until safety is addressed.

OUTPUT:
Return only the exact words to be spoken to the caller.`;

function hasSafetyRiskContent(text) {
  const normalized = String(text || '').toLowerCase();
  const riskPatterns = [
    /suicide/,
    /kill\s+myself/,
    /want\s+to\s+die/,
    /end\s+my\s+life/,
    /self[-\s]?harm/,
    /hurt\s+myself/,
    /harm\s+someone/,
    /hurt\s+someone/,
  ];
  return riskPatterns.some((pattern) => pattern.test(normalized));
}

function normalizeSpeechReply(text) {
  const collapsed = String(text || '').replace(/\s+/g, ' ').trim();
  if (!collapsed) return 'I am here with you. What feels most important to share right now?';

  const words = collapsed.split(' ');
  if (words.length <= 38) return collapsed;
  return `${words.slice(0, 38).join(' ')}...`;
}

function buildTherapistFallbackReply(userSaid, history) {
  const spoken = String(userSaid || '').trim();
  if (!spoken) {
    return 'I am here with you. Could you share what feels hardest right now?';
  }

  const hasQuestionRecently = Array.isArray(history)
    ? history.slice(-4).some((turn) => String(turn?.text || '').includes('?'))
    : false;

  if (hasQuestionRecently) {
    return normalizeSpeechReply('Thank you for sharing that with me. It sounds like this has been heavy, and you do not have to carry it alone. What part feels most draining today?');
  }

  return normalizeSpeechReply('I hear you, and what you are feeling makes sense in this moment. Let us take one small step together. What would feel slightly easier in the next hour?');
}

async function generateTherapistVoiceReply({
  userSaid,
  history = [],
  journalContext = null,
  callerMemory = null,
}) {
  const latestUserText = String(userSaid || '').trim();

  if (hasSafetyRiskContent(latestUserText)) {
    return 'Thank you for telling me. Your safety matters most right now, so please contact local emergency services or a trusted person nearby immediately. Are you in immediate danger right now?';
  }

  const modelConfig = getModel();
  if (!modelConfig) {
    return buildTherapistFallbackReply(latestUserText, history);
  }

  const trimmedHistory = Array.isArray(history)
    ? history.slice(-24).map((turn) => ({
      role: turn?.role === 'assistant' ? 'assistant' : 'user',
      text: String(turn?.text || '').trim(),
    }))
    : [];

  const prompt = [
    THERAPIST_CALL_SYSTEM_PROMPT,
    '',
    'INPUT EACH TURN (JSON):',
    JSON.stringify(
      {
        user_said: latestUserText,
        history: trimmedHistory,
        journal_context: journalContext || null,
        caller_memory: callerMemory || null,
      },
      null,
      2,
    ),
  ].join('\n');

  try {
    const result = await modelConfig.model.generateContent(prompt);
    return normalizeSpeechReply(result.response.text());
  } catch (error) {
    console.error('Gemini therapist call response failed:', {
      model: modelConfig.modelName,
      message: error.message,
    });
    return buildTherapistFallbackReply(latestUserText, history);
  }
}

async function generateTrustedContactEmail(input) {
  const {
    userName = 'your trusted contact',
    userHandle = '@profile',
    contactName = 'there',
    alertTitle = 'Well-being alert',
    situationSummary = 'They may be going through a difficult period.',
    recommendedSupport = 'Please check in with empathy and practical help.',
  } = input || {};

  const teamSignature = 'Team 18 from NLN';
  const requiredHeaderNote = '[This is not the spam email but the test email from Team18]';
  const requiredFooterNote = '[team 18]';
  const bccLine = `Multi-recipient BCC test: ${situationSummary}`;

  const fallback = [
    `Hello trusted contact of ${userName},`,
    '',
    `You are receiving this message because you are listed as a trusted contact for ${userHandle} (${userName}).`,
    '',
    requiredHeaderNote,
    '',
    bccLine,
    '',
    `${recommendedSupport}`,
    '',
    'A calm check-in, listening without judgment, and helping with small next steps can make a meaningful difference.',
    '',
    'Thank you for being there.',
    requiredFooterNote,
    '',
    'Best regards,',
    teamSignature,
  ].join('\n');

  const modelConfig = getModel();
  if (!modelConfig) {
    return fallback;
  }

  const prompt = [
    'Write a supportive plain-text trusted-contact email.',
    'Output requirements (must follow exactly):',
    '- Use plain text only. No markdown.',
    '- Keep warm, calm, actionable tone.',
    '- Keep the two bracketed notes EXACTLY as provided below.',
    '- Include the BCC test line exactly with the provided situation text.',
    '- Close with Team 18 signature exactly.',
    '- Do not add diagnosis or legal language.',
    '- Keep this structure and order:',
    `  1) Hello trusted contact of ${userName},`,
    `  2) You are receiving this message because you are listed as a trusted contact for ${userHandle} (${userName}).`,
    `  3) ${requiredHeaderNote}`,
    `  4) ${bccLine}`,
    `  5) ${recommendedSupport}`,
    '  6) A calm check-in, listening without judgment, and helping with small next steps can make a meaningful difference.',
    '  7) Thank you for being there.',
    `  8) ${requiredFooterNote}`,
    `  9) Best regards,`,
    `  10) ${teamSignature}`,
    '',
    `Trusted contact name: ${contactName}`,
    `Profile handle: ${userHandle}`,
    `Profile name: ${userName}`,
    `Alert title: ${alertTitle}`,
    `Situation: ${situationSummary}`,
    `Suggested support: ${recommendedSupport}`,
  ].join('\n');

  try {
    const result = await modelConfig.model.generateContent(prompt);
    const text = result.response.text().trim();
    if (!text) return fallback;

    const hasRequiredLines =
      text.includes(requiredHeaderNote) &&
      text.includes(requiredFooterNote) &&
      text.includes(teamSignature) &&
      text.includes(bccLine);

    return hasRequiredLines ? text : fallback;
  } catch (error) {
    console.error('Gemini trusted contact email failed:', {
      model: modelConfig.modelName,
      message: error.message,
    });
    return fallback;
  }
}

module.exports = {
  analyzeJournalEntry,
  classifyWithMentalBert,
  generateSupportiveSummary,
  generateCopilotReply,
  generateTherapistVoiceReply,
  generateTrustedContactEmail,
};
