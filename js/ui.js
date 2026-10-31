// 画面の描画と操作。デスク(案件)を中心に組み立てる。
import { SEASON_WEEKS, ROLES } from './data.js';
import {
  S, load, hasSave, settings, club, myClub, fixtureFor, refFor, sortedTable, operative, opName, pursuer,
  fmtK, clamp,
} from './state.js';
import { CASES } from './cases.js';
import { caseContext, choiceStatus, situationLine, objective, fill, val, ROLE_JA } from './engine.js';
import { teamStrength } from './match.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + id));
  window.scrollTo(0, 0);
}
function toast(msg) { const t = el('div', 'toast', esc(msg)); document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }

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
  t.querySelector('.wk b').textContent = String(S.week).padStart(2, '0');
  t.querySelector('.res').innerHTML = `
    <div><span>資金</span><b class="${neg ? 'neg' : ''}">${fmtK(S.money.clean)}</b></div>
    <div><span>裏金</span><b class="black">${fmtK(S.money.black)}</b></div>
    <div><span>支持</span><b>${Math.round(S.supporters)}</b></div>`;
}

// ===== デスク(案件)=====
function renderDesk() {
  renderTopbar();
  const ob = objective();
  const ctx = caseContext();

  // 状況バー
  const sit = situationLine();
  const threatCls = ob.threat && ob.threat.ev >= 70 ? 'hot' : ob.threat && ob.threat.ev >= 40 ? 'warn' : '';
  $('#desk-objective').innerHTML = `
    <div class="obj-main">
      <div class="obj-pos"><span>順位</span><b>${ob.pos}<i>/8</i></b></div>
      <div class="obj-next">
        ${ob.next ? `<span>次節 第${S.week}節</span><b>${ob.next.isHome ? 'vs ' : '＠'}${esc(ob.next.opp)}</b><small>${esc(ob.next.oppJa)}</small>` : '<span>今節</span><b>試合なし</b>'}
      </div>
      <div class="obj-threat ${threatCls}">
        ${ob.threat ? `<span>最大の脅威</span><b>${esc(ob.threat.name)}</b><small>証拠 ${ob.threat.ev}/100</small>` : '<span>追及</span><b>静か</b>'}
      </div>
    </div>
    <div class="obj-sit">${sit.map((s) => `<span>${esc(s)}</span>`).join('')}</div>`;

  // 案件カード
  const deck = $('#desk-cards');
  deck.innerHTML = '';
  const unresolved = S.desk.filter((d) => !S.resolvedThisWeek.includes(d.key));
  if (!S.desk.length) deck.innerHTML = '<div class="case done"><div class="case-body">今週、机の上に案件はない。</div></div>';
  S.desk.forEach((d) => deck.appendChild(caseCard(d, ctx)));

  // 進行ボタン
  const btn = $('#desk-advance');
  const fx = fixtureFor(S.week);
  if (unresolved.length) { btn.disabled = false; btn.classList.remove('ready'); btn.innerHTML = `<kbd>SPACE</kbd>${fx ? '案件を残して試合へ' : '案件を残して週を終える'}<small>${unresolved.length}件 未処理</small>`; }
  else { btn.disabled = false; btn.classList.add('ready'); btn.innerHTML = `<kbd>SPACE</kbd>${fx ? '試合へ進む' : '週を終える'}<small>すべて処理済み</small>`; }

  show('office');
}

function caseCard(d, ctx) {
  const c = CASES[d.key];
  const resolved = S.resolvedThisWeek.includes(d.key);
  const card = el('article', 'case' + (resolved ? ' done' : ''));
  const report = resolved ? (S._lastReports && S._lastReports[d.key]) : null;
  card.innerHTML = `
    <div class="case-head">
      <span class="case-from">${esc(fill(val(c.from, ctx), ctx) || '')}</span>
      <span class="case-tag">${esc(c.tag || '案件')}</span>
    </div>
    <h3 class="case-title">${esc(fill(val(c.title, ctx), ctx))}</h3>
    <div class="case-body">${esc(fill(val(c.body, ctx), ctx)).replace(/\n/g, '<br>')}</div>
    <div class="case-choices"></div>`;
  const cc = card.querySelector('.case-choices');
  if (resolved && report) {
    cc.innerHTML = `<div class="case-result ${report.ok ? 'ok' : 'fail'}">
      <div class="cr-pick">▸ ${esc(report.choiceLabel)}${report.risky ? (report.ok ? ' ・ 成功' : ' ・ 失敗') : ''}</div>
      <div class="cr-text">${esc(report.text)}</div>
      ${report.traced ? '<div class="cr-trace">痕跡が残った</div>' : ''}
    </div>`;
  } else {
    c.choices.forEach((choice) => {
      const st = choiceStatus(d.key, choice);
      const btn = el('button', 'choice-row' + (st.ok ? '' : ' disabled'));
      btn.dataset.case = d.key; btn.dataset.choice = choice.id;
      if (!st.ok) btn.disabled = true;
      let meta = '';
      if (choice.need) {
        const parts = [];
        if (choice.need.black) parts.push(`${fmtK(choice.need.black)}裏`);
        if (choice.need.clean) parts.push(`${fmtK(choice.need.clean)}`);
        meta = parts.join(' ');
      }
      if (choice.assign) meta = (meta ? meta + ' ・ ' : '') + ROLE_JA[choice.assign] + (st.operative ? `(${opName(st.operative)})` : '');
      if (choice.risk && st.ok) {
        const o = st.operative;
        const ch = clamp(Math.round(val(choice.risk, ctx, o)), 3, 97);
        meta = (meta ? meta + ' ・ ' : '') + `成算 ${ch}%`;
      }
      btn.innerHTML = `
        <div class="ch-main"><span class="ch-label">${esc(fill(val(choice.label, ctx), ctx))}</span>${meta ? `<span class="ch-meta">${esc(meta)}</span>` : ''}</div>
        <div class="ch-desc">${esc(fill(choice.desc || '', ctx))}</div>
        ${!st.ok ? `<div class="ch-block">${esc(st.reasons.join(' / '))}</div>` : ''}`;
      cc.appendChild(btn);
    });
  }
  return card;
}

// ===== ファイル(裏・参照用)=====
function renderFile() {
  const live = S.operatives.filter((o) => o.alive);
  const grade = (n) => ['F', 'E', 'D', 'C', 'B', 'A'][clamp(n, 0, 5)] || '?';
  $('#file-roster').innerHTML = `<div class="scroll-x"><table class="roster">
    <thead><tr><th>氏名 / 役</th><th>腕</th><th>忠誠</th><th>口の堅さ</th></tr></thead><tbody>${
    live.map((o) => `<tr>
      <td class="who ${o.defected ? 'dead' : ''}">${o.alias ? `“${esc(o.alias)}”` : esc(o.name)}<small>${esc(ROLES[o.role])} ・ ${esc(o.note)}</small>${o.defected ? ' <span class="tag-def">寝返り</span>' : ''}</td>
      <td class="grade">${grade(o.skill)}</td><td>${meterHtml(o.loyalty)}</td><td>${meterHtml(o.discretion)}</td></tr>`).join('')
    }</tbody></table></div>`;
  $('#file-pursuers').innerHTML = S.pursuers.filter((p) => p.alive).map((p) => {
    const lv = p.evidence, alert = lv >= 70, quiet = p.quiet > 0 && p.quiet < 90;
    let act = '動きなし';
    if (lv >= 100) act = '決定的な処分に踏み切った';
    else if (lv >= 70) act = p.kind === 'pros' ? '家宅捜索を狙っている' : p.kind === 'press' ? '特集記事を準備中' : p.kind === 'ethics' ? '聴聞を開く構え' : '協会に申し立てた';
    else if (lv >= 40) act = '取材・内偵を始めた';
    if (quiet) act = 'しばらく静かにしている';
    return `<div class="pu ${alert ? 'alert' : ''} ${quiet ? 'quiet' : ''}">
      <div class="n">${esc(p.name)}<small>${esc(p.org)}</small></div><div class="pct">${Math.round(lv)} / 100</div>
      <div class="bar"><i style="width:${lv}%"></i><span class="m40"></span><span class="m70"></span></div>
      <div class="next-act">${esc(act)}</div></div>`;
  }).join('');
  $('#file-meta').innerHTML = `FILE NO. ${String(400 + S.week).padStart(4, '0')} ・ 裏金 ${fmtK(S.money.black)} ・ 痕跡 ${S.traces.length}件`;
  $('#file-title').textContent = `案件綴 第${S.week}週`;
  show('file');
}
function meterHtml(v) {
  const n = Math.round(v / 10); let s = `<div class="meter ${v < 40 ? 'low' : ''}">`;
  for (let i = 0; i < 10; i++) s += `<i class="${i < n ? 'on' : ''}"></i>`;
  return s + '</div>';
}

export { renderTitle, renderDesk, renderFile, renderTopbar, show, toast, $, $$, el, esc, meterHtml };
