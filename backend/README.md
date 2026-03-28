# Mental Health Backend

Backend service for journaling, AI analysis, pattern detection, dashboard aggregation, copilot chat, and alert notifications.

## Stack
- Node.js + Express
- Lightweight embedded JSON datastore (no external DB server)
- Google Gemini API
- SMTP via Nodemailer

## Important
- No authentication/authorization is used (as requested).
- User context is derived from `x-user-id` header (or `user_id` query/body). If not provided, `local-user` is used.
- All app data is persisted in `backend/data/app-data.json`.

## Quick Start
1. Install dependencies:
```bash
npm install
```
2. Copy env template:
```bash
cp .env.example .env
```
3. Run dev server:
```bash
npm run dev
```

Health check: `GET /health`

## Folder Map
- `server.js`: app bootstrap and middleware
- `routes/`: API endpoints
- `services/`: AI, pattern, alert, email logic
- `utils/dataStore.js`: embedded datastore read/write helpers
- `jobs/scheduler.js`: periodic pattern/alert jobs
- `@backend.md`: API map and endpoint reference

## API Base URL
`http://localhost:3001`

## Endpoints
See `@backend.md` for full endpoint list with request/response shape.

## SMTP Setup
Fill in these env vars:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`

## Data Collections (Embedded)
- users
- journal_entries
- patterns
- alerts
- chat_messages
- calls
- voice_history

## Deployment (Easy)
Railway is easiest:
1. Push `backend/` folder contents to a backend repo.
2. Create Railway project from repo.
3. Add env vars from `.env`.
4. Deploy.
