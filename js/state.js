// ゲーム状態の生成・保存・読み込み
import { CLUBS, KEY_PLAYERS, SQUAD, MARKET, REFEREES, START_OPERATIVES, HIRE_POOL, PURSUERS, SEASON_WEEKS } from './data.js';
export { SEASON_WEEKS } from './data.js';

const SAVE_KEY = 'offside.save.v1';
const SETTINGS_KEY = 'offside.settings.v1';

export let S = null;

export const rand = () => Math.random();
export const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clone = (o) => JSON.parse(JSON.stringify(o));

// 8クラブの2回戦総当たり(円環法)
function makeFixtures(ids) {
  const n = ids.length;
  const arr = ids.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());
  }
  const second = rounds.map((ps) => ps.map(([a, b]) => [b, a]));
  return rounds.concat(second).slice(0, SEASON_WEEKS);
}

export function newGame() {
  let uid = 1;
  const id = (p) => p + (uid++);
  const clubs = CLUBS.map((c) => ({
    ...clone(c),
    keys: (KEY_PLAYERS[c.id] || []).map((k, i) => ({ ...k, id: c.id + 'k' + i, club: c.id, injured: 0, alive: true, bribed: false })),
    morale: 0,
  }));
  S = {
    v: 1,
    uid: 100,
    week: 1,
    phase: 'office', // office | match | news | trial | end
    clubId: 'VEL',
    owner: { name: 'あなた', alive: true },
    clubs,
    squad: clone(SQUAD),
    market: clone(MARKET),
    tactic: 'balanced',
    table: Object.fromEntries(clubs.map((c) => [c.id, { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, pen: 0 }])),
    fixtures: makeFixtures(clubs.map((c) => c.id)),
    results: [], // [{week, home, away, hs, as}]
    money: { clean: 2410, black: 384, debt: 11200, dueWeek: 10, dueAmount: 1200, duePaid: false, deferred: false, negWeeks: 0 },
    supporters: 62,
    morale: 0,
    referees: clone(REFEREES).map((r) => ({ ...r, alive: true, owned: 0 })),
    operatives: START_OPERATIVES.map((o) => ({ ...clone(o), id: id('o'), alive: true, defected: false, busy: null, known: false, guard: false })),
    hirePool: clone(HIRE_POOL).map((o) => ({ ...o, id: id('h') })),
    pursuers: clone(PURSUERS).map((p) => ({ ...p, alive: true, gen: 0, aggr: 1, quiet: 0, flags: {} })),
    ops: [],       // 進行中の工作
    opLog: [],     // 完了した工作(最新が先頭)
    traces: [],    // {id, op, opName, operative, kind, size, week, found:{pid:true}}
    leverage: {},  // targetKey -> {text, week}
    mods: newMods(),
    news: [],      // {week, text, kind}
    reports: [],   // 今週の工作報告(週送り時に表示)
    paper: null,   // 今週の新聞
    lastMatch: null,
    trial: null,
    ending: null,
    stats: { opsDone: 0, killed: 0, bribes: 0, cases: 0 },
    // 案件システム
    desk: [],            // 今週届いている案件 [{...caseInstance}]
    resolvedThisWeek: [], // 今週すでに処理した案件id
    threads: {},         // 連続した筋の進行 {threadId:{step,active,...}}
    scheduled: [],       // 先々で発火する案件 [{caseId, week, ctx}]
    seenCases: {},       // 一度きりの案件の既出フラグ
    aftermath: [],       // 試合後に見せる「何が変わったか」
    tutorial: 0,         // 導入の進行(0=未開始)
  };
  S.uid = uid + 10;
  assignReferees();
  addNews('新オーナー就任。US ヴェラルド、再建を約束', 'club');
  addNews('首都検察、港湾公社の資金の流れを内偵との噂', 'pros');
  save();
  return S;
}

export function newMods() {
  return { refCalls: 0, refBy: null, oppWeak: 0, oppWeakNames: [], fixed: false, bet: 0, rivalRef: false, guard: false, briberRef: null, promisedPlayer: null };
}

export function nextId(p) { S.uid++; return p + S.uid; }

export function assignReferees() {
  // 各週の自クラブの試合に主審を割り当てる
  const live = S.referees.filter((r) => r.alive);
  S.refSchedule = S.refSchedule || {};
  for (let w = 1; w <= SEASON_WEEKS; w++) {
    if (!S.refSchedule[w] || !live.find((r) => r.id === S.refSchedule[w])) S.refSchedule[w] = pick(live).id;
  }
}

export function addNews(text, kind = 'misc', week = null) {
  S.news.unshift({ week: week ?? S.week, text, kind });
  if (S.news.length > 60) S.news.length = 60;
}

export const club = (id) => S.clubs.find((c) => c.id === id);
export const myClub = () => club(S.clubId);
export const fixtureFor = (week, cid = S.clubId) => {
  const f = (S.fixtures[week - 1] || []).find(([a, b]) => a === cid || b === cid);
  if (!f) return null;
  return { home: f[0], away: f[1], opp: f[0] === cid ? f[1] : f[0], isHome: f[0] === cid };
};
export const refFor = (week) => S.referees.find((r) => r.id === S.refSchedule[week]);
export const pursuer = (id) => S.pursuers.find((p) => p.id === id);
export const operative = (id) => S.operatives.find((o) => o.id === id);
export const opName = (o) => o.alias ? `“${o.alias}”` : o.name;

export function sortedTable() {
  return Object.entries(S.table)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

// 人物(工作の対象)を一意キーで引く
export function personByKey(key) {
  const [type, a] = key.split(':');
  if (type === 'pur') { const p = pursuer(a); return p && { key, type, name: p.name, sub: p.org, alive: p.alive, obj: p }; }
  if (type === 'ref') { const r = S.referees.find((x) => x.id === a); return r && { key, type, name: r.name, sub: '主審', alive: r.alive, obj: r }; }
  if (type === 'kp') {
    for (const c of S.clubs) {
      const k = (c.keys || []).find((x) => x.id === a);
      if (k) return { key, type, name: k.name, sub: `${c.ja} ・ ${k.pos} ${k.role}`, alive: k.alive, obj: k, club: c.id };
    }
  }
  if (type === 'own') { const o = operative(a); return o && { key, type, name: opName(o), sub: o.note, alive: o.alive && !o.defected, obj: o }; }
  return null;
}

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d && d.v === 1) { S = d; return S; }
  } catch (e) { /* 壊れたデータ */ }
  return null;
}
export function hasSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; const d = JSON.parse(raw); return d && d.v === 1 && d.phase !== 'end'; } catch (e) { return false; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }

export const settings = { timer: true, sound: false, speed: 1 };
export function loadSettings() {
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { /* noop */ }
}
export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* noop */ }
}

export const fmtK = (k) => {
  const neg = k < 0; const a = Math.abs(k);
  const s = a >= 1000 ? (a / 1000).toFixed(2) + 'M' : Math.round(a) + 'k';
  return (neg ? '−' : '') + '€' + s;
};
