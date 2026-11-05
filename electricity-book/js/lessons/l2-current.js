// 第 2 課 電流：電子早就在導線裡，按下開關就一起動
import { Stage, THREE, V3, ChargeFlow, makeBattery, makeLamp, makeSwitch, makeMeter, surf, fmt } from '../three-kit.js';
import { Net, WIRE_R } from '../circuit.js';
import { T, wire, controls, readouts, emitter, numTags } from './rig.js';

const Q_DOT = 0.1;      // 每個藍點代表 0.1 庫侖
const SPACING = 0.11;

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.3, 5.2, 7.1], target: [0, 0.3, 0.05], fov: 31 });
  const flow = new ChargeFlow(stage, { K: SPACING / Q_DOT, spacing: SPACING });
  const arrows = new ChargeFlow(stage, { K: SPACING / Q_DOT, spacing: 0.5, shape: 'cone', role: 'plus', radius: 0.03, jitter: false });
  arrows.visible = false;
  const state = { closed: true, cells: 2, arrows: false };
  const ev = emitter();

  const bat = makeBattery({ cells: 2, length: 1.9 }); bat.group.position.set(-0.6, 0, 1.15);
  const sw = makeSwitch(); sw.group.position.set(1.55, 0, 1.15);
  const lamp = makeLamp(); lamp.group.position.set(0, 0, -1.0);
  const m1 = makeMeter('A', { plusLeft: false }); m1.group.position.set(1.6, 0, -1.1);
  const m2 = makeMeter('A', { plusLeft: false }); m2.group.position.set(-1.6, 0, -1.1);
  stage.add(bat.group, sw.group, lamp.group, m1.group, m2.group);
  [lamp, sw, m1, m2].forEach((c) => stage.addTicker(c.tick));

  const net = new Net();
  const n = {}; ['bp', 'sl', 'sr', 'a1p', 'a1m', 'lr', 'll', 'a2p', 'a2m'].forEach((k) => { n[k] = net.node(); });
  const src = net.V(n.bp, 0, 3);
  const eSw = net.R(n.sl, n.sr, WIRE_R);
  const eA1 = net.R(n.a1p, n.a1m, 0.01);
  const eL = net.R(n.lr, n.ll, 6);
  const eA2 = net.R(n.a2p, n.a2m, 0.01);
  const W = (A, B, a, b, c) => { const w = wire(stage, flow, net, A, B, a, b, c); arrows.add(w.path, { getI: () => w.el.I, sign: 1 }); return w; };
  W(T(bat, 'plus'), T(sw, 'left'), n.bp, n.sl);
  W(T(sw, 'right'), T(m1, 'plus'), n.sr, n.a1p, [[2.6, 1.15], [2.6, -1.0]]);
  W(T(m1, 'minus'), T(lamp, 'right'), n.a1m, n.lr);
  W(T(lamp, 'left'), T(m2, 'plus'), n.ll, n.a2p);
  W(T(m2, 'minus'), T(bat, 'minus'), n.a2m, 0, [[-2.6, -1.0], [-2.6, 1.15]]);

  // 電量計數器：套在左邊導線上的圓環
  const gatePos = V3(-2.6, 0.05, 0.08);
  const gate = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 10, 36), surf('cellBand')); gate.position.copy(gatePos); stage.add(gate);
  const gateLab = stage.addLabel('', gatePos.clone().add(V3(0.95, 0.3, 0)), { cls: 'chip' });

  stage.addClickable(sw.group, () => set({ closed: !state.closed }, true));
  numTags(stage, [V3(-0.6, 0.72, 1.4), V3(1.55, 0.62, 1.4), V3(-0.45, 1.2, -1.0), V3(1.05, 0.82, -1.1), V3(-2.15, 0.82, -1.1), V3(-2.6, 0.32, 0.35), V3(2.6, 0.32, 0.1)]);
  const batLab = stage.addLabel('', V3(-0.6, 0.66, 0.95), { cls: 'chip small' });
  const m1Lab = stage.addLabel('', V3(1.6, 0.9, -1.0), { cls: 'chip' });
  const m2Lab = stage.addLabel('', V3(-1.6, 0.9, -1.0), { cls: 'chip' });

  const ui = controls(controlsEl, [
    { type: 'seg', id: 'closed', label: '開關', options: [{ value: 0, label: '打開（斷路）' }, { value: 1, label: '按下（通路）' }], value: 1 },
    { type: 'range', id: 'cells', label: '電池', min: 1, max: 3, step: 1, value: 2, fmt: (v) => `${v} 顆・${(v * 1.5).toFixed(1)} V` },
    { type: 'toggle', id: 'arrows', label: '顯示慣用電流方向（紅色箭頭）', value: false },
    { type: 'buttons', label: '電量計數器', items: [{ id: 'count', label: '開始計數' }, { id: 'reset', label: '歸零', cls: 'ghost' }] },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'i1', label: '安培計 A₁（燈泡前）' }, { id: 'i2', label: '安培計 A₂（燈泡後）' },
    { id: 'q', label: '計數器：通過的電量 Q' }, { id: 't', label: '計數時間 t' }, { id: 'qt', label: 'Q ÷ t', cls: 'em' },
  ]);
  ui.on('closed', (v) => set({ closed: !!v }, true)).on('cells', (v) => set({ cells: v }, true)).on('arrows', (v) => set({ arrows: v }, true))
    .on('count', () => act('count')).on('reset', () => act('reset'));

  let counting = false, Qc = 0, tc = 0, shownCells = 2;
  function solve() {
    src.V = 1.5 * state.cells;
    eSw.R = state.closed ? WIRE_R : 1e9;
    net.solve();
    if (shownCells !== state.cells) { bat.setCells(state.cells); shownCells = state.cells; }
    sw.setClosed(state.closed);
    m1.setValue(eA1.I); m2.setValue(eA2.I);
    const P = eL.I * eL.I * eL.R;
    lamp.setBrightness(0.9 * Math.sqrt(P / 1.5));
    arrows.visible = state.arrows;
    batLab.set(`${src.V.toFixed(1)} V`);
    m1Lab.set(`A₁ <b>${fmt(eA1.I)} A</b>`); m2Lab.set(`A₂ <b>${fmt(eA2.I)} A</b>`);
    ro.set('i1', `${fmt(eA1.I)} A`); ro.set('i2', `${fmt(eA2.I)} A`);
  }
  function showCounter() {
    gateLab.set(`計數器 <b>${Math.floor(Qc / Q_DOT + 1e-6)}</b> 點 = <b>${Qc.toFixed(1)} C</b>`);
    ro.set('q', `${Qc.toFixed(2)} C`); ro.set('t', `${tc.toFixed(1)} s`);
    ro.set('qt', tc > 0.5 ? `${(Qc / tc).toFixed(2)} A` : '—');
    const b = ui.button('count'); if (b) b.textContent = counting ? '暫停計數' : (tc > 0 ? '繼續計數' : '開始計數');
  }
  function act(name) {
    if (name === 'count') counting = !counting;
    if (name === 'reset') { Qc = 0; tc = 0; }
    if (name === 'start') { Qc = 0; tc = 0; counting = true; }
    showCounter(); ev.emit(get());
  }
  function get() { return { ...state, I: eL.I, Q: Qc, t: tc, counting }; }
  function set(p, user = false) {
    Object.assign(state, p);
    if (!user) { ui.show('closed', state.closed ? 1 : 0); ui.show('cells', state.cells); ui.show('arrows', state.arrows); }
    else { ui.show('closed', state.closed ? 1 : 0); }
    solve(); ev.emit(get());
  }

  let tUI = 0;
  stage.addTicker((dt, rdt) => {
    if (counting && dt > 0) { Qc += Math.abs(eL.I) * dt; tc += dt; }
    tUI += rdt;
    if (tUI > 0.1) { tUI = 0; showCounter(); if (counting) ev.emit(get()); }
  });

  const VIEWS = {
    front: [[0.3, 5.2, 7.1], [0, 0.3, 0.05]],
    battery: [[-0.9, 2.5, 3.9], [-0.6, 0.3, 1.0]],
    meters: [[0, 2.3, 2.9], [0, 0.45, -1.0]],
    gate: [[-1.3, 1.9, 2.3], [-2.6, 0.2, 0.1]],
  };
  solve(); showCounter();
  return {
    stage, set, get, act, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 2, slug: 'current', title: '電流', en: 'Current',
  short: '按下開關，燈為什麼馬上就亮？電流其實是「電子大遊行」。',
  bigIdea: '電流就是電荷的流動。在同一條路上，每個地方的電流都一樣大：電流不會被燈泡「用掉」，被用掉的是電荷帶來的能量。',
  goals: ['知道電流是每秒通過的電量：I = Q ÷ t', '分辨電子移動的方向和慣用的電流方向', '用安培計測量電流，知道串聯時電流處處相等'],
  predict: {
    q: '燈泡前面和後面各接一個安培計。哪一個的讀數比較大？',
    options: ['燈泡前面的比較大，因為電流在燈泡裡被用掉了一些', '燈泡後面的比較大', '兩個一樣大'],
    answer: 2,
    why: '<p>兩個安培計的讀數<strong>一樣大</strong>。電子從電池出發，經過燈泡，再回到電池，一路上沒有變少：每秒鐘流進燈泡多少電荷，就有多少電荷流出來。</p><p>燈泡變亮，是因為電荷經過燈泡時把<strong>能量</strong>交給燈絲，燈絲變熱而發光。用掉的是能量，不是電荷。</p>',
  },
  figure: {
    title: '一盞燈、一個開關、兩個安培計',
    alt: '立體圖：電池、開關、燈泡和兩個安培計連成一圈。透明導線裡有許多藍色小點代表電子，左邊導線上套著一個電量計數器圓環。',
    legend: ['電池（每顆 1.5 V）', '開關：在圖上點一下也能切換', '燈泡', '安培計 A₁（燈泡前）', '安培計 A₂（燈泡後）', '電量計數器：每個藍點代表 0.1 庫侖', '導線：裡面本來就充滿自由電子'],
    note: '真實的電子移動得非常慢，動畫裡加快了很多倍。',
    mount,
  },
  watch: [
    { text: '開關打開，電路是<strong>斷路</strong>。導線裡其實<strong>早就充滿電子</strong>（藍點），但它們沒有一起朝同一個方向移動，所以沒有電流。', set: { closed: false, cells: 2, arrows: false }, view: 'front' },
    { text: '按下開關，形成<strong>通路</strong>：整條導線裡的電子<strong>幾乎同時開始移動</strong>。所以燈泡一下就亮了，不必等電子從電池跑過來。', set: { closed: true, cells: 2, arrows: false }, view: 'front' },
    { text: '仔細看：電子從電池的<strong>負極</strong>出發，經過開關、安培計和燈泡，最後回到<strong>正極</strong>。', set: { closed: true, cells: 2, arrows: false }, view: 'battery' },
    { text: '早期科學家還不知道有電子，就規定電流從<strong>正極</strong>流出、繞一圈回到<strong>負極</strong>。這個<strong>慣用電流方向</strong>（紅色箭頭）剛好和電子移動的方向相反。', set: { closed: true, cells: 2, arrows: true }, view: 'front' },
    { text: '看兩個安培計：燈泡前和燈泡後的讀數<strong>一樣大</strong>。電子沒有在燈泡裡被用掉，燈泡用掉的是電子帶來的<strong>能量</strong>。', set: { closed: true, cells: 2, arrows: false }, view: 'meters' },
    { text: '換成 3 顆電池（4.5 V）：電子被推得更快，每秒通過的電量變多，<strong>電流變大</strong>，燈泡也更亮。', set: { closed: true, cells: 3, arrows: false }, view: 'front' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>點一下立體圖裡的開關，在斷路和通路之間切換。注意藍點在斷路時也一直都在。</p><button type="button" class="act" data-set='{"closed":false}'>打開開關</button><button type="button" class="act" data-set='{"closed":true}'>按下開關</button></li>
      <li><p data-read>按「開始計數」，讓計數器數 10 秒。算算看 Q ÷ t，是不是剛好等於安培計的讀數？</p><button type="button" class="act" data-act="start">從 0 開始計數</button></li>
      <li><p data-read>換成 1 顆或 3 顆電池，比較 A₁ 和 A₂。它們有不一樣的時候嗎？</p><button type="button" class="act" data-set='{"cells":1}'>1 顆電池</button><button type="button" class="act" data-set='{"cells":3}'>3 顆電池</button></li>
      <li><p data-read>打開紅色箭頭，確認慣用的電流方向和電子移動的方向相反。</p><button type="button" class="act" data-set='{"arrows":true}'>顯示紅色箭頭</button></li>
    </ul>`,
  challenge: {
    text: '讓安培計讀數是 <strong>0.50 A</strong>，再用計數器數滿 <strong>10 秒</strong>，看看 Q ÷ t 是不是等於 0.50 A。',
    check: (s) => s.cells === 2 && s.closed && s.t >= 10 && Math.abs(s.Q / s.t - 0.5) < 0.02,
    done: '每秒通過 0.5 庫侖，就是 0.5 安培。10 秒內通過的電量 Q = I × t = 0.5 × 10 = 5 庫侖。',
  },
  body: `
    <h3>什麼是電流</h3>
    <p data-read>電荷的流動叫做<strong>電流</strong>。在金屬導線裡流動的是<strong>自由電子</strong>。電流的大小，就是<strong>每秒鐘通過導線某一個截面的電量</strong>。</p>
    <div class="formula">
      <p class="f-main" data-say="I 等於 Q 除以 t">I = Q ÷ t</p>
      <dl class="f-legend"><div><dt>I</dt><dd>電流，單位<strong>安培（A）</strong></dd></div><div><dt>Q</dt><dd>電量，單位庫侖（C）</dd></div><div><dt>t</dt><dd>時間，單位秒（s）</dd></div></dl>
      <p class="f-note">1 A 表示每秒有 1 C 的電量通過，大約是每秒 6.25 × 10¹⁸ 個電子。</p>
    </div>

    <h3>有通路才有電流</h3>
    <ul class="dot-list">
      <li data-read><strong>通路</strong>：電荷可以從電源出發，繞一圈再回到電源。</li>
      <li data-read><strong>斷路</strong>：某個地方斷開了（開關打開、燈絲燒斷），整圈都沒有電流。</li>
      <li data-read><strong>短路</strong>：電流沒經過燈泡等用電器，直接從導線回到電源。電流會非常大，電線發燙，甚至起火，非常危險。</li>
    </ul>

    <h3>電流的方向</h3>
    <div class="pair">
      <div class="pair-a"><b>慣用電流方向</b><span>正極 → 外面的電路 → 負極</span><em>畫電路圖時用這個</em></div>
      <div class="pair-b"><b>電子移動方向</b><span>負極 → 外面的電路 → 正極</span><em>導線裡真正在動的</em></div>
    </div>
    <p data-read>兩個方向相反是歷史造成的。十八世紀的科學家先規定了「正電」和「負電」，也規定電流從正極流出；一百多年後才發現，金屬裡移動的是帶負電的電子。</p>

    <h3>電流不會被用掉</h3>
    <p data-read>串聯在同一條路上的安培計，讀數處處相同。可以把電子想成腳踏車的鏈條：鏈條本身沒有被用掉，它只是把踏板的力量傳到後輪。燈泡把電子帶來的能量轉換成光和熱，電子則繼續流回電池。</p>

    <h3>電子其實跑得很慢</h3>
    <p data-read>1 A 的電流流過一般粗細（截面積 1 mm²）的銅線時，電子平均每秒只往前移動大約 0.1 毫米，比蝸牛還慢得多。燈卻在開關按下的瞬間就亮了，因為整條導線裡的電子是同時開始移動的。</p>

    <h3>用安培計測量電流</h3>
    <ul class="dot-list">
      <li data-read>安培計要和待測的元件<strong>串聯</strong>，讓電流全部流過它。</li>
      <li data-read>電流從安培計的「＋」端（紅色）流進去，從「－」端（黑色）流出來。</li>
      <li data-read>不可以把安培計直接接在電池兩端。安培計的電阻很小，會造成短路。</li>
      <li data-read>不確定電流多大時，先用最大的量程，再換成合適的量程。</li>
    </ul>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">電流在燈泡裡被用掉，所以燈泡後面的電流比較小。</p><p class="right">同一條路上電流處處相等。燈泡轉換的是能量。</p></div>
      <div class="myth"><p class="wrong">電子要從電池一路跑到燈泡，燈才會亮。</p><p class="right">導線裡本來就充滿電子，開關一按，全部一起開始移動。</p></div>
      <div class="myth"><p class="wrong">電流是從負極流到正極。</p><p class="right"><strong>電子</strong>從負極移到正極；慣用的<strong>電流方向</strong>是從正極到負極。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>（1）一個燈泡在 2 分鐘內有 60 C 的電量通過，電流是多少？（2）0.2 A 的電流流了 30 秒，通過多少電量？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>先把時間換成秒：t = 2 × 60 = 120 s。I = Q ÷ t = 60 ÷ 120 = <strong>0.5 A</strong>。</li><li>Q = I × t = 0.2 × 30 = <strong>6 C</strong>。</li></ol>
      </details>
    </div>`,
  keywords: [
    { t: '電流', en: 'current, I', d: '電荷的流動。大小是每秒通過的電量。' },
    { t: '安培', en: 'ampere, A', d: '電流的單位。1 A = 每秒通過 1 庫侖。' },
    { t: '通路', en: 'closed circuit', d: '電荷能繞一整圈回到電源的電路。' },
    { t: '斷路', en: 'open circuit', d: '電路某處斷開，沒有電流。' },
    { t: '短路', en: 'short circuit', d: '電流沒經過用電器就直接回到電源，電流非常大，很危險。' },
    { t: '慣用電流方向', en: 'conventional current', d: '規定電流從電源正極流出，經過外電路回到負極。' },
    { t: '安培計', en: 'ammeter', d: '測量電流的儀器，要和元件串聯。' },
    { t: '串聯', en: 'in series', d: '元件一個接一個連成一條路，電流依序流過每個元件。' },
  ],
  quiz: [
    { q: '3 秒內有 6 C 的電量通過燈泡，電流是多少？', options: ['0.5 A', '2 A', '9 A', '18 A'], answer: 1, why: 'I = Q ÷ t = 6 ÷ 3 = 2 A。' },
    { q: '金屬導線裡，實際移動的帶電粒子是：', options: ['自由電子', '質子', '原子核', '正離子'], answer: 0, why: '金屬裡可以移動的是自由電子，質子和原子核都留在原位。' },
    { q: '燈泡前後各串聯一個安培計，讀數會：', options: ['燈泡前比較大', '燈泡後比較大', '一樣大', '燈泡後是 0'], answer: 2, why: '串聯電路中電流處處相等，電荷不會被燈泡用掉。' },
    { q: '安培計應該怎麼接在電路裡？', options: ['和待測元件串聯', '和待測元件並聯', '直接接在電池兩端', '接哪裡都可以'], answer: 0, why: '電流要全部流過安培計才量得到。直接接在電池兩端會短路。' },
    { q: '按下開關，燈泡幾乎立刻亮起來，原因是：', options: ['整條導線裡的電子同時開始移動', '電子以光速從電池跑到燈泡', '電池裡的電子特別快', '燈泡裡本來就存著電'], answer: 0, why: '導線裡本來就充滿自由電子，通路一形成，全部電子幾乎同時開始移動。' },
  ],
  summary: [
    '電流是電荷的流動：I = Q ÷ t，單位安培 A。1 A 表示每秒有 1 庫侖通過。',
    '要形成通路才有電流；斷路沒有電流；短路的電流非常大，很危險。',
    '慣用電流方向是正極 → 外電路 → 負極，電子移動方向剛好相反。',
    '串聯電路中電流處處相等。電流不會被用掉，被轉換的是能量。',
    '安培計要串聯在電路中，電流從＋端流入。',
  ],
};
