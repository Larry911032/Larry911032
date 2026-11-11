# 互動立體書製作手冊

這份手冊整理了做《電學立體書》的方法，讓下一個 Claude 對話照同樣的模式，做別的主題（例如力學、光學、化學、生物）。

## 在新對話怎麼開頭（可直接複製）

```
我想照「電學立體書」的模式，做一本「＿＿＿」的互動 3D 立體書，
給＿＿＿（年級或考試，例如國中八年級、IGCSE）的學生，大約＿堂課。

範本在這個 Artifact：https://claude.ai/artifact/NAAq3YiaXEo1SNcThAz8Nr
請用 Artifact 工具的 read 讀它附的檔案：先讀 PLAYBOOK.md，
再讀 src/ 裡的原始碼（src/js/three-kit.js、src/js/app.js、src/js/lessons/l4-resistance.js 最有代表性）。
沿用同樣的教學流程、版面、3D 工具組和測試方法，內容用繁體中文、台灣用語。
先給我課程大綱，和每一課立體圖要讓學生操作什麼，我確認後再開始做。
```

Artifact 附的檔案：`PLAYBOOK.md`（這份）、`src/`（完整、可讀的原始碼）、`tools/`（打包與測試腳本）。讀法：Artifact 工具 `action: "read"`，`url` 填上面的連結，`path` 填檔名（例如 `src/js/three-kit.js`），一次讀多個用 `paths`。

## 一、教學設計（最重要的部分）

每一課固定九段，順序就是學習的順序：

1. **先猜猜看**：一題三選一，選項要對準常見迷思。猜完才能翻答案。
2. **看示範**：5～6 個步驟，每一步是一段短文字＋立體圖的一個狀態＋一個鏡頭角度。全部步驟一開始就列出來，可以點任一步，也可以自動播放。
3. **翻開答案**：對照學生的預測說「猜對了／正確答案是」，再用兩三句話解釋。
4. **動手試**：幾個小任務，每個任務旁邊有按鈕直接把立體圖設定好（`data-set`）。
5. **挑戰過關**：一個可以用程式檢查的數值目標（例如「讓電流剛好是 0.20 A」），達成就自動蓋紅色「過關」印章並記錄進度。目標最好只有一兩種解法，要動腦才做得到。
6. **課文**：小標題分段，搭配公式卡（含單位）、表格、比喻、平面小工具、常見迷思（✗／✓ 對照）、例題（按「看解答」才展開）。
7. **名詞小卡**：中文＋英文＋一句定義（方便雙語和 IGCSE 學生）。
8. **小測驗**：4～5 題四選一，選了立刻顯示對錯和解析，最後給分數。
9. **重點整理**：5 句，最後一張「下一課」卡片。

書末一頁：公式總表、名詞索引、綜合測驗（每課挑 2 題）、給老師和家長的說明（怎麼用、對應課綱、模型簡化了什麼）、資料來源。

封面：書名、一句話介紹、一個會動的小立體圖、「每一課都照這五步走」、目錄（顯示已過關的印章）。

內容原則：在地化（台灣用語、110 V、台電「度」、電鍋），每個數字要有根據，模型的簡化要老實寫出來。

## 二、視覺設計

- 隱喻：攤開的筆記本。桌機左頁是課文，右頁是**黏在畫面上（sticky）的立體圖板**；手機改成單欄，立體圖放在「先猜猜看」後面。
- 立體圖風格：墨線輪廓的「立體書」插畫感。物件用柔和霧面色，外框用反向外殼（inverted hull）畫輪廓、`EdgesGeometry` 畫稜線；地面是方格紙貼圖、邊緣淡出到頁面底色；玻璃和導線外皮用邊緣描線的著色器（中間透明）。
- 圖上標籤用 HTML 疊在 3D 上：黑底白字的編號圓圈（對應圖例），白色膠囊顯示讀數。
- 主題：白天是方格筆記紙＋鋼筆藍；夜間是藍晒圖。所有顏色都是 CSS token，3D 調色盤也跟著 `data-theme` 和 `prefers-color-scheme` 切換。
- 字型：Noto Serif TC（標題）、Noto Sans TC（內文）、LXGW WenKai TC（手寫感註記、印章）、IBM Plex Mono（數字、公式）。

## 三、技術架構

純靜態網頁，不需要後端。three.js 0.160.0 用 import map 從 jsDelivr 載入。

```
index.html            頁面骨架（頁首膠囊、目錄抽屜、main#view、頁尾）
css/book.css          全部樣式與主題 token
js/app.js             路由（#home、#lesson-1…、#review）、課程版面、預測/示範/翻答案/挑戰/測驗、朗讀、進度（localStorage）
js/three-kit.js       3D 工具組：Stage、墨線材質、方格紙、標籤、可點擊/可拖曳、鏡頭飛行、元件、電子流動
js/circuit.js         電路求解器（修正節點分析 MNA）與 Net 小工具
js/widgets.js         平面小工具（SVG）：原子圖、水路比喻、I–V 圖、導線電阻、示波器
js/review.js          書末內容
js/hero.js            封面的小立體圖
js/lessons/rig.js     各課共用：控制面板、讀數面板、拉導線、編號標籤、事件
js/lessons/lN-*.js    每一課的內容＋立體圖
```

### 每一課的資料格式

```js
export default {
  num, slug, title, en, short,
  bigIdea, goals: ['…', '…', '…'],
  predict: { q, options: [三個], answer, why /* HTML */ },
  figure: { title, alt, legend: ['…'], note, mount },
  watch: [{ text, set: { /* 完整狀態 */ }, view: '鏡頭名' }],
  tryIt: `<ul class="try-list"><li><p data-read>…</p><button class="act" data-set='{"R":2}'>…</button></li></ul>`,
  challenge: { text, check: (state) => boolean, done },
  body: `…<div class="widget" data-widget="iv"></div>…`,
  widgets: { iv: (el, fig) => { /* 畫進 el，可回傳清理函式 */ } },
  keywords: [{ t, en, d }],
  quiz: [{ q, options: [四個], answer, why }],
  summary: ['…'],
};
```

`figure.mount({ stageEl, controlsEl, readoutsEl })` 回傳控制器：

```js
{ stage, set(partialState, user?), get(), view(name, dur?), act?(name), onChange(fn) /* 回傳取消函式 */, dispose() }
```

- `set` 由示範步驟、動手試按鈕、控制面板呼叫；`get()` 給挑戰檢查用（要包含算出來的值，例如電流、角度）。
- 會隨時間變化的值（擺動角度、計數器、跳電）要在 ticker 裡定期 `emit(get())`。

### three-kit.js 的重點介面

- `new Stage(el, { camera, target, fov, refAspect, maxPolar })`：`add`、`addTicker((模擬dt, 真實dt) => …)`、`addLabel(html, 位置或函式, { cls, hidden })`、`addClickable(物件, hit => …)`、`addDraggable(物件, { plane: () => THREE.Plane, onDrag })`、`flyTo(pos, target, 秒)`、`home()`、`zoom(倍率)`、`setPaused`、`setOrbit`、`dispose`。
- 材質與造型：`solid(geometry, 色名, { hull, edges })`、`cyl(r, h, 色名, { r2 })`、`rbox(w, h, d, 圓角)`、`rimMat(色名)`、`textSprite('+', { bg })`、`glowTexture()`、`pal()` 取目前調色盤。
- 元件：`makeBattery`、`makeLamp`、`makeMeter('A' | 'V')`、`makeSwitch`、`makeRheostat`、`makeWire(points)`、`routePoints(端子A, 端子B, 轉角)`。每個元件有 `group` 和端子 `T`（位置＋朝外方向）。
- `ChargeFlow`：沿路徑排一串小球（或箭頭），速度和電流成正比；也支援交流電的來回振動（`ac: { amp, w }`）。
- 電路：`Net` 建節點和元件，`solve()` 後每個元件有 `.I`、每個節點有電位 `net.v[]`。**每一段導線也當成極小的電阻**，所以每段導線都有自己的電流，電子速度直接用它。

## 四、做一本新書的順序

1. 列課程大綱，每課寫一句「大概念」和「學生在立體圖上要操作什麼」，先給使用者確認。
2. 先做共用工具（Stage、材質、元件、控制面板），再做第 1、2 課，**馬上截圖檢查**，風格和效能確定了再寫其他課。
3. 每課的立體圖先想「哪個操作最能打破迷思」，再決定模型。模型用簡單幾何（圓柱、圓角方塊、膠囊、管子）組合就夠了。
4. 全部寫完後跑測試（下面第六節），修完再打包發布。

## 五、踩過的坑（照做可以省很多時間）

- CSS 一定要有 `[hidden] { display: none !important; }`，不然設了 `display` 的元素藏不起來。
- 圖捲出畫面時要**繼續跑模擬**（計時、跳電、計數），只是不畫；否則挑戰條件會卡住。
- 每個示範步驟的 `set` 要給**完整狀態**，因為學生會直接點第 4 步。
- 開課時套用第 1 步的狀態，但鏡頭維持總覽，不要一進來就特寫。
- 手機：OrbitControls 預設關閉、`touch-action: pan-y`，另外給「轉動」按鈕，不然頁面滑不動；滾輪縮放也關掉，改用 +／− 按鈕。
- 細的東西（導線）要點得到：疊一條看不見的粗管子當點擊範圍。
- 透明物體（玻璃、導線外皮）不能用反向外殼描邊，背面會透出來；改用邊緣描線著色器。
- 被其他物體擋住但要看見的東西（例如流過人體的電流粒子）設 `depthTest: false`。
- 會延遲觸發的事件（跳電）每次狀態改變都要重新判斷，不要沿用舊的待觸發狀態。
- 標籤在手機上要縮小字級，桌機的立體圖高度要讓整個圖板盡量塞進一個畫面。
- `localStorage` 一律包 try/catch；朗讀用瀏覽器內建語音，不支援就把按鈕藏起來。

## 六、測試與發布

在 `tools/` 裡：

```bash
bash fetch-vendor.sh          # 下載 three.js 到 tools/vendor，測試時離線使用
npm install                   # 安裝 esbuild（打包用）；Playwright 需另外裝或用環境內建的
node shoot.cjs '{"shots":[{"hash":"lesson-1","out":"shots/l1.png"},{"hash":"lesson-1","w":390,"h":844,"touch":true,"out":"shots/l1-phone.png"},{"hash":"lesson-1","dark":true,"out":"shots/l1-dark.png"}]}'
node interact.cjs             # 在 3D 圖上點擊、拖曳，印出每課的狀態
node flow.cjs                 # 預測、翻答案、步驟、測驗、目錄、主題、進度
node build-artifact.mjs       # 打包成 tools/dist/electricity-book.html
```

- 截圖要看三種：桌機 1400×900、手機 390×844（touch）、夜間，並確認沒有 console 錯誤。
- 網址加 `?debug` 時，`window.__ebookFig` 是目前的立體圖控制器，測試腳本用它把 3D 座標換算成螢幕座標來點擊。
- 發布成 Claude Artifact 的限制：頁面是 HTML 片段（不含 html/head/body）；外部腳本只能從 jsDelivr、cdnjs、unpkg；字型只能用 Google Fonts；路由只能用 `#名稱` 這種 hash；不能用 `alert`、`print`。

## 七、環境備忘

- 雲端環境裡，網頁讀取工具有時連不到某些網站，但 `curl` 可以；台電官網連不上，所以電費用可調整的估算值。
- 推送到 GitHub 需要 Claude GitHub App 有這個 repo 的權限；沒有的話，原始碼至少要附在 Artifact 裡，避免容器回收後消失。
