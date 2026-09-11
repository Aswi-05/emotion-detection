// Shared emotion config: colors, emoji, descriptions
// Based on FACS + Russell's circumplex model

export const EMOTION_CONFIG = {
  happy:    { color: "#F6C90E", hex: "#F6C90E", emoji: "😊", label: "Happy",    bg: "rgba(246,201,14,0.12)" },
  sad:      { color: "#5B9BD5", hex: "#5B9BD5", emoji: "😢", label: "Sad",      bg: "rgba(91,155,213,0.12)" },
  angry:    { color: "#E05252", hex: "#E05252", emoji: "😠", label: "Angry",    bg: "rgba(224,82,82,0.12)" },
  fear:     { color: "#A855F7", hex: "#A855F7", emoji: "😨", label: "Fear",     bg: "rgba(168,85,247,0.12)" },
  disgust:  { color: "#22C55E", hex: "#22C55E", emoji: "🤢", label: "Disgust",  bg: "rgba(34,197,94,0.12)" },
  surprise: { color: "#F97316", hex: "#F97316", emoji: "😲", label: "Surprise", bg: "rgba(249,115,22,0.12)" },
  neutral:  { color: "#94A3B8", hex: "#94A3B8", emoji: "😐", label: "Neutral",  bg: "rgba(148,163,184,0.08)" },
  contempt: { color: "#E67E22", hex: "#E67E22", emoji: "😒", label: "Contempt", bg: "rgba(230,126,34,0.12)" },
};

export function getEmotionConfig(emotion) {
  return EMOTION_CONFIG[emotion?.toLowerCase?.()] ?? {
    color: "#94A3B8", hex: "#94A3B8", emoji: "🤔", label: emotion ?? "Unknown", bg: "rgba(148,163,184,0.08)"
  };
}

// Reference emotion VA positions for the circumplex plot
export const EMOTION_VA_REF = [
  { id: "happy",    v:  0.81, a:  0.51 },
  { id: "surprise", v:  0.40, a:  0.67 },
  { id: "neutral",  v:  0.00, a:  0.00 },
  { id: "disgust",  v: -0.60, a:  0.35 },
  { id: "contempt", v: -0.30, a:  0.20 },
  { id: "angry",    v: -0.51, a:  0.59 },
  { id: "fear",     v: -0.64, a:  0.60 },
  { id: "sad",      v: -0.63, a: -0.27 },
];
