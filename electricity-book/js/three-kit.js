// 立體圖工具組：舞台、墨線風格、紙面、標籤、電路元件與電子流動畫
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* ---------------- 主題（白天：方格筆記紙；夜間：藍晒圖） ---------------- */
const PALETTES = {
  light: {
    paper: '#f7f9f6', gridMinor: '#e1e8ef', gridMajor: '#c3d1e2',
    ink: '#1d2b3a', body: '#f3f1ea', body2: '#d7dee7', dark: '#3b4757', metal: '#b9c1cb',
    copper: '#c47b3d', glass: '#cfe0f0', wireTube: '#e8f0f8', electron: '#1767e8', plus: '#d2463b',
    cellBody: '#2c3e57', cellBand: '#d39a36', red: '#cf4436', black: '#2b3038', wood: '#dcc8a6',
    glow: '#ffbf2e', hot: '#fff1b8', sky: '#ffffff', groundLight: '#c5cfda', danger: '#e0352b', safe: '#2f8a57',
    live: '#8a5a2b', neutral: '#2d6fd6', earth: '#3c9a4a', earth2: '#e2c32c', skin: '#e8c3a3', cloth: '#5b7c99',
    balloonA: '#f0b13f', balloonB: '#79c7a6', wool: '#c3b6a6', wall: '#eceee9', plastic: '#f6f4ee',
  },
  dark: {
    paper: '#0f2a4a', gridMinor: '#163a63', gridMajor: '#22507f',
    ink: '#d9e7f7', body: '#1b3b62', body2: '#264c78', dark: '#0d213b', metal: '#5d7ea6',
    copper: '#e09a5e', glass: '#88aedb', wireTube: '#335c8c', electron: '#62d2ff', plus: '#ff7f70',
    cellBody: '#17345a', cellBand: '#e8b85c', red: '#ff7266', black: '#0b1728', wood: '#3c5d84',
    glow: '#ffc94f', hot: '#fff3c8', sky: '#cfe2ff', groundLight: '#1c3a5f', danger: '#ff5a4e', safe: '#5fd08a',
    live: '#d39a62', neutral: '#6aa2ff', earth: '#6cd47c', earth2: '#f2d94a', skin: '#d9b08e', cloth: '#7fa3c4',
    balloonA: '#d99a2b', balloonB: '#4fae8a', wool: '#7d6f60', wall: '#173556', plastic: '#24476f',
  },
};

export function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
let PAL = isDark() ? PALETTES.dark : PALETTES.light;
export const pal = () => PAL;

const themeHooks = new Set();
function addThemeHook(fn) { themeHooks.add(fn); fn(PAL); return fn; }
function refreshTheme() {
  const next = isDark() ? PALETTES.dark : PALETTES.light;
  if (next === PAL) return;
  PAL = next;
  themeHooks.forEach((f) => f(PAL));
}
new MutationObserver(refreshTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshTheme);

/* ---------------- 共用材質 ---------------- */
const matCache = new Map();
function shared(key, make) {
  if (!matCache.has(key)) { const m = make(); m.userData.shared = true; matCache.set(key, m); }
  return matCache.get(key);
}
export function surf(role, { rough = 0.82 } = {}) {
  return shared(`s:${role}:${rough}`, () => {
    const m = new THREE.MeshStandardMaterial({ color: PAL[role], roughness: rough, metalness: 0 });
    addThemeHook((p) => m.color.set(p[role]));
    return m;
  });
}
export function basic(role) {
  return shared(`b:${role}`, () => {
    const m = new THREE.MeshBasicMaterial({ color: PAL[role] });
    addThemeHook((p) => m.color.set(p[role]));
    return m;
  });
}
function lineMat() {
  return shared('line', () => {
    const m = new THREE.LineBasicMaterial({ color: PAL.ink, transparent: true, opacity: 0.85 });
    addThemeHook((p) => m.color.set(p.ink));
    return m;
  });
}
function hullMat(w) {
  const key = w.toFixed(4);
  return shared(`h:${key}`, () => {
    const m = new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normal * ${key};`);
    };
    m.customProgramCacheKey = () => `hull${key}`;
    addThemeHook((p) => m.color.set(p.ink));
    return m;
  });
}
// 透明物體（玻璃、導線外皮）用「邊緣描線」著色器：中間透明、輪廓變成墨線
export function rimMat(fillRole, { fill = 0.16, rim = 0.4, inkRole = 'ink' } = {}) {
  return shared(`r:${fillRole}:${fill}:${rim}:${inkRole}`, () => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uFill: { value: new THREE.Color(PAL[fillRole]) }, uInk: { value: new THREE.Color(PAL[inkRole]) }, uA: { value: fill }, uRim: { value: rim } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uFill; uniform vec3 uInk; uniform float uA; uniform float uRim; varying vec3 vN; varying vec3 vV;
        void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
          float r = smoothstep(1.0 - uRim, 1.0 - uRim*0.3, f);
          gl_FragColor = vec4(mix(uFill, uInk, r), mix(uA, 0.95, r));
          #include <colorspace_fragment>
        }`,
    });
    addThemeHook((p) => { m.uniforms.uFill.value.set(p[fillRole]); m.uniforms.uInk.value.set(p[inkRole]); });
    return m;
  });
}

/* ---------------- 墨線輪廓 ---------------- */
const noRay = () => {};
export function ink(mesh, { hull = 0.014, edges = 40 } = {}) {
  if (hull) {
    const h = new THREE.Mesh(mesh.geometry, hullMat(hull));
    h.raycast = noRay; h.castShadow = false; h.receiveShadow = false;
    mesh.add(h);
  }
  if (edges) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, edges), lineMat());
    e.raycast = noRay;
    mesh.add(e);
  }
  return mesh;
}
export function rbox(w, h, d, r = 0.04) { return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)); }
export function solid(geo, role, opts = {}) {
  const m = new THREE.Mesh(geo, opts.material || surf(role, opts));
  m.castShadow = opts.shadow !== false; m.receiveShadow = true;
  return ink(m, opts);
}
export function cyl(r, h, role, opts = {}) { return solid(new THREE.CylinderGeometry(r, opts.r2 ?? r, h, opts.seg ?? 24), role, opts); }

/* ---------------- 貼圖 ---------------- */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.22, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace; glowTex.userData.shared = true;
  return glowTex;
}
export function textSprite(text, { color = '#ffffff', bg = null, size = 0.26, weight = 800 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.beginPath(); x.arc(64, 64, 58, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = color; x.font = `${weight} 92px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); s.raycast = noRay;
  return s;
}

function drawPaper(canvas, p, size) {
  const x = canvas.getContext('2d'); const W = canvas.width; const k = W / size;
  x.globalCompositeOperation = 'source-over';
  x.clearRect(0, 0, W, W); x.fillStyle = p.paper; x.fillRect(0, 0, W, W);
  const grid = (step, color, lw) => {
    x.strokeStyle = color; x.lineWidth = lw; x.beginPath();
    for (let u = 0; u <= size + 1e-6; u += step) { const q = Math.round(u * k) + 0.5; x.moveTo(q, 0); x.lineTo(q, W); x.moveTo(0, q); x.lineTo(W, q); }
    x.stroke();
  };
  grid(0.25, p.gridMinor, 1); grid(1, p.gridMajor, 1.6);
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(W / 2, W / 2, W * 0.2, W / 2, W / 2, W * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, W);
  x.globalCompositeOperation = 'source-over';
}

/* ---------------- 舞台 ---------------- */
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Stage {
  constructor(host, opts = {}) {
    const { camera = [0, 5.2, 7.4], target = [0, 0.4, 0], fov = 30, minDistance = 3, maxDistance = 16, groundSize = 18, maxPolar = 1.36 } = opts;
    this.host = host; this.baseFov = fov; this.refAspect = opts.refAspect ?? 1.35;
    this.tickers = new Set(); this.labels = []; this.clickables = []; this.draggables = []; this.hooks = [];
    this.paused = false; this.visible = true; this.disposed = false; this.w = 1; this.h = 1;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.coarse = window.matchMedia('(pointer: coarse)').matches;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      this.renderer = null;
    }
    if (this.renderer) {
      const r = this.renderer;
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.domElement.className = 'stage-canvas';
      host.appendChild(r.domElement);
    } else {
      const fb = document.createElement('p'); fb.className = 'stage-fallback';
      fb.textContent = '這台裝置無法顯示 3D 立體圖。下方的按鈕、滑桿和讀數仍然可以用。';
      host.appendChild(fb);
    }
    this.dom = this.renderer ? this.renderer.domElement : document.createElement('div');
    this.labelLayer = document.createElement('div'); this.labelLayer.className = 'stage-labels';
    host.appendChild(this.labelLayer);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(fov, 1.4, 0.1, 200);
    this.camera.position.set(...camera);
    this.homeView = { pos: [...camera], target: [...target] };
    this.controls = new OrbitControls(this.camera, this.dom);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: false, rotateSpeed: 0.7, minDistance, maxDistance, maxPolarAngle: maxPolar, minPolarAngle: 0.12 });
    this.controls.target.set(...target);
    this.controls.update();
    this.setOrbit(!this.coarse);

    // 光源
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xc5cfda, 2.1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.3);
    this.sun.position.set(-3.5, 8, 4.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 24 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun);

    // 紙面（不受光照，顏色與頁面一致）＋ 影子接收面
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    if (this.renderer) tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    paper.rotation.x = -Math.PI / 2; paper.renderOrder = -2; paper.raycast = noRay;
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(groundSize, groundSize), new THREE.ShadowMaterial({ opacity: 0.16, depthWrite: false, transparent: true }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.001; catcher.receiveShadow = true; catcher.renderOrder = -1; catcher.raycast = noRay;
    this.scene.add(paper, catcher);
    this.onTheme((p) => {
      drawPaper(cv, p, groundSize); tex.needsUpdate = true;
      const dark = p === PALETTES.dark;
      this.hemi.color.set(p.sky); this.hemi.groundColor.set(p.groundLight);
      this.hemi.intensity = dark ? 1.7 : 2.1; this.sun.intensity = dark ? 1.5 : 2.3;
      catcher.material.opacity = dark ? 0.3 : 0.16;
    });

    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2(); this._v = V3();
    this._bindPointer();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.io = new IntersectionObserver((es) => { this.visible = es[0].isIntersecting; }, { rootMargin: '80px' });
    this.io.observe(host);
    this.resize();
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  onTheme(fn) { this.hooks.push(addThemeHook(fn)); return fn; }
  add(...objs) { this.scene.add(...objs); return objs[0]; }
  addTicker(fn) { this.tickers.add(fn); return () => this.tickers.delete(fn); }

  setOrbit(on) {
    this.orbit = on; this.controls.enabled = on;
    this.dom.style.touchAction = on ? 'none' : 'pan-y pinch-zoom';
  }
  setPaused(p) { this.paused = p; }

  resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.w = w; this.h = h;
    if (this.renderer) this.renderer.setSize(w, h, false);
    const aspect = w / h; this.camera.aspect = aspect;
    if (aspect < this.refAspect) {
      const t = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * this.refAspect / aspect;
      this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(t));
    } else this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  flyTo(pos, target, dur = 1.1) {
    const p1 = V3(...pos), t1 = V3(...target);
    if (this.reduced || dur <= 0) { this.camera.position.copy(p1); this.controls.target.copy(t1); this.controls.update(); this._fly = null; return; }
    this._fly = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1, t1, t: 0, dur };
  }
  home(dur) { this.flyTo(this.homeView.pos, this.homeView.target, dur); }
  zoom(f) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const d = clamp(off.length() * f, this.controls.minDistance, this.controls.maxDistance);
    off.setLength(d);
    const p = this.controls.target.clone().add(off);
    this.flyTo(p.toArray(), this.controls.target.toArray(), 0.35);
  }

  addLabel(html, pos, { cls = '', hidden = false } = {}) {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`; el.innerHTML = html;
    this.labelLayer.appendChild(el);
    const lab = {
      el, pos: typeof pos === 'function' ? pos : () => pos, hidden, html,
      set(h) { if (h !== lab.html) { lab.html = h; el.innerHTML = h; } },
      show(v) { lab.hidden = !v; el.style.display = v ? '' : 'none'; },
    };
    if (hidden) el.style.display = 'none';
    this.labels.push(lab);
    return lab;
  }
  addClickable(obj, onClick) { this.clickables.push({ obj, onClick }); }
  addDraggable(obj, spec) { this.draggables.push({ obj, ...spec }); }

  _ray(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster;
  }
  _pick(list, e) {
    if (!list.length) return null;
    const hits = this._ray(e).intersectObjects(list.map((i) => i.obj), true);
    for (const h of hits) {
      let o = h.object;
      while (o) { const item = list.find((i) => i.obj === o); if (item) return { item, hit: h }; o = o.parent; }
    }
    return null;
  }
  _bindPointer() {
    const dom = this.dom;
    this._onDown = (e) => {
      this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
      const d = this._pick(this.draggables, e);
      if (d) {
        this._drag = d.item; this.controls.enabled = false;
        try { dom.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
        d.item.onStart?.(d.hit.point);
        e.preventDefault();
      }
    };
    this._onMove = (e) => {
      if (this._drag) {
        const p = V3();
        if (this._ray(e).ray.intersectPlane(this._drag.plane(), p)) this._drag.onDrag(p);
        return;
      }
      if (e.pointerType === 'mouse' && !e.buttons) {
        const h = this._pick(this.clickables.concat(this.draggables), e);
        dom.style.cursor = h ? 'pointer' : '';
      }
    };
    this._onUp = (e) => {
      if (this._drag) {
        this._drag.onEnd?.(); this._drag = null; this.controls.enabled = this.orbit;
        try { dom.releasePointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
        this._down = null;
        return;
      }
      const d = this._down; this._down = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 700) {
        const c = this._pick(this.clickables, e);
        if (c) c.item.onClick(c.hit);
      }
    };
    this._onCancel = () => { this._down = null; if (this._drag) { this._drag.onEnd?.(); this._drag = null; this.controls.enabled = this.orbit; } };
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup', this._onUp);
    dom.addEventListener('pointercancel', this._onCancel);
  }

  _loop(now) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, Math.max(0, (now - this._last) / 1000));
    this._last = now;
    if (document.hidden) return;
    // 看不到圖的時候仍然繼續模擬（例如跳電計時），只是不畫
    if (!this.visible) { const sdt = this.paused ? 0 : dt; this.tickers.forEach((fn) => fn(sdt, dt)); return; }
    if (this._fly) {
      const f = this._fly; f.t = Math.min(1, f.t + dt / f.dur); const k = ease(f.t);
      this.camera.position.lerpVectors(f.p0, f.p1, k); this.controls.target.lerpVectors(f.t0, f.t1, k);
      if (f.t >= 1) this._fly = null;
    }
    this.controls.update();
    const sdt = this.paused ? 0 : dt;
    this.tickers.forEach((fn) => fn(sdt, dt));
    if (this.renderer) this.renderer.render(this.scene, this.camera);
    this._updateLabels();
  }
  _updateLabels() {
    const v = this._v;
    for (const l of this.labels) {
      if (l.hidden) continue;
      v.copy(l.pos()).project(this.camera);
      if (v.z > 1 || v.z < -1) { l.el.style.visibility = 'hidden'; continue; }
      l.el.style.visibility = '';
      l.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * this.w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * this.h).toFixed(1)}px)`;
    }
  }
  renderOnce() { this.controls.update(); if (this.renderer) this.renderer.render(this.scene, this.camera); this._updateLabels(); }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    this.ro.disconnect(); this.io.disconnect(); this.controls.dispose();
    const dom = this.dom;
    dom.removeEventListener('pointerdown', this._onDown); dom.removeEventListener('pointermove', this._onMove);
    dom.removeEventListener('pointerup', this._onUp); dom.removeEventListener('pointercancel', this._onCancel);
    this.hooks.forEach((h) => themeHooks.delete(h));
    disposeTree(this.scene);
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.renderer.domElement.remove(); }
    this.labelLayer.remove();
    this.host.querySelector('.stage-fallback')?.remove();
  }
}

export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      if (m.map && !m.map.userData?.shared) m.map.dispose();
      m.dispose();
    }
  });
}

/* ---------------- 路徑 ---------------- */
export function roundedPath(points, r = 0.12) {
  const pts = [];
  for (const p of points) { const v = p.isVector3 ? p.clone() : V3(...p); if (!pts.length || pts[pts.length - 1].distanceTo(v) > 1e-4) pts.push(v); }
  const path = new THREE.CurvePath();
  if (pts.length < 2) { path.add(new THREE.LineCurve3(pts[0], pts[0].clone().add(V3(0.001, 0, 0)))); return path; }
  let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const d1 = p.clone().sub(a), d2 = b.clone().sub(p);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    d1.normalize(); d2.normalize();
    if (d1.dot(d2) > 0.9999) continue; // 共線點直接略過
    const p1 = p.clone().addScaledVector(d1, -rr), p2 = p.clone().addScaledVector(d2, rr);
    if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev.clone(), p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, p.clone(), p2));
    prev = p2;
  }
  const last = pts[pts.length - 1];
  if (prev.distanceTo(last) > 1e-4) path.add(new THREE.LineCurve3(prev.clone(), last.clone()));
  return path;
}
export class XCurve extends THREE.Curve {
  constructor(curve, matrix) { super(); this.c = curve; this.m = matrix.clone(); }
  getPoint(t, target = new THREE.Vector3()) { return this.c.getPoint(t, target).applyMatrix4(this.m); }
}
export class HelixX extends THREE.Curve {
  // 沿 x 軸的螺旋線（可變電阻的線圈、燈絲）
  constructor(radius, pitch, x0, x1, y = 0, z = 0) { super(); Object.assign(this, { radius, pitch, x0, x1, y, z }); }
  getPoint(t, target = new THREE.Vector3()) {
    const x = this.x0 + (this.x1 - this.x0) * t;
    const ang = ((x - this.x0) / this.pitch) * Math.PI * 2;
    return target.set(x, this.y + this.radius * Math.cos(ang), this.z + this.radius * Math.sin(ang));
  }
}

/* ---------------- 端子與導線 ---------------- */
export function term(x, y, z, dx, dz = 0) { return { p: V3(x, y, z), d: V3(dx, 0, dz).normalize() }; }
export function worldTerm(group, t) {
  group.updateMatrixWorld(true);
  return { p: t.p.clone().applyMatrix4(group.matrixWorld), d: t.d.clone().transformDirection(group.matrixWorld) };
}
function addPost(group, t, role) {
  const m = cyl(0.042, 0.1, role, { hull: 0.008, seg: 14 });
  m.position.copy(t.p).addScaledVector(t.d, -0.03);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), t.d);
  group.add(m);
}
// 從端子 A 拉一條導線到端子 B：先沿端子方向伸出，再貼著紙面走，經過轉角點
// 端子有方向 d；沒有 d 的點當作貼在紙面上的接點（例如並聯的分岔點）
export function routePoints(tA, tB, corners = [], { h = 0.05, out = 0.16 } = {}) {
  const pts = [];
  if (tA.d) { const a1 = tA.p.clone().addScaledVector(tA.d, out); pts.push(tA.p.clone(), a1.clone(), V3(a1.x, h, a1.z)); }
  else pts.push(V3(tA.p.x, h, tA.p.z));
  for (const c of corners) pts.push(V3(c[0], h, c[1]));
  if (tB.d) { const b1 = tB.p.clone().addScaledVector(tB.d, out); pts.push(V3(b1.x, h, b1.z), b1.clone(), tB.p.clone()); }
  else pts.push(V3(tB.p.x, h, tB.p.z));
  return pts;
}
export function makeWire(points, { radius = 0.046, corner = 0.12 } = {}) {
  const path = roundedPath(points, corner);
  const segs = Math.max(8, Math.ceil(path.getLength() * 26));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(path, segs, radius, 10, false), rimMat('wireTube', { fill: 0.3, rim: 0.42 }));
  mesh.renderOrder = 1; mesh.castShadow = true;
  return { mesh, path };
}

/* ---------------- 元件：電池組 ---------------- */
export function makeBattery({ length = 1.9, cells = 2, plusRight = true } = {}) {
  const g = new THREE.Group();
  const base = solid(rbox(length, 0.12, 0.46, 0.04), 'body2'); base.position.y = 0.06; g.add(base);
  const endX = length / 2 - 0.05;
  for (const s of [-1, 1]) {
    const plate = solid(rbox(0.1, 0.4, 0.46, 0.03), 'metal'); plate.position.set(s * endX, 0.26, 0); g.add(plate);
  }
  const sp = plusRight ? 1 : -1;
  const T = { plus: term(sp * (length / 2 + 0.02), 0.22, 0, sp), minus: term(-sp * (length / 2 + 0.02), 0.22, 0, -sp) };
  addPost(g, T.plus, 'red'); addPost(g, T.minus, 'black');
  const cellGroup = new THREE.Group(); g.add(cellGroup);
  function setCells(n) {
    cellGroup.children.slice().forEach((c) => { cellGroup.remove(c); disposeTree(c); });
    const L = 0.46, gap = 0.03, total = n * L + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Group();
      const body = cyl(0.13, L * 0.9, 'cellBody'); body.rotation.z = Math.PI / 2; c.add(body);
      const band = cyl(0.133, L * 0.24, 'cellBand'); band.rotation.z = Math.PI / 2; band.position.x = sp * L * 0.31; c.add(band);
      const nub = cyl(0.045, L * 0.1, 'metal', { hull: 0.006, seg: 14 }); nub.rotation.z = Math.PI / 2; nub.position.x = sp * L * 0.48; c.add(nub);
      c.position.set(-total / 2 + i * (L + gap) + L / 2, 0.26, 0);
      cellGroup.add(c);
    }
    const strip = (length / 2 - 0.1) - total / 2;
    if (strip > 0.03) for (const s of [-1, 1]) {
      const m = solid(rbox(strip, 0.04, 0.12, 0.015), 'metal', { hull: 0.006 });
      m.position.set(s * (total / 2 + strip / 2), 0.26, 0); cellGroup.add(m);
    }
  }
  setCells(cells);
  return { group: g, T, setCells };
}

/* ---------------- 元件：燈泡 ---------------- */
export function makeLamp() {
  const g = new THREE.Group();
  const base = solid(rbox(0.74, 0.16, 0.44, 0.05), 'body'); base.position.y = 0.08; g.add(base);
  const T = { left: term(-0.39, 0.09, 0, -1), right: term(0.39, 0.09, 0, 1) };
  addPost(g, T.left, 'metal'); addPost(g, T.right, 'metal');
  const bulbGroup = new THREE.Group(); g.add(bulbGroup);
  const socket = cyl(0.12, 0.17, 'metal', { r2: 0.13 }); socket.position.y = 0.245; bulbGroup.add(socket);
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.008, 6, 28), surf('dark'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.21 + i * 0.05; bulbGroup.add(ring);
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.14, 24, 1, true), rimMat('glass', { fill: 0.14, rim: 0.36 }));
  neck.position.y = 0.39; neck.renderOrder = 3; bulbGroup.add(neck);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), rimMat('glass', { fill: 0.14, rim: 0.36 }));
  bulb.position.y = 0.64; bulb.renderOrder = 3; bulbGroup.add(bulb);
  const filMat = new THREE.MeshBasicMaterial({ color: PAL.dark });
  const fil = new THREE.Mesh(new THREE.TubeGeometry(new HelixX(0.022, 0.018, -0.08, 0.08, 0.66, 0), 90, 0.006, 5), filMat);
  bulbGroup.add(fil);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 5), basic('dark'));
    leg.position.set(s * 0.06, 0.5, 0); leg.rotation.z = s * -0.08; bulbGroup.add(leg);
  }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: PAL.glow, transparent: true, depthWrite: false, opacity: 0 }));
  glow.position.y = 0.64; glow.renderOrder = 4; glow.raycast = noRay; bulbGroup.add(glow);
  const light = new THREE.PointLight(0xffc35a, 0, 3.2, 2); light.position.y = 0.66; bulbGroup.add(light);
  let target = 0, b = 0, present = true, lift = 0;
  const dark = new THREE.Color(), hot = new THREE.Color();
  const api = {
    group: g, T, bulbGroup, bulb,
    get present() { return present; },
    setBrightness(x) { target = clamp(x, 0, 1.6); },
    setPresent(p) { present = p; },
    tick(dt, rdt) {
      const k = Math.min(1, (rdt ?? dt) * 9);
      b += ((present ? target : 0) - b) * k;
      lift += ((present ? 0 : 1) - lift) * Math.min(1, (rdt ?? dt) * 6);
      bulbGroup.position.y = lift * 0.75;
      bulbGroup.visible = lift < 0.97;
      dark.set(PAL.dark); hot.set(PAL.hot);
      filMat.color.copy(dark).lerp(hot, clamp(b * 1.4, 0, 1));
      glow.material.color.set(PAL.glow);
      glow.material.opacity = clamp(b * 0.95, 0, 0.92);
      const s = 0.35 + 1.5 * clamp(b, 0, 1.4); glow.scale.set(s, s, 1);
      light.intensity = 2.2 * b;
    },
  };
  return api;
}

/* ---------------- 元件：電表（安培計／伏特計） ---------------- */
function dialTexture(unit, ticks, name) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 366;
  const x = c.getContext('2d');
  x.fillStyle = '#fbfbf6'; x.fillRect(0, 0, 640, 366);
  x.strokeStyle = '#1d2b3a'; x.lineWidth = 6; x.strokeRect(8, 8, 624, 350);
  const cx = 320, cy = 340, R = 238, a0 = -50, a1 = 50;
  const ang = (f) => THREE.MathUtils.degToRad(a0 + (a1 - a0) * f) - Math.PI / 2;
  x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, R, ang(0), ang(1)); x.stroke();
  const max = ticks[ticks.length - 1];
  for (let i = 0; i <= 40; i++) {
    const f = i / 40, a = ang(f), len = i % 8 === 0 ? 26 : i % 4 === 0 ? 18 : 10;
    x.lineWidth = i % 8 === 0 ? 4 : 2;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); x.lineTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len)); x.stroke();
  }
  x.fillStyle = '#1d2b3a'; x.font = '600 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const t of ticks) { const a = ang(t / max); x.fillText(String(t), cx + Math.cos(a) * (R - 52), cy + Math.sin(a) * (R - 52)); }
  x.font = '800 84px Georgia, serif'; x.fillText(unit, cx, 236);
  x.font = '500 24px system-ui, sans-serif'; x.fillStyle = '#4b5a69'; x.fillText(name, cx, 292);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function makeMeter(unit = 'A', { ticks = [0, 0.2, 0.4, 0.6, 0.8, 1], plusLeft = true } = {}) {
  const g = new THREE.Group();
  const body = solid(rbox(0.9, 0.58, 0.46, 0.07), 'body'); body.position.y = 0.29; g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.4232), new THREE.MeshBasicMaterial({ map: dialTexture(unit, ticks, unit === 'A' ? '安培計' : '伏特計') }));
  face.position.set(0, 0.32, 0.232); g.add(face);
  const pivot = new THREE.Group(); pivot.position.set(0, 0.32 - 0.4232 / 2 + 0.4232 * (26 / 366), 0.238); g.add(pivot);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.262, 0.005).translate(0, 0.131, 0), basic('red'));
  pivot.add(needle);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), basic('black')); hub.rotation.x = Math.PI / 2; pivot.add(hub);
  const sp = plusLeft ? -1 : 1;
  const T = { plus: term(sp * 0.47, 0.12, 0.1, sp), minus: term(-sp * 0.47, 0.12, 0.1, -sp) };
  addPost(g, T.plus, 'red'); addPost(g, T.minus, 'black');
  const max = ticks[ticks.length - 1];
  let target = 0, ang = 0.873;
  return {
    group: g, T,
    setValue(v) { target = v; },
    tick(dt, rdt) {
      const f = clamp(target / max, -0.03, 1.05);
      const goal = (0.5 - f) * 1.745;
      ang += (goal - ang) * Math.min(1, (rdt ?? dt) * 7);
      pivot.rotation.z = ang;
    },
  };
}

/* ---------------- 元件：開關 ---------------- */
export function makeSwitch() {
  const g = new THREE.Group();
  const base = solid(rbox(0.92, 0.1, 0.42, 0.035), 'wood'); base.position.y = 0.05; g.add(base);
  const hinge = solid(rbox(0.1, 0.22, 0.14, 0.02), 'metal'); hinge.position.set(-0.28, 0.2, 0); g.add(hinge);
  for (const z of [-0.045, 0.045]) { const clip = solid(rbox(0.09, 0.22, 0.025, 0.008), 'metal', { hull: 0.008 }); clip.position.set(0.3, 0.2, z); g.add(clip); }
  const pivot = new THREE.Group(); pivot.position.set(-0.28, 0.28, 0); g.add(pivot);
  const blade = solid(rbox(0.66, 0.035, 0.06, 0.012).translate(0.33, 0, 0), 'metal', { hull: 0.008 }); pivot.add(blade);
  const knob = cyl(0.045, 0.16, 'red', { seg: 16, hull: 0.01 }); knob.position.set(0.66, 0.08, 0); pivot.add(knob);
  const T = { left: term(-0.48, 0.07, 0, -1), right: term(0.48, 0.07, 0, 1) };
  addPost(g, T.left, 'metal'); addPost(g, T.right, 'metal');
  let closed = true, ang = 0;
  return {
    group: g, T,
    get closed() { return closed; },
    setClosed(c) { closed = c; },
    tick(dt, rdt) { ang += ((closed ? 0 : 0.95) - ang) * Math.min(1, (rdt ?? dt) * 10); pivot.rotation.z = ang; },
  };
}

/* ---------------- 元件：可變電阻（滑線變阻器） ---------------- */
export function makeRheostat({ length = 2.4, Rmax = 20 } = {}) {
  const g = new THREE.Group();
  const L = length, y0 = 0.33, barY = 0.66;
  const base = solid(rbox(L + 0.5, 0.08, 0.5, 0.03), 'body2'); base.position.y = 0.04; g.add(base);
  for (const s of [-1, 1]) {
    const sup = solid(rbox(0.16, 0.66, 0.42, 0.03), 'dark'); sup.position.set(s * (L / 2 + 0.1), 0.37, 0); g.add(sup);
  }
  const tube = cyl(0.15, L, 'body', { seg: 28 }); tube.rotation.z = Math.PI / 2; tube.position.y = y0; g.add(tube);
  const split = { value: 1 };
  const coilMat = new THREE.MeshStandardMaterial({ color: PAL.copper, roughness: 0.5 });
  coilMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSplit = split;
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vLX;\nvoid main() {').replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLX = position.x;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uSplit; varying float vLX;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  if (vLX > uSplit) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62), 0.6);');
  };
  const coil = new THREE.Mesh(new THREE.TubeGeometry(new HelixX(0.163, 0.05, -L / 2, L / 2, y0, 0), Math.round(L / 0.05) * 10, 0.012, 5), coilMat);
  coil.castShadow = true; g.add(coil);
  const bar = solid(rbox(L + 0.36, 0.05, 0.05, 0.01), 'metal', { hull: 0.008 }); bar.position.y = barY; g.add(bar);
  const slider = new THREE.Group(); g.add(slider);
  const shoe = solid(rbox(0.18, 0.12, 0.14, 0.03), 'dark'); shoe.position.y = barY; slider.add(shoe);
  const finger = solid(rbox(0.03, 0.17, 0.05, 0.01), 'metal', { hull: 0.006 }); finger.position.y = barY - 0.14; slider.add(finger);
  const knob = cyl(0.05, 0.1, 'red', { seg: 16, hull: 0.01 }); knob.position.y = barY + 0.11; slider.add(knob);
  const T = { end: term(-(L / 2 + 0.2), 0.14, 0.12, -1), top: term(L / 2 + 0.2, barY, 0, 1) };
  addPost(g, T.end, 'metal'); addPost(g, T.top, 'metal');
  let f = 0.5;
  const api = {
    group: g, T, L, Rmax, slider, barY, y0,
    get f() { return f; },
    get R() { return Rmax * f; },
    setFraction(x) {
      f = clamp(x, 0.02, 1);
      const xs = -L / 2 + f * L;
      slider.position.x = xs; split.value = xs;
    },
    // 世界座標中，接入電路那一段線圈（從左端到滑片）
    coilPath() { g.updateMatrixWorld(true); return new XCurve(new HelixX(0.175, 0.05, -L / 2, -L / 2 + f * L, y0, 0), g.matrixWorld); },
    barPath() { g.updateMatrixWorld(true); return new XCurve(new THREE.LineCurve3(V3(-L / 2 + f * L, barY + 0.045, 0), V3(L / 2 + 0.18, barY + 0.045, 0)), g.matrixWorld); },
  };
  api.setFraction(0.5);
  return api;
}

/* ---------------- 電子（或電流箭頭）流動 ---------------- */
export class ChargeFlow {
  // 速度：每安培每秒移動 K 單位（動畫用，比真實電子快很多）
  constructor(stage, { capacity = 1200, radius = 0.026, role = 'electron', shape = 'sphere', spacing = 0.11, K = 1.6, jitter = true } = {}) {
    this.stage = stage; this.segs = []; this.spacing = spacing; this.K = K; this.t = 0; this.capacity = capacity;
    this.cone = shape === 'cone';
    this.jitter = jitter && !stage.reduced;
    const geo = this.cone ? new THREE.ConeGeometry(radius * 1.3, radius * 3.6, 12) : new THREE.SphereGeometry(radius, 12, 8);
    this.mesh = new THREE.InstancedMesh(geo, basic(role), capacity);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.raycast = noRay;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    stage.add(this.mesh);
    this._m = new THREE.Matrix4(); this._p = V3(); this._t = V3(); this._q = new THREE.Quaternion(); this._one = V3(1, 1, 1); this._up = V3(0, 1, 0);
    stage.addTicker((dt) => this.update(dt));
  }
  set visible(v) { this.mesh.visible = v; }
  get visible() { return this.mesh.visible; }
  // getI：沿路徑方向（起點→終點）的慣用電流（安培）。sign = -1 代表電子，方向與電流相反。
  add(path, { getI, spacing = this.spacing, sign = -1, ac = null } = {}) {
    const seg = { path, getI, spacing, sign, ac, phase: Math.random(), L: 1, n: 1, on: true, v: 0 };
    this._layout(seg); this.segs.push(seg);
    return seg;
  }
  setPath(seg, path) { seg.path = path; this._layout(seg); }
  _layout(seg) { seg.L = Math.max(0.01, seg.path.getLength()); seg.n = Math.max(1, Math.round(seg.L / seg.spacing)); }
  update(dt) {
    this.t += dt;
    let idx = 0;
    const { _m: m, _p: p, _t: tan, _q: q } = this;
    for (const s of this.segs) {
      if (!s.on) continue;
      const I = s.getI();
      s.v = s.sign * I * this.K * (s.spacing / this.spacing);
      let off = 0;
      if (s.ac) off = (s.ac.amp() * Math.sin(this.t * s.ac.w)) / s.L;
      else { s.phase = (s.phase + (s.v * dt) / s.L) % 1; if (s.phase < 0) s.phase += 1; }
      for (let k = 0; k < s.n && idx < this.capacity; k++) {
        let u = (k / s.n + s.phase + off) % 1; if (u < 0) u += 1;
        s.path.getPoint(u, p);
        if (this.jitter) { const w = this.t * 6 + k * 2.3; p.x += Math.sin(w) * 0.008; p.y += Math.cos(w * 1.3) * 0.008; p.z += Math.sin(w * 0.7 + 1) * 0.008; }
        if (this.cone) {
          s.path.getTangent(u, tan); if (s.v < 0) tan.negate();
          q.setFromUnitVectors(this._up, tan); m.compose(p, q, this._one);
        } else m.makeTranslation(p.x, p.y, p.z);
        this.mesh.setMatrixAt(idx++, m);
      }
    }
    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------------- 小工具 ---------------- */
export function fmt(x, d = 2) {
  if (!isFinite(x)) return '—';
  const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x;
  return v.toFixed(d);
}
