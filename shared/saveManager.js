const SAVE_KEY = 'vanguard_champions_franchise_v1';
const SALT = 'Vanguard-Champions-Static-Integrity-v1';

export function defaultSave() {
  return {
    version: 1,
    games: Object.fromEntries(Array.from({ length: 13 }, (_, i) => {
      const id = i + 1;
      return [id, { unlockedStages: [1], completedStages: [], bestScores: {}, unlockedHeroes: [], unlockedCodexIds: [], gameSpecificFlags: {}, endings: [] }];
    })),
    settings: { master: 0.7, sfx: 0.8, music: 0.45, autoPause: true, highContrast: false },
    codexUnlocked: ['birth'],
    totalPlaySeconds: 0
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return parsed.data || parsed;
  } catch {
    return defaultSave();
  }
}
export function writeSave(save) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  return save;
}
export function mergeSave(save) {
  const base = defaultSave();
  return { ...base, ...save, settings: { ...base.settings, ...(save.settings || {}) }, games: { ...base.games, ...(save.games || {}) } };
}
export async function sha256(text) {
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0xdeadbeef ^ text.length, h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
export async function exportSave(save) {
  const canonical = JSON.stringify(save);
  const hash = await sha256(SALT + canonical);
  const payload = { app: 'Vanguard Champions', version: 1, data: save, integrity: hash };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'vanguard-champions-save.json'; a.click();
  URL.revokeObjectURL(url);
}
export async function importSave(file) {
  const payload = JSON.parse(await file.text());
  if (!payload.data || !payload.integrity) throw new Error('Invalid Vanguard Champions save file.');
  const canonical = JSON.stringify(payload.data);
  const expected = await sha256(SALT + canonical);
  if (payload.integrity !== expected) throw new Error('Integrity check failed: this save may have been tampered with.');
  return mergeSave(payload.data);
}
