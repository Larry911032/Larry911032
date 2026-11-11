// 第 5 課 串聯與並聯：同樣兩個燈泡，兩種接法
import { Stage, THREE, V3, ChargeFlow, makeBattery, makeLamp, makeMeter, surf, fmt } from '../three-kit.js';
import { Net } from '../circuit.js';
import { T, wire, controls, readouts, emitter } from './rig.js';

const R1 = 6;

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.2, 5.5, 7.3], target: [0, 0.3, 0.05], fov: 31 });
  const state = { mode: 'series', r2: 6, p1: true, p2: true };
  const ev = emitter();

  function build(mode) {
    const group = new THREE.Group(); stage.add(group);
    const flow = new ChargeFlow(stage, { K: 1.4 });
    const net = new Net();
    const bat = makeBattery({ cells: 2, length: 1.8 }); bat.group.position.set(-0.3, 0, 1.25);
    const am = makeMeter('A', { plusLeft: true, ticks: [0, 0.4, 0.8, 1.2, 1.6, 2] }); am.group.position.set(1.65, 0, 1.15);
    const L1 = makeLamp(), L2 = makeLamp();
    group.add(bat.group, am.group, L1.group, L2.group);
    [am, L1, L2].forEach((c) => stage.addTicker(c.tick));
    const n = {}; ['bp', 'ap', 'am', 'l1r', 'l1l', 'l2r', 'l2l'].forEach((k) => { n[k] = net.node(); });
    net.V(n.bp, 0, 3);
    const eA = net.R(n.ap, n.am, 0.01);
    const e1 = net.R(n.l1r, n.l1l, R1);
    const e2 = net.R(n.l2r, n.l2l, 6);
    const W = (...a) => { const w = wire(stage, flow, net, ...a); group.add(w.mesh); return w; };
    if (mode === 'series') {
      L2.group.position.set(1.15, 0, -1.0); L1.group.position.set(-1.15, 0, -1.0);
    } else {
      L1.group.position.set(0, 0, -1.1); L2.group.position.set(0, 0, -0.05);
    }
    W(T(bat, 'plus'), T(am, 'plus'), n.bp, n.ap);
    if (mode === 'series') {
      W(T(am, 'minus'), T(L2, 'right'), n.am, n.l2r, [[2.65, 1.25], [2.65, -1.0]]);
      W(T(L2, 'left'), T(L1, 'right'), n.l2l, n.l1r);
      W(T(L1, 'left'), T(bat, 'minus'), n.l1l, 0, [[-2.65, -1.0], [-2.65, 1.25]]);
    } else {
      const jr = net.node(), jl = net.node();
      const JR = { p: V3(2.65, 0.05, -0.05) }, JL = { p: V3(-2.65, 0.05, -0.05) };
      W(T(am, 'minus'), JR, n.am, jr, [[2.65, 1.25]]);
      W(JR, T(L1, 'right'), jr, n.l1r, [[2.65, -1.1]]);
      W(JR, T(L2, 'right'), jr, n.l2r);
      W(T(L1, 'left'), JL, n.l1l, jl, [[-2.65, -1.1]]);
      W(T(L2, 'left'), JL, n.l2l, jl);
      W(JL, T(bat, 'minus'), jl, 0, [[-2.65, 1.25]]);
      for (const J of [JR, JL]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), surf('dark')); b.position.copy(J.p); group.add(b); }
    }
    const lp = (L) => L.group.position;
    const labs = [
      stage.addLabel('1', () => lp(L1).clone().add(V3(-0.5, 1.0, 0)), { cls: 'num' }),
      stage.addLabel('2', () => lp(L2).clone().add(V3(-0.5, 1.0, 0)), { cls: 'num' }),
      stage.addLabel('3', V3(1.1, 0.82, 1.15), { cls: 'num' }),
      stage.addLabel('4', V3(-0.3, 0.72, 1.55), { cls: 'num' }),
    ];
    const l1Lab = stage.addLabel('', () => lp(L1).clone().add(V3(0, 1.22, 0)), { cls: 'chip' });
    const l2Lab = stage.addLabel('', () => lp(L2).clone().add(V3(0, 1.22, 0)), { cls: 'chip' });
    const aLab = stage.addLabel('', V3(1.65, 0.9, 1.25), { cls: 'chip' });
    const c = {
      mode, group, flow, net, eA, e1, e2, L1, L2,
      labels: [...labs, l1Lab, l2Lab, aLab],
      solve() {
        e1.R = state.p1 ? R1 : 1e9; e2.R = state.p2 ? state.r2 : 1e9;
        net.solve();
        L1.setPresent(state.p1); L2.setPresent(state.p2);
        L1.setBrightness(0.9 * Math.sqrt((e1.I * e1.I * R1) / 1.5));
        L2.setBrightness(0.9 * Math.sqrt((e2.I * e2.I * state.r2) / 1.5));
        am.setValue(eA.I);
        const lab = (on, e, k) => (on ? `燈泡 ${k}：<b>${fmt(net.vd(e))} V</b>・<b>${fmt(e.I)} A</b>` : `燈泡 ${k} 拿掉了`);
        l1Lab.set(lab(state.p1, e1, 1)); l2Lab.set(lab(state.p2, e2, 2));
        aLab.set(`總電流 <b>${fmt(eA.I)} A</b>`);
        return { It: eA.I, I1: state.p1 ? e1.I : 0, I2: state.p2 ? e2.I : 0, V1: state.p1 ? net.vd(e1) : 0, V2: state.p2 ? net.vd(e2) : 0 };
      },
    };
    stage.addClickable(L1.group, () => { if (state.mode === mode) set({ p1: !state.p1 }, true); });
    stage.addClickable(L2.group, () => { if (state.mode === mode) set({ p2: !state.p2 }, true); });
    return c;
  }
  const circuits = { series: build('series'), parallel: build('parallel') };

  const ui = controls(controlsEl, [
    { type: 'seg', id: 'mode', label: '接法', options: [{ value: 'series', label: '串聯' }, { value: 'parallel', label: '並聯' }], value: 'series' },
    { type: 'range', id: 'r2', label: '燈泡 2 的電阻', min: 3, max: 18, step: 3, value: 6, fmt: (v) => `${v} Ω` },
    { type: 'buttons', label: '燈泡', items: [{ id: 't1', label: '拿掉／裝回燈泡 1' }, { id: 't2', label: '拿掉／裝回燈泡 2' }] },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'it', label: '總電流（安培計）', cls: 'em' }, { id: 'i1', label: '燈泡 1 的電流' }, { id: 'i2', label: '燈泡 2 的電流' },
    { id: 'v1', label: '燈泡 1 兩端' }, { id: 'v2', label: '燈泡 2 兩端' }, { id: 'rt', label: '總電阻 = 3 V ÷ 總電流' },
  ]);
  ui.on('mode', (v) => set({ mode: v }, true)).on('r2', (v) => set({ r2: v }, true))
    .on('t1', () => set({ p1: !state.p1 }, true)).on('t2', () => set({ p2: !state.p2 }, true));

  let res = {};
  function solve() {
    for (const c of Object.values(circuits)) {
      const on = c.mode === state.mode;
      c.group.visible = on; c.flow.visible = on;
      c.labels.forEach((l) => l.show(on));
    }
    res = circuits[state.mode].solve();
    ro.set('it', `${fmt(res.It)} A`); ro.set('i1', `${fmt(res.I1)} A`); ro.set('i2', `${fmt(res.I2)} A`);
    ro.set('v1', `${fmt(res.V1)} V`); ro.set('v2', `${fmt(res.V2)} V`);
    ro.set('rt', res.It > 0.001 ? `${fmt(3 / res.It, 1)} Ω` : '無限大（斷路）');
  }
  function get() { return { ...state, ...res }; }
  function set(p, user = false) {
    Object.assign(state, p);
    ui.show('mode', state.mode); if (!user) ui.show('r2', state.r2);
    solve(); ev.emit(get());
  }

  const VIEWS = {
    front: [[0.2, 5.5, 7.3], [0, 0.3, 0.05]],
    lamps: [[0, 3.2, 3.4], [0, 0.45, -0.6]],
  };
  solve();
  return {
    stage, set, get, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 5, slug: 'circuits', title: '串聯與並聯', en: 'Series and parallel circuits',
  short: '同樣兩個燈泡，換個接法亮度就不同。家裡的電器為什麼都並聯？',
  bigIdea: '串聯只有一條路：電流處處相同，電壓被分掉。並聯有好幾條路：每條路的電壓相同，電流分開走，再匯合起來。',
  goals: ['比較串聯和並聯中電流、電壓、總電阻的規則', '解釋並聯時拿掉一個燈泡，其他燈泡為什麼還會亮', '知道家裡的電器都是並聯'],
  predict: {
    q: '兩個相同的燈泡，從串聯改成並聯（用同一顆電池）。燈泡會變得怎樣？',
    options: ['變暗', '一樣亮', '變亮'],
    answer: 2,
    why: '<p>串聯時，兩個燈泡要<strong>分</strong>電池的電壓，各只分到一半。並聯時，每個燈泡兩端都直接接在電池上，<strong>各自得到完整的電壓</strong>，電流比較大，所以比較亮。</p><p>代價是電池要送出比較大的總電流，電池會比較快沒電。</p>',
  },
  figure: {
    title: '兩個燈泡，兩種接法',
    alt: '立體圖：一個電池、一個安培計和兩個燈泡。可以切換成串聯（兩個燈泡排成一條路）或並聯（兩個燈泡各在一條路上）。',
    legend: ['燈泡 1（6 Ω）：點一下可以拿掉', '燈泡 2（電阻可調）：點一下可以拿掉', '安培計：量電池送出的總電流', '電池（3 V）'],
    note: '燈泡上方的小標籤是那個燈泡兩端的電壓和流過它的電流。',
    mount,
  },
  watch: [
    { text: '<strong>串聯</strong>：兩個燈泡排成一條路，同一股電流依序流過燈泡 2 和燈泡 1。', set: { mode: 'series', r2: 6, p1: true, p2: true }, view: 'front' },
    { text: '兩個燈泡<strong>分</strong>電池的 3 V，各分到 1.5 V，所以都比較暗。電流處處相同：0.25 A。', set: { mode: 'series', r2: 6, p1: true, p2: true }, view: 'lamps' },
    { text: '點一下燈泡 1 把它拿掉：整條路斷了，燈泡 2 也跟著熄滅。', set: { mode: 'series', r2: 6, p1: false, p2: true }, view: 'lamps' },
    { text: '<strong>並聯</strong>：每個燈泡各有一條路，兩端都直接接在電池上。', set: { mode: 'parallel', r2: 6, p1: true, p2: true }, view: 'front' },
    { text: '並聯時每個燈泡都分到完整的 3 V，所以比串聯時亮。總電流是兩條支路相加：0.5 + 0.5 = 1.0 A。', set: { mode: 'parallel', r2: 6, p1: true, p2: true }, view: 'lamps' },
    { text: '拿掉燈泡 1：另一條路還是通的，燈泡 2 照樣亮。家裡的電器就是這樣並聯的。', set: { mode: 'parallel', r2: 6, p1: false, p2: true }, view: 'lamps' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>點一下立體圖裡的燈泡，可以把它拿掉或裝回去。比較串聯和並聯時，另一個燈泡會怎樣。</p><button type="button" class="act" data-set='{"mode":"series","p1":true,"p2":true}'>串聯</button><button type="button" class="act" data-set='{"mode":"parallel","p1":true,"p2":true}'>並聯</button></li>
      <li><p data-read>把燈泡 2 換成 12 Ω。串聯時哪個燈泡比較亮？並聯時呢？</p><button type="button" class="act" data-set='{"mode":"series","r2":12,"p1":true,"p2":true}'>串聯、燈泡 2 是 12 Ω</button><button type="button" class="act" data-set='{"mode":"parallel","r2":12,"p1":true,"p2":true}'>並聯、燈泡 2 是 12 Ω</button></li>
      <li><p data-read>並聯時，看「總電阻」：它比 6 Ω 大還是小？</p></li>
    </ul>`,
  challenge: {
    text: '接成<strong>並聯</strong>，兩個燈泡都裝著，讓總電流剛好是燈泡 1 電流的 <strong>3 倍</strong>。',
    check: (s) => s.mode === 'parallel' && s.p1 && s.p2 && s.I1 > 0.01 && Math.abs(s.It / s.I1 - 3) < 0.05,
    done: '總電流 = I₁ + I₂。要等於 3 × I₁，燈泡 2 的電流就要是燈泡 1 的 2 倍，所以它的電阻是 6 ÷ 2 = 3 Ω。',
  },
  body: `
    <h3>串聯：只有一條路</h3>
    <ul class="dot-list">
      <li data-read>電流處處相等：I = I₁ = I₂。</li>
      <li data-read>各元件的電壓加起來等於電源電壓：V = V₁ + V₂。電阻大的分到比較多。</li>
      <li data-read>總電阻是各電阻相加：R = R₁ + R₂，越串越大。</li>
      <li data-read>任何一處斷了，整條路都沒有電流。</li>
    </ul>

    <h3>並聯：好幾條路</h3>
    <ul class="dot-list">
      <li data-read>每條支路兩端的電壓都相等：V = V₁ = V₂。</li>
      <li data-read>總電流等於各支路電流相加：I = I₁ + I₂。電阻小的支路，電流比較大。</li>
      <li data-read>總電阻比任何一條支路的電阻都小：1/R = 1/R₁ + 1/R₂。多開一條路，電流更好走。</li>
      <li data-read>各支路互不影響，一條斷了，其他照樣通。</li>
    </ul>
    <table class="tbl"><thead><tr><th></th><th>串聯</th><th>並聯</th></tr></thead><tbody>
      <tr><td>電流</td><td>處處相等</td><td>總電流 = 各支路相加</td></tr>
      <tr><td>電壓</td><td>各元件相加 = 電源電壓</td><td>每條支路都等於電源電壓</td></tr>
      <tr><td>總電阻</td><td>R₁ + R₂（變大）</td><td>比最小的支路還小</td></tr>
      <tr><td>一個壞掉</td><td>全部不亮</td><td>其他照樣亮</td></tr></tbody></table>

    <h3>家裡的電器為什麼都並聯</h3>
    <p data-read>家裡每個插座、每盞燈都並聯在電源上，所以每個電器都得到相同的 110 V，也可以各自開關，不會互相影響。如果用串聯，關掉一盞燈，全家的電器都會停掉。</p>

    <h3>延長線的隱憂</h3>
    <p data-read>延長線上的插座也是並聯。插得越多、開得越多，總電流就越大。總電流太大，電線會發燙，嚴重時會起火。這和下一課的電功率、第 7 課的用電安全都有關。</p>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">電流先經過的燈泡比較亮。</p><p class="right">串聯時電流處處相等，亮度由各燈泡的電阻決定，和誰先誰後無關。</p></div>
      <div class="myth"><p class="wrong">並聯的燈泡越多，每個燈越暗。</p><p class="right">每個燈的電壓不變，亮度也不變；但電池要送出更大的總電流，會比較快沒電。</p></div>
      <div class="myth"><p class="wrong">並聯會讓總電阻變大。</p><p class="right">多一條路，電流更容易通過，總電阻反而變小。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>6 Ω 和 3 Ω 的電阻接在 9 V 的電源上。（1）串聯時的電流和各自的電壓？（2）並聯時各支路的電流、總電流和總電阻？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>總電阻 6 + 3 = 9 Ω，電流 I = 9 ÷ 9 = <strong>1 A</strong>；V₁ = 1 × 6 = <strong>6 V</strong>，V₂ = 1 × 3 = <strong>3 V</strong>。</li><li>每條支路都是 9 V：I₁ = 9 ÷ 6 = <strong>1.5 A</strong>，I₂ = 9 ÷ 3 = <strong>3 A</strong>，總電流 <strong>4.5 A</strong>，總電阻 9 ÷ 4.5 = <strong>2 Ω</strong>。</li></ol>
      </details>
    </div>`,
  keywords: [
    { t: '串聯', en: 'series circuit', d: '元件一個接一個排成一條路，電流依序流過每個元件。' },
    { t: '並聯', en: 'parallel circuit', d: '元件分別接在同樣的兩點之間，電流分成好幾條路。' },
    { t: '支路', en: 'branch', d: '並聯電路中分出來的每一條路。' },
    { t: '分歧點', en: 'junction', d: '電流分開或匯合的地方。' },
    { t: '總電阻', en: 'total resistance', d: '把整個電路看成一個電阻時的大小，等於電源電壓 ÷ 總電流。' },
  ],
  quiz: [
    { q: '2 Ω 和 4 Ω 的電阻串聯，接在 12 V 的電源上，電流是多少？', options: ['2 A', '3 A', '6 A', '8 A'], answer: 0, why: '總電阻 2 + 4 = 6 Ω，I = 12 ÷ 6 = 2 A。' },
    { q: '家裡的電器都用並聯，主要原因是：', options: ['每個電器都得到相同的電壓，而且可以各自開關', '這樣比較省電', '並聯的電流比較小', '串聯的電線比較貴'], answer: 0, why: '並聯時每個電器都接上 110 V，彼此獨立，關掉一個不影響其他的。' },
    { q: '兩個燈泡並聯，其中一個燒壞了，另一個會：', options: ['繼續亮，亮度不變', '跟著熄滅', '變得更暗', '變得更亮'], answer: 0, why: '並聯的支路互不影響，另一個燈泡兩端還是電源電壓。' },
    { q: '兩個 6 Ω 的電阻並聯，總電阻是：', options: ['12 Ω', '6 Ω', '3 Ω', '0 Ω'], answer: 2, why: '1/R = 1/6 + 1/6 = 1/3，所以 R = 3 Ω，比任何一個支路都小。' },
  ],
  summary: [
    '串聯：電流處處相等；各元件電壓相加等於電源電壓；總電阻 R = R₁ + R₂。',
    '並聯：各支路電壓相等；總電流等於各支路電流相加；總電阻比任何一條支路都小。',
    '串聯時一處斷路，整個電路都沒有電流；並聯時各支路互不影響。',
    '家裡的電器都是並聯，每個都接上相同的 110 V。',
    '並聯的電器越多，總電流越大，要小心過載。',
  ],
};
