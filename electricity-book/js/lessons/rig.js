// 各課立體圖共用：控制項、讀數、導線連接、事件
import { makeWire, routePoints, worldTerm } from '../three-kit.js';
import { WIRE_R } from '../circuit.js';

export const T = (comp, name) => worldTerm(comp.group, comp.T[name]);

// 在兩個端子之間拉導線，同時在電路中加入一段導線電阻，並讓電子沿著導線跑
export function wire(stage, flow, net, A, B, nA, nB, corners = [], opts = {}) {
  const el = net.R(nA, nB, WIRE_R);
  const w = makeWire(routePoints(A, B, corners, opts));
  stage.add(w.mesh);
  const seg = flow ? flow.add(w.path, { getI: () => el.I }) : null;
  w.mesh.userData = { nA, nB, el };
  return { el, seg, ...w };
}

// 圖上的編號標籤（對應圖例）
export function numTags(stage, positions) {
  return positions.map((p, i) => stage.addLabel(String(i + 1), p, { cls: 'num' }));
}

export function emitter() {
  const fns = new Set();
  return { on(fn) { fns.add(fn); return () => fns.delete(fn); }, emit(s) { fns.forEach((f) => f(s)); } };
}

let uid = 0;
// 控制面板：依照描述產生滑桿、分段按鈕、開關、按鈕
export function controls(root, spec) {
  const handlers = {};
  const ids = {};
  const html = spec.map((c) => {
    const id = `c${++uid}-${c.id || 'b'}`; ids[c.id] = id;
    if (c.type === 'range') {
      return `<div class="ctl ctl-range"><label for="${id}">${c.label}</label>
        <input id="${id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}">
        <output for="${id}" class="ctl-out">${c.fmt ? c.fmt(c.value) : c.value}</output></div>`;
    }
    if (c.type === 'seg') {
      return `<div class="ctl ctl-seg" role="group" aria-label="${c.label}"><span class="ctl-lab">${c.label}</span><div class="seg">${c.options.map((o) => `<button type="button" data-v="${o.value}" aria-pressed="${o.value === c.value}">${o.label}</button>`).join('')}</div></div>`;
    }
    if (c.type === 'toggle') {
      return `<div class="ctl ctl-toggle"><button type="button" id="${id}" class="tog" aria-pressed="${!!c.value}"><span class="tog-box" aria-hidden="true"></span>${c.label}</button></div>`;
    }
    if (c.type === 'buttons') {
      return `<div class="ctl ctl-btns">${c.label ? `<span class="ctl-lab">${c.label}</span>` : ''}<div class="btn-row">${c.items.map((b) => `<button type="button" class="btn small ${b.cls || ''}" data-b="${b.id}">${b.label}</button>`).join('')}</div></div>`;
    }
    if (c.type === 'chips') {
      return `<div class="ctl ctl-chips"><span class="ctl-lab">${c.label}</span><div class="chips">${c.items.map((it) => `<button type="button" data-c="${it.id}" aria-pressed="${!!it.value}">${it.label}</button>`).join('')}</div></div>`;
    }
    return '';
  }).join('');
  root.innerHTML = html;
  const blocks = [...root.children];
  spec.forEach((c, k) => {
    const el = blocks[k];
    if (c.type === 'range') {
      const input = el.querySelector('input'); const out = el.querySelector('output');
      input.addEventListener('input', () => { const v = +input.value; out.textContent = c.fmt ? c.fmt(v) : v; handlers[c.id]?.(v); });
    }
    if (c.type === 'seg') el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const raw = b.dataset.v; handlers[c.id]?.(isNaN(+raw) ? raw : +raw);
    }));
    if (c.type === 'toggle') { const b = el.querySelector('button'); b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); handlers[c.id]?.(v); }); }
    if (c.type === 'buttons') el.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => handlers[b.dataset.b]?.()));
    if (c.type === 'chips') el.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
      const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); handlers[c.id]?.(b.dataset.c, v);
    }));
  });
  const find = (id) => blocks[spec.findIndex((c) => c.id === id)];
  return {
    on(id, fn) { handlers[id] = fn; return this; },
    // 由程式更新控制項的顯示（不觸發事件）
    show(id, v) {
      const c = spec.find((s) => s.id === id); const el = find(id); if (!c || !el) return;
      if (c.type === 'range') { el.querySelector('input').value = v; el.querySelector('output').textContent = c.fmt ? c.fmt(v) : v; }
      if (c.type === 'seg') el.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(v) === b.dataset.v)));
      if (c.type === 'toggle') el.querySelector('button').setAttribute('aria-pressed', String(!!v));
      if (c.type === 'chips') el.querySelectorAll('[data-c]').forEach((b) => b.setAttribute('aria-pressed', String(!!v[b.dataset.c])));
    },
    disable(id, d) { const el = find(id); el?.querySelectorAll('input,button').forEach((x) => { x.disabled = d; }); },
    button(id) { return root.querySelector(`[data-b="${id}"]`); },
  };
}

// 讀數面板
export function readouts(root, items) {
  root.innerHTML = items.map((r) => `<div class="ro ${r.cls || ''}" data-r="${r.id}"><span class="ro-lab">${r.label}</span><span class="ro-val">—</span></div>`).join('');
  const map = {};
  items.forEach((r) => { map[r.id] = root.querySelector(`[data-r="${r.id}"]`); });
  return {
    set(id, text, state) {
      const el = map[id]; if (!el) return;
      const v = el.querySelector('.ro-val'); if (v.innerHTML !== text) v.innerHTML = text;
      el.dataset.state = state || '';
    },
  };
}
