// 課程流程測試：預測 → 翻開答案 → 示範步驟 → 測驗計分 → 目錄 → 主題切換 → 下一課 → 重新整理後進度還在。
// 用法：node flow.cjs [截圖資料夾]
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
(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[console] ' + m.text()); });
  await page.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', (route) => {
    const f = path.join(VENDOR, route.request().url().replace('https://cdn.jsdelivr.net/npm/three@0.160.0/', ''));
    if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(f) }); else route.continue();
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto(`http://localhost:${port}/index.html#lesson-2`); await page.waitForTimeout(2000);

  console.log('flap disabled before predict:', await page.locator('.flap-btn').isDisabled());
  await page.click('.choice[data-j="0"]');
  await page.click('.flap-btn'); await page.waitForTimeout(200);
  console.log('verdict:', await page.locator('.verdict').innerText());
  await page.click('.step[data-i="3"]'); await page.waitForTimeout(300);
  console.log('step 4 active:', await page.locator('.step.active .step-n').innerText());
  // 測驗：全部選 A
  const n = await page.locator('.qz').count();
  for (let i = 0; i < n; i++) await page.locator('.qz').nth(i).locator('.qz-opt').first().click();
  console.log('quiz score:', await page.locator('.qz-score').innerText());
  await page.locator('.quiz-sec').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/f-quiz.png` });
  // 目錄
  await page.click('#btn-toc'); await page.waitForTimeout(300);
  console.log('toc items:', await page.locator('#toc-list li').count());
  await page.screenshot({ path: `${OUT}/f-toc.png` });
  await page.keyboard.press('Escape');
  // 主題切換
  await page.click('#btn-theme');
  console.log('theme attr:', await page.evaluate(() => document.documentElement.getAttribute('data-theme')));
  // 下一課按鈕
  await page.click('#pill-next'); await page.waitForTimeout(1500);
  console.log('after next →', await page.evaluate(() => location.hash), await page.locator('#lesson-title').innerText());
  // 重新整理後進度還在
  await page.goto(`http://localhost:${port}/index.html#home`); await page.waitForTimeout(1500);
  console.log('cover CTA:', await page.locator('.cover-cta .btn.primary').innerText());
  console.log('stored:', await page.evaluate(() => localStorage.getItem('electricity-book-v1')));
  logs.forEach((l) => console.log(l));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
