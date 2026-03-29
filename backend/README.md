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

## Deployment (Easy)
Railway is easiest:
1. Push `backend/` folder contents to a backend repo.
2. Create Railway project from repo.
3. Add env vars from `.env`.
4. Deploy.

## Local MentalBERT Integration (Node + Python)
This backend is wired to call a local FastAPI service for journal classification.

### 1. Start Python service
From workspace root:
```bash
cd mentalbert_service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
huggingface-cli login
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Configure backend env
Set these in `backend/.env`:
- `MENTALBERT_API_URL=http://127.0.0.1:8001/predict`
- `MENTALBERT_TIMEOUT_MS=8000`

### 3. Start backend
```bash
cd backend
npm install
npm run dev
```

### 4. Test end-to-end
Classify only:
```bash
curl -X POST http://localhost:3001/api/journal/classify -H "Content-Type: application/json" -d "{\"text\":\"I feel stressed and exhausted today\"}"
```

Create entry (analysis included):
```bash
curl -X POST http://localhost:3001/api/journal/entry -H "Content-Type: application/json" -d "{\"text\":\"I feel stressed and exhausted today\"}"
```

Notes:
- The first Python run downloads and caches the model locally.
- If Python service is down, backend returns a safe fallback analysis.

## Twilio Inbound Voice Demo Setup
This project supports inbound therapist-style calls with Twilio.

### Required env vars
Set these in `backend/.env`:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `PUBLIC_BASE_URL` (your public tunnel URL, such as ngrok)

Optional call-flow tuning:
- `TWILIO_GATHER_TIMEOUT` (default `10`)
- `TWILIO_MIN_CALL_DURATION_SECONDS` (default `30`)
- `TWILIO_MAX_CALL_TURNS` (default `30`)
- `TWILIO_MAX_CALL_DURATION_SECONDS` (default `1200`)

Example local tunnel:
```bash
ngrok http 3001
```

Set `PUBLIC_BASE_URL` to the generated HTTPS URL.

### Configure Twilio phone number webhooks
In the Twilio Console for your number:
- Voice webhook (A call comes in): `POST {PUBLIC_BASE_URL}/api/call/voice`
- Status callback (optional): `POST {PUBLIC_BASE_URL}/api/call/status`

After this, calling your Twilio number will start a voice conversation with Antara and save transcript history to `db.calls`.

### Two ready demo scripts
Use this endpoint to fetch two prebuilt voice demo scenarios:

```bash
GET /api/call/demo-scenarios
```

Each scenario includes:
- `opening`: first sentence to say on call
- `followUps`: 2-3 next lines to drive a realistic back-and-forth
- `expectedOutcome`: what your audience should hear from Antara
