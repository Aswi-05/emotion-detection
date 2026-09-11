"""
Enhanced Emotion Recognition Backend
=====================================
Improvements over baseline (grounded in FER literature):

1. Valence-Arousal-Dominance (VAD) mapping
   - Maps discrete emotion labels to Russell's circumplex coordinates
   - Computes probability-weighted VAD vector per face
   - Enables richer affective computing beyond 7 discrete labels
   (Russell, 1980; Warriner et al., 2013; Mollahosseini et al., 2019 – AffectNet)

2. FACS Action Unit annotations
   - Each top emotion is annotated with the canonical FACS AUs
   - Bridges discrete and continuous emotion representations
   (Ekman & Friesen, 1978; Saito et al., 2024 – Scientific Reports)

3. Engagement score
   - Derived as 1 − P(neutral), capturing expressiveness
   - Useful for downstream applications (e.g., HCI, education, healthcare)
   (Muhammad et al., IEEE Access 2017)

4. Emotion polarity & intensity summary
   - Polarity: sign of valence (positive/neutral/negative affect)
   - Intensity: magnitude of arousal dimension

5. Soft label normalization
   - Handles model label variants (e.g., "happiness" → "happy")
"""

import io
import os
from typing import Dict, Any, List, Tuple

import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

import mediapipe as mp
from transformers import pipeline

# ----------------------------
# Config
# ----------------------------
MODEL_ID = os.environ.get("FER_MODEL_ID", "trpakov/vit-face-expression")
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", "12000000"))
MIN_DET_CONF = float(os.environ.get("MIN_DET_CONF", "0.5"))
MODEL_SELECTION = int(os.environ.get("MP_MODEL_SELECTION", "0"))
CROP_MARGIN_FRAC = float(os.environ.get("CROP_MARGIN_FRAC", "0.30"))

# ----------------------------
# Affective Mappings (Literature-grounded)
# ----------------------------

# VAD coordinates from Warriner et al. (2013) + AffectNet calibration
# Valence: -1 (very unpleasant) to +1 (very pleasant)
# Arousal: -1 (calm/sleepy) to +1 (excited/alert)
# Dominance: -1 (submissive/controlled) to +1 (dominant/in-control)
VAD_MAP: Dict[str, Dict[str, float]] = {
    "happy":    {"valence":  0.81, "arousal":  0.51, "dominance":  0.46},
    "sad":      {"valence": -0.63, "arousal": -0.27, "dominance": -0.33},
    "angry":    {"valence": -0.51, "arousal":  0.59, "dominance":  0.25},
    "fear":     {"valence": -0.64, "arousal":  0.60, "dominance": -0.43},
    "disgust":  {"valence": -0.60, "arousal":  0.35, "dominance":  0.11},
    "surprise": {"valence":  0.40, "arousal":  0.67, "dominance": -0.13},
    "neutral":  {"valence":  0.00, "arousal":  0.00, "dominance":  0.00},
    "contempt": {"valence": -0.30, "arousal":  0.20, "dominance":  0.30},
}

# FACS Action Unit descriptions per emotion (Ekman & Friesen, 1978)
AU_MAP: Dict[str, List[str]] = {
    "happy":    ["AU6 – Cheek Raiser", "AU12 – Lip Corner Puller (Duchenne smile)"],
    "sad":      ["AU1 – Inner Brow Raise", "AU4 – Brow Lowerer", "AU15 – Lip Corner Depressor", "AU17 – Chin Raiser"],
    "angry":    ["AU4 – Brow Lowerer", "AU5 – Upper Lid Raiser", "AU7 – Lid Tightener", "AU23 – Lip Tightener"],
    "fear":     ["AU1 – Inner Brow Raise", "AU2 – Outer Brow Raise", "AU4 – Brow Lowerer", "AU5 – Lid Raiser", "AU20 – Lip Stretcher", "AU26 – Jaw Drop"],
    "disgust":  ["AU9 – Nose Wrinkler", "AU15 – Lip Corner Depressor", "AU17 – Chin Raiser"],
    "surprise": ["AU1 – Inner Brow Raise", "AU2 – Outer Brow Raise", "AU5 – Upper Lid Raiser", "AU26 – Jaw Drop", "AU27 – Mouth Stretch"],
    "neutral":  [],
    "contempt": ["AU12R – Unilateral Lip Corner Puller", "AU14 – Dimpler"],
}

# Human-readable quadrant labels for the VA circumplex
def _va_quadrant(v: float, a: float) -> str:
    if v >= 0 and a >= 0:
        return "Alert / Excited"
    elif v >= 0 and a < 0:
        return "Relaxed / Content"
    elif v < 0 and a >= 0:
        return "Tense / Stressed"
    else:
        return "Sad / Bored"

# ----------------------------
# Label normalisation
# ----------------------------
_LABEL_ALIASES = {
    "happiness": "happy", "joy": "happy", "joyful": "happy",
    "sadness": "sad", "sorrow": "sad", "sorrowful": "sad",
    "anger": "angry", "angriness": "angry", "angry": "angry",
    "fearful": "fear", "scared": "fear", "afraid": "fear",
    "disgusted": "disgust", "disgust": "disgust",
    "surprised": "surprise",
    "contemptuous": "contempt",
}

def _norm_label(label: str) -> str:
    return _LABEL_ALIASES.get(label.lower().strip(), label.lower().strip())


# ----------------------------
# App
# ----------------------------
app = Flask(__name__)
CORS(app)

clf = pipeline("image-classification", model=MODEL_ID)

mp_face = mp.solutions.face_detection
_face_detector = mp_face.FaceDetection(
    model_selection=MODEL_SELECTION,
    min_detection_confidence=MIN_DET_CONF
)


# ----------------------------
# Helper functions
# ----------------------------

def _read_upload_image(file_storage) -> Image.Image:
    data = file_storage.read()
    if not data:
        raise ValueError("Empty upload")
    img = Image.open(io.BytesIO(data)).convert("RGB")
    if img.width * img.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image too large")
    return img


def _clamp(v: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, v))


def _bbox_rel_to_px(rel_bbox, width: int, height: int) -> Tuple[int, int, int, int]:
    x = int(rel_bbox.xmin * width)
    y = int(rel_bbox.ymin * height)
    w = int(rel_bbox.width * width)
    h = int(rel_bbox.height * height)
    x0 = _clamp(x, 0, width - 1)
    y0 = _clamp(y, 0, height - 1)
    x1 = _clamp(x + w, 0, width)
    y1 = _clamp(y + h, 0, height)
    return x0, y0, max(1, x1 - x0), max(1, y1 - y0)


def _crop_with_margin(rgb: np.ndarray, x: int, y: int, w: int, h: int) -> Tuple[np.ndarray, Dict[str, int]]:
    H, W = rgb.shape[:2]
    margin = int(CROP_MARGIN_FRAC * max(w, h))
    x0 = _clamp(x - margin, 0, W - 1)
    y0 = _clamp(y - margin, 0, H - 1)
    x1 = _clamp(x + w + margin, 0, W)
    y1 = _clamp(y + h + margin, 0, H)
    return rgb[y0:y1, x0:x1], {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def _normalize_preds(preds: List[Dict[str, Any]]) -> Dict[str, float]:
    out = {}
    for p in preds:
        key = _norm_label(p["label"])
        out[key] = float(p["score"])
    return dict(sorted(out.items(), key=lambda kv: kv[1], reverse=True))


def _compute_vad(probs: Dict[str, float]) -> Dict[str, float]:
    """Compute probability-weighted VAD vector (literature: AffectNet, Warriner et al.)"""
    v = a = d = total = 0.0
    for emotion, prob in probs.items():
        if emotion in VAD_MAP:
            vad = VAD_MAP[emotion]
            v += prob * vad["valence"]
            a += prob * vad["arousal"]
            d += prob * vad["dominance"]
            total += prob
    if total > 0:
        v, a, d = v / total, a / total, d / total
    return {
        "valence":   round(v, 3),
        "arousal":   round(a, 3),
        "dominance": round(d, 3),
        "quadrant":  _va_quadrant(v, a),
    }


def _engagement_score(probs: Dict[str, float]) -> float:
    """Expressiveness index: 1 − P(neutral). Range [0,1]."""
    neutral_p = probs.get("neutral", 0.0)
    return round(max(0.0, 1.0 - float(neutral_p)), 3)


def _polarity(valence: float) -> str:
    if valence > 0.15:
        return "positive"
    elif valence < -0.15:
        return "negative"
    return "neutral"


def _intensity(arousal: float) -> str:
    abs_a = abs(arousal)
    if abs_a > 0.50:
        return "high"
    elif abs_a > 0.20:
        return "moderate"
    return "low"


def _build_face_result(i: int, det, rgb: np.ndarray) -> Dict[str, Any]:
    H, W = rgb.shape[:2]
    score = float(det.score[0]) if det.score else 0.0
    rel_bbox = det.location_data.relative_bounding_box
    x, y, bw, bh = _bbox_rel_to_px(rel_bbox, W, H)

    crop_rgb, crop_meta = _crop_with_margin(rgb, x, y, bw, bh)
    face_img = Image.fromarray(crop_rgb).convert("RGB")

    preds = clf(face_img)
    probs = _normalize_preds(preds)
    
    top_emotion = next(iter(probs))
    top_score = probs[top_emotion]

    vad = _compute_vad(probs)
    engagement = _engagement_score(probs)
    action_units = AU_MAP.get(top_emotion, [])

    return {
        "id": i,
        "detection_score": score,
        "bbox": {"x": x, "y": y, "w": bw, "h": bh},
        "crop": crop_meta,
        "top_emotion": top_emotion,
        "top_score": top_score,
        "probabilities": probs,
        # ── New enhanced fields ──
        "vad": vad,
        "engagement": engagement,
        "polarity": _polarity(vad["valence"]),
        "intensity": _intensity(vad["arousal"]),
        "action_units": action_units,
    }


# ----------------------------
# Routes
# ----------------------------

@app.get("/health")
def health():
    return jsonify({
        "ok": True,
        "model": MODEL_ID,
        "detector": "mediapipe",
        "features": ["vad", "engagement", "action_units", "polarity", "intensity"],
    })


@app.post("/predict")
def predict():
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "Missing form-data field 'file'"}), 400

    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"ok": False, "error": "No file uploaded"}), 400

    if f.mimetype not in ALLOWED_MIME:
        return jsonify({"ok": False, "error": f"Unsupported type: {f.mimetype}"}), 415

    try:
        img = _read_upload_image(f)
        rgb = np.array(img)
        h, w = rgb.shape[:2]

        results = _face_detector.process(rgb)
        faces_out = []

        if results.detections:
            detections = sorted(
                results.detections,
                key=lambda d: float(d.score[0]) if d.score else 0.0,
                reverse=True,
            )
            for i, det in enumerate(detections):
                faces_out.append(_build_face_result(i, det, rgb))

        # Aggregate session-level VAD (mean across all faces)
        session_vad = None
        if faces_out:
            avg_v = sum(f["vad"]["valence"]   for f in faces_out) / len(faces_out)
            avg_a = sum(f["vad"]["arousal"]   for f in faces_out) / len(faces_out)
            avg_d = sum(f["vad"]["dominance"] for f in faces_out) / len(faces_out)
            session_vad = {
                "valence":   round(avg_v, 3),
                "arousal":   round(avg_a, 3),
                "dominance": round(avg_d, 3),
                "quadrant":  _va_quadrant(avg_v, avg_a),
            }

        return jsonify({
            "ok": True,
            "image": {"width": w, "height": h},
            "num_faces": len(faces_out),
            "faces": faces_out,
            "session_vad": session_vad,
        })

    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
