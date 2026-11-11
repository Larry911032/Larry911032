// 第 6 課 電功率與電能：電錶、電器和無熔絲開關
import { Stage, THREE, V3, solid, rbox, cyl, surf, basic, rimMat, glowTexture, pal, fmt, makeWire } from '../three-kit.js';
import { controls, readouts, emitter, numTags } from './rig.js';

const VOLT = 110;
const LIMIT = 20; // 無熔絲開關額定電流（A）
const APPS = [
  { id: 'led', name: 'LED 燈', w: 10, x: -2.35 },
  { id: 'fan', name: '電風扇', w: 45, x: -1.45 },
  { id: 'laptop', name: '筆電', w: 65, x: -0.5 },
  { id: 'cooker', name: '電鍋', w: 800, x: 0.45 },
  { id: 'dryer', name: '吹風機', w: 1200, x: 1.4 },
  { id: 'kettle', name: '電熱水壺', w: 1500, x: 2.35 },
];

function glow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.set(size, size, 1); s.renderOrder = 4; s.raycast = () => {};
  return s;
}

// 各種電器的簡單模型：回傳 group 和 apply(on, t)
const MODELS = {
  led() {
    const g = new THREE.Group();
    const base = cyl(0.15, 0.05, 'plastic'); base.position.y = 0.025; g.add(base);
    const pole = cyl(0.02, 0.45, 'metal', { seg: 10, hull: 0.006 }); pole.position.y = 0.27; g.add(pole);
    const sock = cyl(0.05, 0.08, 'plastic', { seg: 16 }); sock.position.y = 0.53; g.add(sock);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), rimMat('glass', { fill: 0.2, rim: 0.4 })); bulb.position.y = 0.66; bulb.renderOrder = 3; g.add(bulb);
    const gl = glow('#ffd35a', 0.9); gl.position.y = 0.66; g.add(gl);
    return { g, apply(on) { gl.material.opacity = on ? 0.85 : 0; } };
  },
  fan() {
    const g = new THREE.Group();
    const base = cyl(0.17, 0.05, 'plastic'); base.position.y = 0.025; g.add(base);
    const pole = cyl(0.025, 0.5, 'plastic', { seg: 12, hull: 0.008 }); pole.position.y = 0.3; g.add(pole);
    const motor = solid(new THREE.SphereGeometry(0.075, 18, 12), 'plastic'); motor.scale.set(1, 1, 1.4); motor.position.set(0, 0.6, -0.03); g.add(motor);
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.01, 8, 40), surf('metal')); guard.position.set(0, 0.6, 0.07); g.add(guard);
    const rotor = new THREE.Group(); rotor.position.set(0, 0.6, 0.07); g.add(rotor);
    for (let k = 0; k < 3; k++) { const b = solid(rbox(0.17, 0.06, 0.01, 0.005).translate(0.1, 0, 0), 'cloth', { hull: 0.006 }); b.rotation.z = (k * Math.PI * 2) / 3; rotor.add(b); }
    let spin = 0;
    return { g, apply(on, dt) { spin += (on ? 1 : 0) * dt * 14; rotor.rotation.z = spin; } };
  },
  laptop() {
    const g = new THREE.Group();
    const base = solid(rbox(0.52, 0.03, 0.36, 0.012), 'metal'); base.position.y = 0.015; g.add(base);
    const hinge = new THREE.Group(); hinge.position.set(0, 0.03, -0.17); hinge.rotation.x = -0.28; g.add(hinge);
    const lid = solid(rbox(0.52, 0.34, 0.02, 0.012), 'metal'); lid.position.y = 0.17; hinge.add(lid);
    const scrMat = new THREE.MeshBasicMaterial({ color: '#2a3340' });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), scrMat); scr.position.set(0, 0.17, 0.012); hinge.add(scr);
    return { g, apply(on) { scrMat.color.set(on ? '#a9d6ff' : '#2a3340'); } };
  },
  cooker() {
    const g = new THREE.Group();
    const foot = cyl(0.23, 0.04, 'dark'); foot.position.y = 0.02; g.add(foot);
    const body = cyl(0.25, 0.3, 'plastic', { r2: 0.24, seg: 32 }); body.position.y = 0.19; g.add(body);
    const lid = solid(new THREE.SphereGeometry(0.255, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), 'plastic'); lid.scale.y = 0.42; lid.position.y = 0.34; g.add(lid);
    const knob = cyl(0.035, 0.05, 'dark', { seg: 14, hull: 0.008 }); knob.position.y = 0.47; g.add(knob);
    for (const s of [-1, 1]) { const h = solid(rbox(0.08, 0.04, 0.15, 0.015), 'dark', { hull: 0.008 }); h.position.set(s * 0.28, 0.3, 0); g.add(h); }
    const sw = solid(rbox(0.06, 0.1, 0.04, 0.012), 'red', { hull: 0.008 }); sw.position.set(0, 0.11, 0.25); g.add(sw);
    const lamp = glow('#ff7a3a', 0.16); lamp.position.set(0.09, 0.22, 0.27); g.add(lamp);
    const steam = glow('#ffffff', 0.7); steam.position.set(0.05, 0.75, 0); g.add(steam);
    let t = 0;
    return { g, apply(on, dt) { t += dt; lamp.material.opacity = on ? 0.95 : 0; steam.material.opacity = on ? 0.35 + 0.15 * Math.sin(t * 3) : 0; } };
  },
  dryer() {
    const g = new THREE.Group();
    const base = cyl(0.14, 0.04, 'plastic'); base.position.y = 0.02; g.add(base);
    const handle = solid(rbox(0.08, 0.3, 0.1, 0.03), 'cloth'); handle.position.set(0.04, 0.19, 0); handle.rotation.z = -0.12; g.add(handle);
    const body = cyl(0.09, 0.34, 'cloth', { r2: 0.1 }); body.rotation.z = Math.PI / 2; body.position.set(0, 0.4, 0); g.add(body);
    const nozzle = cyl(0.055, 0.12, 'dark', { r2: 0.075, seg: 18 }); nozzle.rotation.z = Math.PI / 2; nozzle.position.set(-0.22, 0.4, 0); g.add(nozzle);
    const heat = glow('#ff8a3a', 0.55); heat.position.set(-0.33, 0.4, 0); g.add(heat);
    let t = 0;
    return { g, apply(on, dt) { t += dt; heat.material.opacity = on ? 0.7 + 0.15 * Math.sin(t * 20) : 0; } };
  },
  kettle() {
    const g = new THREE.Group();
    const base = cyl(0.2, 0.04, 'plastic'); base.position.y = 0.02; g.add(base);
    const body = cyl(0.15, 0.34, 'metal', { r2: 0.18, seg: 32 }); body.position.y = 0.21; g.add(body);
    const lid = cyl(0.12, 0.03, 'plastic', { seg: 28 }); lid.position.y = 0.395; g.add(lid);
    const handle = solid(new THREE.TorusGeometry(0.13, 0.025, 10, 20, Math.PI), 'plastic', { hull: 0.008 }); handle.rotation.z = -Math.PI / 2; handle.position.set(0.17, 0.22, 0); g.add(handle);
    const spout = cyl(0.025, 0.16, 'metal', { r2: 0.05, seg: 14, hull: 0.008 }); spout.rotation.z = 0.9; spout.position.set(-0.2, 0.32, 0); g.add(spout);
    const ring = glow('#5ab8ff', 0.3); ring.position.set(0, 0.05, 0.2); g.add(ring);
    const steam = glow('#ffffff', 0.6); steam.position.set(-0.3, 0.5, 0); g.add(steam);
    let t = 0;
    return { g, apply(on, dt) { t += dt; ring.material.opacity = on ? 0.9 : 0; steam.material.opacity = on ? 0.35 + 0.15 * Math.sin(t * 4) : 0; } };
  },
};

function counterTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  return {
    t,
    draw(kwh) {
      const s = kwh.toFixed(3).padStart(8, '0');
      if (s === last) return; last = s;
      const x = c.getContext('2d');
      x.fillStyle = '#16222e'; x.fillRect(0, 0, 512, 128);
      x.font = '600 72px "IBM Plex Mono", ui-monospace, monospace'; x.textBaseline = 'middle'; x.fillStyle = '#ffd35a';
      x.fillText(s, 26, 68);
      x.font = '700 40px system-ui, sans-serif'; x.fillStyle = '#e8edf2'; x.fillText('度', 430, 68);
      t.needsUpdate = true;
    },
  };
}

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.1, 3.0, 6.9], target: [0, 0.85, -0.3], fov: 32, maxPolar: 1.45 });
  const state = { on: {}, speed: 600, price: 3.0 };
  const ev = emitter();
  let tripped = false, over = 0, kwh = 0, hours = 0, diskAng = 0;

  // 牆、插座排
  const wall = solid(rbox(6.6, 2.7, 0.1, 0.03), 'wall', { hull: 0 }); wall.position.set(0, 1.35, -1.5); stage.add(wall);
  const rail = solid(rbox(5.7, 0.2, 0.08, 0.03), 'plastic'); rail.position.set(0, 0.42, -1.4); stage.add(rail);
  APPS.forEach((a) => { const o = solid(rbox(0.14, 0.1, 0.02, 0.01), 'dark', { hull: 0 }); o.position.set(a.x, 0.42, -1.355); stage.add(o); });

  // 電錶
  const meter = new THREE.Group(); meter.position.set(-2.2, 1.78, -1.38); stage.add(meter);
  const mBody = solid(rbox(0.8, 0.95, 0.2, 0.05), 'plastic'); meter.add(mBody);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 40), rimMat('glass', { fill: 0.12, rim: 0.3 })); win.rotation.x = Math.PI / 2; win.position.set(0, 0.12, 0.125); win.renderOrder = 3; meter.add(win);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.01, 40), surf('cellBody')); back.rotation.x = Math.PI / 2; back.position.set(0, 0.12, 0.101); meter.add(back);
  const diskPivot = new THREE.Group(); diskPivot.position.set(0, 0.12, 0.11); meter.add(diskPivot);
  const disk = cyl(0.23, 0.015, 'metal', { seg: 40, hull: 0.006 }); disk.rotation.x = Math.PI / 2; diskPivot.add(disk);
  const mark = solid(rbox(0.05, 0.08, 0.02, 0.006), 'red', { hull: 0 }); mark.position.set(0, 0.18, 0.01); diskPivot.add(mark);
  const ctr = counterTexture();
  const ctrPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: ctr.t })); ctrPlane.position.set(0, -0.28, 0.105); meter.add(ctrPlane);
  ctr.draw(0);

  // 無熔絲開關
  const brk = new THREE.Group(); brk.position.set(-1.2, 1.78, -1.38); stage.add(brk);
  const bBody = solid(rbox(0.34, 0.5, 0.18, 0.03), 'plastic'); brk.add(bBody);
  const lever = solid(rbox(0.08, 0.16, 0.08, 0.02), 'black'); lever.position.set(0, 0.06, 0.12); brk.add(lever);

  // 外線、電錶到開關、開關到插座排
  const cables = [
    [[-2.2, 2.7, -1.42], [-2.2, 2.26, -1.42]],
    [[-1.8, 1.78, -1.42], [-1.37, 1.78, -1.42]],
    [[-1.2, 1.53, -1.42], [-1.2, 0.52, -1.42]],
  ];
  cables.forEach((pts) => { const w = makeWire(pts.map((p) => V3(...p)), { radius: 0.025 }); w.mesh.material = surf('black'); stage.add(w.mesh); });

  // 電器與電線
  const apps = APPS.map((a) => {
    const m = MODELS[a.id](); m.g.position.set(a.x, 0, 0.12); stage.add(m.g);
    const w = makeWire([V3(a.x, 0.04, -0.12), V3(a.x, 0.04, -1.1), V3(a.x, 0.04, -1.32), V3(a.x, 0.37, -1.32)], { radius: 0.016, corner: 0.15 });
    w.mesh.material = surf('black'); stage.add(w.mesh);
    const lab = stage.addLabel('', V3(a.x, 1.02, 0.12), { cls: 'chip small' });
    stage.addClickable(m.g, () => toggle(a.id));
    return { ...a, m, lab };
  });

  numTags(stage, [V3(-2.7, 2.35, -1.3), V3(-1.2, 2.18, -1.3), V3(-2.95, 0.42, -1.3), V3(-2.75, 0.85, 0.12)]);
  const meterLab = stage.addLabel('電錶', V3(-2.2, 2.38, -1.3), { cls: 'chip small' });
  const brkLab = stage.addLabel('', V3(-1.2, 2.18, -1.2), { cls: 'chip small' });
  meterLab.el.style.marginLeft = '0';

  const ui = controls(controlsEl, [
    { type: 'chips', id: 'apps', label: '電器（點一下開關）', items: APPS.map((a) => ({ id: a.id, label: `${a.name}<span class="w">${a.w} W</span>` })) },
    { type: 'seg', id: 'speed', label: '時間快轉', options: [{ value: 60, label: '1 秒＝1 分鐘' }, { value: 600, label: '1 秒＝10 分鐘' }, { value: 3600, label: '1 秒＝1 小時' }], value: 600 },
    { type: 'range', id: 'price', label: '每度電價', min: 1.5, max: 6, step: 0.1, value: 3.0, fmt: (v) => `${(+v).toFixed(1)} 元` },
    { type: 'buttons', label: '', items: [{ id: 'allOff', label: '全部關掉', cls: 'ghost' }, { id: 'reset', label: '重新送電' }, { id: 'zero', label: '電錶歸零', cls: 'ghost' }] },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'p', label: '總功率', cls: 'em' }, { id: 'i', label: '總電流 = P ÷ 110 V' }, { id: 'e', label: '已用電能' },
    { id: 'cost', label: '電費' }, { id: 'time', label: '經過時間' }, { id: 'st', label: '無熔絲開關' },
  ]);
  ui.on('apps', (id, v) => set({ on: { ...state.on, [id]: v } }, true)).on('speed', (v) => set({ speed: v }, true)).on('price', (v) => set({ price: v }, true))
    .on('allOff', () => set({ on: {} })).on('reset', () => set({ reset: true }, true)).on('zero', () => { kwh = 0; hours = 0; refresh(); });

  function toggle(id) { set({ on: { ...state.on, [id]: !state.on[id] } }); }
  const demand = () => APPS.reduce((s, a) => s + (state.on[a.id] ? a.w : 0), 0);
  const power = () => (tripped ? 0 : demand());
  function refresh() {
    const P = power(), D = demand(), I = D / VOLT;
    apps.forEach((a) => { a.lab.set(`${a.name} <b>${a.w} W</b>`); a.lab.el.classList.toggle('on', !!state.on[a.id] && !tripped); });
    brkLab.set(tripped ? '跳電了！' : `無熔絲開關 <b>${LIMIT} A</b>`); brkLab.el.classList.toggle('warn', tripped);
    ro.set('p', `${P} W`);
    ro.set('i', `${fmt(tripped ? 0 : I, 1)} A`, I > LIMIT ? 'danger' : I > 15 ? 'warn' : '');
    ro.set('e', `${kwh.toFixed(3)} 度`);
    ro.set('cost', `${(kwh * state.price).toFixed(2)} 元`);
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    ro.set('time', `${h} 小時 ${m} 分`);
    ro.set('st', tripped ? '跳脫（斷電）' : I > LIMIT ? '電流超過 20 A！' : '正常', tripped || I > LIMIT ? 'danger' : 'safe');
    ctr.draw(kwh);
  }
  function get() { return { ...state, P: power(), demand: demand(), I: demand() / VOLT, tripped, kwh }; }
  function set(p, user = false) {
    if (p.reset) { tripped = false; over = 0; }
    const { reset, ...rest } = p;
    Object.assign(state, rest);
    ui.show('apps', state.on); if (!user) { ui.show('speed', state.speed); ui.show('price', state.price); }
    refresh(); ev.emit(get());
  }

  let tEmit = 0;
  stage.addTicker((dt, rdt) => {
    const I = demand() / VOLT;
    if (!tripped && I > LIMIT) { over += rdt; if (over > 0.6) { tripped = true; refresh(); ev.emit(get()); } } else over = 0;
    lever.position.y += ((tripped ? -0.07 : 0.06) - lever.position.y) * Math.min(1, rdt * 12);
    const P = power();
    apps.forEach((a) => a.m.apply(!!state.on[a.id] && !tripped, dt));
    diskAng -= (P / 260) * dt; diskPivot.rotation.z = diskAng;
    if (dt > 0 && P > 0) { const h = (dt * state.speed) / 3600; hours += h; kwh += (P / 1000) * h; }
    else if (dt > 0) hours += (dt * state.speed) / 3600;
    tEmit += rdt;
    if (tEmit > 0.25) { tEmit = 0; refresh(); ev.emit(get()); }
  });

  const VIEWS = {
    front: [[0.1, 3.0, 6.9], [0, 0.85, -0.3]],
    meter: [[-1.1, 2.3, 2.4], [-1.7, 1.6, -1.4]],
    apps: [[0.9, 2.0, 3.6], [0.9, 0.45, 0.1]],
  };
  refresh();
  return {
    stage, set, get, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 6, slug: 'power', title: '電功率與電費', en: 'Power and energy',
  short: '熱水壺和 LED 燈哪個比較耗電？學會看「瓦特」和「度」。',
  bigIdea: '電功率是每秒轉換多少電能：<strong>P = I × V</strong>。用了多少電，要看功率乘上使用的時間：<strong>E = P × t</strong>。電費就是用「度」來算的。',
  goals: ['用 P = I × V 計算電功率，認識瓦特', '用 E = P × t 計算電能，換算焦耳和「度」', '估算電費，知道同時用太多電器為什麼會跳電'],
  predict: {
    q: '1500 W 的電熱水壺燒 2 分鐘，和 10 W 的 LED 燈開 5 小時，哪一個用掉的電能比較多？',
    options: ['電熱水壺', 'LED 燈', '差不多一樣多'],
    answer: 2,
    why: '<p>用掉的電能 = 功率 × 時間。</p><ul class="dot-list"><li>熱水壺：1.5 kW × (2 ÷ 60) h = <strong>0.05 度</strong></li><li>LED 燈：0.01 kW × 5 h = <strong>0.05 度</strong></li></ul><p>兩個<strong>一樣多</strong>！熱水壺的功率大，但只用一下；LED 燈功率小，用得久。比較耗不耗電，要同時看功率和時間。</p>',
  },
  figure: {
    title: '電錶、無熔絲開關和家裡的電器',
    alt: '立體圖：牆上有電錶和無熔絲開關，下方插座排接著 LED 燈、電風扇、筆電、電鍋、吹風機和電熱水壺。電錶的轉盤會隨用電量轉動。',
    legend: ['電錶：轉盤越快，代表功率越大', '無熔絲開關：電流超過 20 A 就跳脫', '插座排：每個插座都是並聯', '電器：在圖上點一下可以開關'],
    note: '時間被快轉了，電錶上的「度」會比真實快很多。電器的瓦數是常見的額定值。',
    mount,
  },
  watch: [
    { text: '這是家裡的電錶。轉盤轉得越快，代表每秒用掉的電能越多，也就是<strong>電功率</strong>越大。現在所有電器都關著，轉盤不動。', set: { on: {}, reset: true }, view: 'meter' },
    { text: '打開 10 W 的 LED 燈：轉盤轉得很慢。10 W 表示每秒轉換 10 焦耳的電能。', set: { on: { led: true }, reset: true }, view: 'front' },
    { text: '再打開 1500 W 的電熱水壺：轉盤轉得飛快。這時電流 I = P ÷ V = 1500 ÷ 110 ≈ 13.6 A。', set: { on: { led: true, kettle: true }, reset: true }, view: 'front' },
    { text: '電錶上的數字是「度」。1 度 = 1 kW 的電器用 1 小時 = 360 萬焦耳。電費就是度數乘上每度的電價。', set: { on: { led: true, kettle: true }, reset: true }, view: 'meter' },
    { text: '再打開 800 W 的電鍋：總電流約 21 A，超過無熔絲開關的 20 A，<strong>跳電了</strong>！這是保護電線不要過熱。', set: { on: { led: true, kettle: true, cooker: true } }, view: 'front' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>在立體圖裡點一下電器，打開或關掉它，看電錶轉盤的速度和總功率。</p></li>
      <li><p data-read>只開電熱水壺，用「1 秒＝1 分鐘」的速度數 10 秒（等於燒 10 分鐘），用掉幾度電？</p><button type="button" class="act" data-set='{"on":{"kettle":true},"speed":60,"reset":true}'>只開電熱水壺</button></li>
      <li><p data-read>找一個會跳電的組合，再按「重新送電」。如果不先關掉一些電器，會怎樣？</p><button type="button" class="act" data-set='{"on":{"kettle":true,"dryer":true}}'>電熱水壺＋吹風機</button></li>
    </ul>`,
  challenge: {
    text: '在<strong>不跳電</strong>的情況下，讓總功率超過 <strong>2000 W</strong>。（無熔絲開關的上限是 20 A，也就是 110 × 20 = 2200 W。）',
    check: (s) => !s.tripped && s.P > 2000 && s.P <= 2200,
    done: '例如吹風機 1200 W＋電鍋 800 W＋LED 燈 10 W = 2010 W，電流約 18.3 A，還在 20 A 以內。',
  },
  body: `
    <h3>電功率：每秒轉換多少電能</h3>
    <div class="formula">
      <p class="f-main" data-say="P 等於 E 除以 t">P = E ÷ t</p>
      <dl class="f-legend"><div><dt>P</dt><dd>功率，單位<strong>瓦特（W）</strong></dd></div><div><dt>E</dt><dd>能量，單位焦耳（J）</dd></div><div><dt>t</dt><dd>時間，單位秒（s）</dd></div></dl>
      <p class="f-note">1 W = 1 J/s。1000 W = 1 kW（千瓦）。</p>
    </div>

    <h3>P = I × V</h3>
    <p data-read>從前兩課知道：每秒通過 I 庫侖的電荷（電流），每庫侖轉換 V 焦耳的能量（電壓）。所以每秒轉換的能量就是 I × V：</p>
    <div class="formula">
      <p class="f-main" data-say="P 等於 I 乘以 V，也等於 I 平方乘以 R">P = I × V = I² × R</p>
      <p class="f-note">第二個式子用了 V = I × R。電流加倍時，電阻上的發熱變成 4 倍。</p>
    </div>

    <h3>電器上的標示</h3>
    <p data-read>電鍋上寫「110 V 800 W」，意思是接在 110 V 時，每秒轉換 800 焦耳的電能。它的電流是 800 ÷ 110 ≈ 7.3 A。</p>
    <table class="tbl"><thead><tr><th>電器</th><th>常見功率</th><th>電流（110 V）</th></tr></thead><tbody>
      ${APPS.map((a) => `<tr><td>${a.name}</td><td class="mono">${a.w} W</td><td class="mono">${(a.w / VOLT).toFixed(2)} A</td></tr>`).join('')}</tbody></table>

    <h3>電能和「度」</h3>
    <div class="formula">
      <p class="f-main" data-say="E 等於 P 乘以 t">E = P × t</p>
      <p class="f-note">焦耳太小了，電力公司用<strong>度</strong>（千瓦小時，kWh）計算：1 度 = 1 kW × 1 h = 1000 W × 3600 s = 3.6 × 10⁶ J。</p>
    </div>
    <p data-read>電費 = 度數 × 每度電價。台灣的住宅用電採<strong>累進費率</strong>，用得越多，每度越貴；夏天的電價也比較高。本書用每度 3 元估算。</p>

    <h3>電流的熱效應</h3>
    <p data-read>電鍋、吹風機、電熱水壺裡都有電阻比較大的電熱線（常用鎳鉻合金），電流通過時大量發熱。電線用的是電阻很小的銅，所以平常不太熱；但電流太大時，電線也會過熱。這就是為什麼要有無熔絲開關。</p>

    <h3>省電：同樣亮，功率不一樣</h3>
    <table class="tbl"><thead><tr><th>燈泡</th><th>亮度差不多時的功率</th><th>大部分電能變成</th></tr></thead><tbody>
      <tr><td>傳統白熾燈泡</td><td class="mono">約 60 W</td><td>熱</td></tr><tr><td>LED 燈泡</td><td class="mono">約 8～10 W</td><td>光的比例高很多</td></tr></tbody></table>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">功率大的電器一定比較耗電。</p><p class="right">用電量 = 功率 × 時間。小功率的電器開很久，也可能用掉很多電。</p></div>
      <div class="myth"><p class="wrong">「度」是功率的單位。</p><p class="right">度（千瓦小時）是<strong>能量</strong>的單位；功率的單位是瓦特。</p></div>
      <div class="myth"><p class="wrong">電器關機以後就完全不用電。</p><p class="right">很多電器插著插頭待機時，還是會用一點點電。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>800 W 的電鍋每天煮飯 30 分鐘，一個月（30 天）用掉多少度電？以每度 3 元計算，電費多少？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>每天：0.8 kW × 0.5 h = 0.4 度。</li><li>30 天：0.4 × 30 = <strong>12 度</strong>。</li><li>電費：12 × 3 = <strong>36 元</strong>。</li></ol>
      </details>
    </div>`,
  keywords: [
    { t: '電功率', en: 'power, P', d: '每秒轉換的電能，P = I × V。' },
    { t: '瓦特', en: 'watt, W', d: '功率的單位。1 W = 1 J/s。' },
    { t: '電能', en: 'electrical energy', d: '電流帶來、可以轉換成光、熱、動能的能量。E = P × t。' },
    { t: '度（千瓦小時）', en: 'kilowatt-hour, kWh', d: '電費的計算單位。1 度 = 1 kW × 1 h = 3.6 × 10⁶ J。' },
    { t: '額定功率', en: 'power rating', d: '電器在標示電壓下工作時的功率，例如 110 V 800 W。' },
    { t: '累進費率', en: 'tiered pricing', d: '用電越多，超過的部分每度越貴的計價方式。' },
    { t: '過載', en: 'overload', d: '同一個迴路的電器太多，總電流超過電線或開關能承受的大小。' },
  ],
  quiz: [
    { q: '一個電器接在 110 V，電流 5 A，功率是：', options: ['22 W', '115 W', '550 W', '105 W'], answer: 2, why: 'P = I × V = 5 × 110 = 550 W。' },
    { q: '2000 W 的冷氣開 3 小時，用掉多少度電？', options: ['0.6 度', '6 度', '600 度', '6000 度'], answer: 1, why: 'E = 2 kW × 3 h = 6 kWh = 6 度。' },
    { q: '1 度電等於多少焦耳？', options: ['1000 J', '3600 J', '3.6 × 10⁶ J', '1 J'], answer: 2, why: '1 度 = 1000 W × 3600 s = 3,600,000 J。' },
    { q: '2 A 的電流流過 5 Ω 的電阻，電功率是：', options: ['10 W', '20 W', '2.5 W', '7 W'], answer: 1, why: 'P = I² × R = 2² × 5 = 20 W。' },
  ],
  summary: [
    '電功率是每秒轉換的電能：P = E ÷ t，單位瓦特 W（1 W = 1 J/s）。',
    '電功率 P = I × V，也可以寫成 P = I² × R。',
    '電能 E = P × t。電費用「度」計算：1 度 = 1 kW × 1 h = 3.6 × 10⁶ J。',
    '電熱器材利用電流的熱效應，把電能轉換成熱。',
    '同一個迴路總功率太大、總電流超過額定值，無熔絲開關就會跳脫。',
  ],
};
