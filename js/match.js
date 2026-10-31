// 試合シミュレーション:局面ごとの判定、実況文、仕込みの可視化、2〜3回の決断
import { S, rand, rint, pick, clamp, club, myClub, fixtureFor, refFor } from './state.js';

export function teamStrength(cid) {
  if (cid === S.clubId) {
    const avail = S.squad.filter((p) => !p.injured).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
    let s = avail.reduce((t, p) => t + p.ovr, 0) / Math.max(avail.length, 1);
    s += S.morale * 0.08;
    return { att: s, def: s, base: s, players: avail };
  }
  const c = club(cid);
  let s = c.str;
  for (const k of c.keys) { if (!k.alive) s -= 5; else if (k.injured) s -= 6; else if (k.bribed) s -= 4; }
  s += (c.morale || 0) * 0.08;
  return { att: s, def: s, base: s, players: [] };
}

// 仕込みの要約(試合開始時に見せる)
export function plantedSummary() {
  const m = S.mods, out = [];
  if (m.fixed) out.push({ t: '談合済み', d: '相手と話がついている。勝ちはほぼ確定。' });
  if (m.refCalls > 0) out.push({ t: `主審 ${m.refBy || ''} 買収済み`, d: '試合中、際どい判定を一度こちらへ取れる。' });
  if (m.oppWeak > 0) out.push({ t: '相手の主力が鈍い', d: `買収または負傷で相手の力が落ちている(−${Math.round(m.oppWeak)})。` });
  if (m.bet > 0) out.push({ t: `勝ちに ${fmtK(m.bet)} 賭けている`, d: '勝てば配当が裏金に入る。' });
  return out;
}

export function buildMatch() {
  const fx = fixtureFor(S.week);
  const me = teamStrength(S.clubId);
  const opp = teamStrength(fx.opp);
  const m = S.mods;
  let myEdge = me.base - opp.base;
  if (m.oppWeak) myEdge += m.oppWeak;
  if (m.fixed) myEdge += 30;
  if (club(fx.opp).dirty && m.rivalRef) myEdge -= 8;
  myEdge += fx.isHome ? 3 : -3;

  const n = rint(11, 13);
  const beats = [];
  let hs = 0, as = 0;
  const halfAt = Math.floor(n / 2);
  let interventionPlaced = false;

  for (let i = 0; i < n; i++) {
    const minute = Math.round((i + 1) / (n + 1) * 90) + rint(-2, 2);
    const pMy = clamp(0.5 + myEdge / 120, 0.12, 0.88);

    // ハーフタイムの決断
    if (i === halfAt) { beats.push({ type: 'decision', kind: 'half', minute: 45, state: { hs, as } }); }

    // 買収した審判の介入(前半後半どちらか一度)
    if (m.refCalls > 0 && !interventionPlaced && i > halfAt && rand() < 0.6) {
      beats.push({ type: 'decision', kind: 'ref', minute: clamp(minute, 1, 92), refBy: m.refBy });
      interventionPlaced = true;
    }

    const roll = rand();
    if (roll < pMy * 0.17) { hs++; beats.push({ type: 'goal', side: 'me', minute: clamp(minute, 1, 92), text: goalText('me', fx), state: { hs, as } }); }
    else if (roll > 1 - (1 - pMy) * 0.15) { as++; beats.push({ type: 'goal', side: 'opp', minute: clamp(minute, 1, 92), text: goalText('opp', fx), state: { hs, as } }); }
    else beats.push({ type: 'play', side: roll < pMy ? 'me' : 'opp', minute: clamp(minute, 1, 92), text: playText(roll < pMy ? 'me' : 'opp', fx) });
  }
  // 終盤、僅差なら遅い介入が無ければ終盤の決断を足す
  if (!interventionPlaced && Math.abs(hs - as) <= 1) {
    beats.splice(beats.length - 1, 0, { type: 'decision', kind: 'late', minute: 82, state: { hs, as } });
  }
  return { fx, beats, meName: myClub().short, oppName: club(fx.opp).short, meColor: myClub().color, oppColor: club(fx.opp).color, hs, as, me, opp, edge: myEdge };
}

// 決断の効果(その後の局面に効く)。matchState を書き換える。
export function applyDecision(kind, choice, M) {
  const res = { text: '', edgeDelta: 0, forceGoal: false, trace: 0 };
  if (kind === 'half') {
    if (choice === 'push') { res.edgeDelta = 8; res.text = 'ロッカールームで発破をかけた。後半は前から行く。'; }
    else if (choice === 'hold') { res.edgeDelta = -4; res.text = '「このまま締めろ」。無理はしない。'; }
    else if (choice === 'time') { res.edgeDelta = -2; res.text = '時間を使え、と指示。相手を苛立たせる。'; }
  } else if (kind === 'late') {
    if (choice === 'allout') { res.edgeDelta = 12; res.text = 'FWを投入。全員が前へ。リスクは承知だ。'; }
    else if (choice === 'lock') { res.edgeDelta = -6; res.text = 'DFを足して鍵をかける。守り切る。'; }
  } else if (kind === 'ref') {
    if (choice === 'pk') { res.forceGoal = true; res.trace = 8; res.text = `主審${M ? '' : ''}が笛を吹いた。ペナルティ。決めれば1点。`; }
    else if (choice === 'send') { res.edgeDelta = 14; res.trace = 19; res.text = '主審が相手に二枚目の警告 ―― 退場。相手は10人だ。'; }
    else { res.text = '合図は送らなかった。痕跡は残らない。'; }
  }
  return res;
}

const goalBank = {
  me: ['ゴール。ペトローネのミドルが左隅へ突き刺さる。', 'ゴール。こぼれ球をバルディが押し込んだ。', 'ゴール。ヴァレーリのクロスにイラーリが頭で合わせた。'],
};
function goalText(side, fx) {
  if (side === 'me') return pick(goalBank.me);
  const o = club(fx.opp).short;
  return pick([`失点。${o}のカウンターを止めきれなかった。`, `失点。セットプレーから中央を割られた。`, `失点。こぼれ球に詰められた。`]);
}
function playText(side, fx) {
  if (side === 'me') return pick(['ペトローネが抜け出すが角度がない。', '左サイドを押し込む。相手DFがかき出した。', '中盤で回し、相手を走らせる。', 'バルディのシュートは枠の上。']);
  const o = club(fx.opp).short;
  return pick([`${o}が左右に揺さぶる。`, `${o}のシュート、チェルヴィが正面でつかむ。`, `${o}のコーナー。はね返す。`, `${o}に押し込まれる。`]);
}

export function finalizeMatch(fx, hs, as) {
  const me = S.table[S.clubId], op = S.table[fx.opp];
  const myGoals = hs, oppGoals = as;
  me.p++; op.p++;
  me.gf += myGoals; me.ga += oppGoals; op.gf += oppGoals; op.ga += myGoals;
  if (myGoals > oppGoals) { me.w++; op.l++; S.morale = clamp(S.morale + 4, -30, 30); S.supporters = clamp(S.supporters + 3, 0, 100); }
  else if (myGoals < oppGoals) { me.l++; op.w++; S.morale = clamp(S.morale - 4, -30, 30); S.supporters = clamp(S.supporters - 3, 0, 100); }
  else { me.d++; op.d++; }
  me.pts = me.w * 3 + me.d - (me.pen || 0);
  op.pts = op.w * 3 + op.d - (op.pen || 0);
  if (S.mods.bet && myGoals > oppGoals) { S.money.black += Math.round(S.mods.bet * 1.85); }
  S.results.push({ week: S.week, home: fx.home, away: fx.away, hs: fx.isHome ? myGoals : oppGoals, as: fx.isHome ? oppGoals : myGoals });
  S.lastMatch = { opp: fx.opp, myGoals, oppGoals, isHome: fx.isHome, planted: plantedSummary() };
  simOtherMatches();
}

function simOtherMatches() {
  const fxs = S.fixtures[S.week - 1] || [];
  for (const [h, a] of fxs) {
    if (h === S.clubId || a === S.clubId) continue;
    const edge = teamStrength(h).base - teamStrength(a).base + 3;
    const hg = Math.max(0, Math.round((rand() * 2.4) + edge / 40));
    const ag = Math.max(0, Math.round((rand() * 2.2) - edge / 40));
    const th = S.table[h], ta = S.table[a];
    th.p++; ta.p++; th.gf += hg; th.ga += ag; ta.gf += ag; ta.ga += hg;
    if (hg > ag) { th.w++; ta.l++; } else if (hg < ag) { th.l++; ta.w++; } else { th.d++; ta.d++; }
    th.pts = th.w * 3 + th.d - (th.pen || 0); ta.pts = ta.w * 3 + ta.d - (ta.pen || 0);
    S.results.push({ week: S.week, home: h, away: a, hs: hg, as: ag });
  }
}

const fmtK = (k) => '€' + (k >= 1000 ? (k / 1000).toFixed(2) + 'M' : Math.round(k) + 'k');
