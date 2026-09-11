import React from "react";
import { getEmotionConfig } from "./emotionConfig.js";

function Stat({ label, value, sub }) {
  return (
    <div style={{
      background: "rgba(13,17,23,0.8)",
      border: "1px solid rgba(99,202,183,0.12)",
      borderRadius: 10,
      padding: "10px 14px",
      minWidth: 90,
    }}>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 20,
        fontWeight: 700,
        color: "#63CAB7",
        letterSpacing: "-0.5px",
      }}>{value}</div>
      <div style={{
        fontSize: 9,
        fontFamily: "'Space Mono', monospace",
        color: "rgba(148,163,184,0.6)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        marginTop: 2,
      }}>{label}</div>
      {sub && (
        <div style={{ fontSize: 9, color: "rgba(148,163,184,0.4)", marginTop: 1 }}>{sub}</div>
      )}
    </div>
  );
}

export default function SessionStats({ stats }) {
  if (!stats) return null;
  const {
    totalFrames,
    totalFacesDetected,
    avgEngagement,
    dominantEmotion,
    emotionCounts,
    avgValence,
    avgArousal,
  } = stats;

  const cfg = dominantEmotion ? getEmotionConfig(dominantEmotion) : null;

  return (
    <div>
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 10,
        color: "rgba(99,202,183,0.6)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 10,
      }}>Session Analytics</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Stat label="Frames" value={totalFrames} />
        <Stat label="Faces Seen" value={totalFacesDetected} />
        <Stat
          label="Engagement"
          value={`${(avgEngagement * 100).toFixed(0)}%`}
          sub="1 − P(neutral)"
        />
        <Stat
          label="Avg Valence"
          value={avgValence >= 0 ? `+${avgValence.toFixed(2)}` : avgValence.toFixed(2)}
          sub="pleasant ↑"
        />
        <Stat
          label="Avg Arousal"
          value={avgArousal >= 0 ? `+${avgArousal.toFixed(2)}` : avgArousal.toFixed(2)}
          sub="excited ↑"
        />
      </div>

      {cfg && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: cfg.bg,
          border: `1px solid ${cfg.color}33`,
          borderRadius: 10, padding: "8px 14px", marginBottom: 12,
        }}>
          <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: cfg.color, fontWeight: 700 }}>
              DOMINANT: {cfg.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 10, color: "rgba(148,163,184,0.5)", fontFamily: "'Space Mono', monospace" }}>
              most frequent emotion this session
            </div>
          </div>
        </div>
      )}

      {/* Emotion distribution bars */}
      {emotionCounts && Object.keys(emotionCounts).length > 0 && (
        <div>
          <div style={{
            fontSize: 9,
            fontFamily: "'Space Mono', monospace",
            color: "rgba(148,163,184,0.4)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 6,
          }}>Distribution</div>
          {Object.entries(emotionCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([emo, count]) => {
              const c = getEmotionConfig(emo);
              const pct = (count / totalFrames * 100).toFixed(0);
              return (
                <div key={emo} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, width: 18, textAlign: "center" }}>{c.emoji}</span>
                  <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: c.color,
                      borderRadius: 2,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <span style={{
                    width: 32, textAlign: "right",
                    fontFamily: "'Space Mono', monospace",
                    fontSize: 10,
                    color: "rgba(148,163,184,0.6)",
                  }}>{pct}%</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
