// 工作:成功率の算定、発注、週送り時の解決、痕跡、報告書
// すべて架空のサッカー経営ゲームの内部処理。結果は数値とテキストで表す。
import { OPS, SUCCESSORS } from './data.js';
import { S, rand, rint, pick, clamp, club, fixtureFor, refFor, pursuer, operative, opName, personByKey, nextId, addNews } from './state.js';

export function opAllowed(type, o) {
  return OPS[type].roles.includes(o.role);
}

// この工作で選べる対象の一覧を返す({key, label})
export function targetsFor(type) {
  const d = OPS[type];
  const fx = fixtureFor(S.week);
  const out = [];
  if (d.target === 'ref') {
    const r = refFor(S.week);
    if (r && r.alive) out.push({ key: 'ref:' + r.id, label: `${r.name}(次節の主審)` });
  } else if (d.target === 'oppPlayer') {
    if (fx) for (const k of club(fx.opp).keys) if (k.alive && !k.injured) out.push({ key: 'kp:' + k.id, label: `${k.name}(${club(fx.opp).short} ${k.role})` });
  } else if (d.target === 'oppClub') {
    if (fx) out.push({ key: 'club:' + fx.opp, label: `${club(fx.opp).ja}(次節の相手)` });
  } else if (d.target === 'pursuer') {
    for (const p of S.pursuers) if (p.alive) out.push({ key: 'pur:' + p.id, label: `${p.name} / ${p.org}` });
  } else if (d.target === 'own') {
    for (const o of S.operatives) if (o.alive && !o.defected) out.push({ key: 'own:' + o.id, label: `${opName(o)}(${o.note})` });
  } else if (d.target === 'person') {
    for (const p of S.pursuers) if (p.alive) out.push({ key: 'pur:' + p.id, label: `${p.name} / ${p.org}` });
    for (const r of S.referees) if (r.alive) out.push({ key: 'ref:' + r.id, label: `${r.name}(審判)` });
    if (fx) for (const k of club(fx.opp).keys) if (k.alive) out.push({ key: 'kp:' + k.id, label: `${k.name}(${club(fx.opp).short})` });
  } else if (d.target === 'leverage') {
    for (const key of Object.keys(S.leverage)) {
      const p = personByKey(key);
      if (p && p.alive) out.push({ key, label: `${p.name}(弱みを握っている)` });
    }
  }
  return out;
}

// 成功率(0-100)。対象・担当・状況で補正
export function successChance(type, operativeObj, targetKey) {
  const d = OPS[type];
  let base = d.base;
  if (d.target === 'none' && type !== 'bet') return Math.round(base + (operativeObj.skill - 3) * 6);
  if (type === 'buy_pursuer') {
    const p = pursuer(targetKey.split(':')[1]);
    base = p ? p.buyable : 20;
  }
  let c = base + (operativeObj.skill - 3) * 7;
  if (type === 'ref_bribe') { const r = refFor(S.week); if (r) c = (100 - r.integrity) + (operativeObj.skill - 3) * 6; }
  if (targetKey) {
    const person = personByKey(targetKey);
    if (person && S.leverage[targetKey]) c += 18; // 弱みを握っていれば通りやすい
    if (person && person.type === 'pur' && person.obj.flags.warned) c += 12;
  }
  return clamp(Math.round(c), 3, 97);
}

export function traceChance(type, operativeObj) {
  const d = OPS[type];
  // 口の堅さが低いほど痕跡が残りやすい
  const base = d.trace.size * 7;
  const disc = (operativeObj.discretion - 55) * 0.5;
  return clamp(Math.round(base + 20 - disc), 0, 95);
}

// 発注:進行中リストに積む
export function orderOp(type, operativeObj, targetKey) {
  const d = OPS[type];
  if (d.cost > 0) S.money.black -= d.cost;
  if (type === 'skim') { /* 解決時に加算 */ }
  operativeObj.busy = type;
  const op = {
    id: nextId('op'),
    type, name: d.name,
    operativeId: operativeObj.id,
    operativeName: opName(operativeObj),
    target: targetKey || null,
    cost: d.cost,
    weeksLeft: d.weeks,
    chance: successChance(type, operativeObj, targetKey),
    traceP: traceChance(type, operativeObj),
  };
  S.ops.push(op);
  return op;
}

// 週送り:進行中の工作を1週進め、満了したものを解決する。report 配列を返す。
export function resolveOps() {
  const reports = [];
  const remaining = [];
  for (const op of S.ops) {
    op.weeksLeft--;
    if (op.weeksLeft > 0) { remaining.push(op); continue; }
    reports.push(executeOp(op));
  }
  S.ops = remaining;
  return reports;
}

function addTrace(op, opDef) {
  if (opDef.trace.size <= 0) return null;
  if (rand() * 100 > op.traceP) return null;
  const o = operative(op.operativeId);
  const t = { id: nextId('tr'), op: op.type, opName: opDef.name, operativeId: op.operativeId, operativeName: op.operativeName, kind: opDef.trace.kind, size: opDef.trace.size, week: S.week, found: {} };
  S.traces.push(t);
  return t;
}

function executeOp(op) {
  const d = OPS[op.type];
  const o = operative(op.operativeId);
  const roll = rand() * 100;
  const ok = roll < op.chance;
  const twist = ok && rand() < 0.14; // 小さな想定外
  const r = { id: op.id, type: op.type, name: d.name, operative: op.operativeName, ok, twist: false, text: '', trace: null, cat: d.cat };
  const m = S.mods;

  switch (op.type) {
    case 'ref_bribe': {
      const rf = refFor(S.week);
      if (ok) { m.refCalls += 1; m.refBy = rf ? rf.name : '主審'; if (rf) rf.owned = 2; S.stats.bribes++; r.text = `${op.operativeName}が${rf ? rf.name : '主審'}に話をつけた。次の試合、際どい判定を一度こちらに傾けられる。`; }
      else r.text = `${rf ? rf.name : '主審'}は金を受け取らなかった。話は無かったことにされた。`;
      break;
    }
    case 'player_bribe': {
      const k = personByKey(op.target);
      if (ok && k) { k.obj.bribed = true; m.oppWeak += 6; m.oppWeakNames.push(k.name); r.text = `${k.name}は金を受け取った。次の試合、動きが鈍る。`; }
      else r.text = `買収は成立しなかった。${k ? k.name : '相手'}は乗ってこない。`;
      break;
    }
    case 'fix_match': {
      if (ok) { m.fixed = true; r.text = `相手クラブと話がついた。次の試合は、よほどのことがない限りこちらが勝つ。`; }
      else r.text = `談合は流れた。相手の内部で話がまとまらなかったようだ。`;
      break;
    }
    case 'bet': {
      m.bet = ok ? op.cost : 0;
      r.text = ok ? `次の試合のこちらの勝ちに ${fmtMoney(op.cost)} を賭けた。勝てば戻る。` : `胴元が賭けを受けなかった。金は戻した。`;
      if (!ok) S.money.black += op.cost;
      break;
    }
    case 'dig': {
      const p = personByKey(op.target);
      if (ok && p) {
        let text = '';
        if (p.type === 'pur') text = p.obj.weakness;
        else if (p.type === 'ref') text = p.obj.weakness;
        else text = `${p.name}には金に困った親類がいる。付け入る隙はある。`;
        S.leverage[op.target] = { text, week: S.week };
        r.text = `${p.name}の弱みをつかんだ ―― ${text}`;
      } else r.text = `${p ? p.name : '対象'}の弱みは、今のところ見つからなかった。`;
      break;
    }
    case 'blackmail': {
      const p = personByKey(op.target);
      if (ok && p) {
        if (p.type === 'pur') { p.obj.evidence = clamp(p.obj.evidence - rint(18, 30), 0, 100); p.obj.quiet = 2; p.obj.flags.blackmailed = true; r.text = `${p.name}は口をつぐんだ。握っていた証拠の一部を手放した。だが、恨みは残った。`; }
        else if (p.type === 'ref') { p.obj.owned = 3; r.text = `${p.name}は逆らえない。今後この審判が担当する試合では判定が傾く。`; }
        else r.text = `${p.name}は言うことを聞いた。`;
      } else r.text = `脅しは効かなかった。${p ? p.name : '相手'}は動じない。`;
      break;
    }
    case 'buy_pursuer': {
      const p = personByKey(op.target);
      if (ok && p) { p.obj.evidence = clamp(p.obj.evidence - rint(20, 35), 0, 100); p.obj.quiet = 3; r.text = `${p.name}は金で手を引いた。しばらくは静かになる。`; }
      else r.text = `${p ? p.name : '相手'}は金を突き返した。むしろこちらを疑っている。`;
      if (ok && p && p.type === 'pur' && p.obj.kind === 'pros') { p.obj.evidence = clamp(p.obj.evidence + 8, 0, 100); r.text = `検察は金を受け取らなかった。贈賄の事実が、新たな証拠になった。`; r.ok = false; }
      break;
    }
    case 'skim': {
      if (ok) { const g = rint(40, 90); S.money.black += g; S.money.clean -= Math.round(g * 0.3); r.text = `入場料と物販から ${fmtMoney(g)} を抜いた。帳簿上は目立たない。`; }
      else r.text = `今週は抜けなかった。経理に新しい担当者が入っている。`;
      break;
    }
    case 'launder': {
      if (S.money.black < 200) { r.ok = false; r.text = `裏金が ${fmtMoney(200)} に足りず、洗浄できなかった。`; break; }
      if (ok) { S.money.black -= 200; S.money.clean += 170; r.text = `裏金 ${fmtMoney(200)} を架空のスポンサー料として表に戻した。手数料を引いて ${fmtMoney(170)}。`; }
      else { S.money.black -= 40; r.text = `送金が途中で止められた。手数料 ${fmtMoney(40)} だけが消えた。`; }
      break;
    }
    case 'cook_books': {
      if (ok) { S.money.deferred = true; S.money.dueWeek = 14; r.text = `帳簿を書き換え、債権団への返済期限を第14週まで先送りさせた。`; }
      else r.text = `監査法人が数字の不一致に気づいた。先送りは認められなかった。`;
      break;
    }
    case 'warn': {
      const p = personByKey(op.target);
      if (ok && p) {
        if (p.type === 'pur') { p.obj.quiet = 2; p.obj.flags.warned = true; r.text = `${p.name}の身辺に「挨拶」をしておいた。しばらく手が止まり、次の話が通りやすくなる。`; }
        else r.text = `${p.name}は震え上がった。しばらくは大人しい。`;
      } else r.text = `警告は空振りに終わった。${p ? p.name : '相手'}は意に介さない。`;
      break;
    }
    case 'injure': {
      const p = personByKey(op.target);
      if (ok && p && p.obj) { const w = rint(2, 5); p.obj.injured = w; if (p.club) { const c = club(p.club); if (c) c.morale -= 4; } r.text = `${p.name}は全治${w}週。次の試合には出られない。`; }
      else r.text = `仕掛けは不発。${p ? p.name : '対象'}は無傷だ。`;
      break;
    }
    case 'kill': {
      const p = personByKey(op.target);
      if (ok && p) {
        p.obj.alive = false; S.stats.killed++;
        // 対象が握っていた痕跡は消えない(第三者の証言は残る)が、対象自身の追及は止まる
        if (p.type === 'pur') { p.obj.evidence = 0; p.obj.quiet = 99; r.text = `${p.name}の件は片付いた。追及は止まった。だが、空いた席にはいずれ別の人間が座る。`; respawnPursuer(p.obj); }
        else if (p.type === 'own') { r.text = `${p.name}は消えた。`; }
        else { r.text = `${p.name}の件は片付いた。`; }
      } else r.text = `仕損じた。対象は無事で、こちらの動きに気づいた。`;
      break;
    }
    case 'silence': {
      const o2 = operative(op.target.split(':')[1]);
      if (ok && o2) {
        o2.alive = false;
        // その手駒に紐づく痕跡を消す
        S.traces = S.traces.filter((t) => t.operativeId !== o2.id);
        r.text = `${opName(o2)}は消えた。あの男が知っていたこと、証言できたことも、一緒に消えた。`;
      } else { r.text = `仕損じた。${o2 ? opName(o2) : '手駒'}は逃げ、何もかもを抱えたまま姿をくらました。`; if (o2) o2.defected = true; }
      break;
    }
    case 'guard': {
      m.guard = true; r.text = `今週はオーナーの周りを固めた。`;
      break;
    }
    default: r.text = ok ? '成功した。' : '失敗した。';
  }

  if (r.ok) S.stats.opsDone++;
  r.trace = addTrace(op, d);
  if (o) o.busy = null;
  // 荒事で手駒の忠誠が揺れることがある
  if (d.cat === '暴力' && o && rand() < 0.3) { o.loyalty = clamp(o.loyalty - rint(3, 8), 0, 100); }
  return r;
}

function respawnPursuer(p) {
  const names = SUCCESSORS[p.kind] || ['後任'];
  p.gen = (p.gen || 0) + 1;
  p.name = names[Math.min(p.gen - 1, names.length - 1)];
  p.aggr = (p.aggr || 1) + 0.4; // より強硬に
  p.alive = true;
  p.quiet = 2;
  p.flags = {};
  addNews(`${p.org}に新しい担当 ―― ${p.name}。前任者の失踪を受け、姿勢を強めるとみられる`, p.kind);
}

const fmtMoney = (k) => '€' + (k >= 1000 ? (k / 1000).toFixed(2) + 'M' : Math.round(k) + 'k');
