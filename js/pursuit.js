// 追及者の毎週の動き、固有行動、裁判、終了条件
import { S, rand, rint, clamp, pick, club, myClub, sortedTable, addNews, opName } from './state.js';

// 今週、各追及者が拾う証拠量を計算して加算し、固有行動を処理する
export function advancePursuit() {
  const events = [];
  // 未発見の痕跡を分類ごとに集計
  const live = S.traces;
  for (const p of S.pursuers) {
    if (!p.alive) continue;
    if (p.quiet > 0 && p.quiet < 90) { p.quiet--; continue; }
    if (p.quiet >= 90) continue;
    let gain = 0;
    for (const t of live) {
      if (t.found[p.id]) continue;
      const w = (p.focus[t.kind] || 0.2);
      // 痕跡の大きさ × 関心 × 偶然
      if (rand() < 0.35 * w + 0.1) {
        const g = t.size * w * (0.8 + rand() * 0.6) * p.aggr;
        gain += g;
        t.found[p.id] = true;
      }
    }
    // ライバルは試合結果の不自然さからも拾う
    gain = Math.round(gain);
    if (gain > 0) {
      const before = p.evidence;
      p.evidence = clamp(p.evidence + gain, 0, 100);
      crossThreshold(p, before, p.evidence, events);
    }
  }
  return events;
}

function crossThreshold(p, before, after, events) {
  const act = (lv) => before < lv && after >= lv;
  if (act(40)) { events.push({ p, lv: 40, text: thresholdText(p, 40) }); addNews(thresholdNews(p, 40), p.kind); }
  if (act(70)) { events.push({ p, lv: 70, text: thresholdText(p, 70) }); addNews(thresholdNews(p, 70), p.kind); doAction70(p, events); }
  if (after >= 100) { events.push({ p, lv: 100, text: thresholdText(p, 100) }); doAction100(p, events); }
}

function thresholdText(p, lv) {
  const map = {
    press: { 40: `${p.name}がクラブ周辺の取材を始めた。`, 70: `${p.name}が特集記事を準備している。情報源はクラブ内部とみられる。`, 100: `${p.name}の記事が一面に載る。` },
    pros: { 40: `${p.name}がクラブの資金に関心を向けた。`, 70: `${p.name}が家宅捜索の令状を取ろうとしている。`, 100: `${p.name}が起訴に踏み切った。` },
    rival: { 40: `${p.name}がこちらの動きを嗅ぎつけた。`, 70: `${p.name}が協会に内々の申し立てをした。`, 100: `${p.name}が決定的な証拠を協会に提出した。` },
    ethics: { 40: `倫理委員会が複数の試合を調べ始めた。`, 70: `倫理委員会が聴聞を開く。勝ち点の剥奪があり得る。`, 100: `倫理委員会が処分を決定した。` },
  };
  return map[p.kind][lv];
}
function thresholdNews(p, lv) {
  const map = {
    press: { 40: `イル・ファーロ、二部クラブの資金の流れを追う`, 70: `アルシ記者、近く「衝撃の特集」を予告`, 100: `一面:US ヴェラルド、不正の構図` },
    pros: { 40: `検察、二部クラブへの内偵を拡大か`, 70: `捜査、クラブ本部に及ぶとの観測`, 100: `US ヴェラルド オーナーを起訴` },
    rival: { 40: `セッラーヴォ陣営、審判問題で不満`, 70: `リーグに不正の申し立て`, 100: `ライバルが「証拠」を協会へ` },
    ethics: { 40: `協会、複数試合の判定を検証`, 70: `倫理委員会が聴聞を設定`, 100: `協会、処分を発表へ` },
  };
  return map[p.kind][lv];
}

function doAction70(p, events) {
  if (p.kind === 'pros') { /* 家宅捜索:痕跡が一気に露見しやすくなる(aggr上げ) */ p.aggr += 0.3; }
  if (p.kind === 'rival') { /* 相手は次節で汚い手を使う */ S.mods.rivalRef = true; }
  if (p.kind === 'ethics') { /* 聴聞:勝ち点剥奪の予告 */ }
}

function doAction100(p, events) {
  if (p.kind === 'pros') { S.trial = makeTrial(); S.phase = 'trial'; }
  else if (p.kind === 'press') { S.supporters = clamp(S.supporters - 12, 0, 100); S.money.clean -= 150; p.evidence = 92; addNews(`スポンサーのヴェスカーラ港湾公社、契約見直しを示唆`, 'club'); events.push({ p, lv: 101, text: `記事が出た。支持とスポンサー料を失った。だが、記事だけでは終われない ―― 検察が動く燃料になる。` }); feed('pros', 15); }
  else if (p.kind === 'rival') { S.table[S.clubId].pen += 3; recomputePts(); p.evidence = 85; addNews(`協会、US ヴェラルドに勝ち点3の暫定減点`, 'ethics'); events.push({ p, lv: 101, text: `ライバルの証拠が通り、勝ち点3を失った。` }); feed('ethics', 20); }
  else if (p.kind === 'ethics') { S.table[S.clubId].pen += 6; recomputePts(); p.evidence = 80; addNews(`協会、US ヴェラルドに勝ち点6の減点を決定`, 'ethics'); events.push({ p, lv: 101, text: `倫理委員会が勝ち点6の減点を決めた。` }); }
}

function feed(kind, amount) { const t = S.pursuers.find((x) => x.kind === kind && x.alive); if (t) t.evidence = clamp(t.evidence + amount, 0, 100); }

export function recomputePts() {
  for (const id of Object.keys(S.table)) { const t = S.table[id]; t.pts = t.w * 3 + t.d - (t.pen || 0); }
}

// ---- 裁判(一発勝負) ----
export function makeTrial() {
  const pros = S.pursuers.find((p) => p.kind === 'pros');
  const witnesses = S.operatives.filter((o) => o.alive && !o.defected && S.traces.some((t) => t.operativeId === o.id));
  const defectors = S.operatives.filter((o) => o.defected && o.alive);
  const judicial = S.referees.filter((r) => r.alive && r.owned >= 3).length; // 司法への影響(簡易)
  return {
    evidence: pros ? pros.evidence : 60,
    witnesses: witnesses.map((o) => ({ id: o.id, name: opName(o), loyalty: o.loyalty })),
    defectors: defectors.map((o) => ({ id: o.id, name: opName(o) })),
    judicial,
    moveUsed: false,
    decided: false,
  };
}

export function trialGuiltChance(t) {
  let g = t.evidence;                      // 検察の証拠
  g += t.witnesses.reduce((s, w) => s + (w.loyalty < 50 ? 10 : 4), 0); // 証人
  g += t.defectors.length * 18;            // 寝返った者
  g -= t.judicial * 10;                    // 司法への影響
  g -= S.money.clean > 2000 ? 8 : 0;       // 弁護団
  return clamp(Math.round(g), 5, 97);
}

// 判決前の一手 → 結果の処理(kind: 'buyJudge'|'silence'|'flee'|'none', targetId)
export function applyTrialMove(kind, targetId) {
  const t = S.trial;
  const r = { text: '', ok: true };
  if (kind === 'buyJudge') {
    if (S.money.black < 300) { r.ok = false; r.text = '裏金が足りない。'; return r; }
    S.money.black -= 300; const ok = rand() < 0.6;
    if (ok) { t.judicial += 3; r.text = '判事に話がついた。心証はこちらに傾いた。'; }
    else { t.evidence = clamp(t.evidence + 10, 0, 100); r.text = '判事は金を拒んだ。買収の試みが心証を悪くした。'; }
  } else if (kind === 'silence') {
    const w = t.witnesses.find((x) => x.id === targetId) || t.defectors.find((x) => x.id === targetId);
    if (!w) { r.ok = false; r.text = '対象がいない。'; return r; }
    const ok = rand() < 0.65;
    if (ok) { t.witnesses = t.witnesses.filter((x) => x.id !== targetId); t.defectors = t.defectors.filter((x) => x.id !== targetId); const o = S.operatives.find((x) => x.id === targetId); if (o) { o.alive = false; o.defected = false; } r.text = `${w.name}は証言台に立たなかった。`; }
    else { t.evidence = clamp(t.evidence + 12, 0, 100); r.text = `${w.name}の口は封じられず、むしろ検察に保護された。`; }
  } else if (kind === 'flee') {
    r.text = '国外逃亡の手配をした。有罪でも拘束は免れる。';
    t.fled = true;
  }
  t.moveUsed = true;
  return r;
}

export function decideTrial() {
  const t = S.trial;
  const g = trialGuiltChance(t);
  const guilty = rand() * 100 < g;
  t.decided = true;
  t.guilty = guilty;
  if (!guilty) {
    const pros = S.pursuers.find((p) => p.kind === 'pros');
    if (pros) { pros.evidence = 20; pros.quiet = 3; }
    addNews('US ヴェラルド オーナー、無罪 ―― 検察の証拠を退ける', 'pros');
    S.phase = 'office';
    return { guilty: false, text: '無罪。検察の積み上げた証拠は崩れた。だが、これで消えたわけではない。' };
  }
  // 有罪
  if (t.fled) { S.ending = { kind: 'flee', title: '逃亡', text: '判決は有罪。だが、あなたはもういない。国境の向こうで、別の名前が新しいクラブを買おうとしている。' }; }
  else { S.ending = { kind: 'prison', title: '収監', text: '有罪。すべてが明るみに出た。クラブは管財人の手に渡り、あなたには長い刑期が言い渡された。ピッチの外で動かしてきた試合は、もう二度と見られない。' }; }
  S.phase = 'end';
  return { guilty: true, text: t.fled ? '有罪。しかし拘束は免れた。' : '有罪。長い刑期が言い渡された。' };
}

// ---- その他の終了条件 ----
export function checkOwnerSafety() {
  // 襲撃:ライバルや追及者の圧が高いと起きうる。警護で防ぐ
  const heat = S.pursuers.filter((p) => p.alive).reduce((s, p) => s + (p.evidence > 70 ? p.evidence : 0), 0) + S.stats.killed * 20;
  const rivalDirty = S.clubs.some((c) => c.dirty && c.id !== S.clubId);
  let risk = 0;
  if (heat > 120) risk += 0.08;
  if (S.stats.killed >= 2) risk += 0.06;
  if (rivalDirty && S.mods.rivalRef) risk += 0.05;
  if (S.mods.guard) risk *= 0.2;
  if (risk > 0 && rand() < risk) {
    if (S.mods.guard && rand() < 0.8) { addNews('オーナーの車を狙った何者か ―― 警護が阻止', 'misc'); return null; }
    S.owner.alive = false;
    S.ending = { kind: 'dead', title: '退場', text: '雨の夜、駐車場で。あなたが他人に命じてきたことが、今度はあなたに向けられた。クラブは残る。あなたは残らない。' };
    S.phase = 'end';
    return 'dead';
  }
  return null;
}

export function checkBankrupt() {
  const due = S.money;
  if (!due.duePaid && !due.deferred && S.week >= due.dueWeek) {
    if (S.money.clean >= due.dueAmount) { S.money.clean -= due.dueAmount; due.duePaid = true; addNews('US ヴェラルド、債務を返済', 'club'); }
    else { S.ending = { kind: 'bankrupt', title: '破産', text: '返済期限が来た。表の金庫は空だった。債権団はクラブを差し押さえ、あなたの名はリーグから消えた。' }; S.phase = 'end'; return true; }
  }
  if (S.money.clean < 0) { S.money.negWeeks++; if (S.money.negWeeks >= 3) { S.ending = { kind: 'bankrupt', title: '破産', text: '赤字が続き、選手の給料が止まった。クラブは管財人の手に渡った。' }; S.phase = 'end'; return true; } }
  else S.money.negWeeks = 0;
  return false;
}

export function checkSeasonEnd() {
  if (S.week > 14) {
    const tbl = sortedTable();
    const myPos = tbl.findIndex((r) => r.id === S.clubId) + 1;
    const promoted = myPos <= 2;
    S.ending = {
      kind: promoted ? 'promoted' : 'season',
      title: promoted ? '昇格' : 'シーズン終了',
      text: promoted
        ? `最終順位 ${myPos}位。US ヴェラルドは一部へ昇格する。来季、大陸の舞台が近づく ―― もっとも、あなたを追う者たちも一緒に昇格してくるが。`
        : `最終順位 ${myPos}位。昇格はならなかった。金庫にはまだ余裕がある。来季、やり方を変えるか、同じ道をもう一度行くか。`,
      pos: myPos,
    };
    S.phase = 'end';
    return true;
  }
  return false;
}
