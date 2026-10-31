// 起動・タイトル・開始設定・キーボード・設定。
import { BACKGROUNDS, START_CLUBS, MODES } from './data.js';
import { S, newGame, load, hasSave, clearSave, settings, loadSettings, saveSettings } from './state.js';
import { renderTitle, renderOffice, renderFile, show, toast, $, $$, el, esc } from './ui.js';
import { advanceWeek, openOpSheet, openHireSheet, openMoneySheet, renderTrial, renderEnd, closeModal } from './flow.js';
import { sfx } from './sound.js';

loadSettings();

// ---- タイトルのメニュー ----
$('#btn-new').onclick = () => { sfx.click(); openSetup(); };
$('#btn-continue').onclick = () => { sfx.click(); if (load()) resume(); };
$('#btn-howto').onclick = () => { sfx.click(); openHowto(); };
$('#btn-settings').onclick = () => { sfx.click(); openSettings(); };

function resume() {
  if (S.phase === 'end') { renderEnd(); return; }
  if (S.phase === 'trial') { renderTrial(); return; }
  renderOffice();
}

// ---- 開始設定(第1段階は1通りのみ選択可) ----
let setup = { bg: 'biz', club: 'c2', mode: 'chair' };
function openSetup() {
  const sect = (title, items, key) => `
    <h2>${title}</h2><div class="cards">${items.map((o) => `
      <button class="card-opt ${setup[key] === o.id ? 'sel' : ''}" data-key="${key}" data-id="${o.id}" ${o.ready ? '' : 'disabled'}>
        <span class="n">${esc(o.name)}${o.ready ? '' : '<span class="soon">準備中</span>'}</span>
        <span class="d">${esc(o.desc)}</span>
      </button>`).join('')}</div>`;
  $('#setup-root').innerHTML = `
    ${sect('経歴', BACKGROUNDS, 'bg')}
    ${sect('クラブ', START_CLUBS, 'club')}
    ${sect('立場', MODES, 'mode')}
    <div class="mfoot" style="display:flex;gap:10px;justify-content:space-between;margin-top:10px">
      <button class="fbtn" id="setup-back" style="border-color:var(--rule);color:var(--chalk-2);background:transparent">戻る</button>
      <button class="fbtn" id="setup-start" style="background:var(--vermil);color:#fff;border-color:var(--vermil)">はじめる</button>
    </div>`;
  $$('.card-opt').forEach((b) => b.onclick = () => { if (b.disabled) return; setup[b.dataset.key] = b.dataset.id; sfx.click(); openSetup(); });
  $('#setup-back').onclick = () => renderTitle();
  $('#setup-start').onclick = () => { sfx.stamp(); newGame(); renderOffice(); };
  show('setup');
}

// ---- オフィスの操作バー ----
$('#act-squad').onclick = () => { sfx.click(); openSquad(); };
$('#act-transfer').onclick = () => { sfx.click(); openTransfer(); };
$('#act-tactic').onclick = () => { sfx.click(); openTactic(); };
$('#act-file').onclick = () => { sfx.click(); renderFile(); };
$('#act-advance').onclick = () => { sfx.click(); advanceWeek(); };

// ---- ファイルの操作 ----
$('#file-new').onclick = () => { sfx.click(); openOpSheet(); };
$('#file-hire').onclick = () => { sfx.click(); openHireSheet(); };
$('#file-money').onclick = () => { sfx.click(); openMoneySheet(); };
$('#file-back').onclick = () => { sfx.click(); renderOffice(); };

// ---- 選手・移籍・戦術(最小限) ----
function openSquad() {
  const rows = S.squad.slice().sort((a, b) => b.ovr - a.ovr).map((p) => `
    <tr><td class="who ${p.injured ? 'dead' : ''}">${esc(p.name)}<small>${p.pos} ・ ${p.age}歳</small></td>
    <td class="grade">${p.ovr}</td><td class="num" style="font-family:var(--f-mono)">${p.injured ? '欠場 ' + p.injured + '週' : '―'}</td></tr>`).join('');
  openSimpleModal(`<h3>選手</h3><div class="lead">${S.squad.length}名。欠場は負傷で試合に出られない。</div>
    <div class="scroll-x"><table class="roster"><thead><tr><th>選手</th><th>総合</th><th>状態</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}
function openTransfer() {
  const inWindow = S.week <= 4;
  const rows = S.market.map((p) => `
    <button class="opt-row" data-buy="${p.id}" ${inWindow && S.money.clean >= p.price ? '' : 'disabled'}>
      <span class="r-n">${esc(p.name)}</span><span class="r-meta">${p.pos} ・ 総合 ${p.ovr} ・ ${esc('€' + p.price + 'k')}</span>
      <span class="r-d">${p.age}歳 ・ 週給 €${p.wage}k</span></button>`).join('');
  openSimpleModal(`<h3>移籍</h3><div class="lead">${inWindow ? '移籍期間は第4週まで。表の資金で買う。' : '移籍期間は終了した(第4週まで)。'}</div>
    <div class="sheet">${rows}</div>`, (modal) => {
    modal.querySelectorAll('.opt-row[data-buy]').forEach((b) => b.onclick = () => {
      if (b.disabled) return;
      const i = S.market.findIndex((x) => x.id === b.dataset.buy);
      const p = S.market[i]; S.money.clean -= p.price;
      S.squad.push({ ...p }); S.market.splice(i, 1);
      sfx.stamp(); closeModal(); renderOffice(); toast(`${p.name}を獲得した。`);
    });
  });
}
function openTactic() {
  const T = { balanced: '均衡', attack: '攻撃的', defend: '堅守', counter: '堅守速攻' };
  const rows = Object.keys(T).map((k) => `<button class="opt-row ${S.tactic === k ? 'sel' : ''}" data-tac="${k}"><span class="r-n">${T[k]}</span></button>`).join('');
  openSimpleModal(`<h3>チーム方針</h3><div class="lead">次の試合の構え。</div><div class="sheet">${rows}</div>`, (modal) => {
    modal.querySelectorAll('.opt-row[data-tac]').forEach((b) => b.onclick = () => { S.tactic = b.dataset.tac; sfx.click(); closeModal(); renderOffice(); toast('方針を変えた。'); });
  });
}

// ---- 遊び方 ----
function openHowto() {
  openSimpleModalDark(`<h3>遊び方</h3>
    <div class="lead" style="text-align:left">
    あなたは二部の没落クラブ US ヴェラルドのオーナー。14節のうちに上位2位に入れば一部へ昇格する。だが、正攻法で勝てる戦力はない。<br><br>
    <b>表</b>では選手・移籍・方針を決め、<b>週を進める</b>と試合がある。<br>
    <b>ファイル(裏)</b>では手駒に工作を命じる。審判の買収、相手主力の買収や負傷、脅迫、裏金作り、そして最後の手段まで。<br><br>
    工作には<b>成算</b>と<b>痕跡</b>がある。痕跡は実行した手駒に残り、4人の追及者(検察・記者・協会・ライバル)が毎週それを拾う。証拠が100に達すると動く。検察が達すれば<b>起訴</b>され、公判は一発勝負。<br><br>
    手駒は忠誠が下がると寝返り、検察の証人になる。危うい手駒は<b>口を封じる</b>こともできる ―― ただし、それもまた痕跡を残す。<br><br>
    勝っても負けても、捕まらずに頂点へ。
    </div>
    <div class="mfoot"><button class="primary" id="howto-ok">閉じる</button></div>`);
  $('#howto-ok').onclick = () => closeModal();
}

// ---- 設定 ----
function openSettings() {
  const row = (label, on, id) => `<button class="opt-row" data-set="${id}"><span class="r-n">${label}</span><span class="r-meta">${on ? 'オン' : 'オフ'}</span></button>`;
  openSimpleModalDark(`<h3>設定</h3><div class="sheet">
    ${row('試合中の介入に制限時間', settings.timer, 'timer')}
    ${row('効果音', settings.sound, 'sound')}
    <button class="opt-row" data-set="wipe"><span class="r-n">セーブを消す</span><span class="r-meta">最初から</span></button>
    <div class="mfoot"><button class="primary" id="set-ok">閉じる</button></div></div>`);
  $$('.opt-row[data-set]').forEach((b) => b.onclick = () => {
    const k = b.dataset.set;
    if (k === 'wipe') { clearSave(); closeModal(); toast('セーブを消した。'); renderTitle(); return; }
    settings[k] = !settings[k]; saveSettings(); if (k === 'sound' && settings.sound) sfx.click(); openSettings();
  });
  $('#set-ok').onclick = () => closeModal();
}

// ---- 汎用モーダル ----
function openSimpleModal(html, after) {
  closeModal();
  const scrim = el('div', 'scrim'); scrim.id = 'scrim';
  const modal = el('div', 'modal', html + '<div class="mfoot"><button class="primary" id="sm-close">閉じる</button></div>');
  scrim.appendChild(modal); document.body.appendChild(scrim);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeModal(); });
  $('#sm-close').onclick = () => closeModal();
  if (after) after(modal);
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
  if ($('#scrim')) return; // モーダル中は各モーダルが処理
  const screen = $$('.screen.on')[0];
  if (!screen) return;
  if (screen.id === 's-office') {
    if (e.key === '1') $('#act-squad').click();
    else if (e.key === '2') $('#act-transfer').click();
    else if (e.key === '3') $('#act-tactic').click();
    else if (e.key === 'f' || e.key === 'F') $('#act-file').click();
    else if (e.key === ' ') { e.preventDefault(); $('#act-advance').click(); }
  } else if (screen.id === 's-file') {
    if (e.key === 'Escape') $('#file-back').click();
  }
});

// ---- 起動 ----
renderTitle();
// オフィス・ファイルの操作バーは常設。state が無い間は押されない。
