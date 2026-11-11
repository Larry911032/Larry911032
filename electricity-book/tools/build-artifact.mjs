// 把這本書打包成單一 HTML 片段，給 Claude 的 Artifact 發布用。
// 用法：cd tools && npm install && node build-artifact.mjs [輸出資料夾]
// 產出：electricity-book.html（發布用片段）、preview.html（本機預覽用，包了完整骨架）
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(process.argv[2] || path.join(root, 'tools', 'dist'));
const res = await build({
  entryPoints: [path.join(root, 'js/app.js')], bundle: true, format: 'esm', write: false,
  external: ['three', 'three/addons/*'], minify: true, charset: 'utf8', target: 'es2020', legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'css/book.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pick = (re) => { const m = html.match(re); if (!m) throw new Error('missing ' + re); return m[0]; };
const fonts = pick(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>/);
const importmap = pick(/<script type="importmap">[\s\S]*?<\/script>/);
const title = pick(/<title>[^<]*<\/title>/);
const desc = pick(/<meta name="description"[^>]*>/);
const body = html.split('<body>')[1].split('</body>')[0].replace(/<script type="module" src="js\/app\.js"><\/script>/, '').trim();
// Artifact 會自動包上 <!doctype>、<head>、<body>，所以這裡只輸出內容
const fragment = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
${desc}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>
${css}
</style>
${importmap}
${body}
<script type="module">
${js}
</script>
`;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'electricity-book.html'), fragment);
fs.writeFileSync(path.join(outDir, 'preview.html'), `<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n${fragment}</body></html>`);
console.log(`寫入 ${outDir}：片段 ${Buffer.byteLength(fragment)} bytes，其中 JS ${Buffer.byteLength(js)} bytes`);
