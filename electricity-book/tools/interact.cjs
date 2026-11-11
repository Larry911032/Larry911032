// 互動測試：在 3D 圖上點擊、拖曳，檢查每一課的狀態（開關、探棒、滑片、燈泡、跳電、漏電）。
// 用法：node interact.cjs [截圖資料夾]。頁面用 ?debug 開啟，app.js 會把目前的立體圖放在 window.__ebookFig。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'shots'));
fs.mkdirSync(OUT, { recursive: true });
const VENDOR = path.join(__dirname, 'vendor', 'three');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

async function screenOf(page, xyz) {
  return page.evaluate(([x, y, z]) => {
    const f = window.__ebookFig; const cam = f.stage.camera;
    const v = new cam.position.constructor(x, y, z).project(cam);
    const r = f.stage.dom.getBoundingClientRect();
    return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height];
  }, xyz);
}
const state = (page) => page.evaluate(() => { const s = window.__ebookFig.get(); const o = {}; for (const k in s) if (typeof s[k] !== 'object') o[k] = typeof s[k] === 'number' ? +s[k].toFixed(3) : s[k]; return o; });

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (route) => {
    const f = path.join(VENDOR, route.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.0/', ''));
    if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.continue();
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const go = async (hash) => { await page.goto(`http://localhost:${port}/index.html?debug#${hash}`); await page.waitForTimeout(2200); await page.locator('#plate').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); };

  // 第 2 課：點開關
  await go('lesson-2');
  console.log('L2 before', JSON.stringify(await state(page)));
  let [x, y] = await screenOf(page, [1.55, 0.22, 1.15]);
  await page.mouse.click(x, y); await page.waitForTimeout(400);
  console.log('L2 after switch click', JSON.stringify(await state(page)));

  // 第 3 課：點導線放探棒
  await go('lesson-3');
  [x, y] = await screenOf(page, [0, 0.05, -1.0]);   // 中間那條導線
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  [x, y] = await screenOf(page, [-2.4, 0.05, 0.0]); // 左邊導線
  await page.mouse.click(x, y); await page.waitForTimeout(400);
  console.log('L3 after probe clicks (expect reading = V_A ≈ 1.5)', JSON.stringify(await state(page)));
  await page.screenshot({ path: `${OUT}/i-l3.png` });

  // 第 4 課：拖曳滑片
  await go('lesson-4');
  const s0 = await state(page);
  [x, y] = await screenOf(page, [0.55 + (-1.2 + 0.25 * 2.4), 0.77, -1.2]);
  const [x2, y2] = await screenOf(page, [0.55 + (-1.2 + 0.85 * 2.4), 0.66, -1.2]);
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(400);
  console.log('L4 drag', JSON.stringify(s0), '→', JSON.stringify(await state(page)));
  await page.screenshot({ path: `${OUT}/i-l4.png` });

  // 第 5 課：並聯、點燈泡 1
  await go('lesson-5');
  await page.click('.ctl-seg button[data-v="parallel"]'); await page.waitForTimeout(300);
  [x, y] = await screenOf(page, [0, 0.62, -1.1]);
  await page.mouse.click(x, y); await page.waitForTimeout(800);
  console.log('L5 parallel, lamp1 clicked', JSON.stringify(await state(page)));
  await page.screenshot({ path: `${OUT}/i-l5.png` });

  // 第 6 課：點電熱水壺、再開電鍋和吹風機 → 跳電
  await go('lesson-6');
  [x, y] = await screenOf(page, [2.35, 0.2, 0.12]);
  await page.mouse.click(x, y); await page.waitForTimeout(500);
  console.log('L6 kettle click', JSON.stringify(await state(page)));
  await page.click('[data-c="dryer"]'); await page.waitForTimeout(1500);
  console.log('L6 + dryer (expect trip)', JSON.stringify(await state(page)));
  await page.screenshot({ path: `${OUT}/i-l6.png` });

  // 第 7 課：沒地線＋故障＋觸碰 → 危險；再裝漏電斷路器 → 跳脫
  await go('lesson-7');
  const tog = (label) => page.locator('.tog', { hasText: label }).click();
  await tog('有接地線'); await tog('故障'); await tog('有人碰到'); await page.waitForTimeout(900);
  console.log('L7 no earth + fault + touch', JSON.stringify(await state(page)));
  await page.screenshot({ path: `${OUT}/i-l7a.png` });
  await tog('安裝漏電斷路器'); await page.waitForTimeout(900);
  console.log('L7 + RCD', JSON.stringify(await state(page)), await page.locator('.ch-status').innerText());
  await page.click('[data-b="reset"]'); await tog('安裝漏電斷路器'); await tog('有接地線'); await page.waitForTimeout(900);
  console.log('L7 earth on, no RCD', JSON.stringify(await state(page)));

  logs.forEach((l) => console.log(l));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
