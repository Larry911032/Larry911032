// 第 3 課 電壓：伏特計探棒量電位差，加上電位高度圖
import { Stage, THREE, V3, ChargeFlow, makeBattery, makeLamp, makeMeter, solid, cyl, fmt, pal } from '../three-kit.js';
import { Net } from '../circuit.js';
import { T, wire, controls, readouts, emitter, numTags } from './rig.js';
import { waterSVG } from '../widgets.js';

const RA = 6;

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.2, 5.2, 7.0], target: [0, 0.3, 0.05], fov: 31 });
  const flow = new ChargeFlow(stage, { K: 1.4 });
  const state = { cells: 2, rb: 6, chips: false, probes: 'battery', next: 'red' };
  const ev = emitter();

  const bat = makeBattery({ cells: 2, length: 1.9 }); bat.group.position.set(-0.2, 0, 1.15);
  const lampA = makeLamp(); lampA.group.position.set(-1.25, 0, -1.0);
  const lampB = makeLamp(); lampB.group.position.set(1.25, 0, -1.0);
  const vm = makeMeter('V', { ticks: [0, 1, 2, 3, 4, 5, 6], plusLeft: true }); vm.group.position.set(0, 0, 0.0);
  stage.add(bat.group, lampA.group, lampB.group, vm.group);
  [lampA, lampB, vm].forEach((c) => stage.addTicker(c.tick));

  const net = new Net();
  const n = { bp: net.node(), br: net.node(), bl: net.node(), ar: net.node(), al: net.node() };
  const src = net.V(n.bp, 0, 3);
  const eB = net.R(n.br, n.bl, 6);
  const eA = net.R(n.ar, n.al, RA);
  const wires = [
    wire(stage, flow, net, T(bat, 'plus'), T(lampB, 'right'), n.bp, n.br, [[2.4, 1.15], [2.4, -1.0]]),
    wire(stage, flow, net, T(lampB, 'left'), T(lampA, 'right'), n.bl, n.ar),
    wire(stage, flow, net, T(lampA, 'left'), T(bat, 'minus'), n.al, 0, [[-2.4, -1.0], [-2.4, 1.15]]),
  ];
  const vAt = (w, u) => net.v[w.mesh.userData.nA] + (net.v[w.mesh.userData.nB] - net.v[w.mesh.userData.nA]) * u;

  // 探棒
  const P = pal();
  const probes = ['red', 'black'].map((role) => {
    const g = new THREE.Group();
    const tip = solid(new THREE.ConeGeometry(0.035, 0.16, 14).rotateX(Math.PI), 'metal', { hull: 0.006 }); tip.position.y = 0.1; g.add(tip);
    const handle = cyl(0.045, 0.32, role, { seg: 14, hull: 0.01 }); handle.position.y = 0.34; g.add(handle);
    stage.add(g);
    const lead = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: role === 'red' ? P.red : P.black, roughness: 0.7 }));
    lead.castShadow = true; stage.add(lead);
    return { role, g, lead, w: wires[0], u: 0.1 };
  });
  const term = { red: T(vm, 'plus'), black: T(vm, 'minus') };
  function placeProbe(pr) {
    const p = pr.w.path.getPoint(pr.u);
    pr.g.position.set(p.x, p.y + 0.02, p.z);
    const a = term[pr.role].p.clone(), b = p.clone().add(V3(0, 0.5, 0));
    const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 0.45;
    const curve = new THREE.CatmullRomCurve3([a, a.clone().add(term[pr.role].d.clone().multiplyScalar(0.18)), mid, b]);
    pr.lead.geometry.dispose();
    pr.lead.geometry = new THREE.TubeGeometry(curve, 48, 0.018, 6, false);
  }
  const PRESETS = {
    battery: [[0, 0.06], [2, 0.94]],
    lampA: [[1, 0.88], [2, 0.08]],
    lampB: [[0, 0.95], [1, 0.12]],
    wire: [[0, 0.12], [0, 0.88]],
    both: [[0, 0.95], [2, 0.08]],
  };
  function applyPreset(name) {
    const p = PRESETS[name]; if (!p) return;
    probes.forEach((pr, i) => { pr.w = wires[p[i][0]]; pr.u = p[i][1]; placeProbe(pr); });
  }
  // 點導線放探棒（用比較粗的隱形管子當點擊範圍，手指比較好點）
  wires.forEach((w) => {
    const pick = new THREE.Mesh(new THREE.TubeGeometry(w.path, Math.ceil(w.path.getLength() * 12), 0.15, 6, false), new THREE.MeshBasicMaterial({ visible: false }));
    stage.add(pick); w.pick = pick;
  });
  wires.forEach((w) => stage.addClickable(w.pick, (hit) => {
    let best = 0, bd = Infinity; const q = V3();
    for (let i = 0; i <= 240; i++) { w.path.getPoint(i / 240, q); const d = q.distanceToSquared(hit.point); if (d < bd) { bd = d; best = i / 240; } }
    const pr = probes[state.next === 'red' ? 0 : 1];
    pr.w = w; pr.u = Math.min(0.97, Math.max(0.03, best)); placeProbe(pr);
    state.probes = 'custom';
    set({ next: state.next === 'red' ? 'black' : 'red' }, true);
  }));

  // 標籤
  numTags(stage, [V3(-0.2, 0.72, 1.45), V3(-1.75, 1.15, -1.0), V3(0.75, 1.15, -1.0), V3(-0.62, 0.78, 0.0), V3(2.4, 0.32, 0.1)]);
  stage.addLabel('燈泡 A', V3(-1.25, 1.12, -1.0), { cls: 'chip small' });
  stage.addLabel('燈泡 B', V3(1.25, 1.12, -1.0), { cls: 'chip small' });
  const batLab = stage.addLabel('', V3(-0.2, 0.1, 1.62), { cls: 'chip small' });
  const vmLab = stage.addLabel('', V3(0, 0.88, 0.1), { cls: 'chip' });
  const chipLabs = wires.map((w) => stage.addLabel('', w.path.getPoint(0.5).add(V3(0, 0.25, 0)), { cls: 'chip', hidden: true }));

  // 電位高度圖（放在讀數下方）
  const stair = document.createElement('div'); stair.className = 'stair';
  stair.innerHTML = '<svg viewBox="0 0 360 170" role="img" aria-label="電位高度圖：電池把電位抬高，經過兩個燈泡時各降低一段"></svg>';
  readoutsEl.insertAdjacentElement('afterend', stair);
  const sv = stair.querySelector('svg');
  let stairPts = [];
  function drawStair() {
    const V = src.V, vA = net.vd(eA), vB = net.vd(eB);
    const y = (v) => 140 - (v / 6) * 112;
    const xs = [24, 74, 144, 184, 244, 284, 340];
    stairPts = [[xs[0], y(0)], [xs[1], y(V)], [xs[2], y(V)], [xs[3], y(V - vB)], [xs[4], y(V - vB)], [xs[5], y(0)], [xs[6], y(0)]];
    const lab = (x, t) => `<text x="${x}" y="160" class="st-lab" text-anchor="middle">${t}</text>`;
    sv.innerHTML = `<text x="10" y="16" class="st-title">電位高度圖（高度＝電位）</text>
      <line x1="16" y1="${y(0)}" x2="350" y2="${y(0)}" class="st-axis"/>
      <polyline points="${stairPts.map((p) => p.join(',')).join(' ')}" class="st-line"/>
      ${lab(49, '電池')}${lab(109, '導線')}${lab(164, '燈泡 B')}${lab(214, '導線')}${lab(264, '燈泡 A')}${lab(312, '導線')}
      <text x="${xs[1] + 4}" y="${y(V) - 8}" class="st-val">${V.toFixed(1)} V</text>
      <text x="${xs[3] + 6}" y="${(y(V) + y(V - vB)) / 2 + 4}" class="st-val">−${vB.toFixed(1)}</text>
      <text x="${xs[5] + 6}" y="${(y(V - vB) + y(0)) / 2 + 4}" class="st-val">−${vA.toFixed(1)}</text>
      <text x="${xs[6] - 2}" y="${y(0) - 8}" class="st-val" text-anchor="end">0 V</text>
      <circle r="5" class="st-dot" cx="${xs[0]}" cy="${y(0)}"/>`;
  }

  const ui = controls(controlsEl, [
    { type: 'range', id: 'cells', label: '電池', min: 1, max: 4, step: 1, value: 2, fmt: (v) => `${v} 顆・${(v * 1.5).toFixed(1)} V` },
    { type: 'range', id: 'rb', label: '燈泡 B 的電阻', min: 3, max: 24, step: 3, value: 6, fmt: (v) => `${v} Ω` },
    { type: 'toggle', id: 'chips', label: '顯示每條導線的電位', value: false },
    { type: 'seg', id: 'next', label: '點導線放', options: [{ value: 'red', label: '紅色探棒（＋）' }, { value: 'black', label: '黑色探棒（－）' }], value: 'red' },
    { type: 'buttons', label: '直接量', items: [{ id: 'pBat', label: '電池' }, { id: 'pA', label: '燈泡 A' }, { id: 'pB', label: '燈泡 B' }, { id: 'pW', label: '一條導線' }, { id: 'swap', label: '紅黑對調', cls: 'ghost' }] },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'v', label: '電池電壓' }, { id: 'i', label: '電流' }, { id: 'va', label: '燈泡 A 兩端' }, { id: 'vb', label: '燈泡 B 兩端' }, { id: 'vm', label: '伏特計讀數', cls: 'em' },
  ]);
  ui.on('cells', (v) => set({ cells: v }, true)).on('rb', (v) => set({ rb: v }, true)).on('chips', (v) => set({ chips: v }, true)).on('next', (v) => set({ next: v }, true))
    .on('pBat', () => set({ probes: 'battery' }, true)).on('pA', () => set({ probes: 'lampA' }, true)).on('pB', () => set({ probes: 'lampB' }, true)).on('pW', () => set({ probes: 'wire' }, true))
    .on('swap', () => act('swap'));

  let shownCells = 2, reading = 0;
  function solve() {
    src.V = 1.5 * state.cells; eB.R = state.rb;
    net.solve();
    if (shownCells !== state.cells) { bat.setCells(state.cells); shownCells = state.cells; }
    [[lampA, eA], [lampB, eB]].forEach(([l, e]) => l.setBrightness(0.9 * Math.sqrt((e.I * e.I * e.R) / 1.5)));
    const [r, b] = probes;
    reading = vAt(r.w, r.u) - vAt(b.w, b.u);
    vm.setValue(reading);
    batLab.set(`${src.V.toFixed(1)} V`);
    vmLab.set(`伏特計 <b>${reading >= 0 ? '' : '−'}${fmt(Math.abs(reading))} V</b>`);
    wires.forEach((w, k) => { chipLabs[k].set(`電位 <b>${fmt(vAt(w, 0.5), 1)} V</b>`); chipLabs[k].show(state.chips); });
    ro.set('v', `${src.V.toFixed(1)} V`); ro.set('i', `${fmt(eA.I)} A`);
    ro.set('va', `${fmt(net.vd(eA))} V`); ro.set('vb', `${fmt(net.vd(eB))} V`);
    ro.set('vm', `${reading < -0.005 ? '−' : ''}${fmt(Math.abs(reading))} V${reading < -0.05 ? '（探棒接反了）' : ''}`, reading < -0.05 ? 'warn' : '');
    drawStair();
  }
  function act(name) {
    if (name === 'swap') {
      const [r, b] = probes; [r.w, b.w] = [b.w, r.w]; [r.u, b.u] = [b.u, r.u];
      placeProbe(r); placeProbe(b); state.probes = 'custom'; solve(); ev.emit(get());
    }
  }
  function get() { return { ...state, reading, vA: net.vd(eA), vB: net.vd(eB), V: src.V }; }
  function set(p, user = false) {
    const prevProbes = state.probes;
    Object.assign(state, p);
    if (p.probes && (p.probes !== prevProbes || !user || p.probes !== 'custom')) applyPreset(state.probes);
    if (!user) ['cells', 'rb', 'chips'].forEach((k) => ui.show(k, state[k]));
    ui.show('next', state.next);
    solve(); ev.emit(get());
  }

  // 高度圖上的小紅點：跟著一個「正電荷」繞電路走一圈
  let tt = 0;
  stage.addTicker((dt) => {
    if (!stairPts.length) return;
    tt = (tt + dt * 0.12) % 1;
    const segLen = []; let total = 0;
    for (let k = 1; k < stairPts.length; k++) { const d = Math.hypot(stairPts[k][0] - stairPts[k - 1][0], stairPts[k][1] - stairPts[k - 1][1]); segLen.push(d); total += d; }
    let s = tt * total, k = 0;
    while (k < segLen.length - 1 && s > segLen[k]) { s -= segLen[k]; k++; }
    const f = segLen[k] ? s / segLen[k] : 0;
    const dot = sv.querySelector('.st-dot');
    if (dot) { dot.setAttribute('cx', (stairPts[k][0] + (stairPts[k + 1][0] - stairPts[k][0]) * f).toFixed(1)); dot.setAttribute('cy', (stairPts[k][1] + (stairPts[k + 1][1] - stairPts[k][1]) * f).toFixed(1)); }
  });

  const VIEWS = {
    front: [[0.2, 5.2, 7.0], [0, 0.3, 0.05]],
    probe: [[0.3, 3.3, 4.6], [0, 0.35, 0.1]],
    lamps: [[0, 2.7, 2.9], [0, 0.35, -0.8]],
  };
  applyPreset('battery'); solve();
  return {
    stage, set, get, act, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); stair.remove(); },
  };
}

export default {
  num: 3, slug: 'voltage', title: '電壓', en: 'Potential difference',
  short: '電池到底給了電荷什麼？用伏特計量量看電路裡的「高低差」。',
  bigIdea: '電壓是推動電荷的原因。電池讓每 1 庫侖的電荷帶著能量出發，燈泡把這些能量轉換成光和熱；兩點之間的電壓，就是每庫侖電荷在這兩點之間轉換了多少能量。',
  goals: ['知道電壓是每庫侖電荷轉換的能量：V = E ÷ Q', '用伏特計測量電壓，知道伏特計要並聯', '知道串聯時，各元件的電壓加起來等於電池的電壓'],
  predict: {
    q: '兩個一樣的燈泡串聯在 3 V 的電池上。每個燈泡兩端的電壓是多少？',
    options: ['每個都是 3 V', '兩個加起來是 3 V，所以各 1.5 V', '都是 0 V，因為電壓被電流帶走了'],
    answer: 1,
    why: '<p>電池給每 1 庫侖的電荷 3 焦耳的能量。電荷經過燈泡 A 時交出一部分，經過燈泡 B 時交出剩下的，回到電池時剛好用完。所以兩個燈泡的電壓<strong>加起來等於 3 V</strong>。兩個燈泡一樣時，就各分到 1.5 V。</p>',
  },
  figure: {
    title: '用伏特計量兩個燈泡',
    alt: '立體圖：電池和兩個燈泡串聯成一圈，中間放著一台伏特計，紅色和黑色探棒可以放在任何一條導線上。',
    legend: ['電池（每顆 1.5 V）', '燈泡 A（6 Ω）', '燈泡 B（電阻可以調）', '伏特計：紅色探棒接＋，黑色探棒接－', '導線：點一下就能放探棒'],
    note: '在圖上點任何一條導線，就會把探棒放在那裡（紅、黑輪流）。下面的高度圖用高度表示電位。',
    mount,
  },
  watch: [
    { text: '兩個燈泡串聯在 3 V 的電池上（兩顆 1.5 V）。電池讓每 1 庫侖的電荷帶著 3 焦耳的能量出發。', set: { cells: 2, rb: 6, chips: false, probes: 'battery' }, view: 'front' },
    { text: '伏特計的兩支探棒放在電池兩端：讀數 <strong>3.0 V</strong>，這就是電池的<strong>電壓</strong>。', set: { cells: 2, rb: 6, chips: false, probes: 'battery' }, view: 'probe' },
    { text: '打開「顯示每條導線的電位」：接正極的導線是 3 V，接負極的導線是 0 V。電路裡各點的<strong>電位</strong>有高有低，就像地勢有高有低。', set: { cells: 2, rb: 6, chips: true, probes: 'battery' }, view: 'front' },
    { text: '量燈泡 A 兩端：1.5 V。再量燈泡 B：也是 1.5 V。兩個燈泡<strong>分掉</strong>電池的 3 V：1.5 + 1.5 = 3。', set: { cells: 2, rb: 6, chips: true, probes: 'lampA' }, view: 'front' },
    { text: '把燈泡 B 換成電阻比較大的（12 Ω）：B 分到比較多的電壓（2 V），A 只分到 1 V，加起來還是 3 V。電阻越大，分到的電壓越多。', set: { cells: 2, rb: 12, chips: true, probes: 'lampB' }, view: 'lamps' },
    { text: '把兩支探棒放在<strong>同一條導線</strong>的兩端：讀數幾乎是 0 V。導線幾乎不消耗能量，所以導線兩端幾乎沒有電壓。', set: { cells: 2, rb: 6, chips: false, probes: 'wire' }, view: 'probe' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>在立體圖上點一下任何一條導線，探棒就會放過去（紅、黑輪流）。試著量出每一段的電壓。</p></li>
      <li><p data-read>增加電池的數量，兩個燈泡的電壓怎麼變？加起來還是等於電池電壓嗎？</p><button type="button" class="act" data-set='{"cells":4}'>換成 4 顆電池</button></li>
      <li><p data-read>把紅黑探棒對調，讀數變成負的。伏特計的＋端要接在電位比較高的那一側。</p><button type="button" class="act" data-act="swap">紅黑對調</button></li>
      <li><p data-read>同時量兩個燈泡（從燈泡 B 的前面量到燈泡 A 的後面），讀數是多少？</p><button type="button" class="act" data-set='{"probes":"both"}'>量兩個燈泡</button></li>
    </ul>`,
  challenge: {
    text: '調整電池和燈泡 B 的電阻，再用探棒量，讓伏特計剛好讀到 <strong>4.0 V</strong>。',
    check: (s) => Math.abs(s.reading - 4) <= 0.05,
    done: '6 V 的電池配上 6 Ω 和 12 Ω：電阻 12 Ω 的燈泡分到 4 V，6 Ω 的分到 2 V。也可以讓燈泡 B 是 3 Ω，再量燈泡 A。',
  },
  body: `
    <h3>電池給電荷「能量」</h3>
    <p data-read>電池裡的化學反應會把化學能交給電荷。電荷在電路裡繞一圈，經過燈泡時把能量交出去，燈絲變熱而發光。電荷回到電池後，又重新得到能量。</p>
    <div class="formula">
      <p class="f-main" data-say="V 等於 E 除以 Q">V = E ÷ Q</p>
      <dl class="f-legend"><div><dt>V</dt><dd>電壓（電位差），單位<strong>伏特（V）</strong></dd></div><div><dt>E</dt><dd>轉換的能量，單位焦耳（J）</dd></div><div><dt>Q</dt><dd>電量，單位庫侖（C）</dd></div></dl>
      <p class="f-note">1 V = 1 J/C。1.5 V 的電池，表示每 1 庫侖電荷流過它，可以得到 1.5 焦耳的能量。有些課本把能量寫成 W。</p>
    </div>

    <h3>用水位來想電壓</h3>
    <div class="widget" data-widget="water"></div>
    <table class="tbl"><thead><tr><th>水路</th><th>電路</th></tr></thead><tbody>
      <tr><td>抽水機把水抬高</td><td>電池讓電荷得到能量</td></tr>
      <tr><td>兩處的高度差</td><td>兩點之間的電壓（電位差）</td></tr>
      <tr><td>每秒流過的水量</td><td>電流</td></tr>
      <tr><td>水車（被水推動）</td><td>燈泡（把電能轉成光和熱）</td></tr>
      <tr><td>水管</td><td>導線</td></tr></tbody></table>
    <p data-read>比喻只是幫助想像。電路裡沒有水真的往下流，但「電位有高有低，電荷從高電位經過燈泡流到低電位」這個想法很好用。</p>

    <h3>用伏特計測量電壓</h3>
    <ul class="dot-list">
      <li data-read>伏特計要和待測的元件<strong>並聯</strong>，也就是兩支探棒分別接在元件的兩端。</li>
      <li data-read>紅色的＋端接在電位比較高的一側（靠近電池正極），黑色的－端接在電位比較低的一側。</li>
      <li data-read>伏特計的電阻非常大，幾乎沒有電流流過它，所以接上去不會影響原來的電路。</li>
    </ul>

    <h3>串聯時，電壓會分配</h3>
    <p data-read>串聯電路中，各元件的電壓加起來等於電源電壓：V = V<sub>A</sub> + V<sub>B</sub>。電阻越大的元件，分到的電壓越多。在立體圖下面的高度圖裡，每經過一個燈泡就「下一段階梯」，階梯的高度就是那個燈泡的電壓。</p>

    <h3>電池串聯，電壓相加</h3>
    <p data-read>把電池正極接負極串起來，總電壓就是各電池電壓的和：4 顆 1.5 V 的電池串聯是 6 V。如果其中一顆裝反了，它的電壓反而要扣掉。</p>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">電壓會流過電路。</p><p class="right">流動的是電荷（電流）。電壓是兩點之間的「差」，就像兩個地方的高度差。</p></div>
      <div class="myth"><p class="wrong">伏特計要串聯在電路裡。</p><p class="right">伏特計要並聯在要量的元件兩端；串聯的是安培計。</p></div>
      <div class="myth"><p class="wrong">電池裡裝的是電子，電子用完就沒電了。</p><p class="right">電池儲存的是化學能。電子本來就在導線裡，電池只是給它們能量。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>（1）一個燈泡兩端的電壓是 3 V，10 秒內有 2 C 的電量通過，燈泡轉換了多少能量？（2）兩個燈泡串聯在 4.5 V 的電源上，燈泡 A 兩端是 1.5 V，燈泡 B 兩端是多少？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>E = Q × V = 2 × 3 = <strong>6 J</strong>。</li><li>串聯時電壓相加等於電源電壓：4.5 − 1.5 = <strong>3 V</strong>。</li></ol>
      </details>
    </div>`,
  widgets: { water: (el) => { el.innerHTML = waterSVG(); } },
  keywords: [
    { t: '電壓（電位差）', en: 'potential difference, voltage', d: '每 1 庫侖電荷在兩點之間轉換的能量。' },
    { t: '伏特', en: 'volt, V', d: '電壓的單位。1 V = 1 J/C。' },
    { t: '電位', en: 'electric potential', d: '電路中某一點的「高度」。兩點電位的差就是電壓。' },
    { t: '伏特計', en: 'voltmeter', d: '測量電壓的儀器，要和元件並聯。' },
    { t: '並聯', en: 'in parallel', d: '兩端分別接在同樣兩點上的接法，例如伏特計和待測元件。' },
    { t: '焦耳', en: 'joule, J', d: '能量的單位。' },
    { t: '電源', en: 'power supply', d: '提供電壓、讓電荷得到能量的裝置，例如電池。' },
  ],
  quiz: [
    { q: '9 V 的電池讓 2 C 的電量通過，總共交給電荷多少能量？', options: ['4.5 J', '11 J', '18 J', '7 J'], answer: 2, why: 'E = Q × V = 2 × 9 = 18 J。' },
    { q: '伏特計應該怎麼接？', options: ['和待測元件並聯', '和待測元件串聯', '只接元件的一端', '接在開關上'], answer: 0, why: '伏特計量的是兩點之間的電壓，所以兩支探棒要分別接在元件兩端（並聯）。' },
    { q: '兩個燈泡串聯在 6 V 的電源上，燈泡 A 兩端是 2 V，燈泡 B 兩端是：', options: ['2 V', '4 V', '6 V', '8 V'], answer: 1, why: '串聯時各元件的電壓加起來等於電源電壓：6 − 2 = 4 V。' },
    { q: '「1 伏特」的意思是：', options: ['每 1 庫侖的電荷轉換 1 焦耳的能量', '每秒有 1 庫侖通過', '每秒轉換 1 焦耳的能量', '1 安培的電流'], answer: 0, why: 'V = E ÷ Q，所以 1 V = 1 J/C。每秒有 1 庫侖通過是 1 安培；每秒轉換 1 焦耳是 1 瓦特。' },
  ],
  summary: [
    '電壓（電位差）是每 1 庫侖電荷在兩點之間轉換的能量：V = E ÷ Q，單位伏特 V。',
    '電池提供電壓，讓電荷得到能量；燈泡把電能轉換成光和熱。',
    '伏特計要並聯在待測元件兩端，＋端接電位較高的一側。',
    '串聯電路中，各元件的電壓相加等於電源電壓；電阻越大，分到的電壓越多。',
    '導線兩端的電壓幾乎是 0；電池串聯時電壓相加。',
  ],
};
