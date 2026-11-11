// 封面的小立體圖：電池、開關、燈泡，電子在導線裡流動
import { Stage, ChargeFlow, makeBattery, makeLamp, makeSwitch, makeWire, routePoints, worldTerm } from './three-kit.js';
import { Net, WIRE_R } from './circuit.js';

export function mountHero(el) {
  const stage = new Stage(el, { camera: [0.6, 4.6, 6.4], target: [0, 0.3, 0.1], fov: 30 });
  const flow = new ChargeFlow(stage, { K: 1.4 });
  const bat = makeBattery({ cells: 2, length: 1.7 }); bat.group.position.set(-0.4, 0, 1.1); stage.add(bat.group);
  const sw = makeSwitch(); sw.group.position.set(1.5, 0, 1.1); stage.add(sw.group);
  const lamp = makeLamp(); lamp.group.position.set(0.3, 0, -1.1); stage.add(lamp.group);
  stage.addTicker(lamp.tick); stage.addTicker(sw.tick);

  const net = new Net();
  const nBp = net.node(), nSl = net.node(), nSr = net.node(), nLr = net.node(), nLl = net.node();
  const nBm = 0;
  net.V(nBp, nBm, 3);
  const eS = net.R(nSl, nSr, WIRE_R);
  const eL = net.R(nLr, nLl, 6);
  const w = (A, B, a, b, corners) => {
    const el = net.R(a, b, WIRE_R);
    const wire = makeWire(routePoints(A, B, corners));
    stage.add(wire.mesh);
    flow.add(wire.path, { getI: () => el.I });
  };
  const T = (c, k) => worldTerm(c.group, c.T[k]);
  w(T(bat, 'plus'), T(sw, 'left'), nBp, nSl, []);
  w(T(sw, 'right'), T(lamp, 'right'), nSr, nLr, [[2.4, 1.1], [2.4, -1.1]]);
  w(T(lamp, 'left'), T(bat, 'minus'), nLl, nBm, [[-1.9, -1.1], [-1.9, 1.1]]);

  let closed = true;
  const update = () => {
    eS.R = closed ? WIRE_R : 1e9;
    net.solve();
    sw.setClosed(closed);
    lamp.setBrightness((eL.I * eL.I * eL.R) / 1.5);
  };
  stage.addClickable(sw.group, () => { closed = !closed; update(); });
  update();

  let t = 0;
  if (!stage.reduced) stage.addTicker((dt, rdt) => {
    t += rdt;
    const a = Math.sin(t * 0.18) * 0.35;
    if (!stage._fly && !stage._userTouched) {
      stage.camera.position.set(Math.sin(a) * 6.43 + 0.6 * Math.cos(a), 4.6, Math.cos(a) * 6.43 - 0.6 * Math.sin(a) + 0.1);
    }
  });
  stage.dom.addEventListener('pointerdown', () => { stage._userTouched = true; });

  return { toggle() { closed = !closed; update(); }, dispose() { stage.dispose(); } };
}
