// 第 4 課 電阻：滑線變阻器、兩個安培計、燈泡
import { Stage, THREE, V3, ChargeFlow, makeBattery, makeLamp, makeMeter, makeRheostat, fmt } from '../three-kit.js';
import { Net } from '../circuit.js';
import { T, wire, controls, readouts, emitter, numTags } from './rig.js';
import { ivPlot, wireR } from '../widgets.js';

const RL = 6;

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.3, 5.5, 7.7], target: [0, 0.35, 0.05], fov: 31 });
  const flow = new ChargeFlow(stage, { K: 1.4 });
  const state = { cells: 2, R: 5 };
  const ev = emitter();

  const bat = makeBattery({ cells: 2, length: 1.8 }); bat.group.position.set(-0.2, 0, 1.3);
  const m4 = makeMeter('A', { plusLeft: true }); m4.group.position.set(1.8, 0, 1.2);
  const m5 = makeMeter('A', { plusLeft: true }); m5.group.position.set(-2.1, 0, 1.2);
  const rh = makeRheostat({ length: 2.4, Rmax: 20 }); rh.group.position.set(0.55, 0, -1.2);
  const lamp = makeLamp(); lamp.group.position.set(-2.0, 0, -1.08);
  stage.add(bat.group, m4.group, m5.group, rh.group, lamp.group);
  [m4, m5, lamp].forEach((c) => stage.addTicker(c.tick));

  const net = new Net();
  const n = {}; ['bp', 'a4p', 'a4m', 'rt', 're', 'lr', 'll', 'a5p', 'a5m'].forEach((k) => { n[k] = net.node(); });
  const src = net.V(n.bp, 0, 3);
  const eA4 = net.R(n.a4p, n.a4m, 0.01);
  const eRH = net.R(n.rt, n.re, 5);
  const eL = net.R(n.lr, n.ll, RL);
  const eA5 = net.R(n.a5p, n.a5m, 0.01);
  wire(stage, flow, net, T(bat, 'plus'), T(m4, 'plus'), n.bp, n.a4p);
  const wRight = wire(stage, flow, net, T(m4, 'minus'), T(rh, 'top'), n.a4m, n.rt, [[2.8, 1.3], [2.8, -1.2]]);
  wire(stage, flow, net, T(rh, 'end'), T(lamp, 'right'), n.re, n.lr);
  wire(stage, flow, net, T(lamp, 'left'), T(m5, 'plus'), n.ll, n.a5p, [[-2.95, -1.08], [-2.95, 1.3]]);
  wire(stage, flow, net, T(m5, 'minus'), T(bat, 'minus'), n.a5m, 0);
  // 可變電阻裡的電子：沿滑桿，再繞進接入電路的那段線圈
  const segBar = flow.add(rh.barPath(), { getI: () => -eRH.I });
  const segCoil = flow.add(rh.coilPath(), { getI: () => -eRH.I, spacing: 0.32 });

  // 拖曳滑片
  const plane = new THREE.Plane(V3(0, 1, 0), -rh.barY);
  stage.addDraggable(rh.slider, {
    plane: () => plane,
    onDrag: (p) => { const loc = rh.group.worldToLocal(p.clone()); set({ R: Math.round(Math.max(0.02, Math.min(1, (loc.x + rh.L / 2) / rh.L)) * 40) / 2 }, true); },
  });

  numTags(stage, [V3(-0.2, 0.72, 1.6), V3(-0.85, 1.02, -1.2), V3(-2.45, 1.15, -1.08), V3(1.25, 0.82, 1.2), V3(-2.65, 0.82, 1.2), V3(2.8, 0.32, 0.1)]);
  const batLab = stage.addLabel('', V3(-0.2, 0.66, 1.08), { cls: 'chip small' });
  const m4Lab = stage.addLabel('', V3(1.8, 0.9, 1.3), { cls: 'chip' });
  const m5Lab = stage.addLabel('', V3(-2.1, 0.9, 1.3), { cls: 'chip' });
  const rhLab = stage.addLabel('', () => rh.slider.getWorldPosition(V3()).add(V3(0, 1.0, 0)), { cls: 'chip' });

  const ui = controls(controlsEl, [
    { type: 'range', id: 'R', label: '可變電阻', min: 0.5, max: 20, step: 0.5, value: state.R, fmt: (v) => `${(+v).toFixed(1)} Ω` },
    { type: 'range', id: 'cells', label: '電池', min: 1, max: 3, step: 1, value: 2, fmt: (v) => `${v} 顆・${(v * 1.5).toFixed(1)} V` },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'i4', label: '安培計 4（靠電池）', cls: 'em' }, { id: 'i5', label: '安培計 5（靠燈泡）', cls: 'em' },
    { id: 'rt', label: '總電阻（燈泡＋可變電阻）' }, { id: 'vl', label: '燈泡兩端電壓' }, { id: 'rl', label: '燈泡電阻 R = V ÷ I', cls: 'wide' },
  ]);
  ui.on('R', (v) => set({ R: v }, true)).on('cells', (v) => set({ cells: v }, true));

  let shownCells = 2;
  function solve() {
    src.V = 1.5 * state.cells;
    rh.setFraction(state.R / rh.Rmax);
    eRH.R = state.R;
    net.solve();
    if (shownCells !== state.cells) { bat.setCells(state.cells); shownCells = state.cells; }
    flow.setPath(segBar, rh.barPath()); flow.setPath(segCoil, rh.coilPath());
    m4.setValue(eA4.I); m5.setValue(eA5.I);
    lamp.setBrightness(0.9 * Math.sqrt((eL.I * eL.I * RL) / 1.5));
    const vl = net.vd(eL);
    batLab.set(`${src.V.toFixed(1)} V`);
    m4Lab.set(`<b>${fmt(eA4.I)} A</b>`); m5Lab.set(`<b>${fmt(eA5.I)} A</b>`);
    rhLab.set(`R = <b>${state.R.toFixed(1)} Ω</b>`);
    ro.set('i4', `${fmt(eA4.I)} A`); ro.set('i5', `${fmt(eA5.I)} A`);
    ro.set('rt', `${(state.R + RL).toFixed(1)} Ω`); ro.set('vl', `${fmt(vl)} V`);
    ro.set('rl', eL.I > 0.001 ? `${fmt(vl)} ÷ ${fmt(eL.I)} = ${fmt(vl / eL.I, 1)} Ω` : '—');
  }
  function get() { return { ...state, I: eL.I, V: src.V }; }
  function set(p, user = false) {
    Object.assign(state, p);
    ui.show('R', state.R); if (!user) ui.show('cells', state.cells);
    solve(); ev.emit(get());
  }

  const VIEWS = {
    front: [[0.3, 5.5, 7.7], [0, 0.35, 0.05]],
    rheo: [[1.2, 2.6, 1.6], [0.55, 0.45, -1.2]],
    meters: [[-0.2, 2.9, 4.6], [-0.2, 0.3, 1.1]],
  };
  solve();
  return {
    stage, set, get, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 4, slug: 'resistance', title: '電阻', en: 'Resistance',
  short: '拉動可變電阻，燈泡忽明忽暗。認識歐姆定律 V = I × R。',
  bigIdea: '電阻會阻礙電流。電壓固定時，電阻越大，電流越小。對溫度固定的金屬導體來說，電壓和電流成正比：<strong>V = I × R</strong>。',
  goals: ['知道電阻的意思：R = V ÷ I，單位歐姆 Ω', '用歐姆定律 V = I × R 計算', '認識可變電阻，以及不同元件的 I–V 圖'],
  predict: {
    q: '把可變電阻的滑片往右推，讓電阻變大。兩個安培計的讀數會怎樣？',
    options: ['靠電池的那個變小，靠燈泡的那個不變', '兩個一起變小，而且一樣大', '兩個都不變，因為電池的電流是固定的'],
    answer: 1,
    why: '<p>整條電路只有一條路（串聯），所以每個地方的電流都一樣。可變電阻變大，整個電路的<strong>總電阻</strong>變大，電池推動的電流就變小，兩個安培計<strong>一起變小</strong>，燈泡也變暗。</p><p>電池提供的是固定的<strong>電壓</strong>，不是固定的電流。電流有多大，要看電路的總電阻。</p>',
  },
  figure: {
    title: '可變電阻控制燈泡亮度',
    alt: '立體圖：電池、兩個安培計、一個滑線變阻器和一個燈泡串聯。變阻器上有可以拖曳的紅色滑片，銅色線圈裡有電子在流動。',
    legend: ['電池', '可變電阻（滑線變阻器）', '燈泡（6 Ω）', '安培計（靠電池那側）', '安培計（靠燈泡那側）', '導線，裡面充滿電子'],
    note: '拖曳可變電阻上的紅色滑片，或用下方的滑桿。亮銅色的那段線圈才有接入電路。',
    mount,
  },
  watch: [
    { text: '這個電路有電池（1）、可變電阻（2）、燈泡（3）和兩個安培計（4）（5）。導線（6）裡充滿電子。全部串聯，只有一條路。', set: { cells: 2, R: 5 }, view: 'front' },
    { text: '電流必須流過可變電阻線圈中<strong>接入的那一段</strong>（亮銅色的部分）。滑片越往右，接入的線圈越長，<strong>電阻越大</strong>。', set: { cells: 2, R: 5 }, view: 'rheo' },
    { text: '把滑片推到最右邊：電阻變大，<strong>整個電路的電流一起變小</strong>，兩個安培計同時下降，燈泡變暗。', set: { cells: 2, R: 20 }, view: 'meters' },
    { text: '把滑片推到最左邊：電阻變小，電流變大，燈泡變亮。', set: { cells: 2, R: 0.5 }, view: 'front' },
    { text: '燈泡兩端的電壓除以流過它的電流，就是燈泡的電阻：R = V ÷ I。看右下角的讀數，不管電流多大，算出來都是 6 Ω。', set: { cells: 2, R: 10 }, view: 'front' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>拖曳立體圖上的紅色滑片（或用下方的滑桿），觀察兩個安培計。它們有不一樣的時候嗎？</p><button type="button" class="act" data-set='{"R":2}'>電阻 2 Ω</button><button type="button" class="act" data-set='{"R":18}'>電阻 18 Ω</button></li>
      <li><p data-read>電阻固定在 6 Ω。電池從 2 顆換成 3 顆，電流變成幾倍？</p><button type="button" class="act" data-set='{"R":6,"cells":2}'>2 顆電池</button><button type="button" class="act" data-set='{"R":6,"cells":3}'>3 顆電池</button></li>
      <li><p data-read>用讀數驗算：總電阻 × 電流，是不是等於電池電壓？</p></li>
    </ul>`,
  challenge: {
    text: '用 2 顆電池（3 V），調整可變電阻，讓電流剛好是 <strong>0.20 A</strong>。',
    check: (s) => s.cells === 2 && Math.abs(s.I - 0.2) < 0.004,
    done: '總電阻 = 3 V ÷ 0.20 A = 15 Ω，扣掉燈泡的 6 Ω，可變電阻要調到 9 Ω。',
  },
  body: `
    <h3>電阻：阻礙電流的程度</h3>
    <p data-read>同樣的電壓接上不同的東西，電流大小不一樣。電流越難通過的東西，<strong>電阻</strong>越大。電阻的定義是電壓除以電流：</p>
    <div class="formula">
      <p class="f-main" data-say="R 等於 V 除以 I">R = V ÷ I</p>
      <dl class="f-legend"><div><dt>R</dt><dd>電阻，單位<strong>歐姆（Ω）</strong></dd></div><div><dt>V</dt><dd>電壓（V）</dd></div><div><dt>I</dt><dd>電流（A）</dd></div></dl>
      <p class="f-note">1 Ω 表示：加 1 V 的電壓，會有 1 A 的電流。</p>
    </div>

    <h3>歐姆定律</h3>
    <p data-read>溫度固定時，金屬導體兩端的電壓和流過的電流成正比：電壓加倍，電流也加倍。這叫<strong>歐姆定律</strong>，常寫成 <strong>V = I × R</strong>。知道其中兩個量，就能算出第三個。</p>

    <h3>為什麼會有電阻</h3>
    <p data-read>自由電子在金屬裡移動時，會一直撞上金屬原子，把能量交給原子，讓導體變熱。這就是電流的<strong>熱效應</strong>：燈絲發光、電熱水壺燒水都是靠它。</p>

    <h3>影響電阻大小的因素</h3>
    <ul class="dot-list">
      <li data-read><strong>長度</strong>：導線越長，電阻越大（成正比）。</li>
      <li data-read><strong>截面積</strong>：導線越粗，電阻越小（成反比）。</li>
      <li data-read><strong>材料</strong>：銅和鋁的電阻很小，適合做電線；鎳鉻合金的電阻大，適合做電熱線。</li>
      <li data-read><strong>溫度</strong>：大多數金屬溫度越高，電阻越大。</li>
    </ul>
    <div class="widget" data-widget="wire"></div>

    <h3>可變電阻</h3>
    <p data-read>可變電阻（滑線變阻器）是一根繞在瓷管上的長電阻線。移動滑片，就改變了電流要流過的電阻線長度，也就改變了電阻。檯燈的調光旋鈕、音響的音量鈕，都用到同樣的想法。</p>

    <h3>I–V 圖：每種元件都有自己的個性</h3>
    <p data-read>把元件兩端的電壓和流過的電流畫成圖，叫做 I–V 圖。直線代表電阻固定；越來越平代表電阻越來越大。</p>
    <div class="widget" data-widget="iv"></div>
    <ul class="dot-list">
      <li data-read><strong>定值電阻</strong>（溫度固定）：通過原點的直線，遵守歐姆定律。</li>
      <li data-read><strong>燈泡的燈絲</strong>：電流越大燈絲越熱，電阻越大，所以曲線越來越平。</li>
      <li data-read><strong>二極體</strong>：只讓電流往一個方向流，而且順向電壓超過約 0.7 V 才開始導通。</li>
    </ul>
    <p data-read>延伸：<strong>熱敏電阻</strong>的溫度越高，電阻越小，可以做溫度感測器；<strong>光敏電阻</strong>照到的光越強，電阻越小，可以做路燈的自動開關。</p>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">可變電阻變大，只有它後面的電流會變小。</p><p class="right">串聯電路中電流處處相等，整個電路的電流一起變小。</p></div>
      <div class="myth"><p class="wrong">電池永遠送出固定的電流。</p><p class="right">電池提供的是電壓，電流大小由電路的總電阻決定。</p></div>
      <div class="myth"><p class="wrong">所有東西都遵守歐姆定律。</p><p class="right">只有溫度固定的金屬導體這類「歐姆元件」才遵守；燈絲和二極體的 I–V 圖都不是直線。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>（1）燈泡兩端電壓 3 V，電流 0.5 A，燈泡的電阻是多少？（2）同一個燈泡（電阻不變）接上 6 V，電流是多少？（3）6 Ω 的燈泡和可變電阻串聯在 3 V 的電池上，要讓電流是 0.2 A，可變電阻要調到多少？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>R = V ÷ I = 3 ÷ 0.5 = <strong>6 Ω</strong>。</li><li>I = V ÷ R = 6 ÷ 6 = <strong>1 A</strong>。電壓加倍，電流也加倍。</li><li>總電阻 = 3 ÷ 0.2 = 15 Ω，可變電阻 = 15 − 6 = <strong>9 Ω</strong>。</li></ol>
      </details>
    </div>`,
  widgets: { iv: (el) => ivPlot(el), wire: (el) => wireR(el) },
  keywords: [
    { t: '電阻', en: 'resistance, R', d: '導體阻礙電流的程度，R = V ÷ I。' },
    { t: '歐姆', en: 'ohm, Ω', d: '電阻的單位。1 Ω = 1 V/A。' },
    { t: '歐姆定律', en: "Ohm's law", d: '溫度固定時，金屬導體的電壓和電流成正比：V = I × R。' },
    { t: '可變電阻', en: 'variable resistor, rheostat', d: '可以改變電阻大小的元件，用來調整電流。' },
    { t: 'I–V 圖', en: 'I–V characteristic', d: '元件兩端電壓和電流的關係圖。' },
    { t: '二極體', en: 'diode', d: '只讓電流朝一個方向通過的元件。' },
    { t: '熱敏電阻', en: 'thermistor', d: '溫度越高，電阻越小的元件。' },
    { t: '光敏電阻', en: 'light-dependent resistor, LDR', d: '光越強，電阻越小的元件。' },
    { t: '電流的熱效應', en: 'heating effect of current', d: '電流通過導體使導體發熱的現象。' },
  ],
  quiz: [
    { q: '10 Ω 的電阻器通過 0.3 A 的電流，兩端電壓是多少？', options: ['0.03 V', '3 V', '30 V', '10.3 V'], answer: 1, why: 'V = I × R = 0.3 × 10 = 3 V。' },
    { q: '電壓不變，把電阻變成原來的 2 倍，電流會：', options: ['變成 2 倍', '變成一半', '不變', '變成 4 倍'], answer: 1, why: 'I = V ÷ R，R 變成 2 倍，I 變成一半。' },
    { q: '同樣材料、同樣粗細的導線，長度變成 2 倍，電阻會：', options: ['變成 2 倍', '變成一半', '不變', '變成 4 倍'], answer: 0, why: '電阻和長度成正比。' },
    { q: '哪一種元件的 I–V 圖是一條通過原點的直線？', options: ['溫度固定的定值電阻', '燈泡的燈絲', '二極體', '以上都是'], answer: 0, why: '定值電阻遵守歐姆定律，電壓和電流成正比，所以是直線。' },
  ],
  summary: [
    '電阻表示導體阻礙電流的程度：R = V ÷ I，單位歐姆 Ω。',
    '歐姆定律：溫度固定時 V = I × R，電壓和電流成正比。',
    '導線越長、越細，電阻越大；材料和溫度也會影響電阻。',
    '可變電阻改變接入電路的電阻線長度，用來調整電流。',
    '串聯電路中任何一處的電阻變大，整個電路的電流都會變小。',
  ],
};
