// 画面の描画と操作。各スクリーンを state から組み立てる。
import { OPS, SEASON_WEEKS, ROLES } from './data.js';
import {
  S, newGame, load, save, hasSave, clearSave, settings, loadSettings, saveSettings,
  club, myClub, fixtureFor, refFor, sortedTable, personByKey, operative, opName, pursuer,
  fmtK, clamp, rint,
} from './state.js';
import { targetsFor, successChance, traceChance, orderOp, opAllowed } from './ops.js';
import { preMatch, postMatch } from './world.js';
import { buildMatch, applyIntervention, finalizeMatch, teamStrength } from './match.js';
import { makeTrial, trialGuiltChance, applyTrialMove, decideTrial } from './pursuit.js';
import { sfx } from './sound.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

let current = 'title';
function show(id) {
  current = id;
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + id));
  window.scrollTo(0, 0);
}
function toast(msg) {
  const t = el('div', 'toast', esc(msg));
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ===== タイトル =====
function renderTitle() {
  const cont = hasSave();
  $('#btn-continue').disabled = !cont;
  $('#btn-continue small').textContent = cont ? `第${(load() && S.week) || 1}週から` : 'セーブなし';
  show('title');
}

// ===== トップバー =====
function renderTopbar() {
  const t = $('#topbar'); if (!t) return;
  const neg = S.money.clean < 0;
  t.querySelector('.wk b').textContent = `${String(S.week).padStart(2, '0')}`;
  const r = t.querySelector('.res');
  r.innerHTML = `
    <div><span>運転資金</span><b class="${neg ? 'neg' : ''}">${fmtK(S.money.clean)}</b></div>
    <div><span>裏金</span><b class="black">${fmtK(S.money.black)}</b></div>
    <div><span>支持</span><b>${Math.round(S.supporters)}</b></div>`;
}

// ===== オフィス(表) =====
function renderOffice() {
  renderTopbar();
  const fx = fixtureFor(S.week);
  const rf = refFor(S.week);
  const opp = fx ? club(fx.opp) : null;
  const me = myClub();
  const tbl = sortedTable();
  const myPos = tbl.findIndex((r) => r.id === S.clubId) + 1;

  // 次節
  const nextBox = $('#off-next');
  if (fx) {
    const myStr = Math.round(teamStrength(S.clubId).base);
    const oppStr = Math.round(teamStrength(fx.opp).base);
    const inj = S.squad.filter((p) => p.injured).length;
    nextBox.innerHTML = `
      <div class="next">
        <div class="t">${fx.isHome ? me.short : opp.short}<small>${fx.isHome ? 'ホーム ・ ' + me.stadium : 'アウェイ ・ ' + opp.stadium}</small></div>
        <div class="vs">${fx.isHome ? 'VS' : 'AT'}</div>
        <div class="t r">${fx.isHome ? opp.short : me.short}<small>${esc(opp.ja)}</small></div>
      </div>
      <dl class="facts">
        <div><dt>主審</dt><dd>${esc(rf ? rf.name : '―')}</dd></div>
        <div><dt>自軍 戦力</dt><dd>${myStr}</dd></div>
        <div><dt>相手 戦力</dt><dd>${oppStr}</dd></div>
        <div><dt>欠場</dt><dd class="${inj ? 'hot' : ''}">${inj}名</dd></div>
        <div><dt>順位</dt><dd>${myPos}位 / 8</dd></div>
        <div><dt>勝ち点</dt><dd>${S.table[S.clubId].pts}</dd></div>
      </dl>`;
  } else nextBox.innerHTML = '<div class="board">今節は試合がない。</div>';

  // 順位表
  const rows = tbl.map((r, i) => {
    const c = club(r.id);
    const gd = r.gf - r.ga;
    return `<tr class="${r.id === S.clubId ? 'me' : ''} ${i === 1 ? 'promo' : ''}">
      <td>${i + 1}</td><td>${c.short}</td><td>${r.p}</td><td>${gd >= 0 ? '+' + gd : gd}</td><td>${r.pts}</td></tr>`;
  }).join('');
  $('#off-table').innerHTML = `<div class="scroll-x"><table class="tbl">
    <thead><tr><th>#</th><th>CLUB</th><th>試</th><th>差</th><th>点</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
    <div class="board" style="margin-top:10px">上位2クラブが一部へ昇格 ・ 第${S.week}/${SEASON_WEEKS}節</div>`;

  // 財政
  const neg = S.money.clean < 0;
  const dueIn = S.money.dueWeek - S.week;
  $('#off-money').innerHTML = `
    <div class="money">
      <div class="row"><span class="k">運転資金(表)</span><span class="v ${neg ? 'neg' : ''}">${fmtK(S.money.clean)}</span></div>
      <div class="row"><span class="k">裏金</span><span class="v black">${fmtK(S.money.black)}</span></div>
      <div class="row"><span class="k">負債</span><span class="v neg">${fmtK(S.money.debt)}<small>返済 第${S.money.dueWeek}週${S.money.duePaid ? '(済)' : dueIn >= 0 ? `(あと${dueIn}週)` : ''}</small></span></div>
      <div class="board">理事会の信任 <b>${54}</b> ・ サポーターの支持 <b>${Math.round(S.supporters)}</b><div class="bar2"><i style="width:${S.supporters}%"></i></div>
      スポンサー:ヴェスカーラ港湾公社</div>
    </div>`;

  // ニュース
  const ticker = $('#off-ticker .run');
  const items = S.news.slice(0, 8).map((n) => `<span>${esc(n.text)}</span>`).join('');
  ticker.innerHTML = items + items;

  show('office');
}

// ===== ファイル(裏) =====
function renderFile(stampPress = false) {
  const live = S.operatives.filter((o) => o.alive);
  const rosterRows = live.map((o) => {
    const dead = o.defected;
    const grade = ['F', 'E', 'D', 'C', 'B', 'A'][clamp(o.skill, 0, 5)] || '?';
    const name = o.alias ? `“${o.alias}”<small>${esc(ROLES[o.role])} ・ 本名 <span class="redact">${esc(o.name)}</span></small>` : `${esc(o.name)}<small>${esc(ROLES[o.role])} ・ ${esc(o.note)}</small>`;
    const busy = o.busy ? `<span class="tag-busy">実行中</span>` : '';
    const defTag = o.defected ? `<span class="tag-def">寝返り</span>` : '';
    return `<tr>
      <td class="who ${dead ? 'dead' : ''}">${name} ${busy}${defTag}</td>
      <td class="grade">${grade}</td>
      <td>${meterHtml(o.loyalty)}</td>
      <td>${meterHtml(o.discretion)}</td>
    </tr>`;
  }).join('');
  $('#file-roster').innerHTML = `<div class="scroll-x"><table class="roster">
    <thead><tr><th>氏名 / 役</th><th>腕</th><th>忠誠</th><th>口の堅さ</th></tr></thead>
    <tbody>${rosterRows}</tbody></table></div>`;

  // 追及者
  $('#file-pursuers').innerHTML = S.pursuers.map((p) => {
    if (!p.alive) return '';
    const lv = p.evidence;
    const alert = lv >= 70, quiet = p.quiet > 0 && p.quiet < 90;
    let act = '動きなし';
    if (lv >= 100) act = '決定的な処分に踏み切った';
    else if (lv >= 70) act = p.kind === 'pros' ? '家宅捜索の令状を取ろうとしている' : p.kind === 'press' ? '特集記事を準備中。情報源はクラブ内部' : p.kind === 'ethics' ? '聴聞を開く。勝ち点剥奪があり得る' : '協会に申し立てた';
    else if (lv >= 40) act = '取材・内偵を始めた';
    if (quiet) act = 'しばらく静かにしている';
    return `<div class="pu ${alert ? 'alert' : ''} ${quiet ? 'quiet' : ''}">
      <div class="n">${esc(p.name)}<small>${esc(p.org)}</small></div>
      <div class="pct">${Math.round(lv)} / 100</div>
      <div class="bar"><i style="width:${lv}%"></i><span class="m40"></span><span class="m70"></span></div>
      <div class="next-act">${esc(act)}</div>
    </div>`;
  }).join('');

  // 進行中の工作
  const opsHtml = S.ops.map((op) => {
    const tgt = op.target ? (personByKey(op.target)?.name || (op.target.startsWith('club:') ? club(op.target.split(':')[1]).ja : '―')) : '―';
    return `<div class="op"><span class="clip"></span>
      <div class="id"><span>${op.id.toUpperCase()}</span><span>残り ${op.weeksLeft}週</span></div>
      <div class="what">${esc(op.name)}</div>
      <dl><dt>担当</dt><dd>${esc(op.operativeName)}</dd><dt>対象</dt><dd>${esc(tgt)}</dd><dt>成算</dt><dd>${op.chance}%</dd><dt>痕跡</dt><dd>${op.traceP}%</dd></dl>
    </div>`;
  }).join('');
  $('#file-ops').innerHTML = opsHtml || '<div class="op empty">進行中の工作はない</div>';

  $('#file-meta').innerHTML = `FILE NO. ${String(400 + S.week).padStart(4, '0')} ・ 保管者:オーナー本人 ・ 写し:なし<br>裏金残高 ${fmtK(S.money.black)} ・ 痕跡 ${S.traces.length}件`;
  $('#file-title').textContent = `案件綴 第${S.week}週`;
  const stamp = $('#file-stamp');
  stamp.classList.toggle('press', stampPress);
  if (stampPress) sfx.stamp();

  show('file');
}
function meterHtml(v, low) {
  const n = Math.round(v / 10);
  let s = `<div class="meter ${v < 40 ? 'low' : ''}">`;
  for (let i = 0; i < 10; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
  return s + '</div>';
}

export { renderTitle, renderOffice, renderFile, renderTopbar, show, toast, $, $$, el, esc };
