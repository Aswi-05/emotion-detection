const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function predictEmotion(blob) {
  const form = new FormData();
  form.append("file", blob, "frame.jpg");

  const res = await fetch(`${BASE}/predict`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function predictFromFile(file) {
  const form = new FormData();
  form.append("file", file, file.name);

  const res = await fetch(`${BASE}/predict`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export async function checkHealth() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}
