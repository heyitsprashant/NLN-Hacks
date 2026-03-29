import os
import re
from typing import Dict, List

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoConfig, AutoModelForSequenceClassification, AutoTokenizer

REQUESTED_MODEL_ID = os.getenv("MENTALBERT_MODEL_ID", "mental/mental-bert-base-uncased")
FALLBACK_MODEL_ID = os.getenv(
    "MENTALBERT_FALLBACK_MODEL_ID",
    "distilbert-base-uncased-finetuned-sst-2-english",
)
MAX_LENGTH = int(os.getenv("MENTALBERT_MAX_LENGTH", "256"))

app = FastAPI(title="MentalBERT Service", version="1.0.0")


def _is_sequence_classifier(model_id: str) -> bool:
    config = AutoConfig.from_pretrained(model_id)
    architectures = [str(item).lower() for item in (config.architectures or [])]
    return any("sequenceclassification" in arch for arch in architectures)


ACTIVE_MODEL_ID = REQUESTED_MODEL_ID
if not _is_sequence_classifier(REQUESTED_MODEL_ID):
    print(
        f"[mentalbert_service] Model '{REQUESTED_MODEL_ID}' is not a sequence classifier. "
        f"Falling back to '{FALLBACK_MODEL_ID}'."
    )
    ACTIVE_MODEL_ID = FALLBACK_MODEL_ID

tokenizer = AutoTokenizer.from_pretrained(ACTIVE_MODEL_ID)
model = AutoModelForSequenceClassification.from_pretrained(ACTIVE_MODEL_ID)
model.eval()


def _resolve_labels() -> List[str]:
    # Optional override for projects that already know model label semantics.
    env_labels = os.getenv("MENTALBERT_LABELS", "").strip()
    if env_labels:
        resolved = [item.strip().lower() for item in env_labels.split(",") if item.strip()]
        if len(resolved) == model.config.num_labels:
            return resolved

    id2label = getattr(model.config, "id2label", None)
    if isinstance(id2label, dict) and id2label:
        labels = [
            str(id2label[i]).strip().lower()
            for i in sorted(id2label.keys())
        ]

        # Many HF checkpoints store generic labels like LABEL_0/LABEL_1.
        if labels and all(re.fullmatch(r"label_\d+", label) for label in labels):
            if len(labels) == 2:
                return ["negative", "positive"]
            if len(labels) == 3:
                return ["negative", "neutral", "positive"]
        return labels

    # Last-resort fallback when config does not expose labels.
    return [f"label_{i}" for i in range(model.config.num_labels)]


LABELS: List[str] = _resolve_labels()


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
    return {
        "status": "ok",
        "model": ACTIVE_MODEL_ID,
        "requested_model": REQUESTED_MODEL_ID,
        "labels": ",".join(LABELS),
    }


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
