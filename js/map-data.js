/*
 * 內掃區地圖資料（只有位置，不含同學姓名）
 * ------------------------------------------------------------
 * 座標單位＝原始平面圖的像素（寬約 1450、高約 1370），畫面會自動縮放。
 * 預設是「學生視角」：黑板在上方、第 1 排在左邊（和原始平面圖相同）。
 * 「老師視角」＝整張圖轉 180 度（從講台往學生看），程式自動換算，不用另外畫。
 *
 * 誰負責哪個工作、環保股長是誰，在網頁的「工作分配」分頁 → ✏️ 修改負責人員 設定，
 * 存在 Google 試算表的「工作分配」工作表，不會出現在 GitHub 上。
 *
 * items 欄位：
 *   id        物件代號（改了會影響試算表紀錄對應）
 *   name      名稱；同名的物件會自動編號（花圃 1、2、3…，由上到下）
 *   x,y,w,h   位置與大小
 *   cls       顏色樣式（見 css/style.css 的 .it--xxx）
 *   job       屬於哪一個工作（見下方 jobs）
 *   floor     地板區域（整塊可點，座位不會擋住）
 *   bin       垃圾桶（圓形；square: true 為方形），名稱標在下方
 *   poly      不規則形狀（多邊形頂點）
 *   labelAt   名稱標示的位置
 *   short     地圖上顯示的簡稱（位置太小時用，例如玻璃只寫 A）
 */
window.MAP_DATA = {
  title: '內掃區檢查',
  box: { x0: 5, y0: 15, x1: 1450, y1: 1372 },        // 掃地地圖的範圍
  seatBox: { x0: 330, y0: 112, x1: 1448, y1: 1262 },  // 座位圖的範圍（只看教室）

  // 裝飾（不能點）
  deco: [
    { cls: 'dark', x: 110, y: 645, w: 58, h: 55 },
    { cls: 'dark', x: 110, y: 1220, w: 58, h: 55 },
    { cls: 'winbg', x: 371, y: 323, w: 30, h: 643 },
    { cls: 'room', x: 398, y: 118, w: 1046, h: 1142 },
    { cls: 'ledge', x: 626, y: 133, w: 580, h: 28 },
  ],

  items: [
    // ── 地板 ──
    { id: 'corridor', name: '掃拖走廊', cls: 'corr', job: 'J03', floor: true, x: 40, y: 22, w: 352, h: 1333,
      poly: [[40, 22], [392, 22], [392, 1355], [118, 1355], [118, 378], [40, 378]], labelAt: [220, 190] },
    { id: 'floorA', name: '教室1～4排，掃拖', cls: 'fa', job: 'J07', floor: true, x: 405, y: 130, w: 510, h: 1115, labelAt: [645, 1138] },
    { id: 'floorB', name: '教室5～8排，掃拖', cls: 'fb', job: 'J08', floor: true, x: 915, y: 130, w: 513, h: 1115, labelAt: [1190, 1138] },

    // ── 黑板與講台 ──
    { id: 'board', name: '黑板、黑板溝、板擦機、講台', cls: 'tan', job: 'J01', x: 626, y: 133, w: 580, h: 118, labelAt: [916, 205] },
    { id: 'eraser', name: '板擦機', cls: 'tan', job: 'J01', x: 1380, y: 133, w: 46, h: 78 },

    // ── 窗戶與門 ──
    { id: 'window', name: '窗軌道縫、窗邊水泥平台', cls: 'win', job: 'J02', x: 336, y: 323, w: 36, h: 643 },
    { id: 'glassA', name: '玻璃A', short: 'A', cls: 'glass', job: 'J06', x: 371, y: 355, w: 30, h: 63 },
    { id: 'glassB', name: '玻璃B', short: 'B', cls: 'glass', job: 'J06', x: 371, y: 421, w: 30, h: 63 },
    { id: 'glassC', name: '玻璃C', short: 'C', cls: 'glass', job: 'J06', x: 371, y: 488, w: 30, h: 63 },
    { id: 'glassD', name: '玻璃D', short: 'D', cls: 'glass', job: 'J06', x: 371, y: 555, w: 30, h: 65 },
    { id: 'glassE', name: '玻璃E', short: 'E', cls: 'glass', job: 'J06', x: 371, y: 683, w: 30, h: 63 },
    { id: 'glassF', name: '玻璃F', short: 'F', cls: 'glass', job: 'J06', x: 371, y: 749, w: 30, h: 63 },
    { id: 'glassG', name: '玻璃G', short: 'G', cls: 'glass', job: 'J06', x: 371, y: 815, w: 30, h: 63 },
    { id: 'glassH', name: '玻璃H', short: 'H', cls: 'glass', job: 'J06', x: 371, y: 882, w: 30, h: 63 },
    { id: 'frontDoor', name: '前門玻璃、門框', cls: 'door1', job: 'J04', x: 372, y: 205, w: 42, h: 128 },
    { id: 'backDoor', name: '後門玻璃、門框', cls: 'door2', job: 'J05', x: 372, y: 966, w: 42, h: 132 },

    // ── 紫色：各線材、飲水機、拖把區、抹布區、掃具區、講桌整理 ──
    { id: 'desk', name: '講桌', cls: 'purple', job: 'J15', x: 853, y: 253, w: 125, h: 50 },
    { id: 'cables', name: '各線材', cls: 'purple', job: 'J15', x: 1210, y: 133, w: 46, h: 78 },
    { id: 'rags', name: '抹布區', cls: 'purple', job: 'J15', x: 1208, y: 78, w: 168, h: 38 },
    { id: 'mops', name: '拖把區', cls: 'purple', job: 'J15', x: 40, y: 376, w: 107, h: 152,
      poly: [[40, 376], [147, 376], [147, 528], [117, 528], [117, 408], [40, 408]], labelAt: [132, 468] },
    { id: 'fountain', name: '飲水機', cls: 'purple', job: 'J15', x: 268, y: 730, w: 90, h: 90 },
    { id: 'tools', name: '掃具區', cls: 'purple', job: 'J15', x: 1314, y: 1192, w: 108, h: 48 },

    { id: 'arrange', name: '排桌椅', cls: 'hot', job: 'J09', x: 853, y: 1157, w: 125, h: 52 },

    // ── 走廊外 ──
    { id: 'sink', name: '洗手槽', cls: 'sink', job: 'J16', x: 122, y: 845, w: 62, h: 180 },
    { id: 'flower1', name: '花圃', cls: 'flower', job: 'J14', x: 42, y: 232, w: 43, h: 143 },
    { id: 'flower2', name: '花圃', cls: 'flower', job: 'J14', x: 130, y: 535, w: 38, h: 100 },
    { id: 'flower3', name: '花圃', cls: 'flower', job: 'J14', x: 13, y: 700, w: 97, h: 520 },
    { id: 'flower4', name: '花圃', cls: 'flower', job: 'J14', x: 120, y: 701, w: 43, h: 142 },
    { id: 'flower5', name: '花圃', cls: 'flower', job: 'J14', x: 120, y: 1028, w: 43, h: 192 },

    // ── 垃圾桶 ──
    { id: 'binPaper', name: '紙類', cls: 'b-paper', job: 'J13', bin: true, x: 422, y: 130, w: 44, h: 44 },
    { id: 'binGen1', name: '一般垃圾', cls: 'b-gen', job: 'J10', bin: true, x: 475, y: 130, w: 44, h: 44 },
    { id: 'binPlastic', name: '塑膠容器', cls: 'b-plastic', job: 'DUTY', bin: true, x: 528, y: 130, w: 44, h: 44 },
    { id: 'binPC', name: '紙容器', cls: 'b-pc', job: 'DUTY', bin: true, square: true, x: 583, y: 132, w: 42, h: 42 },
    { id: 'binGen2', name: '一般垃圾', cls: 'b-gen', job: 'J10', bin: true, x: 1130, y: 1196, w: 44, h: 44 },
    { id: 'binPet', name: '寶特瓶', cls: 'b-pet', job: 'J12', bin: true, x: 1192, y: 1196, w: 44, h: 44 },
    { id: 'binAlu', name: '鋁箔包', cls: 'b-alu', job: 'J11', bin: true, x: 1255, y: 1196, w: 44, h: 44 },
  ],

  // 座位：8 排，每排由前（黑板）往後編第 1 個、第 2 個…；座位代號「3-2」＝第 3 排第 2 個
  seatCols: [
    { x: 405, n: 5 }, { x: 540, n: 5 }, { x: 674, n: 6 }, { x: 808, n: 6 },
    { x: 942, n: 6 }, { x: 1077, n: 6 }, { x: 1211, n: 5 }, { x: 1345, n: 5 },
  ],
  seatRows: [347, 474, 600, 727, 854, 981],
  // 預設座位（只寫座號，不含姓名；網頁會用雲端名單換成完整姓名）
  // 每一排由第 1 個（最靠黑板）往後
  defaultSeats: {
    1: ['料01', '料02', '料03', '料04', '料05'],
    2: ['料06', '料07', '料08', '料09', '料10'],
    3: ['料11', '料12', '料13', '料14', '料15', '料16'],
    4: ['料17', '料18', '料19', '料20', '料21', '料22'],
    5: ['料23', '料24', '料25', '料26', '多01', '多02'],
    6: ['多03', '多04', '多05', '多06', '多07', '多09'],
    7: ['多10', '多11', '多12', '多13', '多14'],
    8: ['多15', '多16', '多17', '多18', '多19'],
  },
  seatW: 80,
  seatH: 103,
  colLabelY: 316,

  // 檢查人：導師（全部）＋環保股長（監督各掃區，也是全部）
  teacherLabel: '導師',
  inspectorSlots: [
    { id: 'I1', label: '環保股長（監督各掃區掃地工作）', short: '環保', def: '料01' },
  ],
  // 幹部名單的排列順序（環保股長 I1 排在風紀後面）
  cadreOrder: ['C1', 'C2', 'C3', 'C4', 'I1', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10'],
  // 幹部：用自己的身分證字號登入，可以登記加扣分（def＝預設人選的座號，不含姓名）
  cadreSlots: [
    { id: 'C1', label: '班長', def: '多19' },
    { id: 'C2', label: '副班長', def: '料07' },
    { id: 'C3', label: '風紀', def: '多03' },
    { id: 'C4', label: '風紀', def: '料04' },
    { id: 'C5', label: '學藝', def: '多07' },
    { id: 'C6', label: '學藝', def: '多17' },
    { id: 'C7', label: '總務', def: '多09' },
    { id: 'C8', label: '資訊', def: '料25' },
    { id: 'C9', label: '節能', def: '多07' },
    { id: 'C10', label: '體育', def: '料22' },
  ],
  // 加扣分：類別與常用理由（可以自己改）
  pointCats: ['秩序', '整潔', '其他'],
  pointReasons: {
    minus: ['上課講話', '上課睡覺', '遲到', '未帶課本', '服裝儀容', '使用手機', '未交作業', '打掃不確實'],
    plus: ['熱心服務', '協助班務', '表現優良', '主動打掃', '比賽得獎'],
  },

  // 工作：slots＝幾位同學；fixed＝固定由誰負責（不用選人）
  jobs: [
    { id: 'J01', title: '黑板、黑板溝、板擦機、講台', slots: 2 },
    { id: 'J02', title: '窗軌道縫、窗邊水泥平台', slots: 2 },
    { id: 'J03', title: '掃拖走廊', slots: 2 },
    { id: 'J04', title: '前門玻璃、門框', slots: 2 },
    { id: 'J05', title: '後門玻璃、門框', slots: 2 },
    { id: 'J06', title: '玻璃ABCDEFGH', slots: 2 },
    { id: 'J07', title: '教室1～4排，掃拖', slots: 2 },
    { id: 'J08', title: '教室5～8排，掃拖', slots: 2 },
    { id: 'J09', title: '排桌椅', slots: 2 },
    { id: 'J10', title: '倒垃圾：一般垃圾', slots: 2 },
    { id: 'J11', title: '倒垃圾：鋁箔包', slots: 1 },
    { id: 'J12', title: '倒垃圾：寶特瓶', slots: 1 },
    { id: 'J13', title: '倒垃圾：紙類', slots: 1 },
    { id: 'DUTY', title: '倒垃圾：紙容器、塑膠餐盒、廚餘', slots: 0, fixed: ['值日生'] },
    { id: 'J14', title: '花圃', slots: 2 },
    { id: 'J15', title: '各線材、飲水機、拖把區、抹布區、掃具區、講桌整理', slots: 1 },
    { id: 'J16', title: '洗手槽', slots: 1 },
  ],
  // 外掃區（和「外掃區檢查」App 共用同一份「工作分配」工作表，兩邊會同步）
  // 代號要和外掃 App 的 js/map-data.js 一致；工作名稱以外掃試算表裡的為準，這裡只是備用
  // 畫成外掃區圖表（座標＝老師提供的圖，寬 1280、高 830）：card＝名牌位置，arrows＝箭頭（由名牌指向物件）
  outdoor: {
    label: '外掃區',
    w: 1280, h: 830,
    inspectors: [
      { id: 'I1', label: '外掃監督A', zone: 'S', card: [244, 747, 233, 62] },
      { id: 'I2', label: '外掃監督B', zone: 'N', card: [878, 747, 233, 62] },
    ],
    jobs: [
      { id: 'J01', title: '公佈欄玻璃 1、公佈欄玻璃 2', short: '公佈欄玻璃', slots: 1, zone: 'S', card: [267, 32, 138, 57],
        arrows: [[[336, 89], [336, 150], [245, 170], [245, 280]], [[336, 89], [336, 150], [413, 170], [413, 280]]] },
      { id: 'J02', title: '水泥平台 1、飲水機 1、水泥平台 3', short: '飲水機、水泥平台', slots: 1, zone: 'S', card: [262, 193, 123, 57],
        arrows: [[[323, 250], [323, 296]], [[323, 258], [360, 258], [360, 366]]] },
      { id: 'J03', title: '公佈欄玻璃 3、公佈欄玻璃 4', short: '公佈欄玻璃', slots: 1, zone: 'S', card: [498, 77, 117, 57],
        arrows: [[[556, 134], [556, 362]], [[556, 150], [516, 172], [516, 287]]] },
      { id: 'J04', title: '洗手槽 1', short: '洗手槽', slots: 1, zone: 'S', card: [167, 478, 138, 57], arrows: [[[236, 478], [236, 378]]] },
      { id: 'J05', title: '洗手槽 2', short: '洗手槽', slots: 1, zone: 'S', card: [355, 475, 138, 57], arrows: [[[424, 475], [424, 377]]] },
      { id: 'J06', title: '牆壁地板掃拖 1', short: '地板掃拖', slots: 2, zone: 'S', card: [292, 601, 243, 57], arrows: [[[326, 601], [326, 350]]] },
      { id: 'J07', title: '公佈欄玻璃 6、公佈欄玻璃 7', short: '公佈欄玻璃', slots: 1, zone: 'N', card: [717, 20, 117, 57],
        arrows: [[[777, 77], [777, 290]], [[777, 90], [790, 106], [1080, 106], [1095, 125], [1095, 290]]] },
      { id: 'J08', title: '水泥平台 2、飲水機 2、水泥平台 4', short: '飲水機、水泥平台', slots: 1, zone: 'N', card: [885, 159, 117, 57],
        arrows: [[[943, 216], [943, 300]], [[943, 240], [950, 248], [985, 248], [993, 278]]] },
      { id: 'J09', title: '公佈欄玻璃 5', short: '公佈欄玻璃', slots: 1, zone: 'N', card: [716, 556, 118, 57], arrows: [[[775, 556], [775, 365]]] },
      { id: 'J10', title: '洗手槽 3', short: '洗手槽', slots: 1, zone: 'N', card: [801, 459, 122, 57], arrows: [[[861, 459], [861, 376]]] },
      { id: 'J11', title: '洗手槽 4', short: '洗手槽', slots: 1, zone: 'N', card: [1015, 459, 122, 57],
        arrows: [[[1076, 459], [1076, 440], [1066, 428], [1024, 428], [1014, 415], [1014, 376]]] },
      { id: 'J12', title: '牆壁地板掃拖 2', short: '地板掃拖', slots: 2, zone: 'N', card: [934, 601, 244, 57], arrows: [[[968, 601], [968, 350]]] },
    ],
    // 外掃檢查可以點的物件：代號、名稱和外掃 App 相同；hit＝點選範圍（比畫出來的物件大一點，方便手指點）
    // zone：S 南區（外掃監督A）、N 北區（外掃監督B）
    items: [
      { id: 'S-glass-w1', name: '公佈欄玻璃', no: 1, zone: 'S', job: 'J01', hit: [196, 274, 87, 30] },
      { id: 'S-glass-w2', name: '公佈欄玻璃', no: 2, zone: 'S', job: 'J01', hit: [365, 274, 86, 30] },
      { id: 'S-glass-w3', name: '公佈欄玻璃', no: 3, zone: 'S', job: 'J03', hit: [480, 274, 87, 30] },
      { id: 'S-glass-e1', name: '公佈欄玻璃', no: 4, zone: 'S', job: 'J03', hit: [491, 350, 75, 30] },
      { id: 'N-glass-e1', name: '公佈欄玻璃', no: 5, zone: 'N', job: 'J09', hit: [733, 348, 86, 32] },
      { id: 'N-glass-w1', name: '公佈欄玻璃', no: 6, zone: 'N', job: 'J07', hit: [733, 274, 86, 30] },
      { id: 'N-glass-w2', name: '公佈欄玻璃', no: 7, zone: 'N', job: 'J07', hit: [1051, 274, 75, 30] },
      { id: 'S-fountain', name: '飲水機', no: 1, zone: 'S', job: 'J02', hit: [298, 284, 53, 30] },
      { id: 'N-fountain', name: '飲水機', no: 2, zone: 'N', job: 'J08', hit: [907, 284, 53, 30] },
      { id: 'S-sink-1', name: '洗手槽', no: 1, zone: 'S', job: 'J04', hit: [214, 342, 56, 32] },
      { id: 'S-sink-2', name: '洗手槽', no: 2, zone: 'S', job: 'J05', hit: [392, 342, 56, 32] },
      { id: 'N-sink-1', name: '洗手槽', no: 3, zone: 'N', job: 'J10', hit: [833, 342, 56, 32] },
      { id: 'N-sink-2', name: '洗手槽', no: 4, zone: 'N', job: 'J11', hit: [990, 342, 55, 32] },
      { id: 'P-E-S', name: '水泥平台', no: 1, zone: 'S', job: 'J02', hit: [74, 376, 574, 22], strip: true },
      { id: 'P-W-S', name: '水泥平台', no: 2, zone: 'S', job: 'J08', hit: [74, 258, 574, 22], strip: true },
      { id: 'P-E-N', name: '水泥平台', no: 3, zone: 'N', job: 'J02', hit: [648, 376, 577, 22], strip: true },
      { id: 'P-W-N', name: '水泥平台', no: 4, zone: 'N', job: 'J08', hit: [648, 258, 577, 22], strip: true },
      { id: 'S-floor', name: '牆壁地板掃拖', no: 1, zone: 'S', job: 'J06', hit: [76, 298, 570, 46], floor: true },
      { id: 'N-floor', name: '牆壁地板掃拖', no: 2, zone: 'N', job: 'J12', hit: [650, 298, 571, 46], floor: true },
    ],
    zones: { S: '南區', N: '北區' },
    // 走廊上的物件（只是示意）
    shapes: [
      { t: 'glass', x: 196, y: 288, w: 87, h: 7 }, { t: 'glass', x: 365, y: 288, w: 86, h: 7 }, { t: 'glass', x: 480, y: 288, w: 87, h: 7 },
      { t: 'glass', x: 733, y: 288, w: 86, h: 7 }, { t: 'glass', x: 1051, y: 288, w: 75, h: 7 },
      { t: 'glass', x: 491, y: 362, w: 75, h: 8 }, { t: 'glass2', x: 733, y: 355, w: 86, h: 15 },
      { t: 'fountain', x: 304, y: 288, w: 41, h: 19 }, { t: 'fountain', x: 913, y: 288, w: 41, h: 19 },
      { t: 'sink', x: 220, y: 350, w: 44, h: 20 }, { t: 'sink', x: 398, y: 350, w: 44, h: 20 },
      { t: 'sink', x: 839, y: 350, w: 44, h: 20 }, { t: 'sink', x: 996, y: 350, w: 43, h: 20 },
    ],
  },
  jobGroups: [
    { label: '教室', jobs: ['J01', 'J02', 'J03', 'J04', 'J05', 'J06', 'J07', 'J08', 'J09'] },
    { label: '倒垃圾', jobs: ['J10', 'J11', 'J12', 'J13', 'DUTY'] },
    { label: '花圃與其他', jobs: ['J14', 'J15', 'J16'] },
  ],
};
