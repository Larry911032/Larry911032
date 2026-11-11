// 截圖檢查：開一個本機伺服器，用 Playwright（Chromium）打開各頁、截圖，並列出 console 錯誤。
// 用法：node shoot.cjs '<json 設定>'
// 設定：{ root?, shots: [{ page?, hash, out?, w?, h?, dark?, touch?, full?, wait?, actions?: [{click}|{eval}|{wait}|{scroll}|{shot, full?}] }] }
// root 預設是這本書的資料夾；page 預設 index.html。
// three.js 會優先用 tools/vendor/three 的本機檔案（先跑 fetch-vendor.sh），沒有就直接連 CDN。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const cfg = JSON.parse(process.argv[2]);
const ROOT = path.resolve(cfg.root || path.join(__dirname, '..'));
const VENDOR = path.join(__dirname, 'vendor', 'three');
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  // 無頭瀏覽器用軟體算繪 WebGL
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const s of cfg.shots) {
    const ctx = await browser.newContext({ viewport: { width: s.w || 1400, height: s.h || 900 }, deviceScaleFactor: s.dpr || 1, colorScheme: s.dark ? 'dark' : 'light', hasTouch: !!s.touch, isMobile: !!s.touch, reducedMotion: s.reduced ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
    await page.route(`${CDN}**`, (route) => {
      const f = path.join(VENDOR, route.request().url().slice(CDN.length));
      if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) });
      else route.continue();
    });
    // 測試時不載字型，改用系統字型（中文需要系統裡有中文字型）
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto(`http://localhost:${port}/${s.page || 'index.html'}${s.hash ? '#' + s.hash : ''}`);
    await page.waitForTimeout(s.wait || 2500);
    for (const a of s.actions || []) {
      try {
        if (a.click) await page.click(a.click, { timeout: 4000 });
        if (a.eval) { const r = await page.evaluate(a.eval); if (r !== undefined) console.log('eval:', JSON.stringify(r).slice(0, 2000)); }
        if (a.wait) await page.waitForTimeout(a.wait);
        if (a.scroll) await page.locator(a.scroll).first().scrollIntoViewIfNeeded();
        if (a.shot) await page.screenshot({ path: a.shot, fullPage: !!a.full });
      } catch (e) { logs.push(`[action error] ${JSON.stringify(a)}: ${e.message.split('\n')[0]}`); }
    }
    if (s.out) await page.screenshot({ path: s.out, fullPage: !!s.full });
    console.log(`== ${s.hash || '(home)'} ${s.w || 1400}x${s.h || 900}${s.dark ? ' dark' : ''}${s.out ? ' → ' + s.out : ''}`);
    logs.slice(0, 30).forEach((l) => console.log('  ' + l));
    await ctx.close();
  }
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
