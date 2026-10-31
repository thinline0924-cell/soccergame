// 固定データ:クラブ、選手、審判、手駒、追及者、工作の定義

export const SEASON_WEEKS = 14;
export const TRANSFER_WINDOW_END = 4;
export const DEBT_DUE_WEEK = 10;
export const DEBT_DUE_AMOUNT = 1200; // 単位:千ユーロ

export const CLUBS = [
  { id: 'VEL', name: 'US VELARDO', ja: 'US ヴェラルド', short: 'VEL', color: '#ECEAE4', str: 0, stadium: 'ストラーダ競技場', owner: null, dirty: false },
  { id: 'SER', name: 'AC SERRAVO', ja: 'AC セッラーヴォ', short: 'SER', color: '#3C6FB0', str: 66, stadium: 'カンポ・ルンゴ', owner: 'L. ダレッサンドロ', dirty: true },
  { id: 'COR', name: 'REAL CORVENA', ja: 'レアル・コルヴェナ', short: 'COR', color: '#C9A227', str: 67, stadium: 'エスタディオ・ミラドール', owner: 'H. コルデロ', dirty: false },
  { id: 'LIV', name: 'PRO LIVERNO', ja: 'プロ・リヴェルノ', short: 'LIV', color: '#7A2E3A', str: 61, stadium: 'スタディオ・ポルタ', owner: 'G. ファンティ', dirty: true },
  { id: 'SAL', name: 'CD SALMORA', ja: 'CD サルモーラ', short: 'SAL', color: '#2F7D5B', str: 58, stadium: 'ラ・サリーナ', owner: 'P. イバーラ', dirty: false },
  { id: 'ARA', name: 'SPORTING ARAVE', ja: 'スポルティング・アラーヴェ', short: 'ARA', color: '#C76A2B', str: 56, stadium: 'カンポ・ヌエボ', owner: 'M. ソレル', dirty: false },
  { id: 'MER', name: 'AS MERIDIA', ja: 'AS メリディア', short: 'MER', color: '#8E9AA8', str: 52, stadium: 'スタディオ・ソーレ', owner: 'R. ネッリ', dirty: false },
  { id: 'TOR', name: 'CALCIO TORBENA', ja: 'カルチョ・トルベーナ', short: 'TOR', color: '#5A4E8C', str: 47, stadium: 'カンポ・ヴェッキオ', owner: 'E. トルナ', dirty: false },
];

// 他クラブの主力(工作の対象になる)
export const KEY_PLAYERS = {
  SER: [
    { name: 'コルヴィーノ', pos: 'MF', role: '主将', ovr: 72 },
    { name: 'ボッロ', pos: 'FW', role: '得点源', ovr: 70 },
  ],
  COR: [
    { name: 'アルマンサ', pos: 'FW', role: '得点源', ovr: 73 },
    { name: 'ベニーテス', pos: 'GK', role: '守護神', ovr: 70 },
  ],
  LIV: [
    { name: 'カッシーナ', pos: 'MF', role: '司令塔', ovr: 68 },
    { name: 'リーヴァ', pos: 'DF', role: '主将', ovr: 65 },
  ],
  SAL: [
    { name: 'オテロ', pos: 'FW', role: '得点源', ovr: 66 },
    { name: 'パストール', pos: 'DF', role: '主将', ovr: 62 },
  ],
  ARA: [
    { name: 'ガリンド', pos: 'MF', role: '司令塔', ovr: 63 },
    { name: 'ミランダ', pos: 'GK', role: '守護神', ovr: 61 },
  ],
  MER: [
    { name: 'サンナ', pos: 'FW', role: '得点源', ovr: 60 },
    { name: 'ルッフォ', pos: 'MF', role: '主将', ovr: 57 },
  ],
  TOR: [
    { name: 'ヴォルタ', pos: 'FW', role: '得点源', ovr: 55 },
    { name: 'ギッリ', pos: 'DF', role: '主将', ovr: 52 },
  ],
};

// 自クラブの選手(ovr は総合力、wage は週給・千ユーロ)
export const SQUAD = [
  ['チェルヴィ', 'GK', 31, 60, 7],
  ['ロンバ', 'GK', 22, 50, 2],
  ['マルケッティ', 'DF', 29, 61, 7],
  ['オッサーナ', 'DF', 33, 59, 6],
  ['ファルコ', 'DF', 26, 57, 5],
  ['デ・ルーカ', 'DF', 24, 56, 4],
  ['サンドリ', 'DF', 30, 54, 4],
  ['ペーニャ', 'DF', 21, 51, 2],
  ['ドゥッチ', 'MF', 32, 62, 9],
  ['ヴァレーリ', 'MF', 27, 60, 7],
  ['アルベルティ', 'MF', 25, 58, 5],
  ['コスタ', 'MF', 28, 56, 5],
  ['ジーノ', 'MF', 23, 54, 3],
  ['モレッリ', 'MF', 20, 50, 2],
  ['ペトローネ', 'FW', 29, 67, 12],
  ['イラーリ', 'FW', 19, 55, 2],
  ['バルディ', 'FW', 31, 57, 6],
  ['クレメンテ', 'FW', 26, 53, 4],
].map(([name, pos, age, ovr, wage], i) => ({ id: 'p' + i, name, pos, age, ovr, wage, injured: 0, form: 0 }));

// 移籍市場(price は移籍金・千ユーロ)
export const MARKET = [
  ['サバティーニ', 'GK', 27, 64, 9, 520],
  ['ロハス', 'DF', 28, 64, 9, 560],
  ['ネグリ', 'DF', 24, 60, 6, 340],
  ['ヴィダル', 'MF', 30, 65, 11, 600],
  ['テッラ', 'MF', 22, 59, 4, 300],
  ['ムニョス', 'FW', 27, 66, 12, 700],
  ['カルーゾ', 'FW', 33, 62, 8, 220],
].map(([name, pos, age, ovr, wage, price], i) => ({ id: 'm' + i, name, pos, age, ovr, wage, price, injured: 0, form: 0 }));

// 審判(integrity が高いほど買収しにくい)
export const REFEREES = [
  { id: 'r0', name: 'G. メルティ', integrity: 25, weakness: '違法賭博の借金が二万ユーロある。妻は知らない。' },
  { id: 'r1', name: 'F. カザーレス', integrity: 55, weakness: '協会の理事の甥。昇進の口利きを欲しがっている。' },
  { id: 'r2', name: 'R. オルドーニ', integrity: 40, weakness: '週に二度、港の近くの女の部屋に通っている。' },
  { id: 'r3', name: 'M. ヴィラ', integrity: 85, weakness: '弱みは見つからない。娘が首都の大学に通っている。' },
  { id: 'r4', name: 'S. ペッレ', integrity: 35, weakness: '前の試合で受け取った金の記録が、ある仲介人の手元に残っている。' },
  { id: 'r5', name: 'A. ブルーノ', integrity: 60, weakness: '医師から心臓の持病を指摘されている。引退後の年金を心配している。' },
];

export const ROLES = {
  broker: '仲介人',
  investigator: '調査屋',
  accountant: '会計士',
  muscle: '荒事師',
  cleaner: '掃除屋',
};

// 初期の手駒(実業家)
export const START_OPERATIVES = [
  { name: 'オッターヴィオ・ブラスキ', role: 'broker', skill: 3, loyalty: 72, discretion: 64, wage: 8, note: '審判・選手の窓口', weakness: { key: 'none', text: '目立った弱みはない。金で動く男で、金が続く限りは裏切らない。' } },
  { name: 'ミレーナ・ヴォルピ', role: 'investigator', skill: 4, loyalty: 55, discretion: 88, wage: 12.5, note: '元刑事。調査と監視', weakness: { key: 'pride', text: '検察時代の上司クレリチを今も恨んでいる。命令の扱い次第で忠誠が揺れる。' } },
  { name: 'ラウル・セガーラ', role: 'accountant', skill: 3, loyalty: 81, discretion: 40, wage: 6, note: '裏金の洗浄', weakness: { key: 'drink', text: '酒量が増えている。酔うと口が軽くなる。' } },
  { name: 'ダニーロ・メッリ', alias: 'ロッソ', role: 'muscle', skill: 2, loyalty: 34, discretion: 52, wage: 2, note: '運び屋。汚れ仕事', weakness: { key: 'debt', text: '高利貸しに借金がある。より多く払う者に転ぶ。' } },
];

// 雇える手駒(fee は契約金・裏金・千ユーロ)
export const HIRE_POOL = [
  { name: '氏名不詳', alias: 'サルト', role: 'cleaner', skill: 4, loyalty: 60, discretion: 85, wage: 15, fee: 80, note: '掃除屋。ブラスキの紹介', weakness: { key: 'none', text: '誰とも深く付き合わない。金と沈黙を等価に扱う。' } },
  { name: 'エンツォ・カーポ', role: 'muscle', skill: 3, loyalty: 58, discretion: 60, wage: 5, fee: 30, note: '元ボクサー。用心棒もこなす', weakness: { key: 'temper', text: '頭に血が上ると加減が利かない。' } },
  { name: 'ドロレス・マーニ', role: 'broker', skill: 4, loyalty: 50, discretion: 70, wage: 10, fee: 60, note: '協会の事務局に顔が利く', weakness: { key: 'greed', text: '複数の陣営から同時に金を受け取っている。' } },
  { name: 'ルカ・ベルティ', role: 'investigator', skill: 2, loyalty: 70, discretion: 65, wage: 4, fee: 15, note: '元巡査。尾行と張り込み', weakness: { key: 'family', text: '病気の母親の治療費に困っている。' } },
];

export const PURSUERS = [
  { id: 'press', name: 'ピエトロ・アルシ', org: '日刊イル・ファーロ 調査報道部', kind: 'press', evidence: 10, focus: { money: 0.6, people: 1.0, match: 0.6, violence: 0.8 }, weakness: '情報源はクラブの経理部員カルラ・ノーチェ。週に一度、旧市街のバールで会っている。', buyable: 45 },
  { id: 'pros', name: 'アンナ・クレリチ', org: '首都検察 特捜部', kind: 'pros', evidence: 5, focus: { money: 1.0, people: 0.5, match: 0.3, violence: 1.0 }, weakness: '夫の建設会社が市の入札で談合している。本人は関与していない。', buyable: 15 },
  { id: 'rival', name: 'L. ダレッサンドロ', org: 'AC セッラーヴォ オーナー', kind: 'rival', evidence: 0, focus: { money: 0.3, people: 0.8, match: 0.9, violence: 0.6 }, weakness: 'クラブの金で愛人に別荘を買った。理事会は知らない。', buyable: 35, club: 'SER' },
  { id: 'ethics', name: '協会 倫理委員会', org: '委員長 V. サッバティーニ', kind: 'ethics', evidence: 0, focus: { money: 0.2, people: 0.1, match: 1.0, violence: 0.2 }, weakness: 'サッバティーニは次の協会会長選に出たがっている。票が要る。', buyable: 40 },
];

// 後任(追及者を消したとき)
export const SUCCESSORS = {
  press: ['セレーナ・ヴィッラ', 'マルコ・ターニ'],
  pros: ['ダリオ・フェッラ', 'イレーネ・コンティ'],
  rival: ['C. ダレッサンドロ(弟)', 'T. ダレッサンドロ(息子)'],
  ethics: ['委員長代行 B. ロッシ', '委員長 F. マリーニ'],
};

// 工作の定義
// target: ref=次節の主審 / oppPlayer=他クラブの主力 / oppClub=次節の相手 / person=人物全般 / pursuer=追及者 / own=自分の手駒 / none
export const OPS = {
  ref_bribe: { name: '審判への謝礼', cat: '八百長', roles: ['broker'], cost: 40, weeks: 1, target: 'ref', base: 72, trace: { kind: 'match', size: 2 }, desc: '次節の主審に金を渡す。試合中、際どい判定を一度こちらに傾けられる。' },
  player_bribe: { name: '相手選手の買収', cat: '八百長', roles: ['broker'], cost: 60, weeks: 1, target: 'oppPlayer', base: 58, trace: { kind: 'match', size: 3 }, desc: '次節の相手の主力に手を抜かせる。相手の力が落ちる。' },
  fix_match: { name: '試合ごと買う', cat: '八百長', roles: ['broker'], cost: 250, weeks: 1, target: 'oppClub', base: 45, trace: { kind: 'match', size: 6 }, desc: '次節の相手の監督と談合する。勝ちがほぼ確定するが、不自然さが残る。' },
  bet: { name: '賭けの裏張り', cat: '八百長', roles: ['broker', 'accountant'], cost: 100, weeks: 1, target: 'none', base: 90, trace: { kind: 'money', size: 2 }, desc: '次節のこちらの勝ちに裏金を賭ける。勝てば倍率に応じて戻る。' },
  dig: { name: '身辺を洗う', cat: '脅迫・情報', roles: ['investigator'], cost: 15, weeks: 2, target: 'person', base: 70, trace: { kind: 'people', size: 0 }, desc: '対象の弱みを探る。見つかれば「脅す」に使える。' },
  blackmail: { name: '脅す', cat: '脅迫・情報', roles: ['broker', 'investigator', 'muscle'], cost: 0, weeks: 1, target: 'leverage', base: 75, trace: { kind: 'people', size: 1 }, desc: '握った弱みで相手を動かす。追及者なら証拠が減り、しばらく黙る。審判なら次に担当する試合で判定を傾ける。' },
  buy_pursuer: { name: '追及者の買収', cat: '脅迫・情報', roles: ['broker'], cost: 120, weeks: 1, target: 'pursuer', base: 0, trace: { kind: 'people', size: 3 }, desc: '金で黙らせる。成功率は相手による。検察はほとんど動かない。' },
  skim: { name: '裏金を作る', cat: '財務', roles: ['accountant'], cost: 0, weeks: 1, target: 'none', base: 80, trace: { kind: 'money', size: 3 }, desc: '入場料と物販の売上を抜く。裏金が増え、表の資金が少し減る。' },
  launder: { name: '洗浄', cat: '財務', roles: ['accountant'], cost: 0, weeks: 1, target: 'none', base: 85, trace: { kind: 'money', size: 2 }, desc: '裏金 €200k を架空のスポンサー料として表に戻す。手数料 15%。' },
  cook_books: { name: '粉飾', cat: '財務', roles: ['accountant'], cost: 20, weeks: 1, target: 'none', base: 65, trace: { kind: 'money', size: 5 }, desc: '帳簿を書き換え、債権団への返済期限を第14週まで先送りさせる。' },
  warn: { name: '警告', cat: '暴力', roles: ['muscle'], cost: 10, weeks: 1, target: 'person', base: 75, trace: { kind: 'violence', size: 3 }, desc: '車を燃やす、家の前に立つ。追及者ならしばらく手が止まり、次の脅しが通りやすくなる。' },
  injure: { name: '負傷させる', cat: '暴力', roles: ['muscle', 'cleaner'], cost: 20, weeks: 1, target: 'oppPlayer', base: 65, trace: { kind: 'violence', size: 4 }, desc: '対象を襲わせる。数週間、試合に出られなくなる。' },
  kill: { name: '消す', cat: '暴力', roles: ['cleaner', 'muscle'], cost: 150, weeks: 1, target: 'person', base: 60, trace: { kind: 'violence', size: 8 }, desc: '対象をこの世から消す。もっとも効き、もっとも残る。' },
  silence: { name: '口を封じる', cat: '暴力', roles: ['cleaner', 'muscle'], cost: 50, weeks: 1, target: 'own', base: 70, trace: { kind: 'violence', size: 5 }, desc: '自分の手駒を消す。その手駒が知っていること、証言できることも消える。' },
  guard: { name: '身辺警護', cat: '暴力', roles: ['muscle', 'cleaner'], cost: 0, weeks: 1, target: 'none', base: 100, trace: { kind: 'violence', size: 0 }, desc: '今週はオーナーの身辺を固める。襲撃をかなりの確率で防ぐ。' },
};

export const TACTICS = {
  balanced: { name: '均衡', att: 0, def: 0, pos: 0 },
  attack: { name: '攻撃的', att: 4, def: -4, pos: 0.03 },
  defend: { name: '堅守', att: -4, def: 5, pos: -0.04 },
  counter: { name: '堅守速攻', att: 2, def: 2, pos: -0.08 },
};

export const BACKGROUNDS = [
  { id: 'biz', name: '実業家', desc: '表の資金が多い。財務の工作が得意。', ready: true },
  { id: 'exp', name: '元代表選手', desc: '協会と選手につながりがある。八百長が得意。', ready: false },
  { id: 'dock', name: '港湾組合の顔役', desc: '最初から荒事の手駒がいる。検察に目をつけられている。', ready: false },
];

export const START_CLUBS = [
  { id: 'c3', name: '三部の地方クラブ', desc: '長い道のり。', ready: false },
  { id: 'c2', name: '二部の没落した名門', desc: 'US ヴェラルド。創立1907年、一部優勝4回。いまは借金と空席。', ready: true },
  { id: 'c1', name: '一部の中堅クラブ', desc: '短い道のり。', ready: false },
];

export const MODES = [
  { id: 'owner', name: 'オーナー', desc: '現場には口を出さない。予算と承認だけ。', ready: false },
  { id: 'chair', name: '会長', desc: '移籍、契約、チームの方針を決める。', ready: true },
  { id: 'full', name: '全権', desc: '先発と試合中の采配まで握る。', ready: false },
];
