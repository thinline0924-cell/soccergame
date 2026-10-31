// 案件エンジン:週ごとの案件抽選、選択の解決、効果の適用、筋の進行、状況の要約
import { CASES, THREADS } from './cases.js';
import {
  S, rand, rint, pick, clamp, club, myClub, fixtureFor, refFor, pursuer, operative, opName,
  sortedTable, addNews, nextId, SEASON_WEEKS,
} from './state.js';

const ROLE_JA = { broker: '仲介人', investigator: '調査屋', accountant: '会計士', muscle: '荒事師', cleaner: '掃除屋' };

// ---- コンテキスト:案件文中の {opp} などを解決する材料 ----
export function caseContext() {
  const fx = fixtureFor(S.week);
  const opp = fx ? club(fx.opp) : null;
  const rf = refFor(S.week);
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  let star = null;
  if (opp) { const alive = opp.keys.filter((k) => k.alive && !k.injured); star = alive.sort((a, b) => b.ovr - a.ovr)[0] || null; }
  const rival = pursuer('rival');
  return {
    fx, opp,
    oppName: opp ? opp.ja : '相手',
    refName: rf ? rf.name : '主審',
    refId: rf ? rf.id : null,
    starName: star ? star.name : '主力',
    starRole: star ? star.role : '主力',
    starId: star ? star.id : null,
    rivalName: rival ? rival.name : 'ライバル',
    pos,
  };
}

function fill(str, ctx) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{opp\}/g, ctx.oppName).replace(/\{star\}/g, ctx.starName).replace(/\{rival\}/g, ctx.rivalName).replace(/\{ref\}/g, ctx.refName);
}
function val(x, ctx, o) { return typeof x === 'function' ? x(ctx, o) : x; }

// ---- 週の案件を組み立てる ----
export function drawCases() {
  S.desk = [];
  S.resolvedThisWeek = [];
  const ctx = caseContext();

  // 導入:第1週はブラスキの面談から
  if (S.week === 1 && !S.seenCases.intro_welcome) { pushCase('intro_welcome', ctx); }

  // 予約された案件(先々で発火)
  for (const sc of S.scheduled.filter((s) => s.week === S.week)) pushCase(sc.caseId, ctx, sc.ctx);
  S.scheduled = S.scheduled.filter((s) => s.week !== S.week);

  // 筋(スレッド)の進行段
  progressThreads(ctx);

  // 固定条件の案件(期限など)
  for (const key of Object.keys(CASES)) {
    const c = CASES[key];
    if (c.atWeek === S.week && !S.seenCases[key]) pushCase(key, ctx);
  }

  // 通常の案件を、空きが埋まるまで抽選(目標は3件、最低2件)
  const target = S.week <= 2 ? 2 : 3;
  const pool = [];
  for (const key of Object.keys(CASES)) {
    const c = CASES[key];
    if (c.thread || c.once || c.atWeek || c.intro) continue;
    if (c.filler) continue;
    if (!eligible(key, c, ctx)) continue;
    for (let i = 0; i < (c.weight || 1); i++) pool.push(key);
  }
  let guard = 0;
  while (S.desk.length < target && guard++ < 40) {
    if (!pool.length) break;
    const key = pick(pool);
    if (S.desk.find((d) => d.key === key)) { // 同じ案件は1週に1つ
      // プールから全部抜く
      for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === key) pool.splice(i, 1);
      continue;
    }
    pushCase(key, ctx);
  }

  // それでも足りなければフィラーで埋める
  if (S.desk.length < 2) {
    const fillers = Object.keys(CASES).filter((k) => CASES[k].filler && !S.desk.find((d) => d.key === k));
    while (S.desk.length < 2 && fillers.length) pushCase(fillers.splice(rint(0, fillers.length - 1), 1)[0], ctx);
  }
  return S.desk;
}

function eligible(key, c, ctx) {
  if (c.needMatch && !ctx.fx) return false;
  if (c.needOppStar && !ctx.starId) return false;
  if (c.needWeakOpp) { if (!ctx.opp || ctx.opp.str > 58) return false; }
  if (c.needDrinker) { const acc = S.operatives.find((o) => o.alive && o.role === 'accountant' && o.weakness && o.weakness.key === 'drink'); if (!acc) return false; }
  if (c.onceSeen && S.seenCases[key]) return false;
  return true;
}

function pushCase(key, ctx, extra) {
  const c = CASES[key];
  if (!c) return;
  S.desk.push({ key, from: c.from, tag: c.tag, _ctx: extra || null });
  if (c.once || c.atWeek) S.seenCases[key] = true;
}

function progressThreads(ctx) {
  // 記者スレッド
  const th = S.threads;
  if (!th.press && S.week >= (THREADS.press.start || 3)) { th.press = { step: 1 }; }
  if (th.press && th.press.step && !th.press.done) {
    const stepCase = Object.keys(CASES).find((k) => CASES[k].thread === 'press' && CASES[k].step === th.press.step);
    if (stepCase && !S.desk.find((d) => d.key === stepCase)) {
      // 記者の証拠が溜まっているほど早く次段へ。各段は一度出したら手動進行。
      if (!th.press.shown || th.press.shown !== th.press.step) { pushCase(stepCase, ctx); th.press.shown = th.press.step; }
    }
  }
  // ライバルスレッド
  const rival = pursuer('rival');
  if (!th.rival && rival && rival.evidence >= (THREADS.rival.needRivalHeat || 25)) th.rival = { step: 1 };
  if (th.rival && th.rival.step && !th.rival.done) {
    const stepCase = Object.keys(CASES).find((k) => CASES[k].thread === 'rival' && CASES[k].step === th.rival.step);
    if (stepCase && !S.desk.find((d) => d.key === stepCase) && (!th.rival.shown || th.rival.shown !== th.rival.step)) {
      pushCase(stepCase, ctx); th.rival.shown = th.rival.step;
    }
  }
}

// ---- 選択肢の可否 ----
export function availableOperative(role) {
  if (!role) return null;
  return S.operatives.filter((o) => o.alive && !o.defected && o.role === role).sort((a, b) => b.skill - a.skill)[0] || null;
}
export function choiceStatus(caseKey, choice) {
  const c = CASES[caseKey];
  const ctx = caseContext();
  const need = choice.need || {};
  const reasons = [];
  if (need.black && S.money.black < need.black) reasons.push(`裏金が足りない`);
  if (need.clean && S.money.clean < need.clean) reasons.push(`資金が足りない`);
  if (need.flag && !(S.flags && S.flags[need.flag]) && !hasFlag(need.flag)) reasons.push('その覚悟がまだない');
  if (need.leverage && !(S.leverage && S.leverage[need.leverage])) reasons.push('弱みを握っていない');
  let operativeObj = null;
  if (choice.assign) {
    operativeObj = availableOperative(choice.assign);
    if (!operativeObj) reasons.push(`空いている${ROLE_JA[choice.assign]}がいない`);
  }
  return { ok: reasons.length === 0, reasons, operative: operativeObj };
}
function hasFlag(f) { return S.flags && S.flags[f]; }

// ---- 選択の解決 ----
export function resolveCase(caseKey, choiceId) {
  const c = CASES[caseKey];
  const choice = c.choices.find((x) => x.id === choiceId);
  const ctx = caseContext();
  const st = choiceStatus(caseKey, choice);
  const o = st.operative;
  let branch, ok = true;
  if (choice.risk) {
    const chance = clamp(Math.round(val(choice.risk, ctx, o)), 3, 97);
    ok = rand() * 100 < chance;
    branch = ok ? choice.onOk : choice.onFail;
  } else {
    branch = { eff: choice.eff || [], text: choice.text };
  }
  const effects = branch.eff || [];
  applyEffects(effects, ctx, o);
  if (o) o.busy = null; // 案件は即時解決(翌週に持ち越さない)

  const report = {
    caseKey, title: fill(val(c.title, ctx), ctx),
    choiceLabel: fill(val(choice.label, ctx), ctx),
    ok,
    risky: !!choice.risk,
    text: fill(val(branch.text, ctx), ctx),
    operative: o ? opName(o) : null,
    traced: effects.some((e) => e.trace),
  };
  S.resolvedThisWeek.push(caseKey);
  S.stats.cases++;
  // スレッドの手動進行:thread案件を解決したら次段へ
  if (c.thread) {
    const eff = effects.find((e) => e.thread);
    if (eff) { S.threads[eff.thread.id] = { ...(S.threads[eff.thread.id] || {}), step: eff.thread.step, shown: null }; }
    else { // 進めない選択(様子見)なら、その段はまた来週出す余地を残す
      if (S.threads[c.thread]) S.threads[c.thread].shown = null;
    }
  }
  return report;
}

export function applyEffects(effects, ctx, o) {
  for (const e of effects) {
    if (e.black != null) S.money.black = Math.max(0, S.money.black + e.black);
    if (e.clean != null) S.money.clean += e.clean;
    if (e.morale != null) S.morale = clamp(S.morale + e.morale, -30, 30);
    if (e.supporters != null) S.supporters = clamp(S.supporters + e.supporters, 0, 100);
    if (e.heat != null) S.heat = (S.heat || 0) + e.heat;
    if (e.ev) {
      const list = e.ev.who === 'all' ? S.pursuers : S.pursuers.filter((p) => p.kind === e.ev.who);
      for (const p of list) if (p.alive) p.evidence = clamp(p.evidence + e.ev.d, 0, 100);
    }
    if (e.trace) {
      S.traces.push({ id: nextId('tr'), op: 'case', opName: ctx ? '' : '', operativeId: o ? o.id : null, operativeName: o ? opName(o) : '―', kind: e.trace.kind, size: e.trace.size, week: S.week, found: {} });
    }
    if (e.oppWeaken != null) S.mods.oppWeak += e.oppWeaken;
    if (e.refRig) { S.mods.refCalls += 1; S.mods.refBy = ctx ? ctx.refName : '主審'; }
    if (e.fixMatch) S.mods.fixed = true;
    if (e.injureOpp != null && ctx && ctx.starId) {
      for (const cl of S.clubs) { const k = cl.keys.find((x) => x.id === ctx.starId); if (k) { k.injured = e.injureOpp; cl.morale = (cl.morale || 0) - 4; } }
    }
    if (e.loyalty != null && o) o.loyalty = clamp(o.loyalty + e.loyalty, 0, 100);
    if (e.loyaltyRole) { const t = S.operatives.find((x) => x.alive && x.role === e.loyaltyRole.role); if (t) t.loyalty = clamp(t.loyalty + e.loyaltyRole.d, 0, 100); }
    if (e.fixDiscretion) { const t = S.operatives.find((x) => x.alive && x.role === e.fixDiscretion); if (t) { t.discretion = clamp(t.discretion + 25, 0, 100); if (t.weakness) t.weakness.key = 'none'; } }
    if (e.flag) { S.flags = S.flags || {}; S.flags[e.flag] = true; }
    if (e.unflag && S.flags) delete S.flags[e.flag];
    if (e.leverage) { S.leverage = S.leverage || {}; S.leverage[e.leverage] = { week: S.week }; }
    if (e.schedule) S.scheduled.push({ caseId: e.schedule.caseId, week: S.week + e.schedule.in });
    if (e.news) addNews(fill(e.news[0], ctx || {}), e.news[1] || 'misc');
    if (e.stat) S.stats[e.stat] = (S.stats[e.stat] || 0) + 1;
    if (e.thread) { /* resolveCase 側で処理 */ }
  }
}

// ---- 状況の要約(プレイヤーに「今の勝負どころ」を一言で) ----
export function situationLine() {
  const ctx = caseContext();
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  const toPromo = pos <= 2 ? 0 : S.table[tbl[1].id].pts - S.table[S.clubId].pts + 1;
  // 最大の脅威
  const live = S.pursuers.filter((p) => p.alive);
  const top = live.sort((a, b) => b.evidence - a.evidence)[0];
  const lines = [];
  if (toPromo <= 0) lines.push('昇格圏にいる。この位置を守れ。');
  else lines.push(`昇格圏(2位)まで勝ち点 ${toPromo}。`);
  if (top && top.evidence >= 70) lines.push(`${top.name}が決定的な動きに出ようとしている。急いで手を打て。`);
  else if (top && top.evidence >= 40) lines.push(`${top.name}が嗅ぎ回っている(証拠 ${Math.round(top.evidence)})。`);
  else lines.push('追及の手はまだ遠い。今のうちに動けることをやれ。');
  return lines;
}

export function objective() {
  const ctx = caseContext();
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  const live = S.pursuers.filter((p) => p.alive).sort((a, b) => b.evidence - a.evidence);
  return {
    week: S.week, pos,
    next: ctx.fx ? { opp: ctx.opp.short, oppJa: ctx.opp.ja, isHome: ctx.fx.isHome } : null,
    threat: live[0] ? { name: live[0].name, ev: Math.round(live[0].evidence), kind: live[0].kind } : null,
    pts: S.table[S.clubId].pts,
  };
}

export { fill, val, ROLE_JA };
