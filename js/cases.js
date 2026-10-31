// 案件(ドシエ)の定義。
// 毎週、状況に応じて数件がデスクに届く。プレイヤーは各案件で一つの道を選ぶ。
//
// 効果(eff)の語彙 ― engine.js が解釈する:
//   {black:n} {clean:n}                 裏金 / 表の資金(千ユーロ、増減)
//   {ev:{who, d}}                       追及者の証拠 who=press|pros|ethics|rival|all
//   {trace:{kind,size}}                 痕跡(kind=money|people|match|violence)。担当手駒に紐づく
//   {oppWeaken:n}                       次節の相手を弱らせる
//   {refRig:1}                          次節で際どい判定を一度取れる
//   {fixMatch:1}                        次節の勝ちをほぼ確定
//   {injureOpp:w}                       次節の相手主力を w 週欠場させる
//   {morale:n} {supporters:n}           チーム状態 / 支持
//   {loyalty:n}                         担当手駒の忠誠
//   {flag:'x'} {unflag:'x'}             物語フラグ
//   {thread:{id,step}}                  筋を次の段へ
//   {schedule:{caseId,in}}              in 週後に案件を発火
//   {news:['text','kind']}              新聞・速報に載せる
//   {heat:n}                            オーナー自身の危険度
//   {leverage:'key'}                    弱みを握る(key: ref/press/pros/...)
//
// choices[].need で選べる条件を絞る: {role, clean, black, flag, leverage}
// choices[].risk があれば確率判定。onOk/onFail に分岐。無ければ確定(eff/text)。

// 状況に応じて差し込む語を解決するためのコンテキストは engine が渡す(ctx)。

export const CASES = {

  // ============ 導入(最初の数週、ブラスキが手ほどき) ============
  intro_welcome: {
    once: true, from: 'オッターヴィオ・ブラスキ', tag: '面談',
    title: 'ようこそ、オーナー',
    body: (ctx) => `ブラスキが応接室で待っていた。「US ヴェラルドへようこそ。はっきり言います ―― このクラブの戦力では、二部で4位がやっとだ。昇格はできない。\n\n正攻法では。\n\nあなたが望むなら、私が窓口になる。審判、選手、記者、必要ならもっと際どいことも。ただし、やるたびに痕跡が残る。拾う連中もいる。まずは、あなたがどういう人かを知りたい。」`,
    choices: [
      { id: 'a', label: '「勝てるなら手段は選ばない」', desc: 'ブラスキはうなずく。裏の予算に少し色をつける。', eff: [{ black: 60 }, { flag: 'ruthless' }], text: '「そう来なくては。手は尽くしましょう。」裏金に €60k を回した。' },
      { id: 'b', label: '「まずは様子を見たい」', desc: '慎重に始める。追及者の目は緩い。', eff: [{ ev: { who: 'all', d: -3 } }], text: '「結構。ですが、二部は待ってはくれません。」' },
    ],
  },

  // ============ 審判 ============
  ref_debt: {
    weight: 3, from: 'ミレーナ・ヴォルピ', tag: '調査', needMatch: true,
    title: (ctx) => `次節の主審 ${ctx.refName}`,
    body: (ctx) => `ヴォルピが薄い封筒を置いた。「次節の主審、${ctx.refName}。調べました。違法賭博で二万ユーロの借金がある。奥さんは知らない。\n\n金を渡せば、際どいところはこちらに転ぶでしょう。もっとも、こういう金は匂う。」`,
    choices: [
      { id: 'pay', label: `${'謝礼を渡す'}(€40k 裏金)`, desc: '次の試合、際どい判定を一度こちらへ。痕跡が残りうる。', need: { black: 40 }, assign: 'broker',
        risk: (ctx, o) => 60 + o.skill * 6,
        onOk: { eff: [{ black: -40 }, { refRig: 1 }, { trace: { kind: 'match', size: 2 } }, { stat: 'bribes' }], text: (ctx) => `${ctx.refName}は封筒を上着にしまった。次の試合、笛はこちらを見る。` },
        onFail: { eff: [{ black: -40 }, { ev: { who: 'ethics', d: 6 } }], text: (ctx) => `${ctx.refName}は金を受け取らなかった。協会に相談した気配がある。` } },
      { id: 'lev', label: '借金を握り、脅す', desc: '金は要らない。だが相手は恨む。痕跡は人の噂に残る。', assign: 'investigator',
        risk: (ctx, o) => 70 + o.skill * 5,
        onOk: { eff: [{ refRig: 1 }, { trace: { kind: 'people', size: 1 } }, { leverage: 'refX' }], text: (ctx) => `${ctx.refName}は青ざめ、黙ってうなずいた。` },
        onFail: { eff: [{ ev: { who: 'ethics', d: 8 } }], text: () => `脅しは裏目に出た。相手は協会に駆け込んだ。` } },
      { id: 'skip', label: '何もしない', desc: '正々堂々と戦う。', eff: [], text: () => '封筒は燃やした。今節は、笛に頼らない。' },
    ],
  },

  ref_clean: {
    weight: 1, from: 'ミレーナ・ヴォルピ', tag: '調査', needMatch: true,
    title: (ctx) => `次節の主審 ${ctx.refName}`,
    body: (ctx) => `「次の主審 ${ctx.refName} は堅物です。賭博も女も借金もない。娘が首都の大学に通っているくらい。\n\n正攻法では転ばせられません。やるなら娘のほうですが ―― そこまでやりますか。」`,
    choices: [
      { id: 'daughter', label: '娘を使って揺さぶる', desc: '効けば大きい。だが人の噂に濃い痕跡。記者が嗅ぎつける。', need: { flag: 'ruthless' }, assign: 'muscle',
        risk: () => 55,
        onOk: { eff: [{ refRig: 1 }, { trace: { kind: 'people', size: 3 } }, { ev: { who: 'press', d: 4 } }], text: (ctx) => `${ctx.refName}は震える手で笛を受け取った。やりすぎた、という感触が残る。` },
        onFail: { eff: [{ ev: { who: 'press', d: 10 } }, { ev: { who: 'pros', d: 6 } }], text: () => '相手は激怒し、記者に駆け込んだ。最悪の手だった。' } },
      { id: 'skip', label: '手を出さない', desc: 'この審判は諦める。', eff: [], text: () => 'この男は無理だ。別の試合で取り返す。' },
    ],
  },

  // ============ 相手クラブ・選手 ============
  opp_star: {
    weight: 3, from: 'オッターヴィオ・ブラスキ', tag: '次節', needMatch: true, needOppStar: true,
    title: (ctx) => `${ctx.oppName}の${ctx.starRole} ${ctx.starName}`,
    body: (ctx) => `「次節の相手 ${ctx.oppName}。厄介なのは${ctx.starRole}の${ctx.starName}一人です。こいつさえ消せれば、相手はただのチームになる。\n\nやり方は、金か、鉄か。」`,
    choices: [
      { id: 'bribe', label: `買収して手を抜かせる(€60k 裏金)`, desc: '試合の中盤、明らかに足が止まる。試合の不自然さが残る。', need: { black: 60 }, assign: 'broker',
        risk: (ctx, o) => 55 + o.skill * 6,
        onOk: { eff: [{ black: -60 }, { oppWeaken: 7 }, { trace: { kind: 'match', size: 3 } }], text: (ctx) => `${ctx.starName}は金を受け取った。次の試合、あの男は走らない。` },
        onFail: { eff: [{ black: -60 }, { ev: { who: 'rival', d: 6 } }], text: (ctx) => `${ctx.starName}は鼻で笑って断った。相手のオーナーに伝わったかもしれない。` } },
      { id: 'injure', label: '練習場で「事故」に遭わせる', desc: '数週間、試合に出られなくなる。暴力の痕跡は濃い。', need: { flag: 'ruthless' }, assign: 'muscle',
        risk: (ctx, o) => 60 + o.skill * 5,
        onOk: { eff: [{ injureOpp: 3 }, { trace: { kind: 'violence', size: 4 } }, { ev: { who: 'press', d: 3 } }, { news: ['{opp}の{star}、練習中に負傷 全治3週', 'misc'] }], text: (ctx) => `${ctx.starName}は担架で運ばれた。しばらく戻らない。` },
        onFail: { eff: [{ trace: { kind: 'violence', size: 2 } }, { ev: { who: 'pros', d: 8 } }], text: () => '仕掛けは失敗し、目撃者が残った。' } },
      { id: 'skip', label: '正面から当たる', desc: '小細工なし。', eff: [], text: (ctx) => `${ctx.starName}は止められない。それでもやるしかない。` },
    ],
  },

  opp_fix: {
    weight: 1, from: 'オッターヴィオ・ブラスキ', tag: '次節', needMatch: true, needWeakOpp: true,
    title: (ctx) => `${ctx.oppName}と話がつく`,
    body: (ctx) => `「次節の ${ctx.oppName}、あそこのオーナーも金に困っている。試合ごと買えますよ。勝ちはほぼ確定だ。\n\nただ、八百長は一番匂う。協会の倫理委員会がこういう試合を見ている。」`,
    choices: [
      { id: 'fix', label: `試合を買う(€250k 裏金)`, desc: '勝ちがほぼ確定。試合の不自然さに大きな痕跡。', need: { black: 250 }, assign: 'broker',
        risk: (ctx, o) => 50 + o.skill * 6,
        onOk: { eff: [{ black: -250 }, { fixMatch: 1 }, { trace: { kind: 'match', size: 6 } }], text: (ctx) => `${ctx.oppName}と話がついた。あとは勝つだけだ。` },
        onFail: { eff: [{ black: -250 }, { ev: { who: 'ethics', d: 12 } }], text: () => '談合は流れ、噂だけが残った。' } },
      { id: 'skip', label: 'やめておく', desc: '危険すぎる。', eff: [], text: () => 'この手は、ここぞという時まで取っておく。' },
    ],
  },

  // ============ 財務 ============
  fin_skim: {
    weight: 2, from: 'ラウル・セガーラ', tag: '会計',
    title: () => '入場料をいくらか抜けます',
    body: (ctx) => `セガーラが帳簿を広げた。「今節はホーム。入場料と物販が入ります。いくらか抜いて、裏の金庫に回せますよ。\n\n帳簿は私がうまく書きます。ただ、こういうのは検察が一番好む餌だ。」`,
    choices: [
      { id: 'skim', label: '抜く', desc: '裏金が増える。金の流れに痕跡。', assign: 'accountant',
        risk: (ctx, o) => 75 + o.skill * 5,
        onOk: { eff: [{ black: 70 }, { clean: -20 }, { trace: { kind: 'money', size: 3 } }], text: () => '€70k を裏に回した。帳簿上は目立たない。' },
        onFail: { eff: [{ ev: { who: 'pros', d: 8 } }], text: () => '新しい経理担当が数字に気づいた。危なかった。' } },
      { id: 'skip', label: '今回は正直に', desc: '表の資金が入る。', eff: [{ clean: 90 }], text: () => '入場料はそのまま金庫へ。€90k。' },
    ],
  },

  fin_debt: {
    once: true, from: '債権団', tag: '督促', atWeek: 8,
    title: () => '返済期限が近い',
    body: (ctx) => `港湾公社系の債権団から書面が届いた。「第10週までに €1.20M の返済を。滞れば差し押さえもあり得る」。\n\n表の金庫にそれだけの余裕はない。セガーラは帳簿を書き換えて先送りできると言うが、粉飾は重い罪だ。`,
    choices: [
      { id: 'cook', label: '帳簿を書き換えて先送り', desc: '返済期限を第14週へ。金の流れに大きな痕跡。', assign: 'accountant',
        risk: (ctx, o) => 60 + o.skill * 6,
        onOk: { eff: [{ flag: 'debtDeferred' }, { trace: { kind: 'money', size: 5 } }], text: () => '監査をくぐり抜けた。返済は第14週まで延びた。' },
        onFail: { eff: [{ ev: { who: 'pros', d: 14 } }], text: () => '監査法人が不一致に気づいた。先送りは認められず、検察の関心を買った。' } },
      { id: 'pay_plan', label: '洗浄して返済に充てる', desc: '裏金を表に戻して備える。手数料がかかる。', need: { black: 200 }, assign: 'accountant',
        risk: () => 85,
        onOk: { eff: [{ black: -200 }, { clean: 170 }, { trace: { kind: 'money', size: 2 } }], text: () => '裏金 €200k を架空のスポンサー料として表に。返済の目処が立つ。' },
        onFail: { eff: [{ black: -40 }], text: () => '送金が止められ、手数料だけ消えた。' } },
      { id: 'ignore', label: '放っておく', desc: '第10週に表の資金から返す(足りなければ破産)。', eff: [], text: () => '期限まで、まだ時間はある。' },
    ],
  },

  // ============ 追及者(記者) ============
  press_sniff: {
    thread: 'press', step: 1, from: 'ミレーナ・ヴォルピ', tag: '警告',
    title: () => '記者アルシが動いている',
    body: (ctx) => `「日刊イル・ファーロのアルシという記者。クラブの周りを嗅ぎ回っています。まだ確証はつかんでいませんが、情報源がクラブ内部にいる。\n\n放っておくと、いずれ記事になります。」`,
    choices: [
      { id: 'dig', label: 'アルシの情報源を洗う', desc: '相手の弱みをつかめば、後で止められる。', assign: 'investigator',
        risk: (ctx, o) => 70 + o.skill * 5,
        onOk: { eff: [{ leverage: 'press' }, { thread: { id: 'press', step: 2 } }], text: () => '情報源は経理部員のカルラ・ノーチェ。旧市街のバールで週に一度、アルシと会っている。これは使える。' },
        onFail: { eff: [{ ev: { who: 'press', d: 5 } }], text: () => '尾行に勘づかれた。アルシは警戒を強めた。' } },
      { id: 'buy', label: '金で黙らせる(€120k 裏金)', desc: '一時的に手を引かせる。', need: { black: 120 }, assign: 'broker',
        risk: () => 55,
        onOk: { eff: [{ black: -120 }, { ev: { who: 'press', d: -25 } }], text: () => 'アルシは金を受け取った。しばらくは静かになる。だが、金で買った沈黙は、金で破れる。' },
        onFail: { eff: [{ black: -120 }, { ev: { who: 'press', d: 10 } }], text: () => 'アルシは金を突き返し、むしろ確信を深めた。' } },
      { id: 'skip', label: '様子を見る', desc: '今は動かない。', eff: [{ ev: { who: 'press', d: 3 } }], text: () => 'アルシは取材を続けている。' },
    ],
  },

  press_source: {
    thread: 'press', step: 2, from: 'ミレーナ・ヴォルピ', tag: '報道',
    title: () => '記者の情報源をつかんだ',
    body: (ctx) => `「アルシの情報源、経理部員のカルラ・ノーチェ。彼女を押さえれば、アルシは手足をもがれる。\n\n穏便に辞めさせるか。脅すか。それとも ―― 」`,
    choices: [
      { id: 'fire', label: '理由をつけて解雇する', desc: '穏当。だがアルシは別の情報源を探す。', eff: [{ ev: { who: 'press', d: -12 } }, { thread: { id: 'press', step: 3 } }], text: () => 'ノーチェは私物をまとめて出ていった。アルシの記事は当分書けない。' },
      { id: 'threaten', label: 'ノーチェを脅す', desc: '沈黙させる。暴力の痕跡。', need: { flag: 'ruthless' }, assign: 'muscle',
        risk: (ctx, o) => 70 + o.skill * 4,
        onOk: { eff: [{ ev: { who: 'press', d: -20 } }, { trace: { kind: 'violence', size: 3 } }, { thread: { id: 'press', step: 3 } }], text: () => 'ノーチェは怯え、口をつぐんだ。アルシは情報を失った。' },
        onFail: { eff: [{ ev: { who: 'press', d: 15 } }, { ev: { who: 'pros', d: 8 } }], text: () => 'ノーチェは怯えて警察に相談した。かえって火に油を注いだ。' } },
      { id: 'skip', label: '泳がせる', desc: '今は使わない。', eff: [], text: () => '情報源は押さえた。いつでも切れる。' },
    ],
  },

  // ============ 追及者(ライバル) ============
  rival_provoke: {
    thread: 'rival', step: 1, from: 'ミレーナ・ヴォルピ', tag: 'リーグ',
    title: (ctx) => `${ctx.rivalName}が騒いでいる`,
    body: (ctx) => `「セッラーヴォのオーナー、${ctx.rivalName}。うちの審判の件に気づいて、リーグで騒ぎ始めました。あの男自身、愛人に別荘をクラブの金で買っている ―― 叩けば埃が出る。\n\n先に潰すか、泳がせるか。」`,
    choices: [
      { id: 'counter', label: '別荘の件をリークする', desc: 'ライバルの信用を落とし、申し立てを鈍らせる。', assign: 'investigator',
        risk: () => 65,
        onOk: { eff: [{ ev: { who: 'rival', d: -20 } }, { news: ['{rival}オーナーに公私混同の疑惑', 'rival'] }, { thread: { id: 'rival', step: 2 } }], text: (ctx) => `${ctx.rivalName}の別荘の件が週刊誌に出た。当分、人のことを言える立場ではない。` },
        onFail: { eff: [{ ev: { who: 'rival', d: 10 } }], text: () => 'リークは相手にたどられた。かえって敵意を煽った。' } },
      { id: 'skip', label: '無視する', desc: '相手の証拠が少し増える。', eff: [{ ev: { who: 'rival', d: 5 } }], text: (ctx) => `${ctx.rivalName}は申し立てを続けている。` },
    ],
  },

  // ============ 手駒 ============
  op_drink: {
    weight: 1, from: 'オッターヴィオ・ブラスキ', tag: '身内', needDrinker: true,
    title: () => 'セガーラの酒がひどい',
    body: (ctx) => `「会計士のセガーラ。酒がひどくなっている。酔うと口が軽い。先日もバールで、うちの帳簿のことを大声で話していたとか。\n\n口の堅さが落ちてきている。今のうちに手を打つか。」`,
    choices: [
      { id: 'rehab', label: '金を渡して休ませる(€30k 裏金)', desc: '口の堅さが戻る。忠誠も上がる。', need: { black: 30 }, eff: [{ black: -30 }, { fixDiscretion: 'accountant' }, { loyaltyRole: { role: 'accountant', d: 10 } }], text: () => 'セガーラは療養に入った。戻れば、また使える。' },
      { id: 'warn', label: '脅して黙らせる', desc: '口は堅くなるが、忠誠は下がる。', eff: [{ fixDiscretion: 'accountant' }, { loyaltyRole: { role: 'accountant', d: -15 } }], text: () => 'セガーラは震え上がった。当分、酒場で口は滑らせまい。だが、こちらを見る目が変わった。' },
      { id: 'skip', label: '放っておく', desc: '危険だが、今は手が回らない。', eff: [{ ev: { who: 'pros', d: 4 } }], text: () => 'セガーラは今夜もバールにいる。' },
    ],
  },

  // ============ 汎用(状況が静かなとき) ============
  quiet_board: {
    weight: 1, filler: true, from: '理事会', tag: 'クラブ',
    title: () => '理事会が結果を求めている',
    body: (ctx) => `理事長が電話をよこした。「順位は${ctx.pos}位。悪くはないが、昇格には足りない。サポーターも苛立ち始めている。何か手は打っているのかね」。`,
    choices: [
      { id: 'promise', label: '「結果で示す」と答える', desc: '余計なことは言わない。', eff: [], text: () => '電話を切った。言葉より、順位表だ。' },
      { id: 'invest', label: '私財をクラブに入れる(€150k 表)', desc: '支持と士気が上がる。', need: { clean: 150 }, eff: [{ clean: -150 }, { supporters: 6 }, { morale: 3 }], text: () => 'クラブに €150k を注入した。サポーターは沸いた。' },
    ],
  },

  quiet_scout: {
    weight: 1, filler: true, from: '強化部', tag: 'クラブ',
    title: () => '若手の報告',
    body: (ctx) => `強化部から報告。「ユースにイラーリという19歳の点取り屋がいます。使えば伸びる。ただ、今の布陣では出場機会がない」。`,
    choices: [
      { id: 'promote', label: '試合で使っていく', desc: '士気が少し上がる。', eff: [{ morale: 4 }], text: () => 'イラーリをベンチに入れた。若い力は、流れを変える。' },
      { id: 'skip', label: '今はベテランで', desc: '堅実に。', eff: [], text: () => 'まだ早い。経験を積ませる。' },
    ],
  },
};

// 連続した筋の宣言(開始週・発火条件)
export const THREADS = {
  press: { start: 3 },   // 記者の調査は第3週から
  rival: { needRivalHeat: 25 }, // ライバルの証拠が溜まると
};
