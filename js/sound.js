// 効果音をコードで合成(素材なし)。設定で有効化。初期は無音。
import { settings } from './state.js';

let ctx = null;
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } return ctx; }

function blip(freq, dur, type = 'square', vol = 0.06) {
  if (!settings.sound) return;
  const a = ac(); if (!a) return;
  if (a.state === 'suspended') a.resume();
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

export const sfx = {
  type: () => blip(1600, 0.02, 'square', 0.02),
  click: () => blip(420, 0.05, 'square', 0.05),
  stamp: () => { blip(140, 0.09, 'sawtooth', 0.09); setTimeout(() => blip(90, 0.12, 'sawtooth', 0.07), 40); },
  goal: () => { [660, 880, 1100].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.07), i * 90)); },
  whistle: () => { blip(2100, 0.12, 'square', 0.05); setTimeout(() => blip(2300, 0.1, 'square', 0.05), 130); },
  alert: () => { blip(200, 0.18, 'sawtooth', 0.08); },
  crowd: () => { if (!settings.sound) return; const a = ac(); if (!a) return; const b = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.12 * (1 - i / d.length); const s = a.createBufferSource(); s.buffer = b; const g = a.createGain(); g.gain.value = 0.3; s.connect(g).connect(a.destination); s.start(); },
};
