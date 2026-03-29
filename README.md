# NLN-Hacks Monorepo

This repository contains three services:

- `frontend` (Next.js, default on `http://localhost:3000`)
- `backend` (Node.js/Express API, default on `http://localhost:3001`)
- `mentalbert_service` (FastAPI model service, default on `http://127.0.0.1:8001`)

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+

## Environment Setup

### 1) Backend environment

Create `backend/.env` from the example:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set your real values in `backend/.env`:

- `GEMINI_API_KEY=...`
- `GEMINI_MODEL_CANDIDATES=gemini-2.0-flash,gemini-2.0-flash-lite`
- Firebase + SMTP values (if you use those features)

Important:

- Never commit `backend/.env`.
- `.env` is already ignored by git.

### 2) MentalBERT service environment

```powershell
Set-Location mentalbert_service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Install Dependencies

```powershell
Set-Location backend
npm install

Set-Location ..\frontend
npm install
```

## One-Command Startup

From repository root:

```powershell
.\start-all.ps1
```

The script:

- frees ports `3000`, `3001`, `8001`
- starts all services in background jobs
- runs health checks

## Manual Startup (Alternative)

Terminal 1:

```powershell
Set-Location mentalbert_service
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
```

Terminal 2:

```powershell
Set-Location backend
npm run start
```

Terminal 3:

```powershell
Set-Location frontend
npm run dev
```

## Verify Services

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8001/health
Invoke-RestMethod -Uri http://127.0.0.1:3001/health
Invoke-WebRequest -Uri http://127.0.0.1:3000 -UseBasicParsing
```

## Copilot Behavior Notes

- Copilot uses Gemini when API quota/model access is available.
- If Gemini is unavailable, backend returns a journal-context-aware fallback reply.
- No API key is hardcoded in source files.
