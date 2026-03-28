const { GoogleGenerativeAI } = require('@google/generative-ai');

function getModel() {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
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
  const model = getModel();
  if (!model) {
    return 'You have been doing your best through recent emotional ups and downs. Try to notice what situations increase stress and also what helps you feel calmer.';
  }

  const prompt = `Write a supportive 2-3 sentence summary for the user.\nData:\n${JSON.stringify(input, null, 2)}\nConstraints: empathetic, no diagnosis, actionable.`;
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini summary failed:', error.message);
    return 'You have shown both challenges and moments of recovery this week. Keep tracking what is helping you feel better and reduce pressure where possible.';
  }
}

async function generateCopilotReply(message, context) {
  const model = getModel();
  if (!model) {
    return "I'm here with you. It sounds like this has been heavy lately. What part of today felt the hardest?";
  }

  const prompt = `You are an empathetic mental health companion. No diagnosis. Keep under 100 words.\nContext:\n${JSON.stringify(context, null, 2)}\nUser message: ${message}`;
  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error('Gemini copilot failed:', error.message);
    return "I hear you. Thank you for sharing that. Would you like to talk through what triggered this feeling today?";
  }
}

module.exports = {
  analyzeJournalEntry,
  generateSupportiveSummary,
  generateCopilotReply,
};
