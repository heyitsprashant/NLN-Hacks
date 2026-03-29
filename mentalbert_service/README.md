# MentalBERT Inference Service

Local FastAPI microservice for journal classification using Hugging Face MentalBERT.

## 1) Create and activate virtual environment (Windows PowerShell)

```powershell
cd mentalbert_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

## 2) Install dependencies

```powershell
pip install -r requirements.txt
```

## 3) Authenticate to Hugging Face (required for gated models)

```powershell
huggingface-cli login
```

Also open and accept model terms for `mental/mental-bert-base-uncased` in your browser.

## 4) Run the API server

```powershell
uvicorn app:app --host 127.0.0.1 --port 8001 --reload
```

## 5) Test prediction

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8001/predict -ContentType "application/json" -Body '{"text":"I feel overwhelmed and exhausted today."}' | ConvertTo-Json -Depth 5
```

## Notes

- First run downloads model files from Hugging Face and caches them locally.
- Later runs load from cache and start faster.
- Service stays local and uses no paid inference API.
