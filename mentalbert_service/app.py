import os
from typing import Dict, List

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = os.getenv("MENTALBERT_MODEL_ID", "mental/mental-bert-base-uncased")
MAX_LENGTH = int(os.getenv("MENTALBERT_MAX_LENGTH", "256"))

# Keep labels simple and beginner-friendly.
LABELS: List[str] = ["negative", "neutral", "positive"]

app = FastAPI(title="MentalBERT Service", version="1.0.0")


tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_ID,
    num_labels=len(LABELS),
)
model.eval()


class PredictRequest(BaseModel):
    text: str = Field(min_length=3, max_length=5000)


class PredictResponse(BaseModel):
    label: str
    confidence: float
    scores: Dict[str, float]


def _softmax(values: torch.Tensor) -> torch.Tensor:
    return torch.nn.functional.softmax(values, dim=-1)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "model": MODEL_ID}


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    try:
        encoded = tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=MAX_LENGTH,
            padding=True,
        )
        with torch.no_grad():
            outputs = model(**encoded)
            probs = _softmax(outputs.logits)[0].cpu().tolist()

        # Ensure we always return a full label map.
        if len(probs) != len(LABELS):
            probs = (probs + [0.0] * len(LABELS))[: len(LABELS)]

        scores = {label: float(score) for label, score in zip(LABELS, probs)}
        best_label = max(scores, key=scores.get)
        confidence = scores[best_label]

        return PredictResponse(label=best_label, confidence=confidence, scores=scores)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"prediction_failed: {str(exc)}")
