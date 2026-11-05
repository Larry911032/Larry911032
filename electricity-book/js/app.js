// 電學立體書：頁面路由、課程版面、預測／示範／挑戰／測驗、進度與朗讀
import { LESSONS } from './lessons/index.js';
import { mountHero } from './hero.js';
import { renderReview } from './review.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const view = $('#view');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- 進度（只存在這台裝置的瀏覽器） ---------------- */
const KEY = 'electricity-book-v1';
const store = (() => {
  let data = { stamps: {}, quiz: {}, predict: {}, last: '' };
  try { const raw = localStorage.getItem(KEY); if (raw) data = { ...data, ...JSON.parse(raw) }; } catch (_) { /* 無法讀取就用空白進度 */ }
  return { data, save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) { /* 無法儲存時忽略 */ } } };
})();

/* ---------------- 主題切換 ---------------- */
const themeBtn = $('#btn-theme');
function effectiveDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function syncThemeBtn() {
  const dark = effectiveDark();
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.querySelector('.lab').textContent = dark ? '白天' : '夜間';
}
try { const t = localStorage.getItem(KEY + ':theme'); if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t); } catch (_) { /* 忽略 */ }
themeBtn.addEventListener('click', () => {
  const next = effectiveDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(KEY + ':theme', next); } catch (_) { /* 忽略 */ }
  syncThemeBtn();
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeBtn);
new MutationObserver(syncThemeBtn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
syncThemeBtn();

/* ---------------- 目錄抽屜 ---------------- */
const toc = $('#toc');
const tocBtn = $('#btn-toc');
function renderToc() {
  const s = store.data.stamps;
  $('#toc-list').innerHTML = `
    <li><a href="#home"><span class="toc-n">封面</span><span class="toc-t">怎麼使用這本書</span></a></li>
    ${LESSONS.map((L) => `<li><a href="#lesson-${L.num}"><span class="toc-n">第 ${L.num} 課</span><span class="toc-t">${L.title}</span>${s[L.num] ? '<span class="toc-seal" title="已過關">過關</span>' : ''}</a></li>`).join('')}
    <li><a href="#review"><span class="toc-n">書末</span><span class="toc-t">總複習・公式・名詞</span></a></li>`;
}
function openToc() { renderToc(); toc.hidden = false; tocBtn.setAttribute('aria-expanded', 'true'); requestAnimationFrame(() => toc.classList.add('open')); $('#toc-list a')?.focus({ preventScroll: true }); }
function closeToc() { if (toc.hidden) return; toc.classList.remove('open'); tocBtn.setAttribute('aria-expanded', 'false'); toc.hidden = true; }
tocBtn.addEventListener('click', () => (toc.hidden ? openToc() : closeToc()));
$('#toc-close').addEventListener('click', closeToc);
toc.addEventListener('click', (e) => { if (e.target === toc) closeToc(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeToc(); });

/* ---------------- 朗讀（瀏覽器內建語音） ---------------- */
const readBtn = $('#btn-read');
const synth = window.speechSynthesis;
let reading = null;
if (!synth || typeof window.SpeechSynthesisUtterance === 'undefined') readBtn.hidden = true;
function speakable(el) {
  const t = (el.getAttribute('data-say') || el.textContent || '').replace(/\s+/g, ' ').trim();
  return t
    .replace(/×/g, '乘以').replace(/÷/g, '除以').replace(/ = /g, ' 等於 ').replace(/=/g, '等於')
    .replace(/Ω/g, '歐姆').replace(/−/g, '負').replace(/²/g, '平方').replace(/⁻¹⁹/g, '負十九次方').replace(/¹⁸/g, '十八次方');
}
function pickVoice() {
  const vs = synth.getVoices();
  return vs.find((v) => /zh[-_]TW/i.test(v.lang)) || vs.find((v) => /zh[-_](HK|Hant)/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang)) || null;
}
function stopReading() {
  if (!reading) return;
  reading = null;
  try { synth.cancel(); } catch (_) { /* 忽略 */ }
  $$('.reading').forEach((e) => e.classList.remove('reading'));
  readBtn.setAttribute('aria-pressed', 'false');
  readBtn.querySelector('.lab').textContent = '朗讀';
}
function startReading() {
  const els = $$('[data-read]', view).filter((el) => el.offsetParent !== null && !el.closest('[hidden]'));
  if (!els.length) return;
  const voice = pickVoice();
  reading = { i: 0 };
  readBtn.setAttribute('aria-pressed', 'true');
  readBtn.querySelector('.lab').textContent = '停止';
  const token = reading;
  const next = () => {
    if (reading !== token) return;
    $$('.reading').forEach((e) => e.classList.remove('reading'));
    if (token.i >= els.length) { stopReading(); return; }
    const el = els[token.i++];
    el.classList.add('reading');
    const r = el.getBoundingClientRect();
    if (r.top < 70 || r.bottom > window.innerHeight - 20) el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    const u = new SpeechSynthesisUtterance(speakable(el));
    u.lang = 'zh-TW'; if (voice) u.voice = voice; u.rate = 0.95;
    u.onend = next; u.onerror = next;
    synth.speak(u);
  };
  next();
}
readBtn.addEventListener('click', () => (reading ? stopReading() : startReading()));

/* ---------------- 頁首課次膠囊 ---------------- */
function updateHeader(n) {
  const pill = $('#pill');
  const s = store.data.stamps;
  const dots = LESSONS.map((L) => `<i class="${s[L.num] ? 'got' : ''} ${L.num === n ? 'cur' : ''}"></i>`).join('');
  const label = n ? `第 ${n} 課` : (location.hash === '#review' ? '書末' : '目錄');
  const title = n ? LESSONS[n - 1].title : (location.hash === '#review' ? '總複習' : '七堂課');
  $('#pill-main').innerHTML = `<span class="pill-n">${label}</span><span class="pill-dots" aria-hidden="true">${dots}</span><span class="pill-t">${title}</span>`;
  const prev = $('#pill-prev'), next = $('#pill-next');
  const go = (h) => () => { location.hash = h; };
  const onReview = location.hash === '#review';
  // 上一頁：第 n 課 → 第 n−1 課（第 1 課回封面）；書末 → 第 7 課；封面沒有上一頁
  prev.onclick = n ? go(n > 1 ? `#lesson-${n - 1}` : '#home') : go(`#lesson-${LESSONS.length}`);
  prev.disabled = !n && !onReview;
  // 下一頁：第 n 課 → 第 n+1 課（第 7 課到書末）；封面 → 第 1 課；書末 → 封面
  next.onclick = go(n ? (n < LESSONS.length ? `#lesson-${n + 1}` : '#review') : (onReview ? '#home' : '#lesson-1'));
  pill.dataset.n = n;
}
$('#pill-main').addEventListener('click', (e) => { e.preventDefault(); openToc(); });

/* ---------------- 共用小元件 ---------------- */
const LETTERS = 'ABCD';
export function quizHTML(qs, id) {
  return `<ol class="quiz" data-quiz="${id}">${qs.map((q, i) => `
    <li class="qz" data-i="${i}">
      <p class="qz-q" data-read>${q.q}</p>
      <div class="qz-opts">${q.options.map((o, j) => `<button type="button" class="qz-opt" data-j="${j}"><span class="qz-l">${LETTERS[j]}</span><span class="qz-o">${o}</span></button>`).join('')}</div>
      <div class="qz-why" hidden></div>
    </li>`).join('')}</ol>
    <div class="qz-foot"><p class="qz-score" aria-live="polite">答完全部題目後會顯示分數。</p><button type="button" class="btn ghost qz-reset">全部重做</button></div>`;
}
export function bindQuiz(root, qs, onScore) {
  const picks = new Array(qs.length).fill(-1);
  const score = () => {
    const done = picks.filter((p) => p >= 0).length;
    const right = picks.filter((p, i) => p === qs[i].answer).length;
    $('.qz-score', root).textContent = done < qs.length ? `已作答 ${done} / ${qs.length} 題` : `答對 ${right} / ${qs.length} 題${right === qs.length ? '，全對！' : '。看看解析，再試一次也可以。'}`;
    if (done === qs.length) onScore?.(right, qs.length);
  };
  $$('.qz', root).forEach((li) => {
    const i = +li.dataset.i;
    $$('.qz-opt', li).forEach((b) => b.addEventListener('click', () => {
      if (picks[i] >= 0) return;
      const j = +b.dataset.j; picks[i] = j;
      const ok = j === qs[i].answer;
      li.classList.add('answered', ok ? 'right' : 'wrong');
      b.classList.add('picked');
      $$('.qz-opt', li)[qs[i].answer].classList.add('correct');
      const why = $('.qz-why', li);
      why.innerHTML = `<b>${ok ? '答對了。' : `正確答案是 ${LETTERS[qs[i].answer]}。`}</b>${qs[i].why}`;
      why.hidden = false;
      score();
    }));
  });
  $('.qz-reset', root).addEventListener('click', () => {
    picks.fill(-1);
    $$('.qz', root).forEach((li) => { li.classList.remove('answered', 'right', 'wrong'); $$('.qz-opt', li).forEach((b) => b.classList.remove('picked', 'correct')); $('.qz-why', li).hidden = true; });
    score();
  });
  score();
}
function scrollPlateIntoView() {
  const plate = $('#plate');
  if (!plate) return;
  const r = plate.getBoundingClientRect();
  const stage = $('#stage');
  const sr = stage ? stage.getBoundingClientRect() : r;
  if (sr.bottom < 80 || sr.top > window.innerHeight * 0.6) plate.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
}

/* ---------------- 封面 ---------------- */
function mountHome() {
  const s = store.data.stamps;
  const got = LESSONS.filter((L) => s[L.num]).length;
  const last = store.data.last && /^lesson-\d$/.test(store.data.last) ? +store.data.last.slice(7) : 0;
  view.innerHTML = `
  <div class="sheet cover">
    <section class="cover-hero">
      <div class="cover-text">
        <p class="eyebrow">國中理化・IGCSE／GCSE 電學</p>
        <h1 class="cover-title">電學立體書</h1>
        <p class="cover-sub">七堂課，從一顆電子，一路走到家裡的插座。每一張圖都會從紙上立起來，你可以轉動它、按開關、拉滑桿，親眼看電子怎麼跑。</p>
        <div class="cover-cta">
          <a class="btn primary" href="#lesson-${last || 1}">${last ? `繼續第 ${last} 課` : '從第 1 課開始'}</a>
          <a class="btn ghost" href="#review">先看公式總表</a>
        </div>
        <p class="cover-progress">${got ? `你已經拿到 <b>${got}</b> / 7 個過關印章。` : '每一課完成挑戰，就能蓋一個「過關」印章。'}</p>
      </div>
      <figure class="plate hero-plate">
        <div class="stage" id="hero-stage" aria-label="立體圖：電池、開關和燈泡組成的電路，藍色小點是電線裡的電子"></div>
        <figcaption class="hero-cap"><span class="hand">按一下開關，看燈泡亮起來</span><button type="button" class="btn small" id="hero-switch">切換開關</button></figcaption>
      </figure>
    </section>

    <section class="how">
      <h2 class="h2">每一課都照這五步走</h2>
      <ol class="how-steps">
        <li><b>先猜猜看</b><span>還沒學之前，先選一個你覺得對的答案。</span></li>
        <li><b>看示範</b><span>一步一步看立體圖怎麼變化。</span></li>
        <li><b>翻開答案</b><span>對照你的預測，弄懂為什麼。</span></li>
        <li><b>動手試</b><span>自己操作電路，觀察讀數。</span></li>
        <li><b>挑戰過關</b><span>達成目標，蓋上過關印章，再做小測驗。</span></li>
      </ol>
    </section>

    <section class="lesson-list">
      <h2 class="h2">目錄</h2>
      <ol class="ll">
        ${LESSONS.map((L) => `
        <li><a class="ll-item" href="#lesson-${L.num}">
          <span class="ll-n">${L.num}</span>
          <span class="ll-body"><span class="ll-t">${L.title}<span class="ll-en">${L.en}</span></span><span class="ll-d">${L.short}</span></span>
          ${s[L.num] ? '<span class="ll-seal">過關</span>' : ''}
        </a></li>`).join('')}
        <li><a class="ll-item ll-back" href="#review"><span class="ll-n">書末</span><span class="ll-body"><span class="ll-t">總複習<span class="ll-en">Review</span></span><span class="ll-d">公式總表、名詞索引（中英對照）、綜合測驗、給老師和家長的說明。</span></span></a></li>
      </ol>
    </section>
  </div>`;
  const hero = mountHero($('#hero-stage'));
  $('#hero-switch').addEventListener('click', () => hero.toggle());
  return { dispose() { hero.dispose(); } };
}

/* ---------------- 總複習 ---------------- */
function mountReview() {
  view.innerHTML = `<div class="sheet review">${renderReview(LESSONS)}</div>`;
  const qs = LESSONS.flatMap((L) => L.quiz.slice(0, 2).map((q) => ({ ...q, q: `<span class="qz-tag">第 ${L.num} 課</span>${q.q}` })));
  const root = $('#review-quiz');
  root.innerHTML = quizHTML(qs, 'review');
  bindQuiz(root, qs);
  return { dispose() {} };
}

/* ---------------- 課程頁 ---------------- */
function mountLesson(L) {
  store.data.last = `lesson-${L.num}`; store.save();
  const saved = store.data.predict[L.num];
  const next = L.num < LESSONS.length ? LESSONS[L.num] : null;
  view.innerHTML = `
  <article class="sheet lesson" aria-labelledby="lesson-title">
    <div class="spread">
      <div class="col-intro">
        <header class="lesson-head">
          <p class="eyebrow">第 ${L.num} 課 <span class="en">${L.en}</span></p>
          <h1 id="lesson-title" data-read>${L.title}</h1>
          <p class="big-idea" data-read>${L.bigIdea}</p>
          <div class="goals"><p class="mini">這一課你會學到</p><ul>${L.goals.map((g) => `<li data-read>${g}</li>`).join('')}</ul></div>
        </header>
        <section class="sec predict" aria-labelledby="h-predict">
          <h2 class="sec-h" id="h-predict"><span class="no">1</span>先猜猜看</h2>
          <p class="q" data-read>${L.predict.q}</p>
          <div class="choices">${L.predict.options.map((o, j) => `<button type="button" class="choice" data-j="${j}" aria-pressed="${saved === j}"><span class="qz-l">${LETTERS[j]}</span><span>${o}</span></button>`).join('')}</div>
          <p class="hint hand">選一個答案就好，猜錯也沒關係。接著看下面的示範。</p>
        </section>
      </div>

      <figure class="plate" id="plate" aria-labelledby="fig-cap">
        <div class="plate-head">
          <figcaption id="fig-cap"><span class="fig-no">圖 ${L.num}</span>${L.figure.title}</figcaption>
          <div class="plate-tools">
            <button type="button" class="tool" data-tool="pause" aria-pressed="false" title="暫停或繼續動畫"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h3v12H6zM11 4h3v12h-3z"/></svg><span class="lab">暫停</span></button>
            <button type="button" class="tool only-touch" data-tool="rotate" aria-pressed="false" title="用手指轉動立體圖"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 10 5v2L6.5 4 10 1z"/></svg><span class="lab">轉動</span></button>
            <button type="button" class="tool" data-tool="zoomin" title="放大"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M9 4h2v5h5v2h-5v5H9v-5H4V9h5z"/></svg><span class="sr">放大</span></button>
            <button type="button" class="tool" data-tool="zoomout" title="縮小"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 9h12v2H4z"/></svg><span class="sr">縮小</span></button>
            <button type="button" class="tool" data-tool="home" title="回到原本的角度"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3l7 6h-2v7h-4v-4H9v4H5V9H3z"/></svg><span class="lab">重設</span></button>
          </div>
        </div>
        <div class="stage" id="stage" aria-label="${L.figure.alt}"></div>
        <ol class="legend">${L.figure.legend.map((t, i) => `<li><span class="lg-n">${i + 1}</span>${t}</li>`).join('')}</ol>
        <div class="controls" id="controls"></div>
        <div class="readouts" id="readouts" aria-live="polite"></div>
        <p class="plate-note hand">${L.figure.note || '可以拖曳立體圖轉動角度。'}</p>
      </figure>

      <div class="col-rest">
        <section class="sec watch" aria-labelledby="h-watch">
          <h2 class="sec-h" id="h-watch"><span class="no">2</span>看示範</h2>
          <ol class="steps">${L.watch.map((s, i) => `<li><button type="button" class="step" data-i="${i}"><span class="step-n">${i + 1}</span><span class="step-t" data-read>${s.text}</span></button></li>`).join('')}</ol>
          <div class="step-nav">
            <button type="button" class="btn ghost" data-nav="prev">上一步</button>
            <button type="button" class="btn ghost" data-nav="play" aria-pressed="false">自動播放</button>
            <button type="button" class="btn primary" data-nav="next">下一步</button>
          </div>
        </section>

        <section class="sec flap" aria-labelledby="h-flap">
          <h2 class="sec-h" id="h-flap"><span class="no">3</span>翻開答案</h2>
          <button type="button" class="flap-btn" aria-expanded="false" ${saved === undefined ? 'disabled' : ''}>
            <span class="flap-front">${saved === undefined ? '先在第 1 步選一個預測，才能翻開答案' : '翻開答案，看看你猜對了嗎'}</span>
          </button>
          <div class="flap-body" hidden></div>
        </section>

        <section class="sec try" aria-labelledby="h-try">
          <h2 class="sec-h" id="h-try"><span class="no">4</span>動手試</h2>
          <div class="try-body">${L.tryIt}</div>
        </section>

        <section class="sec challenge" aria-labelledby="h-ch">
          <h2 class="sec-h" id="h-ch"><span class="no">5</span>挑戰過關</h2>
          <div class="ch-card">
            <p class="ch-text" data-read>${L.challenge.text}</p>
            <p class="ch-status" aria-live="polite"></p>
            <div class="seal" aria-hidden="true"><span>過關</span></div>
          </div>
        </section>

        <section class="sec text" aria-labelledby="h-text">
          <h2 class="sec-h plain" id="h-text">課文：把觀念講清楚</h2>
          <div class="prose">${L.body}</div>
        </section>

        <section class="sec keywords" aria-labelledby="h-kw">
          <h2 class="sec-h plain" id="h-kw">名詞小卡</h2>
          <dl class="kw">${L.keywords.map((k) => `<div class="kw-item"><dt>${k.t}<span class="en">${k.en}</span></dt><dd data-read>${k.d}</dd></div>`).join('')}</dl>
        </section>

        <section class="sec quiz-sec" aria-labelledby="h-quiz">
          <h2 class="sec-h plain" id="h-quiz">小測驗</h2>
          <div id="quiz"></div>
        </section>

        <section class="sec recap" aria-labelledby="h-recap">
          <h2 class="sec-h plain" id="h-recap">重點整理</h2>
          <ul class="recap-list">${L.summary.map((t) => `<li data-read>${t}</li>`).join('')}</ul>
          <a class="next-card" href="${next ? `#lesson-${next.num}` : '#review'}">
            <span class="next-k">${next ? `下一課・第 ${next.num} 課` : '書末'}</span>
            <span class="next-t">${next ? next.title : '總複習：公式、名詞與綜合測驗'}</span>
          </a>
        </section>
      </div>
    </div>
  </article>`;

  // 立體圖
  const fig = L.figure.mount({ stageEl: $('#stage'), controlsEl: $('#controls'), readoutsEl: $('#readouts') });
  const stage = fig.stage;
  if (location.search.includes('debug')) window.__ebookFig = fig; // 測試用
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  $$('.plate-tools .tool').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.tool;
    if (t === 'pause') { const p = !stage.paused; stage.setPaused(p); b.setAttribute('aria-pressed', String(p)); b.querySelector('.lab').textContent = p ? '繼續' : '暫停'; }
    if (t === 'rotate') { const on = !stage.orbit; stage.setOrbit(on); b.setAttribute('aria-pressed', String(on)); }
    if (t === 'home') stage.home(0.9);
    if (t === 'zoomin') stage.zoom(0.8);
    if (t === 'zoomout') stage.zoom(1.25);
  }));
  if (!coarse) $$('.only-touch').forEach((b) => { b.hidden = true; });
  if (stage.reduced) { stage.setPaused(false); }

  // 1. 預測
  const flapBtn = $('.flap-btn'), flapBody = $('.flap-body');
  const renderFlap = () => {
    const pick = store.data.predict[L.num];
    if (pick === undefined) return;
    const ok = pick === L.predict.answer;
    flapBody.innerHTML = `<p class="verdict ${ok ? 'ok' : 'no'}">你的預測是 <b>${LETTERS[pick]}</b>：${ok ? '猜對了！' : `正確答案是 <b>${LETTERS[L.predict.answer]}</b>。`}</p><div class="prose" data-read>${L.predict.why}</div>`;
  };
  $$('.choice').forEach((b) => b.addEventListener('click', () => {
    const j = +b.dataset.j;
    store.data.predict[L.num] = j; store.save();
    $$('.choice').forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    flapBtn.disabled = false;
    $('.flap-front', flapBtn).textContent = '翻開答案，看看你猜對了嗎';
    if (!flapBody.hidden) renderFlap();
  }));
  flapBtn.addEventListener('click', () => {
    const open = flapBtn.getAttribute('aria-expanded') !== 'true';
    flapBtn.setAttribute('aria-expanded', String(open));
    if (open) renderFlap();
    flapBody.hidden = !open;
    $('.flap-front', flapBtn).textContent = open ? '蓋上答案' : '翻開答案，看看你猜對了嗎';
  });

  // 2. 示範步驟
  let stepI = -1, playTimer = 0;
  const steps = $$('.step');
  const goStep = (i, { scroll = true, view = true } = {}) => {
    stepI = Math.max(0, Math.min(L.watch.length - 1, i));
    const s = L.watch[stepI];
    steps.forEach((b, k) => { b.classList.toggle('active', k === stepI); b.setAttribute('aria-current', k === stepI ? 'step' : 'false'); });
    if (s.set) fig.set(s.set);
    if (s.view && view) fig.view(s.view);
    if (scroll) scrollPlateIntoView();
  };
  const stopPlay = () => { clearInterval(playTimer); playTimer = 0; const pb = $('[data-nav="play"]'); pb.setAttribute('aria-pressed', 'false'); pb.textContent = '自動播放'; };
  steps.forEach((b) => b.addEventListener('click', () => { stopPlay(); goStep(+b.dataset.i); }));
  $('[data-nav="prev"]').addEventListener('click', () => { stopPlay(); goStep(stepI <= 0 ? 0 : stepI - 1); });
  $('[data-nav="next"]').addEventListener('click', () => { stopPlay(); goStep(stepI + 1); });
  $('[data-nav="play"]').addEventListener('click', (e) => {
    if (playTimer) { stopPlay(); return; }
    e.currentTarget.setAttribute('aria-pressed', 'true'); e.currentTarget.textContent = '停止播放';
    goStep(stepI < 0 || stepI >= L.watch.length - 1 ? 0 : stepI + 1);
    playTimer = setInterval(() => { if (stepI >= L.watch.length - 1) { stopPlay(); return; } goStep(stepI + 1, { scroll: false }); }, 5200);
  });

  // 4. 動手試：按鈕直接操作立體圖
  view.addEventListener('click', onAct);
  function onAct(e) {
    const b = e.target.closest('[data-set],[data-view],[data-act]');
    if (!b || !view.contains(b) || b.closest('.plate')) return;
    if (b.dataset.set) fig.set(JSON.parse(b.dataset.set));
    if (b.dataset.view) fig.view(b.dataset.view);
    if (b.dataset.act) fig.act?.(b.dataset.act);
    scrollPlateIntoView();
  }

  // 5. 挑戰
  const chCard = $('.ch-card'), chStatus = $('.ch-status');
  const already = !!store.data.stamps[L.num];
  const showDone = (fresh) => {
    chCard.classList.add('done'); if (fresh) chCard.classList.add('fresh');
    chStatus.innerHTML = `<b>過關！</b>${L.challenge.done}`;
  };
  if (already) showDone(false); else chStatus.textContent = '還沒完成。用上面的立體圖試試看，達成時會自動蓋章。';
  let won = already;
  const offChange = fig.onChange((st) => {
    if (won) return;
    if (L.challenge.check(st)) {
      won = true;
      store.data.stamps[L.num] = true; store.save();
      showDone(true); updateHeader(L.num);
    }
  });

  // 課文中的小工具
  const widgetDisposers = $$('[data-widget]', view).map((el) => L.widgets?.[el.dataset.widget]?.(el, fig));

  // 測驗
  const quizRoot = $('#quiz');
  quizRoot.innerHTML = quizHTML(L.quiz, L.num);
  bindQuiz(quizRoot, L.quiz, (right, total) => {
    const best = store.data.quiz[L.num];
    if (!best || right > best.right) { store.data.quiz[L.num] = { right, total }; store.save(); }
  });

  // 一開始用第 1 步的電路狀態，但保持整體視角（不捲動、不移動鏡頭）
  goStep(0, { scroll: false, view: false });
  steps.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-current', 'false'); });
  stepI = -1;

  return {
    dispose() {
      stopPlay();
      view.removeEventListener('click', onAct);
      offChange?.();
      widgetDisposers.forEach((d) => typeof d === 'function' && d());
      fig.dispose();
    },
  };
}

/* ---------------- 路由 ---------------- */
let current = null;
function route() {
  const h = location.hash.replace('#', '');
  stopReading();
  closeToc();
  try { current?.dispose(); } catch (err) { console.error(err); }
  current = null;
  let n = 0;
  if (/^lesson-[1-7]$/.test(h)) { n = +h.slice(7); current = mountLesson(LESSONS[n - 1]); document.title = `第 ${n} 課 ${LESSONS[n - 1].title}・電學立體書`; }
  else if (h === 'review') { current = mountReview(); document.title = '總複習・電學立體書'; }
  else { current = mountHome(); document.title = '電學立體書'; }
  updateHeader(n);
  window.scrollTo(0, 0);
  view.focus({ preventScroll: true });
}
window.addEventListener('hashchange', route);
route();
