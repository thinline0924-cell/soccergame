// 試合進行、工作の発注シート、報告、新聞、裁判、終幕。画面間の遷移。
import { OPS, ROLES } from './data.js';
import {
  S, save, club, myClub, fixtureFor, refFor, sortedTable, personByKey, operative, opName, pursuer,
  fmtK, clamp, settings, saveSettings, clearSave, SEASON_WEEKS,
} from './state.js';
import { targetsFor, successChance, traceChance, orderOp, opAllowed } from './ops.js';
import { preMatch, postMatch } from './world.js';
import { buildMatch, applyIntervention, finalizeMatch } from './match.js';
import { trialGuiltChance, applyTrialMove, decideTrial } from './pursuit.js';
import { renderOffice, renderFile, renderTopbar, show, toast, $, $$, el, esc } from './ui.js';
import { sfx } from './sound.js';

const SEASON_WEEKS_ = SEASON_WEEKS;

// ===================== 週を進める =====================
export function advanceWeek() {
  // 進行中/即時の工作を解決
  const reports = preMatch();
  if (reports.length) { showReports(reports, () => afterReports()); }
  else afterReports();
}

function afterReports() {
  const fx = fixtureFor(S.week);
  if (fx) startMatch();
  else { const ev = postMatch(); continueAfterMatch(ev); }
}

// ===================== 試合 =====================
let M = null, mi = 0, mTimer = null, mPaused = false;

function startMatch() {
  M = buildMatch();
  mi = 0; M.hsLive = 0; M.asLive = 0;
  S.phase = 'match'; save();
  const me = M.fx.isHome ? M.meName : M.oppName;
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
        <div class="pitch">${pitchSvg()}</div>
        <div class="match-stats" id="m-stats"></div>
      </div>
      <aside class="feed">
        <div class="fh"><span>LIVE</span><span>実況 ・ R. カーニ</span></div>
        <div class="log" id="m-log"></div>
        <div class="foot" id="m-foot">
          <button id="m-skip">早送り</button>
        </div>
      </aside>
    </div>`;
  renderMatchStats();
  show('match');
  $('#m-skip').onclick = () => { settings.speed = settings.speed >= 4 ? 1 : settings.speed * 2; $('#m-skip').textContent = settings.speed > 1 ? `早送り x${settings.speed}` : '早送り'; };
  mPaused = false;
  stepMatch();
}

function stepMatch() {
  if (mPaused) return;
  if (mi >= M.beats.length) return endMatch();
  const b = M.beats[mi++];
  $('#m-clk').textContent = b.minute + "'";
  if (b.type === 'intervention') { mPaused = true; renderIntervention(b); return; }
  if (b.type === 'goal') {
    if (b.side === 'me') { M.hsLive++; sfx.goal(); } else { M.asLive++; sfx.crowd(); }
    $('#m-score').textContent = `${M.hsLive} – ${M.asLive}`;
  }
  logLine(b);
  moveBall(b);
  const base = b.type === 'goal' ? 1400 : 900;
  mTimer = setTimeout(stepMatch, base / settings.speed);
}

function logLine(b) {
  const log = $('#m-log');
  const p = el('p', b.type === 'goal' ? 'goal' : (b.side === 'opp' ? 'dim' : ''),
    `<em>${b.minute}'</em><span>${esc(b.text || '')}</span>`);
  log.prepend(p);
}

function renderIntervention(b) {
  clearTimeout(mTimer);
  const foot = $('#m-foot');
  const useTimer = settings.timer;
  foot.innerHTML = `
    <div class="cut" style="flex:1">
      <div class="q"><span>介入 ・ 買収済みの主審 ${esc(b.refBy || '')}</span>主審がこちらのベンチを見ている。笛をくわえたまま、合図を待っている。</div>
      ${useTimer ? '<div class="timer"><i id="cut-timer"></i></div>' : ''}
      <button class="choice" data-c="pk"><kbd>1</kbd><span>PKの判定を取らせる</span><span class="cost">痕跡 +8</span></button>
      <button class="choice" data-c="send"><kbd>2</kbd><span>相手DFに退場も出させる</span><span class="cost">痕跡 +19</span></button>
      <button class="choice" data-c="none"><kbd>3</kbd><span>見送る</span><span class="cost">痕跡 なし</span></button>
    </div>`;
  const pick = (c) => { foot.innerHTML = '<button id="m-skip2">続ける</button>'; $('#m-skip2').onclick = () => { mPaused = false; resumeIntervention(c); }; mPaused = false; resumeIntervention(c); };
  foot.querySelectorAll('.choice').forEach((btn) => btn.onclick = () => { sfx.click(); pick(btn.dataset.c); });
  const kh = (e) => { if (e.key === '1') pick('pk'); else if (e.key === '2') pick('send'); else if (e.key === '3') pick('none'); };
  foot._kh = kh; document.addEventListener('keydown', kh);
  if (useTimer) {
    const t = $('#cut-timer');
    if (t) { t.style.transition = `transform 12s linear`; t.style.transform = 'scaleX(1)'; requestAnimationFrame(() => t.style.transform = 'scaleX(0)'); }
    foot._to = setTimeout(() => pick('none'), 12000);
  }
}

function resumeIntervention(choice) {
  const foot = $('#m-foot');
  if (foot._kh) { document.removeEventListener('keydown', foot._kh); foot._kh = null; }
  if (foot._to) { clearTimeout(foot._to); foot._to = null; }
  const res = applyIntervention(choice, M);
  if (res.trace) {
    // 介入の痕跡を追加
    S.traces.push({ id: 'tri' + S.traces.length, op: 'ref_bribe', opName: '試合介入', operativeId: null, operativeName: '―', kind: 'match', size: res.trace, week: S.week, found: {} });
  }
  if (res.goal) { M.hsLive++; sfx.whistle(); sfx.goal(); $('#m-score').textContent = `${M.hsLive} – ${M.asLive}`; }
  else if (choice === 'send') sfx.whistle();
  logLine({ minute: M.beats[mi - 1].minute, text: res.text, type: res.goal ? 'goal' : 'play', side: 'me' });
  renderMatchStats();
  foot.innerHTML = '<button id="m-skip">早送り</button>';
  $('#m-skip').onclick = () => { settings.speed = settings.speed >= 4 ? 1 : settings.speed * 2; };
  setTimeout(stepMatch, 700);
}

function renderMatchStats() {
  const myStr = M.me.base, opStr = M.opp.base;
  const poss = Math.round(clamp(50 + (myStr - opStr) * 0.8, 25, 75));
  $('#m-stats').innerHTML = `
    <div><span>支配率</span><b>${M.fx.isHome ? poss : poss}–${100 - poss}</b></div>
    <div><span>シュート</span><b>${M.hsLive + 4}–${M.asLive + 3}</b></div>
    <div><span>枠内</span><b>${M.hsLive + 1}–${M.asLive + 1}</b></div>
    <div><span>警告</span><b>${rint2()}–${rint2()}</b></div>`;
}
function rint2() { return Math.floor(Math.random() * 3); }

function endMatch() {
  clearTimeout(mTimer);
  finalizeMatch(M.fx, M.hsLive, M.asLive);
  const foot = $('#m-foot');
  const res = M.hsLive > M.asLive ? '勝利' : M.hsLive < M.asLive ? '敗戦' : '引き分け';
  foot.innerHTML = `<button id="m-done" style="background:var(--vermil);color:#fff">試合終了 ・ ${res} ・ 次へ</button>`;
  $('#m-done').onclick = () => { const ev = postMatch(); continueAfterMatch(ev); };
}

function moveBall(b) {
  const ball = $('#m-ball'); if (!ball) return;
  const x = b.side === 'me' ? 70 + Math.random() * 25 : 10 + Math.random() * 25;
  const y = 15 + Math.random() * 38;
  ball.setAttribute('cx', x); ball.setAttribute('cy', y);
}
function pitchSvg() {
  return `<svg viewBox="0 0 105 68" preserveAspectRatio="xMidYMid meet">
    <g fill="none" stroke="rgba(236,234,228,.22)" stroke-width=".3">
      <rect x="1" y="1" width="103" height="66"/><line x1="52.5" y1="1" x2="52.5" y2="67"/>
      <circle cx="52.5" cy="34" r="9.15"/><rect x="1" y="13.85" width="16.5" height="40.3"/>
      <rect x="87.5" y="13.85" width="16.5" height="40.3"/><rect x="1" y="24.85" width="5.5" height="18.3"/>
      <rect x="98.5" y="24.85" width="5.5" height="18.3"/></g>
    <circle id="m-ball" class="ball" cx="52.5" cy="34" r="1.5" fill="#ECEAE4"/></svg>`;
}

// ===================== 試合後の遷移 =====================
function continueAfterMatch(events) {
  if (S.phase === 'end') { renderEnd(); return; }
  if (S.phase === 'trial') { renderTrial(); return; }
  // 週末の出来事(寝返り・追及)があれば報告
  if (events && events.length) {
    showEventList(events, () => { if (S.phase === 'end') renderEnd(); else renderNews(); });
  } else renderNews();
}

// ===================== 報告(工作結果) =====================
function showReports(reports, done) {
  const body = reports.map((r) => `
    <div class="report-item ${r.ok ? 'ok' : 'fail'}">
      <div class="rt">${esc(r.name)} ・ ${r.ok ? '成功' : '失敗'}</div>
      <div class="rb">${esc(r.text)}</div>
      ${r.trace ? `<div class="rtrace">痕跡が残った(${traceKindJa(r.trace.kind)} ・ ${esc(r.operative)})</div>` : ''}
    </div>`).join('');
  openModal(`<h3>週明けの報告</h3><div class="lead">先週命じた工作の結末。</div>${body}
    <div class="mfoot"><button class="primary" id="rep-ok">続ける</button></div>`, false);
  $('#rep-ok').onclick = () => { closeModal(); done(); };
}
function showEventList(events, done) {
  const body = events.map((e) => `<div class="report-item ${e.alert ? 'ok' : ''}"><div class="rb">${esc(e.text)}</div></div>`).join('');
  openModal(`<h3>今週の動き</h3>${body}<div class="mfoot"><button class="primary" id="ev-ok">続ける</button></div>`, false);
  $('#ev-ok').onclick = () => { closeModal(); done(); };
}
function traceKindJa(k) { return { money: '金の流れ', people: '人の噂', match: '試合の不自然さ', violence: '暴力の痕跡' }[k] || k; }

// ===================== 新聞 =====================
function renderNews() {
  const p = S.paper;
  if (!p) { renderOffice(); return; }
  const items = p.items.map((n) => `<div class="item"><h4>${headlineFor(n.kind)}</h4>${esc(n.text)}。</div>`).join('');
  $('#news-root').innerHTML = `
    <div class="press">
      <div class="nameplate">IL FARO</div>
      <div class="dateline"><span>日刊イル・ファーロ</span><span>第${p.week - 1}節 翌朝</span><span>ヴェスカーラ共和国</span></div>
      <div class="lead">${esc(p.head || 'リーグ、第' + (p.week - 1) + '節を終える')}</div>
      <div class="sub">${esc(p.sub || '')} US ヴェラルドは暫定${p.pos}位。</div>
      <div class="cols2">${items || '<div class="item">特記事項なし。</div>'}</div>
      <div class="foot"><button id="news-next">読み終える</button></div>
    </div>`;
  show('news');
  $('#news-next').onclick = () => { sfx.click(); renderOffice(); };
}
function headlineFor(kind) { return { club: 'クラブ', pros: '司法', press: '報道', ethics: '協会', rival: 'リーグ', misc: '雑報' }[kind] || '雑報'; }

// ===================== 工作の発注シート =====================
let draft = { type: null, operativeId: null, target: null };

export function openOpSheet() {
  draft = { type: null, operativeId: null, target: null };
  renderOpSheet();
}

function renderOpSheet() {
  const free = S.operatives.filter((o) => o.alive && !o.defected && !o.busy);
  let html = '<h3>新しい工作を命じる</h3><div class="lead">手駒は1週に1件まで動ける。空いている手駒:' + free.length + '名。</div><div class="sheet">';

  // Step 1: 手駒
  html += '<div class="step"><h4>1 ・ 誰に任せる</h4>';
  if (!free.length) html += '<div class="rb">空いている手駒がいない。</div>';
  free.forEach((o) => {
    html += `<button class="opt-row ${draft.operativeId === o.id ? 'sel' : ''}" data-op="${o.id}">
      <span class="r-n">${esc(opName(o))}</span><span class="r-meta">${esc(ROLES[o.role])}</span>
      <span class="r-d">腕 ${['F','E','D','C','B','A'][o.skill]} ・ 忠誠 ${Math.round(o.loyalty)} ・ 口の堅さ ${Math.round(o.discretion)}</span></button>`;
  });
  html += '</div>';

  // Step 2: 工作
  if (draft.operativeId) {
    const o = operative(draft.operativeId);
    html += '<div class="step"><h4>2 ・ 何をさせる</h4>';
    Object.keys(OPS).forEach((type) => {
      const d = OPS[type];
      if (!opAllowed(type, o)) return;
      const afford = S.money.black >= d.cost;
      html += `<button class="opt-row ${draft.type === type ? 'sel' : ''}" data-type="${type}" ${afford ? '' : 'disabled'}>
        <span class="r-n">${esc(d.name)}</span><span class="r-meta">${d.cat} ・ ${d.cost ? fmtK(d.cost) + '裏' : '無料'}</span>
        <span class="r-d">${esc(d.desc)}</span></button>`;
    });
    html += '</div>';
  }

  // Step 3: 対象
  if (draft.type) {
    const d = OPS[draft.type];
    const needsTarget = !['none'].includes(d.target);
    if (needsTarget) {
      const tgts = targetsFor(draft.type);
      html += '<div class="step"><h4>3 ・ 対象</h4>';
      if (!tgts.length) html += '<div class="rb">対象がいない。(弱みを握っていない、相手がいない、など)</div>';
      tgts.forEach((t) => {
        html += `<button class="opt-row ${draft.target === t.key ? 'sel' : ''}" data-target="${esc(t.key)}"><span class="r-n">${esc(t.label)}</span></button>`;
      });
      html += '</div>';
    }
  }

  // 成算ゲージ
  if (draft.type && draft.operativeId) {
    const d = OPS[draft.type];
    const needsTarget = !['none'].includes(d.target);
    const ready = !needsTarget || draft.target;
    if (ready) {
      const o = operative(draft.operativeId);
      const chance = successChance(draft.type, o, draft.target);
      const trace = traceChance(draft.type, o);
      const cCls = chance >= 70 ? 'ok' : chance >= 45 ? 'mid' : 'bad';
      const tCls = trace <= 25 ? 'ok' : trace <= 55 ? 'mid' : 'bad';
      html += `<div class="gauge"><span>成算 <b class="${cCls}">${chance}%</b></span><span>痕跡が残る確率 <b class="${tCls}">${trace}%</b></span>
        <span>費用 <b>${d.cost ? fmtK(d.cost) : '―'}</b> 裏金</span></div>`;
      html += `<div class="mfoot"><button id="sheet-cancel">やめる</button><button class="primary" id="sheet-go">命じる</button></div>`;
    } else {
      html += `<div class="mfoot"><button id="sheet-cancel">やめる</button></div>`;
    }
  } else {
    html += `<div class="mfoot"><button id="sheet-cancel">やめる</button></div>`;
  }
  html += '</div>';

  openModal(html, false);

  $$('.opt-row[data-op]').forEach((b) => b.onclick = () => { draft.operativeId = b.dataset.op; draft.type = null; draft.target = null; sfx.click(); renderOpSheet(); });
  $$('.opt-row[data-type]').forEach((b) => b.onclick = () => { if (b.disabled) return; draft.type = b.dataset.type; draft.target = null; sfx.click(); renderOpSheet(); });
  $$('.opt-row[data-target]').forEach((b) => b.onclick = () => { draft.target = b.dataset.target; sfx.click(); renderOpSheet(); });
  const cancel = $('#sheet-cancel'); if (cancel) cancel.onclick = () => { closeModal(); renderFile(); };
  const go = $('#sheet-go'); if (go) go.onclick = () => {
    const o = operative(draft.operativeId);
    orderOp(draft.type, o, draft.target);
    sfx.stamp();
    closeModal();
    save();
    renderFile(true);
    toast('工作を命じた。結果は週明けに。');
  };
}

// ===================== 雇用・資金 =====================
export function openHireSheet() {
  const pool = S.hirePool;
  let html = '<h3>手駒を雇う</h3><div class="lead">契約金は裏金から。週額は毎週の報酬。</div><div class="sheet">';
  if (!pool.length) html += '<div class="rb">今は雇える者がいない。</div>';
  pool.forEach((o) => {
    const afford = S.money.black >= o.fee;
    html += `<button class="opt-row" data-hire="${o.id}" ${afford ? '' : 'disabled'}>
      <span class="r-n">${esc(opName(o))}</span><span class="r-meta">${esc(ROLES[o.role])} ・ 契約金 ${fmtK(o.fee)} ・ 週額 ${fmtK(o.wage)}</span>
      <span class="r-d">腕 ${['F','E','D','C','B','A'][o.skill]} ・ ${esc(o.note)}</span></button>`;
  });
  html += '<div class="mfoot"><button id="hire-cancel">やめる</button></div></div>';
  openModal(html, false);
  $$('.opt-row[data-hire]').forEach((b) => b.onclick = () => {
    if (b.disabled) return;
    const idx = S.hirePool.findIndex((x) => x.id === b.dataset.hire);
    const o = S.hirePool[idx];
    S.money.black -= o.fee;
    S.operatives.push({ ...o, alive: true, defected: false, busy: null, known: false, guard: false });
    S.hirePool.splice(idx, 1);
    sfx.stamp(); closeModal(); save(); renderFile(); toast(`${opName(o)}を雇った。`);
  });
  $('#hire-cancel').onclick = () => { closeModal(); renderFile(); };
}

export function openMoneySheet() {
  const html = `<h3>裏金を動かす</h3><div class="lead">会計士の仕事。ここでは即時に処理する。</div><div class="sheet">
    <div class="gauge"><span>裏金 <b class="mid">${fmtK(S.money.black)}</b></span><span>表の資金 <b>${fmtK(S.money.clean)}</b></span></div>
    <button class="opt-row" id="mv-launder" ${S.money.black >= 200 ? '' : 'disabled'}><span class="r-n">洗浄する</span><span class="r-meta">裏 ${fmtK(200)} → 表 ${fmtK(170)}</span><span class="r-d">架空のスポンサー料として表に戻す。手数料15%。成算は会計士しだい。発注として積む。</span></button>
    <div class="rb" style="margin-top:8px;color:var(--sumi-2)">※ 洗浄・粉飾・裏金作りは「新しい工作」からも命じられる(会計士が必要)。</div>
    <div class="mfoot"><button id="mv-cancel">閉じる</button></div></div>`;
  openModal(html, false);
  const l = $('#mv-launder'); if (l) l.onclick = () => {
    const acc = S.operatives.find((o) => o.alive && !o.defected && !o.busy && o.role === 'accountant');
    if (!acc) { toast('空いている会計士がいない。'); return; }
    orderOp('launder', acc, null); sfx.stamp(); closeModal(); save(); renderFile(true); toast('洗浄を命じた。');
  };
  $('#mv-cancel').onclick = () => { closeModal(); renderFile(); };
}

// ===================== 裁判 =====================
export function renderTrial() {
  const t = S.trial;
  const g = trialGuiltChance(t);
  const gCls = g >= 60 ? 'g' : '';
  const witnesses = t.witnesses.concat(t.defectors.map((d) => ({ ...d, defector: true })));
  const wHtml = witnesses.length ? witnesses.map((w) => `<div class="r"><span>${esc(w.name)}${w.defector ? '(寝返り)' : ''}</span><span>${w.defector ? '検察側' : '証言しうる'}</span></div>`).join('') : '<div class="r"><span>生きている証人</span><span>なし</span></div>';
  let moves = '';
  if (!t.moveUsed) {
    moves = `<div class="moves">
      <button class="choice" data-m="buyJudge"><kbd>1</kbd><span>判事を買収する</span><span class="cost">${fmtK(300)} 裏 ・ 心証を傾ける</span></button>
      ${witnesses.length ? `<button class="choice" data-m="silence"><kbd>2</kbd><span>証人を一人、消す</span><span class="cost">成算 65%</span></button>` : ''}
      <button class="choice" data-m="flee"><kbd>3</kbd><span>国外逃亡の手配</span><span class="cost">有罪でも拘束を免れる</span></button>
      <button class="choice" data-m="none"><kbd>0</kbd><span>何もしない。判決を待つ</span><span class="cost">―</span></button>
    </div>`;
  }
  openModal(`<h3>公判</h3><div class="lead">検察は起訴に踏み切った。判決の前に、打てる手は一つだけ。</div>
    <div class="gmeter"><div class="lbl"><span>有罪になる見込み</span><span>${g}%</span></div><div class="track"><i style="width:${g}%"></i></div></div>
    <div class="factors">
      <div class="r"><span>検察の証拠</span><span>${Math.round(t.evidence)}</span></div>
      ${wHtml}
      <div class="r"><span>司法への影響</span><span>${t.judicial ? '+' + t.judicial : 'なし'}</span></div>
    </div>${moves}
    ${t.moveUsed ? '<div class="mfoot"><button class="primary" id="trial-decide">判決</button></div>' : ''}`, false, true);

  $$('.choice[data-m]').forEach((b) => b.onclick = () => {
    const m = b.dataset.m;
    if (m === 'silence') { openSilencePick(); return; }
    const r = applyTrialMove(m, null);
    sfx.click();
    toast(r.text);
    setTimeout(() => renderTrial(), 400);
  });
  const dec = $('#trial-decide'); if (dec) dec.onclick = () => runVerdict();
}

function openSilencePick() {
  const t = S.trial;
  const all = t.witnesses.concat(t.defectors);
  let html = '<h3>証人を選ぶ</h3><div class="lead">公判までに一人だけ。成算65%。失敗すれば検察に保護される。</div><div class="sheet">';
  all.forEach((w) => html += `<button class="opt-row" data-w="${w.id}"><span class="r-n">${esc(w.name)}</span></button>`);
  html += '<div class="mfoot"><button id="sp-cancel">戻る</button></div></div>';
  openModal(html, false, true);
  $$('.opt-row[data-w]').forEach((b) => b.onclick = () => { const r = applyTrialMove('silence', b.dataset.w); sfx.click(); toast(r.text); setTimeout(() => renderTrial(), 400); });
  $('#sp-cancel').onclick = () => renderTrial();
}

function runVerdict() {
  const r = decideTrial();
  openModal(`<h3>判決</h3>
    <div class="verdict ${r.guilty ? 'g' : 'ng'}">${r.guilty ? '有 罪' : '無 罪'}</div>
    <div class="lead" style="text-align:center">${esc(r.text)}</div>
    <div class="mfoot"><button class="primary" id="v-ok">${r.guilty ? '終幕へ' : '続ける'}</button></div>`, false, true);
  sfx.stamp();
  $('#v-ok').onclick = () => { closeModal(); if (S.phase === 'end') renderEnd(); else { save(); renderNews(); } };
}

// ===================== 終幕 =====================
export function renderEnd() {
  const e = S.ending || { title: '終幕', text: '' };
  const win = e.kind === 'promoted';
  const tbl = sortedTable();
  const pos = tbl.findIndex((r) => r.id === S.clubId) + 1;
  $('#end-root').innerHTML = `
    <div class="big ${win ? 'win' : ''}">${esc(e.title)}</div>
    <div class="etext">${esc(e.text)}</div>
    <div class="estat">
      最終順位 ${pos}位 ・ 勝ち点 ${S.table[S.clubId].pts}<br>
      片付けた工作 ${S.stats.opsDone}件 ・ 消した相手 ${S.stats.killed}人 ・ 買収した審判 ${S.stats.bribes}回<br>
      残った痕跡 ${S.traces.length}件
    </div>
    <button class="ebtn" id="end-restart">もう一度</button>`;
  show('end');
  clearSave();
  $('#end-restart').onclick = () => { location.reload(); };
}

// ===================== モーダル =====================
let modalKh = null;
function openModal(html, dark, noClose) {
  closeModal();
  const scrim = el('div', 'scrim');
  scrim.id = 'scrim';
  const modal = el('div', 'modal' + (dark ? ' dark' : ''), html);
  scrim.appendChild(modal);
  document.body.appendChild(scrim);
  if (!noClose) scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  // 数字キーで choice を選べるように
  modalKh = (e) => {
    const map = { '1': 0, '2': 1, '3': 2, '0': 3 };
    if (e.key in map) { const cs = modal.querySelectorAll('.choice'); if (cs[map[e.key]]) { e.preventDefault(); cs[map[e.key]].click(); } }
  };
  document.addEventListener('keydown', modalKh);
}
function closeModal() {
  const s = $('#scrim'); if (s) s.remove();
  if (modalKh) { document.removeEventListener('keydown', modalKh); modalKh = null; }
}
export { closeModal };
