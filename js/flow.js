// 週の進行、試合(決断つき)、試合後のまとめ、新聞、裁判、終幕。
import {
  S, save, club, myClub, fixtureFor, refFor, sortedTable, operative, opName, pursuer,
  fmtK, clamp, settings, clearSave, SEASON_WEEKS,
} from './state.js';
import { preMatch, postMatch } from './world.js';
import { buildMatch, applyDecision, finalizeMatch, plantedSummary } from './match.js';
import { drawCases, resolveCase } from './engine.js';
import { trialGuiltChance, applyTrialMove, decideTrial } from './pursuit.js';
import { renderDesk, renderFile, show, toast, $, $$, el, esc } from './ui.js';
import { sfx } from './sound.js';

// ===== 案件の選択(デスクから呼ばれる)=====
export function chooseCase(caseKey, choiceId) {
  const report = resolveCase(caseKey, choiceId);
  S._lastReports = S._lastReports || {};
  S._lastReports[caseKey] = report;
  sfx.stamp();
  save();
  renderDesk();
}

// ===== 週を進める =====
export function advanceWeek() {
  preMatch();
  const fx = fixtureFor(S.week);
  if (fx) startMatch();
  else { const ev = postMatch(); afterMatch(ev); }
}

// ===== 試合 =====
let M = null, mi = 0, mTimer = null;

function startMatch() {
  M = buildMatch();
  mi = 0; M.hsLive = 0; M.asLive = 0;
  S.phase = 'match'; save();
  const planted = plantedSummary();
  $('#match-root').innerHTML = `
    <div class="match">
      <div class="pitch-area">
        <div class="bug">
          <span class="lg">SEG-B</span>
          <span class="tm"><i style="background:${M.fx.isHome ? M.meColor : M.oppColor}"></i>${M.fx.isHome ? M.meName : M.oppName}</span>
          <span class="sc" id="m-score">0 – 0</span>
          <span class="tm">${M.fx.isHome ? M.oppName : M.meName}<i style="background:${M.fx.isHome ? M.oppColor : M.meColor}"></i></span>
          <span class="clk" id="m-clk">0'</span>
        </div>
        ${planted.length ? `<div class="planted">${planted.map((p) => `<span><b>${esc(p.t)}</b> ${esc(p.d)}</span>`).join('')}</div>` : '<div class="planted none">今日は、仕込みなし。正面から。</div>'}
        <div class="pitch">${pitchSvg()}</div>
        <div class="match-stats" id="m-stats"></div>
      </div>
      <aside class="feed">
        <div class="fh"><span>LIVE</span><span>実況 ・ R. カーニ</span></div>
        <div class="log" id="m-log"></div>
        <div class="foot" id="m-foot"><button id="m-skip">早送り</button></div>
      </aside>
    </div>`;
  renderMatchStats();
  show('match');
  $('#m-skip').onclick = () => { settings.speed = settings.speed >= 4 ? 1 : settings.speed * 2; $('#m-skip').textContent = settings.speed > 1 ? `早送り x${settings.speed}` : '早送り'; };
  stepMatch();
}

function stepMatch() {
  if (mi >= M.beats.length) return endMatch();
  const b = M.beats[mi++];
  if (b.minute) $('#m-clk').textContent = b.minute + "'";
  if (b.type === 'decision') { renderDecision(b); return; }
  if (b.type === 'goal') {
    if (b.side === 'me') { M.hsLive++; sfx.goal(); } else { M.asLive++; sfx.crowd(); }
    $('#m-score').textContent = `${M.hsLive} – ${M.asLive}`;
    renderMatchStats();
  }
  logLine(b); moveBall(b);
  mTimer = setTimeout(stepMatch, (b.type === 'goal' ? 1300 : 850) / settings.speed);
}

function logLine(b) {
  const log = $('#m-log');
  log.prepend(el('p', b.type === 'goal' ? 'goal' : (b.side === 'opp' ? 'dim' : ''), `<em>${b.minute}'</em><span>${esc(b.text || '')}</span>`));
}

function renderDecision(b) {
  clearTimeout(mTimer);
  const foot = $('#m-foot');
  const sc = `${M.hsLive}–${M.asLive}`;
  let q = '', opts = [];
  if (b.kind === 'half') {
    q = `ハーフタイム。スコアは ${sc}。ロッカールームで何を言う。`;
    opts = [['push', '前から行け', '後半、攻めに出る'], ['hold', 'このまま締めろ', '手堅く'], ['time', '時間を使え', '相手を苛立たせる']];
  } else if (b.kind === 'late') {
    q = `82分、${sc}。ベンチが指示を仰いでいる。`;
    opts = [['allout', '全員上がれ', '一点を取りに行く'], ['lock', '鍵をかけろ', '守り切る']];
  } else if (b.kind === 'ref') {
    q = `買収した主審 ${esc(b.refBy || '')} が、こちらのベンチを見ている。笛をくわえたまま、合図を待っている。`;
    opts = [['pk', 'PKを取らせる', '痕跡 +8'], ['send', '相手を退場に', '痕跡 +19'], ['none', '見送る', '痕跡なし']];
  }
  const useTimer = settings.timer && b.kind === 'ref';
  foot.innerHTML = `<div class="cut" style="flex:1">
    <div class="q"><span>${b.kind === 'ref' ? '介入 ・ 買収済み' : '采配'}</span>${q}</div>
    ${useTimer ? '<div class="timer"><i id="cut-timer"></i></div>' : ''}
    ${opts.map(([v, l, d], i) => `<button class="choice" data-c="${v}"><kbd>${i + 1}</kbd><span>${esc(l)}</span><span class="cost">${esc(d)}</span></button>`).join('')}
  </div>`;
  const pickOne = (c) => {
    if (foot._to) { clearTimeout(foot._to); foot._to = null; }
    if (foot._kh) { document.removeEventListener('keydown', foot._kh); foot._kh = null; }
    resumeDecision(b.kind, c);
  };
  foot.querySelectorAll('.choice').forEach((btn) => btn.onclick = () => { sfx.click(); pickOne(btn.dataset.c); });
  const kh = (e) => { const i = parseInt(e.key, 10) - 1; if (i >= 0 && i < opts.length) { e.preventDefault(); pickOne(opts[i][0]); } };
  foot._kh = kh; document.addEventListener('keydown', kh);
  if (useTimer) { const t = $('#cut-timer'); if (t) { t.style.transition = 'transform 12s linear'; requestAnimationFrame(() => t.style.transform = 'scaleX(0)'); } foot._to = setTimeout(() => pickOne('none'), 12000); }
}

function resumeDecision(kind, choice) {
  const res = applyDecision(kind, choice, M);
  if (res.edgeDelta) { // 残りの局面を再抽選して流れを反映
    M.edge += res.edgeDelta;
    rerollRemaining();
  }
  if (res.trace) S.traces.push({ id: 'tri' + S.traces.length + '_' + mi, op: 'match', opName: '試合介入', operativeId: null, operativeName: '―', kind: 'match', size: res.trace, week: S.week, found: {} });
  if (res.forceGoal) { M.hsLive++; sfx.whistle(); sfx.goal(); $('#m-score').textContent = `${M.hsLive} – ${M.asLive}`; renderMatchStats(); }
  else if (kind === 'ref' && choice === 'send') sfx.whistle();
  const min = M.beats[mi - 1] ? M.beats[mi - 1].minute : '';
  logLine({ minute: min, text: res.text, type: res.forceGoal ? 'goal' : 'play', side: 'me' });
  const foot = $('#m-foot');
  foot.innerHTML = '<button id="m-skip">早送り</button>';
  $('#m-skip').onclick = () => { settings.speed = settings.speed >= 4 ? 1 : settings.speed * 2; };
  setTimeout(stepMatch, 600);
}

function rerollRemaining() {
  // 残りの play/goal 局面だけ、新しい edge で引き直す(decision/intervention は保持)
  for (let i = mi; i < M.beats.length; i++) {
    const b = M.beats[i];
    if (b.type === 'decision') continue;
    const pMy = clamp(0.5 + M.edge / 120, 0.12, 0.88);
    const roll = Math.random();
    if (roll < pMy * 0.17) { b.type = 'goal'; b.side = 'me'; b.text = '攻撃が実る。ゴール。'; }
    else if (roll > 1 - (1 - pMy) * 0.15) { b.type = 'goal'; b.side = 'opp'; b.text = `失点。${M.oppName}に決められた。`; }
    else { b.type = 'play'; b.side = roll < pMy ? 'me' : 'opp'; }
  }
}

function renderMatchStats() {
  const poss = Math.round(clamp(50 + M.edge * 0.8, 25, 75));
  $('#m-stats').innerHTML = `
    <div><span>支配率</span><b>${poss}–${100 - poss}</b></div>
    <div><span>シュート</span><b>${M.hsLive + 4}–${M.asLive + 3}</b></div>
    <div><span>枠内</span><b>${M.hsLive + 1}–${M.asLive + 1}</b></div>
    <div><span>警告</span><b>${(mi % 3)}–${((mi + 1) % 3)}</b></div>`;
}

function endMatch() {
  clearTimeout(mTimer);
  finalizeMatch(M.fx, M.hsLive, M.asLive);
  const res = M.hsLive > M.asLive ? '勝利' : M.hsLive < M.asLive ? '敗戦' : '引き分け';
  $('#m-foot').innerHTML = `<button id="m-done" style="background:var(--vermil);color:#fff">試合終了 ・ ${res} ・ 次へ</button>`;
  $('#m-done').onclick = () => { const ev = postMatch(); afterMatch(ev); };
}

function moveBall(b) { const ball = $('#m-ball'); if (!ball) return; ball.setAttribute('cx', b.side === 'me' ? 70 + Math.random() * 25 : 10 + Math.random() * 25); ball.setAttribute('cy', 15 + Math.random() * 38); }
function pitchSvg() {
  return `<svg viewBox="0 0 105 68" preserveAspectRatio="xMidYMid meet">
    <g fill="none" stroke="rgba(236,234,228,.22)" stroke-width=".3">
      <rect x="1" y="1" width="103" height="66"/><line x1="52.5" y1="1" x2="52.5" y2="67"/><circle cx="52.5" cy="34" r="9.15"/>
      <rect x="1" y="13.85" width="16.5" height="40.3"/><rect x="87.5" y="13.85" width="16.5" height="40.3"/>
      <rect x="1" y="24.85" width="5.5" height="18.3"/><rect x="98.5" y="24.85" width="5.5" height="18.3"/></g>
    <circle id="m-ball" class="ball" cx="52.5" cy="34" r="1.5" fill="#ECEAE4"/></svg>`;
}

// ===== 試合後のまとめ → 新聞 =====
function afterMatch(events) {
  if (S.phase === 'end') { renderEnd(); return; }
  if (S.phase === 'trial') { renderTrial(); return; }
  const after = S.aftermath || [];
  const evs = (events || []).filter((e) => e.text);
  let html = '<h3>今週のまとめ</h3>';
  if (after.length) html += '<div class="after">' + after.map((a) => `<div class="after-row"><span class="ah">${esc(a.head)}</span><span class="at">${esc(a.text)}</span></div>`).join('') + '</div>';
  if (evs.length) html += '<div class="after evs">' + evs.map((e) => `<div class="after-row ${e.alert ? 'alert' : ''}"><span class="ah">${e.alert ? '警告' : '動き'}</span><span class="at">${esc(e.text)}</span></div>`).join('') + '</div>';
  html += '<div class="mfoot"><button class="primary" id="after-ok">新聞を読む</button></div>';
  openModal(html, true);
  $('#after-ok').onclick = () => { closeModal(); renderNews(); };
}

function renderNews() {
  const p = S.paper;
  if (!p) { startNextWeek(); return; }
  const items = p.items.map((n) => `<div class="item"><h4>${headlineFor(n.kind)}</h4>${esc(n.text)}。</div>`).join('');
  $('#news-root').innerHTML = `
    <div class="press">
      <div class="nameplate">IL FARO</div>
      <div class="dateline"><span>日刊イル・ファーロ</span><span>第${p.week - 1}節 翌朝</span><span>ヴェスカーラ共和国</span></div>
      <div class="lead">${esc(p.head || 'リーグ、第' + (p.week - 1) + '節を終える')}</div>
      <div class="sub">${esc(p.sub || '')} US ヴェラルドは暫定${p.pos}位。</div>
      <div class="cols2">${items || '<div class="item">特記事項なし。</div>'}</div>
      <div class="foot"><button id="news-next">次の週へ</button></div>
    </div>`;
  show('news');
  $('#news-next').onclick = () => { sfx.click(); startNextWeek(); };
}
function headlineFor(kind) { return { club: 'クラブ', pros: '司法', press: '報道', ethics: '協会', rival: 'リーグ', misc: '雑報' }[kind] || '雑報'; }

function startNextWeek() {
  if (S.phase === 'end') { renderEnd(); return; }
  if (S.phase === 'trial') { renderTrial(); return; }
  S.phase = 'office';
  S._lastReports = {};
  drawCases();
  save();
  renderDesk();
}

// ===== 裁判 =====
export function renderTrial() {
  const t = S.trial;
  const g = trialGuiltChance(t);
  const witnesses = t.witnesses.concat(t.defectors.map((d) => ({ ...d, defector: true })));
  const wHtml = witnesses.length ? witnesses.map((w) => `<div class="r"><span>${esc(w.name)}${w.defector ? '(寝返り)' : ''}</span><span>${w.defector ? '検察側' : '証言しうる'}</span></div>`).join('') : '<div class="r"><span>生きている証人</span><span>なし</span></div>';
  let moves = '';
  if (!t.moveUsed) {
    moves = `<div class="moves">
      <button class="choice" data-m="buyJudge"><kbd>1</kbd><span>判事を買収する</span><span class="cost">${fmtK(300)} 裏</span></button>
      ${witnesses.length ? `<button class="choice" data-m="silence"><kbd>2</kbd><span>証人を一人、消す</span><span class="cost">成算 65%</span></button>` : ''}
      <button class="choice" data-m="flee"><kbd>3</kbd><span>国外逃亡の手配</span><span class="cost">拘束を免れる</span></button>
      <button class="choice" data-m="none"><kbd>0</kbd><span>判決を待つ</span><span class="cost">―</span></button></div>`;
  }
  openModal(`<h3>公判</h3><div class="lead">検察は起訴に踏み切った。判決の前に、打てる手は一つだけ。</div>
    <div class="gmeter"><div class="lbl"><span>有罪になる見込み</span><span>${g}%</span></div><div class="track"><i style="width:${g}%"></i></div></div>
    <div class="factors"><div class="r"><span>検察の証拠</span><span>${Math.round(t.evidence)}</span></div>${wHtml}<div class="r"><span>司法への影響</span><span>${t.judicial ? '+' + t.judicial : 'なし'}</span></div></div>
    ${moves}${t.moveUsed ? '<div class="mfoot"><button class="primary" id="trial-decide">判決</button></div>' : ''}`, false, true);
  $$('.choice[data-m]').forEach((b) => b.onclick = () => { const m = b.dataset.m; if (m === 'silence') { openSilencePick(); return; } const r = applyTrialMove(m, null); sfx.click(); toast(r.text); setTimeout(renderTrial, 400); });
  const dec = $('#trial-decide'); if (dec) dec.onclick = runVerdict;
}
function openSilencePick() {
  const all = S.trial.witnesses.concat(S.trial.defectors);
  openModal(`<h3>証人を選ぶ</h3><div class="lead">公判までに一人だけ。成算65%。失敗すれば検察に保護される。</div><div class="sheet">${all.map((w) => `<button class="opt-row" data-w="${w.id}"><span class="r-n">${esc(w.name)}</span></button>`).join('')}<div class="mfoot"><button id="sp-cancel">戻る</button></div></div>`, false, true);
  $$('.opt-row[data-w]').forEach((b) => b.onclick = () => { const r = applyTrialMove('silence', b.dataset.w); sfx.click(); toast(r.text); setTimeout(renderTrial, 400); });
  $('#sp-cancel').onclick = renderTrial;
}
function runVerdict() {
  const r = decideTrial();
  openModal(`<h3>判決</h3><div class="verdict ${r.guilty ? 'g' : 'ng'}">${r.guilty ? '有 罪' : '無 罪'}</div><div class="lead" style="text-align:center">${esc(r.text)}</div><div class="mfoot"><button class="primary" id="v-ok">${r.guilty ? '終幕へ' : '続ける'}</button></div>`, false, true);
  sfx.stamp();
  $('#v-ok').onclick = () => { closeModal(); if (S.phase === 'end') renderEnd(); else { save(); renderNews(); } };
}

// ===== 終幕 =====
export function renderEnd() {
  const e = S.ending || { title: '終幕', text: '' };
  const win = e.kind === 'promoted';
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  $('#end-root').innerHTML = `
    <div class="big ${win ? 'win' : ''}">${esc(e.title)}</div>
    <div class="etext">${esc(e.text)}</div>
    <div class="estat">最終順位 ${pos}位 ・ 勝ち点 ${S.table[S.clubId].pts}<br>処理した案件 ${S.stats.cases}件 ・ 消した相手 ${S.stats.killed}人 ・ 買収した審判 ${S.stats.bribes}回<br>残った痕跡 ${S.traces.length}件</div>
    <button class="ebtn" id="end-restart">もう一度</button>`;
  show('end');
  clearSave();
  $('#end-restart').onclick = () => location.reload();
}

// ===== モーダル =====
let modalKh = null;
export function openModal(html, dark, noClose) {
  closeModal();
  const scrim = el('div', 'scrim'); scrim.id = 'scrim';
  const modal = el('div', 'modal' + (dark ? ' dark' : ''), html);
  scrim.appendChild(modal); document.body.appendChild(scrim);
  if (!noClose) scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  modalKh = (e) => { const map = { '1': 0, '2': 1, '3': 2, '0': 3 }; if (e.key in map) { const cs = modal.querySelectorAll('.choice'); if (cs[map[e.key]]) { e.preventDefault(); cs[map[e.key]].click(); } } };
  document.addEventListener('keydown', modalKh);
}
export function closeModal() { const s = $('#scrim'); if (s) s.remove(); if (modalKh) { document.removeEventListener('keydown', modalKh); modalKh = null; } }
