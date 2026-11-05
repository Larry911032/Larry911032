// 第 1 課 電荷與靜電：兩顆吊起來的氣球
import { Stage, THREE, V3, solid, rbox, cyl, textSprite, pal, basic, surf } from '../three-kit.js';
import { controls, readouts, emitter, numTags } from './rig.js';
import { atomSVG } from '../widgets.js';

const HOOK_Y = 3.06; // 吊點高度
const LP = 2.0;      // 吊點到氣球中心
const BR = 0.36;     // 氣球半徑
const KC = 0.28;     // 電力強度（動畫用的比例）
const KI = 0.035;    // 感應吸引強度
const W2 = 6;        // 擺動快慢
const DAMP = 1.5;
const QMAX = 4;

// 電荷符號在氣球表面的排列
const PAT = [[0, 0.05], [-0.45, 0.32], [0.45, 0.32], [-0.48, -0.26], [0.48, -0.26], [0, 0.6], [0, -0.52], [-0.74, 0.03], [0.74, 0.03]];

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0, 2.5, 7.9], target: [0, 1.55, 0.1], fov: 32, refAspect: 1.15 });
  const P = pal();
  const state = { qa: 0, qb: 0, ca: 0, cb: 0, d: 1.0 };
  const ev = emitter();

  // 支架
  const base = solid(rbox(4.3, 0.12, 1.8, 0.05), 'wood'); base.position.set(0, 0.06, 0.3); stage.add(base);
  for (const s of [-1, 1]) { const post = cyl(0.05, 3.0, 'metal', { seg: 16 }); post.position.set(s * 2.0, 1.62, 0); stage.add(post); }
  const bar = cyl(0.04, 4.06, 'metal', { seg: 12 }); bar.rotation.z = Math.PI / 2; bar.position.set(0, HOOK_Y + 0.06, 0); stage.add(bar);

  // 毛布
  const clothPos = [V3(-1.25, 0.21, 0.9), V3(1.25, 0.21, 0.9)];
  clothPos.forEach((p) => { const c = solid(rbox(0.8, 0.18, 0.5, 0.08), 'wool', { rough: 1 }); c.position.copy(p); stage.add(c); });

  // 氣球
  const Y = V3(0, 1, 0);
  const balloons = [0, 1].map((i) => {
    const role = i ? 'balloonB' : 'balloonA';
    const g = new THREE.Group();
    const body = solid(new THREE.SphereGeometry(BR, 36, 28), role, { rough: 0.4 }); body.scale.set(1, 1.15, 1); g.add(body);
    const knot = cyl(0.016, 0.1, role, { r2: 0.05, seg: 12, hull: 0.008 }); knot.position.y = BR * 1.15 + 0.035; g.add(knot);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), basic('ink'));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.013, 8, 18), surf('metal')); ring.rotation.y = Math.PI / 2;
    stage.add(g, string, ring);
    const mk = (sign) => Array.from({ length: 9 }, () => {
      const sp = textSprite(sign, { bg: sign === '+' ? P.plus : P.electron, size: 0.17 });
      sp.material.depthTest = false; sp.renderOrder = 10; sp.visible = false; stage.add(sp); return sp;
    });
    return { g, string, ring, plus: mk('+'), minus: mk('−'), th: 0, om: 0 };
  });
  const hookX = (i) => (i ? 1 : -1) * state.d / 2;
  const center = (i, out = V3()) => out.set(hookX(i) + LP * Math.sin(balloons[i].th), HOOK_Y - LP * Math.cos(balloons[i].th), 0);

  // 飛行中的電子（摩擦、接地時的動畫）
  const flyers = [];
  const pool = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), basic('electron')); m.visible = false; stage.add(m); return m; });
  function fly(from, to, n = 2) {
    for (let k = 0; k < n; k++) {
      const mesh = pool.find((m) => !m.visible && !flyers.some((f) => f.mesh === m));
      if (!mesh) return;
      flyers.push({ mesh, from, to, t: -k * 0.16, dur: 0.7 });
    }
  }

  // 標籤
  const labA = stage.addLabel('', () => center(0).add(V3(0, -BR * 1.15 - 0.3, 0)), { cls: 'chip' });
  const labB = stage.addLabel('', () => center(1).add(V3(0, -BR * 1.15 - 0.3, 0)), { cls: 'chip' });
  const labCA = stage.addLabel('', clothPos[0].clone().add(V3(0, 0.38, 0)), { cls: 'chip small' });
  const labCB = stage.addLabel('', clothPos[1].clone().add(V3(0, 0.38, 0)), { cls: 'chip small' });
  const qText = (q) => (q === 0 ? '0' : q > 0 ? `+${q}` : `−${-q}`);
  numTags(stage, [() => center(0).add(V3(-0.5, 0.25, 0)), clothPos[0].clone().add(V3(-0.55, 0.2, 0)), () => V3(hookX(0) - 0.12, HOOK_Y - 0.6, 0)]);

  // 控制項
  const ui = controls(controlsEl, [
    { type: 'buttons', label: '氣球 A', items: [{ id: 'aRub', label: '和毛布摩擦（得到電子）' }, { id: 'aLose', label: '失去電子' }, { id: 'aGnd', label: '接地歸零', cls: 'ghost' }] },
    { type: 'buttons', label: '氣球 B', items: [{ id: 'bRub', label: '和毛布摩擦（得到電子）' }, { id: 'bLose', label: '失去電子' }, { id: 'bGnd', label: '接地歸零', cls: 'ghost' }] },
    { type: 'range', id: 'd', label: '吊點距離', min: 0.8, max: 2.0, step: 0.1, value: state.d, fmt: (v) => `${Math.round(v * 10)} cm` },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'qa', label: '氣球 A 的電' }, { id: 'qb', label: '氣球 B 的電' }, { id: 'force', label: '兩顆氣球之間' }, { id: 'angle', label: '吊線夾角' },
  ]);
  const balloonCenter = (i) => () => center(i);
  const clothTop = (i) => () => clothPos[i].clone().add(V3(0, 0.1, 0));
  const groundPt = (i) => () => V3(hookX(i) * 1.4, 0.1, 0.5);
  const rub = (i, gain) => {
    const k = i ? 'qb' : 'qa', c = i ? 'cb' : 'ca';
    if (gain && state[k] <= -QMAX) return;
    if (!gain && state[k] >= QMAX) return;
    if (gain) fly(clothTop(i), balloonCenter(i)); else fly(balloonCenter(i), clothTop(i));
    set({ [k]: state[k] + (gain ? -1 : 1), [c]: state[c] + (gain ? 1 : -1) }, true);
  };
  const ground = (i) => {
    const k = i ? 'qb' : 'qa';
    if (state[k] < 0) fly(balloonCenter(i), groundPt(i), Math.min(3, -state[k]));
    if (state[k] > 0) fly(groundPt(i), balloonCenter(i), Math.min(3, state[k]));
    set({ [k]: 0 }, true);
  };
  ui.on('aRub', () => rub(0, true)).on('aLose', () => rub(0, false)).on('aGnd', () => ground(0))
    .on('bRub', () => rub(1, true)).on('bLose', () => rub(1, false)).on('bGnd', () => ground(1))
    .on('d', (v) => set({ d: v }, true));

  function angleDeg() { return ((balloons[1].th - balloons[0].th) * 180) / Math.PI; }
  function kind() {
    const { qa, qb } = state;
    if (qa && qb) return qa * qb > 0 ? '互相排斥（同性電）' : '互相吸引（異性電）';
    if (qa || qb) return '互相吸引（靜電感應）';
    return '沒有電力';
  }
  function get() { return { ...state, angle: angleDeg(), kind: kind() }; }
  function refresh() {
    labA.set(`A <b>${qText(state.qa)}</b>`); labB.set(`B <b>${qText(state.qb)}</b>`);
    labCA.set(`毛布 <b>${qText(state.ca)}</b>`); labCB.set(`毛布 <b>${qText(state.cb)}</b>`);
    const desc = (q) => (q === 0 ? '不帶電' : q < 0 ? `負電（多 ${-q} 個電子）` : `正電（少 ${q} 個電子）`);
    ro.set('qa', desc(state.qa)); ro.set('qb', desc(state.qb)); ro.set('force', kind());
  }
  function set(p, user = false) {
    Object.assign(state, p);
    if (!user) {
      if ('qa' in p && !('ca' in p)) state.ca = -state.qa;
      if ('qb' in p && !('cb' in p)) state.cb = -state.qb;
      ui.show('d', state.d);
    }
    refresh();
    ev.emit(get());
  }

  // 每一格畫面：物理、氣球位置、電荷符號
  const ca = V3(), cb = V3(), right = V3(), up = V3(), fwd = V3(), tmp = V3(), hook = V3(), top = V3();
  let emitT = 0;
  stage.addTicker((dt, rdt) => {
    const steps = 6, h = dt / steps;
    for (let s = 0; s < steps && dt > 0; s++) {
      center(0, ca); center(1, cb);
      tmp.copy(ca).sub(cb); const r = Math.max(0.2, tmp.length()); tmp.divideScalar(r);
      let F = (KC * state.qa * state.qb) / (r * r);
      if ((state.qa === 0) !== (state.qb === 0)) F -= (KI * Math.pow(state.qa || state.qb, 2)) / Math.pow(r, 4);
      if (r < 2 * BR) F += 40 * (2 * BR - r);
      balloons.forEach((b, i) => {
        const sgn = i ? -1 : 1;
        const Ft = sgn * F * (tmp.x * Math.cos(b.th) + tmp.y * Math.sin(b.th));
        const acc = W2 * (Ft - Math.sin(b.th)) - DAMP * b.om;
        b.om += acc * h; b.th = Math.max(-1.25, Math.min(1.25, b.th + b.om * h));
      });
    }
    right.setFromMatrixColumn(stage.camera.matrixWorld, 0); up.setFromMatrixColumn(stage.camera.matrixWorld, 1);
    balloons.forEach((b, i) => {
      const c = center(i, i ? cb : ca);
      b.g.position.copy(c); b.g.rotation.z = b.th;
      hook.set(hookX(i), HOOK_Y, 0);
      tmp.set(-Math.sin(b.th), Math.cos(b.th), 0);
      top.copy(c).addScaledVector(tmp, BR * 1.15 + 0.085);
      b.string.position.copy(top).add(hook).multiplyScalar(0.5);
      b.string.scale.y = top.distanceTo(hook);
      b.string.quaternion.setFromUnitVectors(Y, tmp);
      b.ring.position.set(hook.x, HOOK_Y + 0.03, 0);
      // 電荷符號
      const q = i ? state.qb : state.qa, qo = i ? state.qa : state.qb;
      const list = [];
      if (q) for (let k = 0; k < Math.min(Math.abs(q), PAT.length); k++) list.push([q > 0 ? '+' : '-', PAT[k][0], PAT[k][1]]);
      else if (qo) {
        const other = center(1 - i, V3());
        const toward = Math.sign(tmp.copy(other).sub(c).dot(right)) || (i ? -1 : 1);
        const near = qo > 0 ? '-' : '+', far = qo > 0 ? '+' : '-';
        list.push([near, 0.56 * toward, 0.24], [near, 0.62 * toward, -0.14], [far, -0.56 * toward, 0.24], [far, -0.62 * toward, -0.14]);
      }
      fwd.copy(stage.camera.position).sub(c).normalize();
      let ip = 0, im = 0;
      for (const [s, ox, oy] of list) {
        const sp = s === '+' ? b.plus[ip++] : b.minus[im++];
        sp.visible = true;
        sp.position.copy(c).addScaledVector(right, ox * BR).addScaledVector(up, oy * BR * 1.15).addScaledVector(fwd, BR * 0.95);
      }
      for (let k = ip; k < 9; k++) b.plus[k].visible = false;
      for (let k = im; k < 9; k++) b.minus[k].visible = false;
    });
    // 飛行電子
    for (let k = flyers.length - 1; k >= 0; k--) {
      const f = flyers[k];
      f.t += rdt / f.dur;
      if (f.t < 0) { f.mesh.visible = false; continue; }
      if (f.t >= 1) { f.mesh.visible = false; flyers.splice(k, 1); continue; }
      const a = f.from(), z = f.to(); const mid = a.clone().lerp(z, 0.5); mid.y += 0.5;
      const t = f.t, u = 1 - t;
      f.mesh.visible = true;
      f.mesh.position.set(0, 0, 0).addScaledVector(a, u * u).addScaledVector(mid, 2 * u * t).addScaledVector(z, t * t);
    }
    const ang = angleDeg();
    ro.set('angle', `${Math.abs(ang).toFixed(0)}°${Math.abs(ang) < 1 ? '' : ang > 0 ? '（張開）' : '（靠攏）'}`);
    emitT += rdt;
    if (emitT > 0.3) { emitT = 0; ev.emit(get()); }
  });

  const VIEWS = {
    front: [[0, 2.5, 7.9], [0, 1.55, 0.1]],
    cloth: [[0, 2.4, 5.6], [0, 0.85, 0.5]],
    close: [[0, 1.9, 5.4], [0, 1.2, 0]],
  };
  refresh();
  return {
    stage, set, get, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 1, slug: 'charge', title: '電荷與靜電', en: 'Charge and static electricity',
  short: '為什麼摩擦過的氣球會黏在頭髮上？從電子搬家講起。',
  bigIdea: '所有東西都是由帶電的小粒子組成的。兩個物體摩擦時，只有<strong>電子</strong>會從一個物體跑到另一個物體，於是一個帶負電、另一個帶正電。',
  goals: ['說出原子裡的質子、中子、電子各帶什麼電', '用「電子轉移」解釋摩擦起電', '預測帶電的物體之間會互相吸引還是排斥'],
  predict: {
    q: '兩顆氣球都和毛布摩擦過，再並排吊起來。它們會怎樣？',
    options: ['互相吸引，靠在一起', '互相排斥，吊線張開', '沒有任何變化'],
    answer: 1,
    why: '<p>兩顆氣球都從毛布得到了電子，所以<strong>都帶負電</strong>。帶<strong>同種電</strong>的物體會<strong>互相排斥</strong>，吊線就張開了。</p><p>如果一顆帶負電、一顆帶正電（異種電），它們就會互相吸引而靠在一起。</p>',
  },
  figure: {
    title: '兩顆吊起來的氣球',
    alt: '立體圖：支架上用細線吊著兩顆氣球，下方各有一塊毛布。氣球上的紅色加號代表正電，藍色減號代表負電。',
    legend: ['氣球 A 和氣球 B', '毛布：和氣球摩擦，交換電子', '吊線：張開的角度代表推力大小'],
    note: '紅色＋是正電，藍色－是多出來的電子；每一個符號代表非常多個電荷。用下方的按鈕讓氣球得到或失去電子。',
    mount,
  },
  watch: [
    { text: '兩顆氣球都還沒摩擦。原子裡的正電（質子）和負電（電子）一樣多，互相抵消，所以氣球<strong>不帶電</strong>，吊線垂直向下。', set: { qa: 0, qb: 0, d: 1.0 }, view: 'front' },
    { text: '把氣球 A 和毛布摩擦：毛布上的一些<strong>電子跑到氣球 A 上</strong>。氣球 A 多了電子，帶<strong>負電</strong>；毛布少了電子，帶<strong>正電</strong>。', set: { qa: -3, qb: 0, d: 2.0 }, view: 'cloth' },
    { text: '氣球 B 也去摩擦，同樣帶負電。<strong>同性電荷互相排斥</strong>，兩顆氣球把彼此推開，吊線張開。', set: { qa: -3, qb: -3, d: 1.0 }, view: 'front' },
    { text: '如果氣球 B 是<strong>失去</strong>電子而帶正電，兩顆氣球帶異種電，<strong>異性電荷互相吸引</strong>，就靠在一起了。', set: { qa: -3, qb: 3, d: 1.0 }, view: 'front' },
    { text: '把氣球 B 接地，讓它恢復不帶電。帶負電的 A 還是會<strong>吸引不帶電的 B</strong>：B 靠近 A 的那一側出現正電，這叫<strong>靜電感應</strong>。', set: { qa: -3, qb: 0, cb: 0, d: 1.0 }, view: 'close' },
    { text: '數一數：氣球得到幾個電子，毛布就少了幾個。電荷沒有被製造或消滅，只是搬家，這叫<strong>電荷守恆</strong>。', set: { qa: -2, qb: -2, d: 1.2 }, view: 'cloth' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>讓兩顆氣球帶同種電，再把「吊點距離」拉近。推力變大還是變小？</p><button type="button" class="act" data-set='{"qa":-2,"qb":-2}'>設定 A −2、B −2</button></li>
      <li><p data-read>讓兩顆氣球帶異種電，它們會往哪裡移動？</p><button type="button" class="act" data-set='{"qa":-2,"qb":2}'>設定 A −2、B +2</button></li>
      <li><p data-read>只讓 A 帶電、B 不帶電。B 會被吸過去嗎？注意 B 上面正、負電的位置。</p><button type="button" class="act" data-set='{"qa":-4,"qb":0}'>設定 A −4、B 不帶電</button></li>
      <li><p data-read>電越多，吊線張得越開嗎？比較 −1 和 −4。</p><button type="button" class="act" data-set='{"qa":-1,"qb":-1}'>都設成 −1</button><button type="button" class="act" data-set='{"qa":-4,"qb":-4}'>都設成 −4</button></li>
    </ul>`,
  challenge: {
    text: '讓兩條吊線之間的夾角超過 <strong>40°</strong>。提示：兩顆氣球要互相排斥，而且電要夠多。',
    check: (s) => s.angle > 40,
    done: '電荷越多、距離越近，排斥力就越大，吊線張得越開。',
  },
  body: `
    <h3>東西裡面本來就有電</h3>
    <p data-read>所有物質都由原子組成。原子的中心是<strong>原子核</strong>，裡面有帶正電的<strong>質子</strong>和不帶電的<strong>中子</strong>；原子核外面有帶負電的<strong>電子</strong>。一個質子和一個電子的電量一樣大，只是正負相反。</p>
    <div class="widget" data-widget="atom"></div>
    <p data-read>平常一個物體裡的質子數和電子數一樣多，正負互相抵消，所以整體<strong>不帶電</strong>，也叫做<strong>電中性</strong>。</p>

    <h3>摩擦起電：電子搬家</h3>
    <p data-read>兩種不同的材料互相摩擦時，有些電子會從一個物體跑到另一個物體上：</p>
    <ul class="dot-list">
      <li data-read>得到電子的物體，負電比正電多，所以<strong>帶負電</strong>。</li>
      <li data-read>失去電子的物體，正電比負電多，所以<strong>帶正電</strong>。</li>
    </ul>
    <p data-read>質子被牢牢鎖在原子核裡，摩擦時不會移動。所以「帶正電」不是得到了正電，而是<strong>失去了電子</strong>。</p>
    <table class="tbl"><thead><tr><th>摩擦的兩樣東西</th><th>得到電子（帶負電）</th><th>失去電子（帶正電）</th></tr></thead>
      <tbody><tr><td>氣球和毛布</td><td>氣球</td><td>毛布</td></tr><tr><td>塑膠尺和頭髮</td><td>塑膠尺</td><td>頭髮</td></tr><tr><td>玻璃棒和絲綢</td><td>絲綢</td><td>玻璃棒</td></tr></tbody></table>

    <h3>同性相斥，異性相吸</h3>
    <div class="pair">
      <div class="pair-a"><b>同性電荷</b><span>＋和＋、－和－</span><em>互相排斥</em></div>
      <div class="pair-b"><b>異性電荷</b><span>＋和－</span><em>互相吸引</em></div>
    </div>
    <p data-read>電荷之間的力，距離越近越大，電量越多也越大。在立體圖裡，把吊點拉近或讓氣球多帶一些電，吊線都會張得更開。</p>

    <h3>帶電的東西也會吸引不帶電的東西</h3>
    <p data-read>把摩擦過的塑膠尺靠近小紙屑，紙屑會被吸起來。紙屑本來不帶電，但帶負電的尺一靠近，紙屑裡的電荷就稍微移動：靠近尺的一側出現正電，遠離的一側出現負電。正電離尺比較近，吸引力比排斥力大，紙屑就被吸過去了。這種現象叫<strong>靜電感應</strong>。</p>

    <h3>導體和絕緣體</h3>
    <p data-read>金屬裡有很多可以自由移動的電子，叫做<strong>自由電子</strong>。電荷在金屬裡很容易移動，所以金屬是<strong>導體</strong>。塑膠、橡膠、玻璃和乾燥空氣裡的電子被原子抓得很緊，電荷不容易移動，這類材料叫<strong>絕緣體</strong>。</p>
    <p data-read>靜電大多出現在絕緣體上，因為電荷跑不掉，只好留在原處。電線外面包一層塑膠，也是利用絕緣體擋住電荷。</p>

    <h3>電量的單位：庫侖</h3>
    <div class="formula">
      <p class="f-main">一個電子的電量 ≈ 1.6 × 10⁻¹⁹ C</p>
      <p class="f-note">C 是<strong>庫侖</strong>（coulomb），電量的單位。1 庫侖大約是 6.25 × 10¹⁸ 個電子的電量，也就是六百多萬兆個電子。</p>
    </div>

    <h3>生活中的靜電</h3>
    <ul class="dot-list">
      <li data-read>冬天脫毛衣時聽到劈啪聲，有時還看得到小火花。</li>
      <li data-read>摸金屬門把被「電」一下：身上累積的電荷突然流到門把上。</li>
      <li data-read>閃電：雲裡累積了大量電荷，一次放電到地面或其他雲層。</li>
      <li data-read>影印機和雷射印表機用靜電把碳粉吸到紙上。</li>
    </ul>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">摩擦會製造出電荷。</p><p class="right">電荷只是從一個物體搬到另一個物體，總量不變。</p></div>
      <div class="myth"><p class="wrong">帶正電，就是得到了正電荷。</p><p class="right">帶正電是<strong>失去了電子</strong>。摩擦時移動的只有電子。</p></div>
      <div class="myth"><p class="wrong">只有兩個帶電的物體之間才有吸引力。</p><p class="right">帶電的物體也會吸引不帶電的輕小物體，原因是靜電感應。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>用毛皮摩擦塑膠尺之後，塑膠尺帶負電。（1）電子從哪裡跑到哪裡？（2）毛皮帶什麼電？（3）如果塑膠尺得到了 5 × 10⁹ 個電子，毛皮失去了幾個電子？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>塑膠尺帶負電，表示它得到電子：電子從<strong>毛皮</strong>跑到<strong>塑膠尺</strong>。</li><li>毛皮失去電子，帶<strong>正電</strong>。</li><li>電荷守恆：塑膠尺得到幾個，毛皮就失去幾個，所以是 <strong>5 × 10⁹ 個</strong>。</li></ol>
      </details>
    </div>`,
  widgets: { atom: (el) => { el.innerHTML = atomSVG(); } },
  keywords: [
    { t: '電荷', en: 'charge', d: '物質帶的電，分成正電和負電。' },
    { t: '電子', en: 'electron', d: '原子核外帶負電的粒子。摩擦起電時移動的就是電子。' },
    { t: '質子', en: 'proton', d: '原子核裡帶正電的粒子，電量和電子一樣大，不會因摩擦而移動。' },
    { t: '摩擦起電', en: 'charging by friction', d: '兩個物體摩擦，電子從一個轉移到另一個，使兩者帶異種電。' },
    { t: '靜電感應', en: 'electrostatic induction', d: '帶電體靠近時，使附近物體內的電荷重新分布的現象。' },
    { t: '導體', en: 'conductor', d: '電荷容易在其中移動的材料，例如金屬。' },
    { t: '絕緣體', en: 'insulator', d: '電荷不容易在其中移動的材料，例如塑膠、橡膠、玻璃。' },
    { t: '庫侖', en: 'coulomb, C', d: '電量的單位。一個電子的電量約 1.6 × 10⁻¹⁹ C。' },
    { t: '電荷守恆', en: 'conservation of charge', d: '電荷不會被製造或消滅，只會從一個地方轉移到另一個地方。' },
    { t: '接地', en: 'earthing', d: '用導體把物體連到大地，讓多餘的電荷流走。' },
  ],
  quiz: [
    { q: '用毛皮摩擦塑膠尺後，塑膠尺帶負電。下列哪一個說法正確？', options: ['毛皮上的電子跑到塑膠尺上', '塑膠尺上的質子跑到毛皮上', '摩擦時產生了新的負電荷', '毛皮仍然不帶電'], answer: 0, why: '摩擦只會讓電子轉移。塑膠尺得到電子帶負電，毛皮失去電子帶正電。質子在原子核裡，不會移動。' },
    { q: '兩顆帶電的小球互相排斥，表示它們：', options: ['帶同種電', '帶異種電', '一顆帶電、一顆不帶電', '都不帶電'], answer: 0, why: '同性電相斥。如果一顆帶電、一顆不帶電，會因為靜電感應而互相吸引。' },
    { q: '為什麼金屬是良好的導體？', options: ['金屬裡有可以自由移動的電子', '金屬裡沒有電子', '金屬的質子可以自由移動', '金屬比塑膠重'], answer: 0, why: '金屬裡有自由電子，電荷可以在金屬中流動。' },
    { q: '帶負電的氣球靠近不帶電的小紙屑，會發生什麼事？', options: ['紙屑被吸過去', '紙屑被推開', '紙屑完全不動', '紙屑先帶負電再被推開'], answer: 0, why: '靜電感應讓紙屑靠近氣球的一側出現正電，吸引力大於排斥力，所以紙屑被吸過去。' },
  ],
  summary: [
    '物質由原子組成：質子帶正電，電子帶負電，中子不帶電。',
    '摩擦起電是電子的轉移：得到電子帶負電，失去電子帶正電。',
    '同性電荷相斥，異性電荷相吸；帶電體也會吸引不帶電的輕小物體（靜電感應）。',
    '電荷不會憑空產生或消失（電荷守恆）。電量的單位是庫侖 C。',
    '導體（例如金屬）有自由電子；絕緣體（例如塑膠）的電子不容易移動。',
  ],
};
