// 書末：公式總表、名詞索引、綜合測驗、給老師和家長、資料來源
const FORMULAS = [
  { f: 'Q = n × e', say: '電量 = 電子個數 × 一個電子的電量（e ≈ 1.6 × 10⁻¹⁹ C）', unit: '庫侖 C', n: 1 },
  { f: 'I = Q ÷ t', say: '電流 = 每秒通過的電量', unit: '安培 A（= C/s）', n: 2 },
  { f: 'V = E ÷ Q', say: '電壓 = 每庫侖電荷轉換的能量', unit: '伏特 V（= J/C）', n: 3 },
  { f: 'R = V ÷ I　（V = I × R）', say: '電阻 = 電壓 ÷ 電流（歐姆定律）', unit: '歐姆 Ω（= V/A）', n: 4 },
  { f: 'R = ρ × L ÷ A', say: '導線越長電阻越大，越粗電阻越小', unit: 'Ω', n: 4 },
  { f: 'R = R₁ + R₂', say: '串聯的總電阻', unit: 'Ω', n: 5 },
  { f: '1/R = 1/R₁ + 1/R₂', say: '並聯的總電阻（比任何一個支路都小）', unit: 'Ω', n: 5 },
  { f: 'P = I × V = I² × R', say: '電功率 = 每秒轉換的電能', unit: '瓦特 W（= J/s）', n: 6 },
  { f: 'E = P × t', say: '電能 = 功率 × 時間', unit: '焦耳 J，或 度（kWh）', n: 6 },
  { f: '1 度 = 1 kWh = 3.6 × 10⁶ J', say: '1 千瓦的電器用 1 小時', unit: '', n: 6 },
];

const SOURCES = [
  { t: 'NIST：基本電荷 e 的數值（1.602 176 634 × 10⁻¹⁹ C）', u: 'https://physics.nist.gov/cgi-bin/cuu/Value?e' },
  { t: 'OpenStax《College Physics 2e》20.1 Current：電流的定義、導線中電子的漂移速度', u: 'https://openstax.org/books/college-physics-2e/pages/20-1-current' },
  { t: 'OpenStax《College Physics 2e》20.3 Resistance and Simple Circuits：電阻率表（銅、鋁、鎳鉻合金）', u: 'https://openstax.org/books/college-physics-2e/pages/20-3-resistance-and-simple-circuits' },
  { t: '台灣電力公司：電價表。住宅用電採累進費率，用得越多每度越貴；本書的電費計算用每度 3 元估算，可以自己調整。', u: 'https://www.taipower.com.tw/' },
  { t: 'PhET 互動模擬「電路建構套件：直流」：學完之後可以自己接電路做實驗', u: 'https://phet.colorado.edu/zh_TW/simulations/circuit-construction-kit-dc' },
  { t: '這本書的形式參考 Techartist 的 3D 物理書《Every Joule》：先預測、再觀察、再動手、最後挑戰', u: 'https://iamtechartist.com/every-joule/' },
];

export function renderReview(LESSONS) {
  return `
  <section>
    <p class="eyebrow">書末 <span class="en">Review</span></p>
    <h1 class="rv-title">總複習</h1>
    <p class="rv-lead">七堂課的公式、名詞和題目都整理在這裡。考試前翻一翻，或用綜合測驗檢查自己哪一課還不熟。</p>
  </section>

  <section aria-labelledby="rv-f">
    <h2 class="h2" id="rv-f">公式總表</h2>
    <table class="tbl"><thead><tr><th>公式</th><th>意思</th><th>單位</th><th>課</th></tr></thead>
      <tbody>${FORMULAS.map((r) => `<tr><td class="f">${r.f}</td><td>${r.say}</td><td>${r.unit}</td><td><a href="#lesson-${r.n}">第 ${r.n} 課</a></td></tr>`).join('')}</tbody></table>
  </section>

  <section aria-labelledby="rv-g">
    <h2 class="h2" id="rv-g">名詞索引（中英對照）</h2>
    <div class="gloss">${LESSONS.map((L) => `
      <div><h3><a href="#lesson-${L.num}">第 ${L.num} 課　${L.title}</a></h3>
        <dl>${L.keywords.map((k) => `<div><dt>${k.t}<span class="en">${k.en}</span></dt><dd>${k.d}</dd></div>`).join('')}</dl></div>`).join('')}
    </div>
  </section>

  <section aria-labelledby="rv-q">
    <h2 class="h2" id="rv-q">綜合測驗</h2>
    <p>每一課挑兩題，一共 ${LESSONS.length * 2} 題。答錯的題目會顯示解析，也可以回到那一課再看一次。</p>
    <div id="review-quiz"></div>
  </section>

  <section class="notes" aria-labelledby="rv-t">
    <h2 class="h2" id="rv-t">給老師和家長</h2>
    <ul>
      <li><strong>怎麼用：</strong>每一課大約 25 到 40 分鐘。先讓學生自己完成「先猜猜看」，再用投影帶「看示範」，請學生說說自己的預測為什麼對或錯。「動手試」適合兩人一組用平板或電腦操作，「挑戰過關」可以當作下課前的小任務，「小測驗」可以當作形成性評量。</li>
      <li><strong>對應的課程：</strong>國中自然科學（九年級理化）的電學單元：靜電、電流、電壓、電阻與歐姆定律、串聯與並聯、電能與電功率、家庭用電安全。也涵蓋 IGCSE Physics（Cambridge 0625、Edexcel 4PH1）與 GCSE Physics 的 Electricity 主題。名詞小卡附英文，方便雙語學習。</li>
      <li><strong>模型做了哪些簡化：</strong>立體圖裡的燈泡電阻固定不變（第 4 課的 I–V 圖另外說明燈絲電阻會隨溫度改變）；電池沒有內電阻；電子的移動速度和交流電的振動都經過加快或放慢；一個電荷符號代表非常多的電荷；第 7 課的人體電阻用 2000 Ω 估算，真實情況會因為皮膚乾濕、接觸面積而差很多。</li>
      <li><strong>進度存在哪裡：</strong>過關印章和測驗分數只存在這台裝置的瀏覽器裡，換裝置或清除瀏覽資料就會重來。</li>
      <li><strong>朗讀：</strong>使用瀏覽器內建的語音，有沒有中文語音、聽起來怎麼樣，會因裝置而不同。</li>
    </ul>
  </section>

  <section aria-labelledby="rv-s">
    <h2 class="h2" id="rv-s">資料來源與說明</h2>
    <ol class="src">${SOURCES.map((s) => `<li>${s.t}：<a href="${s.u}" target="_blank" rel="noopener">${s.u.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></li>`).join('')}</ol>
    <p class="f-note">電器的功率是常見的額定值，實際數字請看產品上的標示。</p>
  </section>`;
}
