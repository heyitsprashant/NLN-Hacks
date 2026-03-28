# Backend API Map (@backend.md)

This file lists where everything is and how to call APIs.

## Where to find code
- Server bootstrap: `server.js`
- Firestore config: `config/firebase.js`
- AI service: `services/aiService.js`
- Pattern detector (no ML): `services/patternDetector.js`
- SMTP email sender: `services/emailService.js`
- Alert trigger rules: `services/alertSystem.js`
- Scheduler jobs: `jobs/scheduler.js`
- Routes:
  - `routes/journal.js`
  - `routes/dashboard.js`
  - `routes/copilot.js`
  - `routes/settings.js`

## Base URL
`http://localhost:3001`

## Health
### GET `/health`
Returns service status.

## Journal APIs
### POST `/api/journal/entry`
Body:
```json
{
  "user_id": "user123",
  "text": "Had a stressful meeting today",
  "source": "web"
}
```
Creates raw entry, triggers async AI analysis, then pattern/alert checks.

### GET `/api/journal/entries?user_id=user123&page=1&limit=20&emotion=stress`
Returns paginated entries.

### POST `/api/journal/upload`
Body:
```json
{
  "user_id": "user123",
  "text": "line one\nline two\nline three"
}
```
Creates multiple entries from line-separated text.

### DELETE `/api/journal/entry/:id?user_id=user123`
Deletes a single entry.

## Dashboard APIs
### GET `/api/dashboard/mood-data?user_id=user123&days=7`
Returns grouped daily mood data and trend.

### GET `/api/dashboard/summary?user_id=user123`
Returns supportive AI summary for last 7 days.

### GET `/api/dashboard/patterns?user_id=user123`
Returns detected patterns.

### GET `/api/dashboard/alerts?user_id=user123`
Returns recent alerts.

## Copilot APIs
### POST `/api/copilot/message`
Body:
```json
{
  "user_id": "user123",
  "session_id": "session_1",
  "message": "I feel anxious this week"
}
```
Stores user message, generates assistant reply, stores reply.

### GET `/api/copilot/history?user_id=user123&session_id=session_1`
Returns chat history.

## Settings APIs
### GET `/api/settings/user?user_id=user123`
Returns trusted contacts and alert settings.

### PUT `/api/settings/contacts`
Body:
```json
{
  "user_id": "user123",
  "contacts": [
    { "email": "friend@example.com" }
  ]
}
```
Max 4 contacts.

### DELETE `/api/settings/delete-data?user_id=user123`
Deletes user-owned data from journal_entries, patterns, chat_messages, calls, alerts.

## Notes
- No auth is enforced.
- Pattern detection is heuristic (frequency + recency), not ML.
- Alert emails use SMTP and are triggered when high-stress thresholds are met.
