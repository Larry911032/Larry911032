// 第 7 課 家庭用電與安全：火線、中性線、地線、無熔絲開關、漏電斷路器
import { Stage, THREE, V3, ChargeFlow, solid, rbox, cyl, surf, basic, glowTexture, makeWire, roundedPath, fmt, pal } from '../three-kit.js';
import { Net } from '../circuit.js';
import { controls, readouts, emitter, numTags } from './rig.js';
import { scope } from '../widgets.js';

const R_HEAT = (110 * 110) / 1500; // 1500 W 熱水壺
const R_PERSON = 2000;
const MCB_A = 20;     // 無熔絲開關
const RCD_A = 0.03;   // 漏電斷路器：30 mA

function mount({ stageEl, controlsEl, readoutsEl }) {
  const stage = new Stage(stageEl, { camera: [0.3, 3.1, 7.1], target: [-0.3, 1.0, -0.4], fov: 33, maxPolar: 1.45 });
  const state = { kettle: true, earth: true, fault: false, touch: false, rcd: false };
  const ev = emitter();
  const P = pal();
  let tripped = null, pending = null, pendT = 0;

  // 牆、配電箱
  const wall = solid(rbox(6.4, 3.0, 0.1, 0.03), 'wall', { hull: 0 }); wall.position.set(0, 1.5, -1.55); stage.add(wall);
  const panel = solid(rbox(1.15, 0.85, 0.16, 0.04), 'plastic'); panel.position.set(-2.05, 2.15, -1.42); stage.add(panel);
  const mkBreaker = (x) => {
    const g = new THREE.Group(); g.position.set(x, 2.15, -1.32); stage.add(g);
    const body = solid(rbox(0.3, 0.5, 0.1, 0.02), 'body'); g.add(body);
    const lever = solid(rbox(0.08, 0.14, 0.07, 0.02), 'black', { hull: 0.008 }); lever.position.set(0, 0.07, 0.07); g.add(lever);
    return { g, lever };
  };
  const mcb = mkBreaker(-2.32);
  const rcd = mkBreaker(-1.82);
  const test = cyl(0.03, 0.03, 'red', { seg: 12, hull: 0.006 }); test.rotation.x = Math.PI / 2; test.position.set(0.08, -0.15, 0.06); rcd.g.add(test);

  // 牆上的三條線：火線（棕）、中性線（藍）、地線（綠）
  const Z = -1.47;
  const lineDefs = {
    live: [[-1.6, 2.25, Z], [0.6, 2.25, Z], [0.6, 0.8, Z]],
    neutral: [[-1.6, 2.15, Z], [0.5, 2.15, Z], [0.5, 0.8, Z]],
    earth: [[-1.6, 2.05, Z], [0.4, 2.05, Z], [0.4, 0.8, Z]],
  };
  const tube = (pts, role, r = 0.022) => { const w = makeWire(pts.map((p) => V3(...p)), { radius: r, corner: 0.08 }); w.mesh.material = surf(role); stage.add(w.mesh); return w; };
  const wallLines = { live: tube(lineDefs.live, 'live'), neutral: tube(lineDefs.neutral, 'neutral'), earth: tube(lineDefs.earth, 'earth') };
  // 配電箱的接地線往下接到地樁
  const rodLine = tube([[-2.5, 1.75, Z], [-2.85, 1.75, Z], [-2.85, 0.05, Z], [-2.85, 0.05, -0.95]], 'earth');
  const sym = new THREE.Group(); sym.position.set(-2.85, 0.03, -0.85); stage.add(sym);
  [0.36, 0.24, 0.12].forEach((w, k) => { const b = solid(rbox(w, 0.025, 0.04, 0.01), 'earth', { hull: 0.006 }); b.position.set(0, 0, k * 0.1); sym.add(b); });

  // 插座與插頭
  const socket = solid(rbox(0.46, 0.46, 0.05, 0.05), 'plastic'); socket.position.set(0.5, 0.62, -1.47); stage.add(socket);
  const plug = solid(rbox(0.26, 0.28, 0.12, 0.04), 'black'); plug.position.set(0.5, 0.62, -1.38); stage.add(plug);

  // 桌子
  const top = solid(rbox(1.05, 0.06, 0.95, 0.02), 'wood'); top.position.set(0.35, 0.6, 0.15); stage.add(top);
  [[-0.1, -0.25], [0.8, -0.25], [-0.1, 0.55], [0.8, 0.55]].forEach(([x, z]) => { const l = cyl(0.03, 0.57, 'wood', { seg: 10, hull: 0.008 }); l.position.set(x, 0.285, z); stage.add(l); });

  // 熱水壺（金屬外殼）
  const kettle = new THREE.Group(); kettle.position.set(0.35, 0.63, 0.25); stage.add(kettle);
  const kBase = cyl(0.23, 0.04, 'plastic'); kBase.position.y = 0.02; kettle.add(kBase);
  const kBody = cyl(0.18, 0.42, 'metal', { r2: 0.21, seg: 36 }); kBody.position.y = 0.25; kettle.add(kBody);
  const kLid = cyl(0.14, 0.035, 'plastic', { seg: 28 }); kLid.position.y = 0.48; kettle.add(kLid);
  const kHandle = solid(new THREE.TorusGeometry(0.15, 0.028, 10, 20, Math.PI), 'plastic', { hull: 0.008 }); kHandle.rotation.z = Math.PI / 2; kHandle.position.set(-0.2, 0.26, 0); kettle.add(kHandle);
  const kSpout = cyl(0.025, 0.18, 'metal', { r2: 0.055, seg: 14, hull: 0.008 }); kSpout.rotation.z = -0.9; kSpout.position.set(0.23, 0.36, 0); kettle.add(kSpout);
  const sprite = (color, size) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, opacity: 0 })); s.scale.set(size, size, 1); s.renderOrder = 4; s.raycast = () => {}; return s; };
  const heat = sprite('#ff8a3a', 0.6); heat.position.set(0, 0.12, 0.05); heat.material.depthTest = false; kettle.add(heat);
  const danger = sprite(P.danger, 1.3); danger.position.set(0, 0.28, 0); danger.material.depthTest = false; kettle.add(danger);
  const spark = sprite('#fff2a8', 0.32); spark.position.set(0.12, 0.08, 0.17); kettle.add(spark);

  // 電線（插頭到熱水壺，三條並排）
  const cablePts = (dx) => [[0.5 + dx, 0.62, -1.3], [0.5 + dx, 0.62, -1.0], [0.5 + dx, 0.66, -0.55], [0.36 + dx, 0.66, -0.05], [0.36 + dx, 0.66, 0.08]];
  const cable = { live: tube(cablePts(-0.04), 'live', 0.016), neutral: tube(cablePts(0), 'neutral', 0.016), earth: tube(cablePts(0.04), 'earth', 0.016) };

  // 人
  const person = new THREE.Group(); person.position.set(1.12, 0, 0.42); stage.add(person);
  const cloth = new THREE.MeshStandardMaterial({ color: P.cloth, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.8 });
  const part = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  for (const z of [-0.09, 0.09]) { const leg = part(new THREE.CapsuleGeometry(0.07, 0.55, 6, 12), cloth); leg.position.set(0, 0.36, z); person.add(leg); }
  const torso = part(new THREE.CapsuleGeometry(0.17, 0.4, 6, 16), cloth); torso.position.y = 1.08; person.add(torso);
  const head = part(new THREE.SphereGeometry(0.135, 20, 16), skin); head.position.y = 1.56; person.add(head);
  const armL = part(new THREE.CapsuleGeometry(0.05, 0.52, 6, 10), cloth); armL.position.set(0, 1.04, 0.22); person.add(armL);
  const shoulder = new THREE.Group(); shoulder.position.set(0, 1.32, -0.21); person.add(shoulder);
  const armR = part(new THREE.CapsuleGeometry(0.05, 0.56, 6, 10), cloth); armR.position.y = -0.32; shoulder.add(armR);
  const hand = part(new THREE.SphereGeometry(0.06, 14, 10), skin); hand.position.y = -0.66; shoulder.add(hand);
  const touchPt = V3(0.57, 0.95, 0.27);
  let reach = 0;

  // 電子（交流電：來回振動）
  const flow = new ChargeFlow(stage, { K: 1, spacing: 0.17, radius: 0.015, jitter: false });
  const flowRed = new ChargeFlow(stage, { K: 1, spacing: 0.1, role: 'danger', radius: 0.03, jitter: false });
  flowRed.mesh.material = new THREE.MeshBasicMaterial({ color: P.danger, depthTest: false, transparent: true });
  flowRed.mesh.renderOrder = 20;
  const W = 2 * Math.PI * 1.0;
  const amp = (I) => (Math.abs(I) < 1e-4 ? 0 : Math.min(0.3, 0.05 + 0.07 * Math.log10(1 + Math.abs(I) * 20)));
  const net = new Net();
  const n = { s: net.node(), L: net.node(), N: net.node(), C: net.node(), E: net.node() };
  const src = net.V(n.s, n.N, 110);
  const eNG = net.R(n.N, 0, 0.5);
  const eBrk = net.R(n.s, n.L, 0.01);
  const eHeat = net.R(n.L, n.N, R_HEAT);
  const eFault = net.R(n.L, n.C, 1e9);
  const eEarth = net.R(n.C, n.E, 0.3);
  const eRod = net.R(n.E, 0, 1.0);
  const ePerson = net.R(n.C, 0, 1e9);
  const pathOf = (w) => w.path;
  const add = (path, getI, fl = flow) => fl.add(path, { getI, ac: { amp: () => amp(getI()), w: W } });
  add(pathOf(wallLines.live), () => eBrk.I); add(pathOf(cable.live), () => eBrk.I);
  add(pathOf(wallLines.neutral), () => eHeat.I); add(pathOf(cable.neutral), () => eHeat.I);
  add(pathOf(wallLines.earth), () => eEarth.I); add(pathOf(rodLine), () => eEarth.I);
  const segCableEarth = add(pathOf(cable.earth), () => eEarth.I);
  const personPath = roundedPath([touchPt, V3(1.12, 1.32, 0.21), V3(1.12, 1.05, 0.42), V3(1.12, 0.62, 0.33), V3(1.12, 0.06, 0.33), V3(1.35, 0.03, 0.33)], 0.08);
  const segPerson = add(personPath, () => ePerson.I, flowRed);

  // 標籤
  numTags(stage, [V3(-2.7, 2.65, -1.35), V3(0.75, 2.45, -1.4), V3(0.95, 0.72, -1.35), V3(-0.05, 1.3, 0.25), V3(-2.85, 0.35, -0.75), V3(1.55, 1.85, 0.42)]);
  const lab = {
    mcb: stage.addLabel('無熔絲開關', V3(-2.32, 2.5, -1.3), { cls: 'chip small' }),
    rcd: stage.addLabel('漏電斷路器', V3(-1.82, 2.5, -1.3), { cls: 'chip small' }),
    lines: stage.addLabel('棕＝火線・藍＝中性線・綠＝地線', V3(-0.55, 2.5, -1.42), { cls: 'chip small' }),
    kettle: stage.addLabel('', V3(0.35, 1.32, 0.25), { cls: 'chip' }),
    person: stage.addLabel('', V3(1.12, 1.95, 0.42), { cls: 'chip', hidden: true }),
  };

  const ui = controls(controlsEl, [
    { type: 'toggle', id: 'kettle', label: '熱水壺開關（加熱中）', value: true },
    { type: 'toggle', id: 'earth', label: '有接地線', value: true },
    { type: 'toggle', id: 'fault', label: '故障：火線鬆脫，碰到金屬外殼', value: false },
    { type: 'toggle', id: 'touch', label: '有人碰到熱水壺外殼', value: false },
    { type: 'toggle', id: 'rcd', label: '安裝漏電斷路器（30 mA）', value: false },
    { type: 'buttons', label: '', items: [{ id: 'reset', label: '重新送電' }] },
  ]);
  const ro = readouts(readoutsEl, [
    { id: 'il', label: '火線電流' }, { id: 'leak', label: '漏電（火線 − 中性線）' }, { id: 'vc', label: '外殼的電壓' },
    { id: 'ip', label: '流過人體的電流' }, { id: 'st', label: '狀態', cls: 'wide' },
  ]);
  ['kettle', 'earth', 'fault', 'touch', 'rcd'].forEach((k) => ui.on(k, (v) => set({ [k]: v }, true)));
  ui.on('reset', () => set({ reset: true }, true));

  let res = {};
  function solve() {
    eBrk.R = tripped ? 1e9 : 0.01;
    eHeat.R = state.kettle ? R_HEAT : 1e9;
    eFault.R = state.fault ? 0.05 : 1e9;
    eEarth.R = state.earth ? 0.3 : 1e9;
    ePerson.R = state.touch ? R_PERSON : 1e9;
    net.solve();
    const IL = eBrk.I, leak = Math.max(0, eBrk.I - eHeat.I), vc = net.v[n.C], ip = state.touch ? ePerson.I : 0;
    res = { IL, leak, vc, ip };
    // 保護裝置：過電流 → 無熔絲開關；漏電 → 漏電斷路器
    if (!tripped) {
      let want = null, delay = 0;
      if (state.rcd && leak > RCD_A) { want = 'rcd'; delay = 0.08; }
      else if (IL > MCB_A) { want = 'mcb'; delay = 0.35; }
      if (want !== pending) { pending = want; pendT = delay; }
    } else pending = null;
    const danger = ip > 0.01, live = !tripped && vc > 50;
    res.safe = !danger && !live;
    res.status = danger ? `危險！約 ${(ip * 1000).toFixed(0)} mA 的電流正流過人體` :
      live ? `危險：外殼帶著約 ${vc.toFixed(0)} V 的電，誰碰到誰觸電` :
      tripped === 'mcb' ? '無熔絲開關跳脫：電流太大，已切斷電源' :
      tripped === 'rcd' ? '漏電斷路器跳脫：偵測到漏電，已切斷電源' :
      state.fault ? '故障中，保護裝置正在動作' : '正常使用，安全';
    // 畫面
    ro.set('il', `${fmt(IL, 1)} A`, IL > MCB_A ? 'danger' : '');
    ro.set('leak', leak < 1 ? `${(leak * 1000).toFixed(0)} mA` : `${fmt(leak, 1)} A`, leak > RCD_A ? 'warn' : '');
    ro.set('vc', `${fmt(Math.max(0, vc), 0)} V`, vc > 50 ? 'danger' : 'safe');
    ro.set('ip', `${(ip * 1000).toFixed(0)} mA`, ip > 0.01 ? 'danger' : 'safe');
    ro.set('st', res.status, res.safe ? 'safe' : 'danger');
    lab.kettle.set(state.fault ? (vc > 50 ? '外殼帶電！' : '外殼故障') : (state.kettle && !tripped ? '加熱中' : '熱水壺'));
    lab.kettle.el.classList.toggle('warn', vc > 50);
    lab.person.show(state.touch);
    lab.person.set(ip > 0.01 ? '觸電！' : '安全');
    lab.person.el.classList.toggle('warn', ip > 0.01); lab.person.el.classList.toggle('good', ip <= 0.01);
    lab.mcb.el.classList.toggle('warn', tripped === 'mcb');
    lab.rcd.el.classList.toggle('warn', tripped === 'rcd');
    rcd.g.visible = state.rcd; lab.rcd.show(state.rcd);
    cable.earth.mesh.visible = state.earth; segCableEarth.on = state.earth;
    segPerson.on = state.touch;
  }
  function get() { return { ...state, ...res, tripped }; }
  function set(p, user = false) {
    if (p.reset) { tripped = null; pending = null; }
    if ('rcd' in p && !p.rcd && tripped === 'rcd') tripped = null; // 拆掉已經跳脫的漏電斷路器，就重新判斷
    const { reset, ...rest } = p;
    Object.assign(state, rest);
    if (!user) ['kettle', 'earth', 'fault', 'touch', 'rcd'].forEach((k) => ui.show(k, state[k]));
    solve(); ev.emit(get());
  }

  let t = 0;
  stage.addTicker((dt, rdt) => {
    t += rdt;
    if (pending) {
      pendT -= rdt;
      if (pendT <= 0) { tripped = pending; pending = null; solve(); ev.emit(get()); }
    }
    // 開關把手：上＝送電，下＝跳脫
    mcb.lever.position.y += ((tripped ? -0.07 : 0.07) - mcb.lever.position.y) * Math.min(1, rdt * 12);
    rcd.lever.position.y += ((tripped ? -0.07 : 0.07) - rcd.lever.position.y) * Math.min(1, rdt * 12);
    // 伸手
    reach += ((state.touch ? 1 : 0) - reach) * Math.min(1, rdt * 5);
    const sw = person.localToWorld(V3(0, 1.32, -0.21));
    const dir = touchPt.clone().sub(sw).normalize();
    const down = V3(0, -1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(down, dir);
    shoulder.quaternion.slerpQuaternions(new THREE.Quaternion(), q, reach);
    // 發光效果
    const live = !tripped && res.vc > 50;
    heat.material.opacity = state.kettle && !tripped ? 0.75 : 0;
    danger.material.opacity = live ? 0.35 + 0.25 * Math.sin(t * 8) : 0;
    spark.material.opacity = state.fault && !tripped && Math.sin(t * 23) > 0.2 ? 0.9 : 0;
    const shocked = res.ip > 0.01;
    cloth.color.set(shocked && Math.sin(t * 16) > 0 ? pal().danger : pal().cloth);
  });

  const VIEWS = {
    front: [[0.3, 3.1, 7.1], [-0.3, 1.0, -0.4]],
    cable: [[1.6, 1.7, 1.2], [0.45, 0.75, -0.7]],
    panel: [[-1.3, 2.4, 1.5], [-1.8, 2.0, -1.4]],
    person: [[2.6, 1.8, 2.6], [0.75, 0.95, 0.25]],
  };
  solve();
  return {
    stage, set, get, onChange: ev.on,
    view(name, dur) { const v = VIEWS[name]; if (v) stage.flyTo(v[0], v[1], dur ?? 1.1); },
    dispose() { stage.dispose(); },
  };
}

export default {
  num: 7, slug: 'mains', title: '家庭用電與安全', en: 'Mains electricity and safety',
  short: '插座裡的三條線各有什麼任務？為什麼金屬外殼的電器要接地？',
  bigIdea: '家裡的電是 110 V 的交流電。<strong>火線</strong>送電、<strong>中性線</strong>讓電流回去、<strong>地線</strong>在故障時保護你；無熔絲開關和漏電斷路器會在危險發生的一瞬間切斷電源。',
  goals: ['分辨直流電和交流電，知道台灣家用電是 110 V、60 Hz', '說出火線、中性線、地線的功能', '解釋接地、無熔絲開關、漏電斷路器怎麼保護人'],
  predict: {
    q: '金屬外殼的熱水壺裡，火線鬆脫碰到了外殼。如果熱水壺<strong>有接地線</strong>，會發生什麼事？',
    options: ['外殼帶電，誰碰到就會觸電', '很大的電流沿著地線流走，無熔絲開關立刻跳脫', '什麼事都不會發生，熱水壺照常加熱'],
    answer: 1,
    why: '<p>地線把金屬外殼接到大地。火線一碰到外殼，電流就沿著電阻很小的地線流走，電流非常大，<strong>無熔絲開關立刻跳脫</strong>，切斷電源。外殼不會一直帶電，所以碰到也安全。</p><p>如果<strong>沒有</strong>地線，外殼就會一直帶著危險的電壓，等著下一個碰到它的人。</p>',
  },
  figure: {
    title: '熱水壺漏電了，誰來保護你？',
    alt: '立體圖：牆上的配電箱裡有無熔絲開關和漏電斷路器，棕、藍、綠三條線接到插座，插頭的電線連到桌上的金屬熱水壺。旁邊站著一個人，可以伸手碰熱水壺。',
    legend: ['配電箱：無熔絲開關、漏電斷路器', '牆裡的三條線：火線（棕）、中性線（藍）、地線（綠）', '插座和插頭', '金屬外殼的電熱水壺', '接地：連到大地', '使用者'],
    note: '交流電讓電子在電線裡來回振動，動畫放慢了很多。人體電阻用 2000 Ω 估算。',
    mount,
  },
  watch: [
    { text: '正常使用：電流從<strong>火線</strong>進入熱水壺的電熱線，再從<strong>中性線</strong>回去。家裡是交流電，電子其實在電線裡<strong>來回振動</strong>。', set: { kettle: true, earth: true, fault: false, touch: false, rcd: false, reset: true }, view: 'front' },
    { text: '<strong>地線</strong>一端接在熱水壺的金屬外殼，另一端經過插座、配電箱，接到埋在地下的地樁。正常時地線上<strong>沒有電流</strong>（綠線裡的電子不動）。', set: { kettle: true, earth: true, fault: false, touch: false, rcd: false, reset: true }, view: 'cable' },
    { text: '如果<strong>沒有地線</strong>，又剛好故障：火線碰到金屬外殼，外殼就帶著 110 V 的電。看起來一切正常，熱水壺還在加熱……', set: { earth: false, fault: true, touch: false, rcd: false, reset: true }, view: 'front' },
    { text: '這時有人碰到外殼：電流經過人體流到地面，大約 55 mA，可能讓心臟無法正常跳動，非常危險！無熔絲開關卻<strong>不會跳</strong>，因為總電流沒有超過 20 A。', set: { kettle: true, earth: false, fault: true, touch: true, rcd: false, reset: true }, view: 'person' },
    { text: '<strong>有接地線</strong>時：故障電流沿著地線流走，電流非常大，<strong>無熔絲開關立刻跳脫</strong>，切斷電源，外殼不再帶電。', set: { earth: true, fault: true, touch: false, rcd: false, reset: true }, view: 'front' },
    { text: '<strong>漏電斷路器</strong>比較火線和中性線的電流，只要有超過約 30 mA 的電流「漏」到別的地方，就在很短的時間內斷電。就算沒有地線，碰到的人也能保住性命。', set: { earth: false, fault: true, touch: true, rcd: true, reset: true }, view: 'panel' },
  ],
  tryIt: `
    <ul class="try-list">
      <li><p data-read>試試看所有組合：有沒有地線、有沒有故障、有沒有人碰、有沒有漏電斷路器。哪些組合是危險的？</p></li>
      <li><p data-read>在有地線的情況下故障，跳電後按「重新送電」。故障沒有排除，會怎樣？</p><button type="button" class="act" data-set='{"earth":true,"fault":true,"touch":false,"rcd":false,"reset":true}'>有地線＋故障</button></li>
      <li><p data-read>把熱水壺關掉（不加熱），只留下故障。外殼還會帶電嗎？</p><button type="button" class="act" data-set='{"kettle":false,"earth":false,"fault":true,"touch":false,"rcd":false,"reset":true}'>關掉熱水壺＋故障</button></li>
    </ul>`,
  challenge: {
    text: '在「<strong>故障</strong>」而且「<strong>有人碰到外殼</strong>」的情況下，讓這個人<strong>保持安全</strong>。',
    check: (s) => s.fault && s.touch && s.safe,
    done: '接上地線（無熔絲開關會因為大電流而跳脫），或裝上漏電斷路器（偵測到漏電就斷電）。最好兩個都有。',
  },
  body: `
    <h3>直流電和交流電</h3>
    <p data-read>電池提供的是<strong>直流電</strong>（DC）：電壓固定，電流方向不變。家裡插座提供的是<strong>交流電</strong>（AC）：電壓不斷在正、負之間變化，電流方向每秒來回改變很多次。</p>
    <div class="widget" data-widget="scope"></div>
    <p data-read>台灣的家用電是 <strong>110 V、60 Hz</strong>：每秒 60 個循環，電流方向每秒改變 120 次。冷氣、電熱水器這類大型電器，常用另外拉的 220 V 迴路。英國和歐洲是 230 V、50 Hz。</p>

    <h3>電從發電廠到你家</h3>
    <p data-read>發電廠發出的電先用變壓器把電壓升高，經過高壓電線送到各地，再一路降壓，最後變成 110 V 或 220 V 送進家裡。為什麼要用高壓送電？因為 P = I × V，送同樣的功率，電壓越高電流就越小，電線因為 I² × R 而浪費掉的熱就少很多。交流電最大的好處，就是很容易用變壓器升壓和降壓。</p>

    <h3>三條線，各有任務</h3>
    <table class="tbl"><thead><tr><th>電線</th><th>任務</th><th>電壓</th><th>電器電線常見顏色</th></tr></thead><tbody>
      <tr><td><strong>火線</strong>（live）</td><td>把電送進電器</td><td>在 +155 V 和 −155 V 之間變化，最危險</td><td>棕色</td></tr>
      <tr><td><strong>中性線</strong>（neutral）</td><td>讓電流流回去</td><td>接近 0 V</td><td>藍色</td></tr>
      <tr><td><strong>地線</strong>（earth）</td><td>連接金屬外殼和大地，平常沒有電流</td><td>0 V</td><td>綠黃色</td></tr></tbody></table>
    <p data-read>顏色是國際上電器電線常見的標準；房子牆裡的配線顏色可能不同，例如地線常用綠色、中性線常用白色。看到電線千萬不要自己拆，交給合格的電工。</p>

    <h3>插頭和插座</h3>
    <p data-read>台灣常見的三孔插座，兩個扁孔接火線和中性線，圓孔接地線。三孔插頭的圓腳通常比較長，插進去時會先接地，比較安全。英國的插頭有三支方腳，而且插頭裡面還裝了保險絲。</p>

    <h3>保護你的裝置</h3>
    <ul class="dot-list">
      <li data-read><strong>保險絲</strong>：一段熔點低的細金屬線，電流太大時會熔斷，斷了要換新的。</li>
      <li data-read><strong>無熔絲開關</strong>（斷路器）：電流太大時自動跳脫，排除問題後可以扳回去。家裡的配電箱裡就是它。</li>
      <li data-read><strong>漏電斷路器</strong>：比較火線和中性線的電流。正常時兩者一樣大；如果有電流漏到人身上或地面（常見設定約 30 mA），就立刻斷電。浴室、廚房、戶外的插座特別需要。</li>
      <li data-read><strong>接地</strong>：金屬外殼的電器接上地線，故障時電流會沿著地線流走，讓無熔絲開關跳脫。</li>
      <li data-read><strong>開關裝在火線上</strong>：關掉開關時，電器裡面就不會帶電，更換燈泡比較安全。</li>
    </ul>

    <h3>短路和過載</h3>
    <p data-read><strong>短路</strong>是火線和中性線直接碰在一起，中間沒有電器的電阻，電流會一下子變得非常大。<strong>過載</strong>是同一個迴路同時用太多電器，總電流超過電線能承受的大小。兩種情況都可能讓電線過熱起火，無熔絲開關就是為了這種時候而存在的。</p>

    <h3>用電安全守則</h3>
    <ul class="dot-list">
      <li data-read>手濕的時候不要碰插頭和開關。</li>
      <li data-read>拔插頭時拿著插頭本身，不要拉電線。</li>
      <li data-read>不要把延長線接在延長線上，也不要在同一條延長線上同時用電熱水壺、吹風機這類高功率電器。</li>
      <li data-read>電線外皮破損、插頭發燙或有焦味，就停止使用並更換。</li>
      <li data-read>跳電時先找出原因（過載、短路或漏電），不要一直硬扳回去。</li>
    </ul>

    <div class="myths">
      <h4>常見迷思</h4>
      <div class="myth"><p class="wrong">地線是讓電流流回去的線。</p><p class="right">電流平常從中性線回去。地線平常沒有電流，只在故障時把電流導入大地。</p></div>
      <div class="myth"><p class="wrong">插座沒插東西就沒有電。</p><p class="right">插座的火線一直都有電壓，不要把金屬東西插進去。</p></div>
      <div class="myth"><p class="wrong">跳電代表電器壞了。</p><p class="right">跳電通常是保護裝置正在保護你：可能是過載、短路或漏電。</p></div>
      <div class="myth"><p class="wrong">110 V 比 220 V 安全，碰到沒關係。</p><p class="right">110 V 也足以讓致命的電流流過人體。</p></div>
    </div>

    <div class="example">
      <h4>例題</h4>
      <p class="ex-q" data-read>電熱水壺標示 110 V、1650 W。（1）它工作時的電流是多少？（2）同一個 20 A 的迴路上再打開 1200 W 的吹風機，會跳電嗎？</p>
      <details><summary>看解答</summary>
        <ol class="ex-a"><li>I = P ÷ V = 1650 ÷ 110 = <strong>15 A</strong>。</li><li>總功率 1650 + 1200 = 2850 W，總電流 2850 ÷ 110 ≈ <strong>25.9 A</strong>，超過 20 A，<strong>會跳電</strong>。</li></ol>
      </details>
    </div>`,
  widgets: { scope: (el) => scope(el) },
  keywords: [
    { t: '直流電', en: 'direct current, DC', d: '電流方向固定不變的電，例如電池。' },
    { t: '交流電', en: 'alternating current, AC', d: '電流方向週期性來回改變的電，例如家用插座。' },
    { t: '頻率', en: 'frequency, Hz', d: '每秒循環的次數。台灣是 60 Hz。' },
    { t: '火線', en: 'live wire', d: '把電送進電器的那條線，電壓最高，最危險。' },
    { t: '中性線', en: 'neutral wire', d: '讓電流流回去的那條線，電壓接近 0 V。' },
    { t: '地線', en: 'earth wire', d: '連接金屬外殼和大地，故障時把電流導入大地。' },
    { t: '保險絲', en: 'fuse', d: '電流太大時會熔斷的細金屬線。' },
    { t: '無熔絲開關', en: 'circuit breaker', d: '電流太大時會自動跳脫、可以再扳回去的開關。' },
    { t: '漏電斷路器', en: 'residual current device, RCD', d: '火線和中性線的電流不一樣時（有漏電），立刻切斷電源的裝置。' },
  ],
  quiz: [
    { q: '台灣一般家庭插座提供的電是：', options: ['110 V、60 Hz 的交流電', '110 V 的直流電', '230 V、50 Hz 的交流電', '1.5 V 的直流電'], answer: 0, why: '台灣家用電是 110 V、60 Hz 的交流電；230 V、50 Hz 是英國和歐洲的規格。' },
    { q: '地線的主要作用是：', options: ['電器漏電時，把電流導入大地，保護使用者', '讓電流流回發電廠', '提高電器的功率', '讓電器比較省電'], answer: 0, why: '地線平常沒有電流，故障時讓電流沿著地線流走，使保護裝置跳脫。' },
    { q: '電器的開關應該裝在哪一條線上？', options: ['火線', '中性線', '地線', '哪一條都可以'], answer: 0, why: '開關切斷火線，關掉時電器裡面就不帶電。' },
    { q: '無熔絲開關跳脫，最常見的原因是：', options: ['電流太大（過載或短路）', '電壓太低', '電器太舊', '天氣太冷'], answer: 0, why: '無熔絲開關偵測的是過大的電流。' },
    { q: '漏電斷路器偵測的是：', options: ['火線和中性線的電流差', '電壓的高低', '電器的溫度', '電線的長度'], answer: 0, why: '正常時兩條線的電流一樣大；有電流漏到人或地面時，兩者不一樣，漏電斷路器就會斷電。' },
  ],
  summary: [
    '台灣家用電是交流電：110 V、60 Hz；大型電器有些用 220 V。',
    '火線有電壓、最危險；中性線是電流的回路；地線連接金屬外殼與大地，平常沒有電流。',
    '保險絲和無熔絲開關在電流過大時切斷電路；漏電斷路器在電流「漏」到人或地面時切斷電路。',
    '金屬外殼的電器要接地：故障時大電流沿地線流走，保護裝置就會跳脫。',
    '不用濕手碰插頭、不讓延長線過載、電線破損就更換。',
  ],
};
