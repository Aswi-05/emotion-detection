# AffectSense — Enhanced Emotion Recognition App

> An improved version of the baseline emotion-fer-flask-react-mediapipe app,  
> grounded in recent Facial Expression Recognition (FER) literature (2019–2025).

---

## What's New vs. Baseline

### Backend Enhancements (`backend/app.py`)

| Feature | Baseline | Enhanced |
|---------|----------|----------|
| Emotion output | 7 discrete labels | Labels + VAD coordinates + FACS AUs |
| Smoothing | None (raw per-frame) | EMA on frontend |
| Engagement metric | ❌ | ✅ `1 − P(neutral)` |
| Valence / Arousal / Dominance | ❌ | ✅ Probability-weighted VAD vector |
| VA quadrant label | ❌ | ✅ "Alert/Excited", "Relaxed/Content", etc. |
| Polarity & intensity | ❌ | ✅ positive/neutral/negative + high/moderate/low |
| FACS Action Units | ❌ | ✅ Per top emotion |
| Scene-level VAD | ❌ | ✅ Averaged across all faces |

### Frontend Enhancements (`frontend/src/`)

| Feature | Baseline | Enhanced |
|---------|----------|----------|
| Bounding boxes | White, unstyled | Color-coded per emotion, with glow + corner accents |
| Probability display | Raw JSON | Animated probability bars with emoji |
| Smoothing algorithm | Simple mean | Exponential Moving Average (α = 0.35) |
| Valence-Arousal plot | ❌ | ✅ Interactive 2D circumplex with reference dots + trail |
| Emotion timeline | ❌ | ✅ Rolling 60-frame colored strip chart |
| Session statistics | ❌ | ✅ Dominant emotion, distribution bars, avg V/A/engagement |
| FACS Action Units | ❌ | ✅ Shown as tags per face card |
| VAD dimensions | ❌ | ✅ Per face: valence/arousal/dominance display |
| Image upload mode | ❌ | ✅ Drag-and-drop static image analysis |
| UI design | Basic inline styles | Dark sci-fi aesthetic with Syne + Space Mono fonts |

---

## Literature Citations

The enhancements are grounded in the following references:

1. **Russell's Circumplex Model** — the VA space used for emotion coordinates:  
   Russell, J.A. (1980). *A circumplex model of affect.* Journal of Personality and Social Psychology, 39(6), 1161–1178.

2. **VAD coordinates calibration** (AffectNet):  
   Mollahosseini, A., Hasani, B., & Mahoor, M.H. (2019). AffectNet: A database for facial expression, valence, and arousal computing in the wild. *IEEE Transactions on Affective Computing*, 10(1), 18–31.

3. **FACS Action Units** (FACS original system):  
   Ekman, P. & Friesen, W.V. (1978). *Facial Action Coding System.* Consulting Psychologists Press.

4. **AU-based valence/arousal sensing** (scientific validation):  
   Saito, A., Sato, W., & Yoshikawa, S. (2024). Sensing emotional valence and arousal dynamics through automated facial action unit analysis. *Scientific Reports*, 14, 19631.

5. **Temporal dimension of FER** (why EMA over simple average):  
   Contreras-Higuera, W.E. et al. (2025). The Role of Time in Facial Dynamics and Challenges in Automatic Emotion Recognition (2019–2024). *Human Behavior and Emerging Technologies*, 2025.

6. **Engagement score via facial expressiveness**:  
   Muhammad, G. et al. (2017). A facial-expression monitoring system for improved healthcare in smart cities. *IEEE Access*, 5, 10871–10881.

7. **VAD model survey** (valence-arousal-dominance in FER):  
   Contreras-Higuera et al. (2025). — see above.  
   Also: Warriner, A.B., Kuperman, V., & Brysbaert, M. (2013). Norms of valence, arousal, and dominance for 13,915 English lemmas. *Behavior Research Methods*, 45, 1191–1207.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                         │
│                                                                 │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │  Webcam /    │  │  FaceCard(s)   │  │  VA Circumplex     │  │
│  │  Image       │  │  - Prob bars   │  │  (Russell 1980)    │  │
│  │  Capture     │  │  - VAD values  │  ├────────────────────┤  │
│  │  (420×315)   │  │  - FACS AUs    │  │  Session Stats     │  │
│  │  Colored     │  │  - Engagement  │  │  - Dominant emo    │  │
│  │  BBox overlay│  │  - Quadrant    │  │  - Distribution    │  │
│  └──────┬───────┘  └────────────────┘  └────────────────────┘  │
│         │                                                       │
│         │ EMA Smoothing (α=0.35)                                │
│         │ Timeline history                                      │
└─────────┼───────────────────────────────────────────────────────┘
          │ POST /predict  (multipart/form-data)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  Flask Backend (port 8000)                                      │
│                                                                 │
│  MediaPipe FaceDetection                                        │
│       ↓  crop + margin                                          │
│  ViT Emotion Classifier (trpakov/vit-face-expression)           │
│       ↓  probabilities                                          │
│  VAD Mapping  →  valence, arousal, dominance, quadrant          │
│  FACS AU Map  →  action unit list for top emotion               │
│  Engagement   →  1 − P(neutral)                                 │
│  Polarity     →  positive / neutral / negative                  │
│  Intensity    →  high / moderate / low arousal                  │
│       ↓                                                         │
│  JSON response with all fields + scene-level aggregate VAD      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setup

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
# Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

The Vite dev server proxies `/predict` and `/health` to the Flask backend.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FER_MODEL_ID` | `trpakov/vit-face-expression` | HuggingFace model ID |
| `MIN_DET_CONF` | `0.5` | MediaPipe minimum detection confidence |
| `CROP_MARGIN_FRAC` | `0.30` | Padding fraction around detected face bbox |
| `MAX_IMAGE_PIXELS` | `12000000` | Safety limit (~12MP) |
| `MP_MODEL_SELECTION` | `0` | 0=short-range, 1=full-range MediaPipe model |

---

## Design Decisions

**Why EMA over simple moving average?**  
Simple averaging treats all frames equally, which smooths out transient expressions (surprise, fear) excessively. EMA with α=0.35 gives more weight to recent frames while still dampening sensor noise. This follows guidance in Contreras-Higuera et al. (2025) on temporal dynamics in FER.

**Why map to VA space?**  
The discrete 7-label output (happy/sad/angry/...) loses nuance. Russell's circumplex captures the continuous affective space that underlies these categories and is better suited for applications in HCI, mental health monitoring, and education analytics.

**Why show FACS Action Units?**  
AUs bridge the gap between "black box" neural network outputs and interpretable muscle movement descriptions, making the system more transparent and explainable. This aligns with the FACS-to-VA bridging highlighted in Contreras-Higuera et al. (2025).

**Why engagement score?**  
For applications like e-learning, presentation feedback, or customer experience monitoring, knowing whether someone's face is showing *any* expression (vs. neutral) is often more actionable than the specific emotion. 1−P(neutral) is a simple but effective proxy.
