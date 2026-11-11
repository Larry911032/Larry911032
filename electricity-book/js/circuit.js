// 小型電路求解器（修正節點分析 MNA）
// 節點 0 是參考點（0 V）。元件：
//   { type: 'R', a, b, R }        電阻（含導線、燈泡、電表）
//   { type: 'V', a, b, V }        理想電壓源：V(a) − V(b) = V（a 是正極）
// 回傳 { v: 各節點電位, i: 各元件電流（電阻由 a 流向 b；電壓源為「從正極流出」的電流） }

export function solveCircuit(nodeCount, elements) {
  const sources = elements.filter((e) => e.type === 'V');
  const n = nodeCount - 1; // 未知節點電位數量（不含參考點）
  const size = n + sources.length;
  const A = Array.from({ length: size }, () => new Float64Array(size));
  const z = new Float64Array(size);
  const idx = (node) => node - 1; // 節點 → 矩陣索引（參考點為 -1）

  // 每個節點加上極小的對地電導，避免浮接節點讓矩陣無解
  for (let k = 0; k < n; k++) A[k][k] += 1e-9;

  for (const e of elements) {
    if (e.type !== 'R') continue;
    const g = 1 / Math.max(e.R, 1e-6);
    const a = idx(e.a), b = idx(e.b);
    if (a >= 0) A[a][a] += g;
    if (b >= 0) A[b][b] += g;
    if (a >= 0 && b >= 0) { A[a][b] -= g; A[b][a] -= g; }
  }
  sources.forEach((s, k) => {
    const m = n + k;
    const a = idx(s.a), b = idx(s.b);
    if (a >= 0) { A[a][m] += 1; A[m][a] += 1; }
    if (b >= 0) { A[b][m] -= 1; A[m][b] -= 1; }
    z[m] = s.V;
  });

  const x = gauss(A, z);
  const v = new Float64Array(nodeCount);
  for (let k = 1; k < nodeCount; k++) v[k] = x[k - 1];

  const i = elements.map((e) => {
    if (e.type === 'R') return (v[e.a] - v[e.b]) / Math.max(e.R, 1e-6);
    const k = sources.indexOf(e);
    return -x[n + k]; // MNA 的電流方向是「流入正極」，轉成「從正極流出」
  });
  return { v, i };
}

// 方便建立電路的小工具：node() 建節點、R()/V() 加元件、solve() 之後每個元件會有 .I，節點電位在 .v
export class Net {
  constructor() { this.count = 1; this.els = []; this.v = new Float64Array(1); }
  node() { return this.count++; }
  R(a, b, R) { const e = { type: 'R', a, b, R, I: 0 }; this.els.push(e); return e; }
  V(a, b, V) { const e = { type: 'V', a, b, V, I: 0 }; this.els.push(e); return e; }
  solve() {
    const s = solveCircuit(this.count, this.els);
    this.els.forEach((e, k) => { e.I = s.i[k]; });
    this.v = s.v;
    return this;
  }
  vd(e) { return this.v[e.a] - this.v[e.b]; } // 元件兩端電壓
}

export const WIRE_R = 0.004; // 導線電阻（非常小）

function gauss(A, b) {
  const n = b.length;
  const M = A.map((row, r) => { const out = new Float64Array(n + 1); out.set(row); out[n] = b[r]; return out; });
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) continue;
    if (p !== c) { const t = M[p]; M[p] = M[c]; M[c] = t; }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = Math.abs(M[r][r]) < 1e-14 ? 0 : s / M[r][r];
  }
  return x;
}
