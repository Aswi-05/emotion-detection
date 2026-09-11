import React, { useEffect, useRef } from "react";
import { getEmotionConfig } from "./emotionConfig.js";

/**
 * EmotionTimeline – rolling temporal chart of dominant emotion per frame.
 *
 * Research basis:
 *  - Temporal context is key for accurate FER in-the-wild
 *    (Contreras-Higuera et al., Human Behavior & Emerging Tech, 2025)
 *  - Shows emotion dynamics over time, not just instantaneous snapshots
 */
export default function EmotionTimeline({ history = [], maxLen = 60 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    if (history.length === 0) {
      ctx.font = "11px 'Space Mono', monospace";
      ctx.fillStyle = "rgba(148,163,184,0.3)";
      ctx.textAlign = "center";
      ctx.fillText("TIMELINE EMPTY", W / 2, H / 2 + 4);
      return;
    }

    // Draw colored strips for each frame
    const padded = history.slice(-maxLen);
    const stripW = W / maxLen;

    padded.forEach((entry, i) => {
      const xPos = i * stripW;
      const cfg = getEmotionConfig(entry.emotion);
      const alpha = 0.3 + entry.score * 0.55;

      ctx.fillStyle = cfg.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(xPos, 0, Math.max(1, stripW - 0.5), H - 18);
    });
    ctx.globalAlpha = 1;

    // Emoji row at bottom
    const emojiStep = Math.max(1, Math.floor(padded.length / 12));
    padded.forEach((entry, i) => {
      if (i % emojiStep !== 0) return;
      const xPos = i * stripW + stripW / 2;
      const cfg = getEmotionConfig(entry.emotion);
      ctx.font = "10px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.8;
      ctx.fillText(cfg.emoji, xPos, H - 4);
    });
    ctx.globalAlpha = 1;

    // Time axis line
    ctx.strokeStyle = "rgba(99,202,183,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 18);
    ctx.lineTo(W, H - 18);
    ctx.stroke();

    // "now" tick
    if (padded.length > 0) {
      const nowX = (padded.length - 1) * stripW + stripW / 2;
      ctx.strokeStyle = "rgba(99,202,183,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nowX, 0);
      ctx.lineTo(nowX, H - 18);
      ctx.stroke();
    }

    // Score line (overlay)
    ctx.beginPath();
    padded.forEach((entry, i) => {
      const xPos = i * stripW + stripW / 2;
      const yPos = (H - 18) * (1 - entry.score);
      if (i === 0) ctx.moveTo(xPos, yPos);
      else ctx.lineTo(xPos, yPos);
    });
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

  }, [history, maxLen]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={520}
        height={80}
        style={{ borderRadius: 8, display: "block", width: "100%" }}
      />
      <div style={{
        display: "flex", justifyContent: "space-between",
        marginTop: 4, fontSize: 10,
        fontFamily: "'Space Mono', monospace",
        color: "rgba(148,163,184,0.5)"
      }}>
        <span>−{maxLen}s</span>
        <span>EMOTION OVER TIME</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
