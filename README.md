# Antara Mental Health Support Platform

Antara is a culturally-sensitive mental health companion designed for communities where seeking help carries stigma. Users journal privately in their own language(future goal), AI detects early signs of distress without judgment, and the system provides anonymous support through chat and voice—eliminating the shame of traditional therapy. When patterns indicate risk, trusted family members receive caring alerts framed as "check-ins," not diagnoses, respecting cultural norms while ensuring safety. By normalizing daily emotional check-ins and keeping support invisible yet accessible, Antara breaks silence around mental health in conservative settings.

## Team (5 Members)

- Prashant Basyal: Integration, Backend AI and ML
- Hardika Regmi and Tabi Pyakurel: Frontend, UI, UX and research
- Pooja Shrestha: Research, Slides, Editing, Backend Insight, Installment, Docker
- Pranjal Poudel: Idea Generation, Research, Backend and Frontend

## Architecture At A Glance

- Frontend service: [frontend](frontend) (Next.js UI)
- Backend service: [backend](backend) (Express APIs and orchestration)
- ML service: [mentalbert_service](mentalbert_service) (FastAPI inference)
- Startup helper: [start-all.ps1](start-all.ps1)

## Antara (Main System) In Plain Terms

Antara listens to what the user writes or says, then coordinates multiple specialized components to respond with support that feels continuous across sessions. The backend keeps shared context so voice calls, dashboard summaries, and copilot replies are consistent with the user's recent history.

Where it is implemented:

- Voice flow and therapist calling orchestration: [backend/routes/call.js](backend/routes/call.js)
- AI orchestration and prompt handling: [backend/services/aiService.js](backend/services/aiService.js)
- Data persistence across features: [backend/utils/dataStore.js](backend/utils/dataStore.js)

## ML System (Classification)

The ML service classifies text sentiment and emotional signal, then returns a clean score and label the backend can use for patterns and alerts. If the primary model is unavailable, the service applies a safe fallback model so the pipeline still works.

Model and paper:

- MentalBERT model: [mental/mental-bert-base-uncased](https://huggingface.co/mental/mental-bert-base-uncased)
- Research paper: [MentalBERT Paper](https://arxiv.org/abs/2110.15621)

Where it is implemented:

- ML API server: [mentalbert_service/app.py](mentalbert_service/app.py)
- Journal classification endpoint usage: [backend/routes/journal.js](backend/routes/journal.js)
- AI service integration logic: [backend/services/aiService.js](backend/services/aiService.js)

## Email Alert System (SMTP)

When journal updates or alert rules trigger, the backend builds a trusted-contact email and sends it through SMTP to all enabled trusted contacts. Users can add or update trusted contacts in Settings, and each recipient is sent through the same secure mail flow.

Where it is implemented:

- SMTP sender: [backend/services/emailService.js](backend/services/emailService.js)
- Alert and recipient handling: [backend/services/alertSystem.js](backend/services/alertSystem.js)
- Trusted contact settings API: [backend/routes/settings.js](backend/routes/settings.js)

## Dashboard (Layman View)

The dashboard turns many journal entries into simple visual trend points so users can understand if mood is improving, stable, or declining over time. It also shows detected patterns and recent alerts in one place.

Where it is implemented:

- Dashboard APIs: [backend/routes/dashboard.js](backend/routes/dashboard.js)
- Frontend dashboard page: [frontend/src/app/dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)

## Journaling (Calendar + Voice Note + Upload)

Journaling supports normal text entry, date-based entry using a calendar field, and voice note capture that converts speech to text before save. Users can also upload text files, and each saved entry goes through analysis and optional alert email flow.

Where it is implemented:

- Journal APIs and processing: [backend/routes/journal.js](backend/routes/journal.js)
- Journal UI with date and voice transcription: [frontend/src/app/journal/page.tsx](frontend/src/app/journal/page.tsx)

## AI Copilot (Layman View)

Copilot replies are generated from the user's current message plus recent journal and pattern context, so answers feel personalized instead of generic. If Gemini is rate-limited, the backend returns a safe fallback response path.

Where it is implemented:

- Copilot APIs: [backend/routes/copilot.js](backend/routes/copilot.js)
- Copilot generation logic: [backend/services/aiService.js](backend/services/aiService.js)
- Copilot UI: [frontend/src/app/copilot/page.tsx](frontend/src/app/copilot/page.tsx)

## Voice Calling System (Twilio + Ngrok)

Users call a Twilio number, then Antara speaks back using a turn-by-turn voice flow that stores call context and transcript for continuity. Ngrok exposes your local backend to Twilio so real inbound calls can reach your local call endpoints.

Where it is implemented:

- Voice endpoints and TwiML flow: [backend/routes/call.js](backend/routes/call.js)
- Call history API used by UI: [backend/routes/call.js](backend/routes/call.js)
- Call UI page: [frontend/src/app/call/page.tsx](frontend/src/app/call/page.tsx)

## Internal API Navigation

Full backend endpoint map:

- [backend/@backend.md](backend/@backend.md)

Primary route files:

- [backend/routes/journal.js](backend/routes/journal.js)
- [backend/routes/dashboard.js](backend/routes/dashboard.js)
- [backend/routes/copilot.js](backend/routes/copilot.js)
- [backend/routes/settings.js](backend/routes/settings.js)
- [backend/routes/call.js](backend/routes/call.js)



### 1) Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+
- Ngrok account (for Twilio voice webhook testing)

## Extra References

- Backend guide: [backend/README.md](backend/README.md)
- Frontend guide: [frontend/README.md](frontend/README.md)
- MentalBERT service guide: [mentalbert_service/README.md](mentalbert_service/README.md)

### 2) Install Dependencies

From repository root:

```powershell
Set-Location backend
npm install

Set-Location ..\frontend
npm install

Set-Location ..\mentalbert_service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### 3) Configure Environment Safely

Create backend env from template:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set values in [backend/.env.example](backend/.env.example) format only, with your own credentials:

- GEMINI_API_KEY
- GEMINI_MODEL_CANDIDATES
- SMTP_HOST
- SMTP_PORT
- SMTP_SECURE
- SMTP_USER
- SMTP_PASS
- SMTP_FROM_NAME
- SMTP_FROM_EMAIL
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- PUBLIC_BASE_URL
- MENTALBERT_API_URL
- MENTALBERT_TIMEOUT_MS

Security note:

- Do not place personal emails, app passwords, API keys, or Twilio tokens inside README or committed source files.
- Keep real values only in local or deployment environment variables.

### 4) Start Services (Manual)

Terminal A:

```powershell
Set-Location mentalbert_service
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

Terminal B:

```powershell
Set-Location backend
npm run start
```

Terminal C:

```powershell
Set-Location frontend
npm run dev
```

### 5) Start Services (One Command)

From root:

```powershell
.\start-all.ps1
```

Script reference:

- [start-all.ps1](start-all.ps1)

### 6) Verify Health

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8001/health
Invoke-RestMethod -Uri http://127.0.0.1:3001/health
Invoke-WebRequest -Uri http://127.0.0.1:3000 -UseBasicParsing
```

## Ngrok + Twilio Voice Setup

### 1) Expose backend

```powershell
ngrok http 3001
```

Copy the HTTPS forwarding URL and set PUBLIC_BASE_URL in backend env.

### 2) Twilio number webhooks

In Twilio Console for your phone number:

- Voice webhook (A call comes in): POST to /api/call/voice
- Status callback: POST to /api/call/status

Example endpoint paths are implemented in [backend/routes/call.js](backend/routes/call.js).

### 3) Test voice APIs

- Call number API: GET /api/call/number
- Call history API: GET /api/call/history
- Demo scenarios API: GET /api/call/demo-scenarios

## Trusted Contacts And SMTP Flow

Add trusted contacts from the Settings page, then the backend stores and uses those recipients for alerts and journal-triggered email sends. Recipients are managed through [backend/routes/settings.js](backend/routes/settings.js), and sending is handled in [backend/services/emailService.js](backend/services/emailService.js) plus [backend/services/alertSystem.js](backend/services/alertSystem.js).



