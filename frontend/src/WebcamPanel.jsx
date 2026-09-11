import React, { useCallback, useEffect, useRef, useState } from "react";
import { predictEmotion, predictFromFile } from "./api.js";
import { getEmotionConfig } from "./emotionConfig.js";
import VACircumplex from "./VACircumplex.jsx";
import EmotionTimeline from "./EmotionTimeline.jsx";
import SessionStats from "./SessionStats.jsx";

/* ─── Constants ─────────────────────────────────────────────── */
const SEND_EVERY_MS = 700;
const EMA_ALPHA = 0.35;        // Exponential Moving Average weight
const VA_TRAIL_LEN = 20;       // VA circumplex trail length
const TIMELINE_MAX = 60;       // Timeline history length

/* ─── Utility ───────────────────────────────────────────────── */
function fmtPct(x) {
  return typeof x === "number" ? `${(x * 100).toFixed(1)}%` : "";
}

function signedStr(v) {
  if (typeof v !== "number") return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

/**
 * Exponential Moving Average smoothing for face probabilities.
 * Outperforms simple averaging for transient expressions.
 * (Contreras-Higuera et al., Human Behavior & Emerging Tech, 2025)
 */
function emaSmooth(prev, next, alpha) {
  if (!prev) return next;
  const out = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  keys.forEach(k => {
    const p = prev[k] ?? 0;
    const n = next[k] ?? 0;
    out[k] = alpha * n + (1 - alpha) * p;
  });
  return out;
}

function topOf(probs) {
  let bestK = null, bestV = -1;
  for (const [k, v] of Object.entries(probs ?? {})) {
    if (v > bestV) { bestV = v; bestK = k; }
  }
  return { label: bestK, score: bestV };
}

/* ─── Probability bars ──────────────────────────────────────── */
function ProbBar({ emotion, score, isTop }) {
  const cfg = getEmotionConfig(emotion);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{cfg.emoji}</span>
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{
          height: 6,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 3,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${(score * 100).toFixed(1)}%`,
            background: isTop
              ? `linear-gradient(90deg, ${cfg.color}cc, ${cfg.color})`
              : `${cfg.color}66`,
            borderRadius: 3,
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          }} />
        </div>
      </div>
      <span style={{
        width: 44,
        textAlign: "right",
        fontFamily: "'Space Mono', monospace",
        fontSize: 11,
        color: isTop ? cfg.color : "rgba(148,163,184,0.5)",
        fontWeight: isTop ? 700 : 400,
        transition: "color 0.3s",
      }}>{fmtPct(score)}</span>
    </div>
  );
}

/* ─── Face card ─────────────────────────────────────────────── */
function FaceCard({ face }) {
  const cfg = getEmotionConfig(face.top_emotion);
  const probs = face.probabilities ?? {};
  const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      border: `1px solid ${cfg.color}44`,
      borderRadius: 12,
      background: cfg.bg,
      padding: 14,
      transition: "border-color 0.3s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: 14,
              color: cfg.color,
              fontFamily: "'Syne', sans-serif",
              letterSpacing: "-0.3px",
            }}>
              Face {face.id} — {cfg.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "'Space Mono', monospace" }}>
              conf: {fmtPct(face.top_score)} · det: {(face.detection_score ?? 0).toFixed(3)}
            </div>
          </div>
        </div>
        {/* Engagement pill */}
        <div style={{
          background: `rgba(99,202,183,${(face.engagement ?? 0) * 0.2 + 0.06})`,
          border: "1px solid rgba(99,202,183,0.2)",
          borderRadius: 20,
          padding: "2px 10px",
          fontSize: 10,
          fontFamily: "'Space Mono', monospace",
          color: "#63CAB7",
        }}>
          ENG {fmtPct(face.engagement)}
        </div>
      </div>

      {/* Probability bars */}
      <div style={{ marginBottom: 10 }}>
        {sorted.slice(0, expanded ? sorted.length : 4).map(([emo, score]) => (
          <ProbBar key={emo} emotion={emo} score={score} isTop={emo === face.top_emotion} />
        ))}
        {sorted.length > 4 && (
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(148,163,184,0.4)",
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              cursor: "pointer",
              padding: 0,
              marginTop: 2,
            }}
          >
            {expanded ? "▲ less" : `▼ +${sorted.length - 4} more`}
          </button>
        )}
      </div>

      {/* VAD row */}
      {face.vad && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}>
          {[
            { k: "Valence", v: face.vad.valence, hint: "pleasant ↑" },
            { k: "Arousal", v: face.vad.arousal, hint: "excited ↑" },
            { k: "Dominance", v: face.vad.dominance, hint: "control ↑" },
          ].map(({ k, v, hint }) => (
            <div key={k} style={{
              background: "rgba(13,17,23,0.6)",
              borderRadius: 8,
              padding: "6px 8px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 13,
                fontWeight: 700,
                color: v > 0 ? "#63CAB7" : v < 0 ? "#E05252" : "#94A3B8",
              }}>{signedStr(v)}</div>
              <div style={{ fontSize: 8, color: "rgba(148,163,184,0.4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{k}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quadrant + polarity + intensity */}
      {face.vad && (
        <div style={{
          display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10,
        }}>
          {[
            { label: face.vad.quadrant },
            { label: `${face.polarity ?? "—"} affect` },
            { label: `${face.intensity ?? "—"} intensity` },
          ].map(({ label }) => (
            <span key={label} style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: 9,
              fontFamily: "'Space Mono', monospace",
              color: "rgba(148,163,184,0.6)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>{label}</span>
          ))}
        </div>
      )}

      {/* FACS Action Units */}
      {face.action_units && face.action_units.length > 0 && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 8,
        }}>
          <div style={{
            fontSize: 8,
            fontFamily: "'Space Mono', monospace",
            color: "rgba(148,163,184,0.3)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 4,
          }}>FACS Action Units</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {face.action_units.map(au => (
              <span key={au} style={{
                background: `${cfg.color}12`,
                border: `1px solid ${cfg.color}22`,
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 9,
                fontFamily: "'Space Mono', monospace",
                color: `${cfg.color}bb`,
              }}>{au}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main overlay drawing on canvas ───────────────────────── */
function drawOverlay(canvas, faces, imageW, imageH) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cW = canvas.width;
  const cH = canvas.height;
  const scaleX = cW / imageW;
  const scaleY = cH / imageH;

  ctx.clearRect(0, 0, cW, cH);

  faces.forEach(face => {
    const { x, y, w, h } = face.bbox ?? {};
    if ([x, y, w, h].some(v => typeof v !== "number")) return;

    const sx = x * scaleX;
    const sy = y * scaleY;
    const sw = w * scaleX;
    const sh = h * scaleY;

    const cfg = getEmotionConfig(face.top_emotion);

    // Glow rectangle
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.shadowBlur = 0;

    // Corner accents (tech-styled bbox)
    const cs = Math.min(sw, sh) * 0.18;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    [[sx, sy], [sx + sw, sy], [sx, sy + sh], [sx + sw, sy + sh]].forEach(([cx, cy], qi) => {
      ctx.beginPath();
      ctx.moveTo(cx + (qi % 2 === 0 ? cs : -cs), cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + (qi < 2 ? cs : -cs));
      ctx.stroke();
    });

    // Label tag
    const label = `${cfg.emoji} ${cfg.label} ${fmtPct(face.top_score)}`;
    ctx.font = "bold 12px 'Space Mono', monospace";
    const tw = ctx.measureText(label).width;
    const tagH = 20;
    const tagY = Math.max(tagH, sy);

    ctx.fillStyle = cfg.color + "ee";
    ctx.beginPath();
    ctx.roundRect?.(sx, tagY - tagH, tw + 12, tagH, 4) ??
      ctx.rect(sx, tagY - tagH, tw + 12, tagH);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.fillText(label, sx + 6, tagY - 5);

    // Engagement bar inside bbox bottom
    if (typeof face.engagement === "number") {
      const barY = sy + sh - 6;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(sx, barY, sw, 5);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(sx, barY, sw * face.engagement, 5);
    }
  });
}

/* ─── Image Upload Panel ────────────────────────────────────── */
function ImageUploadPanel({ onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    try {
      const data = await predictFromFile(file);
      onResult(data, file);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{
          width: 420, height: 315,
          border: "2px dashed rgba(99,202,183,0.25)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          background: preview ? "transparent" : "rgba(99,202,183,0.03)",
          backgroundImage: preview ? `url(${preview})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          overflow: "hidden",
          transition: "border-color 0.2s",
        }}
      >
        {!preview && (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(99,202,183,0.6)" }}>
              Drop image or click to upload
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.3)", marginTop: 4 }}>
              JPEG · PNG · WebP
            </div>
          </>
        )}
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(8,12,18,0.8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Space Mono', monospace",
            color: "#63CAB7",
            fontSize: 12,
          }}>
            ⚙ ANALYZING…
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && (
        <div style={{
          marginTop: 8, padding: "6px 12px", borderRadius: 8,
          background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.2)",
          fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#E05252",
        }}>{error}</div>
      )}
    </div>
  );
}

/* ─── Main WebcamPanel ──────────────────────────────────────── */
export default function WebcamPanel() {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const imageOverlayRef = useRef(null);

  const [mode, setMode] = useState("webcam"); // "webcam" | "upload"
  const [running, setRunning] = useState(false);
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("IDLE");
  const [faces, setFaces] = useState([]);
  const [sessionVad, setSessionVad] = useState(null);

  // Timeline & VA trail
  const [timeline, setTimeline] = useState([]);
  const vaTrailRef = useRef([]);
  const [vaTrail, setVaTrail] = useState([]);

  // EMA smooth state per face index
  const emaStateRef = useRef({});

  // Session stats accumulation
  const sessionRef = useRef({
    frames: 0,
    facesDetected: 0,
    engagementSum: 0,
    valenceSum: 0,
    arousalSum: 0,
    emotionCounts: {},
  });
  const [sessionStats, setSessionStats] = useState(null);

  // For image mode
  const [uploadImageDims, setUploadImageDims] = useState(null);

  const timerRef = useRef(null);
  const CAPTURE_W = 420;
  const CAPTURE_H = 315;

  /* ── Smoothing (EMA, literature-backed) ── */
  function smoothFaces(rawFaces) {
    const next = {};
    rawFaces.forEach((f, i) => {
      const prev = emaStateRef.current[i];
      next[i] = {
        ...f,
        probabilities: emaSmooth(prev?.probabilities, f.probabilities, EMA_ALPHA),
      };
    });
    emaStateRef.current = next;

    return Object.values(next).map(f => {
      const t = topOf(f.probabilities);
      return { ...f, top_emotion: t.label, top_score: t.score };
    });
  }

  /* ── Session accumulation ── */
  function accumulateSession(smoothed) {
    const s = sessionRef.current;
    s.frames += 1;
    smoothed.forEach(f => {
      s.facesDetected += 1;
      s.engagementSum += f.engagement ?? 0;
      s.valenceSum += f.vad?.valence ?? 0;
      s.arousalSum += f.vad?.arousal ?? 0;
      s.emotionCounts[f.top_emotion] = (s.emotionCounts[f.top_emotion] ?? 0) + 1;
    });

    const domEmo = Object.entries(s.emotionCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
    const n = Math.max(1, s.facesDetected);

    setSessionStats({
      totalFrames: s.frames,
      totalFacesDetected: s.facesDetected,
      avgEngagement: s.engagementSum / n,
      avgValence: s.valenceSum / n,
      avgArousal: s.arousalSum / n,
      dominantEmotion: domEmo,
      emotionCounts: { ...s.emotionCounts },
    });
  }

  /* ── VA trail update ── */
  function updateTrail(smoothed, svad) {
    const pt = svad
      ? { v: svad.valence, a: svad.arousal }
      : smoothed[0]?.vad
        ? { v: smoothed[0].vad.valence, a: smoothed[0].vad.arousal }
        : null;

    if (pt) {
      vaTrailRef.current = [...vaTrailRef.current.slice(-(VA_TRAIL_LEN - 1)), pt];
      setVaTrail([...vaTrailRef.current]);
    }
  }

  /* ── Process API result ── */
  function processResult(data) {
    const rawFaces = data.faces ?? [];
    const smoothed = smoothFaces(rawFaces);
    const svad = data.session_vad;

    setFaces(smoothed);
    setSessionVad(svad);

    // Timeline entry (primary face)
    if (smoothed.length > 0) {
      const primary = smoothed[0];
      setTimeline(prev => [
        ...prev.slice(-(TIMELINE_MAX - 1)),
        { emotion: primary.top_emotion, score: primary.top_score },
      ]);
    }

    updateTrail(smoothed, svad);
    accumulateSession(smoothed);
    drawOverlay(overlayCanvasRef.current, smoothed, CAPTURE_W, CAPTURE_H);

    return smoothed.length;
  }

  /* ── Webcam capture loop ── */
  async function captureAndSend() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = CAPTURE_W;
    canvas.height = CAPTURE_H;
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = CAPTURE_W;
      overlayCanvasRef.current.height = CAPTURE_H;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, CAPTURE_W, CAPTURE_H);
    const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return;

    try {
      setStatus("PREDICTING…");
      const data = await predictEmotion(blob);
      const n = processResult(data);
      setStatus(n > 0 ? `${n} FACE${n > 1 ? "S" : ""} DETECTED` : "NO FACE");
    } catch (e) {
      setStatus(`ERR: ${e.message}`);
    }
  }

  async function start() {
    setStatus("REQUESTING CAMERA…");
    const s = await navigator.mediaDevices.getUserMedia({
      video: { width: CAPTURE_W, height: CAPTURE_H }, audio: false,
    });
    setStream(s);
    if (videoRef.current) videoRef.current.srcObject = s;
    setRunning(true);
    setStatus("RUNNING");

    // Reset session
    sessionRef.current = { frames: 0, facesDetected: 0, engagementSum: 0, valenceSum: 0, arousalSum: 0, emotionCounts: {} };
    emaStateRef.current = {};
    vaTrailRef.current = [];
    setTimeline([]);
    setVaTrail([]);
    setSessionStats(null);

    timerRef.current = setInterval(captureAndSend, SEND_EVERY_MS);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setRunning(false);
    setStatus("STOPPED");
    setFaces([]);
  }

  useEffect(() => () => stop(), []);

  /* ── Upload mode result handler ── */
  function handleUploadResult(data, file) {
    // Get image dimensions for proper overlay scaling
    const img = new Image();
    img.onload = () => {
      setUploadImageDims({ w: img.naturalWidth, h: img.naturalHeight });
      const smoothed = smoothFaces(data.faces ?? []);
      setFaces(smoothed);
      setSessionVad(data.session_vad);
      accumulateSession(smoothed);
      updateTrail(smoothed, data.session_vad);
      if (smoothed.length > 0) {
        setTimeline(prev => [
          ...prev.slice(-59),
          { emotion: smoothed[0].top_emotion, score: smoothed[0].top_score },
        ]);
      }
    };
    img.src = URL.createObjectURL(file);
  }

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start", position: "relative", zIndex: 1 }}>

      {/* ── Left column: Video/Upload + Controls ── */}
      <div>
        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["webcam", "upload"].map(m => (
            <button
              key={m}
              onClick={() => { stop(); setMode(m); setFaces([]); }}
              style={{
                background: mode === m ? "rgba(99,202,183,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${mode === m ? "rgba(99,202,183,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 8,
                padding: "6px 16px",
                color: mode === m ? "#63CAB7" : "rgba(148,163,184,0.6)",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                transition: "all 0.2s",
              }}
            >
              {m === "webcam" ? "📹 Webcam" : "🖼️ Image"}
            </button>
          ))}
        </div>

        {/* Video / upload area */}
        {mode === "webcam" ? (
          <div style={{ position: "relative", width: CAPTURE_W, height: CAPTURE_H }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{
                width: CAPTURE_W, height: CAPTURE_H,
                borderRadius: 12,
                border: "1px solid rgba(99,202,183,0.15)",
                background: "#0d1117",
                display: "block",
              }}
            />
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: "absolute", left: 0, top: 0,
                width: CAPTURE_W, height: CAPTURE_H,
                pointerEvents: "none", borderRadius: 12,
              }}
            />
            <canvas ref={captureCanvasRef} style={{ display: "none" }} />

            {/* Scanning animation when running */}
            {running && (
              <div style={{
                position: "absolute", left: 0, top: 0,
                width: CAPTURE_W, height: 2,
                background: "linear-gradient(90deg, transparent, #63CAB7, transparent)",
                animation: "scan 2s linear infinite",
                pointerEvents: "none",
                borderRadius: 2,
              }} />
            )}
          </div>
        ) : (
          <ImageUploadPanel onResult={handleUploadResult} />
        )}

        {/* Controls */}
        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          {mode === "webcam" && (
            <>
              <button
                onClick={start}
                disabled={running}
                style={{
                  background: running ? "rgba(99,202,183,0.06)" : "rgba(99,202,183,0.15)",
                  border: "1px solid rgba(99,202,183,0.3)",
                  borderRadius: 8,
                  padding: "8px 20px",
                  color: running ? "rgba(99,202,183,0.3)" : "#63CAB7",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                  cursor: running ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s",
                }}
              >
                ▶ START
              </button>
              <button
                onClick={stop}
                disabled={!running}
                style={{
                  background: !running ? "rgba(224,82,82,0.04)" : "rgba(224,82,82,0.12)",
                  border: "1px solid rgba(224,82,82,0.2)",
                  borderRadius: 8,
                  padding: "8px 20px",
                  color: !running ? "rgba(224,82,82,0.3)" : "#E05252",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 12,
                  cursor: !running ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                  transition: "all 0.2s",
                }}
              >
                ■ STOP
              </button>
            </>
          )}
          <span style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: status.startsWith("ERR") ? "#E05252" : "rgba(99,202,183,0.6)",
            letterSpacing: "0.04em",
          }}>
            {status}
          </span>
        </div>

        {/* Timeline */}
        <div style={{ marginTop: 16 }}>
          <EmotionTimeline history={timeline} maxLen={TIMELINE_MAX} />
        </div>
      </div>

      {/* ── Middle column: Face cards ── */}
      <div style={{ flex: 1, minWidth: 320, maxWidth: 380 }}>
        <div style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 10,
          color: "rgba(99,202,183,0.6)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 10,
        }}>
          {faces.length > 0 ? `${faces.length} Face${faces.length > 1 ? "s" : ""} · EMA Smoothed` : "AWAITING FACES…"}
        </div>

        {faces.length === 0 ? (
          <div style={{
            border: "1px dashed rgba(99,202,183,0.1)",
            borderRadius: 12,
            padding: "32px 20px",
            textAlign: "center",
            color: "rgba(148,163,184,0.2)",
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
          }}>
            No faces detected yet.<br />
            Start webcam or upload an image.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {faces.map(f => <FaceCard key={f.id} face={f} />)}
          </div>
        )}
      </div>

      {/* ── Right column: VA Circumplex + Session Stats ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* VA Circumplex */}
        <div style={{
          border: "1px solid rgba(99,202,183,0.12)",
          borderRadius: 12,
          padding: 14,
          background: "rgba(13,17,23,0.6)",
        }}>
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 10,
            color: "rgba(99,202,183,0.6)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: 8,
          }}>
            Valence-Arousal Circumplex
          </div>
          <VACircumplex faces={faces} trail={vaTrail} />
          {sessionVad && (
            <div style={{
              marginTop: 8,
              fontFamily: "'Space Mono', monospace",
              fontSize: 10,
              color: "rgba(148,163,184,0.5)",
            }}>
              Scene: V={signedStr(sessionVad.valence)} A={signedStr(sessionVad.arousal)} D={signedStr(sessionVad.dominance)}
              <br />
              <span style={{ color: "#63CAB7" }}>{sessionVad.quadrant}</span>
            </div>
          )}
        </div>

        {/* Session Stats */}
        <div style={{
          border: "1px solid rgba(99,202,183,0.12)",
          borderRadius: 12,
          padding: 14,
          background: "rgba(13,17,23,0.6)",
          minWidth: 260,
        }}>
          <SessionStats stats={sessionStats} />
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%   { top: 0; }
          100% { top: ${CAPTURE_H}px; }
        }
      `}</style>
    </div>
  );
}
