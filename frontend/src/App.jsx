import React from "react";
import WebcamPanel from "./WebcamPanel.jsx";

const BADGE_STYLE = {
  background: "rgba(99,202,183,0.1)",
  border: "1px solid rgba(99,202,183,0.2)",
  borderRadius: 20,
  padding: "3px 12px",
  fontSize: 10,
  fontFamily: "'Space Mono', monospace",
  color: "rgba(99,202,183,0.8)",
  letterSpacing: "0.08em",
};

export default function App() {
  return (
    <div style={{ minHeight: "100vh", padding: "24px 28px", position: "relative", zIndex: 1 }}>

      {/* ── Header ── */}
      <header style={{ marginBottom: 28, borderBottom: "1px solid rgba(99,202,183,0.08)", paddingBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36,
                background: "linear-gradient(135deg, #63CAB7, #3B82F6)",
                borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 0 20px rgba(99,202,183,0.3)",
              }}>😐</div>
              <h1 style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: 24,
                color: "#e2e8f0",
                letterSpacing: "-0.5px",
                lineHeight: 1,
              }}>
                AffectSense
                <span style={{ color: "#63CAB7" }}>.</span>
              </h1>
            </div>
            <p style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 11,
              color: "rgba(148,163,184,0.5)",
              letterSpacing: "0.04em",
              maxWidth: 600,
            }}>
              Real-time facial affect analysis · ViT classifier + MediaPipe detector · VAD circumplex · FACS action units
            </p>
          </div>

          {/* Feature badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[
              "🎯 ViT Emotion Model",
              "📍 MediaPipe Detection",
              "🔁 EMA Smoothing",
              "🧭 VA Circumplex",
              "🎭 FACS AUs",
              "📊 Session Analytics",
            ].map(b => <span key={b} style={BADGE_STYLE}>{b}</span>)}
          </div>
        </div>
      </header>

      {/* ── Literature callout ── */}
      <div style={{
        marginBottom: 24,
        padding: "12px 16px",
        background: "rgba(99,202,183,0.04)",
        border: "1px solid rgba(99,202,183,0.1)",
        borderRadius: 10,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 16, marginTop: 2 }}>📚</span>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "rgba(148,163,184,0.5)", lineHeight: 1.6 }}>
          <span style={{ color: "rgba(99,202,183,0.7)" }}>Literature-grounded enhancements: </span>
          Valence-Arousal-Dominance mapping (Russell 1980; AffectNet) · FACS action units (Ekman &amp; Friesen 1978; Saito et al., 2024) ·
          Exponential temporal smoothing for transient expressions (Contreras-Higuera et al., 2025) ·
          Engagement score via P(non-neutral) (Muhammad et al., 2017) · VAD quadrant labels aligned with affective computing literature.
        </div>
      </div>

      {/* ── Main Panel ── */}
      <WebcamPanel />

      {/* ── Footer ── */}
      <footer style={{
        marginTop: 36,
        paddingTop: 16,
        borderTop: "1px solid rgba(99,202,183,0.06)",
        fontFamily: "'Space Mono', monospace",
        fontSize: 10,
        color: "rgba(148,163,184,0.25)",
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
      }}>
        <span>Model: trpakov/vit-face-expression</span>
        <span>Detector: MediaPipe FaceDetection</span>
        <span>Smoothing: EMA α=0.35</span>
        <span>VAD: Warriner et al. 2013 calibration</span>
        <span>CPU inference · ~1.5 FPS</span>
      </footer>
    </div>
  );
}
