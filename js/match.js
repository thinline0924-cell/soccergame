// 試合シミュレーション:局面ごとの判定、実況文、介入
import { S, rand, rint, pick, clamp, club, myClub, fixtureFor, refFor } from './state.js';

// 先発11人の総合力(全権モードでない場合は上位11人)
export function teamStrength(cid) {
  if (cid === S.clubId) {
    const avail = S.squad.filter((p) => !p.injured).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
    let s = avail.reduce((t, p) => t + p.ovr, 0) / Math.max(avail.length, 1);
    const tac = { balanced: 0, attack: 1, defend: 1, counter: 1 }[S.tactic] || 0;
    s += S.morale * 0.08;
    return { att: s, def: s, base: s, players: avail };
  }
  const c = club(cid);
  let s = c.str;
  // 主力の欠場・買収で下がる
  for (const k of c.keys) { if (!k.alive) s -= 5; else if (k.injured) s -= 6; else if (k.bribed) s -= 4; }
  s += (c.morale || 0) * 0.08;
  return { att: s, def: s, base: s, players: [] };
}

// 試合の台本を生成(局面の配列)。介入ポイントも埋め込む。
export function buildMatch() {
  const fx = fixtureFor(S.week);
  const me = teamStrength(S.clubId);
  const opp = teamStrength(fx.opp);
  const m = S.mods;
  let myEdge = me.base - opp.base;
  if (m.oppWeak) myEdge += m.oppWeak;
  if (m.fixed) myEdge += 30;
  // ライバルが相手で、かつ汚い手を使う側なら相手に下駄
  if (club(fx.opp).dirty && m.rivalRef) myEdge -= 8;

  const tac = S.tactic;
  const n = rint(11, 14);
  const beats = [];
  let hs = 0, as = 0;
  const homeAdj = fx.isHome ? 3 : -3;
  myEdge += homeAdj;

  // 介入はこちら寄りの局面1〜2回。買収済みの審判がいればPK系の介入を用意
  const refReady = m.refCalls > 0;
  let interventionAt = refReady ? rint(5, n - 2) : -1;

  for (let i = 0; i < n; i++) {
    const minute = Math.round((i + 1) / (n + 1) * 90) + rint(-2, 2);
    const pMy = clamp(0.5 + myEdge / 120, 0.12, 0.88);
    const roll = rand();
    let beat;
    if (i === interventionAt && refReady) {
      beat = { type: 'intervention', minute: clamp(minute, 1, 92), refBy: m.refBy };
    } else if (roll < pMy * 0.18) {
      hs++; beat = { type: 'goal', side: 'me', minute: clamp(minute, 1, 92), text: goalText('me', fx) };
    } else if (roll > 1 - (1 - pMy) * 0.16) {
      as++; beat = { type: 'goal', side: 'opp', minute: clamp(minute, 1, 92), text: goalText('opp', fx) };
    } else {
      beat = { type: 'play', side: roll < pMy ? 'me' : 'opp', minute: clamp(minute, 1, 92), text: playText(roll < pMy ? 'me' : 'opp', fx) };
    }
    beats.push(beat);
  }
  return { fx, beats, meName: myClub().short, oppName: club(fx.opp).short, meColor: myClub().color, oppColor: club(fx.opp).color, hs, as, me, opp };
}

// 介入の選択を反映:PK(得点の可能性)、退場(相手がさらに弱る)、見送り
export function applyIntervention(choice, matchState) {
  const m = S.mods;
  m.refCalls = Math.max(0, m.refCalls - 1);
  if (choice === 'pk') { return { goal: true, trace: 8, text: `主審${m.refBy}が笛を吹いた。ペナルティスポットを指している。` }; }
  if (choice === 'send') { matchState.oppPenalty = (matchState.oppPenalty || 0) + 14; return { goal: false, trace: 19, text: `主審が相手に二枚目の警告 ―― 退場。相手は10人になった。` }; }
  return { goal: false, trace: 0, text: `合図は送らなかった。謝礼は無駄になったが、痕跡も残らない。` };
}

const ATT = { me: ['ペトローネ', 'イラーリ', 'バルディ', 'ヴァレーリ'], };
function goalText(side, fx) {
  if (side === 'me') return pick([
    `ゴール。ペトローネのミドルが左隅へ突き刺さる。`,
    `ゴール。こぼれ球をバルディが押し込んだ。`,
    `ゴール。ヴァレーリのクロスにイラーリが頭で合わせた。`,
  ]);
  const o = club(fx.opp).short;
  return pick([
    `失点。${o}のカウンターを止めきれなかった。`,
    `失点。セットプレーから中央を割られた。`,
    `失点。こぼれ球に詰められ、GKチェルヴィも届かない。`,
  ]);
}
function playText(side, fx) {
  if (side === 'me') return pick([
    `ペトローネが抜け出すが、角度がない。`,
    `左サイドを押し込む。相手DFが辛うじてかき出した。`,
    `中盤でボールを回し、相手を走らせる。`,
    `バルディのシュートは枠の上。`,
  ]);
  const o = club(fx.opp).short;
  return pick([
    `${o}が左右に揺さぶってくる。`,
    `${o}のシュート、チェルヴィが正面でつかむ。`,
    `${o}のコーナー。はね返す。`,
    `${o}に押し込まれる時間が続く。`,
  ]);
}

// 最終スコアを確定(介入の加点を含む)し、順位表に反映
export function finalizeMatch(fx, hs, as) {
  const me = S.table[S.clubId], op = S.table[fx.opp];
  const myGoals = fx.isHome ? hs : hs; // hs は常にこちらの得点として扱う
  const oppGoals = as;
  me.p++; op.p++;
  me.gf += myGoals; me.ga += oppGoals;
  op.gf += oppGoals; op.ga += myGoals;
  if (myGoals > oppGoals) { me.w++; op.l++; S.morale = clamp(S.morale + 4, -30, 30); S.supporters = clamp(S.supporters + 2, 0, 100); }
  else if (myGoals < oppGoals) { me.l++; op.w++; S.morale = clamp(S.morale - 4, -30, 30); S.supporters = clamp(S.supporters - 2, 0, 100); }
  else { me.d++; op.d++; }
  me.pts = me.w * 3 + me.d - (me.pen || 0);
  op.pts = op.w * 3 + op.d - (op.pen || 0);
  // 賭けの払い戻し
  if (S.mods.bet && myGoals > oppGoals) { const win = Math.round(S.mods.bet * 1.85); S.money.black += win; }
  S.results.push({ week: S.week, home: fx.home, away: fx.away, hs: fx.isHome ? myGoals : oppGoals, as: fx.isHome ? oppGoals : myGoals });
  S.lastMatch = { opp: fx.opp, myGoals, oppGoals, isHome: fx.isHome };
  // 他会場の試合も処理
  simOtherMatches();
}

function simOtherMatches() {
  const fxs = S.fixtures[S.week - 1] || [];
  for (const [h, a] of fxs) {
    if (h === S.clubId || a === S.clubId) continue;
    const hs = teamStrength(h).base, as = teamStrength(a).base;
    const edge = hs - as + 3;
    const hg = Math.max(0, Math.round((rand() * 2.4) + edge / 40));
    const ag = Math.max(0, Math.round((rand() * 2.2) - edge / 40));
    const th = S.table[h], ta = S.table[a];
    th.p++; ta.p++; th.gf += hg; th.ga += ag; ta.gf += ag; ta.ga += hg;
    if (hg > ag) { th.w++; ta.l++; } else if (hg < ag) { th.l++; ta.w++; } else { th.d++; ta.d++; }
    th.pts = th.w * 3 + th.d - (th.pen || 0);
    ta.pts = ta.w * 3 + ta.d - (ta.pen || 0);
    S.results.push({ week: S.week, home: h, away: a, hs: hg, as: ag });
  }
}
