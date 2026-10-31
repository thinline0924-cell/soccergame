// 週送りの全体処理:工作の解決 → 試合 → 週末処理 → 新聞
import { S, rand, rint, clamp, club, myClub, fixtureFor, refFor, newMods, addNews, opName, save, sortedTable } from './state.js';
import { resolveOps } from './ops.js';
import { advancePursuit, checkOwnerSafety, checkBankrupt, checkSeasonEnd, recomputePts } from './pursuit.js';

// 週の前半:工作の解決(試合の前)
export function preMatch() {
  // 主審が弱みを握られている(owned)なら、自動で判定を一回傾けられる
  const rf = refFor(S.week);
  if (rf && rf.owned > 0 && S.mods.refCalls === 0) { S.mods.refCalls = 1; S.mods.refBy = rf.name; rf.owned--; }
  const reports = resolveOps();
  S.reports = reports;
  return reports;
}

// 週の後半:試合後の処理
export function postMatch() {
  const events = [];
  // 財政
  const fx = fixtureFor(S.week);
  const wages = S.squad.reduce((t, p) => t + p.wage, 0);
  const gate = fx && fx.isHome ? Math.round(60 + S.supporters * 0.9) : 0;
  const sponsor = 40;
  const interest = 45;
  const delta = gate + sponsor - wages - interest;
  S.money.clean += delta;
  S.money.lastDelta = { gate, sponsor, wages, interest, delta };

  // 手駒の報酬(裏金)と忠誠
  for (const o of S.operatives) {
    if (!o.alive || o.defected) continue;
    if (S.money.black >= o.wage) { S.money.black -= o.wage; o.loyalty = clamp(o.loyalty + 0.5, 0, 100); }
    else { o.loyalty = clamp(o.loyalty - 12, 0, 100); events.push({ text: `${opName(o)}への報酬が払えなかった。忠誠が下がった。` }); }
    // 弱みによる揺れ
    if (o.weakness.key === 'drink') o.discretion = clamp(o.discretion - 1, 10, 100);
    if (o.weakness.key === 'debt') o.loyalty = clamp(o.loyalty - 1.5, 0, 100);
    // 寝返り
    const pros = S.pursuers.find((p) => p.kind === 'pros');
    const pressure = pros && pros.evidence >= 70 ? 2 : 1;
    if (o.loyalty < 30 && rand() < (30 - o.loyalty) * 0.015 * pressure) {
      o.defected = true;
      if (pros) pros.evidence = clamp(pros.evidence + 15, 0, 100);
      for (const t of S.traces) if (t.operativeId === o.id) t.found.pros = true;
      events.push({ text: `${opName(o)}が検察に出頭した。知っていることを話している。`, alert: true });
      addNews('クラブ関係者が検察に出頭との情報', 'pros');
    }
  }

  // 負傷の回復
  for (const p of S.squad) if (p.injured > 0) p.injured--;
  for (const c of S.clubs) for (const k of c.keys) { if (k.injured > 0) k.injured--; k.bribed = false; }
  for (const c of S.clubs) c.morale = (c.morale || 0) * 0.6;

  // 追及
  const pe = advancePursuit();
  for (const e of pe) events.push({ text: e.text, alert: e.lv >= 70 });

  // 終了条件
  if (S.phase !== 'trial') {
    if (checkOwnerSafety()) return events;
    if (checkBankrupt()) return events;
  }

  // 新聞
  S.paper = makePaper();

  // 次の週へ
  S.mods = newMods();
  S.week++;
  if (S.phase !== 'trial' && S.phase !== 'end') {
    if (!checkSeasonEnd()) S.phase = 'news';
  }
  save();
  return events;
}

function makePaper() {
  const lm = S.lastMatch;
  const opp = lm ? club(lm.opp) : null;
  let head = '', sub = '';
  if (lm) {
    const res = lm.myGoals > lm.oppGoals ? '勝利' : lm.myGoals < lm.oppGoals ? '敗戦' : '引き分け';
    head = `ヴェラルド ${lm.myGoals}–${lm.oppGoals} ${opp.short} ―― ${res}`;
    sub = `第${S.week}節。${opp.ja}戦。`;
  }
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  const items = S.news.filter((n) => n.week === S.week).slice(0, 4);
  return { week: S.week, head, sub, pos, items };
}
