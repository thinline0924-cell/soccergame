// 起動・タイトル・開始設定・デスクの操作・キーボード・設定。
import { BACKGROUNDS, START_CLUBS, MODES } from './data.js';
import { S, newGame, load, hasSave, clearSave, settings, loadSettings, saveSettings, sortedTable, club, fmtK } from './state.js';
import { drawCases } from './engine.js';
import { renderTitle, renderDesk, renderFile, show, toast, $, $$, el, esc, meterHtml } from './ui.js';
import { chooseCase, advanceWeek, renderTrial, renderEnd, openModal, closeModal } from './flow.js';
import { sfx } from './sound.js';

loadSettings();

// ---- タイトル ----
$('#btn-new').onclick = () => { sfx.click(); openSetup(); };
$('#btn-continue').onclick = () => { sfx.click(); if (load()) resume(); };
$('#btn-howto').onclick = () => { sfx.click(); openHowto(); };
$('#btn-settings').onclick = () => { sfx.click(); openSettings(); };

function resume() {
  if (S.phase === 'end') { renderEnd(); return; }
  if (S.phase === 'trial') { renderTrial(); return; }
  if (!S.desk || !S.desk.length) { if (S.phase === 'office') drawCases(); }
  renderDesk();
}

// ---- 開始設定 ----
let setup = { bg: 'biz', club: 'c2', mode: 'chair' };
function openSetup() {
  const sect = (title, items, key) => `<h2>${title}</h2><div class="cards">${items.map((o) => `
    <button class="card-opt ${setup[key] === o.id ? 'sel' : ''}" data-key="${key}" data-id="${o.id}" ${o.ready ? '' : 'disabled'}>
      <span class="n">${esc(o.name)}${o.ready ? '' : '<span class="soon">準備中</span>'}</span><span class="d">${esc(o.desc)}</span></button>`).join('')}</div>`;
  $('#setup-root').innerHTML = `${sect('経歴', BACKGROUNDS, 'bg')}${sect('クラブ', START_CLUBS, 'club')}${sect('立場', MODES, 'mode')}
    <div class="setup-foot"><button class="fbtn ghost" id="setup-back">戻る</button><button class="fbtn go" id="setup-start">はじめる</button></div>`;
  $$('.card-opt').forEach((b) => b.onclick = () => { if (b.disabled) return; setup[b.dataset.key] = b.dataset.id; sfx.click(); openSetup(); });
  $('#setup-back').onclick = () => renderTitle();
  $('#setup-start').onclick = () => { sfx.stamp(); newGame(); drawCases(); renderDesk(); };
  show('setup');
}

// ---- デスクの操作(委譲)----
$('#desk-cards').addEventListener('click', (e) => {
  const btn = e.target.closest('.choice-row');
  if (!btn || btn.disabled) return;
  sfx.click();
  chooseCase(btn.dataset.case, btn.dataset.choice);
});
$('#desk-advance').onclick = () => { sfx.click(); advanceWeek(); };

// 参照ツールバー
$('#tool-table').onclick = () => { sfx.click(); openTable(); };
$('#tool-money').onclick = () => { sfx.click(); openMoney(); };
$('#tool-file').onclick = () => { sfx.click(); renderFile(); };
$('#tool-squad').onclick = () => { sfx.click(); openSquad(); };
$('#file-back').onclick = () => { sfx.click(); renderDesk(); };

function openTable() {
  const tbl = sortedTable();
  const rows = tbl.map((r, i) => { const c = club(r.id); const gd = r.gf - r.ga; return `<tr class="${r.id === S.clubId ? 'me' : ''} ${i === 1 ? 'promo' : ''}"><td>${i + 1}</td><td>${c.short}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${gd >= 0 ? '+' + gd : gd}</td><td>${r.pts}</td></tr>`; }).join('');
  openSimpleModal(`<h3>順位表 ・ 第${S.week}/${14}節</h3><div class="lead">上位2クラブが一部へ昇格。</div>
    <div class="scroll-x"><table class="tbl big"><thead><tr><th>#</th><th>CLUB</th><th>試</th><th>勝</th><th>分</th><th>負</th><th>差</th><th>点</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}
function openMoney() {
  const neg = S.money.clean < 0;
  openSimpleModal(`<h3>財政</h3><div class="money">
    <div class="row"><span class="k">運転資金(表)</span><span class="v ${neg ? 'neg' : ''}">${fmtK(S.money.clean)}</span></div>
    <div class="row"><span class="k">裏金</span><span class="v black">${fmtK(S.money.black)}</span></div>
    <div class="row"><span class="k">負債</span><span class="v neg">${fmtK(S.money.debt)}<small>返済 第${S.money.dueWeek}週${S.money.duePaid ? '(済)' : ''}</small></span></div>
    <div class="board">サポーターの支持 <b>${Math.round(S.supporters)}</b><div class="bar2"><i style="width:${S.supporters}%"></i></div>チーム状態 ${S.morale >= 0 ? '+' : ''}${S.morale}</div></div>`);
}
function openSquad() {
  const rows = S.squad.slice().sort((a, b) => b.ovr - a.ovr).map((p) => `<tr><td class="who ${p.injured ? 'dead' : ''}">${esc(p.name)}<small>${p.pos} ・ ${p.age}歳</small></td><td class="grade">${p.ovr}</td><td style="font-family:var(--f-mono)">${p.injured ? '欠場 ' + p.injured + '週' : '―'}</td></tr>`).join('');
  openSimpleModal(`<h3>選手</h3><div class="lead">総合力の高い11人が先発する。欠場は負傷。</div><div class="scroll-x"><table class="roster"><thead><tr><th>選手</th><th>総合</th><th>状態</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}

// ---- 遊び方 ----
function openHowto() {
  openSimpleModalDark(`<h3>遊び方</h3><div class="lead" style="text-align:left">
    二部の没落クラブ US ヴェラルドのオーナー。14節で上位2位に入れば昇格。正攻法で勝てる戦力はない。<br><br>
    毎週、机の上に<b>案件</b>が届く。審判や相手選手のこと、金のこと、嗅ぎ回る記者のこと。案件ごとに<b>表のやり方</b>と<b>裏のやり方</b>があり、誰が動くか・何を失うかが書いてある。一つを選ぶ。<br><br>
    裏の手には<b>成算</b>と<b>痕跡</b>がある。痕跡は4人の追及者(検察・記者・協会・ライバル)が拾う。証拠が溜まると動き、検察が振り切ると<b>起訴</b>。公判は一度きりの勝負。<br><br>
    試合では、仕込んだ工作が目に見える形で効く。ハーフタイムや終盤、買収した審判の前で、<b>決断</b>を迫られる。<br><br>
    捕まらずに、頂点へ。</div><div class="mfoot"><button class="primary" id="howto-ok">閉じる</button></div>`);
  $('#howto-ok').onclick = closeModal;
}

// ---- 設定 ----
function openSettings() {
  const row = (label, on, id) => `<button class="opt-row" data-set="${id}"><span class="r-n">${label}</span><span class="r-meta">${on ? 'オン' : 'オフ'}</span></button>`;
  openSimpleModalDark(`<h3>設定</h3><div class="sheet">
    ${row('試合中の介入に制限時間', settings.timer, 'timer')}${row('効果音', settings.sound, 'sound')}
    <button class="opt-row" data-set="wipe"><span class="r-n">セーブを消す</span><span class="r-meta">最初から</span></button>
    <div class="mfoot"><button class="primary" id="set-ok">閉じる</button></div></div>`);
  $$('.opt-row[data-set]').forEach((b) => b.onclick = () => { const k = b.dataset.set; if (k === 'wipe') { clearSave(); closeModal(); toast('セーブを消した。'); renderTitle(); return; } settings[k] = !settings[k]; saveSettings(); if (k === 'sound' && settings.sound) sfx.click(); openSettings(); });
  $('#set-ok').onclick = closeModal;
}

// ---- 汎用モーダル ----
function openSimpleModal(html, after) {
  closeModal();
  const scrim = el('div', 'scrim'); scrim.id = 'scrim';
  const modal = el('div', 'modal', html + '<div class="mfoot"><button class="primary" id="sm-close">閉じる</button></div>');
  scrim.appendChild(modal); document.body.appendChild(scrim);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  $('#sm-close').onclick = closeModal; if (after) after(modal);
}
function openSimpleModalDark(html) {
  closeModal();
  const scrim = el('div', 'scrim'); scrim.id = 'scrim';
  const modal = el('div', 'modal dark', html);
  scrim.appendChild(modal); document.body.appendChild(scrim);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
}

// ---- キーボード ----
document.addEventListener('keydown', (e) => {
  if ($('#scrim')) return;
  const screen = $$('.screen.on')[0]; if (!screen) return;
  if (screen.id === 's-office') {
    if (e.key === ' ') { e.preventDefault(); $('#desk-advance').click(); }
    else if (e.key === 'f' || e.key === 'F') $('#tool-file').click();
    else if (e.key === 't' || e.key === 'T') $('#tool-table').click();
  } else if (screen.id === 's-file' && e.key === 'Escape') $('#file-back').click();
});

renderTitle();
