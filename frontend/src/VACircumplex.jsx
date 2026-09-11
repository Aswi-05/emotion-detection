import React, { useEffect, useRef } from "react";
import { EMOTION_VA_REF, getEmotionConfig } from "./emotionConfig.js";

/**
 * VACircumplex – draws Russell's 2D circumplex (Valence × Arousal).
 *
 * Reference: Russell, J.A. (1980). A circumplex model of affect.
 *            Journal of Personality and Social Psychology, 39(6), 1161–1178.
 *
 * Enhancements vs. baseline:
 *  - Shows weighted VAD position per face (computed on backend)
 *  - Trail of last N positions for temporal context
 *  - Reference emotion dots for spatial grounding
 *  - Quadrant labels aligned with affective computing literature
 */
export default function VACircumplex({ faces = [], trail = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) / 2 - 28;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(99,202,183,0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner rings
    [0.33, 0.66].forEach(frac => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(99,202,183,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = "rgba(99,202,183,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - R - 8, cy); ctx.lineTo(cx + R + 8, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R - 8); ctx.lineTo(cx, cy + R + 8); ctx.stroke();

    // Axis labels
    ctx.font = "bold 10px 'Space Mono', monospace";
    ctx.fillStyle = "rgba(99,202,183,0.6)";
    ctx.textAlign = "center";
    ctx.fillText("VALENCE +", cx + R - 28, cy - 8);
    ctx.fillText("VALENCE −", cx - R + 28, cy - 8);
    ctx.fillText("AROUSAL +", cx + 2, cy - R + 14);
    ctx.fillText("AROUSAL −", cx + 2, cy + R - 6);

    // Quadrant labels
    ctx.font = "9px 'Space Mono', monospace";
    ctx.fillStyle = "rgba(148,163,184,0.3)";
    ctx.textAlign = "center";
    const ql = R * 0.6;
    ctx.fillText("EXCITED", cx + ql, cy - ql * 0.9);
    ctx.fillText("CONTENT", cx + ql, cy + ql * 0.9);
    ctx.fillText("STRESSED", cx - ql, cy - ql * 0.9);
    ctx.fillText("BORED", cx - ql, cy + ql * 0.9);

    // Helper: VA coords → canvas coords
    const toCanvas = (v, a) => ({
      x: cx + v * R,
      y: cy - a * R,  // invert y
    });

    // Reference emotion dots
    ctx.font = "9px 'Space Mono', monospace";
    EMOTION_VA_REF.forEach(ref => {
      const { x, y } = toCanvas(ref.v, ref.a);
      const cfg = getEmotionConfig(ref.id);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color + "55";
      ctx.fill();
      ctx.strokeStyle = cfg.color + "99";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = cfg.color + "99";
      ctx.textAlign = "center";
      ctx.fillText(cfg.emoji, x, y - 8);
    });

    // Trail (faded previous positions)
    if (trail.length > 1) {
      trail.forEach((pt, idx) => {
        const alpha = (idx / trail.length) * 0.5;
        const { x, y } = toCanvas(pt.v, pt.a);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,202,183,${alpha})`;
        ctx.fill();
      });
      // Connect trail line
      ctx.beginPath();
      trail.forEach((pt, idx) => {
        const { x, y } = toCanvas(pt.v, pt.a);
        if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "rgba(99,202,183,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Current face positions
    faces.forEach((face, fi) => {
      if (!face.vad) return;
      const { valence, arousal } = face.vad;
      const { x, y } = toCanvas(valence, arousal);
      const cfg = getEmotionConfig(face.top_emotion);

      // Glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 16);
      grad.addColorStop(0, cfg.color + "66");
      grad.addColorStop(1, cfg.color + "00");
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Main dot
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Face label
      ctx.font = "bold 10px 'Space Mono', monospace";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`F${fi}`, x, y - 12);
    });

    // No data state
    if (faces.length === 0 && trail.length === 0) {
      ctx.font = "11px 'Space Mono', monospace";
      ctx.fillStyle = "rgba(148,163,184,0.3)";
      ctx.textAlign = "center";
      ctx.fillText("AWAITING SIGNAL…", cx, cy + 4);
    }
  }, [faces, trail]);

  return (
    <canvas
      ref={canvasRef}
      width={260}
      height={260}
      style={{ borderRadius: 12, display: "block" }}
    />
  );
}
