/**
 * 內掃區檢查 — Google Apps Script 後端
 * ------------------------------------------------------------
 * 1. 建立一份新的 Google 試算表 → 擴充功能 → Apps Script，把這整份貼上。
 * 2. 修改下方 CONFIG（TOKEN 是導師登入網頁的密碼；幹部與學生用自己的身分證字號登入）。
 * 3. 執行一次 setup()（授權後會建立工作表、資料夾與扣分按鈕）。
 * 4. 部署 → 新增部署作業 → 類型「網頁應用程式」
 *      執行身分：我　／　誰可以存取：所有人
 *    複製「網頁應用程式網址」（…/exec）填到網站的 config.js。
 * 修改程式後要「管理部署作業 → 編輯 → 版本：新版本」才會生效。
 *
 * 雲端硬碟「內掃檢查」資料夾：
 *   名單試算表（檔名含「名單」）：需有「姓名」欄，可有「科別」「座號」「身分證字號」
 *   排名試算表（檔名含「排名」或「成績」）：需有「名次」欄，以及「科別、座號、姓名」，可有「身分證字號」
 *   大頭照／：檔名用座號，例如 料05.jpg（也可以從網頁上傳）
 *
 * 學生的身分證字號只在這裡比對（存成雜湊值），不會傳回網頁，也不會出現在 GitHub 上。
 */
const CONFIG = {
  TOKEN: '請改成你的密碼',              // 導師的登入密碼（只改你 Apps Script 裡的這份，不要改 GitHub 上的）
  SHEET_ID: '',                        // 留空 = 使用這份試算表（綁定在試算表上的腳本）
  FOLDER_NAME: '商一甲 APP 專用',        // 雲端硬碟資料夾：排名、大頭照、檢查照片（改名沒關係，程式記得資料夾代號）
  CLASS_NAME: '商一甲',
  ROSTER_SHEET: '學生/幹部名單',            // 這份試算表裡的全班名單＋幹部職位（科別、座號、姓名、職位…、身分證字號）
  FACE_FOLDER_ID: '',                  // 大頭照資料夾代號（也可以在網頁「座位 → 交換位置 → 大頭照資料夾」貼連結設定）
  FACE_FOLDER: '大頭照',
  PHOTO_FOLDER: '內掃檢查',            // 掃地檢查照片（每天的都放在一起）
  SHARE_PHOTOS: true,                  // 掃地檢查照片設為「知道連結的人可檢視」（大頭照不會公開分享）
  TIMEZONE: 'Asia/Taipei',
  SESSION_DAYS: 30,                    // 學生、幹部登入後幾天內有效（試算表選單「內掃檢查 → 讓所有人重新登入」可以提早全部失效）
  TEACHER_NAME: '導師',
  GUEST_CODE: '',                      // 任課老師登入碼（留空＝在登入畫面直接按「任課老師登入」就能進入；只能用抽籤、看座位表）
  TEACHER_PHOTO: '',                   // 導師大頭照的檔名（不含 .png），放在大頭照資料夾；只有在座位表點「講桌／講台」時才會顯示
  OUTDOOR_SHEET_ID: '',                // 舊的「外掃區檢查」App 試算表 ID：只用來第一次匯入外掃工作分配，以及選單「同步到外掃 App」
  SITE_URL: 'https://autoanima.github.io/ClassroomAPP/',   // 網站網址（讀取內建配件清單 assets/acc/catalog.json）
  ACC_FOLDER: '配件',                 // 「內掃檢查」資料夾裡放配件 PNG 的子資料夾；檔名「名稱_價格.png」
  ACC_DEFAULT_PRICE: 3,               // 檔名沒寫價格時的價格
  ACC_DAYS: 10,                       // 配件有效天數（只算週一到週五）
  STEAL_PRICE: 10,                    // 竊盜卡：奪取別人的配件
  FIREWORK_PRICE: 1,                  // 煙火：放在某位同學的座位上，大家下次打開 App 時會看到
  SWAP_PRICE: 20,                     // 交換位置卡：和另一位同學強制對調座位
  RANK_CARDS: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1 }, // 段考排名前五名自動獲得免費交換位置卡（第一名 2 張）；每份新的排名只發一次
  TRANSFER_PRICE: 20,                 // 抽籤轉移卡：設定替身，抽籤抽到自己時由替身上場（次數不限）
  TRANSFER_DAYS: 10,                  // 抽籤轉移卡有效天數
  WEATHER_PRICE: 5,                   // 小太陽卡／小雨傘卡：放在某位同學的座位上方
  WEATHER_DAYS: 10,                   // 小太陽卡／小雨傘卡有效上課日
  SURE_PRICE: 30,                     // 抽籤必中卡：指定一位同學，下一次抽籤第一位一定是他（只有一次）
  SWAP_BAN_MINUS: 10,
  RANK_POINT_WEIGHT: 1,               // 班名次＝段考表現＋那段期間的加扣分：加扣分 1 分＝百分比 1 個百分點（例如 +3 分≈往前 3%）                 // 「加扣分紀錄」被扣的分數加起來超過這個數，就不能用交換位置卡
  CREATE_PRICE: 20,                   // 創造卡：同學上傳 PNG 變成新商品，預設售價（可以自己改 1–100）
  CREATE_PER_DAY: 3,                  // 每人每天最多創造幾個商品
  FIREWORK_DAYS: 3,                   // 煙火幾天內還會放給還沒看過的人
};

const SHEET_RECORDS = '檢查紀錄';
const HEAD_RECORDS = ['日期', '處所', '負責同學', '說明', '照片', '檢查人', '紀錄編號'];
const COL_PHOTO = 5, COL_KEY = 7;
const SHEET_SCORE = '扣分統計';
const SCORE_START_ROW = 10;
const SHEET_ROSTER = '工作分配';
const HEAD_ROSTER = ['代號', '工作內容', '負責人1', '負責人2'];
const SHEET_OUT = '外掃工作分配';     // 外掃區的工作分配（以這個 App 為主）
const SHEET_SEATS = '座位表';
const HEAD_SEATS = ['座位', '排', '個', '同學'];
const SHEET_DUTY = '值日生';           // 班長、副班長每天登記的值日生（兩位）
const HEAD_DUTY = ['日期', '值日生1', '值日生2', '值日生3', '值日生4', '登記人', '登記時間'];
const SHEET_FUND = '班費收支';          // 總務登記；刪除只做標記
const HEAD_FUND = ['日期', '品項', '收支', '金額', '說明', '登記人', '登記時間', '編號', '狀態'];
const SHEET_PACK = '紅包';              // 發紅包活動：發起、連署、發放都留紀錄
const HEAD_PACK = ['發起時間', '發起人', '原因', '每人點數', '連署', '狀態', '發放時間', '編號', '發放人數'];
const PACK_MAX = 20;                    // 每人最多發幾點
const SHEET_MAIL = '飛鴿傳書';         // 站內信：3 天後在 App 上消失（紀錄留在試算表，導師看得到）
const HEAD_MAIL = ['時間', '寄件人', '收件人', '內容', '編號'];
const MAIL_DAYS = 3, MAIL_PER_DAY = 10;
const SHEET_BOARD = '公布欄';          // 導師、幹部的留言（例如作業）；刪除只做標記，紀錄保留
const HEAD_BOARD = ['時間', '內容', '發布人', '編號', '狀態', '修改紀錄'];
const BOARD_DAYS = 14;
const SHEET_CARDS = '道具卡';          // 免費道具卡的發放紀錄（段考前五名）
const HEAD_CARDS = ['時間', '同學', '卡片', '張數', '來源'];
const SHEET_DEFSEAT = '預設座位';    // 導師按「把目前座位存成預設」存的（只存座號）
const HEAD_DEFSEAT = ['座位', '座號'];
const SHEET_SELLOG = '選位紀錄';
const HEAD_SELLOG = ['套用時間', '順序', '名次', '同學', '座位', '方式', '排名來源'];

const SHEET_INV = '配件';
const HEAD_INV = ['編號', '擁有者', '配件', '名稱', '價格', '購買人', '購買時間', '到期日', '備註'];
const SHEET_SPEND = '點數使用';
const HEAD_SPEND = ['時間', '同學', '點數', '用途', '對象', '說明', '編號'];
const SHEET_DECO = '大頭照裝飾';
const HEAD_DECO = ['同學', '裝飾', '更新時間'];
const SHEET_POINTS = '加扣分紀錄';
const HEAD_POINTS = ['日期', '同學', '分數', '類別', '理由', '登記人', '登記時間', '編號'];

// 學生（身分證字號登入）可以用的動作
const SHOP_OK = { shopState: 1, accImages: 1, buyAcc: 1, giftAcc: 1, saveDeco: 1, stealAcc: 1, buyFirework: 1, swapSeatCard: 1, createAcc: 1, delAcc: 1, buyDrawCard: 1, buyWeather: 1 };
const STUDENT_OK = Object.assign({ getFund: 1, getMail: 1, sendMail: 1, rankInfo: 1, getBoard: 1, getDuty: 1, setDuty: 1, getRoster: 1, getSeats: 1, getFaces: 1, stuState: 1, stuWish: 1, stuPick: 1 }, SHOP_OK);
// 幹部（自己的身分證字號登入）可以用的動作；環保股長另外可以做掃地檢查
const CADRE_OK = Object.assign({ getFund: 1, addFund: 1, delFund: 1, getPacks: 1, startPack: 1, signPack: 1, cancelPack: 1, getMail: 1, sendMail: 1, editPost: 1, rankInfo: 1, rankOrder: 1, saveSeats: 1, saveDefaultSeats: 1, getBoard: 1, addPost: 1, delPost: 1, saveRoster: 1, getDuty: 1, setDuty: 1, getDrawFx: 1, drawUsed: 1, ping: 1, getRoster: 1, getStudents: 1, getSeats: 1, getFaces: 1, selState: 1, addPoints: 1, getPoints: 1, delPoints: 1 }, SHOP_OK);
// 任課老師（不用密碼）：只能抽籤、看座位表
const GUEST_OK = { rankInfo: 1, getBoard: 1, ping: 1, getRoster: 1, getStudents: 1, getSeats: 1, getFaces: 1, accImages: 1, getDrawFx: 1, drawUsed: 1, getDuty: 1 };
const CHECKER_OK = { saveRecords: 1, uploadPhoto: 1 };

function doGet() {
  return json({ ok: true, msg: '內掃區檢查 API 運作中' });
}

const normPw = x => String(x || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); // 不分大小寫、全形半形

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    if (req.action === 'stuLogin') return json(stuLogin(req.idno));
    if (req.action === 'staffLogin') return json(staffLogin(req.pw));
    if (req.action === 'guestLogin') return json(guestLogin(req.code));
    // who：{ teacher } 或 { key, role: 'S'學生 / 'C'幹部 }
    let who;
    if (req.sid) {
      const v = readSession(String(req.sid));
      if (!v) return json({ ok: false, error: '登入已過期，請重新登入', code: 'session' });
      const m = v.match(/^([SCG])\|(.*)$/);
      who = m ? { role: m[1], key: m[2] } : { role: 'S', key: v };
      const ok = who.role === 'G' ? GUEST_OK[req.action]
        : who.role === 'C' ? CADRE_OK[req.action] || (CHECKER_OK[req.action] && isInspector(who.key))
        : STUDENT_OK[req.action];
      if (!ok) return json({ ok: false, error: '沒有權限' });
    } else {
      if (req.token == null || normPw(req.token) !== normPw(CONFIG.TOKEN)) return json({ ok: false, error: '密碼錯誤', code: 'token' });
      who = { teacher: true, key: CONFIG.TEACHER_NAME };
    }
    switch (req.action) {
      case 'ping': return json(ping());
      case 'getRoster': return json({ ok: true, roster: rosterWithOutdoor() });
      case 'saveRoster':
        if (!who.teacher && !canEditRoster(who.key)) throw new Error('只有導師、班長、副班長、環保股長可以修改工作分配');
        if (!who.teacher && req.roster) req.roster.inspectors = getRoster().inspectors; // 幹部名單只有導師能改
        return json(saveRoster(req.roster || {}));
      case 'setOutdoorSheet': return json(setOutdoorSheet(req.url));
      case 'getStudents': return json(getStudents());
      case 'saveRecords': return json(saveRecords((req.rows || []).map(r => Object.assign(r, { inspector: who.key }))));
      case 'uploadPhoto': return json(uploadPhoto(req));
      case 'addPoints': return json(addPoints(req.rows || [], who));
      case 'getPoints': return json({ ok: true, rows: getPoints(req.days, who) });
      case 'delPoints': return json(delPoints(req.id, who));
      case 'shopState': return json(shopState(who));
      case 'accImages': return json(accImages(req.have || {}));
      case 'buyAcc': return json(buyAcc(who, String(req.acc || '')));
      case 'giftAcc': return json(giftAcc(who, String(req.inv || ''), String(req.to || '')));
      case 'saveDeco': return json(saveDeco(who, req.layers || []));
      case 'stealAcc': return json(stealAcc(who, String(req.inv || '')));
      case 'buyFirework': return json(buyFirework(who, String(req.to || '')));
      case 'swapSeatCard': return json(swapSeatCard(who, String(req.to || '')));
      case 'createAcc': return json(createAcc(who, req.name, req.price, req.data));
      case 'getFund': return json(getFund());
      case 'addFund': return json(addFund(who, req.row || {}));
      case 'delFund': return json(delFund(who, String(req.id || '')));
      case 'getPacks': return json({ ok: true, packs: getPacks() });
      case 'startPack': return json({ ok: true, packs: startPack(who, req.reason, req.points) });
      case 'signPack': return json({ ok: true, packs: signPack(who, String(req.id || '')) });
      case 'cancelPack': return json({ ok: true, packs: cancelPack(who, String(req.id || '')) });
      case 'getMail': return json({ ok: true, mails: getMail(who) });
      case 'sendMail': return json(sendMail(who, String(req.to || ''), req.text));
      case 'getBoard': return json({ ok: true, posts: getBoard() });
      case 'addPost': return json({ ok: true, posts: addPost(who, req.text) });
      case 'editPost': return json({ ok: true, posts: editPost(who, String(req.id || ''), req.text) });
      case 'delPost': return json({ ok: true, posts: delPost(who, String(req.id || '')) });
      case 'getDuty': return json({ ok: true, duty: getDuty() });
      case 'setDuty': return json({ ok: true, duty: setDuty(who, req.list || []) });
      case 'saveCadres': return json(saveCadres(req.pairs || []));
      case 'buyWeather': return json(buyWeather(who, String(req.kind || ''), String(req.to || '')));
      case 'buyDrawCard': return json(buyDrawCard(who, String(req.kind || ''), String(req.to || '')));
      case 'getDrawFx': return json(Object.assign({ ok: true }, drawFx()));
      case 'drawUsed': return json(drawUsed(String(req.id || '')));
      case 'delAcc': return json(delAcc(who, String(req.acc || ''), req.mode === 'remove'));
      case 'getSeats': return json(who.teacher ? { ok: true, seats: getSeats(), defaults: getDefaultSeats() } : { ok: true, seats: getSeats() });
      case 'saveDefaultSeats':
        if (!who.teacher && !isMonitor(who.key)) throw new Error('只有導師、班長、副班長可以儲存座位');
        return json({ ok: true, defaults: saveDefaultSeats(req.seats || {}) });
      case 'saveSeats':
        if (!who.teacher && !isMonitor(who.key)) throw new Error('只有導師、班長、副班長可以儲存座位');
        return json({ ok: true, seats: saveSeats(req.seats || {}) });
      case 'rankOrder': return json(rankOrder(who, req.exam));
      case 'rankInfo': return json({ ok: true, url: rankSheetUrl(), weight: CONFIG.RANK_POINT_WEIGHT, has: (() => { const R = examRanks(); return R ? R.per.map(p => Object.keys(p.rank).length > 0) : [false, false, false]; })() });
      case 'getFaces': return json(getFaces(req.have || {}));
      case 'uploadFace': return json(uploadFace(req.code, req.data));
      case 'setFaceFolder': return json(setFaceFolder(req.url));
      case 'selState': return json(selState(req.v));
      case 'selLoad': return json(selLoad(req));
      case 'selCmd': return json(selCmd(req.cmd));
      case 'selAssign': return json(selTeacher(S => SelEngine.assign(S, String(req.key || ''), String(req.seat || ''), Date.now())));
      case 'selBlock': return json(selTeacher(S => SelEngine.block(S, String(req.seat || ''))));
      case 'stuState': return json(stuState(who.key, req.v));
      case 'stuWish': return json(stuMutate(who.key, S => SelEngine.setWishes(S, who.key, req.wishes || [])));
      case 'stuPick': return json(stuMutate(who.key, (S, now) => SelEngine.pick(S, who.key, String(req.seat || ''), now)));
      default: return json({ ok: false, error: '未知的動作：' + req.action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err) });
  }
}

/** 第一次使用（或更新程式後）手動執行一次：建立工作表、資料夾、扣分統計與按鈕 */
function setup() {
  getRecordsSheet();
  getSheet(SHEET_ROSTER, HEAD_ROSTER);
  getSheet(SHEET_SEATS, HEAD_SEATS);
  getOutdoor();
  getSheet(SHEET_SELLOG, HEAD_SELLOG);
  getSheet(SHEET_POINTS, HEAD_POINTS);
  getSheet(SHEET_INV, HEAD_INV);
  getSheet(SHEET_DECO, HEAD_DECO);
  getSheet(SHEET_SPEND, HEAD_SPEND);
  accFolder();
  photoFolder();
  ensureScoreSheet(true);
  computeScores();
  const folder = getRootFolder();
  getFaceFolder();
  Logger.log('完成！資料夾：' + folder.getUrl());
}

/** 試算表選單 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('內掃檢查')
    .addItem('計算扣分', 'computeScores')
    .addItem('段考排名', 'showExamRank')
    .addItem('重置扣分統計', 'resetScores')
    .addItem('重新設定段考結算時間', 'resetExamCuts')
    .addItem('清除導師測試的道具', 'clearTeacherTestItems')
    .addItem('檢查名單與排名（身分證字號）', 'checkPeople')
    .addItem('讓所有人重新登入', 'resetSessions')
    .addSeparator()
    .addItem('外掃工作分配：同步到舊的外掃 App', 'pushOutdoorToOldApp')
    .addItem('外掃工作分配：從舊的外掃 App 重新匯入（會覆蓋這裡的）', 'importOutdoorFromOldApp')
    .addToUi();
}

/** 手機上的 Google 試算表 App 按不到圖片按鈕，所以也可以勾選「扣分統計」B6 的方塊來計算 */
function onEdit(e) {
  const r = e && e.range;
  if (!r || r.getSheet().getName() !== SHEET_SCORE || r.getA1Notation() !== 'B6') return;
  if (r.getValue() === true) computeScores();
}

function ping() {
  const ss = getSS();
  return { ok: true, sheetName: ss.getName(), sheetUrl: ss.getUrl() };
}

// ── 工作分配：存在「工作分配」工作表（也可以直接在試算表裡改）──
/** 試算表裡的負責人可以只寫姓名（例如「陳彥方」），會自動換成「多04陳彥方」；已經是完整寫法的不變 */
function nameFixer() {
  let list = [];
  try { list = getStudents().students; } catch (e) { /* 沒有名單就不換 */ }
  const set = {}, byName = {};
  list.forEach(k => { set[k] = 1; const m = k.match(/^\D*?\d+(.*)$/); const n = m ? m[1] : k; byName[n] = byName[n] ? '' : k; });
  const byCode = {};
  list.forEach(k => { const c = faceCode(k); if (c) byCode[c] = k; });
  return s => {
    s = String(s || '').normalize('NFKC').replace(/\s+/g, '');
    if (!s || set[s]) return s;
    if (byName[s]) return byName[s];                 // 只寫姓名
    const c = faceCode(s);                            // 座號寫法不同（多4陳彥方、多 04）
    if (c && byCode[c]) return byCode[c];
    return s;
  };
}
function getRoster() {
  const sh = getSS().getSheetByName(SHEET_ROSTER);
  const roster = { jobs: {}, inspectors: {}, labels: {} };
  if (!sh || sh.getLastRow() < 2) return roster;
  const fix = nameFixer();
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(r => {
    const id = String(r[0]).trim().toUpperCase();
    const names = [r[2], r[3]].map(fix).filter(Boolean);
    if (!id) return;
    if (id === 'CLASS') { roster.jobs.CLASS = [String(r[2]).trim()]; return; }
    if (/^[IC]\d+$/.test(id)) roster.inspectors[id] = names[0] || '';  // I＝環保股長、C＝其他幹部
    else { roster.jobs[id] = names; if (String(r[1]).trim()) roster.labels[id] = String(r[1]).trim(); }
  });
  return roster;
}

function saveRoster(r) {
  return withLock(() => {
    const sh = getSheet(SHEET_ROSTER, HEAD_ROSTER);
    const labels = r.labels || {};
    const rows = [];
    Object.keys(r.inspectors || {}).forEach(id => rows.push([id, labels[id] || '環保股長', r.inspectors[id] || '', '']));
    Object.keys(r.jobs || {}).forEach(id => {
      const n = r.jobs[id] || [];
      rows.push([id, labels[id] || '', n[0] || '', n[1] || '']);
    });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_ROSTER.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, HEAD_ROSTER.length).setValues(rows);
    if (r.outdoor) saveOutdoor(r.outdoor);
    return { ok: true, roster: rosterWithOutdoor() };
  });
}

// ── 外掃區：工作分配存在這份試算表的「外掃工作分配」工作表（以這個 App 為主）──
// 舊的「外掃區檢查」App 試算表只在第一次（這裡還是空的）自動匯入一次；之後要同步回去，用試算表選單「同步到舊的外掃 App」
function outdoorId() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('OUTDOOR_SHEET_ID') || CONFIG.OUTDOOR_SHEET_ID;
  if (id) return id;
  // 沒設定時，自動找「商一甲 APP 專用」資料夾裡檔名含「外掃」的試算表，找到就記下來
  const f = listSheetFiles().find(x => /外掃/.test(x.getName()));
  if (!f) return '';
  props.setProperty('OUTDOOR_SHEET_ID', f.getId());
  return f.getId();
}
function outdoorSheet() {
  const id = outdoorId();
  if (!id) return null;
  try {
    const ss = SpreadsheetApp.openById(id);
    return { ss: ss, sh: ss.getSheetByName(SHEET_ROSTER) };
  } catch (e) { return null; }
}
/** 讀一張「代號／工作內容／負責人1／負責人2」的工作表 → { jobs, inspectors, labels } */
function readOutdoorRows(sh) {
  const out = { jobs: {}, inspectors: {}, labels: {} };
  if (!sh || sh.getLastRow() < 2) return out;
  const fix = nameFixer();
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(r => {
    const id = String(r[0]).trim().toUpperCase();
    if (!id || id === 'CLASS') return;
    const names = [r[2], r[3]].map(fix).filter(Boolean);
    out.labels[id] = String(r[1]).trim();
    if (/^I\d+$/.test(id)) out.inspectors[id] = names[0] || '';
    else out.jobs[id] = names;
  });
  return out;
}
/** 外掃的工作分配：{ name, jobs:{J01:[..]}, inspectors:{I1:..}, labels:{J01:'公佈欄玻璃 1、…'} } */
function getOutdoor() {
  let sh = getSS().getSheetByName(SHEET_OUT);
  if ((!sh || sh.getLastRow() < 2) && !PropertiesService.getScriptProperties().getProperty('OUT_IMPORTED')) {
    importOutdoorFromOldApp(true); // 第一次：從舊的外掃 App 匯入
    sh = getSS().getSheetByName(SHEET_OUT);
  }
  return Object.assign({ name: SHEET_OUT }, readOutdoorRows(sh));
}
/** 把外掃工作分配寫進工作表：只更新有傳來的代號，其他列原封不動 */
function writeOutdoorRows(sh, o) {
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, 4).getDisplayValues() : [];
  const at = {};
  rows.forEach((r, i) => { at[String(r[0]).trim()] = i; });
  const put = (id, label, names) => {
    const v = [id, label, names[0] || '', names[1] || ''];
    if (at[id] != null) { v[1] = rows[at[id]][1] || label; rows[at[id]] = v; } else { at[id] = rows.length; rows.push(v); }
  };
  const labels = o.labels || {};
  Object.keys(o.inspectors || {}).forEach(id => put(id, labels[id] || '檢查人', [o.inspectors[id]]));
  Object.keys(o.jobs || {}).forEach(id => put(id, labels[id] || '', o.jobs[id] || []));
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
}
function saveOutdoor(o) {
  writeOutdoorRows(getSheet(SHEET_OUT, HEAD_ROSTER), o);
}
/** 從舊的外掃 App 試算表匯入（第一次自動；選單也可以手動重新匯入，會覆蓋這裡的） */
function importOutdoorFromOldApp(auto) {
  const props = PropertiesService.getScriptProperties();
  const x = outdoorSheet();
  if (!x || !x.sh) {
    if (auto) { props.setProperty('OUT_IMPORTED', '1'); return; }
    throw new Error('找不到舊的外掃 App 試算表（「' + CONFIG.FOLDER_NAME + '」資料夾裡檔名含「外掃」的試算表）');
  }
  const o = readOutdoorRows(x.sh);
  const sh = getSheet(SHEET_OUT, HEAD_ROSTER);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_ROSTER.length).clearContent();
  writeOutdoorRows(sh, o);
  props.setProperty('OUT_IMPORTED', '1');
  if (!auto) try { SpreadsheetApp.getUi().alert('完成：已從「' + x.ss.getName() + '」匯入外掃工作分配。'); } catch (e) { /* 從編輯器執行 */ }
}
/** 試算表選單：把這裡的外掃工作分配寫回舊的外掃 App（需要時才用） */
function pushOutdoorToOldApp() {
  const x = outdoorSheet();
  if (!x) throw new Error('找不到舊的外掃 App 試算表');
  let sh = x.sh;
  if (!sh) { sh = x.ss.insertSheet(SHEET_ROSTER); sh.getRange(1, 1, 1, HEAD_ROSTER.length).setValues([HEAD_ROSTER]).setFontWeight('bold'); }
  writeOutdoorRows(sh, getOutdoor());
  try { SpreadsheetApp.getUi().alert('完成：已把外掃工作分配同步到「' + x.ss.getName() + '」。'); } catch (e) { /* 從編輯器執行 */ }
}
function rosterWithOutdoor() {
  const r = getRoster();
  r.outdoor = getOutdoor();
  // 幹部名單工作表：網頁依職位自動排入幹部欄位（不用在網頁上再填）
  if (rosterSheet()) { r.cadres = cadreMap(); r.cadreSource = rosterSheet().getName(); }
  if (!r.jobs.CLASS || !r.jobs.CLASS[0]) r.jobs.CLASS = [CONFIG.CLASS_NAME];
  return r;
}
function setOutdoorSheet(url) {
  const s = String(url || '').trim();
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
  if (!m) throw new Error('請貼上外掃區 Google 試算表的網址');
  let ss;
  try { ss = SpreadsheetApp.openById(m[1]); } catch (e) { throw new Error('打不開這份試算表，請確認是你的帳號可以編輯的試算表'); }
  if (!ss.getSheetByName(SHEET_ROSTER)) throw new Error('「' + ss.getName() + '」裡沒有「工作分配」工作表，請確認是外掃區的試算表');
  PropertiesService.getScriptProperties().setProperty('OUTDOOR_SHEET_ID', m[1]);
  return { ok: true, name: ss.getName(), roster: rosterWithOutdoor() };
}

// ── 名單與排名 ──
function listSheetFiles() {
  const files = [];
  const it = getRootFolder().getFilesByType(MimeType.GOOGLE_SHEETS);
  while (it.hasNext()) files.push(it.next());
  return files;
}
const isRankName = n => /排名|成績/.test(n);
function rosterFile() {
  const files = listSheetFiles().filter(f => !isRankName(f.getName()) && !/外掃/.test(f.getName()));
  if (!files.length) throw new Error('「' + CONFIG.FOLDER_NAME + '」資料夾裡找不到名單試算表');
  files.sort((a, b) => (/名單/.test(b.getName()) ? 1 : 0) - (/名單/.test(a.getName()) ? 1 : 0));
  return files[0];
}
function rankFile() {
  const files = listSheetFiles().filter(f => isRankName(f.getName()));
  files.sort((a, b) => b.getLastUpdated() - a.getLastUpdated()); // 最新修改的那份
  return files[0] || null;
}

/** 讀取試算表第一個工作表：找到含「姓名」或「名次」的標題列 */
function readTable(file) {
  return tableOf(SpreadsheetApp.openById(file.getId()).getSheets()[0].getDataRange().getDisplayValues(), file.getName());
}
function tableOf(values, name) {
  const h = values.findIndex(r => r.some(c => /^(姓名|名次|班排名|排名|座號)$/.test(String(c).trim())));
  if (h < 0) throw new Error('「' + name + '」裡找不到標題列（姓名／座號／名次）');
  const head = values[h].map(c => String(c).trim());
  const col = re => head.findIndex(c => re.test(c));
  const cId = col(/身[分份]證/);
  // 職位：從「職位」那一欄開始往右（合併儲存格的標題只在第一欄），不含身分證字號
  const c0 = col(/職位|幹部/);
  const cRoles = [];
  if (c0 >= 0) for (let i = c0; i < head.length; i++) if (i !== cId && (i === c0 || !head[i] || /職位|幹部/.test(head[i]))) cRoles.push(i);
  return {
    rows: values.slice(h + 1), name: name, headRow: h + 1, head: head,
    cDept: col(/^科別$/), cNo: col(/^座號$/), cName: col(/^姓名$/),
    cRank: col(/^(班排名|名次|排名|班級名次)$/), cId: cId, cRoles: cRoles,
  };
}
const isMonitor = key => cadreRoles(key).some(r => /^副?班長$/.test(String(r).trim()));
/** 班長、副班長、環保股長（衛生股長）可以修改工作分配 */
function canEditRoster(key) {
  return cadreRoles(key).some(r => /^(副?班長|環保|衛生)/.test(String(r).trim()));
}
/** 導師在 App 裡修改幹部名單：pairs＝[[同學, 職位], …]，寫回「學生/幹部名單」的職位欄（身分證字號等其他欄位不動） */
function saveCadres(pairs) {
  const sh = rosterSheet();
  if (!sh) throw new Error('找不到「' + CONFIG.ROSTER_SHEET + '」工作表');
  return withLock(() => {
    const t = tableOf(sh.getDataRange().getDisplayValues(), sh.getName());
    const roles = {};
    pairs.forEach(p => { const k = String(p[0] || '').trim(), r = String(p[1] || '').trim(); if (k && r) (roles[k] = roles[k] || []).push(r); });
    let cols = t.cRoles.slice();
    if (!cols.length) { // 還沒有職位欄：在最右邊加一欄
      const c = sh.getLastColumn() + 1;
      sh.getRange(t.headRow, c).setValue('職位').setFontWeight('bold');
      cols = [c - 1];
    }
    const n = t.rows.length;
    if (!n) return { ok: true, roster: rosterWithOutdoor() };
    const vals = cols.map(() => []);
    t.rows.forEach(r => {
      const p = personOf(t, r), list = p.name ? roles[p.key] || [] : null;
      cols.forEach((c, j) => {
        if (!list) { vals[j].push([r[c] || '']); return; }        // 不是學生的列：原封不動
        vals[j].push([j < cols.length - 1 ? list[j] || '' : list.slice(j).join('、')]); // 職位太多就寫在最後一欄
      });
    });
    cols.forEach((c, j) => sh.getRange(t.headRow + 1, c + 1, n, 1).setValues(vals[j]));
    return { ok: true, roster: rosterWithOutdoor() };
  });
}
/** 名單工作表：CONFIG.ROSTER_SHEET，找不到就試常見的名稱（改過分頁名稱也讀得到） */
function rosterSheet() {
  const ss = getSS();
  const names = [CONFIG.ROSTER_SHEET, '學生/幹部名單', '學生／幹部名單', '幹部名單', '學生名單', '名單'];
  for (let i = 0; i < names.length; i++) { const sh = ss.getSheetByName(names[i]); if (sh) return sh; }
  return null;
}
/** 全班名單：這份試算表的「幹部名單」工作表；沒有的話用資料夾裡的名單試算表 */
function rosterTable() {
  const sh = rosterSheet();
  if (sh) return tableOf(sh.getDataRange().getDisplayValues(), sh.getName());
  return readTable(rosterFile());
}
/** 幹部：同學 → 職位（同一人可以兼好幾個） */
function cadreMap() {
  const t = rosterTable(), out = {};
  t.rows.forEach(r => {
    const p = personOf(t, r);
    const roles = [].concat.apply([], t.cRoles.map(i => String(r[i] || '').split(/[、,，]/))).map(x => x.trim()).filter(Boolean);
    if (p.name && roles.length) out[p.key] = roles;
  });
  return out;
}
function personOf(t, r) {
  const name = t.cName >= 0 ? String(r[t.cName] || '').trim() : '';
  const dept = t.cDept >= 0 ? String(r[t.cDept] || '').trim() : '';
  let no = t.cNo >= 0 ? String(r[t.cNo] || '').trim() : '';
  if (/^\d$/.test(no)) no = '0' + no;
  if (/^\d{3,}$/.test(no)) no = String(Number(no)).padStart(2, '0');
  const id = t.cId >= 0 ? normId(r[t.cId]) : '';
  const rank = t.cRank >= 0 ? parseInt(String(r[t.cRank]).replace(/[^\d]/g, ''), 10) : NaN;
  return { key: dept + no + name, dept: dept, no: no, name: name, id: id, rank: rank };
}

/** 從名單試算表讀取學生（需有「姓名」欄，可有「科別」「座號」） */
function getStudents() {
  const t = rosterTable();
  if (t.cName < 0) throw new Error('名單「' + t.name + '」裡找不到「姓名」欄');
  const students = t.rows.map(r => personOf(t, r)).filter(p => p.name).map(p => p.key);
  return { ok: true, source: t.name, className: CONFIG.CLASS_NAME || t.name.replace(/名單.*$/, '').trim(), students: students };
}

/** 名單＋排名合併：每位同學的名次與身分證字號 */
function readPeople() {
  const rt = rosterTable();
  const rf = { getName: () => rt.name };
  const people = rt.rows.map(r => personOf(rt, r)).filter(p => p.name);
  const kf = rankFile();
  let source = '';
  if (kf) {
    source = kf.getName();
    const kt = readTable(kf);
    if (kt.cRank < 0) throw new Error('排名檔「' + source + '」裡找不到「名次」欄');
    kt.rows.map(r => personOf(kt, r)).forEach(q => {
      if (!q.name && !q.no) return;
      // 先用 科別＋座號＋姓名 比對，其次姓名（不重複時），最後 科別＋座號
      let p = people.find(x => x.key === q.key);
      if (!p && q.name) { const s = people.filter(x => x.name === q.name); if (s.length === 1) p = s[0]; }
      if (!p && q.no) { const s = people.filter(x => x.no === q.no && (!q.dept || x.dept === q.dept)); if (s.length === 1) p = s[0]; }
      if (!p) return;
      if (!isNaN(q.rank)) p.rank = q.rank;
      if (q.id) p.id = q.id;
    });
  } else if (rt.cRank >= 0) {
    source = rf.getName() + '（名次欄）';
  }
  // 「扣分統計」填了段考成績：用最近一次段考的名次（優先於排名檔）
  let fromExam = false;
  try {
    const R = examRanks();
    if (R) {
      people.forEach(p => { p.rank = R.latestRank[p.key] || NaN; });
      source = '扣分統計・' + R.label; fromExam = true;
    }
  } catch (e) { Logger.log('段考名次讀取失敗：' + e); }
  return { people: people, source: source, fromExam: fromExam };
}

/** 試算表選單：檢查哪些同學沒有名次或身分證字號 */
function checkPeople() {
  const r = readPeople();
  const noRank = r.people.filter(p => isNaN(p.rank)).map(p => p.key);
  const noId = r.people.filter(p => !p.id).map(p => p.key);
  const msg = '名單 ' + r.people.length + ' 人\n排名來源：' + (r.source || '（找不到排名檔）') +
    '\n\n沒有名次：' + (noRank.join('、') || '無') + '\n\n沒有身分證字號：' + (noId.join('、') || '無');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

// ── 學生登入：身分證字號 → 雜湊比對 ──
function normId(s) { return String(s || '').normalize('NFKC').replace(/\s+/g, '').toUpperCase(); }
function hashId(id) {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty('ID_SALT');
  if (!salt) { salt = Utilities.getUuid(); props.setProperty('ID_SALT', salt); }
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + id, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function idMap(force) {
  const cache = CacheService.getScriptCache();
  if (!force) { const c = cache.get('IDMAP'); if (c) return JSON.parse(c); }
  const map = {};
  readPeople().people.forEach(p => { if (p.id) map[hashId(p.id)] = p.key; });
  cache.put('IDMAP', JSON.stringify(map), 1800);
  return map;
}
function keyOfId(idno) {
  const id = normId(idno);
  if (!/^[A-Z][A-Z0-9]\d{8}$/.test(id)) return '';
  const h = hashId(id);
  return idMap(false)[h] || idMap(true)[h] || '';
}
// 登入代碼＝「身分｜同學｜到期時間」＋用只有這個 Apps Script 知道的密鑰算出的簽章。
// 不用存在任何地方；密鑰換掉（讓所有人重新登入）後，舊的代碼全部失效。
function sessionSecret() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('SESSION_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SESSION_SECRET', k); }
  return k;
}
function signSession(payload) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, sessionSecret(), Utilities.Charset.UTF_8)).replace(/=+$/, '');
}
function newSession(role, key) {
  const payload = role + '|' + key + '|' + (Date.now() + CONFIG.SESSION_DAYS * 86400e3);
  return Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8).replace(/=+$/, '') + '.' + signSession(payload);
}
/** 驗證登入代碼：正確且沒過期就回傳「身分|同學」，否則回傳空字串 */
function readSession(sid) {
  const i = sid.indexOf('.');
  if (i < 0) return CacheService.getScriptCache().get('sid:' + sid) || ''; // 舊版（6 小時）的代碼
  let payload;
  try {
    const b = sid.slice(0, i);
    payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(b + '==='.slice((b.length + 3) % 4))).getDataAsString('UTF-8');
  } catch (e) { return ''; }
  if (signSession(payload) !== sid.slice(i + 1)) return '';
  const m = payload.match(/^([SCG])\|(.*)\|(\d+)$/);
  if (!m || Date.now() > Number(m[3])) return '';
  return m[1] + '|' + m[2];
}
/** 任課老師登入：不用密碼（或輸入 GUEST_CODE），只能抽籤、看座位表 */
function guestLogin(code) {
  if (CONFIG.GUEST_CODE && normPw(code) !== normPw(CONFIG.GUEST_CODE)) {
    return { ok: false, error: code ? '登入碼錯誤' : '請輸入任課老師登入碼', code: 'guestcode' };
  }
  return { ok: true, sid: newSession('G', '任課老師'), className: CONFIG.CLASS_NAME };
}
/** 試算表選單：讓所有學生、幹部重新登入（例如有人手機遺失） */
function resetSessions() {
  PropertiesService.getScriptProperties().deleteProperty('SESSION_SECRET');
  try { SpreadsheetApp.getUi().alert('完成：所有學生、幹部下次打開 App 都要重新輸入身分證字號。'); } catch (e) { /* 從編輯器執行時沒有畫面 */ }
}
function stuLogin(idno) {
  if (!/^[A-Z][A-Z0-9]\d{8}$/.test(normId(idno))) return { ok: false, error: '身分證字號格式不正確' };
  const key = keyOfId(idno);
  if (!key) {
    Utilities.sleep(1500); // 放慢亂猜的速度
    return { ok: false, error: '找不到這個身分證字號，請確認後再試，或請導師檢查名單', code: 'idno' };
  }
  const cls = getRoster().jobs.CLASS;
  return { ok: true, sid: newSession('S', key), me: key, className: (cls && cls[0]) || '' };
}

/** 幹部名單（工作分配工作表中 I、C 開頭的列）：同學 → 職位 */
function cadreRoles(key) {
  if (rosterSheet()) return cadreMap()[key] || [];
  const sh = getSS().getSheetByName(SHEET_ROSTER);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getDisplayValues()
    .filter(r => /^[IC]\d+$/.test(String(r[0]).trim()) && String(r[2]).trim() === key)
    .map(r => String(r[1]).replace(/（.*$/, '').trim() || '幹部');
}
/** 外掃監督（外掃試算表的 I1 南區、I2 北區）→ 職位名稱 */
function outdoorRoles(key) {
  const o = getOutdoor();
  if (!o) return [];
  const names = { I1: '外掃監督A', I2: '外掃監督B' };
  return Object.keys(o.inspectors).filter(id => o.inspectors[id] === key).map(id => names[id] || '外掃檢查人');
}
/** 可以做掃地檢查：環保股長（內掃）或外掃監督 */
function isInspector(key) {
  const r = getRoster().inspectors;
  return Object.keys(r).some(id => /^I\d+$/.test(id) && r[id] === key)
    || cadreRoles(key).some(x => /衛生|環保/.test(x)) || outdoorRoles(key).length > 0;
}

/** 老師／幹部登入：導師用統一密碼；幹部用自己的身分證字號（首字母大小寫都可以） */
function staffLogin(pw) {
  if (normPw(pw) && normPw(pw) === normPw(CONFIG.TOKEN)) return { ok: true, role: 'teacher', roster: rosterWithOutdoor() };
  if (!/^[A-Z][A-Z0-9]\d{8}$/.test(normId(pw))) {
    Utilities.sleep(1000);
    return { ok: false, error: '密碼錯誤', code: 'token' };
  }
  const key = keyOfId(pw);
  if (!key) {
    Utilities.sleep(1500);
    return { ok: false, error: '找不到這個身分證字號，請確認後再試', code: 'idno' };
  }
  const roles = cadreRoles(key).concat(outdoorRoles(key));
  if (!roles.length) return { ok: false, error: key + ' 不在幹部名單中。要選座位請按上方「學生選位」' };
  return { ok: true, role: 'cadre', sid: newSession('C', key), me: key, roles: roles, roster: rosterWithOutdoor() };
}

// ── 加扣分：導師與幹部登記，一定要有理由 ──
function pointsSheet() { return getSheet(SHEET_POINTS, HEAD_POINTS); }
function addPoints(rows, who) {
  if (!who.teacher && !cadreRoles(who.key).length) throw new Error('你已經不在幹部名單中，不能登記加扣分');
  const now = new Date();
  const clean = rows.map(r => {
    const p = Math.round(Number(r.points));
    const reason = String(r.reason || '').trim().slice(0, 100);
    const student = String(r.student || '').trim();
    if (!student || !p || Math.abs(p) > 100 || !reason) throw new Error('資料不完整：每一筆都要有同學、分數和理由');
    return [toDate(r.date), student, p, String(r.cat || '其他').slice(0, 10), reason, who.key, now, String(r.id || Utilities.getUuid())];
  });
  withLock(() => {
    const sh = pointsSheet();
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, clean.length, HEAD_POINTS.length).setValues(clean);
    sh.getRange(start, 1, clean.length, 1).setNumberFormat('yyyy/mm/dd');
    sh.getRange(start, 7, clean.length, 1).setNumberFormat('yyyy/mm/dd hh:mm');
  });
  return { ok: true, rows: getPoints(7, who) };
}
function getPoints(days, who) {
  const sh = pointsSheet();
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const since = Date.now() - (Number(days) || 14) * 86400e3;
  return sh.getRange(2, 1, n, HEAD_POINTS.length).getValues()
    .filter(r => (who.teacher || String(r[5]) === who.key) && (r[6] instanceof Date ? r[6].getTime() : 0) >= Math.max(since, resetAt()))
    .slice(-60).reverse()
    .map(r => ({
      id: String(r[7]), date: r[0] instanceof Date ? Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'yyyy/MM/dd') : String(r[0]),
      student: String(r[1]), points: Number(r[2]), cat: String(r[3]), reason: String(r[4]), by: String(r[5]),
      time: r[6] instanceof Date ? Utilities.formatDate(r[6], CONFIG.TIMEZONE, 'MM/dd HH:mm') : '',
    }));
}
function delPoints(id, who) {
  withLock(() => {
    const sh = pointsSheet();
    const n = sh.getLastRow() - 1;
    if (n < 1) return;
    const vals = sh.getRange(2, 1, n, HEAD_POINTS.length).getValues();
    const i = vals.findIndex(r => String(r[7]) === String(id));
    if (i < 0) throw new Error('找不到這筆紀錄（可能已經刪除了）');
    if (!who.teacher && String(vals[i][5]) !== who.key) throw new Error('只能刪除自己登記的紀錄');
    sh.deleteRow(i + 2);
  });
  return { ok: true, rows: getPoints(7, who) };
}

// ── 商店：用加分的點數買大頭照配件（可以自己用或送人），配件有效 10 個上課日 ──
function accFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName(CONFIG.ACC_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(CONFIG.ACC_FOLDER);
}
/** 內建配件（網站上的 assets/acc/catalog.json）＋雲端硬碟「配件」資料夾裡的圖片 */
function catalog() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('ACC_CATALOG');
  if (c) return JSON.parse(c);
  let list = [];
  try {
    list = JSON.parse(UrlFetchApp.fetch(CONFIG.SITE_URL + 'assets/acc/catalog.json', { muteHttpExceptions: true }).getContentText())
      .map(a => ({ id: String(a.id), name: String(a.name), price: Math.max(0, Number(a.price) || 0), src: String(a.src) }));
  } catch (e) { /* 讀不到網站就只用雲端硬碟的 */ }
  const it = accFolder().getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (!/^image\//.test(f.getMimeType())) continue;
    const base = f.getName().replace(/\.[^.]+$/, '');
    const m = base.normalize('NFKC').match(/^(.*?)[_\s-]+(\d+)$/);
    let meta = {};
    try { meta = JSON.parse(f.getDescription() || '{}') || {}; } catch (e) { /* 說明欄不是創造卡的格式 */ }
    list.push({ id: 'd:' + f.getId(), name: (m ? m[1] : base).trim(), price: m ? Number(m[2]) : CONFIG.ACC_DEFAULT_PRICE, t: f.getLastUpdated().getTime(), creator: String(meta.creator || ''), delisted: !!meta.delisted });
  }
  // 已下架的商品：等到買的人都過期了，才把圖片丟到垃圾桶
  const off = list.filter(a => a.delisted);
  if (off.length) {
    const today = ymd(new Date()), inUse = {};
    invRows().forEach(x => { if (x.exp >= today) inUse[x.acc] = true; });
    off.filter(a => !inUse[a.id]).forEach(a => { try { DriveApp.getFileById(a.id.slice(2)).setTrashed(true); } catch (e) { /* 已經不在了 */ } });
    list = list.filter(a => !a.delisted || inUse[a.id]);
  }
  cache.put('ACC_CATALOG', JSON.stringify(list), 600);
  return list;
}
/** 雲端硬碟配件的圖片（透明 PNG 原檔，太大的略過）；have＝手機上已有的版本 */
function accImages(have) {
  const out = {}, ids = [];
  catalog().filter(a => a.id.indexOf('d:') === 0).forEach(a => {
    ids.push(a.id);
    if (have[a.id] === a.t) return;
    try {
      const b = DriveApp.getFileById(a.id.slice(2)).getBlob();
      if (b.getBytes().length > 400000) return;
      out[a.id] = { t: a.t, d: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
    } catch (e) { /* 檔案被刪了 */ }
  });
  return { ok: true, images: out, ids: ids };
}
const ymd = d => Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy/MM/dd');
/** 從今天起算第 n 個上課日（週一到週五；今天是上課日就算第 1 天） */
function schoolDaysLater(n) {
  const d = new Date(Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'12:00:00"));
  let count = 0;
  for (let i = 0; i < 40; i++) {
    const wd = Number(Utilities.formatDate(d, CONFIG.TIMEZONE, 'u')); // 1＝週一 … 7＝週日
    if (wd <= 5 && ++count >= n) break;
    d.setDate(d.getDate() + 1);
  }
  return ymd(d);
}
function invRows() {
  const sh = getSheet(SHEET_INV, HEAD_INV);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEAD_INV.length).getDisplayValues().map((r, i) => ({
    row: i + 2, id: r[0], owner: r[1], acc: r[2], name: r[3], price: Number(r[4]) || 0, buyer: r[5], time: r[6], exp: r[7], note: r[8],
  })) : [];
}
const UNLIMITED = 999999; // 導師的點數（無限，方便試用商店）
/** 創造卡的收入：別人買了我創造的商品（導師試買的不算） */
function salesOf(key, inv) {
  const mine = {};
  catalog().forEach(a => { if (a.creator === key) mine[a.id] = a; });
  const rows = (inv || invRows()).filter(x => mine[x.acc] && x.buyer !== CONFIG.TEACHER_NAME);
  return { n: rows.length, income: rows.reduce((t, x) => t + x.price, 0), items: Object.keys(mine).map(id => ({ id: id, name: mine[id].name, price: mine[id].price, sold: rows.filter(x => x.acc === id).length, delisted: !!mine[id].delisted })) };
}
function coinsOf(key, inv) {
  if (key === CONFIG.TEACHER_NAME) return { earned: UNLIMITED, spent: 0, coins: UNLIMITED, income: 0 };
  const psh = pointsSheet();
  let earned = 0;
  if (psh.getLastRow() > 1) psh.getRange(2, 2, psh.getLastRow() - 1, 2).getValues().forEach(r => { if (String(r[0]).trim() === key && Number(r[1]) > 0) earned += Number(r[1]); });
  const income = salesOf(key, inv).income;
  const red = packsFor(key).reduce((t, x) => t + x.points, 0); // 紅包（不算加扣分，不影響扣分統計和班名次）
  const spent = (inv || invRows()).filter(x => x.buyer === key).reduce((t, x) => t + x.price, 0)
    + spendRows().filter(x => x.who === key).reduce((t, x) => t + x.points, 0);
  return { earned: earned + income + red, spent: spent, coins: earned + income + red - spent, income: income, red: red };
}
function decoRows() {
  const sh = getSheet(SHEET_DECO, HEAD_DECO);
  const n = sh.getLastRow() - 1;
  const out = {};
  if (n > 0) sh.getRange(2, 1, n, 3).getValues().forEach((r, i) => {
    try { out[String(r[0]).trim()] = { row: i + 2, layers: JSON.parse(String(r[1]) || '[]'), t: r[2] instanceof Date ? r[2].getTime() : 0 }; } catch (e) { /* 格式錯誤就略過 */ }
  });
  return out;
}
/** 同學（或導師）→ 大頭照代號；導師是 T00 */
const keyCode = key => (key === CONFIG.TEACHER_NAME ? 'T00' : faceCode(key));
/** 大家的大頭照裝飾（只留仍然擁有、沒有過期的配件），依座號 */
function decoMap(times) {
  const today = ymd(new Date());
  const inv = {};
  invRows().forEach(x => { inv[x.id] = x; });
  const out = {}, rows = decoRows();
  Object.keys(rows).forEach(key => {
    const ok = rows[key].layers.filter(l => inv[l.inv] && inv[l.inv].owner === key && inv[l.inv].exp >= today)
      .map(l => ({ acc: inv[l.inv].acc, x: l.x, y: l.y, s: l.s, r: l.r }));
    if (ok.length) { out[keyCode(key)] = ok; if (times) times[keyCode(key)] = rows[key].t; }
  });
  return out;
}
function shopState(who) {
  try { grantRankCards(); } catch (e) { /* 排名檔有問題時不影響商店 */ }
  const today = ymd(new Date());
  const inv = invRows();
  const cat = catalog().map(a => ({ id: a.id, name: a.name, price: a.price, src: a.src || '', t: a.t || 0, creator: a.creator || '', delisted: !!a.delisted }));
  const key = who.key, c = coinsOf(key, inv);
  const psh = pointsSheet();
  const plus = psh.getLastRow() > 1 ? psh.getRange(2, 1, psh.getLastRow() - 1, 5).getValues()
    .filter(r => String(r[1]).trim() === key && Number(r[2]) > 0).slice(-20).reverse()
    .map(r => ({ date: r[0] instanceof Date ? ymd(r[0]) : String(r[0]), points: Number(r[2]), reason: String(r[4]) })) : [];
  packsFor(key).forEach(x => plus.unshift({ date: x.date, points: x.points, reason: '🧧 紅包：' + x.reason }));
  let students = [], classmates = [];
  try { students = getStudents().students; classmates = students.filter(k => k !== key); } catch (e) { /* 沒有名單 */ }
  // 可以偷的：別人身上還有效的配件；被偷紀錄：最近 14 天
  const others = {};
  inv.filter(x => x.owner !== key && x.exp >= today).forEach(x => { (others[x.owner] = others[x.owner] || []).push({ id: x.id, acc: x.acc, name: x.name, exp: x.exp }); });
  const since = Date.now() - 14 * 86400e3;
  const stolen = spendRows().filter(x => x.use === '竊盜卡' && x.target === key && x.t >= since).map(x => ({ time: x.time, thief: x.who, name: x.note }));
  return {
    ok: true, me: key, today: today, coins: c.coins, earned: c.earned, spent: c.spent, catalog: cat, plus: plus, classmates: classmates,
    stealPrice: CONFIG.STEAL_PRICE, fireworkPrice: CONFIG.FIREWORK_PRICE, swapPrice: CONFIG.SWAP_PRICE, others: others, stolen: stolen,
    weatherPrice: CONFIG.WEATHER_PRICE, weatherDays: CONFIG.WEATHER_DAYS,
    transferPrice: CONFIG.TRANSFER_PRICE, surePrice: CONFIG.SURE_PRICE, transferDays: CONFIG.TRANSFER_DAYS, myDraw: myDrawCards(key),
    swapped: spendRows().filter(x => x.use === '交換位置卡' && x.target === key && x.t >= since).map(x => ({ time: x.time, by: x.who, note: x.note })),
    inv: inv.filter(x => x.owner === key).map(x => ({ id: x.id, acc: x.acc, name: x.name, exp: x.exp, expired: x.exp < today, note: x.note })),
    deco: (decoRows()[key] || { layers: [] }).layers,
    minus: minusOf(key), swapBan: CONFIG.SWAP_BAN_MINUS, freeSwap: freeSwapCards(key), rankCards: cardRows().filter(x => x.who === key).slice(-5).reverse(),
    unlimited: !!who.teacher, income: c.income, sales: who.teacher ? null : salesOf(key, inv), createPrice: CONFIG.CREATE_PRICE,
    // 導師：全班點數一覽
    admin: who.teacher ? (() => {
      const items = itemsByStudent();
      return students.map(k => {
        const x = coinsOf(k, inv);
        return { key: k, earned: x.earned, spent: x.spent, coins: x.coins, income: x.income, active: inv.filter(y => y.owner === k && y.exp >= today).length,
          held: items.held[k] || {}, used: items.used[k] || {} };
      });
    })() : null,
  };
}
function buyAcc(who, acc) {
  const a = catalog().find(x => x.id === acc);
  if (!a) throw new Error('沒有這個配件');
  if (a.delisted) throw new Error('這個商品已經下架了');
  withLock(() => {
    const c = coinsOf(who.key);
    if (c.coins < a.price) throw new Error('點數不夠（需要 ' + a.price + ' 點，你有 ' + c.coins + ' 點）');
    const sh = getSheet(SHEET_INV, HEAD_INV);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_INV.length).setNumberFormat('@')
      .setValues([[Utilities.getUuid().slice(0, 8), who.key, a.id, a.name, String(a.price), who.key, Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm'), schoolDaysLater(CONFIG.ACC_DAYS), '']]);
  });
  return shopState(who);
}
function giftAcc(who, invId, to) {
  const students = getStudents().students;
  if (students.indexOf(to) < 0 || to === who.key) throw new Error('請選擇要送的同學');
  withLock(() => {
    const x = invRows().find(r => r.id === invId);
    if (!x || x.owner !== who.key) throw new Error('這個配件不是你的');
    if (x.exp < ymd(new Date())) throw new Error('這個配件已經過期了');
    const sh = getSheet(SHEET_INV, HEAD_INV);
    sh.getRange(x.row, 2).setValue(to);
    sh.getRange(x.row, 9).setValue('由 ' + who.key + ' 贈送');
  });
  return shopState(who);
}
function spendRows() {
  const sh = getSheet(SHEET_SPEND, HEAD_SPEND);
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEAD_SPEND.length).getValues().map(r => ({
    t: r[0] instanceof Date ? r[0].getTime() : 0, time: r[0] instanceof Date ? Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'MM/dd HH:mm') : String(r[0]),
    who: String(r[1]), points: Number(r[2]) || 0, use: String(r[3]), target: String(r[4]), note: String(r[5]), id: String(r[6]),
  })) : [];
}
function addSpend(who, points, use, target, note) {
  const sh = getSheet(SHEET_SPEND, HEAD_SPEND);
  sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_SPEND.length).setValues([[new Date(), who, points, use, target, note, Utilities.getUuid().slice(0, 8)]]);
}
/** 竊盜卡：花 10 點，把別人的配件變成自己的（到期日不變） */
function stealAcc(who, invId) {
  withLock(() => {
    const x = invRows().find(r => r.id === invId);
    if (!x || x.owner === who.key) throw new Error('找不到這個配件');
    if (x.exp < ymd(new Date())) throw new Error('這個配件已經過期了');
    const c = coinsOf(who.key);
    if (c.coins < CONFIG.STEAL_PRICE) throw new Error('點數不夠（竊盜卡要 ' + CONFIG.STEAL_PRICE + ' 點，你有 ' + c.coins + ' 點）');
    const sh = getSheet(SHEET_INV, HEAD_INV);
    sh.getRange(x.row, 2).setValue(who.key);
    sh.getRange(x.row, 9).setValue('用竊盜卡從 ' + x.owner + ' 奪來');
    addSpend(who.key, CONFIG.STEAL_PRICE, '竊盜卡', x.owner, x.name);
  });
  return shopState(who);
}
/** 煙火：花 1 點，放在某位同學的座位上 */
function buyFirework(who, to) {
  if (getStudents().students.indexOf(to) < 0) throw new Error('請選擇同學');
  withLock(() => {
    const c = coinsOf(who.key);
    if (c.coins < CONFIG.FIREWORK_PRICE) throw new Error('點數不夠');
    addSpend(who.key, CONFIG.FIREWORK_PRICE, '煙火', to, '');
  });
  return shopState(who);
}
/** 交換位置卡：花 20 點，和另一位同學強制對調座位（兩個人都要已經有座位） */
function swapSeatCard(who, to) {
  if (who.teacher) throw new Error('導師沒有座位，請用「座位 → 交換位置」');
  if (to === who.key) throw new Error('請選擇另一位同學');
  withLock(() => {
    const seats = getSeats();
    const mine = Object.keys(seats).find(id => seats[id] === who.key);
    const theirs = Object.keys(seats).find(id => seats[id] === to);
    if (!mine) throw new Error('你還沒有座位，不能交換');
    if (!theirs) throw new Error(to + ' 還沒有座位，不能交換');
    const m = minusOf(who.key);
    if (m > CONFIG.SWAP_BAN_MINUS) throw new Error('你被扣的分數已經 ' + m + ' 分（超過 ' + CONFIG.SWAP_BAN_MINUS + ' 分），不能使用交換位置卡');
    const free = freeSwapCards(who.key) > 0;
    if (!free) {
      const c = coinsOf(who.key);
      if (c.coins < CONFIG.SWAP_PRICE) throw new Error('點數不夠（交換位置卡要 ' + CONFIG.SWAP_PRICE + ' 點，你有 ' + c.coins + ' 點）');
    }
    seats[mine] = to; seats[theirs] = who.key;
    writeSeats(seats);
    addSpend(who.key, free ? 0 : CONFIG.SWAP_PRICE, '交換位置卡', to, mine + ' ⇄ ' + theirs + (free ? '（免費卡）' : ''));
  });
  return shopState(who);
}
/** 創造卡：上傳 PNG 變成新商品（存在「配件」資料夾，說明欄記下創作者）；別人買了，點數算給創作者 */
function createAcc(who, name, price, data) {
  name = String(name || '').normalize('NFKC').replace(/[\\/:*?"<>|_\s]+/g, ' ').trim().slice(0, 12);
  if (!name) throw new Error('請幫商品取個名字');
  price = Math.round(Number(price));
  if (!(price >= 1 && price <= 100)) price = CONFIG.CREATE_PRICE;
  const m = String(data || '').match(/^data:image\/png;base64,(.+)$/);
  if (!m) throw new Error('請上傳 PNG 圖片');
  const bytes = Utilities.base64Decode(m[1]);
  if (bytes.length > 300000) throw new Error('圖片太大了（最多 300KB）');
  withLock(() => {
    if (!who.teacher) {
      const today = ymd(new Date());
      const n = catalog().filter(a => a.creator === who.key && ymd(new Date(a.t)) === today).length;
      if (n >= CONFIG.CREATE_PER_DAY) throw new Error('今天已經創造 ' + n + ' 個商品了，明天再來');
    }
    const f = accFolder().createFile(Utilities.newBlob(bytes, 'image/png', name + '_' + price + '.png'));
    f.setDescription(JSON.stringify({ creator: who.key }));
    CacheService.getScriptCache().remove('ACC_CATALOG');
  });
  return shopState(who);
}
/** 下架創造的商品：導師可以下架任何一個，同學只能下架自己的（已經買的人還是保有到期為止，只是看不到圖） */
/** 下架：不能再買，但已經買的人可以繼續用到到期（圖片保留，等大家都過期才刪）。
 *  remove（只有導師）：內容不適當時立刻移除圖片，並把點數退給每一位買的人 */
function delAcc(who, acc, remove) {
  const a = catalog().find(x => x.id === acc);
  if (!a || acc.indexOf('d:') !== 0) throw new Error('找不到這個商品');
  if (!who.teacher && a.creator !== who.key) throw new Error('只能下架自己創造的商品');
  if (remove && !who.teacher) throw new Error('只有導師可以移除並退點');
  const f = DriveApp.getFileById(acc.slice(2));
  if (remove) {
    withLock(() => {
      // 退點：把這個商品的每一筆購買改成 0 點、今天到期（紀錄還在）
      const sh = getSheet(SHEET_INV, HEAD_INV);
      const y = new Date(); y.setDate(y.getDate() - 1);
      invRows().filter(x => x.acc === acc).forEach(x => {
        sh.getRange(x.row, 5).setValue('0');
        sh.getRange(x.row, 8).setValue(ymd(y));
        sh.getRange(x.row, 9).setValue('導師移除商品，已退還 ' + x.price + ' 點');
      });
    });
    f.setTrashed(true);
  } else {
    let meta = {};
    try { meta = JSON.parse(f.getDescription() || '{}') || {}; } catch (e) { /* 不是 JSON */ }
    meta.delisted = true; meta.delistedBy = who.teacher ? CONFIG.TEACHER_NAME : who.key; meta.delistedAt = Date.now();
    f.setDescription(JSON.stringify(meta));
  }
  CacheService.getScriptCache().remove('ACC_CATALOG');
  return shopState(who);
}
/** 「加扣分紀錄」裡被扣的分數合計（正數） */
function minusOf(key) {
  const psh = pointsSheet();
  let m = 0;
  const rst = resetAt();
  if (psh.getLastRow() > 1) psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
    if (String(r[1]).trim() === key && Number(r[2]) < 0 && (!rst || (r[6] instanceof Date ? r[6].getTime() : 0) >= rst)) m -= Number(r[2]);
  });
  return m;
}
// ── 值日生：班長、副班長（或導師）每天登記兩位 ──
// ── 班費收支：總務（和導師）登記，大家都看得到 ──
const isTreasurer = key => cadreRoles(key).some(r => /^總務/.test(String(r).trim()));
function fundRows() {
  const sh = getSS().getSheetByName(SHEET_FUND);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_FUND.length).getValues()
    .filter(r => !String(r[8]) && String(r[1]).trim())
    .map(r => ({ date: r[0] instanceof Date ? ymd(r[0]) : String(r[0]), item: String(r[1]), type: String(r[2]), amount: Number(r[3]) || 0, note: String(r[4]), by: String(r[5]), id: String(r[7]) }));
}
function getFund() {
  const rows = fundRows().sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  rows.forEach(r => { bal += r.type === '支出' ? -r.amount : r.amount; r.balance = bal; });
  const inc = rows.filter(r => r.type !== '支出').reduce((t, r) => t + r.amount, 0), out = rows.filter(r => r.type === '支出').reduce((t, r) => t + r.amount, 0);
  return { ok: true, rows: rows.reverse(), income: inc, expense: out, balance: inc - out };
}
function addFund(who, r) {
  if (!who.teacher && !isTreasurer(who.key)) throw new Error('只有總務和導師可以登記班費');
  const item = String(r.item || '').trim().slice(0, 40), note = String(r.note || '').trim().slice(0, 100);
  const amount = Math.round(Number(r.amount) * 100) / 100, type = r.type === '支出' ? '支出' : '收入';
  if (!item) throw new Error('請填品項');
  if (!(amount > 0) || amount > 1e7) throw new Error('金額要大於 0');
  withLock(() => {
    const sh = getSheet(SHEET_FUND, HEAD_FUND);
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, HEAD_FUND.length).setValues([[toDate(r.date || ymd(new Date())), item, type, amount, note, mailName(who), new Date(), Utilities.getUuid().slice(0, 8), '']]);
    sh.getRange(row, 1).setNumberFormat('yyyy/mm/dd');
  });
  return getFund();
}
function delFund(who, id) {
  if (!who.teacher && !isTreasurer(who.key)) throw new Error('只有總務和導師可以刪除');
  withLock(() => {
    const sh = getSheet(SHEET_FUND, HEAD_FUND);
    const n = sh.getLastRow() - 1;
    const i = n > 0 ? sh.getRange(2, 8, n, 1).getValues().findIndex(x => String(x[0]) === id) : -1;
    if (i < 0) throw new Error('找不到這筆');
    sh.getRange(i + 2, 9).setValue('已刪除 ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + '（' + mailName(who) + '）');
  });
  return getFund();
}

// ── 發紅包：幹部發起 → 班長＋副班長＋另外兩位幹部（共 4 人）連署 → 發給全班（商店點數） ──
function packRows() {
  const sh = getSS().getSheetByName(SHEET_PACK);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_PACK.length).getValues().map((r, i) => ({
    row: i + 2, t: r[0] instanceof Date ? r[0].getTime() : 0, time: r[0] instanceof Date ? Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'MM/dd HH:mm') : '',
    by: String(r[1]), reason: String(r[2]), points: Number(r[3]) || 0, signs: String(r[4]).split('、').map(x => x.replace(/（.*$/, '').trim()).filter(Boolean),
    signText: String(r[4]), status: String(r[5]), date: r[6] instanceof Date ? ymd(r[6]) : '', id: String(r[7]),
  }));
}
/** 連署夠不夠：要有班長、副班長，再加另外兩位幹部（共 4 人） */
function packReady(signs) {
  const roles = {};
  signs.forEach(k => { roles[k] = cadreRoles(k).map(r => String(r).trim()); });
  const head = k => roles[k].some(r => r === '班長'), vice = k => roles[k].some(r => r === '副班長');
  const hasHead = signs.some(head), hasVice = signs.some(vice);
  const others = signs.filter(k => !head(k) && !vice(k) && roles[k].length).length;
  return { ok: hasHead && hasVice && others >= 2, hasHead: hasHead, hasVice: hasVice, others: others };
}
function getPacks() {
  const since = Date.now() - 30 * 86400e3;
  return packRows().filter(p => p.status === '連署中' || p.t >= since).reverse()
    .map(p => Object.assign({ need: packReady(p.signs) }, p, { row: undefined }));
}
function packsFor(key) {
  if (key === CONFIG.TEACHER_NAME) return [];
  return packRows().filter(p => p.status === '已發放').map(p => ({ date: p.date, points: p.points, reason: p.reason }));
}
function startPack(who, reason, points) {
  if (who.teacher) throw new Error('紅包活動由幹部發起');
  if (!cadreRoles(who.key).length) throw new Error('只有幹部可以發起紅包活動');
  reason = String(reason || '').trim().slice(0, 60);
  points = Math.round(Number(points));
  if (!reason) throw new Error('請寫發紅包的原因');
  if (!(points >= 1 && points <= PACK_MAX)) throw new Error('每人點數要在 1～' + PACK_MAX + ' 點之間');
  withLock(() => {
    const sh = getSheet(SHEET_PACK, HEAD_PACK);
    const now = new Date();
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_PACK.length).setValues([[now, who.key, reason, points, who.key + '（' + Utilities.formatDate(now, CONFIG.TIMEZONE, 'MM/dd HH:mm') + '）', '連署中', '', Utilities.getUuid().slice(0, 8), '']]);
  });
  return getPacks();
}
function signPack(who, id) {
  if (who.teacher || !cadreRoles(who.key).length) throw new Error('只有幹部可以連署');
  withLock(() => {
    const p = packRows().find(x => x.id === id);
    if (!p || p.status !== '連署中') throw new Error('這個紅包活動已經結束了');
    if (p.signs.indexOf(who.key) >= 0) throw new Error('你已經連署過了');
    const sh = getSheet(SHEET_PACK, HEAD_PACK);
    const signs = p.signs.concat([who.key]);
    sh.getRange(p.row, 5).setValue(p.signText + '、' + who.key + '（' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + '）');
    if (packReady(signs).ok) { // 連署夠了：發給全班
      sh.getRange(p.row, 6, 1, 2).setValues([['已發放', new Date()]]);
      sh.getRange(p.row, 9).setValue(getStudents().students.length);
    }
  });
  return getPacks();
}
function cancelPack(who, id) {
  withLock(() => {
    const p = packRows().find(x => x.id === id);
    if (!p || p.status !== '連署中') throw new Error('這個紅包活動已經結束了');
    if (!who.teacher && p.by !== who.key) throw new Error('只有發起人或導師可以取消');
    getSheet(SHEET_PACK, HEAD_PACK).getRange(p.row, 6).setValue('已取消（' + mailName(who) + ' ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + '）');
  });
  return getPacks();
}

// ── 飛鴿傳書：寄給同學（或導師）的站內信，3 天後在 App 上消失 ──
const mailName = who => (who.teacher ? CONFIG.TEACHER_NAME : who.key);
function mailRows() {
  const sh = getSS().getSheetByName(SHEET_MAIL);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_MAIL.length).getValues()
    .filter(r => r[0] instanceof Date)
    .map(r => ({ t: r[0].getTime(), time: Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'MM/dd HH:mm'), from: String(r[1]), to: String(r[2]), text: String(r[3]), id: String(r[4]) }));
}
function getMail(who) {
  const me = mailName(who), since = Date.now() - MAIL_DAYS * 86400e3;
  return mailRows().filter(m => m.to === me && m.t >= since).sort((a, b) => b.t - a.t);
}
function sendMail(who, to, text) {
  text = String(text || '').trim().slice(0, 200);
  if (!text) throw new Error('請寫下內容');
  const me = mailName(who);
  const ok = to === CONFIG.TEACHER_NAME || getStudents().students.indexOf(to) >= 0;
  if (!ok || to === me) throw new Error('請選擇收件人');
  withLock(() => {
    const today = ymd(new Date());
    if (!who.teacher && mailRows().filter(m => m.from === me && ymd(new Date(m.t)) === today).length >= MAIL_PER_DAY) throw new Error('今天已經寄了 ' + MAIL_PER_DAY + ' 封，明天再寄');
    const sh = getSheet(SHEET_MAIL, HEAD_MAIL);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_MAIL.length).setValues([[new Date(), me, to, text, Utilities.getUuid().slice(0, 8)]]);
  });
  return { ok: true };
}
// ── 公布欄：導師、幹部留言；大家打開 App 會先看到 ──
function getBoard() {
  const sh = getSS().getSheetByName(SHEET_BOARD);
  if (!sh || sh.getLastRow() < 2) return [];
  const since = Date.now() - BOARD_DAYS * 86400e3;
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_BOARD.length).getValues()
    .filter(r => r[0] instanceof Date && r[0].getTime() >= since && !String(r[4]) && String(r[1]).trim())
    .map(r => ({ id: String(r[3]), t: r[0].getTime(), date: ymd(r[0]), time: Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm'), text: String(r[1]), by: String(r[2]) }))
    .sort((a, b) => b.t - a.t);
}
function addPost(who, text) {
  text = String(text || '').trim().slice(0, 300);
  if (!text) throw new Error('請寫下要公布的內容');
  withLock(() => {
    const sh = getSheet(SHEET_BOARD, HEAD_BOARD);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_BOARD.length).setValues([[new Date(), text, who.teacher ? CONFIG.TEACHER_NAME : who.key, Utilities.getUuid().slice(0, 8), '', '']]);
  });
  return getBoard();
}
/** 修改：只能改自己的（導師可以改全部）；原本的內容記在「修改紀錄」欄 */
function editPost(who, id, text) {
  text = String(text || '').trim().slice(0, 300);
  if (!text) throw new Error('內容不能是空的（不要的話請按刪除）');
  withLock(() => {
    const sh = getSheet(SHEET_BOARD, HEAD_BOARD);
    const n = sh.getLastRow() - 1;
    const vals = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
    const i = vals.findIndex(r => String(r[3]) === id);
    if (i < 0 || String(vals[i][4])) throw new Error('找不到這則留言');
    if (!who.teacher && String(vals[i][2]) !== who.key) throw new Error('只能修改自己發布的留言');
    const log = String(vals[i][5] || '') + (vals[i][5] ? '\n' : '') + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + ' 修改前：' + String(vals[i][1]);
    sh.getRange(i + 2, 2).setValue(text);
    sh.getRange(i + 2, 6).setValue(log);
  });
  return getBoard();
}
/** 刪除：只標記「已刪除」，紀錄留在試算表；只能刪自己的（導師可以刪全部） */
function delPost(who, id) {
  withLock(() => {
    const sh = getSheet(SHEET_BOARD, HEAD_BOARD);
    const n = sh.getLastRow() - 1;
    if (n < 1) return;
    const vals = sh.getRange(2, 1, n, HEAD_BOARD.length).getValues();
    const i = vals.findIndex(r => String(r[3]) === id);
    if (i < 0) throw new Error('找不到這則留言');
    if (!who.teacher && String(vals[i][2]) !== who.key) throw new Error('只能刪除自己發布的留言');
    sh.getRange(i + 2, 5).setValue('已刪除 ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + '（' + (who.teacher ? CONFIG.TEACHER_NAME : who.key) + '）');
  });
  return getBoard();
}
// 每天 4 位：資料科 2 位、多媒科 2 位（各科最多 2 位）
function dutySheet() {
  const sh = getSheet(SHEET_DUTY, HEAD_DUTY);
  if (String(sh.getRange(1, 4).getValue()) !== HEAD_DUTY[3]) sh.getRange(1, 1, 1, HEAD_DUTY.length).setValues([HEAD_DUTY]).setFontWeight('bold'); // 舊版只有 2 位
  return sh;
}
function getDuty() {
  const sh = getSS().getSheetByName(SHEET_DUTY);
  const today = ymd(new Date());
  if (!sh || sh.getLastRow() < 2 || String(sh.getRange(1, 4).getValue()) !== HEAD_DUTY[3]) return { date: today, list: [] };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i], d = r[0] instanceof Date ? ymd(r[0]) : String(r[0]);
    if (d === today) return { date: today, list: r.slice(1, 5).map(String).filter(Boolean), by: String(r[5]) };
  }
  return { date: today, list: [] };
}
function setDuty(who, list) {
  if (!who.teacher && !cadreRoles(who.key).some(r => /^副?班長$/.test(String(r).trim()))) throw new Error('只有班長、副班長可以登記值日生');
  const all = getStudents().students;
  list = (Array.isArray(list) ? list : []).map(String).filter(Boolean);
  if (!list.length || list.length > 4) throw new Error('請選擇值日生（最多 4 位）');
  if (list.some(k => all.indexOf(k) < 0)) throw new Error('名單裡找不到這位同學');
  if (new Set(list).size !== list.length) throw new Error('同一個人不能選兩次');
  const per = {};
  list.forEach(k => { const d = (k.match(/^\D*/) || [''])[0]; per[d] = (per[d] || 0) + 1; });
  if (Object.keys(per).some(d => per[d] > 2)) throw new Error('每一科最多 2 位值日生');
  withLock(() => {
    const sh = dutySheet();
    const today = ymd(new Date());
    const vals = [[today].concat([0, 1, 2, 3].map(i => list[i] || '')).concat([who.key, new Date()])];
    // 今天已經登記過就改那一列
    const n = sh.getLastRow() - 1;
    const i = n > 0 ? sh.getRange(2, 1, n, 1).getValues().findIndex(r => (r[0] instanceof Date ? ymd(r[0]) : String(r[0])) === today) : -1;
    const row = i >= 0 ? i + 2 : sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, HEAD_DUTY.length).setValues(vals);
    sh.getRange(row, 1).setNumberFormat('yyyy/mm/dd');
  });
  return getDuty();
}
// ── 小太陽卡／小雨傘卡：放在某位同學的座位上方，維持 10 個上課日（到期日記在「說明」欄）──
const WEATHER = { sun: '小太陽卡', rain: '小雨傘卡' };
function buyWeather(who, kind, to) {
  const card = WEATHER[kind];
  if (!card) throw new Error('沒有這種卡片');
  if (getStudents().students.indexOf(to) < 0) throw new Error('請選擇同學');
  withLock(() => {
    const c = coinsOf(who.key);
    if (c.coins < CONFIG.WEATHER_PRICE) throw new Error('點數不夠（' + card + '要 ' + CONFIG.WEATHER_PRICE + ' 點，你有 ' + c.coins + ' 點）');
    addSpend(who.key, CONFIG.WEATHER_PRICE, card, to, schoolDaysLater(CONFIG.WEATHER_DAYS));
  });
  return shopState(who);
}
/** 還有效的小太陽、小雨傘：[{ kind, to, by, exp }] */
function weatherList() {
  const today = ymd(new Date());
  return spendRows().filter(x => (x.use === WEATHER.sun || x.use === WEATHER.rain) && x.note >= today)
    .map(x => ({ kind: x.use === WEATHER.sun ? 'sun' : 'rain', to: x.target, by: x.who, exp: x.note }));
}
// ── 抽籤轉移卡／抽籤必中卡：記在「點數使用」；抽籤畫面（導師、幹部）讀取後套用 ──
const isUsedNote = n => /^已使用/.test(String(n));
function drawFx() {
  const since = Date.now() - CONFIG.TRANSFER_DAYS * 86400e3;
  const rows = spendRows();
  return {
    // 同一人買好幾次：用最新的那張
    transfers: rows.filter(x => x.use === '抽籤轉移卡' && x.t >= since).map(x => ({ id: x.id, from: x.who, to: x.target, until: ymd(new Date(x.t + CONFIG.TRANSFER_DAYS * 86400e3)), t: x.t })),
    sure: rows.filter(x => x.use === '抽籤必中卡' && !isUsedNote(x.note)).map(x => ({ id: x.id, by: x.who, target: x.target, t: x.t })),
  };
}
function myDrawCards(key) {
  const fx = drawFx();
  return { transfer: fx.transfers.filter(x => x.from === key).pop() || null, sure: fx.sure.filter(x => x.by === key) };
}
function buyDrawCard(who, kind, to) {
  const card = kind === 'transfer' ? '抽籤轉移卡' : kind === 'sure' ? '抽籤必中卡' : '';
  if (!card) throw new Error('沒有這種卡片');
  if (getStudents().students.indexOf(to) < 0) throw new Error('請選擇同學');
  if (kind === 'transfer' && who.teacher) throw new Error('導師不會被抽到，不用轉移卡');
  if (kind === 'transfer' && to === who.key) throw new Error('替身不能是自己');
  const price = kind === 'transfer' ? CONFIG.TRANSFER_PRICE : CONFIG.SURE_PRICE;
  withLock(() => {
    const c = coinsOf(who.key);
    if (c.coins < price) throw new Error('點數不夠（' + card + '要 ' + price + ' 點，你有 ' + c.coins + ' 點）');
    addSpend(who.key, price, card, to, '');
  });
  return shopState(who);
}
/** 抽籤畫面用掉一張必中卡 */
function drawUsed(id) {
  return withLock(() => {
    const sh = getSheet(SHEET_SPEND, HEAD_SPEND);
    const n = sh.getLastRow() - 1;
    if (n < 1) return { ok: false };
    const ids = sh.getRange(2, 7, n, 1).getValues();
    const i = ids.findIndex(r => String(r[0]) === id);
    if (i < 0 || isUsedNote(sh.getRange(i + 2, 6).getValue())) return { ok: false };
    sh.getRange(i + 2, 6).setValue('已使用 ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm'));
    return { ok: true };
  });
}
/** 成員點數用：每位同學持有（還沒用、還有效）的特殊道具，和用過的次數 */
function itemsByStudent() {
  const today = ymd(new Date());
  const spend = spendRows(), cards = cardRows(), fx = drawFx();
  const held = {}, used = {};
  const add = (m, k, name, n) => { if (!k || !n) return; (m[k] = m[k] || {})[name] = (m[k][name] || 0) + n; };
  // 免費交換位置卡（段考前五名）：發的 − 用掉的
  cards.filter(c => c.card === '交換位置卡').forEach(c => add(held, c.who, '免費交換位置卡', c.n));
  spend.filter(x => x.use === '交換位置卡' && x.points === 0).forEach(x => add(held, x.who, '免費交換位置卡', -1));
  fx.sure.forEach(x => add(held, x.by, '抽籤必中卡', 1));                          // 還沒發動
  const lastTr = {};
  fx.transfers.forEach(x => { lastTr[x.from] = x; });
  Object.keys(lastTr).forEach(k => add(held, k, '抽籤轉移卡', 1));                // 還在 10 天內
  spend.filter(x => (x.use === '小太陽卡' || x.use === '小雨傘卡') && x.note >= today).forEach(x => add(held, x.who, x.use, 1)); // 放出去還有效
  spend.forEach(x => { if (['煙火', '交換位置卡', '竊盜卡', '小太陽卡', '小雨傘卡', '抽籤轉移卡', '抽籤必中卡'].indexOf(x.use) >= 0) add(used, x.who, x.use, 1); });
  Object.keys(held).forEach(k => Object.keys(held[k]).forEach(n => { if (held[k][n] <= 0) delete held[k][n]; }));
  return { held: held, used: used };
}
// ── 免費道具卡：段考前五名自動發放交換位置卡 ──
function cardRows() {
  const sh = getSS().getSheetByName(SHEET_CARDS);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_CARDS.length).getValues().map(r => ({
    time: r[0] instanceof Date ? ymd(r[0]) : String(r[0]), who: String(r[1]).trim(), card: String(r[2]), n: Number(r[3]) || 0, from: String(r[4]),
  }));
}
/** 還沒用掉的免費交換位置卡張數＝發放的 − 用掉的（點數 0 的交換位置卡） */
function freeSwapCards(key) {
  const got = cardRows().filter(x => x.who === key && x.card === '交換位置卡').reduce((t, x) => t + x.n, 0);
  if (!got) return 0;
  const used = spendRows().filter(x => x.who === key && x.use === '交換位置卡' && x.points === 0).length;
  return Math.max(0, got - used);
}
/** 有新的排名檔（或排名前五名變了）就發卡；同一份排名只發一次。10 分鐘內只檢查一次 */
function grantRankCards(force) {
  const cache = CacheService.getScriptCache();
  if (!force && cache.get('RANK_CARD_CHECK')) return;
  cache.put('RANK_CARD_CHECK', '1', 600);
  const r = readPeople();
  if (!r.source) return;
  // 段考成績是一格一格填的：只有按「段考排名」時才發卡，避免填到一半就發給錯的人
  if (r.fromExam && !force) return;
  const top = r.people.filter(p => CONFIG.RANK_CARDS[p.rank]).sort((a, b) => a.rank - b.rank);
  if (!top.length) return;
  const sig = r.source + '|' + top.map(p => p.rank + ':' + p.key).join(',');
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('RANK_CARD_DONE') || '[]');
  if (done.indexOf(sig) >= 0) return;
  withLock(() => {
    const sh = getSheet(SHEET_CARDS, HEAD_CARDS);
    const now = new Date();
    const rows = top.map(p => [now, p.key, '交換位置卡', CONFIG.RANK_CARDS[p.rank], r.source + ' 第 ' + p.rank + ' 名']);
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD_CARDS.length).setValues(rows);
    done.push(sig);
    props.setProperty('RANK_CARD_DONE', JSON.stringify(done.slice(-30)));
  });
}
/** 最近幾天的煙火（每支手機自己記得哪些已經看過） */
function fireworksList() {
  const since = Date.now() - CONFIG.FIREWORK_DAYS * 86400e3;
  return spendRows().filter(x => x.use === '煙火' && x.t >= since).map(x => ({ id: x.id, by: x.who, to: x.target, time: x.time }));
}
function saveDeco(who, layers) {
  const today = ymd(new Date());
  const mine = {};
  invRows().forEach(x => { if (x.owner === who.key && x.exp >= today) mine[x.id] = x; });
  const num = (v, lo, hi, d) => { const n = Number(v); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
  const clean = layers.filter(l => mine[l.inv]).slice(0, 8).map(l => ({
    inv: String(l.inv), x: num(l.x, -0.5, 1.5, 0.5), y: num(l.y, -0.5, 1.5, 0.5), s: num(l.s, 0.05, 2, 0.5), r: num(l.r, -180, 180, 0),
  }));
  withLock(() => {
    const sh = getSheet(SHEET_DECO, HEAD_DECO);
    const cur = decoRows()[who.key];
    const vals = [[who.key, JSON.stringify(clean), new Date()]];
    if (cur) sh.getRange(cur.row, 1, 1, 3).setValues(vals);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, 3).setValues(vals);
  });
  return shopState(who);
}

// ── 座位表 ──
function getSeats() {
  const sh = getSS().getSheetByName(SHEET_SEATS);
  const seats = {};
  if (!sh || sh.getLastRow() < 2) return seats;
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(r => {
    const id = String(r[0]).trim(), k = String(r[3]).trim();
    if (id && k) seats[id] = k;
  });
  return seats;
}
function saveSeats(seats) {
  return withLock(() => writeSeats(seats));
}
function writeSeats(seats) {
  {
    const sh = getSheet(SHEET_SEATS, HEAD_SEATS);
    const ids = Object.keys(seats).filter(id => /^\d+-\d+$/.test(id) && seats[id]);
    ids.sort((a, b) => { const x = a.split('-').map(Number), y = b.split('-').map(Number); return x[0] - y[0] || x[1] - y[1]; });
    const rows = ids.map(id => { const p = id.split('-'); return [id, '第' + p[0] + '排', '第' + p[1] + '個', String(seats[id])]; });
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_SEATS.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, HEAD_SEATS.length).setNumberFormat('@').setValues(rows);
    return getSeats();
  }
}

// ── 預設座位：座位 → 座號（例如 5-6 → 多02）；沒有存過就用網站內建的預設 ──
function getDefaultSeats() {
  const sh = getSS().getSheetByName(SHEET_DEFSEAT);
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(r => {
    const id = String(r[0]).trim(), c = String(r[1]).trim();
    if (/^\d+-\d+$/.test(id) && c) out[id] = c;
  });
  return out;
}
function saveDefaultSeats(seats) {
  return withLock(() => {
    const sh = getSheet(SHEET_DEFSEAT, HEAD_DEFSEAT);
    const ids = Object.keys(seats).filter(id => /^\d+-\d+$/.test(id) && seats[id]);
    ids.sort((a, b) => { const x = a.split('-').map(Number), y = b.split('-').map(Number); return x[0] - y[0] || x[1] - y[1]; });
    const rows = ids.map(id => [id, faceCode(seats[id]) || String(seats[id])]);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_DEFSEAT.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, HEAD_DEFSEAT.length).setNumberFormat('@').setValues(rows);
    return getDefaultSeats();
  });
}

// ── 大頭照：檔名開頭是組別＋座號（料05.jpg、料 24 王小明.jpg、多11陳小華.png 都可以）──
function faceCode(name) {
  const m = String(name).normalize('NFKC').match(/^\s*(\D*?)\s*0*(\d+)/);
  return m ? m[1].trim() + ('0' + m[2]).slice(-2) : '';
}
/** 老師在網頁貼上的大頭照資料夾：只讀取，不會改動裡面的檔案 */
function linkedFaceFolder() {
  const id = PropertiesService.getScriptProperties().getProperty('FACE_LINK_ID') || CONFIG.FACE_FOLDER_ID;
  if (!id) return null;
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}
function setFaceFolder(url) {
  const s = String(url || '').trim();
  const m = s.match(/folders\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/) || s.match(/^([\w-]{20,})$/);
  if (!m) throw new Error('看不懂這個連結，請貼上雲端硬碟「資料夾」的連結');
  let folder;
  try { folder = DriveApp.getFolderById(m[1]); } catch (e) { throw new Error('打不開這個資料夾，請確認你的 Google 帳號可以存取'); }
  let count = 0;
  const it = folder.getFiles();
  const byName = faceNameMap();
  while (it.hasNext()) { const f = it.next(); if (/^image\//.test(f.getMimeType()) && fileCode(f.getName(), byName)) count++; }
  PropertiesService.getScriptProperties().setProperty('FACE_LINK_ID', m[1]);
  return { ok: true, name: folder.getName(), count: count };
}
/** 姓名 → 座號（大頭照檔名只寫姓名時用） */
function faceNameMap() {
  const out = {};
  try { getStudents().students.forEach(k => { const m = k.match(/^(\D*?)(\d+)(.*)$/); if (m) out[m[3]] = m[1] + m[2]; }); } catch (e) { /* 沒有名單 */ }
  [CONFIG.TEACHER_PHOTO, CONFIG.TEACHER_NAME].forEach(n => { if (n) out[String(n).replace(/\s+/g, '')] = 'T00'; });
  return out;
}
/** 檔名 → 座號：「料05.jpg」「料 24 王小明.jpg」「王小明.png」都可以 */
function fileCode(fileName, byName) {
  const base = String(fileName).normalize('NFKC').replace(/\.[^.]+$/, '').trim();
  return faceCode(base) || byName[base.replace(/\s+/g, '')] || '';
}
function getFaces(have) {
  const latest = {}, byName = faceNameMap(), unmatched = [];
  // 連結的資料夾＋網頁上傳的「大頭照」資料夾；同一位同學有好幾張時用最新的
  const folders = [linkedFaceFolder(), getFaceFolder()].filter(Boolean);
  folders.filter((f, i) => folders.findIndex(g => g.getId() === f.getId()) === i).forEach(folder => { // 同一個資料夾只讀一次
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (!/^image\//.test(f.getMimeType())) continue;
      const code = fileCode(f.getName(), byName);
      if (!code) { unmatched.push(f); continue; }
      if (!latest[code] || f.getLastUpdated() > latest[code].getLastUpdated()) latest[code] = f;
    }
  });
  // 導師的大頭照：沒有設定 TEACHER_PHOTO（或檔名對不上）時，資料夾裡唯一一張對不到同學的照片就當成導師的
  if (!latest.T00 && unmatched.length === 1) latest.T00 = unmatched[0];
  const faces = {};
  Object.keys(latest).forEach(code => {
    const f = latest[code], t = f.getLastUpdated().getTime();
    if (have[code] === t) return;
    let blob = f.getSize() > 80000 ? f.getThumbnail() : null; // 大張的照片用縮圖
    if (!blob) blob = f.getBlob();
    if (blob.getBytes().length > 1500000) return;
    faces[code] = { t: t, d: 'data:' + (blob.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  });
  const decoT = {};
  return { ok: true, faces: faces, codes: Object.keys(latest), deco: decoMap(decoT), decoT: decoT, fireworks: fireworksList(), weather: weatherList() };
}
function uploadFace(code, data) {
  code = String(code || '');
  if (!/^\D*\d{2}$/.test(code) || !data) throw new Error('大頭照資料不完整');
  const folder = getFaceFolder();
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (faceCode(f.getName()) === code) f.setTrashed(true); }
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', code + '.jpg'));
  return { ok: true, t: f.getLastUpdated().getTime() };
}

// ── 線上選位：狀態存在 Script Properties（分段）＋快取，輪詢時不碰試算表 ──
function selRead() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('SEL');
  if (c) return JSON.parse(c);
  const props = PropertiesService.getScriptProperties();
  const n = Number(props.getProperty('SEL_N') || 0);
  let s = '';
  for (let i = 0; i < n; i++) s += props.getProperty('SEL_' + i) || '';
  const S = s ? JSON.parse(s) : { v: 0, status: 'idle' };
  cache.put('SEL', JSON.stringify(S), 21600);
  return S;
}
function selWrite(S) {
  S.v = (S.v || 0) + 1;
  const s = JSON.stringify(S);
  const props = PropertiesService.getScriptProperties();
  const old = Number(props.getProperty('SEL_N') || 0);
  const parts = {};
  let n = 0;
  for (let i = 0; i < s.length; i += 2500) parts['SEL_' + n++] = s.slice(i, i + 2500); // 每段不超過 9KB
  parts.SEL_N = String(n);
  props.setProperties(parts);
  for (let i = n; i < old; i++) props.deleteProperty('SEL_' + i);
  CacheService.getScriptCache().put('SEL', s, 21600);
  return S;
}
const needsTick = S => S.status === 'open' && S.deadline && Date.now() >= S.deadline;
function selMutate(fn) {
  return withLock(() => {
    const S = selRead(), now = Date.now();
    fn(S, now);
    SelEngine.tick(S, now);
    return selWrite(S);
  });
}
function selFresh() {
  const S = selRead();
  return needsTick(S) ? selMutate(() => {}) : S;
}

function selState(v) {
  const S = selFresh();
  if (v && S.v === v) return { ok: true, same: true, now: Date.now() };
  return { ok: true, sel: S, now: Date.now() };
}
function selTeacher(fn) {
  const S = selMutate((S, now) => { if (!S.status || S.status === 'idle') throw new Error('目前沒有進行選位'); fn(S, now); });
  return { ok: true, sel: S, now: Date.now() };
}
function selLoad(req) {
  const seats = (req.seats || []).map(String).filter(x => /^\d+-\d+$/.test(x));
  if (!seats.length) throw new Error('沒有座位資料');
  const r = readPeople();
  if (!r.source) throw new Error('找不到排名檔：請在「' + CONFIG.FOLDER_NAME + '」資料夾放一份檔名含「排名」或「成績」的試算表（需有「名次」欄）');
  const ranked = r.people.filter(p => !isNaN(p.rank)).sort((a, b) => a.rank - b.rank || a.key.localeCompare(b.key));
  const noRank = r.people.filter(p => isNaN(p.rank));
  const ranks = {};
  ranked.forEach(p => { ranks[p.key] = p.rank; });
  CacheService.getScriptCache().remove('IDMAP');
  const S = withLock(() => {
    const old = selRead();
    return selWrite(SelEngine.create({
      v: old.v, now: Date.now(), seats: seats, source: r.source,
      perTurn: Math.max(0, Number(req.perTurn) || 0), maxWishes: Math.max(0, Math.min(10, Number(req.maxWishes) || 0)),
      order: ranked.concat(noRank).map(p => p.key), ranks: ranks,
      noRank: noRank.map(p => p.key), noId: r.people.filter(p => !p.id).map(p => p.key),
      blocked: old.blocked || [],
    }));
  });
  return { ok: true, sel: S, now: Date.now() };
}
function selCmd(cmd) {
  if (cmd === 'reset') {
    const S = withLock(() => { const old = selRead(); return selWrite({ v: old.v, status: 'idle', blocked: old.blocked || [] }); });
    return { ok: true, sel: S, now: Date.now() };
  }
  if (cmd === 'apply') {
    let seats = {};
    const S = selMutate(S => {
      if (S.status !== 'done') throw new Error('選位結束後才能套用');
      Object.keys(S.picks).forEach(k => { seats[S.picks[k]] = k; });
      S.applied = true;
      const log = getSheet(SHEET_SELLOG, HEAD_SELLOG);
      const now = new Date();
      const rows = S.order.filter(k => S.picks[k]).map((k, i) => [now, i + 1, S.ranks[k] || '', k, S.picks[k], ({ wish: '志願', self: '自選', teacher: '老師指定', auto: '系統分配' })[S.how[k]] || '', S.source]);
      if (rows.length) log.getRange(log.getLastRow() + 1, 1, rows.length, HEAD_SELLOG.length).setValues(rows);
    });
    seats = saveSeats(seats);
    return { ok: true, sel: S, seats: seats, now: Date.now() };
  }
  return selTeacher((S, now) => SelEngine.command(S, cmd, now));
}
function stuState(key, v) {
  const S = selFresh();
  if (v && S.v === v) return { ok: true, same: true, now: Date.now() };
  return { ok: true, sel: SelEngine.view(S, key, Date.now()), now: Date.now() };
}
function stuMutate(key, fn) {
  const S = selMutate((S, now) => { if (!S.status || S.status === 'idle') throw new Error('目前沒有進行選位'); fn(S, now); });
  return { ok: true, sel: SelEngine.view(S, key, Date.now()), now: Date.now() };
}

// ── 檢查紀錄：只保留「不好」；改成其他狀態時會自動刪掉那一列 ──
function saveRecords(rows) {
  return withLock(() => {
    const sh = getRecordsSheet();
    const last = sh.getLastRow();
    const keys = last > 1 ? sh.getRange(2, COL_KEY, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const index = new Map(keys.map((k, i) => [k, i + 2]));
    const updates = [], deletes = [], appends = new Map();
    rows.forEach(r => {
      const row = index.get(r.key);
      if (r.status !== '不好') {
        if (row) deletes.push(row);
        appends.delete(r.key);
        return;
      }
      const note = (r.issue ? '【有狀況】' : '') + (r.note || '');
      const vals = [toDate(r.date), r.item, r.owner, note, '', r.inspector || '', r.key];
      if (row) updates.push({ row: row, vals: vals, photos: r.photos });
      else appends.set(r.key, { vals: vals, photos: r.photos });
    });
    updates.forEach(u => {
      sh.getRange(u.row, 1, 1, u.vals.length).setValues([u.vals]);
      sh.getRange(u.row, COL_PHOTO).setRichTextValue(photoLinks(u.photos));
    });
    if (deletes.length) {
      if (sh.getMaxRows() - deletes.length < 2) sh.insertRowsAfter(sh.getMaxRows(), deletes.length);
      deletes.sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
    }
    if (appends.size) {
      const list = Array.from(appends.values());
      const start = sh.getLastRow() + 1;
      sh.getRange(start, 1, list.length, HEAD_RECORDS.length).setValues(list.map(x => x.vals));
      list.forEach((x, i) => sh.getRange(start + i, COL_PHOTO).setRichTextValue(photoLinks(x.photos)));
      sh.getRange(start, 1, list.length, 1).setNumberFormat('yyyy/mm/dd');
    }
    return { ok: true, saved: rows.length };
  });
}

/** 把多個照片網址變成可點的「照片1、照片2…」（同一格、分行） */
function photoLinks(urls) {
  const list = String(urls || '').split('\n').map(s => s.trim()).filter(Boolean);
  const b = SpreadsheetApp.newRichTextValue().setText(list.map((_, i) => '照片' + (i + 1)).join('\n'));
  let pos = 0;
  list.forEach((u, i) => {
    const t = '照片' + (i + 1);
    b.setLinkUrl(pos, pos + t.length, u);
    pos += t.length + 1;
  });
  return b.build();
}

function uploadPhoto(req) {
  if (!req.data) throw new Error('沒有照片資料');
  const folder = photoFolder();
  const blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType || 'image/jpeg', req.filename || 'photo.jpg');
  const file = folder.createFile(blob);
  if (req.description) file.setDescription(req.description);
  if (CONFIG.SHARE_PHOTOS) {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* 學校帳號可能禁止公開分享 */ }
  }
  return { ok: true, id: file.getId(), url: file.getUrl() };
}

// ── 扣分統計 ──
// 扣分統計的欄位：名單 → 扣分 → 三次段考成績（導師自己填）→ 明細
const SCORE_COLS = ['科別', '座號', '姓名', '整潔不好次數', '整潔', '秩序', '其他', '合計', '第一次段考', '第二次段考', '第三次段考', '明細'];
const EXAM_COL = 9;   // 第一次段考在第 9 欄（I）
const EXAMS = ['第一次段考', '第二次段考', '第三次段考'];
const SHEET_EXAMRANK = '段考排名';
function ensureScoreSheet(withButton) {
  const ss = getSS();
  let sh = ss.getSheetByName(SHEET_SCORE);
  const isNew = !sh;
  if (isNew) sh = ss.insertSheet(SHEET_SCORE, 0);
  if (isNew) {
    sh.getRange('A1').setValue('扣分統計').setFontSize(16).setFontWeight('bold');
    sh.getRange('A3:C3').setValues([['每次「不好」扣', 1, '分']]);
    sh.getRange('A4:C4').setValues([['起始日期', '', '（空白＝不限）']]);
    sh.getRange('A5:C5').setValues([['結束日期', '', '（空白＝不限）']]);
    sh.getRange('B4:B5').setNumberFormat('yyyy/mm/dd');
    sh.getRange('A6').setValue('勾選即計算');
    sh.getRange('B6').insertCheckboxes();
    sh.getRange('A7').setValue('最後計算時間');
    sh.getRange('A3:A7').setFontWeight('bold');
    sh.getRange('B3:B6').setBackground('#fff8db');
    sh.setFrozenRows(SCORE_START_ROW - 1);
  }
  sh.getRange('A2').setValue('合併「檢查紀錄」的整潔「不好」與「加扣分紀錄」（秩序、整潔、其他）。段考成績直接填在 I～K 欄，按「段考排名」就能看到全班排名（多媒、資料各自排名後，依百分比合併）。').setFontColor('#6b7079');
  if (sh.getRange('A8').getValue() !== '段考欄填的是') {
    sh.getRange('A8').setValue('段考欄填的是').setFontWeight('bold').setFontColor(null);
    const b8 = sh.getRange('B8');
    b8.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['分數', '科排名'], true).build()).setBackground('#fff8db');
    if (!b8.getValue()) b8.setValue('分數');
  }
  sh.getRange('C8').setValue('（分數＝越高越好；科排名＝成績單上的科內名次。多媒、資料兩科怎麼混合排序，請看「段考排名」分頁最上面的說明）').setFontColor('#6b7079');
  if (withButton) ensureScoreButtons(sh);
  return sh;
}
/** 三顆按鈕：計算扣分、段考排名、重置扣分統計，並排在 D3 右邊（缺哪顆補哪顆，已經有的移到固定位置）。
 *  手機上的 Google 試算表 App 按不到圖片，請用選單「內掃檢查」 */
function ensureScoreButtons(sh) {
  const BTNS = [['computeScores', 'sum-button.png'], ['showExamRank', 'btn-rank.png'], ['resetScores', 'btn-reset.png']];
  const have = {};
  sh.getImages().forEach(img => { let fn = ''; try { fn = img.getScript(); } catch (e) { /* 沒有指定程式 */ } if (fn) have[fn] = img; });
  const errs = [];
  BTNS.forEach((b, i) => {
    let img = have[b[0]];
    if (!img) {
      try { img = sh.insertImage(CONFIG.SITE_URL + 'assets/' + b[1], 4, 3).assignScript(b[0]); }
      catch (e) { errs.push(b[0] + '：' + (e.message || e)); return; }
    }
    // 固定位置：D3 起，每顆往右 190 像素
    try { img.setWidth(180).setHeight(48).setAnchorCell(sh.getRange(3, 4)).setAnchorCellXOffset(i * 190).setAnchorCellYOffset(0); } catch (e) { errs.push(b[0] + ' 位置：' + (e.message || e)); }
  });
  sh.getRange('D8').setValue(errs.length ? '按鈕建立失敗（請改用選單「內掃檢查」）：' + errs.join('；') : '').setFontColor('#b42318');
}
const resetAt = () => Number(PropertiesService.getScriptProperties().getProperty('SCORE_RESET_AT') || 0);
/** 檢查紀錄的時間：紀錄編號開頭是那一次檢查的開始時間（S20260924-0011…），沒有就用日期 */
function recTime(d, key) {
  const m = String(key || '').match(/^S(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : d.getTime();
}
function computeScores() {
  const ss = getSS();
  const sh = ensureScoreSheet(true);
  const per = Number(sh.getRange('B3').getValue()) || 1;
  const from = sh.getRange('B4').getValue(), to = sh.getRange('B5').getValue();
  const fromT = from instanceof Date ? new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime() : -Infinity;
  const toT = to instanceof Date ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59).getTime() : Infinity;
  const rst = resetAt(); // 按過「重置扣分統計」：只算那之後的（紀錄本身都還在）

  const rec = getRecordsSheet();
  const last = rec.getLastRow();
  const data = last > 1 ? rec.getRange(2, 1, last - 1, HEAD_RECORDS.length).getValues() : [];
  const seen = {}, stats = {};
  data.forEach(r => {
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    const place = String(r[1]), who = String(r[2]).trim();
    if (!who || who === '值日生' || isNaN(d)) return;
    const t = d.getTime();
    if (t < fromT || t > toT || recTime(d, r[6]) < rst) return;
    // 同一天、同一處、同一人只算一次（避免導師與股長重複記錄）
    const k = Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyyMMdd') + '|' + place + '|' + who;
    if (seen[k]) return;
    seen[k] = true;
    const s = stats[who] || (stats[who] = { n: 0, list: [] });
    s.n++;
    s.list.push({ t: t, day: Utilities.formatDate(d, CONFIG.TIMEZONE, 'M/d') });
  });
  // 加扣分紀錄：依類別加總（整潔類併入整潔欄）
  const pts = {};
  const psh = pointsSheet();
  if (psh.getLastRow() > 1) {
    psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
      const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
      const who = String(r[1]).trim(), p = Number(r[2]) || 0, cat = String(r[3]).trim(), reason = String(r[4]).trim(), by = String(r[5]).trim();
      if (!who || !p || isNaN(d)) return;
      const t = d.getTime();
      if (t < fromT || t > toT) return;
      if (rst && (r[6] instanceof Date ? r[6].getTime() : t) < rst) return;
      const s = pts[who] || (pts[who] = { clean: 0, order: 0, other: 0, list: [] });
      if (cat === '整潔') s.clean += p; else if (cat === '秩序') s.order += p; else s.other += p;
      s.list.push({ t: t, text: Utilities.formatDate(d, CONFIG.TIMEZONE, 'M/d') + ' ' + cat + (p > 0 ? '+' : '') + p + ' ' + reason + (by ? '（' + by + '登記）' : '') });
    });
  }

  // 導師填的段考成績：先讀出來（依 科別＋座號＋姓名），重寫時放回去
  const exams = readExamScores(sh);

  let roster = [], className = '', err = '';
  try { const st = getStudents(); roster = st.students; className = st.className; } catch (e) { err = String(e.message || e); }
  Object.keys(stats).concat(Object.keys(pts)).forEach(who => { if (roster.indexOf(who) < 0) roster.push(who); });
  const rows = roster.map(who => {
    const s = stats[who] || { n: 0, list: [] };
    const q = pts[who] || { clean: 0, order: 0, other: 0, list: [] };
    const m = who.match(/^(\D*?)(\d+)(.*)$/) || [who, '', '', who];
    const days = [], count = {};
    s.list.sort((a, b) => a.t - b.t).forEach(x => { if (!count[x.day]) days.push(x.day); count[x.day] = (count[x.day] || 0) + 1; });
    const bad = days.map(dd => (count[dd] > 1 ? dd + '(' + count[dd] + ')' : dd)).join('、');
    const clean = -s.n * per + q.clean;
    const total = clean + q.order + q.other;
    const detail = (bad ? '整潔不好：' + bad : '') + (q.list.length ? (bad ? '\n' : '') + q.list.sort((a, b) => a.t - b.t).map(x => x.text).join('\n') : '');
    const ex = exams[m[1] + '|' + m[2] + '|' + m[3]] || ['', '', ''];
    return [m[1], m[2], m[3], s.n, clean, q.order, q.other, total, ex[0], ex[1], ex[2], detail];
  });

  const W = SCORE_COLS.length;
  if (className) sh.getRange('A1').setValue('扣分統計（' + className + '）');
  sh.getRange(SCORE_START_ROW - 1, 1, 1, W).setValues([SCORE_COLS]).setFontWeight('bold').setBackground('#ede7fb');
  sh.getRange(SCORE_START_ROW - 1, EXAM_COL, 1, 3).setBackground('#dff3ea');
  sh.setColumnWidth(1, 50); sh.setColumnWidth(2, 50); sh.setColumnWidth(3, 90); sh.setColumnWidth(W, 360);
  for (let c = EXAM_COL; c < EXAM_COL + 3; c++) sh.setColumnWidth(c, 90);
  const lr = sh.getLastRow(), lc = Math.max(W, sh.getLastColumn());
  if (lr >= SCORE_START_ROW) {
    const old = sh.getRange(SCORE_START_ROW, 1, lr - SCORE_START_ROW + 1, lc);
    old.clearContent(); old.setBackground(null).setFontColor(null);
  }
  if (rows.length) {
    const rg = sh.getRange(SCORE_START_ROW, 1, rows.length, W);
    rg.setNumberFormat('@').setValues(rows).setVerticalAlignment('top');
    sh.getRange(SCORE_START_ROW, 4, rows.length, 5).setNumberFormat('+0;-0;0');
    sh.getRange(SCORE_START_ROW, 4, rows.length, 1).setNumberFormat('0');
    sh.getRange(SCORE_START_ROW, 8, rows.length, 1).setFontWeight('bold');
    sh.getRange(SCORE_START_ROW, EXAM_COL, rows.length, 3).setNumberFormat('0.##').setBackground('#f3fbf7')
      .setValues(rows.map(r => [r[8], r[9], r[10]]));
    sh.getRange(SCORE_START_ROW, W, rows.length, 1).setWrap(true);
    // 合計為負的標淺紅色，正的標淺綠色（段考欄不變色）
    rows.forEach((r, i) => {
      if (r[7] < 0) sh.getRange(SCORE_START_ROW + i, 1, 1, 8).setBackground('#fde8e8');
      else if (r[7] > 0) sh.getRange(SCORE_START_ROW + i, 1, 1, 8).setBackground('#e6f6ec');
    });
  } else {
    sh.getRange(SCORE_START_ROW, 1).setValue('（讀不到學生名單' + (err ? '：' + err : '') + '）');
  }
  sh.getRange('B7').setValue(new Date()).setNumberFormat('yyyy/mm/dd hh:mm');
  sh.getRange('D7').setValue(rst ? '上次重置：' + Utilities.formatDate(new Date(rst), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm') + '（只算這之後的；所有紀錄仍保留在「加扣分紀錄」「檢查紀錄」）' : '').setFontColor('#b54708');
  sh.getRange('B6').setValue(false);
  const hit = rows.filter(r => r[7] < 0).length;
  try { ss.toast('已完成加總：全班 ' + rows.length + ' 人，' + hit + ' 人合計為負分', '內掃檢查', 4); } catch (e) { /* 從網頁呼叫時沒有畫面 */ }
}
/** 讀扣分統計裡的段考成績：{ '多|04|陳彥方': [第一次, 第二次, 第三次] } */
function readExamScores(sh) {
  const out = {};
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < SCORE_START_ROW || lc < 3) return out;
  const head = sh.getRange(SCORE_START_ROW - 1, 1, 1, lc).getDisplayValues()[0].map(x => String(x).trim());
  const cols = EXAMS.map(n => head.indexOf(n));
  if (cols.every(c => c < 0)) return out;
  sh.getRange(SCORE_START_ROW, 1, lr - SCORE_START_ROW + 1, lc).getValues().forEach(r => {
    const k = String(r[0]).trim() + '|' + String(r[1]).trim() + '|' + String(r[2]).trim();
    const v = cols.map(c => (c >= 0 && r[c] !== '' && r[c] != null ? r[c] : ''));
    if (v.some(x => x !== '')) out[k] = v;
  });
  return out;
}
/** 段考排名（方法 A）：每次段考先在各科內排名（多媒、資料分開），換成百分比（科內名次 ÷ 該科人數），
 *  再依百分比排出全班名次；總名次依三次百分比的平均。latest＝最近一次有成績的段考（選位與前五名獎勵用這個） */
function examRanks() {
  const sh = getSS().getSheetByName(SHEET_SCORE);
  if (!sh) return null;
  const byRank = String(sh.getRange('B8').getValue()).indexOf('排名') >= 0; // 填的是科排名（越小越好）
  const ex = readExamScores(sh);
  const list = Object.keys(ex).map(k => {
    const p = k.split('|');
    return { key: p[0] + p[1] + p[2], dept: p[0], no: p[1], name: p[2], s: ex[k].map(v => (v === '' || isNaN(Number(v)) ? null : Number(v))) };
  });
  const has = [0, 1, 2].map(i => list.some(x => x.s[i] != null));
  if (!has.some(Boolean)) return null;
  // 依數值排名：同值同名次（1、1、3）；asc＝小的在前
  const rankBy = (arr, get, asc) => {
    const got = arr.filter(x => get(x) != null).sort((a, b) => (asc ? get(a) - get(b) : get(b) - get(a)));
    const r = {};
    got.forEach((x, i) => { r[x.key] = i && get(got[i - 1]) === get(x) ? r[got[i - 1].key] : i + 1; });
    return r;
  };
  const depts = [...new Set(list.map(x => x.dept))];
  const cuts = examCuts();
  const pts = periodPoints(cuts);
  const W = Number(CONFIG.RANK_POINT_WEIGHT) || 0;
  const per = [0, 1, 2].map(i => {
    const deptRank = {}, pct = {}, bonus = {}, score = {};
    if (!has[i]) return { deptRank: deptRank, pct: pct, bonus: bonus, score: score, rank: {} };
    depts.forEach(d => {
      const g = list.filter(x => x.dept === d && x.s[i] != null);
      const r = byRank ? Object.fromEntries(g.map(x => [x.key, x.s[i]])) : rankBy(g, x => x.s[i], false);
      g.forEach(x => { deptRank[x.key] = r[x.key]; pct[x.key] = r[x.key] / g.length; });
    });
    // 綜合分數＝(1 − 百分比) × 100 ＋ 期間加扣分 × 權重；班名次依綜合分數（越高越前面）
    list.forEach(x => {
      if (pct[x.key] == null) return;
      bonus[x.key] = (pts[i][x.key] || 0);
      score[x.key] = Math.round(((1 - pct[x.key]) * 100 + bonus[x.key] * W) * 1e4) / 1e4;
    });
    return { deptRank: deptRank, pct: pct, bonus: bonus, score: score, rank: rankBy(list, x => (score[x.key] == null ? null : score[x.key]), false) };
  });
  list.forEach(x => {
    const v = [0, 1, 2].map(i => per[i].pct[x.key]).filter(y => y != null);
    x.avgPct = v.length ? v.reduce((t, y) => t + y, 0) / v.length : null;
  });
  const overall = rankBy(list, x => (x.avgPct == null ? null : Math.round(x.avgPct * 1e6) / 1e6), true);
  const latest = has.lastIndexOf(true);
  return { list: list, per: per, overall: overall, latest: latest, latestRank: per[latest].rank, label: EXAMS[latest], byRank: byRank, cuts: cuts };
}
/** 各次段考的結算時間（毫秒）；還沒結算的是 0 */
function examCuts() {
  const props = PropertiesService.getScriptProperties();
  return [0, 1, 2].map(i => Number(props.getProperty('EXAM_CUT_' + (i + 1)) || 0));
}
/** 加扣分依「登記時間」分到各次段考：第 N 次＝(第 N−1 次結算, 第 N 次結算]，還沒結算的算到現在 */
function periodPoints(cuts) {
  const out = [{}, {}, {}];
  const psh = pointsSheet();
  if (psh.getLastRow() < 2) return out;
  psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
    const who = String(r[1]).trim(), p = Number(r[2]) || 0;
    const t = r[6] instanceof Date ? r[6].getTime() : r[0] instanceof Date ? r[0].getTime() : 0;
    if (!who || !p || !t) return;
    let i = 0;
    while (i < 2 && cuts[i] && t > cuts[i]) i++;
    out[i][who] = (out[i][who] || 0) + p;
  });
  return out;
}
/** 現場選位用：依第 N 次段考的班名次排好的名單（沒有成績的放最後） */
function rankOrder(who, exam) {
  if (!who.teacher && !cadreRoles(who.key).some(r => /^副?班長$/.test(String(r).trim()))) throw new Error('只有導師、班長、副班長可以使用');
  const i = Math.max(0, Math.min(2, Number(exam) || 0));
  const R = examRanks();
  const all = getStudents().students;
  if (!R || !Object.keys(R.per[i].rank).length) throw new Error(EXAMS[i] + '還沒有成績，請先在「扣分統計」填成績並按「段考排名」');
  const rk = R.per[i].rank;
  const ranked = all.filter(k => rk[k]).sort((a, b) => rk[a] - rk[b] || a.localeCompare(b));
  return { ok: true, order: ranked.concat(all.filter(k => !rk[k])), noRank: all.filter(k => !rk[k]), label: EXAMS[i] + '班名次', url: rankSheetUrl() };
}
/** 按鈕「段考排名」：更新「段考排名」工作表並切換過去；也會依最近一次段考發前五名的交換位置卡 */
function showExamRank() {
  const ss = getSS();
  let R = examRanks();
  if (R && !R.cuts[R.latest]) { // 第一次排這次段考：記下結算時間，之後的加扣分算到下一次段考
    PropertiesService.getScriptProperties().setProperty('EXAM_CUT_' + (R.latest + 1), String(Date.now()));
    R = examRanks();
  }
  if (!R) { try { SpreadsheetApp.getUi().alert('「扣分統計」的 I～K 欄（第一次～第三次段考）還沒有成績。'); } catch (e) { /* 沒有畫面 */ } return; }
  let sh = ss.getSheetByName(SHEET_EXAMRANK);
  if (!sh) sh = ss.insertSheet(SHEET_EXAMRANK, 1);
  sh.clear();
  // 每次段考 4 欄，標題都寫明是第幾次（第一次 科內名次、第一次 百分比、第一次 班名次…）
  const head = ['總名次', '科別', '座號', '姓名', '平均百分比'].concat(EXAMS.reduce((a, n) => {
    const w = n.replace('段考', '');
    return a.concat([n + (R.byRank ? '（科排名）' : '（分數）'), w + ' 科內名次', w + ' 百分比', w + ' 期間加扣分', w + ' 班名次']);
  }, []));
  const rows = R.list.slice().sort((a, b) => (R.overall[a.key] || 999) - (R.overall[b.key] || 999) || a.key.localeCompare(b.key))
    .map(x => [R.overall[x.key] || '', x.dept, x.no, x.name, x.avgPct == null ? '' : x.avgPct]
      .concat([0, 1, 2].reduce((a, i) => a.concat([x.s[i] == null ? '' : x.s[i], R.per[i].deptRank[x.key] || '', R.per[i].pct[x.key] == null ? '' : R.per[i].pct[x.key],
        R.per[i].bonus[x.key] == null ? '' : R.per[i].bonus[x.key], R.per[i].rank[x.key] || '']), [])));
  sh.getRange(1, 1).setValue('段考排名（' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm') + ' 更新）').setFontSize(14).setFontWeight('bold');
  // 排名方式說明（兩科考的科目不同，分數不能直接比，所以用百分比混合排序）
  const note = [
    '【全班兩科混合排序的方式】',
    '多媒科和資料科段考的科目不一樣，分數不能直接互相比較，所以用「百分比」把兩科放在一起排：',
    '① 科內排名：每次段考，多媒科的同學只和多媒科比、資料科的同學只和資料科比，排出「科內名次」（同分同名次）。' + (R.byRank ? '目前「扣分統計」B8 選的是「科排名」，所以直接用填進去的科內名次。' : ''),
    '② 換成百分比：百分比＝科內名次 ÷ 該科有成績的人數。例如多媒 18 人中第 3 名＝16.7%；資料 26 人中第 5 名＝19.2%。百分比越小越前面。',
    '③ 班名次＝段考表現＋那段期間的加扣分：綜合分數＝(100 − 百分比) ＋ 期間加扣分 × ' + (Number(CONFIG.RANK_POINT_WEIGHT) || 0) + '，由高到低排。（加扣分 1 分≈往前或往後 1 個百分點）',
    '　期間：第一次段考＝開學～第一次按「段考排名」的時間；第二次＝那之後～第二次段考第一次按「段考排名」；第三次以此類推。' + periodText(R.cuts),
    '④ 總名次：把已經有成績的各次段考百分比平均，再由小到大排。',
    '例子：多媒某同學 70 分，是多媒第 1 名（18 人，5.6%）；資料某同學 90 分，是資料第 2 名（26 人，7.7%）→ 多媒這位同學排在前面，因為他在自己科裡的表現比較前面。',
    '用途：線上選位的順序、前五名交換位置卡（第一名 2 張、第二～五名各 1 張），都依最近一次段考（' + R.label + '）的「班名次」。',
    '成績填在「扣分統計」的 I～K 欄；B8 可以選填「分數」（越高越好）或「科排名」（成績單上的科內名次）。',
  ].join('\n');
  sh.getRange(2, 1, 1, head.length).merge().setWrap(true).setVerticalAlignment('top').setFontColor('#3d4250').setBackground('#f6f7fb');
  const n1 = note.indexOf('】') + 1; // 標題粗體
  sh.getRange(2, 1).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(note).setTextStyle(0, n1, SpreadsheetApp.newTextStyle().setBold(true).build()).build());
  sh.setRowHeight(2, 230);
  sh.getRange(3, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#dff3ea').setWrap(true).setVerticalAlignment('middle');
  ['#e3edff', '#fff1d6', '#f3e3ff'].forEach((c, i) => sh.getRange(3, 6 + i * 5, 1, 5).setBackground(c)); // 三次段考用不同底色分開
  sh.setRowHeight(3, 36);
  if (rows.length) {
    sh.getRange(4, 1, rows.length, head.length).setValues(rows);
    sh.getRange(4, 5, rows.length, 1).setNumberFormat('0.0%');
    [0, 1, 2].forEach(i => { sh.getRange(4, 8 + i * 5, rows.length, 1).setNumberFormat('0.0%'); sh.getRange(4, 9 + i * 5, rows.length, 1).setNumberFormat('+0;-0;0'); });
  }
  sh.getRange(4, 1, Math.max(1, rows.length), 1).setFontWeight('bold');
  rows.forEach((r, i) => { if (r[0] && r[0] <= 5) sh.getRange(4 + i, 1, 1, head.length).setBackground('#fff4cc'); });
  sh.setFrozenRows(3);
  try { grantRankCards(true); } catch (e) { Logger.log('發卡失敗：' + e); }
  try { publishRankCopy(head, rows, note); } catch (e) { Logger.log('唯讀排名表更新失敗：' + e); }
  ss.setActiveSheet(sh);
  try { ss.toast('已排出 ' + rows.length + ' 人的名次', '段考排名', 4); } catch (e) { /* 從編輯器執行 */ }
}
/** 唯讀的排名表：另一份試算表（知道連結的人只能檢視），只放名次、百分比、期間加扣分，不放分數和身分證字號。
 *  每次按「段考排名」都會更新；現場選位畫面會附上連結 */
function publishRankCopy(head, rows, note) {
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('PUBLIC_RANK_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(CONFIG.CLASS_NAME + ' 段考班名次（唯讀）');
    const f = DriveApp.getFileById(ss.getId());
    try { f.moveTo(getRootFolder()); } catch (e) { /* 留在我的雲端硬碟 */ }
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // 只能檢視
    f.setShareableByEditors(false);
    props.setProperty('PUBLIC_RANK_ID', ss.getId());
  }
  // 拿掉分數欄（第 6、11、16 欄：各次段考的分數），其他照抄
  const drop = new Set([5, 10, 15]);
  const keep = (arr) => arr.filter((_, i) => !drop.has(i));
  const h = keep(head), data = rows.map(keep);
  const sh = ss.getSheets()[0];
  sh.clear();
  sh.setName('班名次');
  sh.getRange(1, 1).setValue(CONFIG.CLASS_NAME + ' 段考班名次（' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm') + ' 更新，只供檢視）').setFontSize(14).setFontWeight('bold');
  sh.getRange(2, 1, 1, h.length).merge().setValue(note.replace(/成績填在.*$/m, '').trim()).setWrap(true).setVerticalAlignment('top').setBackground('#f6f7fb');
  sh.setRowHeight(2, 230);
  sh.getRange(3, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#dff3ea').setWrap(true);
  ['#e3edff', '#fff1d6', '#f3e3ff'].forEach((c, i) => sh.getRange(3, 6 + i * 4, 1, 4).setBackground(c));
  if (data.length) {
    sh.getRange(4, 1, data.length, h.length).setValues(data);
    sh.getRange(4, 5, data.length, 1).setNumberFormat('0.0%');
    [0, 1, 2].forEach(i => { sh.getRange(4, 7 + i * 4, data.length, 1).setNumberFormat('0.0%'); sh.getRange(4, 8 + i * 4, data.length, 1).setNumberFormat('+0;-0;0'); });
  }
  sh.setFrozenRows(3);
  return ss.getUrl();
}
function rankSheetUrl() {
  const id = PropertiesService.getScriptProperties().getProperty('PUBLIC_RANK_ID');
  return id ? 'https://docs.google.com/spreadsheets/d/' + id + '/view' : '';
}
/** 試算表選單：清除導師測試時買的、送出去的配件，和導師用過的特殊道具（煙火、小太陽、抽籤卡…）。
 *  不會真的刪掉：整列搬到「已清除的測試資料」工作表，需要時可以搬回去 */
function clearTeacherTestItems() {
  const T = CONFIG.TEACHER_NAME;
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* 從編輯器執行 */ }
  const inv = getSheet(SHEET_INV, HEAD_INV), sp = getSheet(SHEET_SPEND, HEAD_SPEND);
  const invRowsAll = inv.getLastRow() > 1 ? inv.getRange(2, 1, inv.getLastRow() - 1, HEAD_INV.length).getValues() : [];
  const spRowsAll = sp.getLastRow() > 1 ? sp.getRange(2, 1, sp.getLastRow() - 1, HEAD_SPEND.length).getValues() : [];
  const invHit = invRowsAll.map((r, i) => (String(r[5]) === T || String(r[1]) === T ? i : -1)).filter(i => i >= 0); // 導師買的（含送人的）、導師擁有的
  const spHit = spRowsAll.map((r, i) => (String(r[1]) === T ? i : -1)).filter(i => i >= 0);                         // 導師用過的特殊道具
  if (!invHit.length && !spHit.length) { if (ui) ui.alert('沒有找到導師測試的道具。'); return; }
  const who = {};
  invHit.forEach(i => { if (String(invRowsAll[i][1]) !== T) who[String(invRowsAll[i][1])] = 1; });
  const msg = '找到：\n・導師買的／送出去的配件 ' + invHit.length + ' 個' + (Object.keys(who).length ? '（目前在 ' + Object.keys(who).join('、') + ' 身上）' : '') +
    '\n・導師用過的特殊道具 ' + spHit.length + ' 筆（煙火、小太陽、小雨傘、抽籤卡…）\n\n要清除嗎？（會搬到「已清除的測試資料」工作表，不是真的刪掉）';
  if (ui && ui.alert('清除導師測試的道具', msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  withLock(() => {
    const bin = getSheet('已清除的測試資料', ['清除時間', '來源工作表', '原本的資料…']);
    const now = new Date();
    const moved = invHit.map(i => [now, SHEET_INV].concat(invRowsAll[i])).concat(spHit.map(i => [now, SHEET_SPEND].concat(spRowsAll[i])));
    const w = Math.max.apply(null, moved.map(r => r.length));
    bin.getRange(bin.getLastRow() + 1, 1, moved.length, w).setValues(moved.map(r => r.concat(Array(w - r.length).fill(''))));
    // 由下往上刪，列號才不會跑掉
    invHit.slice().reverse().forEach(i => inv.deleteRow(i + 2));
    spHit.slice().reverse().forEach(i => sp.deleteRow(i + 2));
  });
  CacheService.getScriptCache().remove('ACC_CATALOG');
  if (ui) ui.alert('完成：已清除 ' + invHit.length + ' 個配件、' + spHit.length + ' 筆特殊道具。同學的大頭照裝飾會自動拿掉這些配件。');
}
function periodText(cuts) {
  const f = t => Utilities.formatDate(new Date(t), CONFIG.TIMEZONE, 'M/d HH:mm');
  const parts = cuts.map((c, i) => c ? EXAMS[i] + '結算於 ' + f(c) : '').filter(Boolean);
  return parts.length ? '（' + parts.join('；') + '）' : '';
}
/** 試算表選單：重新設定段考結算時間（下次按「段考排名」時重新記） */
function resetExamCuts() {
  const props = PropertiesService.getScriptProperties();
  ['EXAM_CUT_1', 'EXAM_CUT_2', 'EXAM_CUT_3'].forEach(k => props.deleteProperty(k));
  try { SpreadsheetApp.getUi().alert('已清除三次段考的結算時間。下次按「段考排名」時，最近一次段考會以那時候重新結算。'); } catch (e) { /* 編輯器 */ }
}
/** 按鈕「重置扣分統計」：之後只算重置以後的扣分／加扣分（紀錄永遠保留，不會刪除） */
function resetScores() {
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { /* 從編輯器執行 */ }
  if (ui && ui.alert('重置扣分統計', '重置後，「扣分統計」和 App 上的加扣分會從現在重新開始算。\n「加扣分紀錄」「檢查紀錄」的每一筆都會永遠保留，不會刪除。\n\n確定要重置嗎？', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('SCORE_RESET_AT', String(Date.now()));
  computeScores();
}

// ── helpers ──
function getSS() {
  return CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function getSheet(name, head) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#ede7fb');
    sh.setFrozenRows(1);
  }
  return sh;
}

function getRecordsSheet() {
  let sh = getSS().getSheetByName(SHEET_RECORDS);
  if (!sh) {
    sh = getSheet(SHEET_RECORDS, HEAD_RECORDS);
    sh.hideColumns(COL_KEY);
    sh.setColumnWidth(2, 150); sh.setColumnWidth(3, 120); sh.setColumnWidth(4, 280);
  }
  return sh;
}

function toDate(s) {
  try { return Utilities.parseDate(String(s), CONFIG.TIMEZONE, 'yyyy/MM/dd'); } catch (e) { return new Date(); }
}

function getRootFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 資料夾被刪除，重新建立 */ }
  }
  const it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function getFaceFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName(CONFIG.FACE_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(CONFIG.FACE_FOLDER);
}

/** 掃地檢查的照片：全部放在「內掃檢查」資料夾（不分日期，檔名開頭就是日期時間） */
function photoFolder() {
  const root = getRootFolder();
  const it = root.getFoldersByName(CONFIG.PHOTO_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(CONFIG.PHOTO_FOLDER);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ── 選位引擎 ───────────────────────────────────────────────
 * 這一段和 gas/Code.gs 最下方的 SelEngine 是同一份程式，修改時兩邊要一起改。
 * （網頁的測試模式在手機上模擬；正式選位由 Google Apps Script 執行）
 *
 * 規則：
 *   1. 依段考名次排出順序（order）。
 *   2. 輪到某位同學時，如果他預選的志願還有空位，立刻自動分配第一個還空著的志願。
 *   3. 沒有志願（或志願都被選走）就等他自己點，限時 perTurn 秒。
 *   4. 超過時間：第一次移到最後面，第二次由系統隨機分配。
 * 狀態 status：idle 沒有選位 → ready 可預選志願 → open 選位中 ⇄ paused 暫停 → done 結束
 */
var SelEngine = (function () {
  function taken(S) {
    var t = {};
    Object.keys(S.picks).forEach(function (k) { t[S.picks[k]] = k; });
    return t;
  }
  function isFree(S, seat, t) { return S.seats.indexOf(seat) >= 0 && S.blocked.indexOf(seat) < 0 && !t[seat]; }
  function freeSeats(S) { var t = taken(S); return S.seats.filter(function (x) { return isFree(S, x, t); }); }
  function setWaiting(S, k, now) {
    if (S.waiting === k) return;
    S.waiting = k;
    S.turnAt = now;
    S.deadline = S.perTurn > 0 ? now + S.perTurn * 1000 : 0;
  }
  function moveToEnd(S, i) { var k = S.order.splice(i, 1)[0]; S.order.push(k); }

  function create(o) {
    return {
      v: o.v || 0, status: 'ready', source: o.source || '', loadedAt: o.now,
      seats: o.seats, perTurn: o.perTurn, maxWishes: o.maxWishes,
      order: o.order, ranks: o.ranks || {}, noRank: o.noRank || [], noId: o.noId || [],
      picks: {}, how: {}, wishes: {}, blocked: (o.blocked || []).filter(function (x) { return o.seats.indexOf(x) >= 0; }),
      deferred: {}, turn: 0, waiting: '', turnAt: 0, deadline: 0, remain: 0, applied: false,
    };
  }

  // 往下處理：已有座位的跳過、有志願的自動分配，直到需要等某位同學自己選
  function advance(S, now) {
    if (S.status !== 'open') return;
    var t = taken(S);
    while (S.turn < S.order.length) {
      var k = S.order[S.turn];
      if (S.picks[k]) { S.turn++; continue; }
      var ws = S.wishes[k] || [], w = '';
      for (var i = 0; i < ws.length; i++) if (isFree(S, ws[i], t)) { w = ws[i]; break; }
      if (w) { S.picks[k] = w; S.how[k] = 'wish'; t[w] = k; S.turn++; continue; }
      if (!S.seats.some(function (x) { return isFree(S, x, t); })) break; // 沒有空位了
      setWaiting(S, k, now);
      return;
    }
    S.status = 'done'; S.waiting = ''; S.deadline = 0;
  }

  // 時間到：第一次移到最後，第二次隨機分配
  function tick(S, now) {
    if (S.status !== 'open' || !S.deadline || now < S.deadline) return false;
    var k = S.order[S.turn];
    if (!S.deferred[k]) {
      S.deferred[k] = 1;
      moveToEnd(S, S.turn);
    } else {
      var f = freeSeats(S);
      if (f.length) { S.picks[k] = f[Math.floor(Math.random() * f.length)]; S.how[k] = 'auto'; }
      S.turn++;
    }
    S.waiting = '';
    advance(S, now);
    return true;
  }

  function pick(S, k, seat, now) {
    if (S.status !== 'open') throw new Error(S.status === 'paused' ? '選位暫停中，請稍候' : '現在不能選位');
    if (S.picks[k]) throw new Error('你已經有座位了');
    if (S.waiting !== k) throw new Error('還沒輪到你');
    if (!isFree(S, seat, taken(S))) throw new Error('這個座位已經被選走了');
    S.picks[k] = seat; S.how[k] = 'self';
    S.turn++; S.waiting = '';
    advance(S, now);
  }

  function setWishes(S, k, list) {
    if (['ready', 'open', 'paused'].indexOf(S.status) < 0) throw new Error('現在不能填志願');
    if (S.order.indexOf(k) < 0) throw new Error('你不在這次的選位名單中');
    if (S.picks[k]) throw new Error('你已經有座位了');
    var out = [];
    (list || []).forEach(function (x) {
      x = String(x);
      if (out.length < S.maxWishes && S.seats.indexOf(x) >= 0 && S.blocked.indexOf(x) < 0 && out.indexOf(x) < 0) out.push(x);
    });
    S.wishes[k] = out;
  }

  // 老師指定座位（seat 空白＝取消這位同學的座位，選位中會讓他馬上重選）
  function assign(S, k, seat, now) {
    if (S.order.indexOf(k) < 0) throw new Error('名單中沒有這位同學');
    if (seat) {
      var t = taken(S);
      if (S.seats.indexOf(seat) < 0) throw new Error('沒有這個座位');
      if (t[seat] && t[seat] !== k) throw new Error('這個座位已經有人了');
      S.blocked = S.blocked.filter(function (x) { return x !== seat; });
      S.picks[k] = seat; S.how[k] = 'teacher';
      if (S.waiting === k) { S.turn++; S.waiting = ''; }
    } else {
      delete S.picks[k]; delete S.how[k];
      var i = S.order.indexOf(k);
      if ((S.status === 'open' || S.status === 'paused') && i < S.turn) {
        S.order.splice(i, 1); S.turn--;
        S.order.splice(S.turn, 0, k);
        S.waiting = '';
        S.remain = S.perTurn * 1000;
      }
    }
    advance(S, now);
  }

  // 座位「不開放」切換
  function block(S, seat) {
    if (S.seats.indexOf(seat) < 0) return;
    if (taken(S)[seat]) throw new Error('這個座位已經有人了');
    var i = S.blocked.indexOf(seat);
    if (i >= 0) { S.blocked.splice(i, 1); return; }
    S.blocked.push(seat);
    Object.keys(S.wishes).forEach(function (k) { S.wishes[k] = S.wishes[k].filter(function (x) { return x !== seat; }); });
  }

  function command(S, c, now) {
    if (c === 'open') {
      if (S.status !== 'ready') throw new Error('選位已經開始了');
      S.status = 'open'; S.turn = 0; S.waiting = '';
      advance(S, now);
    } else if (c === 'pause') {
      if (S.status !== 'open') return;
      S.status = 'paused';
      S.remain = S.deadline ? Math.max(0, S.deadline - now) : 0;
      S.deadline = 0;
    } else if (c === 'resume') {
      if (S.status !== 'paused') return;
      S.status = 'open';
      if (S.waiting && S.perTurn > 0) S.deadline = now + Math.max(S.remain, 10000);
      advance(S, now);
    } else if (c === 'skip') {
      if ((S.status !== 'open' && S.status !== 'paused') || S.turn >= S.order.length) return;
      moveToEnd(S, S.turn);
      S.waiting = ''; S.remain = S.perTurn * 1000;
      advance(S, now);
    } else if (c === 'end') {
      S.status = 'done'; S.waiting = ''; S.deadline = 0;
    } else {
      throw new Error('未知的指令：' + c);
    }
  }

  // 給學生看的資料：不包含其他人的名次與順序
  function view(S, k, now) {
    if (!S || !S.status || S.status === 'idle') return { v: S ? S.v || 0 : 0, status: 'idle', now: now };
    var my = S.order.indexOf(k);
    return {
      v: S.v, status: S.status, now: now, applied: !!S.applied,
      total: S.order.length, turnPos: S.turn + 1, picked: Object.keys(S.picks).length,
      myPos: my + 1, ahead: my >= 0 ? Math.max(0, my - S.turn) : 0,
      myTurn: S.status === 'open' && S.waiting === k,
      deadline: S.waiting === k ? S.deadline : 0,
      remain: S.waiting === k ? S.remain : 0,
      deferred: !!S.deferred[k],
      taken: taken(S), blocked: S.blocked, seats: S.seats,
      myWishes: S.wishes[k] || [], myPick: S.picks[k] || '', myHow: S.how[k] || '',
      maxWishes: S.maxWishes, perTurn: S.perTurn,
    };
  }

  return { create: create, advance: advance, tick: tick, pick: pick, setWishes: setWishes, assign: assign, block: block, command: command, view: view, taken: taken, freeSeats: freeSeats };
})();
