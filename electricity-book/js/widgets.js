// 課文裡的平面小工具（SVG）：原子、水路比喻、I–V 圖、導線電阻、示波器
const NS = 'http://www.w3.org/2000/svg';
let wid = 0;

/* ---------- 原子示意圖（鋰原子） ---------- */
export function atomSVG() {
  const c = [110, 110];
  const hex = [[0, 0, 'n'], [15, 0, 'p'], [7.5, 13, 'n'], [-7.5, 13, 'p'], [-15, 0, 'n'], [-7.5, -13, 'p'], [7.5, -13, 'n']];
  const nuc = hex.map(([x, y, k]) => `<circle cx="${c[0] + x}" cy="${c[1] + y}" r="9.5" class="${k === 'p' ? 'f-pos' : 'f-neu'} s-ink"/>${k === 'p' ? `<text x="${c[0] + x}" y="${c[1] + y + 4}" class="t-sign">+</text>` : ''}`).join('');
  const el = (a, r) => { const x = c[0] + r * Math.cos(a), y = c[1] + r * Math.sin(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="f-neg s-ink"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="t-sign">−</text>`; };
  return `<figure class="wfig">
  <svg viewBox="0 0 400 220" role="img" aria-label="鋰原子示意圖：中間的原子核有 3 個帶正電的質子和 4 個不帶電的中子，外面有 3 個帶負電的電子。">
    <circle cx="110" cy="110" r="48" class="orbit"/><circle cx="110" cy="110" r="84" class="orbit"/>
    ${nuc}
    ${el(-0.5, 48)}${el(2.64, 48)}${el(1.05, 84)}
    <g class="lg" transform="translate(222 48)">
      <circle cx="8" cy="0" r="8" class="f-pos s-ink"/><text x="8" y="4" class="t-sign">+</text><text x="24" y="5" class="t-lab">質子：帶正電，在原子核裡</text>
      <circle cx="8" cy="34" r="8" class="f-neu s-ink"/><text x="24" y="39" class="t-lab">中子：不帶電，在原子核裡</text>
      <circle cx="8" cy="68" r="8" class="f-neg s-ink"/><text x="8" y="72" class="t-sign">−</text><text x="24" y="73" class="t-lab">電子：帶負電，在外圍</text>
      <text x="0" y="112" class="t-note">鋰原子：3 個質子、3 個電子</text>
      <text x="0" y="132" class="t-note">正負一樣多 → 整體不帶電</text>
    </g>
  </svg>
  <figcaption>圖：原子的構造（示意圖，大小不按比例）</figcaption></figure>`;
}

/* ---------- 水路比喻 ---------- */
export function waterSVG() {
  return `<figure class="wfig">
  <svg viewBox="0 0 420 230" role="img" aria-label="水路比喻：抽水機把水抬到高處的水槽，水往下流經水車再回到低處，就像電池把電荷的電位提高，電荷經過燈泡時釋放能量。">
    <rect x="30" y="186" width="300" height="22" rx="4" class="f-water s-ink"/>
    <rect x="30" y="34" width="120" height="30" rx="4" class="f-water s-ink"/>
    <rect x="52" y="78" width="46" height="96" rx="6" class="f-card s-ink"/>
    <path d="M75 170 V90" class="s-pen arrow" marker-end="url(#ah${++wid})"/>
    <text x="75" y="226" class="t-lab mid">低處</text><text x="90" y="26" class="t-lab mid">高處的水槽</text>
    <text x="118" y="130" class="t-lab">抽水機</text>
    <path d="M150 52 L262 128" class="s-water thick"/>
    <g transform="translate(276 142)"><circle r="30" class="f-card s-ink"/>${[0, 45, 90, 135].map((a) => `<line x1="${(-30 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y1="${(-30 * Math.sin(a * Math.PI / 180)).toFixed(1)}" x2="${(30 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(30 * Math.sin(a * Math.PI / 180)).toFixed(1)}" class="s-ink"/>`).join('')}<circle r="5" class="f-ink"/></g>
    <text x="276" y="96" class="t-lab mid">水車</text>
    <path d="M300 160 Q312 176 306 186" class="s-water thick"/>
    <path d="M380 48 V190" class="s-ink" marker-start="url(#ah${wid})" marker-end="url(#ah${wid})"/>
    <text x="372" y="122" class="t-lab end">高度差</text>
    <defs><marker id="ah${wid}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" class="f-ink"/></marker></defs>
  </svg>
  <figcaption>圖：抽水機把水抬高，水往下流時推動水車。電路裡，電池像抽水機，燈泡像水車。</figcaption></figure>`;
}

/* ---------- I–V 圖 ---------- */
const COMPONENTS = {
  resistor: { name: '定值電阻（10 Ω）', I: (v) => v / 10 },
  lamp: { name: '燈泡的燈絲', I: (v) => Math.sign(v) * 0.2 * Math.pow(Math.abs(v), 0.6) },
  diode: { name: '二極體', I: (v) => (0.1 / 9) * Math.log(1 + Math.exp((v - 0.65) / 0.1)) },
};
export function ivPlot(el) {
  const id = ++wid;
  el.innerHTML = `<figure class="wfig iv">
    <div class="wctl">
      <div class="seg" role="group" aria-label="選擇元件">${Object.entries(COMPONENTS).map(([k, c], i) => `<button type="button" data-k="${k}" aria-pressed="${i === 0}">${c.name}</button>`).join('')}</div>
      <label class="wrange">電壓 V <input type="range" id="iv-v-${id}" min="-6" max="6" step="0.5" value="3"><output>3.0 V</output></label>
    </div>
    <svg viewBox="0 0 360 250" role="img" aria-label="I–V 圖：橫軸是電壓，縱軸是電流"></svg>
    <p class="wread" aria-live="polite"></p>
    <figcaption>圖：拉動電壓，看看電流怎麼變。直線代表電阻固定（遵守歐姆定律）。</figcaption></figure>`;
  const svg = el.querySelector('svg'), input = el.querySelector('input'), out = el.querySelector('output'), read = el.querySelector('.wread');
  let k = 'resistor';
  const X = (v) => 180 + v * 25, Y = (i) => 120 - i * 160;
  function draw() {
    const v = +input.value; out.textContent = `${v.toFixed(1)} V`;
    const f = COMPONENTS[k].I;
    let pts = '';
    for (let x = -6; x <= 6.001; x += 0.1) pts += `${X(x).toFixed(1)},${Y(Math.max(-0.65, Math.min(0.65, f(x)))).toFixed(1)} `;
    let grid = '';
    for (let x = -6; x <= 6; x += 2) grid += `<line x1="${X(x)}" y1="${Y(0.6)}" x2="${X(x)}" y2="${Y(-0.6)}" class="grid"/><text x="${X(x)}" y="${Y(-0.6) + 16}" class="t-tick mid">${x}</text>`;
    for (let i = -0.6; i <= 0.601; i += 0.2) { const yy = Y(i); grid += `<line x1="${X(-6)}" y1="${yy}" x2="${X(6)}" y2="${yy}" class="grid"/><text x="${X(-6) - 6}" y="${yy + 4}" class="t-tick end">${i.toFixed(1)}</text>`; }
    const i0 = f(v);
    svg.innerHTML = `${grid}
      <line x1="${X(-6)}" y1="${Y(0)}" x2="${X(6)}" y2="${Y(0)}" class="axis"/><line x1="${X(0)}" y1="${Y(0.6)}" x2="${X(0)}" y2="${Y(-0.6)}" class="axis"/>
      <text x="${X(6)}" y="${Y(0) - 8}" class="t-lab end">V（伏特）</text><text x="${X(0) + 8}" y="${Y(0.6) + 4}" class="t-lab">I（安培）</text>
      <polyline points="${pts}" class="curve"/>
      <line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${Y(i0)}" class="guide"/><line x1="${X(0)}" y1="${Y(i0)}" x2="${X(v)}" y2="${Y(i0)}" class="guide"/>
      <circle cx="${X(v)}" cy="${Y(i0)}" r="6" class="dot"/>`;
    const R = Math.abs(i0) > 1e-3 ? v / i0 : Infinity;
    read.innerHTML = `V = <b>${v.toFixed(1)} V</b>，I = <b>${i0.toFixed(2)} A</b>，R = V ÷ I = <b>${isFinite(R) ? `${R.toFixed(1)} Ω` : '非常大（幾乎沒有電流）'}</b>`;
  }
  el.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
    k = b.dataset.k; el.querySelectorAll('[data-k]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
  }));
  input.addEventListener('input', draw);
  draw();
}

/* ---------- 導線電阻：長度、截面積、材料 ---------- */
const MATERIALS = { cu: { name: '銅', rho: 1.7e-8 }, al: { name: '鋁', rho: 2.8e-8 }, ni: { name: '鎳鉻合金', rho: 1.1e-6 } };
export function wireR(el) {
  const id = ++wid;
  el.innerHTML = `<figure class="wfig wr">
    <div class="wctl">
      <div class="seg" role="group" aria-label="材料">${Object.entries(MATERIALS).map(([k, m], i) => `<button type="button" data-m="${k}" aria-pressed="${i === 0}">${m.name}</button>`).join('')}</div>
      <label class="wrange">長度 <input type="range" id="wr-l-${id}" min="0.5" max="4" step="0.5" value="1"><output>1.0 m</output></label>
      <label class="wrange">截面積 <input type="range" id="wr-a-${id}" min="0.5" max="4" step="0.5" value="1"><output>1.0 mm²</output></label>
    </div>
    <svg viewBox="0 0 360 90" role="img" aria-label="一段導線的示意圖，長度和粗細會隨滑桿改變"></svg>
    <p class="wread" aria-live="polite"></p>
    <figcaption>R = ρ × L ÷ A。ρ（讀作 rho）是材料的電阻率，L 是長度，A 是截面積。</figcaption></figure>`;
  const svg = el.querySelector('svg'), [inL, inA] = el.querySelectorAll('input'), outs = el.querySelectorAll('output'), read = el.querySelector('.wread');
  let m = 'cu';
  const fmtR = (R) => (R < 1 ? `${(R * 1000).toFixed(R < 0.01 ? 1 : 0)} mΩ（${R.toFixed(3)} Ω）` : `${R.toFixed(2)} Ω`);
  function draw() {
    const L = +inL.value, A = +inA.value;
    outs[0].textContent = `${L.toFixed(1)} m`; outs[1].textContent = `${A.toFixed(1)} mm²`;
    const R = (MATERIALS[m].rho * L) / (A * 1e-6);
    const w = 40 + L * 75, h = 8 + Math.sqrt(A) * 14, y = 45 - h / 2;
    svg.innerHTML = `<rect x="20" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="f-${m === 'cu' ? 'copper' : m === 'al' ? 'alu' : 'nichrome'} s-ink"/>
      <text x="${20 + w / 2}" y="${y - 8}" class="t-lab mid">${MATERIALS[m].name}線 ${L.toFixed(1)} m</text>`;
    const ref = (1.7e-8 * 1) / 1e-6;
    read.innerHTML = `電阻 R = <b>${fmtR(R)}</b>，是 1 m、1 mm² 銅線的 <b>${(R / ref).toFixed(R / ref < 10 ? 1 : 0)}</b> 倍`;
  }
  el.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => { m = b.dataset.m; el.querySelectorAll('[data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
  inL.addEventListener('input', draw); inA.addEventListener('input', draw);
  draw();
}

/* ---------- 示波器：直流與交流 ---------- */
const SOURCES = {
  dc: { name: '電池 1.5 V（直流）', kind: 'dc', V: 1.5, f: 0, perDiv: 0.5, unit: 'V' },
  tw: { name: '台灣插座 110 V、60 Hz', kind: 'ac', V: 110, f: 60, perDiv: 50, unit: 'V' },
  uk: { name: '英國插座 230 V、50 Hz', kind: 'ac', V: 230, f: 50, perDiv: 100, unit: 'V' },
};
export function scope(el) {
  el.innerHTML = `<figure class="wfig scope">
    <div class="wctl"><div class="seg" role="group" aria-label="選擇電源">${Object.entries(SOURCES).map(([k, s], i) => `<button type="button" data-s="${k}" aria-pressed="${i === 1}">${s.name}</button>`).join('')}</div></div>
    <svg viewBox="0 0 400 250" role="img" aria-label="示波器畫面：橫軸是時間，縱軸是電壓"></svg>
    <p class="wread" aria-live="polite"></p>
    <figcaption>示波器畫面：橫軸每格 5 毫秒（ms），縱軸每格的電壓寫在左上角。</figcaption></figure>`;
  const svg = el.querySelector('svg'), read = el.querySelector('.wread');
  let s = SOURCES.tw;
  const x0 = 20, y0 = 20, W = 360, H = 200; // 10 × 8 格
  function draw() {
    let g = '';
    for (let i = 0; i <= 10; i++) g += `<line x1="${x0 + i * 36}" y1="${y0}" x2="${x0 + i * 36}" y2="${y0 + H}" class="sgrid ${i === 5 ? 'mid' : ''}"/>`;
    for (let j = 0; j <= 8; j++) g += `<line x1="${x0}" y1="${y0 + j * 25}" x2="${x0 + W}" y2="${y0 + j * 25}" class="sgrid ${j === 4 ? 'mid' : ''}"/>`;
    const peak = s.kind === 'ac' ? s.V * Math.SQRT2 : s.V;
    let pts = '';
    for (let k = 0; k <= 400; k++) {
      const t = (k / 400) * 0.05; // 0 ~ 50 ms
      const v = s.kind === 'ac' ? peak * Math.sin(2 * Math.PI * s.f * t) : s.V;
      pts += `${(x0 + (t / 0.05) * W).toFixed(1)},${(y0 + H / 2 - (v / s.perDiv) * 25).toFixed(1)} `;
    }
    svg.innerHTML = `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" rx="6" class="screen"/>${g}
      <polyline points="${pts}" class="trace"/>
      <text x="${x0 + 8}" y="${y0 + 16}" class="t-scope">縱軸每格 ${s.perDiv} V</text>
      <text x="${x0 + W - 8}" y="${y0 + H - 8}" class="t-scope end">0 ～ 50 ms</text>`;
    read.innerHTML = s.kind === 'dc'
      ? '直流電：電壓固定在 <b>1.5 V</b>，電流方向不變。'
      : `交流電：電壓在 <b>+${peak.toFixed(0)} V</b> 和 <b>−${peak.toFixed(0)} V</b> 之間來回變化，每秒 <b>${s.f}</b> 個循環（${s.f} Hz），一個循環 ${(1000 / s.f).toFixed(1)} ms。平常說的「${s.V} V」是<strong>有效值</strong>。`;
  }
  el.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { s = SOURCES[b.dataset.s]; el.querySelectorAll('[data-s]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));
  draw();
}

export { NS };
