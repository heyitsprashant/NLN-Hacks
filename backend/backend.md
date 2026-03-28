# PRD: Backend API & AI Services Developer (Worker 2)

## 🎯 Role Overview
You are responsible for building the core backend system that powers all AI processing, pattern detection, data storage, and API endpoints. This is the brain of the entire application.

---

## 📋 Responsibilities

### Core Deliverables
1. RESTful API with Express.js
2. Firebase Firestore database setup and schema
3. AI processing services (emotion extraction, summarization)
4. Pattern detection engine
5. Email alert system
6. Dashboard data aggregation
7. There is no authorization, authentication, and also let me know where i need to find apis, everything and also i dont have my ml for the pattern detection engine and for the mail we will use smtp technique and trigger it and once it gets triggered email will be sent
---

## 🏗️ Technical Stack

**Required Technologies:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** Firebase Firestore
- **AI Services:** 
  - Google Gemini API (primary)
  - OpenAI API (optional, for copilot)
- **Email:** SendGrid
- **Authentication:** Firebase Auth or JWT
- **Environment:** dotenv

**Additional Packages:**
```json
{
  "express": "^4.18.0",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0",
  "firebase-admin": "^11.0.0",
  "@google/generative-ai": "^0.1.0",
  "@sendgrid/mail": "^7.7.0",
  "bcrypt": "^5.1.0",
  "jsonwebtoken": "^9.0.0",
  "joi": "^17.9.0",
  "helmet": "^7.0.0",
  "express-rate-limit": "^6.7.0"
}
```

---

## 🗄️ Database Schema

### Collection: `users`
```javascript
{
  id: string,              // Auto-generated
  email: string,           // Unique
  password_hash: string,   // Hashed with bcrypt
  name: string,
  created_at: timestamp,
  trusted_contacts: [
    {
      email: string,
      added_at: timestamp,
      verified: boolean
    }
  ],
  settings: {
    alerts_enabled: boolean,
    alert_sensitivity: string, // 'low' | 'medium' | 'high'
    quiet_hours: {
      start: string,  // "22:00"
      end: string     // "08:00"
    }
  },
  last_login: timestamp
}
```

**Indexes:**
- `email` (unique)
- `created_at`

---

### Collection: `journal_entries`
```javascript
{
  id: string,
  user_id: string,         // Reference to users
  text: string,            // Original entry text
  source: string,          // 'web' | 'mobile' | 'upload'
  emotion: {
    primary: string,       // 'anxiety' | 'sadness' | 'joy' | 'stress' | 'calm' | 'neutral'
    secondary: [string],   // Additional emotions
    intensity: number      // 0.0 - 1.0
  },
  context: {
    category: string,      // 'work' | 'relationships' | 'health' | 'general'
    keywords: [string],    // Extracted key terms
    entities: [string]     // People, places, things mentioned
  },
  sentiment_score: number, // -1.0 to 1.0
  created_at: timestamp,
  processed: boolean,      // AI processing complete
  processing_metadata: {
    model_used: string,
    processing_time_ms: number,
    confidence: number
  }
}
```

**Indexes:**
- `user_id`
- `created_at`
- `emotion.primary`
- Composite: `user_id + created_at`

---

### Collection: `patterns`
```javascript
{
  id: string,
  user_id: string,
  pattern_type: string,    // 'emotion_trigger' | 'temporal' | 'behavioral'
  description: string,     // "Anxiety before meetings"
  confidence: number,      // 0.0 - 1.0
  supporting_entries: [
    {
      entry_id: string,
      relevance: number
    }
  ],
  metadata: {
    emotion: string,
    context: string,
    frequency: number,     // How many times observed
    first_observed: timestamp,
    last_observed: timestamp
  },
  status: string,          // 'active' | 'resolved' | 'monitoring'
  created_at: timestamp,
  updated_at: timestamp
}
```

**Indexes:**
- `user_id`
- `status`
- Composite: `user_id + status`

---

### Collection: `calls`
```javascript
{
  id: string,
  user_id: string,
  call_sid: string,        // Twilio Call SID
  phone_number: string,    // User's phone (masked)
  duration_seconds: number,
  transcript: string,      // Full conversation
  turns: [
    {
      speaker: string,     // 'user' | 'ai'
      text: string,
      timestamp: number,   // Relative to call start
      emotion: string,
      intent: string       // Classified intent
    }
  ],
  summary: string,         // AI-generated call summary
  emotion_analysis: {
    dominant_emotion: string,
    intensity: number,
    emotional_arc: [
      { time: number, emotion: string, intensity: number }
    ]
  },
  created_at: timestamp,
  processed: boolean
}
```

---

### Collection: `chat_messages`
```javascript
{
  id: string,
  user_id: string,
  session_id: string,      // Group messages by session
  role: string,            // 'user' | 'assistant'
  content: string,
  context_used: {
    recent_entries: [string],   // Entry IDs
    patterns: [string],         // Pattern IDs
    emotional_state: string
  },
  created_at: timestamp
}
```

---

### Collection: `alerts`
```javascript
{
  id: string,
  user_id: string,
  alert_type: string,      // 'burnout_risk' | 'anxiety_spike' | 'pattern_detected'
  severity: string,        // 'low' | 'medium' | 'high' | 'critical'
  title: string,
  description: string,
  trigger_data: {
    pattern_id: string,
    entry_ids: [string],
    confidence: number
  },
  status: string,          // 'pending' | 'sent' | 'dismissed'
  emails_sent: [
    {
      recipient: string,
      sent_at: timestamp,
      status: string       // 'sent' | 'failed'
    }
  ],
  created_at: timestamp,
  resolved_at: timestamp
}
```

---

## 🔌 API Endpoints Specification

### Authentication Endpoints

#### POST `/api/auth/register`
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

**Validation:**
- Email: valid format, not already registered
- Password: min 8 chars, 1 uppercase, 1 number
- Name: min 2 chars

---

#### POST `/api/auth/login`
**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": { ... }
}
```

---

### Journal Endpoints

#### POST `/api/journal/entry`
**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "text": "Had a stressful meeting today...",
  "source": "web"
}
```

**Processing Flow:**
1. Validate user authentication
2. Save raw entry to database
3. Trigger AI processing (async)
4. Return immediate response
5. Background: Extract emotion, context, keywords
6. Update entry with processed data
7. Trigger pattern detection

**Response:**
```json
{
  "success": true,
  "entry": {
    "id": "entry123",
    "text": "Had a stressful meeting...",
    "created_at": "2025-01-15T10:30:00Z",
    "processed": false
  }
}
```

**Background Processing Result (WebSocket or polling):**
```json
{
  "entry_id": "entry123",
  "emotion": {
    "primary": "stress",
    "intensity": 0.78
  },
  "context": {
    "category": "work",
    "keywords": ["meeting", "stressful"]
  },
  "processed": true
}
```

---

#### POST `/api/journal/upload`
**Headers:** 
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request:** FormData with file

**Response:**
```json
{
  "success": true,
  "entries_created": 1,
  "entry_ids": ["entry124"]
}
```

---

#### GET `/api/journal/entries`
**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `emotion` (optional filter)
- `start_date` (optional)
- `end_date` (optional)

**Response:**
```json
{
  "success": true,
  "entries": [
    {
      "id": "entry123",
      "text": "...",
      "emotion": { ... },
      "created_at": "..."
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_entries": 94
  }
}
```

---

#### DELETE `/api/journal/entry/:id`
**Response:**
```json
{
  "success": true,
  "message": "Entry deleted successfully"
}
```

---

### Dashboard Endpoints

#### GET `/api/dashboard/mood-data`
**Query Parameters:**
- `days` (default: 7, max: 90)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-01-15",
      "mood_score": 0.65,
      "emotion": "calm",
      "entry_count": 3
    }
  ],
  "summary": {
    "average_mood": 0.58,
    "trend": "improving",
    "most_common_emotion": "anxiety"
  }
}
```

**Processing Logic:**
1. Fetch entries for specified period
2. Group by date
3. Calculate average intensity per day
4. Determine trend (regression analysis)

---

#### GET `/api/dashboard/summary`
**Response:**
```json
{
  "success": true,
  "summary": "Your stress levels increased this week, primarily due to work-related entries. You showed improved mood after social activities on Tuesday and Thursday.",
  "generated_at": "2025-01-15T10:00:00Z",
  "period": "last_7_days"
}
```

**AI Prompt for Gemini:**
```
Analyze the following mental health journal data and create a supportive, 
2-3 sentence summary for the user:

Entries this week: 12
Dominant emotions: Anxiety (45%), Stress (30%), Calm (25%)
Contexts: Work (60%), Relationships (25%), Health (15%)
Detected patterns:
- Anxiety before meetings (confidence: 0.85)
- Improved mood after exercise (confidence: 0.72)

Guidelines:
- Be empathetic and supportive
- Highlight both challenges and positive trends
- Use second person ("you", "your")
- No medical terminology or diagnosis
- Keep it concise and actionable
```

---

#### GET `/api/dashboard/patterns`
**Response:**
```json
{
  "success": true,
  "patterns": [
    {
      "id": "pat123",
      "description": "Anxiety before meetings",
      "confidence": 0.85,
      "frequency": 8,
      "last_observed": "2025-01-15"
    }
  ]
}
```

---

#### GET `/api/dashboard/alerts`
**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": "alert123",
      "type": "burnout_risk",
      "severity": "medium",
      "title": "Elevated Stress Detected",
      "description": "Your stress levels have been consistently high...",
      "created_at": "2025-01-15T09:00:00Z"
    }
  ]
}
```

---

### AI Copilot Endpoints

#### POST `/api/copilot/message`
**Request Body:**
```json
{
  "message": "I've been feeling anxious lately",
  "session_id": "session123"
}
```

**Processing Flow:**
1. Fetch user's recent entries (last 7 days)
2. Fetch detected patterns
3. Build context for AI
4. Call Gemini/OpenAI with context
5. Store conversation
6. Return response

**AI System Prompt:**
```
You are an empathetic mental health companion. User context:

Recent patterns:
- Anxiety before meetings (high confidence)
- Stress related to work (frequent)

Recent entries summary:
- Last 3 days: mostly stress and anxiety
- Common themes: deadlines, presentations

Guidelines:
- Be supportive and non-judgmental
- Never diagnose or provide medical advice
- Ask clarifying questions
- Suggest healthy coping strategies
- Keep responses under 100 words
- Use warm, conversational tone
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "msg123",
    "role": "assistant",
    "content": "I hear you. It sounds like you've been dealing with quite a bit lately, especially around work. Have these feelings been connected to any specific situations or is it more of a general sense of unease?",
    "context_used": {
      "patterns_referenced": ["pat123"],
      "entries_analyzed": 12
    }
  }
}
```

---

#### GET `/api/copilot/history`
**Query:** `session_id`

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg1",
      "role": "user",
      "content": "...",
      "created_at": "..."
    },
    {
      "id": "msg2",
      "role": "assistant",
      "content": "...",
      "created_at": "..."
    }
  ]
}
```

---

### Settings Endpoints

#### GET `/api/settings/user`
**Response:**
```json
{
  "success": true,
  "settings": {
    "trusted_contacts": [...],
    "alerts_enabled": true,
    "alert_sensitivity": "medium"
  }
}
```

---

#### PUT `/api/settings/contacts`
**Request Body:**
```json
{
  "contacts": [
    { "email": "friend@example.com" }
  ]
}
```

**Validation:**
- Max 4 contacts
- Valid email format
- Send verification email

---

#### DELETE `/api/settings/delete-data`
**Response:**
```json
{
  "success": true,
  "message": "All user data has been permanently deleted"
}
```

**Processing:**
1. Delete all journal entries
2. Delete all patterns
3. Delete all chat messages
4. Delete all calls
5. Delete all alerts
6. Optionally delete user account

---

## 🧠 AI Processing Services

### 1. Journal Processing Service

**File:** `services/journalProcessor.js`

```javascript
class JournalProcessor {
  async processEntry(entryText) {
    // 1. Call Gemini API
    const analysis = await this.analyzeWithGemini(entryText);
    
    // 2. Extract structured data
    return {
      emotion: {
        primary: analysis.primary_emotion,
        secondary: analysis.secondary_emotions,
        intensity: analysis.intensity
      },
      context: {
        category: analysis.category,
        keywords: analysis.keywords,
        entities: analysis.entities
      },
      sentiment_score: analysis.sentiment
    };
  }
  
  async analyzeWithGemini(text) {
    const prompt = `
      Analyze this journal entry and return ONLY a JSON object:
      
      Entry: "${text}"
      
      Return format:
      {
        "primary_emotion": "anxiety|sadness|joy|stress|calm|neutral",
        "secondary_emotions": [],
        "intensity": 0.0-1.0,
        "category": "work|relationships|health|general",
        "keywords": [],
        "entities": [],
        "sentiment": -1.0 to 1.0
      }
    `;
    
    const result = await geminiAPI.generateContent(prompt);
    return JSON.parse(result.text);
  }
}
```

**Gemini Setup:**
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
```

---

### 2. Pattern Detection Engine

**File:** `services/patternDetector.js`

**Algorithm:**
```javascript
class PatternDetector {
  async detectPatterns(userId) {
    // 1. Fetch last 30 days of entries
    const entries = await this.getRecentEntries(userId, 30);
    
    // 2. Group by emotion + context
    const groups = this.groupEntries(entries);
    
    // 3. Find recurring combinations (≥3 occurrences)
    const patterns = [];
    
    for (const [key, group] of Object.entries(groups)) {
      if (group.length >= 3) {
        const [emotion, context] = key.split('_');
        
        // Calculate confidence based on frequency and recency
        const confidence = this.calculateConfidence(group);
        
        if (confidence >= 0.6) {
          patterns.push({
            pattern_type: 'emotion_trigger',
            description: this.generateDescription(emotion, context, group),
            confidence,
            emotion,
            context,
            supporting_entries: group.map(e => ({
              entry_id: e.id,
              relevance: 1.0
            })),
            frequency: group.length
          });
        }
      }
    }
    
    // 4. Save new patterns
    await this.savePatterns(userId, patterns);
    
    return patterns;
  }
  
  groupEntries(entries) {
    const groups = {};
    
    entries.forEach(entry => {
      const key = `${entry.emotion.primary}_${entry.context.category}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    
    return groups;
  }
  
  calculateConfidence(entries) {
    // More recent entries = higher confidence
    const now = Date.now();
    const weights = entries.map(e => {
      const ageInDays = (now - e.created_at.toMillis()) / (1000 * 60 * 60 * 24);
      return Math.exp(-ageInDays / 14); // Exponential decay
    });
    
    const avgWeight = weights.reduce((a, b) => a + b) / weights.length;
    const frequency = Math.min(entries.length / 10, 1); // Normalize
    
    return (avgWeight * 0.5) + (frequency * 0.5);
  }
  
  generateDescription(emotion, context, entries) {
    // Extract common keywords
    const keywords = {};
    entries.forEach(e => {
      e.context.keywords.forEach(kw => {
        keywords[kw] = (keywords[kw] || 0) + 1;
      });
    });
    
    const topKeyword = Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    
    return `${emotion} related to ${context}${topKeyword ? ` (especially ${topKeyword})` : ''}`;
  }
}
```

---

### 3. Alert System

**File:** `services/alertSystem.js`

**Trigger Conditions:**
```javascript
class AlertSystem {
  async checkForAlerts(userId) {
    const alerts = [];
    
    // 1. Check for burnout risk
    const burnoutRisk = await this.checkBurnout(userId);
    if (burnoutRisk) alerts.push(burnoutRisk);
    
    // 2. Check for anxiety spike
    const anxietySpike = await this.checkAnxietySpike(userId);
    if (anxietySpike) alerts.push(anxietySpike);
    
    // 3. Check for new critical patterns
    const criticalPatterns = await this.checkCriticalPatterns(userId);
    alerts.push(...criticalPatterns);
    
    // 4. Send emails if necessary
    if (alerts.length > 0) {
      await this.sendAlertEmails(userId, alerts);
    }
    
    return alerts;
  }
  
  async checkBurnout(userId) {
    // Get last 7 days
    const entries = await this.getRecentEntries(userId, 7);
    
    // Check conditions:
    // - ≥5 entries with stress/anxiety
    // - Average intensity >0.7
    // - Minimal positive emotions
    
    const stressEntries = entries.filter(e => 
      ['stress', 'anxiety'].includes(e.emotion.primary) &&
      e.emotion.intensity > 0.7
    );
    
    if (stressEntries.length >= 5) {
      return {
        type: 'burnout_risk',
        severity: 'high',
        title: 'Sustained High Stress Detected',
        description: `You've had ${stressEntries.length} high-stress entries in the past week.`
      };
    }
  }
  
  async sendAlertEmails(userId, alerts) {
    const user = await this.getUser(userId);
    
    if (!user.settings.alerts_enabled) return;
    
    const contacts = user.trusted_contacts
      .filter(c => c.verified);
    
    for (const contact of contacts) {
      const emailContent = await this.generateAlertEmail(user, alerts);
      await this.sendEmail(contact.email, emailContent);
    }
  }
  
  async generateAlertEmail(user, alerts) {
    const prompt = `
      Generate a caring, human email to notify someone that their friend 
      (${user.name}) has been showing signs of distress in their mental 
      health journal.
      
      Alerts detected:
      ${alerts.map(a => `- ${a.title}: ${a.description}`).join('\n')}
      
      Guidelines:
      - Warm, concerned tone
      - Not alarming or dramatic
      - Suggest checking in
      - Respect privacy (don't share exact entries)
      - 3-4 sentences max
      
      Return ONLY the email body text.
    `;
    
    const result = await geminiAPI.generateContent(prompt);
    return result.text;
  }
}
```

---

## 🔐 Authentication Middleware

**File:** `middleware/auth.js`

```javascript
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
```

---

## 📧 Email Service

**File:** `services/emailService.js`

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

class EmailService {
  async sendAlertEmail(to, subject, body) {
    const msg = {
      to,
      from: process.env.SENDER_EMAIL,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        ${body.replace(/\n/g, '<br>')}
      </div>`
    };
    
    try {
      await sgMail.send(msg);
      return { success: true };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }
}
```

---

## 🔄 Background Jobs

**File:** `jobs/scheduler.js`

```javascript
const cron = require('node-cron');

// Run pattern detection daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily pattern detection...');
  const users = await getAllActiveUsers();
  
  for (const user of users) {
    await patternDetector.detectPatterns(user.id);
  }
});

// Check for alerts every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Checking for alerts...');
  const users = await getAllActiveUsers();
  
  for (const user of users) {
    await alertSystem.checkForAlerts(user.id);
  }
});
```

---

## 🧪 Testing Requirements

### Unit Tests
```javascript
// tests/journalProcessor.test.js
describe('JournalProcessor', () => {
  it('should extract emotion from text', async () => {
    const result = await processor.processEntry('I feel anxious');
    expect(result.emotion.primary).toBe('anxiety');
  });
  
  it('should calculate intensity correctly', async () => {
    const result = await processor.processEntry('I am EXTREMELY stressed');
    expect(result.emotion.intensity).toBeGreaterThan(0.7);
  });
});
```

### Integration Tests
```javascript
// tests/api/journal.test.js
describe('POST /api/journal/entry', () => {
  it('should create entry with auth', async () => {
    const res = await request(app)
      .post('/api/journal/entry')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'Test entry' });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  
  it('should reject without auth', async () => {
    const res = await request(app)
      .post('/api/journal/entry')
      .send({ text: 'Test entry' });
    
    expect(res.status).toBe(401);
  });
});
```

---

## 📦 Environment Variables

**File:** `.env`
```env
# Server
PORT=3001
NODE_ENV=development

# Database
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Authentication
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d

# AI Services
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key (optional)

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
SENDER_EMAIL=noreply@yourapp.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🚀 Deployment Checklist

- [ ] Set up Firebase project
- [ ] Configure Firestore security rules
- [ ] Set up Firebase Auth
- [ ] Deploy to cloud (Railway, Render, or Google Cloud Run)
- [ ] Configure environment variables
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Implement rate limiting
- [ ] Add request logging
- [ ] Set up health check endpoint (`/health`)

---

## 📞 Dependencies on Other Workers

**Frontend Developer (Worker 1):**
- Provide API documentation
- Coordinate WebSocket events (if used)

**Voice/Call System Developer (Worker 4):**
- Share audio processing endpoints
- Coordinate transcript storage

**Mobile App Developer (Worker 5):**
- Ensure mobile API compatibility
- Support mobile-specific auth flows

---

## 🎯 Success Metrics

- API response time < 200ms (95th percentile)
- AI processing time < 3 seconds per entry
- Pattern detection accuracy > 80%
- Zero data loss
- 99.9% uptime
- Email delivery rate > 95%

---

**Estimated Timeline:** 3-4 weeks
**Priority Level:** CRITICAL (this is the core system)