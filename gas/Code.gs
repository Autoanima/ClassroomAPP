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
  GUEST_CODE: '',                      // 任課老師登入碼：請改在 App「設定 → 任課老師登入碼」設定（重新貼上程式也不會不見）；這裡只有在 App 從來沒設定過時才會用到
  TEACHER_PHOTO: '',                   // 導師大頭照的檔名（不含 .png），放在大頭照資料夾；只有在座位表點「講桌／講台」時才會顯示
  OUTDOOR_SHEET_ID: '',                // 舊的「外掃區檢查」App 試算表 ID：只用來第一次匯入外掃工作分配，以及選單「同步到外掃 App」
  SITE_URL: 'https://autoanima.github.io/ClassroomAPP/',   // 網站網址（讀取內建配件清單 assets/acc/catalog.json）
  ACC_FOLDER: '配件',                 // 「內掃檢查」資料夾裡放配件 PNG 的子資料夾；檔名「名稱_價格.png」
  ACC_DEFAULT_PRICE: 3,               // 檔名沒寫價格時的價格
  ACC_DAYS: 10,                       // 配件有效天數（從購買當天算起，週末、假日都算）
  STEAL_PRICE: 10,                    // 竊盜卡：奪取別人的配件
  FIREWORK_PRICE: 1,                  // 煙火：放在某位同學的座位上，大家下次打開 App 時會看到
  SWAP_PRICE: 100,                    // 交換位置卡：和另一位同學強制對調座位
  RANK_CARDS: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1 }, // 段考排名前五名自動獲得免費交換位置卡（第一名 2 張）；每份新的排名只發一次
  TRANSFER_PRICE: 20,                 // 抽籤轉移卡：設定替身，抽籤抽到自己時由替身上場（次數不限）
  TRANSFER_DAYS: 10,                  // 抽籤轉移卡有效天數
  WEATHER_PRICE: 5,                   // 小太陽卡／小雨傘卡：放在某位同學的座位上方
  WEATHER_DAYS: 5,                    // 小太陽卡／小雨傘卡有效天數（從購買當天算起，週末、假日都算）
  SURE_PRICE: 30,                     // 抽籤必中卡：指定一位同學，下一次抽籤第一位一定是他（只有一次）
  SWAP_BAN_MINUS: 10,
  LEAVE_LATE_DAYS: 3,                 // 請假：登記後超過 3 天還沒上傳假卡＝逾期（自動提醒、標紅色）
  LEAVE_LATE_PER: 0.1,                // 逾期後每一天扣 0.1 分（上傳假卡就停止）
  HW_LATE_PER: 0.1,                   // 繳交追蹤：超過截止沒交，每一天扣 0.1 分（交了就停止；截止後 1 小時也算 1 天）
  ABSENT_PER: 0.1,                    // 掃地檢查「未出席」：另外扣 0.1 分（「不好」照扣分統計 B3 的分數扣）
  PENALTY_PER: 2,                     // 每被扣 2 分，商店點數減 1 點（最少扣到 0 點，不會變負的）
  PENALTY_FROM: '2026/09/26',         // 這天以後的扣分才會扣點數（之前的不算）
  DRAW_BOOST: 0.1,                    // 抽籤加權：每被扣 1 分，被抽中的機率增加 10%
  DRAW_BOOST_TIMES: 3,                // 加權持續接下來的 3 次抽籤
  RANK_POINT_WEIGHT: 1,               // 班名次＝段考表現＋那段期間的加扣分：加扣分 1 分＝百分比 1 個百分點（例如 +3 分≈往前 3%）                 // 「加扣分紀錄」被扣的分數加起來超過這個數，就不能用交換位置卡
  CREATE_PRICE: 20,                   // 創造卡：同學上傳 PNG 變成新商品，預設售價（可以自己改 1–100）
  CREATE_PER_DAY: 3,                  // 每人每天最多創造幾個商品
  FIREWORK_DAYS: 3,                   // 煙火幾天內還會放給還沒看過的人
};

const SHEET_RECORDS = '檢查紀錄';
const HEAD_RECORDS = ['日期', '處所', '負責同學', '說明', '照片', '檢查人', '紀錄編號', '狀態'];
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
const SHEET_BOX = '禮物盒';              // 導師、班長、副班長每週一個驚喜盒（圖片存在「禮物盒」資料夾）
const HEAD_BOX = ['時間', '放禮物的人', '圖片', '編號', '週次'];
const SHEET_BOXOPEN = '禮物盒開啟';
const HEAD_BOXOPEN = ['時間', '同學', '禮物盒編號', '得到'];
const BOX_DAYS = 7;
const SHEET_LUNCH = '訂便當';            // 每週一開放登記，週五中午 12 點截止（登記的是下一週的便當）
const HEAD_LUNCH = ['週次', '同學', '要不要', '登記時間', '已繳費', '繳費登記'];
const LUNCH_BOT = '🍱 訂便當小幫手';
const GIFT_BOT = '🎁 禮物通知';       // 有人送你配件、道具卡時的通知信
const SHEET_DRAW = '抽籤紀錄';          // 大家都看得到最近的抽籤結果；「清空」只是從 App 上藏起來，試算表保留
const HEAD_DRAW = ['時間', '抽籤人', '結果', '抽籤卡事件', '編號'];
const DRAW_DAYS = 30;
const SHEET_FUND = '班費收支';          // 總務登記；刪除只做標記
const HEAD_FUND = ['日期', '品項', '收支', '金額', '說明', '登記人', '登記時間', '編號', '狀態', '收據'];   // 收據：雲端硬碟「班費收據」資料夾的檔案代號（逗號分隔）
const RECEIPT_MAX = 5;
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
const SHOP_OK = { giftCard: 1, shopState: 1, accImages: 1, buyAcc: 1, giftAcc: 1, saveDeco: 1, stealAcc: 1, buyFirework: 1, swapSeatCard: 1, createAcc: 1, delAcc: 1, buyDrawCard: 1, buyWeather: 1 };
const STUDENT_OK = Object.assign({ petAllot: 1, getPets: 1, feedPet: 1, petLook: 1, petImage: 1, checkHistory: 1, getCheckLive: 1, postAppeal: 1, getCheckins: 1, checkin: 1, pointsBoard: 1, delLeaveCard: 1, getHomework: 1, saveHomework: 1, delHomework: 1, markHomework: 1, remindHomework: 1, setLunchAdj: 1, arenaState: 1, arenaChallenge: 1, arenaRespond: 1, arenaReady: 1, arenaProgress: 1, getLeave: 1, addLeave: 1, editLeave: 1, leaveCard: 1, getLeaveCard: 1, cancelLeave: 1, giftBoxImage: 1, getFundReceipt: 1, investState: 1, investOrder: 1, investCancel: 1, getFaceHD: 1, getGiftBoxes: 1, openGiftBox: 1, getLunch: 1, setLunch: 1, getDrawLog: 1, getFund: 1, getMail: 1, sendMail: 1, rankInfo: 1, getBoard: 1, getDuty: 1, setDuty: 1, getRoster: 1, getSeats: 1, getFaces: 1, stuState: 1, stuWish: 1, stuPick: 1 }, SHOP_OK);
// 幹部（自己的身分證字號登入）可以用的動作；環保股長另外可以做掃地檢查
const CADRE_OK = Object.assign({ petAllot: 1, getPets: 1, feedPet: 1, petLook: 1, petImage: 1, checkHistory: 1, getCheckLive: 1, postAppeal: 1, getCheckins: 1, checkin: 1, pointsBoard: 1, delLeaveCard: 1, getHomework: 1, saveHomework: 1, delHomework: 1, markHomework: 1, remindHomework: 1, setLunchAdj: 1, arenaState: 1, arenaChallenge: 1, arenaRespond: 1, arenaReady: 1, arenaProgress: 1, getLeave: 1, addLeave: 1, editLeave: 1, leaveCard: 1, getLeaveCard: 1, cancelLeave: 1, giftBoxImage: 1, getFundReceipt: 1, addFundReceipt: 1, investState: 1, investOrder: 1, investCancel: 1, getFaceHD: 1, getGiftBoxes: 1, openGiftBox: 1, createGiftBox: 1, getLunch: 1, setLunch: 1, setLunchPaid: 1, getDrawLog: 1, addDrawLog: 1, getFund: 1, addFund: 1, delFund: 1, getPacks: 1, startPack: 1, signPack: 1, cancelPack: 1, getMail: 1, sendMail: 1, editPost: 1, rankInfo: 1, rankOrder: 1, saveSeats: 1, saveDefaultSeats: 1, getBoard: 1, addPost: 1, delPost: 1, saveRoster: 1, getDuty: 1, setDuty: 1, getDrawFx: 1, drawUsed: 1, ping: 1, getRoster: 1, getStudents: 1, getSeats: 1, getFaces: 1, selState: 1, addPoints: 1, getPoints: 1, delPoints: 1 }, SHOP_OK);
// 任課老師（不用密碼）：只能抽籤、看座位表
const GUEST_OK = { getPets: 1, petImage: 1, getFaceHD: 1, getGiftBoxes: 1, openGiftBox: 1, getDrawLog: 1, addDrawLog: 1, rankInfo: 1, getBoard: 1, ping: 1, getRoster: 1, getStudents: 1, getSeats: 1, getFaces: 1, accImages: 1, getDrawFx: 1, drawUsed: 1, getDuty: 1 };
const CHECKER_OK = { notifyCheck: 1, saveRecords: 1, uploadPhoto: 1, getCheckLive: 1, setCheckLive: 1 };
const MONITOR_OK = { addDrawLog: 1, getDrawFx: 1, drawUsed: 1 };   // 用學生身分登入的班長、副班長：可以抽籤

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
        : STUDENT_OK[req.action] || (MONITOR_OK[req.action] && isMonitor(who.key));
      if (!ok) return json({ ok: false, error: '沒有權限' });
    } else {
      if (req.token == null || normPw(req.token) !== normPw(CONFIG.TOKEN)) return json({ ok: false, error: '密碼錯誤', code: 'token' });
      who = { teacher: true, key: CONFIG.TEACHER_NAME };
    }
    switch (req.action) {
      case 'ping': return json(ping());
      case 'getRoster': return json({ ok: true, roster: rosterWithOutdoor(), grade: PropertiesService.getScriptProperties().getProperty('CLASS_GRADE') || '' });
      case 'getLeave': return json(getLeave(who));
      case 'getHomework': return json(getHomework(who));
      case 'saveHomework': return json(saveHomework(who, req.item || {}));
      case 'delHomework': return json(delHomework(who, req.id));
      case 'markHomework': return json(markHomework(who, req.id, req.changes || {}));
      case 'remindHomework': return json(remindHomework(who, req.id));
      case 'arenaState': return json(arenaState(who));
      case 'arenaChallenge': return json(arenaChallenge(who, req.to, String(req.subj || '')));
      case 'arenaRespond': return json(arenaRespond(who, req.id, String(req.act || '')));
      case 'arenaReady': return json(arenaReady(who, req.id));
      case 'arenaProgress': return json(arenaProgress(who, String(req.id || ''), req.n, req.ms, req.done));
      case 'addLeave': return json(addLeave(who, req.row || {}));
      case 'leaveCard': return json(leaveCard(who, String(req.id || ''), req.data));
      case 'getLeaveCard': return json(getLeaveCard(who, req.fid));
      case 'delLeaveCard': return json(delLeaveCard(who, String(req.id || ''), String(req.fid || '')));
      case 'setLeaveStatus': return json(setLeaveStatus(who, String(req.id || ''), String(req.status || ''), req.reply));
      case 'cancelLeave': return json(cancelLeave(who, String(req.id || '')));
      case 'remindLeaveCard': return json(remindLeaveCard(who, String(req.id || '')));
      case 'editLeave': return json(editLeave(who, String(req.id || ''), req.row || {}));
      case 'setLeaveRules': return json(setLeaveRules(who, req.text));
      case 'getGuestCode':   // 導師在設定頁看／改任課老師登入碼
        if (!who.teacher) throw new Error('只有導師可以看登入碼');
        return json({ ok: true, code: guestCode() });
      case 'setGuestCode':
        if (!who.teacher) throw new Error('只有導師可以改登入碼');
        return json(setGuestCode(req.code));
      case 'setGrade': {   // 導師改「商?甲」的年級（1、2、3；空白＝?）
        if (!who.teacher) throw new Error('只有導師可以改年級');
        const g = String(req.grade || '');
        if (!/^[123]?$/.test(g)) throw new Error('年級要是 1、2、3');
        PropertiesService.getScriptProperties().setProperty('CLASS_GRADE', g);
        return json({ ok: true, grade: g });
      }
      case 'saveRoster':
        if (!who.teacher && !canEditRoster(who.key)) throw new Error('只有導師、班長、副班長、環保股長可以修改工作分配');
        if (!who.teacher && req.roster) req.roster.inspectors = getRoster().inspectors; // 幹部名單只有導師能改
        return json(saveRoster(req.roster || {}));
      case 'setOutdoorSheet': return json(setOutdoorSheet(req.url));
      case 'getStudents': return json(getStudents());
      case 'saveRecords': return json(saveRecords((req.rows || []).map(r => Object.assign(r, { inspector: who.key }))));
      case 'uploadPhoto': return json(uploadPhoto(req));
      case 'getCheckins': return json(getCheckins(req.date));
      case 'checkin': return json(checkin(who, req.unit, req.place, !!req.clean));
      case 'notifyCheck': return json(notifyCheck(who, req.list));
      case 'postAppeal': return json(postAppeal(who, req.unit, req.place, req.text, req.to));
      case 'getCheckLive': return json(getCheckLive(req.date));
      case 'checkHistory': return json(checkHistory(who, req.owners || []));
      case 'setCheckLive': return json(setCheckLive(who, req.date, req.rows || []));
      case 'addPoints': return json(addPoints(req.rows || [], who));
      case 'getPoints': return json({ ok: true, rows: getPoints(req.days, who) });
      case 'getPets': return json(getPets(who));
      case 'feedPet': return json(feedPet(who, req.id));
      case 'petLook': return json(petLook(who, req.id, req.name, req.data));
      case 'petImage': return json(petImage(req.id));
      case 'petAllot': return json(petAllot(who, req.owner, req.plan || {}));
      case 'pointsBoard': return json(pointsBoard(who));
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
      case 'getGiftBoxes': return json({ ok: true, boxes: getGiftBoxes(who), canMake: canMakeBox(who) });
      case 'openGiftBox': return json(openGiftBox(who, String(req.id || ''), !!req.noImg));
      case 'giftBoxImage': return json(giftBoxImage(String(req.id || '')));
      case 'createGiftBox': return json(createGiftBox(who, req.data));
      case 'getLunch': return json(getLunch(who));
      case 'setLunch': return json(setLunch(who, String(req.choice || '')));
      case 'setLunchAdj': return json(setLunchAdj(who, req.early, req.days));
      case 'setLunchPaid': return json(setLunchPaid(who, String(req.key || ''), !!req.paid));
      case 'getDrawLog': return json({ ok: true, log: getDrawLog() });
      case 'addDrawLog': return json({ ok: true, log: addDrawLog(who, req.k || [], req.fx || []) });
      case 'clearDrawLog': PropertiesService.getScriptProperties().setProperty('DRAW_CLEAR_AT', String(Date.now())); return json({ ok: true, log: [] });
      case 'getFund': return json(getFund());
      case 'addFund': return json(addFund(who, req.row || {}));
      case 'delFund': return json(delFund(who, String(req.id || '')));
      case 'addFundReceipt': return json(addFundReceipt(who, String(req.id || ''), req.data));
      case 'getFundReceipt': return json(getFundReceipt(req.fid));
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
      case 'giftCard': return json(giftCard(who, String(req.card || ''), String(req.to || '')));
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
      case 'getFaceHD': return json(getFaceHD(String(req.code || '')));
      case 'investState': return json(investState(who));
      case 'investOrder': return json(investOrder(who, req.order || {}));
      case 'investCancel': return json(investCancel(who, String(req.id || '')));
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
/** 任課老師登入碼：導師在 App「設定」裡改的（存在指令碼屬性，重新貼上 Code.gs 也不會不見）；沒改過才用 CONFIG.GUEST_CODE */
function guestCode() {
  const p = PropertiesService.getScriptProperties().getProperty('GUEST_CODE');
  return p !== null ? p : CONFIG.GUEST_CODE;
}
function setGuestCode(code) {
  code = String(code || '').trim().slice(0, 30);
  PropertiesService.getScriptProperties().setProperty('GUEST_CODE', code);
  return { ok: true, code: code };
}
function guestLogin(code) {
  const need = guestCode();
  if (need && normPw(code) !== normPw(need)) {
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
  try { withLock(() => clean.filter(r => r[2] > 0).forEach(r => petLay(r[1], r[4], null, r[2]))); } catch (e) { Logger.log('寵物蛋：' + e); }   // 🐾 被加幾分就生幾顆寵物蛋
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

// ── 商店：用加分的點數買大頭照配件（可以自己用或送人），配件有效 10 天 ──
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
/** 從今天起算第 n 天的日期（今天算第 1 天；週末、假日都算） */
function daysLater(n) {
  const t = ymd(new Date()).split('/').map(Number);
  return ymd(new Date(Date.UTC(t[0], t[1] - 1, t[2] + n - 1, 4)));   // 台北中午，不受專案時區影響
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
const timeOf = s => {
  if (s instanceof Date) return s.getTime();
  const str = String(s || '').trim();
  try { return Utilities.parseDate(str, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm').getTime(); } catch (e) { /* 只有日期 */ }
  try { return Utilities.parseDate(str, CONFIG.TIMEZONE, 'yyyy/MM/dd').getTime() + 12 * 3600e3; } catch (e) { return 0; }
};
/** 商店點數：加分、作品收入、紅包 − 花掉的 − 扣分罰點（每扣 PENALTY_PER 分減 1 點，最少扣到 0）。
 *  依時間順序一筆一筆算，這樣「扣到 0 為止」才正確 */
function coinsOf(key, inv) {
  if (key === CONFIG.TEACHER_NAME) return { earned: UNLIMITED, spent: 0, coins: UNLIMITED, income: 0, penalty: 0 };
  inv = inv || invRows();
  const ev = []; // [時間, 種類(0 收入 1 花費 2 扣分), 數量]
  const psh = pointsSheet();
  const from = timeOf(CONFIG.PENALTY_FROM) - 12 * 3600e3;
  let earned = 0, minus = 0;
  if (psh.getLastRow() > 1) psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
    if (String(r[1]).trim() !== key) return;
    const p = Number(r[2]) || 0, t = timeOf(r[6] || r[0]);
    if (p > 0) { earned += p; ev.push([t, 0, p]); }
    else if (p < 0 && t >= from) { minus += -p; ev.push([t, 2, -p]); }
  });
  const sales = salesOf(key, inv);
  const mine = {};
  sales.items.forEach(a => { mine[a.id] = true; });
  inv.filter(x => mine[x.acc] && x.buyer !== CONFIG.TEACHER_NAME).forEach(x => ev.push([timeOf(x.time), 0, x.price]));
  const packs = packsFor(key);
  packs.forEach(x => ev.push([timeOf(x.date), 0, x.points]));
  const invAw = investAwardsFor(key);
  invAw.forEach(x => ev.push([x.date.getTime(), 0, x.points]));
  let spent = 0;
  inv.filter(x => x.buyer === key).forEach(x => { spent += x.price; ev.push([timeOf(x.time), 1, x.price]); });
  spendRows().filter(x => x.who === key).forEach(x => { spent += x.points; ev.push([x.t, 1, x.points]); });
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let coins = 0, acc = 0, penalty = 0;
  const per = Number(CONFIG.PENALTY_PER) || 2;
  ev.forEach(e => {
    if (e[1] === 0) coins += e[2];
    else if (e[1] === 1) coins -= e[2];
    else {
      const d = Math.floor((acc + e[2]) / per) - Math.floor(acc / per);
      acc += e[2];
      const take = Math.max(0, Math.min(d, coins)); // 最少扣到 0
      coins -= take; penalty += take;
    }
  });
  const red = packs.reduce((t, x) => t + x.points, 0), invest = invAw.reduce((t, x) => t + x.points, 0);
  return { earned: earned + sales.income + red + invest, spent: spent, coins: coins, income: sales.income, red: red, invest: invest, penalty: penalty, minus: minus };
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
    held: heldCards(key), giftable: Object.keys(GIFT_CARDS()),
    penalty: c.penalty || 0, penaltyPer: CONFIG.PENALTY_PER, penaltyFrom: CONFIG.PENALTY_FROM,
    unlimited: !!who.teacher, income: c.income, sales: who.teacher ? null : salesOf(key, inv), createPrice: CONFIG.CREATE_PRICE,
    // 導師：全班點數一覽
    admin: who.teacher ? (() => {
      const items = itemsByStudent();
      return students.map(k => {
        const x = coinsOf(k, inv);
        return { key: k, earned: x.earned, spent: x.spent, coins: x.coins, income: x.income, penalty: x.penalty || 0, active: inv.filter(y => y.owner === k && y.exp >= today).length,
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
      .setValues([[Utilities.getUuid().slice(0, 8), who.key, a.id, a.name, String(a.price), who.key, Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm'), daysLater(CONFIG.ACC_DAYS), '']]);
  });
  return shopState(who);
}
function giftAcc(who, invId, to) {
  const students = getStudents().students;
  if (students.indexOf(to) < 0 || to === who.key) throw new Error('請選擇要送的同學');
  let gift = null;
  withLock(() => {
    const x = invRows().find(r => r.id === invId);
    if (!x || x.owner !== who.key) throw new Error('這個配件不是你的');
    if (x.exp < ymd(new Date())) throw new Error('這個配件已經過期了');
    const sh = getSheet(SHEET_INV, HEAD_INV);
    sh.getRange(x.row, 2).setValue(to);
    sh.getRange(x.row, 9).setValue('由 ' + who.key + ' 贈送');
    gift = x;
  });
  // 用飛鴿傳書通知收到禮物的人（信裡有「前往商店」按鈕）
  botMail([[to, '🎁 ' + who.key + ' 送你一個配件「' + gift.name + '」！\n有效到 ' + gift.exp + '，到「🛍 商店 → 我的配件」按「裝扮大頭照」就可以戴上。\n' + CONFIG.SITE_URL + '#tab=shop']], GIFT_BOT);
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
    const pay = payCard(who, '竊盜卡', CONFIG.STEAL_PRICE);
    const sh = getSheet(SHEET_INV, HEAD_INV);
    sh.getRange(x.row, 2).setValue(who.key);
    sh.getRange(x.row, 9).setValue('用竊盜卡從 ' + x.owner + ' 奪來');
    addSpend(who.key, pay, '竊盜卡', x.owner, x.name);
  });
  return shopState(who);
}
/** 煙火：花 1 點，放在某位同學的座位上 */
function buyFirework(who, to) {
  if (getStudents().students.indexOf(to) < 0) throw new Error('請選擇同學');
  withLock(() => {
    addSpend(who.key, payCard(who, '煙火', CONFIG.FIREWORK_PRICE), '煙火', to, '');
  });
  return shopState(who);
}
/** 交換位置卡：花 100 點，和另一位同學強制對調座位（兩個人都要已經有座位） */
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
// ── 禮物盒：導師、班長、副班長每週可以放一個；大家打開座位時從天而降、爆開、看到圖片，關掉後隨機得到煙火／小太陽卡／小雨傘卡 ──
// 禮物盒轉盤的機率（%）：煙火最高、小太陽卡和小雨傘卡比較低、裝扮配件（預設的配件，不含同學創造的）最低
const BOX_ODDS = [['煙火', 55], ['小太陽卡', 17.5], ['小雨傘卡', 17.5], ['裝扮配件', 10]];
const BOX_REWARDS = BOX_ODDS.map(x => x[0]);
function pickBoxReward() {
  let r = Math.random() * BOX_ODDS.reduce((t, x) => t + x[1], 0);
  for (let i = 0; i < BOX_ODDS.length; i++) { r -= BOX_ODDS[i][1]; if (r < 0) return BOX_ODDS[i][0]; }
  return BOX_ODDS[0][0];
}
const boxWho = who => (who.teacher ? CONFIG.TEACHER_NAME : who.role === 'G' ? '任課老師' : who.key);
function boxFolder() {
  const root = getRootFolder(), it = root.getFoldersByName('禮物盒');
  return it.hasNext() ? it.next() : root.createFolder('禮物盒');
}
function boxRows() {
  const sh = getSS().getSheetByName(SHEET_BOX);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_BOX.length).getValues().map(r => ({
    t: r[0] instanceof Date ? r[0].getTime() : 0, time: r[0] instanceof Date ? Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'MM/dd HH:mm') : '',
    by: String(r[1]), file: String(r[2]), id: String(r[3]), week: String(r[4]),
  }));
}
function boxOpens() {
  const sh = getSS().getSheetByName(SHEET_BOXOPEN);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_BOXOPEN.length).getValues().map(r => ({ who: String(r[1]), id: String(r[2]), got: String(r[3]) }));
}
/** 導師、班長、副班長；每人每週一個 */
function canMakeBox(who) {
  if (!who.teacher && !(who.role === 'C' && isMonitor(who.key))) return false;
  const me = boxWho(who), week = lunchNow().week;
  return !boxRows().some(b => b.by === me && b.week === week);
}
function getGiftBoxes(who) {
  const me = boxWho(who), since = Date.now() - BOX_DAYS * 86400e3;
  const opened = {};
  boxOpens().filter(o => o.who === me).forEach(o => { opened[o.id] = o.got || '已打開'; });
  return boxRows().filter(b => b.t >= since).map(b => ({ id: b.id, by: b.by, time: b.time, t: b.t, opened: !!opened[b.id], got: opened[b.id] || '' }));
}
function createGiftBox(who, data) {
  if (!who.teacher && !(who.role === 'C' && isMonitor(who.key))) throw new Error('只有導師、班長、副班長可以放禮物盒');
  const m = String(data || '').match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!m) throw new Error('請選一張圖片');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 400000) throw new Error('圖片太大了');
  const me = boxWho(who), week = lunchNow().week;
  withLock(() => {
    if (boxRows().some(b => b.by === me && b.week === week)) throw new Error('你這週已經放過禮物盒了，下週再來');
    const id = Utilities.getUuid().slice(0, 8);
    const f = boxFolder().createFile(Utilities.newBlob(bytes, 'image/' + m[1], '禮物盒_' + id + (m[1] === 'png' ? '.png' : '.jpg')));
    const sh = getSheet(SHEET_BOX, HEAD_BOX);
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, HEAD_BOX.length).setValues([[new Date(), me, f.getId(), id, week]]);
    sh.getRange(row, 5).setNumberFormat('@').setValue(week);
  });
  return { ok: true, boxes: getGiftBoxes(who), canMake: false };
}
/** 打開禮物盒：回傳圖片；學生／幹部第一次打開會隨機得到一張道具卡（煙火、小太陽卡、小雨傘卡） */
/** 只讀禮物盒的圖片（預先載入用；不會打開、不會抽獎） */
function giftBoxImage(id) {
  const b = boxRows().find(x => x.id === id);
  if (!b) throw new Error('找不到這個禮物盒');
  try { const blob = DriveApp.getFileById(b.file).getBlob(); return { ok: true, img: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) }; }
  catch (e) { return { ok: true, img: '' }; }   // 圖片被刪了
}
function openGiftBox(who, id, noImg) {
  const b = boxRows().find(x => x.id === id);
  if (!b) throw new Error('找不到這個禮物盒');
  const img = noImg ? '' : giftBoxImage(id).img;   // 網頁已經預先載好圖片的話就不用再傳
  const me = boxWho(who);
  let got = '', kind = '', acc = null;
  withLock(() => {
    const old = boxOpens().find(o => o.who === me && o.id === id);
    if (old) return;                                         // 已經拿過了：只看圖片（轉盤可以轉著玩）
    const student = !who.teacher && who.role !== 'G';
    kind = student ? pickBoxReward() : '';
    const now = new Date();
    if (kind === '裝扮配件') {
      // 從預設的配件裡隨機一個（不含同學用創造卡做的、已下架的），和買的一樣有效 ACC_DAYS 天
      const list = catalog().filter(a => !a.creator && !a.delisted);
      if (list.length) {
        acc = list[Math.floor(Math.random() * list.length)];
        getSheet(SHEET_INV, HEAD_INV).appendRow([Utilities.getUuid().slice(0, 8), me, acc.id, acc.name, '0', '禮物盒',
          Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm'), daysLater(CONFIG.ACC_DAYS), '禮物盒（' + b.by + ' 放的）']);
        got = '裝扮配件「' + acc.name + '」';
      } else kind = '煙火';                                  // 萬一讀不到配件清單，就改成煙火
    }
    if (kind && kind !== '裝扮配件') {
      got = kind;
      const cs = getSheet(SHEET_CARDS, HEAD_CARDS);
      cs.getRange(cs.getLastRow() + 1, 1, 1, HEAD_CARDS.length).setValues([[now, me, kind, 1, '禮物盒（' + b.by + ' 放的）']]);
    }
    const sh = getSheet(SHEET_BOXOPEN, HEAD_BOXOPEN);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_BOXOPEN.length).setValues([[now, me, id, got]]);
  });
  // 飛鴿傳書說明抽到了什麼
  if (got) botMail([[me, '🎁 你打開了 ' + b.by + ' 放的禮物盒，抽到' + (acc
    ? '「' + got + '」！\n已經放進「🛍 商店 → 我的配件」，有效 ' + CONFIG.ACC_DAYS + ' 天，按「裝扮大頭照」就可以戴上。'
    : '一張「' + got + '」！\n已經放進你的道具，到「🛍 商店 → 特殊道具」就可以免費使用。') + '\n' + CONFIG.SITE_URL + '#tab=shop']], GIFT_BOT);
  return { ok: true, img: img, by: b.by, got: got, kind: kind, accName: acc ? acc.name : '', accId: acc ? acc.id : '', odds: BOX_ODDS };
}

// ── 訂便當：週一～週五中午 12 點登記下週的便當；週四 12 點第一次統計、17 點提醒還沒登記的人；週五 12 點截止並通知 ──
/** 現在是第幾週、登記開不開放、哪些定時工作到期了 */
// 彈性調整（導師、總務、班長、副班長）：每一週可以「提前 1～4 天結束登記」、「訂幾天（0～10 天，超過 5 天＝連下下週一起訂）」
const LUNCH_MAX_DAYS = 10;
const WEEK_NAME = ['', '週一', '週二', '週三', '週四', '週五', '週六', '週日'];
function lunchAdj(week) { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LUNCH_ADJ_' + week) || 'null') || {}; }
const dowOf = d => Number(Utilities.formatDate(d, CONFIG.TIMEZONE, 'u'));
/** 從 d 開始算第 n 個上課日（週一～五；n 從 1 開始） */
function nthWeekday(d, n) {
  let x = new Date(d.getTime()), c = 0;
  for (let i = 0; i < 40; i++, x = new Date(x.getTime() + 86400e3)) if (dowOf(x) <= 5 && ++c >= n) return x;
  return x;
}
function lunchNow() {
  const now = new Date(), tz = CONFIG.TIMEZONE;
  const dow = Number(Utilities.formatDate(now, tz, 'u')), hm = Number(Utilities.formatDate(now, tz, 'HHmm')); // 1＝週一
  const mon = new Date(now.getTime() - (dow - 1) * 86400e3);
  const week = ymd(mon), adj = lunchAdj(week);
  // 上週如果連這週之後一起訂了，這次從接下來的那一天開始
  const prev = lunchAdj(ymd(new Date(mon.getTime() - 7 * 86400e3)));
  const overlap = Math.max(0, Math.min(5, (prev.days != null ? Number(prev.days) : 5) - 5));
  const mealMon = new Date(mon.getTime() + 7 * 86400e3);
  const start = nthWeekday(mealMon, overlap + 1), defDays = 5 - overlap;
  const days = adj.days != null ? Math.max(0, Math.min(LUNCH_MAX_DAYS, Number(adj.days))) : defDays;
  const end = days ? nthWeekday(start, days) : start;
  const early = Math.max(0, Math.min(4, Number(adj.early) || 0)), cut = 5 - early;   // 截止：週五（或提前）中午 12 點
  const skip = days <= 0;
  const past = (d, h) => dow > d || (dow === d && hm >= h);
  return {
    week: week, dow: dow, hm: hm, early: early, cut: cut, days: days, defDays: defDays, overlap: overlap, skip: skip,
    start: ymd(start), cutText: WEEK_NAME[cut] + ' 12:00', cutDay: WEEK_NAME[cut],
    adjBy: adj.by || '', adjTime: adj.time || '',
    meal: skip ? '（不訂）' : Utilities.formatDate(start, tz, 'M/d') + (days > 1 ? '～' + Utilities.formatDate(end, tz, 'M/d') : '') + (days !== 5 ? '（' + days + ' 天）' : ''),
    locked: skip || past(cut, 1200),
    t1: !skip && (cut > 1 ? past(cut - 1, 1200) : past(1, 0)),       // 截止前一天中午：第一次統計（週一截止就不統計）
    t2: !skip && (cut > 1 ? past(cut - 1, 1700) : past(1, 800)),     // 截止前一天 17:00 提醒（週一截止：週一早上 8 點提醒）
  };
}
const canLunchAdj = who => who.teacher || cadreRoles(who.key).some(r => /^(總務|副?班長$)/.test(String(r).trim()));
function setLunchAdj(who, early, days) {
  if (!canLunchAdj(who)) throw new Error('只有導師、總務股長、班長、副班長可以調整便當時間');
  early = Math.floor(Number(early));
  days = Math.floor(Number(days));
  if (!(early >= 0 && early <= 4)) throw new Error('提前結束登記要是 0～4 天');
  if (!(days >= 0 && days <= LUNCH_MAX_DAYS)) throw new Error('訂便當的天數要是 0～' + LUNCH_MAX_DAYS + ' 天');
  const before = lunchNow();
  withLock(() => PropertiesService.getScriptProperties().setProperty('LUNCH_ADJ_' + before.week, JSON.stringify({
    early: early, days: days, by: who.teacher ? CONFIG.TEACHER_NAME : who.key, time: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm'),
  })));
  const L = lunchNow();
  if (L.early !== before.early || L.days !== before.days) {
    const text = L.skip ? '🍱 這次不訂便當（' + (who.teacher ? '導師' : who.key) + ' 調整）。'
      : '🍱 便當時間調整了（' + (who.teacher ? '導師' : who.key) + '）：\n這次要訂的是 ' + L.meal + '，登記在 ' + L.cutText + ' 截止' + (L.locked ? '（已經截止）' : '') + '。\n' + CONFIG.SITE_URL + '#tab=lunch';
    botMail(getStudents().students.concat([CONFIG.TEACHER_NAME]).map(k => [k, text]));
  }
  return getLunch(who);
}
function lunchRows(week) {
  const sh = getSS().getSheetByName(SHEET_LUNCH), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const tzS = getSS().getSpreadsheetTimeZone() || CONFIG.TIMEZONE;
  sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_LUNCH.length).getValues().forEach((r, i) => {
    const w = r[0] instanceof Date ? Utilities.formatDate(r[0], tzS, 'yyyy/MM/dd') : String(r[0]).replace(/^'/, '').trim();
    if (w !== week) return;
    out[String(r[1]).trim()] = { row: i + 2, choice: String(r[2]), time: r[3] instanceof Date ? Utilities.formatDate(r[3], CONFIG.TIMEZONE, 'MM/dd HH:mm') : '', paid: r[4] === true || String(r[4]) === 'TRUE', paidBy: String(r[5]) };
  });
  return out;
}
/** 系統寄的信（寄件人是「🍱 訂便當小幫手」） */
function botMail(list, from) {
  if (!list.length) return;
  const sh = getSheet(SHEET_MAIL, HEAD_MAIL), now = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, list.length, HEAD_MAIL.length).setValues(list.map(m => [now, from || LUNCH_BOT, m[0], m[1], Utilities.getUuid().slice(0, 8)]));
}
const treasurers = () => { try { const m = cadreMap(); return Object.keys(m).filter(k => m[k].some(r => /^總務/.test(String(r).trim()))); } catch (e) { return []; } };
/** 給 LINE 群組的報表（清楚的文字格式） */
/** 導師也訂便當：名單加上導師；導師沒登記過，預設「要」 */
function lunchWithTeacher(rows, students) {
  const T = CONFIG.TEACHER_NAME, r = Object.assign({}, rows);
  if (!r[T]) r[T] = { choice: '要', time: '', paid: false, auto: true };
  return { rows: r, people: students.concat([T]) };
}
function lunchReport(L, rows, students) {
  const W = lunchWithTeacher(rows, students);
  rows = W.rows; students = W.people;
  const yes = students.filter(k => rows[k] && rows[k].choice === '要'), no = students.filter(k => rows[k] && rows[k].choice === '不要');
  const none = students.filter(k => !rows[k]);
  const paid = yes.filter(k => rows[k].paid), unpaid = yes.filter(k => !rows[k].paid);
  const nm = k => k.replace(/^(\D*?)(\d+)/, '$1$2 ');
  return ['🍱 ' + CONFIG.CLASS_NAME + ' 便當登記（' + L.meal + '）',
    '✅ 要訂 ' + yes.length + ' 人' + (yes.length ? '：\n' + yes.map(nm).join('、') : ''),
    '❌ 不訂 ' + no.length + ' 人',
    '⚠️ 未登記 ' + none.length + ' 人' + (none.length ? '：\n' + none.map(nm).join('、') : ''),
    '💰 已繳費 ' + paid.length + '／' + yes.length + ' 人' + (unpaid.length ? '（未繳：' + unpaid.map(nm).join('、') + '）' : ''),
    '（' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') + ' 統計）'].join('\n');
}
/** 定時工作：到了時間、這週還沒做過的才做（任何人打開 App 時檢查） */
function lunchTick() {
  const L = lunchNow(), props = PropertiesService.getScriptProperties();
  const k1 = 'LUNCH_T1_' + L.week, k2 = 'LUNCH_T2_' + L.week, k3 = 'LUNCH_T3_' + L.week;
  const need1 = L.t1 && !props.getProperty(k1), need2 = L.t2 && !L.locked && !props.getProperty(k2), need3 = L.locked && !L.skip && !props.getProperty(k3);
  if (!need1 && !need2 && !need3) return;
  withLock(() => {
    const rows = lunchRows(L.week), students = getStudents().students;
    const yes = students.filter(k => rows[k] && rows[k].choice === '要'), no = students.filter(k => rows[k] && rows[k].choice === '不要');
    const none = students.filter(k => !rows[k]);
    if (L.t1 && !props.getProperty(k1)) {   // 週四中午：第一次統計（畫面上會顯示）
      props.setProperty(k1, JSON.stringify({ time: Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm'), yes: yes.length, no: no.length, none: none.length }));
    }
    if (L.t2 && !L.locked && !props.getProperty(k2)) { // 週四 17:00：提醒還沒登記的人
      botMail(none.map(k => [k, '🍱 你還沒登記 ' + L.meal + ' 要不要訂便當！\n請在' + L.cutDay + '中午 12 點前，到 App 的「🍱 便當」登記「要」或「不要」。\n' + CONFIG.SITE_URL + '#tab=lunch']));   // 最後一行是連結：信裡會變成「前往訂便當」按鈕
      props.setProperty(k2, '1');
    }
    if (L.locked && !L.skip && !props.getProperty(k3)) { // 週五 12:00（或提前）：截止，通知總務和有訂的同學
      const report = lunchReport(L, rows, students);
      botMail(treasurers().concat([CONFIG.TEACHER_NAME]).map(k => [k, '📋 本週便當登記已截止，以下是統計（可以複製傳到 LINE 群組）：\n\n' + report]));
      botMail(yes.map(k => [k, '🍱 你登記了 ' + L.meal + ' 的便當。\n請在今天（' + L.cutDay + '）放學前把便當費交給總務，逾時未交會取消訂餐喔！']));
      props.setProperty(k3, '1');
    }
  });
}
function getLunch(who) {
  try { lunchTick(); } catch (e) { Logger.log('訂便當定時工作失敗：' + e); }
  const L = lunchNow(), rows = lunchRows(L.week), students = getStudents().students;
  const first = PropertiesService.getScriptProperties().getProperty('LUNCH_T1_' + L.week);
  return {
    ok: true, week: L.week, meal: L.meal, locked: L.locked, first: first ? JSON.parse(first) : null,
    early: L.early, cut: L.cut, cutText: L.cutText, days: L.days, defDays: L.defDays, overlap: L.overlap, skip: L.skip, start: L.start, adjBy: L.adjBy, adjTime: L.adjTime,
    canAdj: canLunchAdj(who), maxDays: LUNCH_MAX_DAYS,
    rows: lunchWithTeacher(rows, students).people.map(k => { const W = lunchWithTeacher(rows, students).rows; return { key: k, choice: W[k] ? W[k].choice : '', paid: W[k] ? W[k].paid : false, time: W[k] ? W[k].time : '', auto: !!(W[k] && W[k].auto) }; }),
    me: who.teacher ? CONFIG.TEACHER_NAME : who.key, canPay: !who.teacher && treasurers().indexOf(who.key) >= 0,   // 只有總務股長可以勾繳費（導師不行）
    report: lunchReport(L, rows, students),
  };
}
function setLunch(who, choice) {
  if (choice !== '要' && choice !== '不要') throw new Error('請選「要」或「不要」');
  const me = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  const L = lunchNow();
  if (L.skip) throw new Error('這次不訂便當');
  if (L.locked) throw new Error('本週登記已經在' + L.cutText + '截止了，下週一再開放');
  withLock(() => {
    const sh = getSheet(SHEET_LUNCH, HEAD_LUNCH), cur = lunchRows(L.week)[me];
    if (cur) sh.getRange(cur.row, 3, 1, 2).setValues([[choice, new Date()]]);
    else {
      const row = sh.getLastRow() + 1;
      sh.getRange(row, 1).setNumberFormat('@');   // 先設成文字，週次才不會被變成日期
      sh.getRange(row, 1, 1, HEAD_LUNCH.length).setValues([[L.week, me, choice, new Date(), false, '']]);
    }
  });
  return getLunch(who);
}
/** 總務（和導師）勾選誰已經繳餐費（截止後也可以勾） */
function setLunchPaid(who, key, paid) {
  if (who.teacher || treasurers().indexOf(who.key) < 0) throw new Error('只有總務股長可以登記繳費');
  const L = lunchNow();
  withLock(() => {
    let cur = lunchRows(L.week)[key];
    if (!cur && key === CONFIG.TEACHER_NAME) {
      const sh = getSheet(SHEET_LUNCH, HEAD_LUNCH), row = sh.getLastRow() + 1;
      sh.getRange(row, 1).setNumberFormat('@');
      sh.getRange(row, 1, 1, HEAD_LUNCH.length).setValues([[L.week, key, '要', new Date(), false, '']]);
      cur = lunchRows(L.week)[key];
    }
    if (!cur || cur.choice !== '要') throw new Error('這位同學沒有訂便當');
    getSheet(SHEET_LUNCH, HEAD_LUNCH).getRange(cur.row, 5, 1, 2).setValues([[paid, paid ? mailName(who) + ' ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm') : '']]);
  });
  return getLunch(who);
}

// ── 📥 各項作業與繳交資料追蹤：導師、幹部（小老師）設定繳交項目和時間，勾選誰交了；逾期標示、LINE 報表、站內信提醒 ──
const SHEET_HW = '繳交追蹤';
const HEAD_HW = ['編號', '名稱', '建立者', '開始', '截止', '對象', '說明', '已交', '建立時間', '狀態', '交給', '指定名單'];
const HW_BOT = '📥 繳交提醒';
const HW_TARGET = { all: '全班', data: '資料科', mm: '多媒科', custom: '指定同學' };
const hwSheet = () => textSheet(SHEET_HW, HEAD_HW, [1, 2, 3, 6, 7, 8, 10, 11, 12]);
const canHw = who => !!(who.teacher || who.role === 'C' || cadreRoles(who.key).length);
function hwRows() {
  const sh = getSS().getSheetByName(SHEET_HW);
  if (!sh || sh.getLastRow() < 2) return [];
  const ms = v => (v instanceof Date ? v.getTime() : Number(v) || 0);
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_HW.length).getValues().map((r, i) => {
    let done = {}, list = [];
    try { done = JSON.parse(r[7] || '{}') || {}; } catch (e) { /* 壞掉就當作沒人交 */ }
    try { list = JSON.parse(r[11] || '[]') || []; } catch (e) { /* 沒有指定名單 */ }
    return { row: i + 2, id: String(r[0]), name: String(r[1]), by: String(r[2]), start: ms(r[3]), end: ms(r[4]), target: String(r[5]) || 'all', note: String(r[6]), done: done, t: ms(r[8]), status: String(r[9]),
      to: String(r[10] || '') || String(r[2]), list: list };
  }).filter(x => x.id && x.status !== '刪除');
}
function hwTargets(target, students, list) {
  students = students || getStudents().students;
  return students.filter(k => target === 'custom' ? (list || []).indexOf(k) >= 0 : target === 'data' ? /^料/.test(k) : target === 'mm' ? /^多/.test(k) : true);
}
function getHomework(who) {
  const mgr = canHw(who), me = who.teacher ? '' : who.key, students = getStudents().students;
  const since = Date.now() - 30 * 86400e3;   // 截止超過 30 天的就不顯示
  const items = hwRows().filter(x => x.end >= since).map(x => {
    const people = hwTargets(x.target, students, x.list);
    const base = { id: x.id, name: x.name, by: x.by, to: x.to, start: x.start, end: x.end, target: x.target, note: x.note, total: people.length, n: people.filter(k => x.done[k]).length, mine: x.by === (who.teacher ? CONFIG.TEACHER_NAME : who.key) || !!who.teacher };
    if (mgr) return Object.assign(base, { people: people, done: x.done, list: x.list });
    if (people.indexOf(me) < 0) return null;
    return Object.assign(base, { forMe: true, myDone: x.done[me] || 0 });
  }).filter(Boolean).sort((a, b) => a.end - b.end);
  return { ok: true, items: items, manager: mgr, me: me, now: Date.now(), ver: 2 };   // ver 2：支援「交給誰」「指定同學」
}
function saveHomework(who, it) {
  if (!canHw(who)) throw new Error('只有導師和幹部可以設定繳交項目');
  const name = String(it.name || '').trim().slice(0, 40), start = Number(it.start), end = Number(it.end);
  const target = HW_TARGET[it.target] ? it.target : 'all', note = String(it.note || '').trim().slice(0, 200);
  const students = getStudents().students;
  const list = target === 'custom' ? (it.list || []).map(String).filter((k, i, a) => students.indexOf(k) >= 0 && a.indexOf(k) === i) : [];
  if (target === 'custom' && !list.length) throw new Error('請選擇要交的同學');
  const to = String(it.to || '') === CONFIG.TEACHER_NAME || students.indexOf(String(it.to || '')) >= 0 ? String(it.to) : '';
  if (!name) throw new Error('請輸入繳交項目的名稱');
  if (!(start > 0 && end > start)) throw new Error('截止時間要在開始時間之後');
  const by = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  withLock(() => {
    const sh = hwSheet();
    if (it.id) {
      const x = hwRows().find(r => r.id === String(it.id));
      if (!x) throw new Error('找不到這個項目');
      if (!who.teacher && x.by !== by) throw new Error('只有建立的人和導師可以修改');
      sh.getRange(x.row, 2).setValue(name);
      sh.getRange(x.row, 4, 1, 4).setValues([[new Date(start), new Date(end), target, note]]);
      sh.getRange(x.row, 11, 1, 2).setValues([[to || x.to, JSON.stringify(list)]]);
    } else {
      const at = sh.getLastRow() + 1;
      sh.getRange(at, 1, 1, HEAD_HW.length).setValues([[Utilities.getUuid().slice(0, 8), name, by, new Date(start), new Date(end), target, note, '{}', new Date(), '', to || by, JSON.stringify(list)]]);
      if (!sh.getRange(1, 11).getValue()) sh.getRange(1, 11, 1, 2).setValues([['交給', '指定名單']]).setFontWeight('bold').setBackground('#ede7fb');   // 舊的工作表補上欄位名稱
      sh.getRange(at, 4, 1, 2).setNumberFormat('yyyy/mm/dd hh:mm');
    }
  });
  return getHomework(who);
}
function delHomework(who, id) {
  const by = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  withLock(() => {
    const x = hwRows().find(r => r.id === String(id));
    if (!x) throw new Error('找不到這個項目');
    if (!who.teacher && x.by !== by) throw new Error('只有建立的人和導師可以刪除');
    hwSheet().getRange(x.row, 10).setValue('刪除');
  });
  return getHomework(who);
}
/** 勾選誰交了：changes＝{ 同學: true/false }（記下勾選的時間，用來判斷是不是遲交） */
function markHomework(who, id, changes) {
  if (!canHw(who)) throw new Error('只有導師和幹部可以勾選');
  withLock(() => {
    const x = hwRows().find(r => r.id === String(id));
    if (!x) throw new Error('找不到這個項目');
    const now = Date.now();
    Object.keys(changes || {}).forEach(k => { if (changes[k]) { if (!x.done[k]) x.done[k] = now; } else delete x.done[k]; });
    hwSheet().getRange(x.row, 8).setValue(JSON.stringify(x.done));
  });
  return getHomework(who);
}
/** 逾期扣分：截止後還沒交（或晚交），每一天（不滿一天算一天）扣 HW_LATE_PER 分；從「重置扣分統計」之後截止的項目才算 */
function hwLatePenalties(rst) {
  const per = Number(CONFIG.HW_LATE_PER) || 0.1, students = getStudents().students, now = Date.now(), out = [];
  hwRows().forEach(x => {
    if (!x.end || x.end > now || x.end < (rst || 0)) return;
    hwTargets(x.target, students, x.list).forEach(k => {
      const stop = x.done[k] || now, days = Math.ceil((stop - x.end) / 864e5);
      if (days <= 0) return;
      out.push({ key: k, days: days, p: -Math.round(days * per * 100) / 100, name: x.name, to: x.to, end: x.end, done: !!x.done[k] });
    });
  });
  return out;
}
/** 發站內信提醒還沒交的同學（同一個項目 10 分鐘內只能發一次） */
function remindHomework(who, id) {
  if (!canHw(who)) throw new Error('只有導師和幹部可以發提醒');
  const x = hwRows().find(r => r.id === String(id));
  if (!x) throw new Error('找不到這個項目');
  const cache = CacheService.getScriptCache(), ck = 'hw:remind:' + x.id;
  if (cache.get(ck)) throw new Error('10 分鐘內已經提醒過了，請稍後再發');
  const late = Date.now() > x.end, when = Utilities.formatDate(new Date(x.end), CONFIG.TIMEZONE, 'MM/dd HH:mm');
  const miss = hwTargets(x.target, null, x.list).filter(k => !x.done[k]);
  if (!miss.length) throw new Error('大家都交了，不用提醒');
  const from = who.teacher ? '導師' : who.key;
  botMail(miss.map(k => [k, '📥 ' + from + ' 提醒你：「' + x.name + '」' + (late ? '已經在 ' + when + ' 截止了，你還沒交，請盡快補交！（每逾期一天扣 ' + (Number(CONFIG.HW_LATE_PER) || 0.1) + ' 分）' : '要在 ' + when + ' 前繳交，你還沒交喔！（超過截止每天扣 ' + (Number(CONFIG.HW_LATE_PER) || 0.1) + ' 分）') + '\n請交給：' + (x.to === CONFIG.TEACHER_NAME ? '導師' : x.to) + (x.note ? '\n說明：' + x.note : '') + '\n' + CONFIG.SITE_URL + '#tab=hw']), HW_BOT);
  cache.put(ck, '1', 600);
  return { ok: true, sent: miss.length };
}

// ── 🐾 班級寵物：同學被加分 → 從座位蹦出一顆寵物蛋（每人每天最多一顆）→ 1 天後孵化（滿血 10 HP）；
//    每天扣 1 HP，同學在商店買罐罐（1 點）餵食 +1 HP；0 HP 就升天。外觀由被加分的同學上傳（PNG 去背），沒上傳就是貓咪 ──
const SHEET_PET = '班級寵物';
const HEAD_PET = ['編號', '主人', '原因', '生蛋時間', '孵化時間', '名字', '圖片', '血量', '上次扣血日', '狀態', '死亡時間', '最近餵食'];
const PET = { HATCH_H: 24, MAX_HP: 10, FOOD: 1 };
const petSheet = () => textSheet(SHEET_PET, HEAD_PET, [1, 2, 3, 6, 7, 9, 10, 12]);
function petRows() {
  const sh = getSS().getSheetByName(SHEET_PET);
  if (!sh || sh.getLastRow() < 2) return [];
  const ms = v => (v instanceof Date ? v.getTime() : Number(v) || 0);
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_PET.length).getValues().map((r, i) => ({
    row: i + 2, id: String(r[0]), owner: String(r[1]), reason: String(r[2]), born: ms(r[3]), hatch: ms(r[4]), name: String(r[5]), img: String(r[6]),
    hp: Number(r[7]) || 0, decay: String(r[8]), status: String(r[9]), died: ms(r[10]), fed: String(r[11]),
  })).filter(x => x.id);
}
/** 生一顆蛋（同一個人同一天只生一顆） */
/** 生蛋：被加幾分就生幾顆（每位主人的蛋＋活著的寵物最多 10 隻）。
 *  同一位主人的蛋和寵物共用 10 HP：生新蛋時重新平均分配（主人之後可以自己調整，例如 8／1／1） */
function petLay(owner, reason, when, n) {
  const t = when || Date.now(), live = petRows().filter(x => x.owner === owner && x.status !== '死亡');
  const k = Math.max(0, Math.min(Math.round(Number(n) || 1), PET.MAX_HP - live.length));
  if (!k) return 0;
  const sh = petSheet(), at = sh.getLastRow() + 1;
  sh.getRange(at, 1, k, HEAD_PET.length).setValues(Array.from({ length: k }, () => [Utilities.getUuid().slice(0, 8), owner, String(reason || '').slice(0, 60), new Date(t), new Date(t + PET.HATCH_H * 3600e3), '', '', 1, '', '蛋', '', '']));
  sh.getRange(at, 4, k, 2).setNumberFormat('yyyy/mm/dd hh:mm');
  petSplit(owner);
  return k;
}
/** 把 10 HP 平均分給這位主人的蛋和活著的寵物（除不盡的多給比較早出生的） */
function petSplit(owner) {
  const list = petRows().filter(x => x.owner === owner && x.status !== '死亡').sort((a, b) => a.born - b.born);
  if (!list.length) return;
  const base = Math.floor(PET.MAX_HP / list.length), rem = PET.MAX_HP % list.length, sh = petSheet();
  list.forEach((x, i) => sh.getRange(x.row, 8).setValue(Math.max(1, base + (i < rem ? 1 : 0))));
}
/** 主人重新分配 HP（只能互相移動，總數不能變多；每隻至少 1 HP） */
function petAllot(who, owner, plan) {
  owner = who.teacher ? String(owner || '') : who.key;
  withLock(() => {
    petTick();
    const list = petRows().filter(x => x.owner === owner && x.status !== '死亡');
    if (!list.length) throw new Error('沒有可以分配的寵物');
    const total = list.reduce((s, x) => s + x.hp, 0);
    const next = list.map(x => Math.round(Number((plan || {})[x.id])));
    if (next.some(v => !(v >= 1))) throw new Error('每一隻至少要 1 HP');
    const sum = next.reduce((s, v) => s + v, 0);
    if (sum !== total) throw new Error('只能互相移動 HP，加起來要剛好 ' + total + ' HP（現在是 ' + sum + ' HP）');
    const sh = petSheet();
    list.forEach((x, i) => sh.getRange(x.row, 8).setValue(next[i]));
  });
  return getPets(who);
}
/** 孵化、每天扣血、死掉：讀的時候順便更新（不用定時觸發） */
function petTick() {
  const now = Date.now(), today = ymd(new Date()), sh = petSheet();
  const dayN = s => Math.round(Utilities.parseDate(s, CONFIG.TIMEZONE, 'yyyy/MM/dd').getTime() / 864e5);
  petRows().forEach(x => {
    if (x.status === '蛋' && now >= x.hatch) {   // 孵化：從孵化那天開始算血量
      x.status = '寵物'; x.hp = Math.max(1, x.hp || 1); x.decay = ymd(new Date(x.hatch));
      sh.getRange(x.row, 8, 1, 3).setValues([[x.hp, x.decay, x.status]]);
    }
    if (x.status !== '寵物' || !x.decay || x.decay >= today) return;
    const days = dayN(today) - dayN(x.decay);
    if (days <= 0) return;
    x.hp -= days;
    if (x.hp <= 0) {   // 掛掉：死亡時間＝血量剛好歸零的那一天
      const deadDay = dayN(x.decay) + days + x.hp;
      sh.getRange(x.row, 8, 1, 4).setValues([[0, today, '死亡', new Date(deadDay * 864e5 + 8 * 3600e3)]]);
    } else sh.getRange(x.row, 8, 1, 2).setValues([[x.hp, today]]);
  });
}
const petPub = x => ({ id: x.id, owner: x.owner, reason: x.reason, born: x.born, hatch: x.hatch, name: x.name, img: x.img ? 1 : 0, imgId: x.img, hp: x.hp, status: x.status, died: x.died, fed: x.fed });
function getPets(who) {
  withLock(() => {
    // 第一次用：補上最近一次被加分的同學的寵物蛋
    if (!getSS().getSheetByName(SHEET_PET)) {
      petSheet();
      const psh = pointsSheet();
      if (psh.getLastRow() > 1) {
        const last = psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().filter(r => Number(r[2]) > 0 && String(r[1]).trim()).pop();
        if (last) petLay(String(last[1]).trim(), String(last[4]), Date.now());
      }
    }
    // 補一次：最近 3 天被加分（包含擂台賽獲勝）但還沒有寵物蛋的同學，每人每天補一顆
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('PET_BACKFILL_2')) {
      const psh = pointsSheet(), since = Date.now() - 3 * 864e5;
      if (psh.getLastRow() > 1) psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
        const t = r[6] instanceof Date ? r[6].getTime() : r[0] instanceof Date ? r[0].getTime() : 0;
        if (Number(r[2]) > 0 && String(r[1]).trim() && t >= since) petLay(String(r[1]).trim(), String(r[4]), t);
      });
      props.setProperty('PET_BACKFILL_2', '1');
    }
    petTick();
  });
  const week = Date.now() - 7 * 864e5;   // 死掉超過一週的不顯示
  // 最近一週誰餵了罐罐（次數多的，寵物比較常去他的座位旁邊睡覺）
  const fed = {};
  spendRows().forEach(r => { if (r.use !== '罐罐' || r.t < week) return; const m = fed[r.target] || (fed[r.target] = {}); m[r.who] = (m[r.who] || 0) + 1; });
  const feeders = id => Object.entries(fed[id] || {}).map(([k, n]) => ({ key: k, n: n })).sort((a, b) => b.n - a.n);
  return { ok: true, pets: petRows().filter(x => x.status !== '死亡' || x.died > week).map(x => Object.assign(petPub(x), { feeders: feeders(x.id) })), me: who.teacher ? CONFIG.TEACHER_NAME : who.key, now: Date.now(), food: PET.FOOD, max: PET.MAX_HP };
}
/** 餵罐罐：花 1 點，+1 HP（最多 10） */
function feedPet(who, id) {
  const me = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  withLock(() => {
    petTick();
    const x = petRows().find(r => r.id === String(id));
    if (!x || x.status !== '寵物') throw new Error('這隻寵物現在不能餵（還是蛋或已經升天了）');
    if (x.hp >= PET.MAX_HP) throw new Error('牠已經吃飽了（滿血 ' + PET.MAX_HP + ' HP）');
    const ownerHp = petRows().filter(r => r.owner === x.owner && r.status !== '死亡').reduce((s, r) => s + r.hp, 0);
    if (ownerHp >= PET.MAX_HP) throw new Error('這位主人的寵物加起來已經 ' + PET.MAX_HP + ' HP（上限），現在不能再餵了');
    if (!who.teacher) {
      const c = coinsOf(me);
      if (c.coins < PET.FOOD) throw new Error('點數不夠（罐罐要 ' + PET.FOOD + ' 點，你有 ' + c.coins + ' 點）');
    }
    addSpend(me, who.teacher ? 0 : PET.FOOD, '罐罐', x.id, '餵 ' + (x.name || x.owner + ' 的寵物'));
    petSheet().getRange(x.row, 8).setValue(x.hp + 1);
    petSheet().getRange(x.row, 12).setValue(me + ' ' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'MM/dd HH:mm'));
  });
  return getPets(who);
}
/** 主人上傳外觀（PNG 去背）、取名字 */
function petLook(who, id, name, data) {
  const x = petRows().find(r => r.id === String(id));
  if (!x) throw new Error('找不到這隻寵物');
  if (!who.teacher && x.owner !== who.key) throw new Error('只有寵物的主人可以改外觀');
  if (x.status === '死亡') throw new Error('牠已經升天了');
  let fid = '';
  if (data) {
    const m = String(data).match(/^data:image\/(png|jpeg|webp|gif);base64,(.+)$/);
    if (!m) throw new Error('請選一張圖片（建議 PNG 去背）');
    const bytes = Utilities.base64Decode(m[2]);
    if (bytes.length > 600000) throw new Error('圖片太大了');
    const root = getRootFolder(), it = root.getFoldersByName('班級寵物'), folder = it.hasNext() ? it.next() : root.createFolder('班級寵物');
    fid = folder.createFile(Utilities.newBlob(bytes, 'image/' + m[1], '寵物_' + x.id + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]))).getId();
  }
  withLock(() => {
    const sh = petSheet();
    if (name != null) sh.getRange(x.row, 6).setValue(String(name).trim().slice(0, 12));
    if (fid) sh.getRange(x.row, 7).setValue(fid);
  });
  return getPets(who);
}
function petImage(id) {
  const x = petRows().find(r => r.id === String(id));
  if (!x || !x.img) return { ok: true, img: '' };
  try { const b = DriveApp.getFileById(x.img).getBlob(); return { ok: true, img: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) }; }
  catch (e) { return { ok: true, img: '' }; }
}

// ── 抽籤紀錄：誰抽的、抽到誰、有沒有抽籤卡；全班都看得到最近 30 天 ──
function getDrawLog() {
  const sh = getSS().getSheetByName(SHEET_DRAW);
  if (!sh || sh.getLastRow() < 2) return [];
  const since = Math.max(Date.now() - DRAW_DAYS * 86400e3, Number(PropertiesService.getScriptProperties().getProperty('DRAW_CLEAR_AT') || 0));
  const n = sh.getLastRow() - 1, from = Math.max(0, n - 300);
  return sh.getRange(2 + from, 1, n - from, HEAD_DRAW.length).getValues()
    .filter(r => r[0] instanceof Date && r[0].getTime() > since)
    .map(r => ({ id: String(r[4]), ts: r[0].getTime(), t: Utilities.formatDate(r[0], CONFIG.TIMEZONE, 'MM/dd HH:mm'), by: String(r[1]),
      k: String(r[2]).split('、').filter(Boolean), fx: String(r[3]).split('\n').filter(Boolean) }))
    .reverse();
}
function addDrawLog(who, k, fx) {
  const list = getStudents().students;
  k = (Array.isArray(k) ? k : []).map(String).filter(x => list.indexOf(x) >= 0).slice(0, 10);
  if (!k.length) throw new Error('沒有抽籤結果');
  fx = (Array.isArray(fx) ? fx : []).map(x => String(x).slice(0, 120)).slice(0, 10);
  withLock(() => {
    const sh = getSheet(SHEET_DRAW, HEAD_DRAW);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_DRAW.length).setValues([[new Date(), who.teacher ? CONFIG.TEACHER_NAME : who.role === 'G' ? '任課老師' : who.key, k.join('、'), fx.join('\n'), Utilities.getUuid().slice(0, 8)]]);
  });
  return getDrawLog();
}

// ── 班費收支：總務（和導師）登記，大家都看得到 ──
const isTreasurer = key => cadreRoles(key).some(r => /^總務/.test(String(r).trim()));
function fundRows() {
  const sh = getSS().getSheetByName(SHEET_FUND);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_FUND.length).getValues()
    .filter(r => !String(r[8]) && String(r[1]).trim())
    .map(r => ({ date: r[0] instanceof Date ? ymd(r[0]) : String(r[0]), item: String(r[1]), type: String(r[2]), amount: Number(r[3]) || 0, note: String(r[4]), by: String(r[5]), id: String(r[7]),
      receipts: String(r[9] || '').split(',').map(x => x.trim()).filter(String) }));
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
  const date = String(r.date || ymd(new Date()));
  const ids = (Array.isArray(r.receipts) ? r.receipts : []).slice(0, 3).map((d, i) => saveReceipt(d, date + '_' + type + '_' + item + '_' + (i + 1)));
  withLock(() => {
    const sh = fundSheet();
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, HEAD_FUND.length).setValues([[toDate(date), item, type, amount, note, mailName(who), new Date(), Utilities.getUuid().slice(0, 8), '', ids.join(',')]]);
    sh.getRange(row, 1).setNumberFormat('yyyy/mm/dd');
  });
  return getFund();
}
/** 班費試算表（舊的沒有「收據」欄就補上標題） */
function fundSheet() {
  const sh = getSheet(SHEET_FUND, HEAD_FUND);
  if (String(sh.getRange(1, 10).getValue()) !== '收據') sh.getRange(1, 10).setValue('收據').setFontWeight('bold').setBackground('#ede7fb');
  return sh;
}
/** 收據、證明的照片：放在「班費收據」資料夾（網頁已經先壓縮過） */
function fundFolder() {
  const root = getRootFolder(), it = root.getFoldersByName('班費收據');
  return it.hasNext() ? it.next() : root.createFolder('班費收據');
}
function saveReceipt(data, label) {
  const m = String(data || '').match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!m) throw new Error('收據要是照片或圖片');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 700000) throw new Error('收據照片太大了');
  const name = '班費收據_' + String(label).replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) + (m[1] === 'png' ? '.png' : '.jpg');
  return fundFolder().createFile(Utilities.newBlob(bytes, 'image/' + m[1], name)).getId();
}
/** 已經登記的收支，再補上收據 */
function addFundReceipt(who, id, data) {
  if (!who.teacher && !isTreasurer(who.key)) throw new Error('只有總務和導師可以上傳收據');
  const r = fundRows().find(x => x.id === id);
  if (!r) throw new Error('找不到這筆');
  if (r.receipts.length >= RECEIPT_MAX) throw new Error('每一筆最多 ' + RECEIPT_MAX + ' 張收據');
  const fid = saveReceipt(data, r.date + '_' + r.type + '_' + r.item + '_' + (r.receipts.length + 1));
  withLock(() => {
    const sh = fundSheet(), n = sh.getLastRow() - 1;
    const i = sh.getRange(2, 8, n, 1).getValues().findIndex(x => String(x[0]) === id);
    if (i < 0) throw new Error('找不到這筆');
    const cur = String(sh.getRange(i + 2, 10).getValue() || '').split(',').filter(String);
    sh.getRange(i + 2, 10).setValue(cur.concat([fid]).join(','));
  });
  return getFund();
}
/** 看收據：只給「班費收支」裡登記過的檔案（不能拿來讀雲端硬碟的其他檔案） */
function getFundReceipt(fid) {
  fid = String(fid || '');
  if (!fid || !fundRows().some(r => r.receipts.indexOf(fid) >= 0)) throw new Error('找不到這張收據');
  const b = DriveApp.getFileById(fid).getBlob();
  return { ok: true, d: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
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
  try { lunchTick(); } catch (e) { Logger.log('訂便當定時工作失敗：' + e); }
  try { investTick(); } catch (e) { Logger.log('投資競賽定時工作失敗：' + e); }
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
// ── 小太陽卡／小雨傘卡：放在某位同學的座位上方，維持 5 天（到期日記在「說明」欄）──
const WEATHER = { sun: '小太陽卡', rain: '小雨傘卡' };
function buyWeather(who, kind, to) {
  const card = WEATHER[kind];
  if (!card) throw new Error('沒有這種卡片');
  if (getStudents().students.indexOf(to) < 0) throw new Error('請選擇同學');
  withLock(() => {
    addSpend(who.key, payCard(who, card, CONFIG.WEATHER_PRICE), card, to, daysLater(CONFIG.WEATHER_DAYS));
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
/** 抽籤加權：{ 同學: { w: 1.3, pts: 3, left: 2 } }；每筆扣分在它之後的 DRAW_BOOST_TIMES 次抽籤內有效 */
function drawWeights() {
  const out = {};
  const psh = pointsSheet();
  if (psh.getLastRow() < 2) return out;
  const since = Date.now() - 60 * 86400e3;
  const dsh = getSS().getSheetByName(SHEET_DRAW);
  const draws = dsh && dsh.getLastRow() > 1 ? dsh.getRange(2, 1, dsh.getLastRow() - 1, 1).getValues().map(r => (r[0] instanceof Date ? r[0].getTime() : 0)).filter(t => t >= since) : [];
  const N = Number(CONFIG.DRAW_BOOST_TIMES) || 3, B = Number(CONFIG.DRAW_BOOST) || 0.1;
  psh.getRange(2, 1, psh.getLastRow() - 1, 7).getValues().forEach(r => {
    const p = Number(r[2]) || 0, who = String(r[1]).trim(), t = timeOf(r[6] || r[0]);
    if (p >= 0 || !who || t < since) return;
    const used = draws.filter(d => d > t).length;
    if (used >= N) return;
    const o = out[who] || (out[who] = { pts: 0, left: 0 });
    o.pts += -p; o.left = Math.max(o.left, N - used);
  });
  Object.keys(out).forEach(k => { out[k].w = Math.round((1 + out[k].pts * B) * 100) / 100; });
  return out;
}
function drawFx() {
  const since = Date.now() - CONFIG.TRANSFER_DAYS * 86400e3;
  const rows = spendRows();
  return {
    weights: drawWeights(), boost: CONFIG.DRAW_BOOST, boostTimes: CONFIG.DRAW_BOOST_TIMES,
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
    addSpend(who.key, kind === 'sure' ? payCard(who, card, price) : (() => { const c = coinsOf(who.key); if (c.coins < price) throw new Error('點數不夠（' + card + '要 ' + price + ' 點，你有 ' + c.coins + ' 點）'); return price; })(), card, to, '');
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
  // 手上的道具卡（別人送的、段考獎勵）：收到的 − 用掉的
  const got = {};
  cards.forEach(c => { got[c.who] = true; });
  Object.keys(got).forEach(k => { const h = heldCards(k, cards, spend); Object.keys(h).forEach(n => add(held, k, '🎟' + n, h[n])); });
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
  return heldCards(key)['交換位置卡'] || 0;
}
const GIFT_CARDS = () => ({ 交換位置卡: CONFIG.SWAP_PRICE, 竊盜卡: CONFIG.STEAL_PRICE, 抽籤必中卡: CONFIG.SURE_PRICE, 煙火: CONFIG.FIREWORK_PRICE, 小太陽卡: CONFIG.WEATHER_PRICE, 小雨傘卡: CONFIG.WEATHER_PRICE });
/** 手上還沒用的道具卡（別人送的、段考獎勵）：收到的 − 用掉的（點數 0 的使用紀錄） */
function heldCards(key, cards, spend) {
  const out = {};
  (cards || cardRows()).filter(x => x.who === key).forEach(x => { out[x.card] = (out[x.card] || 0) + x.n; });
  (spend || spendRows()).filter(x => x.who === key && x.points === 0 && out[x.use]).forEach(x => { out[x.use]--; });
  Object.keys(out).forEach(k => { if (out[k] <= 0) delete out[k]; });
  return out;
}
/** 用道具：手上有卡就用卡（0 點），沒有就付點數 */
function payCard(who, card, price) {
  if ((heldCards(who.key)[card] || 0) > 0) return 0;
  const c = coinsOf(who.key);
  if (c.coins < price) throw new Error('點數不夠（' + card + '要 ' + price + ' 點，你有 ' + c.coins + ' 點）');
  return price;
}
/** 買特殊道具送給同學：送禮的人付點數，對方得到一張可以免費使用的卡 */
function giftCard(who, card, to) {
  const price = GIFT_CARDS()[card];
  if (price == null) throw new Error('這個道具不能送人');
  if (getStudents().students.indexOf(to) < 0 || to === who.key) throw new Error('請選擇要送的同學');
  const giver = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  withLock(() => {
    const c = coinsOf(who.key);
    if (c.coins < price) throw new Error('點數不夠（' + card + '要 ' + price + ' 點，你有 ' + c.coins + ' 點）');
    addSpend(who.key, price, '送禮', to, card);
    const sh = getSheet(SHEET_CARDS, HEAD_CARDS);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_CARDS.length).setValues([[new Date(), to, card, 1, giver + ' 送的']]);
  });
  botMail([[to, '🎁 ' + giver + ' 送你一張「' + card + '」！\n到「🛍 商店 → 特殊道具」就可以免費使用（會顯示「🎟 你有 1 張」）。\n' + CONFIG.SITE_URL + '#tab=shop']], GIFT_BOT);
  return shopState(who);
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
  const list = spendRows().filter(x => x.use === '煙火' && x.t >= since).map(x => ({ id: x.id, by: x.who, to: x.target, time: x.time }));
  try { return list.concat(investFireworks()); } catch (e) { return list; }
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
/** 放大看的時候用的高畫質大頭照：「大頭照_高畫質」資料夾（和「大頭照」同一層、檔名一樣）；沒有就回傳空的 */
function getFaceHD(code) {
  const root = getRootFolder(), it = root.getFoldersByName('大頭照_高畫質');
  if (!code || !it.hasNext()) return { ok: true, d: '' };
  const byName = faceNameMap(), files = it.next().getFiles(), unmatched = [];
  let hit = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!/^image\//.test(f.getMimeType())) continue;
    const c = fileCode(f.getName(), byName);
    if (c === code) { hit = f; break; }
    if (!c) unmatched.push(f);
  }
  if (!hit && code === 'T00' && unmatched.length === 1) hit = unmatched[0]; // 導師的照片（沒設定檔名時）
  if (!hit || hit.getSize() > 1500000) return { ok: true, d: '' };
  const b = hit.getBlob();
  return { ok: true, d: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
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

// ── 檢查紀錄：只保留「不好」和「未出席」（狀態欄寫「不好」「好、未出席」…）；改成其他狀態時會自動刪掉那一列 ──
function saveRecords(rows) {
  return withLock(() => {
    const sh = getRecordsSheet();
    const last = sh.getLastRow();
    const keys = last > 1 ? sh.getRange(2, COL_KEY, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const index = new Map(keys.map((k, i) => [k, i + 2]));
    const updates = [], deletes = [], appends = new Map();
    if (!sh.getRange(1, 8).getValue()) sh.getRange(1, 8).setValue('狀態').setFontWeight('bold').setBackground('#ede7fb');   // 舊的工作表補上欄位名稱
    rows.forEach(r => {
      const row = index.get(r.key);
      const st = String(r.status || '');
      if (st.indexOf('不好') < 0 && st.indexOf('未出席') < 0) {
        if (row) deletes.push(row);
        appends.delete(r.key);
        return;
      }
      const note = (r.issue ? '【有狀況】' : '') + (r.note || '');
      const vals = [toDate(r.date), r.item, r.owner, note, '', r.inspector || '', r.key, st];
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

// ── 👋 掃區打卡：負責的同學點自己的區域 → 勾「掃區乾淨」→ 簽到；大家在地圖上看到招手圖示（僅供參考，以檢查結果為準）──
const SHEET_CHECKIN = '掃區打卡';
const HEAD_CHECKIN = ['日期', '單位', '地方', '同學', '時間', '乾淨'];
const CHECK_BOT = '🧹 掃地檢查';
const checkinSheet = () => textSheet(SHEET_CHECKIN, HEAD_CHECKIN, [1, 2, 3, 4, 5]);
function getCheckins(date) {
  const d = String(date || ymd(new Date())), sh = getSS().getSheetByName(SHEET_CHECKIN);
  if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [], appeals: appealsOf(d) };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_CHECKIN.length).getValues()
    .filter(r => String(r[0]) === d)
    .map(r => ({ unit: String(r[1]), place: String(r[2]), key: String(r[3]), time: String(r[4]), clean: r[5] === true || String(r[5]) === 'TRUE' }));
  return { ok: true, rows: rows, appeals: appealsOf(d) };
}
function checkin(who, unit, place, clean) {
  if (who.teacher) throw new Error('導師不用打卡');
  unit = String(unit || '').slice(0, 60); place = String(place || '').slice(0, 60);
  if (!unit) throw new Error('請選擇打掃的區域');
  if (!clean) throw new Error('請先勾選「掃區乾淨」');
  const d = ymd(new Date()), t = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm');
  withLock(() => {
    const sh = checkinSheet(), n = sh.getLastRow() - 1;
    const vals = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
    const i = vals.findIndex(r => String(r[0]) === d && String(r[1]) === unit && String(r[3]) === who.key);
    if (i >= 0) sh.getRange(i + 2, 5, 1, 2).setValues([[t, true]]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_CHECKIN.length).setValues([[d, unit, place, who.key, t, true]]);
  });
  return getCheckins(d);
}
// ── 💬 掃區意見：負責的同學對檢查結果有意見可以留言；檢查的人、導師可以回覆（像對話一樣）──
const SHEET_APPEAL = '掃區意見';
const HEAD_APPEAL = ['日期', '單位', '地方', '留言的人', '身分', '內容', '時間'];
const appealSheet = () => textSheet(SHEET_APPEAL, HEAD_APPEAL, [1, 2, 3, 4, 5, 6, 7]);
function appealsOf(d) {
  const sh = getSS().getSheetByName(SHEET_APPEAL);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_APPEAL.length).getValues().filter(r => String(r[0]) === d)
    .map(r => ({ unit: String(r[1]), place: String(r[2]), key: String(r[3]), role: String(r[4]), text: String(r[5]), time: String(r[6]) }));
}
function postAppeal(who, unit, place, text, to) {
  unit = String(unit || '').slice(0, 60); place = String(place || '').slice(0, 60); text = String(text || '').trim().slice(0, 300);
  if (!unit || !text) throw new Error('請寫下你的意見');
  const me = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  const role = who.teacher ? '導師' : isInspector(who.key) ? '檢查' : '負責';
  const d = ymd(new Date()), t = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm');
  withLock(() => { appealSheet().appendRow([d, unit, place, me, role, text, t]); });
  const students = getStudents().students, ok = students.concat([CONFIG.TEACHER_NAME]);
  // 收件人可以是完整的名字，或只是座號（例如「料26」）
  const resolve = k => (ok.indexOf(k) >= 0 ? k : k === '導師' ? CONFIG.TEACHER_NAME : students.find(s => faceCode(s) === faceCode(k)) || '');
  const list = (to || []).map(k => resolve(String(k))).filter((k, i, a) => k && k !== me && a.indexOf(k) === i).slice(0, 10);
  botMail(list.map(k => [k, '💬 ' + (who.teacher ? '導師' : me) + ' 對「' + place + '」的掃地檢查' + (role === '負責' ? '有意見' : '回覆了') + '：\n' + text + '\n' + CONFIG.SITE_URL + '#tab=clean']), CHECK_BOT);
  return getCheckins(d);
}

/** 檢查的人送出報表：不好（掃區不乾淨）、未出席的同學各收到一封飛鴿傳書 */
function notifyCheck(who, list) {
  const students = getStudents().students;
  const mails = (list || []).slice(0, 80).filter(x => x && students.indexOf(String(x.to)) >= 0 && x.text)
    .map(x => [String(x.to), String(x.text).slice(0, 1500) + '\n' + CONFIG.SITE_URL + '#tab=clean']);
  botMail(mails, CHECK_BOT);
  return { ok: true, sent: mails.length };
}

// ── 掃地檢查即時狀態：導師和檢查幹部互相看得到檢查結果（每天每個檢查單位一列，存整筆紀錄）──
const SHEET_LIVE = '檢查即時狀態';
const HEAD_LIVE = ['日期', '單位', '紀錄', '更新時間', '檢查人'];
const liveSheet = () => textSheet(SHEET_LIVE, HEAD_LIVE, [1, 2, 3, 5]);
function getCheckLive(date) {
  const d = String(date || ''), sh = liveSheet(), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, rows: [] };
  const rows = [];
  sh.getRange(2, 1, n, 3).getValues().forEach(r => {
    if (String(r[0]) !== d) return;
    try { rows.push({ unit: String(r[1]), rec: JSON.parse(r[2]) }); } catch (e) { /* 壞掉的列就跳過 */ }
  });
  return { ok: true, rows: rows };
}
/** 近兩週每位同學每天的打掃結果（好／有瑕疵／不好、未出席），給檢查視窗的燈號用；同學只能看自己的 */
function checkHistory(who, owners) {
  const can = who.teacher || isInspector(who.key);
  owners = (owners || []).map(String).filter(k => can || k === who.key).slice(0, 10);
  const out = {};
  owners.forEach(k => { out[k] = {}; });
  if (!owners.length) return { ok: true, hist: out };
  const sh = liveSheet(), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, hist: out };
  const cut = Utilities.formatDate(new Date(Date.now() - 15 * 864e5), CONFIG.TIMEZONE, 'yyyy/MM/dd');
  const rank = { '': 0, '好': 1, '有瑕疵': 2, '不好': 3 };
  sh.getRange(2, 1, n, 3).getValues().forEach(r => {
    const d = String(r[0]);
    if (d < cut) return;
    const rec = arenaJson(r[2]);
    if (!rec) return;
    owners.forEach(k => {
      let base = (rec.status || {})[k] || '', absent = !!(rec.absent || {})[k];
      if (base === '未出席') { base = ''; absent = true; }
      if (!base && !absent) return;
      const cur = out[k][d] || { b: '', a: false };   // 同一天好幾個地方：取最差的
      if (rank[base] > rank[cur.b]) cur.b = base;
      cur.a = cur.a || absent;
      out[k][d] = cur;
    });
  });
  return { ok: true, hist: out };
}
function setCheckLive(who, date, rows) {
  const d = String(date || '');
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(d)) throw new Error('日期格式不對');
  return withLock(() => {
    const sh = liveSheet(), n = sh.getLastRow() - 1;
    const vals = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
    const index = new Map(vals.map((r, i) => [String(r[0]) + '|' + r[1], i]));
    const appends = new Map(), by = who.teacher ? '導師' : String(who.key);
    let saved = 0;
    rows.slice(0, 80).forEach(x => {
      const unit = String(x.unit || ''), rec = x.rec || {}, at = Number(rec.updatedAt) || 0;
      const s = JSON.stringify(rec);
      if (!unit || s.length > 40000) return;
      const row = [d, unit, s, at, by], i = index.get(d + '|' + unit);
      if (i == null) {   // 新的一列（同一批裡重複的，留最新的）
        if (!appends.has(unit) || appends.get(unit)[3] < at) appends.set(unit, row);
      } else if ((Number(vals[i][3]) || 0) < at) {   // 以最後儲存的為準
        sh.getRange(i + 2, 1, 1, 5).setValues([row]);
        saved++;
      }
    });
    if (appends.size) {
      const list = Array.from(appends.values());
      sh.getRange(sh.getLastRow() + 1, 1, list.length, 5).setValues(list);
      saved += list.length;
      // 只留最近 15 天（最舊的在最上面；近兩週的燈號要用）
      const cut = Utilities.formatDate(new Date(Date.now() - 15 * 864e5), CONFIG.TIMEZONE, 'yyyy/MM/dd');
      let old = 0;
      while (old < vals.length && String(vals[old][0]) < cut) old++;
      if (old) sh.deleteRows(2, old);
    }
    return { ok: true, saved: saved };
  });
}

// ── ⚔️ 擂台賽：同學互相挑戰（英文單字／日文五十音）；雙方接受後同時開始，同一組題目、每題 5 秒，
//    先答錯（或超時）就停，答對多的贏（一樣多比總作答時間）；贏的人得到商店點數 1 點。同一對同學每天只能比 1 場。──
const SHEET_ARENA = '擂台賽';
const HEAD_ARENA = ['編號', '建立時間', '挑戰者', '對手', '科目', '狀態', '種子', '開始時間', '挑戰者成績', '對手成績', '勝方', '結束時間'];
const ARENA_BOT = '⚔️ 擂台賽';
const ARENA = { MAX_Q: 50, SEC: 5, WAIT_MIN: 30, SHOW_H: 24 };
const ARENA_SUBJ = { en: '英文', jp: '日文' };
const arenaSheet = () => textSheet(SHEET_ARENA, HEAD_ARENA, [1, 3, 4, 5, 6, 9, 10, 11]);
const arenaJson = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
function arenaRows() {
  const sh = arenaSheet(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, HEAD_ARENA.length).getValues().map((r, i) => ({
    row: i + 2, id: String(r[0]), t: r[1] instanceof Date ? r[1].getTime() : Number(r[1]) || 0, a: String(r[2]), b: String(r[3]),
    subj: String(r[4]), status: String(r[5]), seed: Number(r[6]) || 0, start: Number(r[7]) || 0,
    ra: arenaJson(r[8]), rb: arenaJson(r[9]), win: String(r[10]), end: Number(r[11]) || 0,
  })).filter(x => x.id);
}
const arenaCache = () => CacheService.getScriptCache();
const arenaProg = (id, k) => arenaJson(arenaCache().get('ar:pg:' + id + ':' + k));
const arenaReadyOf = (id, k) => !!arenaCache().get('ar:rd:' + id + ':' + k);
const arenaDeadline = x => x.start + ARENA.MAX_Q * ARENA.SEC * 1000 + 90e3;
function arenaSet(x, cols) {   // cols：{ 欄位編號: 值 }
  const sh = arenaSheet();
  Object.keys(cols).forEach(c => sh.getRange(x.row, Number(c)).setValue(cols[c]));
}
/** 比完了：決定勝負、發 1 點商店點數、寄飛鴿傳書 */
function arenaFinish(x) {
  const ra = x.ra || arenaProg(x.id, x.a) || { n: 0, ms: 0 }, rb = x.rb || arenaProg(x.id, x.b) || { n: 0, ms: 0 };
  let win = '平手';
  if (Math.max(ra.n, rb.n) < 3) win = '不算數';   // 兩個人都沒答對 3 題以上：這場不算（不發點數、座位不顯示，同一對今天可以再比）
  else if (ra.n !== rb.n) win = ra.n > rb.n ? x.a : x.b;
  else if (ra.n > 0 && ra.ms !== rb.ms) win = ra.ms < rb.ms ? x.a : x.b;
  const now = Date.now();
  arenaSet(x, { 6: '完成', 9: JSON.stringify({ n: ra.n, ms: ra.ms }), 10: JSON.stringify({ n: rb.n, ms: rb.ms }), 11: win, 12: now });
  Object.assign(x, { status: '完成', ra: ra, rb: rb, win: win, end: now });
  const subj = ARENA_SUBJ[x.subj] || x.subj, score = ra.n + '：' + rb.n;
  const url = '\n' + CONFIG.SITE_URL + '#tab=arena';
  if (win === '不算數') {
    const t = subj + '擂台賽（' + score + '）兩個人都沒有答對 3 題以上，這場不算數。\n今天還可以再比一次！';
    botMail([[x.a, '⚔️ 你和 ' + x.b + ' 的' + t + url], [x.b, '⚔️ 你和 ' + x.a + ' 的' + t + url]], ARENA_BOT);
    return x;
  }
  if (win === '平手') {
    botMail([[x.a, '⚔️ 你和 ' + x.b + ' 的' + subj + '擂台賽平手（' + score + '，時間也一樣）！' + url], [x.b, '⚔️ 你和 ' + x.a + ' 的' + subj + '擂台賽平手（' + score + '，時間也一樣）！' + url]], ARENA_BOT);
    return x;
  }
  const lose = win === x.a ? x.b : x.a, wr = win === x.a ? ra : rb, lr = win === x.a ? rb : ra;
  const d = new Date(now);
  const sh = pointsSheet(), at = sh.getLastRow() + 1;
  sh.getRange(at, 1, 1, HEAD_POINTS.length).setValues([[d, win, 1, '擂台賽', subj + '擂台賽打敗 ' + faceCode(lose) + '（' + wr.n + '：' + lr.n + '）', ARENA_BOT, d, 'AR-' + x.id]]);
  sh.getRange(at, 1).setNumberFormat('yyyy/mm/dd');
  sh.getRange(at, 7).setNumberFormat('yyyy/mm/dd hh:mm');
  try { petLay(win, subj + '擂台賽打敗 ' + faceCode(lose), null, 1); } catch (e) { Logger.log('寵物蛋：' + e); }   // 🐾 擂台賽獲勝也算被加分，生一顆寵物蛋
  const tie = wr.n === lr.n ? '（答對題數一樣，你比較快）' : '';
  botMail([
    [win, '👑 你在' + subj + '擂台賽打敗了 ' + lose + '！（' + wr.n + '：' + lr.n + '）' + tie + '\n獲得商店點數 1 點，座位上也戴上了皇冠（顯示一天）。' + url],
    [lose, '😵 你在' + subj + '擂台賽輸給了 ' + win + '（' + lr.n + '：' + wr.n + '）。\n別灰心，多練習「📚 小練習」，明天再來挑戰！' + url],
  ], ARENA_BOT);
  return x;
}
/** 逾時的邀請、比太久沒結束的比賽：整理一下（要在 withLock 裡面呼叫） */
function arenaTidy(rows) {
  const now = Date.now();
  rows.forEach(x => {
    if ((x.status === '邀請' || x.status === '接受') && now - x.t > ARENA.WAIT_MIN * 60e3) { arenaSet(x, { 6: '逾時' }); x.status = '逾時'; }
    else if (x.status === '進行中' && now > arenaDeadline(x)) arenaFinish(x);
    else if (x.status === '進行中') {
      const pa = x.ra || arenaProg(x.id, x.a), pb = x.rb || arenaProg(x.id, x.b);
      if (pa && pa.done && pb && pb.done) { x.ra = pa; x.rb = pb; arenaFinish(x); }
    }
  });
  return rows;
}
const arenaActive = s => s === '邀請' || s === '接受' || s === '進行中';
function arenaState(who) {
  const me = who.teacher || who.role === 'G' ? '' : who.key, now = Date.now();
  let rows = arenaRows();
  if (rows.some(x => (arenaActive(x.status)))) rows = withLock(() => arenaTidy(arenaRows()));
  const mine = rows.filter(x => me && (x.a === me || x.b === me) && (arenaActive(x.status) || (x.status === '完成' && now - x.end < 10 * 60e3)))
    .map(x => {
      const opp = x.a === me ? x.b : x.a;
      return {
        id: x.id, a: x.a, b: x.b, subj: x.subj, status: x.status, t: x.t, start: x.start, seed: x.status === '進行中' ? x.seed : 0,
        readyA: arenaReadyOf(x.id, x.a), readyB: arenaReadyOf(x.id, x.b),
        opp: x.status === '完成' ? (x.a === opp ? x.ra : x.rb) : arenaProg(x.id, opp), win: x.win,
        ra: x.status === '完成' ? x.ra : null, rb: x.status === '完成' ? x.rb : null,
      };
    });
  const recent = rows.filter(x => x.status === '完成' && now - x.end < ARENA.SHOW_H * 3600e3)
    .map(x => ({ id: x.id, a: x.a, b: x.b, subj: x.subj, win: x.win, na: (x.ra || {}).n || 0, nb: (x.rb || {}).n || 0, end: x.end }));
  let wins = 0, losses = 0;
  if (me) rows.forEach(x => { if (x.status !== '完成' || (x.a !== me && x.b !== me) || x.win === '平手' || x.win === '不算數') return; if (x.win === me) wins++; else losses++; });
  const today = ymd(new Date());
  const played = me ? rows.filter(x => (x.a === me || x.b === me) && ymd(new Date(x.t)) === today && (arenaActive(x.status) || x.status === '完成')).map(x => (x.a === me ? x.b : x.a)) : [];
  return { ok: true, me: me, now: Date.now(), mine: mine, recent: recent, wins: wins, losses: losses, played: played, rules: ARENA };
}
function arenaChallenge(who, to, subj) {
  if (who.teacher) throw new Error('導師不能參加擂台賽');
  to = String(to || '');
  if (!ARENA_SUBJ[subj]) throw new Error('請選英文或日文');
  if (!to || to === who.key) throw new Error('請選一位同學');
  if (getStudents().students.indexOf(to) < 0) throw new Error('名單裡找不到這位同學');
  withLock(() => {
    const rows = arenaTidy(arenaRows()), today = ymd(new Date());
    const pair = rows.find(x => ((x.a === who.key && x.b === to) || (x.a === to && x.b === who.key)) && ymd(new Date(x.t)) === today && (arenaActive(x.status) || (x.status === '完成' && x.win !== '不算數')));
    if (pair) throw new Error(pair.status === '完成' ? '你們今天已經比過了，明天再來挑戰！' : '你們之間已經有一場挑戰還沒結束');
    const id = Utilities.getUuid().slice(0, 8), sh = arenaSheet(), at = sh.getLastRow() + 1;
    sh.getRange(at, 1, 1, HEAD_ARENA.length).setValues([[id, new Date(), who.key, to, subj, '邀請', '', '', '', '', '', '']]);
    botMail([[to, '⚔️ ' + who.key + ' 向你發起「' + ARENA_SUBJ[subj] + '擂台賽」挑戰！\n' + ARENA.WAIT_MIN + ' 分鐘內到「⚔️ 擂台」按「接受」，兩個人都按「我準備好了」就開始。' + '\n' + CONFIG.SITE_URL + '#tab=arena']], ARENA_BOT);
  });
  return arenaState(who);
}
function arenaRespond(who, id, act) {
  withLock(() => {
    const x = arenaTidy(arenaRows()).find(r => r.id === String(id));
    if (!x) throw new Error('找不到這場挑戰');
    if (act === 'cancel') {
      if (x.a !== who.key && x.b !== who.key) throw new Error('這不是你的挑戰');
      if (x.status !== '邀請' && x.status !== '接受') throw new Error('比賽已經開始或結束了');
      arenaSet(x, { 6: '取消' });
      botMail([[x.a === who.key ? x.b : x.a, '⚔️ ' + who.key + ' 取消了和你的' + (ARENA_SUBJ[x.subj] || '') + '擂台賽。']], ARENA_BOT);
      return;
    }
    if (x.b !== who.key) throw new Error('只有被挑戰的人可以接受或拒絕');
    if (x.status !== '邀請') throw new Error('這場挑戰已經' + x.status);
    if (act === 'no') {
      arenaSet(x, { 6: '拒絕' });
      botMail([[x.a, '⚔️ ' + who.key + ' 這次沒有接受你的' + (ARENA_SUBJ[x.subj] || '') + '擂台賽挑戰。']], ARENA_BOT);
      return;
    }
    arenaSet(x, { 6: '接受' });
    botMail([[x.a, '⚔️ ' + who.key + ' 接受了你的' + (ARENA_SUBJ[x.subj] || '') + '擂台賽挑戰！到「⚔️ 擂台」按「我準備好了」就開始。\n' + CONFIG.SITE_URL + '#tab=arena']], ARENA_BOT);
  });
  return arenaState(who);
}
/** 我準備好了：兩個人都準備好，就決定題目（種子）和開始時間（4 秒後，兩邊一起倒數） */
function arenaReady(who, id) {
  withLock(() => {
    const x = arenaTidy(arenaRows()).find(r => r.id === String(id));
    if (!x || (x.a !== who.key && x.b !== who.key)) throw new Error('找不到這場挑戰');
    if (x.status !== '接受') return;
    arenaCache().put('ar:rd:' + x.id + ':' + who.key, '1', 1800);
    const other = x.a === who.key ? x.b : x.a;
    if (!arenaReadyOf(x.id, other)) return;
    arenaSet(x, { 6: '進行中', 7: Math.floor(Math.random() * 2147483647) + 1, 8: Date.now() + 4000 });
  });
  return arenaState(who);
}
/** 作答進度（每答一題送一次；存在快取，不寫試算表）；done＝答錯或超時，比賽結束 */
function arenaProgress(who, id, n, ms, done) {
  n = Math.max(0, Math.min(ARENA.MAX_Q, Math.floor(Number(n) || 0)));
  ms = Math.max(0, Math.floor(Number(ms) || 0));
  const p = { n: n, ms: ms, done: !!done };
  arenaCache().put('ar:pg:' + id + ':' + who.key, JSON.stringify(p), 3600);
  if (done) withLock(() => {
    const x = arenaRows().find(r => r.id === String(id));
    if (!x || x.status !== '進行中' || (x.a !== who.key && x.b !== who.key)) return;
    if (n > 0 && ms < n * 250) p.n = 0;   // 太快了（不可能的速度）不算
    const col = x.a === who.key ? 9 : 10;
    arenaSet(x, { [col]: JSON.stringify(p) });
    x[col === 9 ? 'ra' : 'rb'] = p;
    const other = col === 9 ? (x.rb || arenaProg(x.id, x.b)) : (x.ra || arenaProg(x.id, x.a));
    if (other && other.done) { if (col === 9) x.rb = other; else x.ra = other; arenaFinish(x); }
  });
  return arenaState(who);
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
// ── 📊 加扣分紀錄（最右邊的分頁）：每位同學的加分、扣分、合計，點數字看每一筆的原因、時間、登記人 ──
//    包含「加扣分紀錄」工作表，和掃地檢查的扣分（不好：扣分統計 B3 的分數；未出席：ABSENT_PER）。從「重置扣分統計」之後開始算。
function pointsBoard(who) {
  const rst = resetAt(), tz = CONFIG.TIMEZONE, out = [];
  const mine = k => who.teacher || k === who.key;
  const psh = pointsSheet();
  if (psh.getLastRow() > 1) psh.getRange(2, 1, psh.getLastRow() - 1, HEAD_POINTS.length).getValues().forEach(r => {
    const k = String(r[1]).trim(), p = Number(r[2]) || 0;
    if (!k || !p || !mine(k)) return;
    const t = r[6] instanceof Date ? r[6].getTime() : r[0] instanceof Date ? r[0].getTime() : 0;
    if (t < rst) return;
    out.push({ key: k, p: p, cat: String(r[3]).trim(), reason: String(r[4]).trim(), by: String(r[5]).trim(), t: t,
      day: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy/MM/dd') : '', time: t ? Utilities.formatDate(new Date(t), tz, 'MM/dd HH:mm') : '' });
  });
  // 掃地檢查：同一天、同一處、同一人只算一次（和扣分統計一樣）
  const ssh = getSS().getSheetByName(SHEET_SCORE);
  const per = (ssh && Number(ssh.getRange('B3').getValue())) || 1, absentPer = Number(CONFIG.ABSENT_PER) || 0.1;
  const rec = getSS().getSheetByName(SHEET_RECORDS), seen = {};
  if (rec && rec.getLastRow() > 1) rec.getRange(2, 1, rec.getLastRow() - 1, HEAD_RECORDS.length).getValues().forEach(r => {
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]), place = String(r[1]), k = String(r[2]).trim();
    if (!k || k === '值日生' || isNaN(d) || !mine(k) || recTime(d, r[6]) < rst) return;
    const st = String(r[7] || ''), day = Utilities.formatDate(d, tz, 'yyyy/MM/dd'), base = day + '|' + place + '|' + k;
    const add = (kind, p, why) => {
      if (seen[base + kind]) return;
      seen[base + kind] = true;
      out.push({ key: k, p: -p, cat: '整潔', reason: why + '：' + place + (r[3] ? '（' + String(r[3]).replace(/\s+/g, ' ') + '）' : ''), by: String(r[5]).trim() || '掃地檢查', t: d.getTime(), day: day, time: Utilities.formatDate(d, tz, 'MM/dd'), check: true });
    };
    if (!st || st.indexOf('不好') >= 0) add('|bad', per, '掃地檢查不好');
    if (st.indexOf('未出席') >= 0) add('|absent', absentPer, '掃地未出席');
  });
  try {
    leaveLatePenalties(rst).forEach(x => {
      if (!mine(x.key)) return;
      out.push({ key: x.key, p: x.p, cat: '請假', reason: '假卡' + (x.done ? '晚交 ' : '逾期未交 ') + x.days + ' 天（' + x.text + '）', by: '系統', t: x.t,
        day: Utilities.formatDate(new Date(x.t), tz, 'yyyy/MM/dd'), time: Utilities.formatDate(new Date(x.t), tz, 'MM/dd'), check: false });
    });
  } catch (e) { /* 請假資料讀不到就先不算 */ }
  try {
    hwLatePenalties(rst).forEach(x => {
      if (!mine(x.key)) return;
      out.push({ key: x.key, p: x.p, cat: '繳交', reason: '「' + x.name + '」' + (x.done ? '遲交 ' : '逾期未交 ') + x.days + ' 天（每天 −' + (Number(CONFIG.HW_LATE_PER) || 0.1) + '）', by: x.to, t: x.end,
        day: Utilities.formatDate(new Date(x.end), tz, 'yyyy/MM/dd'), time: Utilities.formatDate(new Date(x.end), tz, 'MM/dd'), check: false });
    });
  } catch (e) { /* 繳交資料讀不到就先不算 */ }
  out.sort((a, b) => b.t - a.t);
  return { ok: true, rows: out, all: !!who.teacher, students: who.teacher ? getStudents().students : [who.key],
    since: rst ? Utilities.formatDate(new Date(rst), tz, 'yyyy/MM/dd') : '' };
}

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
  const absentPer = Number(CONFIG.ABSENT_PER) || 0.1;
  data.forEach(r => {
    const d = r[0] instanceof Date ? r[0] : new Date(r[0]);
    const place = String(r[1]), who = String(r[2]).trim();
    if (!who || who === '值日生' || isNaN(d)) return;
    const t = d.getTime();
    if (t < fromT || t > toT || recTime(d, r[6]) < rst) return;
    // 狀態欄是空的＝舊紀錄（那時只記「不好」）
    const st = String(r[7] || ''), bad = !st || st.indexOf('不好') >= 0, absent = st.indexOf('未出席') >= 0;
    const s = stats[who] || (stats[who] = { n: 0, list: [], a: 0, alist: [] });
    const day = Utilities.formatDate(d, CONFIG.TIMEZONE, 'M/d');
    // 同一天、同一處、同一人只算一次（避免導師與股長重複記錄）；不好、未出席分開算
    const k = Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyyMMdd') + '|' + place + '|' + who;
    if (bad && !seen[k + '|bad']) { seen[k + '|bad'] = true; s.n++; s.list.push({ t: t, day: day }); }
    if (absent && !seen[k + '|absent']) { seen[k + '|absent'] = true; s.a++; s.alist.push({ t: t, day: day }); }
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

  // 請假：登記超過 3 天還沒上傳假卡，每天扣分，算進「其他」
  try {
    leaveLatePenalties(rst).forEach(x => {
      if (x.t < fromT || x.t > toT) return;
      const s = pts[x.key] || (pts[x.key] = { clean: 0, order: 0, other: 0, list: [] });
      s.other = Math.round((s.other + x.p) * 100) / 100;
      s.list.push({ t: x.t, text: Utilities.formatDate(new Date(x.t), CONFIG.TIMEZONE, 'M/d') + ' 請假' + x.p + ' 假卡' + (x.done ? '晚交 ' : '逾期未交 ') + x.days + ' 天（' + x.text + '）' });
    });
  } catch (e) { Logger.log('請假逾期扣分計算失敗：' + e); }
  // 繳交追蹤：逾期每天扣分，算進「其他」
  try {
    hwLatePenalties(rst).forEach(x => {
      if (x.end < fromT || x.end > toT) return;
      const s = pts[x.key] || (pts[x.key] = { clean: 0, order: 0, other: 0, list: [] });
      s.other = Math.round((s.other + x.p) * 100) / 100;
      s.list.push({ t: x.end, text: Utilities.formatDate(new Date(x.end), CONFIG.TIMEZONE, 'M/d') + ' 繳交' + x.p + ' 「' + x.name + '」' + (x.done ? '遲交 ' : '逾期未交 ') + x.days + ' 天' });
    });
  } catch (e) { Logger.log('繳交逾期扣分計算失敗：' + e); }
  // 導師填的段考成績：先讀出來（依 科別＋座號＋姓名），重寫時放回去
  const exams = readExamScores(sh);

  let roster = [], className = '', err = '';
  try { const st = getStudents(); roster = st.students; className = st.className; } catch (e) { err = String(e.message || e); }
  Object.keys(stats).concat(Object.keys(pts)).forEach(who => { if (roster.indexOf(who) < 0) roster.push(who); });
  const rows = roster.map(who => {
    const s = stats[who] || { n: 0, list: [], a: 0, alist: [] };
    const q = pts[who] || { clean: 0, order: 0, other: 0, list: [] };
    const m = who.match(/^(\D*?)(\d+)(.*)$/) || [who, '', '', who];
    const days = [], count = {};
    s.list.sort((a, b) => a.t - b.t).forEach(x => { if (!count[x.day]) days.push(x.day); count[x.day] = (count[x.day] || 0) + 1; });
    const bad = days.map(dd => (count[dd] > 1 ? dd + '(' + count[dd] + ')' : dd)).join('、');
    const adays = [], acount = {};
    s.alist.sort((a, b) => a.t - b.t).forEach(x => { if (!acount[x.day]) adays.push(x.day); acount[x.day] = (acount[x.day] || 0) + 1; });
    const absentTxt = adays.map(dd => (acount[dd] > 1 ? dd + '(' + acount[dd] + ')' : dd)).join('、');
    const clean = Math.round((-s.n * per - s.a * absentPer + q.clean) * 100) / 100;   // 未出席每次 −0.1
    const total = Math.round((clean + q.order + q.other) * 100) / 100;
    const detail = [bad ? '整潔不好：' + bad : '', absentTxt ? '掃地未出席（每次 −' + absentPer + '）：' + absentTxt : '', q.list.sort((a, b) => a.t - b.t).map(x => x.text).join('\n')].filter(String).join('\n');
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

// ════════ 📝 請假：同學登記、上傳簽好章的假卡；導師看總表、確認或退回 ════════
const SHEET_LEAVE = '請假';
const HEAD_LEAVE = ['編號', '登記時間', '同學', '假別', '開始日期', '開始節', '結束日期', '結束節', '說明', '狀態', '假卡', '導師備註', '登記人', '更新時間', '假卡上傳時間'];
const LEAVE_TYPES = ['事假', '病假', '公假', '喪假', '生理假', '身心調適假'];
const LEAVE_BOT = '📝 請假通知';
// 狀態：已登記（還沒交假卡）→ 已上傳假卡（等導師確認）→ 已確認；或 退回、已取消
const leaveSheet = () => textSheet(SHEET_LEAVE, HEAD_LEAVE, [5, 7]);
function leaveRows() {
  const sh = getSS().getSheetByName(SHEET_LEAVE);
  if (!sh || sh.getLastRow() < 2) return [];
  const d = v => (v instanceof Date ? ymd(v) : String(v).replace(/^'/, '').trim());
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_LEAVE.length).getValues().map((r, i) => ({
    row: i + 2, id: String(r[0]), t: r[1] instanceof Date ? r[1].getTime() : 0, time: r[1] instanceof Date ? Utilities.formatDate(r[1], CONFIG.TIMEZONE, 'MM/dd HH:mm') : '',
    key: String(r[2]).trim(), type: String(r[3]), from: d(r[4]), fromP: Number(r[5]) || 0, to: d(r[6]), toP: Number(r[7]) || 0, note: String(r[8]),
    status: String(r[9]), cards: String(r[10] || '').split(',').filter(String), reply: String(r[11]), by: String(r[12]),
    cardT: r[14] instanceof Date ? r[14].getTime() : 0,   // 第一次上傳假卡的時間（算「登記 → 上傳假卡」花了幾天）
  })).filter(x => x.id);
}
const leavePub = x => ({ id: x.id, time: x.time, t: x.t, cardT: x.cardT, key: x.key, type: x.type, from: x.from, fromP: x.fromP, to: x.to, toP: x.toP, note: x.note, status: x.status, cards: x.cards, reply: x.reply, by: x.by });
const PERIOD = p => (Number(p) === 0 ? '早自習' : '第' + p + '節');
const leaveText = x => x.type + '：' + x.from.slice(5) + ' ' + PERIOD(x.fromP) + (x.from === x.to ? (x.fromP === x.toP ? '' : '～' + PERIOD(x.toP)) : ' ～ ' + x.to.slice(5) + ' ' + PERIOD(x.toP));
/** 請假逾期：登記後超過 LEAVE_LATE_DAYS 天還沒上傳假卡 → 寄一次飛鴿傳書給同學和導師（任何人打開 App 讀請假時檢查） */
function leaveTick() {
  const props = PropertiesService.getScriptProperties(), K = 'LEAVE_LATE_SENT';
  const sent = JSON.parse(props.getProperty(K) || '[]'), lim = (Number(CONFIG.LEAVE_LATE_DAYS) || 3) * 864e5, now = Date.now();
  const due = leaveRows().filter(x => (x.status === '已登記' || x.status === '退回') && x.t && !x.cardT && now - x.t >= lim && sent.indexOf(x.id) < 0);
  if (!due.length) return;
  const per = Number(CONFIG.LEAVE_LATE_PER) || 0.1, days = Number(CONFIG.LEAVE_LATE_DAYS) || 3;
  botMail(due.map(x => [x.key, '⚠️ 你的請假已經登記超過 ' + days + ' 天，還沒有上傳假卡！\n' + leaveText(x) + '\n請盡快跑完簽核流程（家長 → 導師 → 教官室等處室），把蓋好章的假卡拍照上傳。\n從現在起每多一天扣 ' + per + ' 分，上傳假卡就停止。\n' + CONFIG.SITE_URL + '#tab=leave'])
    .concat(due.map(x => [CONFIG.TEACHER_NAME, '⚠️ ' + x.key + ' 的請假登記超過 ' + days + ' 天還沒上傳假卡（已提醒同學）\n' + leaveText(x) + '\n' + CONFIG.SITE_URL + '#tab=leave'])), LEAVE_BOT);
  props.setProperty(K, JSON.stringify(sent.concat(due.map(x => x.id)).slice(-300)));
}
/** 請假逾期扣分：登記滿 LEAVE_LATE_DAYS 天後，每一天（不滿一天算一天）扣 LEAVE_LATE_PER 分，到上傳假卡為止 */
function leaveLatePenalties(rst) {
  const lim = (Number(CONFIG.LEAVE_LATE_DAYS) || 3) * 864e5, per = Number(CONFIG.LEAVE_LATE_PER) || 0.1, now = Date.now(), out = [];
  leaveRows().forEach(x => {
    if (!x.t || x.t < (rst || 0) || x.status === '已取消') return;
    const stop = x.cardT || ((x.status === '已登記' || x.status === '退回') ? now : 0);   // 導師直接確認、沒有假卡的：不扣
    if (!stop) return;
    const days = Math.ceil((stop - x.t - lim) / 864e5);
    if (days <= 0) return;
    out.push({ key: x.key, days: days, p: -Math.round(days * per * 100) / 100, t: x.t + lim, text: leaveText(x), done: !!x.cardT });
  });
  return out;
}
function getLeave(who) {
  try { leaveTick(); } catch (e) { Logger.log('請假逾期提醒失敗：' + e); }
  const all = leaveRows().filter(x => x.status !== '已取消')
    .sort((a, b) => (b.from + b.fromP).localeCompare(a.from + a.fromP) || b.t - a.t);
  // 班長、副班長：看得到全班的總表（誰、哪天、假別、進度），但看不到別人的說明和假卡照片
  const monitor = !who.teacher && isMonitor(who.key);
  const rows = who.teacher ? all.map(leavePub)
    : monitor ? all.map(x => (x.key === who.key ? leavePub(x) : Object.assign(leavePub(x), { note: '', cards: [], nCards: x.cards.length, other: true })))
    : all.filter(x => x.key === who.key).map(leavePub);
  return { ok: true, rows: rows, me: who.teacher ? '' : who.key,
    types: LEAVE_TYPES, rules: PropertiesService.getScriptProperties().getProperty('LEAVE_RULES') || '', teacher: !!who.teacher, monitor: monitor };
}
function addLeave(who, r) {
  const key = who.teacher ? String(r.key || '') : who.key;
  if (getStudents().students.indexOf(key) < 0) throw new Error(who.teacher ? '請選擇同學' : '找不到你的名字');
  const type = String(r.type || '');
  if (LEAVE_TYPES.indexOf(type) < 0) throw new Error('請選擇假別');
  const okDate = s => /^\d{4}\/\d\d\/\d\d$/.test(s);
  const from = String(r.from || ''), to = String(r.to || from);
  const fromP = Math.max(0, Math.min(7, Number(r.fromP) || 0)), toP = Math.max(0, Math.min(7, Number(r.toP) || 0));   // 早自習＝0，第 1～7 節（沒有第 8 節）
  if (!okDate(from) || !okDate(to)) throw new Error('請選擇日期');
  if (to < from || (to === from && toP < fromP)) throw new Error('結束的時間要在開始之後');
  const note = String(r.note || '').trim().slice(0, 200), id = Utilities.getUuid().slice(0, 8), by = who.teacher ? CONFIG.TEACHER_NAME : who.key;
  withLock(() => {
    const sh = leaveSheet();
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_LEAVE.length).setValues([[id, new Date(), key, type, from, fromP, to, toP, note, '已登記', '', '', by, new Date(), '']]);
  });
  const x = { type: type, from: from, fromP: fromP, to: to, toP: toP };
  if (!who.teacher) botMail([[CONFIG.TEACHER_NAME, '📝 ' + key + ' 登記了請假\n' + leaveText(x) + (note ? '\n說明：' + note : '') + '\n（簽好章的假卡上傳後，就可以在「請假」總表確認）\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  else botMail([[key, '📝 導師幫你登記了請假\n' + leaveText(x) + '\n請記得跑完假卡流程（家長 → 導師 → 教官室），簽完章後在 App 上傳假卡照片。\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
function leaveFolder() {
  const root = getRootFolder(), it = root.getFoldersByName('請假卡');
  return it.hasNext() ? it.next() : root.createFolder('請假卡');
}
function leaveCard(who, id, data) {
  const x = leaveRows().find(r => r.id === id);
  if (!x || (!who.teacher && x.key !== who.key)) throw new Error('找不到這筆請假');
  if (x.status === '已確認') throw new Error('這筆已經確認過了');
  if (x.cards.length >= 5) throw new Error('每一筆最多 5 張假卡照片');
  const m = String(data || '').match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!m) throw new Error('假卡要是照片');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 700000) throw new Error('照片太大了');
  const fid = leaveFolder().createFile(Utilities.newBlob(bytes, 'image/' + m[1], '請假卡_' + x.from.replace(/\//g, '') + '_' + x.key + '_' + x.type + '_' + (x.cards.length + 1) + (m[1] === 'png' ? '.png' : '.jpg'))).getId();
  withLock(() => {
    const sh = leaveSheet();
    const cur = String(sh.getRange(x.row, 11).getValue() || '').split(',').filter(String);
    sh.getRange(x.row, 10, 1, 2).setValues([['已上傳假卡', cur.concat([fid]).join(',')]]);
    sh.getRange(x.row, 14).setValue(new Date());
    if (!sh.getRange(1, 15).getValue()) sh.getRange(1, 15).setValue(HEAD_LEAVE[14]).setFontWeight('bold').setBackground('#ede7fb');   // 舊的工作表補上欄位名稱
    if (!x.cardT) sh.getRange(x.row, 15).setValue(new Date()).setNumberFormat('yyyy/mm/dd hh:mm');
  });
  if (!who.teacher) botMail([[CONFIG.TEACHER_NAME, '📝 ' + x.key + ' 上傳了假卡，請確認\n' + leaveText(x) + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
function getLeaveCard(who, fid) {
  fid = String(fid || '');
  const x = leaveRows().find(r => r.cards.indexOf(fid) >= 0);
  if (!x || (!who.teacher && x.key !== who.key)) throw new Error('找不到這張假卡');
  const b = DriveApp.getFileById(fid).getBlob();
  return { ok: true, d: 'data:' + b.getContentType() + ';base64,' + Utilities.base64Encode(b.getBytes()) };
}
/** 刪除一張假卡（只是從這筆請假拿掉，雲端硬碟「請假卡」資料夾裡的檔案保留）：同學在導師確認前可以刪自己的；導師隨時可以刪 */
function delLeaveCard(who, id, fid) {
  const x = leaveRows().find(r => r.id === id);
  if (!x || (!who.teacher && x.key !== who.key)) throw new Error('找不到這筆請假');
  if (!who.teacher && x.status === '已確認') throw new Error('導師已經確認了，要修改請直接跟導師說');
  if (x.cards.indexOf(fid) < 0) throw new Error('找不到這張假卡');
  withLock(() => {
    const sh = leaveSheet();
    const left = String(sh.getRange(x.row, 11).getValue() || '').split(',').filter(c => c && c !== fid);
    sh.getRange(x.row, 11).setValue(left.join(','));
    if (!left.length && x.status === '已上傳假卡') sh.getRange(x.row, 10).setValue('已登記');   // 全部刪掉：回到還沒交假卡
    sh.getRange(x.row, 14).setValue(new Date());
  });
  // 同學刪掉假卡：通知導師
  const n = x.cards.length - 1;
  if (!who.teacher) botMail([[CONFIG.TEACHER_NAME, '🗑 ' + x.key + ' 刪除了一張假卡照片\n' + leaveText(x) + '\n' + (n ? '還剩 ' + n + ' 張假卡。' : '已經沒有假卡了，等同學重新上傳。') + '\n（刪掉的照片還在雲端硬碟「請假卡」資料夾）\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
/** 導師：確認（已確認）或退回（寫原因）；同學會收到飛鴿傳書 */
function setLeaveStatus(who, id, status, reply) {
  if (!who.teacher) throw new Error('只有導師可以確認請假');
  if (['已確認', '退回'].indexOf(status) < 0) throw new Error('狀態不對');
  reply = String(reply || '').trim().slice(0, 200);
  const x = leaveRows().find(r => r.id === id);
  if (!x) throw new Error('找不到這筆請假');
  withLock(() => { const sh = leaveSheet(); sh.getRange(x.row, 10).setValue(status); sh.getRange(x.row, 12).setValue(reply); sh.getRange(x.row, 14).setValue(new Date()); });
  botMail([[x.key, (status === '已確認' ? '✅ 導師已經確認你的請假\n' : '↩ 導師退回了你的請假，請依說明處理後再上傳\n') + leaveText(x) + (reply ? '\n導師說明：' + reply : '') + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
/** 導師發飛鴿傳書提醒同學：跑完簽核後上傳假卡照片 */
function remindLeaveCard(who, id) {
  if (!who.teacher) throw new Error('只有導師可以發提醒');
  const x = leaveRows().find(r => r.id === id);
  if (!x) throw new Error('找不到這筆請假');
  if (x.status === '已確認') throw new Error('這筆請假已經確認了');
  botMail([[x.key, '📷 導師提醒你：請假卡要跑完簽核流程（家長簽名 → 導師簽名 → 教官室等處室蓋章），全部簽完之後，把蓋好章的假卡拍照上傳到 App。\n' + leaveText(x) + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return { ok: true };
}
/** 修改請假（假別、日期、節次、說明）：同學在導師確認前可以改自己的；導師隨時可以改（會通知同學） */
function editLeave(who, id, r) {
  const x = leaveRows().find(y => y.id === id);
  if (!x || (!who.teacher && x.key !== who.key)) throw new Error('找不到這筆請假');
  if (!who.teacher && x.status === '已確認') throw new Error('導師已經確認了，要修改請直接跟導師說');
  const type = String(r.type || '');
  if (LEAVE_TYPES.indexOf(type) < 0) throw new Error('請選擇假別');
  const okDate = s => /^\d{4}\/\d\d\/\d\d$/.test(s);
  const from = String(r.from || ''), to = String(r.to || from);
  const fromP = Math.max(0, Math.min(7, Number(r.fromP) || 0)), toP = Math.max(0, Math.min(7, Number(r.toP) || 0));
  if (!okDate(from) || !okDate(to)) throw new Error('請選擇日期');
  if (to < from || (to === from && toP < fromP)) throw new Error('結束的時間要在開始之後');
  const note = String(r.note || '').trim().slice(0, 200);
  withLock(() => {
    const sh = leaveSheet();
    sh.getRange(x.row, 4, 1, 6).setValues([[type, from, fromP, to, toP, note]]);
    sh.getRange(x.row, 14).setValue(new Date());
  });
  const y = { type: type, from: from, fromP: fromP, to: to, toP: toP };
  if (who.teacher) botMail([[x.key, '✏️ 導師修改了你的請假\n' + leaveText(y) + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  else botMail([[CONFIG.TEACHER_NAME, '✏️ ' + x.key + ' 修改了請假\n原本：' + leaveText(x) + '\n改成：' + leaveText(y) + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
function cancelLeave(who, id) {
  const x = leaveRows().find(r => r.id === id);
  if (!x || (!who.teacher && x.key !== who.key)) throw new Error('找不到這筆請假');
  if (!who.teacher && x.status === '已確認') throw new Error('導師已經確認了，要取消請直接跟導師說');
  withLock(() => { const sh = leaveSheet(); sh.getRange(x.row, 10).setValue('已取消'); sh.getRange(x.row, 14).setValue(new Date()); });
  // 同學自己取消：通知導師（導師幫同學取消：通知同學）
  if (!who.teacher) botMail([[CONFIG.TEACHER_NAME, '🗑 ' + x.key + ' 取消了請假\n' + leaveText(x) + (x.cards.length ? '\n（原本已上傳假卡 ' + x.cards.length + ' 張）' : '') + '\n紀錄還留在試算表「請假」工作表（狀態：已取消）。\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  else botMail([[x.key, '🗑 導師取消了你的請假\n' + leaveText(x) + '\n' + CONFIG.SITE_URL + '#tab=leave']], LEAVE_BOT);
  return getLeave(who);
}
function setLeaveRules(who, text) {
  if (!who.teacher) throw new Error('只有導師可以編輯請假規則');
  PropertiesService.getScriptProperties().setProperty('LEAVE_RULES', String(text || '').slice(0, 5000));
  return getLeave(who);
}

// ════════ 📈 投資競賽：每人 1,000 枚投資幣（不歸零）、每月一季排名，連動真實台股收盤價 ════════
// 規則在最下方的 InvestEngine（和網頁 js/invest-engine.js 同一份）。
// 股價：Yahoo 奇摩股市資料（含除息），抓不到時改用證交所；每天下午 2 點以後有人打開 App 就會更新。
const SHEET_TRADE = '投資交易';
const HEAD_TRADE = ['下單時間', '季', '同學', '買賣', '代號', '投資幣', '單位', '理由（投資日記）', '狀態', '成交日', '成交價', '成交單位', '手續費', '交易稅', '淨額', '編號'];
const SHEET_PRICE = '投資股價';
const HEAD_PRICE = ['日期', '代號', '收盤價', '現金股利'];
const SHEET_INVRES = '投資排行';
const HEAD_INVRES = ['季', '名次', '同學', '報酬率', '總值', '獎項', '商店點數', '發放時間'];
const INVEST_BOT = '📈 投資競賽';

const hmNow = () => Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'HH:mm');
/** 代號欄位被試算表當成數字（0050 → 50）時還原 */
function normCode(v) {
  const s = String(v).trim();
  const hit = InvestEngine.STOCKS.find(x => x.code === s || (/^\d+$/.test(s) && Number(x.code) === Number(s) && /^\d+$/.test(x.code)));
  return hit ? hit.code : s;
}
const normSeason = v => (v instanceof Date ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy/MM') : String(v).trim().replace(/^'/, ''));
function textSheet(name, head, cols) {
  const ss = getSS(), fresh = !ss.getSheetByName(name), sh = getSheet(name, head);
  if (fresh) cols.forEach(c => sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'));
  return sh;
}
const tradeSheet = () => textSheet(SHEET_TRADE, HEAD_TRADE, [2, 5]);
const priceSheet = () => textSheet(SHEET_PRICE, HEAD_PRICE, [1, 2]);

function investPrices() {
  const sh = priceSheet(), n = sh.getLastRow() - 1, P = {};
  InvestEngine.STOCKS.forEach(s => { P[s.code] = {}; });
  if (n > 0) sh.getRange(2, 1, n, 4).getValues().forEach(r => {
    const d = r[0] instanceof Date ? ymd(r[0]) : String(r[0]).trim(), c = normCode(r[1]);
    if (P[c] && /^\d{4}\/\d\d\/\d\d$/.test(d)) P[c][d] = { c: Number(r[2]) || 0, div: Number(r[3]) || 0 };
  });
  return P;
}
/** 從 Yahoo 抓最近 3 個月的收盤價和除息；失敗的那一檔改用證交所（沒有除息資料） */
function fetchInvestPrices() {
  const today = ymd(new Date()), early = hmNow() < '14:00';   // 收盤前的「今天」還不是收盤價，先不要
  const res = UrlFetchApp.fetchAll(InvestEngine.STOCKS.map(s => ({
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s.code) + '.TW?range=3mo&interval=1d&events=div', muteHttpExceptions: true,
  })));
  const got = {};
  res.forEach((r, i) => {
    const code = InvestEngine.STOCKS[i].code, m = {};
    try {
      const j = JSON.parse(r.getContentText()).chart.result[0];
      const ts = j.timestamp || [], cl = (j.indicators.quote[0] || {}).close || [];
      ts.forEach((t, k) => { if (cl[k] > 0) m[ymd(new Date(t * 1000))] = { c: Math.round(cl[k] * 100) / 100, div: 0 }; });
      const dv = (j.events && j.events.dividends) || {};
      Object.keys(dv).forEach(k => { const d = ymd(new Date(dv[k].date * 1000)); if (m[d]) m[d].div = Number(dv[k].amount) || 0; });
      if (!Object.keys(m).length) throw new Error('沒有資料');
    } catch (e) { Object.assign(m, twsePrices(code)); }
    if (early) delete m[today];
    got[code] = m;
  });
  return got;
}
function twsePrices(code) {
  const m = {};
  [1, 0].forEach(back => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back);
    const url = 'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=' + Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyyMM') + '01&stockNo=' + code + '&response=json';
    try {
      const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      (j.data || []).forEach(r => {
        const a = String(r[0]).split('/'), c = Number(String(r[6]).replace(/,/g, ''));
        if (a.length === 3 && c > 0) m[(Number(a[0]) + 1911) + '/' + a[1] + '/' + a[2]] = { c: c, div: 0 };
      });
    } catch (e) { /* 這個月抓不到就算了 */ }
  });
  return m;
}
/** 需要時更新股價（每天下午 2 點後第一次、或超過 6 小時沒更新），然後結算已經結束的季 */
function investTick() {
  const props = PropertiesService.getScriptProperties();
  const need = () => {
    const last = Number(props.getProperty('INV_FETCH') || 0), now = new Date();
    if (!last || now - last > 6 * 3600e3) return true;
    const l = new Date(last);
    return hmNow() >= '14:00' && (ymd(l) < ymd(now) || Utilities.formatDate(l, CONFIG.TIMEZONE, 'HH:mm') < '14:00');
  };
  if (need()) {
    withLock(() => {
      if (!need()) return;
      try {
        const got = fetchInvestPrices(), P = investPrices();
        Object.keys(got).forEach(c => Object.keys(got[c]).forEach(d => {
          const old = P[c][d];
          P[c][d] = { c: got[c][d].c, div: got[c][d].div || (old && old.div) || 0 };
        }));
        const rows = [];
        Object.keys(P).forEach(c => Object.keys(P[c]).forEach(d => rows.push([d, c, P[c][d].c, P[c][d].div || ''])));
        rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1));
        const sh = priceSheet();
        if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
        if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
        props.setProperty('INV_FETCH', String(Date.now()));
      } catch (e) {
        Logger.log('股價更新失敗：' + e);
        props.setProperty('INV_FETCH', String(Date.now() - 5 * 3600e3)); // 一小時後再試
      }
    });
  }
  investSettle();
}

function tradeRows() {
  const sh = tradeSheet(), n = sh.getLastRow() - 1;
  if (n <= 0) return [];
  return sh.getRange(2, 1, n, HEAD_TRADE.length).getValues().map((r, i) => {
    const t = r[0] instanceof Date ? r[0] : new Date(r[0]);
    return {
      row: i + 2, t: t.getTime(), ymd: ymd(t), hm: Utilities.formatDate(t, CONFIG.TIMEZONE, 'HH:mm'), time: Utilities.formatDate(t, CONFIG.TIMEZONE, 'MM/dd HH:mm'),
      season: normSeason(r[1]), who: String(r[2]).trim(), side: String(r[3]).trim(), code: normCode(r[4]),
      amount: Number(r[5]) || 0, units: Number(r[6]) || 0, reason: String(r[7]), status: String(r[8]).trim(), id: String(r[15]).trim(),
    };
  }).filter(t => t.id && !isNaN(t.t));
}
/** 每個人從第一次下單到現在的帳本（不分季、不歸零） */
function investBooks(P, days, trades) {
  const by = {}, books = {};
  trades.forEach(t => { (by[t.who] = by[t.who] || []).push(t); });
  Object.keys(by).forEach(k => { books[k] = InvestEngine.book(by[k], P, days); });
  return { by: by, books: books };
}
/** 把算出來的成交結果寫回「投資交易」（給導師看） */
function syncFills(by, books) {
  const sh = tradeSheet(), ups = [];
  Object.keys(by).forEach(k => by[k].forEach(t => {
    if (/^已取消/.test(t.status)) return;
    const f = books[k].fills[t.id];
    let row = null;
    if (f && f.fail) row = ['已取消（' + f.fail + '）', f.d, '', '', '', '', ''];
    else if (f) row = ['已成交', f.d, f.price, f.units, f.fee, f.tax, f.net];
    if (row && t.status !== row[0]) ups.push([t.row, row]);
  }));
  if (!ups.length) return;
  withLock(() => ups.forEach(u => sh.getRange(u[0], 9, 1, 7).setValues([u[1]])));
}
/** 某一季的排名（導師也一起排名，不領獎、不佔同學的得獎名額） */
function standingsOf(books, season) {
  const list = Object.keys(books).map(k => Object.assign({ key: k, noPrize: k === CONFIG.TEACHER_NAME }, InvestEngine.seasonStats(books[k], season)))
    .filter(x => x.active);
  return InvestEngine.standings(list);
}
/** 這一季結束了嗎？（最後一個平日已經有收盤價，或已經進入下個月而且之後更新過股價） */
function investFinal(season, days) {
  const lw = InvestEngine.lastWeekday(season);
  if (days.some(d => d.slice(0, 7) > season) || days.indexOf(lw) >= 0) return true;
  const last = Number(PropertiesService.getScriptProperties().getProperty('INV_FETCH') || 0);
  return ymd(new Date()) > lw && last > 0 && ymd(new Date(last)) > lw;
}
function investSettle() {
  const props = PropertiesService.getScriptProperties();
  const doneList = () => JSON.parse(props.getProperty('INV_DONE') || '[]');
  const trades = tradeRows();
  if (!trades.length) return;
  // 從第一筆交易的那一季到這個月，每一季都要結算（有人整季都沒交易也照樣算，投資組合不歸零）
  const cur = ymd(new Date()).slice(0, 7), seasons = [];
  for (let s = trades.map(t => t.season).sort()[0]; s <= cur; s = InvestEngine.nextSeason(s)) if (doneList().indexOf(s) < 0) seasons.push(s);
  if (!seasons.length) return;
  const P = investPrices(), days = InvestEngine.tradingDays(P);
  let R = null;
  seasons.forEach(season => {
    if (!investFinal(season, days)) return;
    R = R || investBooks(P, days, trades);
    syncFills(R.by, R.books);
    withLock(() => {
      if (doneList().indexOf(season) >= 0) return;
      const st = standingsOf(R.books, season), now = new Date(), rows = [], mails = [], RU = InvestEngine.RULES;
      st.list.forEach(x => {
        const pts = x.noPrize ? 0 : x.prize + (x.steady ? RU.STEADY : 0) + (x.eligible ? RU.JOIN : 0);
        const award = [x.prize ? '第 ' + x.rank + ' 名' : '', x.steady ? '穩健獎' : '', x.eligible ? '參與獎' : ''].filter(String).join('、');
        rows.push([season, x.rank || '', x.key, Math.round(x.ret * 1e6) / 1e6, x.value, x.noPrize ? '導師（不領獎）' : award || '（還沒有成交紀錄）', pts, now]);
        if (pts) mails.push([x.key, '📈 ' + season + ' 投資競賽結算囉！\n這一季的報酬率：' + (x.ret * 100).toFixed(2) + '%' + (x.rank ? '（第 ' + x.rank + ' 名）' : '') +
          '\n累計報酬率：' + (x.total * 100).toFixed(2) + '%\n獲得：' + award + '，共 ' + pts + ' 點商店點數，已經放進你的商店點數。\n\n投資組合不會歸零，會繼續延續到下一季，長期投資加油！']);
      });
      if (rows.length) {
        const sh = getSheet(SHEET_INVRES, HEAD_INVRES);
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD_INVRES.length).setValues(rows.map(r => ["'" + r[0]].concat(r.slice(1))));
      }
      botMail(mails, INVEST_BOT);
      props.setProperty('INV_DONE', JSON.stringify(doneList().concat([season]).slice(-36)));
      _invRes = null;
    });
  });
}
let _invRes = null;
function invResRows() {
  if (_invRes) return _invRes;
  const sh = getSS().getSheetByName(SHEET_INVRES);
  if (!sh || sh.getLastRow() < 2) return (_invRes = []);
  return (_invRes = sh.getRange(2, 1, sh.getLastRow() - 1, HEAD_INVRES.length).getValues().map(r => ({
    season: normSeason(r[0]), rank: Number(r[1]) || null, key: String(r[2]).trim(), ret: Number(r[3]) || 0, value: Number(r[4]) || 0,
    award: String(r[5]), points: Number(r[6]) || 0, t: r[7] instanceof Date ? r[7].getTime() : 0,
  })));
}
/** 投資競賽得到的商店點數（算進 coinsOf 的收入） */
function investAwardsFor(key) {
  return invResRows().filter(r => r.key === key && r.points > 0).map(r => ({ date: new Date(r.t), points: r.points, season: r.season }));
}
const prevSeason = s => { const a = s.split('/'); const d = new Date(+a[0], +a[1] - 2, 1); return d.getFullYear() + '/' + ('0' + (d.getMonth() + 1)).slice(-2); };
const pubCode = key => (key === CONFIG.TEACHER_NAME ? CONFIG.TEACHER_NAME : faceCode(key));
const pubRow = (x, key) => ({ rank: x.rank, code: pubCode(key), ret: x.ret, value: x.value, prize: x.prize || x.points || 0 });
/** 教室後方的公告：月底最後一個平日～下個月 7 號顯示前十名＋穩健獎（只有座號） */
function investBoard(forceSeason, R) {
  const today = ymd(new Date()), cur = today.slice(0, 7);
  let season = forceSeason || '';
  if (!season) {
    if (today >= InvestEngine.lastWeekday(cur)) season = cur;
    else if (Number(today.slice(8)) <= 7) season = prevSeason(cur);
    else return null;
  }
  const res = invResRows().filter(r => r.season === season);
  if (res.length) {
    // 前十名（導師在裡面時，同學的得獎名額往後補）
    const top = res.filter(r => r.rank && (r.rank <= 10 || r.points > 1)).sort((a, b) => a.rank - b.rank).map(r => ({ rank: r.rank, code: pubCode(r.key), ret: r.ret, value: r.value }));
    const s = res.find(r => /穩健獎/.test(r.award));
    return { season: season, final: true, top: top, steady: s ? { code: faceCode(s.key), ret: s.ret, value: s.value } : null };
  }
  if (forceSeason) return null;
  if (!R) { const P = investPrices(); R = investBooks(P, InvestEngine.tradingDays(P), tradeRows()); }
  if (!Object.keys(R.books).length) return null;
  const st = standingsOf(R.books, season);
  return {
    season: season, final: false,
    top: st.list.filter(x => x.rank && (x.rank <= 10 || x.prize)).map(x => pubRow(x, x.key)),
    steady: st.steady ? { code: faceCode(st.steady.key), ret: st.steady.ret, value: st.steady.value } : null,
  };
}
/** 前三名同學的座位放一次鞭炮（結算後 7 天內，每支手機放一次；導師不算，並列的都放） */
function investFireworks() {
  const since = Date.now() - 7 * 86400e3;
  const stu = invResRows().filter(r => r.rank && r.t >= since && r.key !== CONFIG.TEACHER_NAME).sort((a, b) => a.season < b.season ? -1 : a.season > b.season ? 1 : a.rank - b.rank);
  const out = [];
  let season = '', n = 0, pr = 0, lastRank = 0;
  stu.forEach(r => {
    if (r.season !== season) { season = r.season; n = 0; pr = 0; lastRank = 0; }
    n++;
    if (r.rank !== lastRank) { pr = n; lastRank = r.rank; }
    if (pr <= 3) out.push({
      id: 'inv-' + r.season + '-' + faceCode(r.key), by: INVEST_BOT, to: r.key, time: Utilities.formatDate(new Date(r.t), CONFIG.TIMEZONE, 'MM/dd HH:mm'),
      label: '🧨 ' + Number(r.season.slice(5)) + ' 月投資競賽第 ' + r.rank + ' 名！', kind: 'firecracker',
    });
  });
  return out;
}
function investState(who) {
  investTick();
  const P = investPrices(), days = InvestEngine.tradingDays(P), trades = tradeRows();
  const today = ymd(new Date()), hm = hmNow(), next = InvestEngine.orderDay(today, hm), season = today.slice(0, 7);
  const R = investBooks(P, days, trades);
  syncFills(R.by, R.books);
  const me = who.key, b = R.books[me] || InvestEngine.book([], P, days), ms = InvestEngine.seasonStats(b, season);
  const mine = (R.by[me] || []).slice().sort((x, y) => y.t - x.t).map(t => {
    const f = b.fills[t.id];
    return { id: t.id, time: t.time, side: t.side, code: t.code, amount: t.amount, units: t.units, reason: t.reason,
      status: /^已取消/.test(t.status) ? t.status : f ? (f.fail ? '已取消（' + f.fail + '）' : '已成交') : '待成交', fill: f && !f.fail ? f : null };
  });
  const st = standingsOf(R.books, season);
  const pub = x => ({ code: pubCode(x.key), name: who.teacher ? x.key : '', me: x.key === me, ret: x.ret, total: x.total, value: x.value, rank: x.rank, eligible: x.eligible, diary: x.diary, prize: x.prize, steady: x.steady, teacher: !!x.noPrize });
  // 累計排行（長期投資）：從開始到現在的報酬率
  const total = Object.keys(R.books).filter(k => R.books[k].diary > 0).map(k => ({ key: k, t: R.books[k].total, v: R.books[k].value }))
    .sort((a, c) => c.t - a.t).map(x => ({ code: pubCode(x.key), name: who.teacher ? x.key : '', me: x.key === me, total: x.t, value: x.v, teacher: x.key === CONFIG.TEACHER_NAME }));
  const stocks = InvestEngine.STOCKS.map(s => {
    const ds = Object.keys(P[s.code]).filter(d => P[s.code][d].c > 0).sort(), l = ds.length;
    return Object.assign({}, s, { date: ds[l - 1] || '', close: l ? P[s.code][ds[l - 1]].c : 0, prev: l > 1 ? P[s.code][ds[l - 2]].c : 0,
      hist: ds.slice(-40).map(d => [d, P[s.code][d].c]), divs: ds.filter(d => P[s.code][d].div > 0).slice(-2).map(d => [d, P[s.code][d].div]) });
  });
  const pendSell = {};
  mine.filter(t => t.status === '待成交' && t.side === '賣').forEach(t => { pendSell[t.code] = (pendSell[t.code] || 0) + t.units; });
  const sellable = {};
  b.holdings.forEach(h => { sellable[h.code] = InvestEngine.sellable(b, h.code, days, next, pendSell[h.code]); });
  const past = invResRows().map(r => r.season).filter((s, i, a) => a.indexOf(s) === i).sort().reverse().slice(0, 6)
    .map(s => Object.assign({ mine: invResRows().find(r => r.season === s && r.key === me) || null }, investBoard(s)));
  return {
    ok: true, season: season, next: next, today: today, hm: hm, final: investFinal(season, days), rules: InvestEngine.RULES, stocks: stocks,
    me: { cash: b.cash, avail: b.avail, value: b.value, total: b.total, ret: ms.ret, start: ms.start, diary: b.diary, eligible: b.eligible, holdings: b.holdings, divs: b.divs,
      snaps: b.snaps.slice(-60), sellable: sellable, joined: b.diary > 0 || b.pending.length > 0 },
    trades: mine, teacher: !!who.teacher, standings: st.list.map(pub), total: total,
    board: investBoard('', R), past: past, fetched: Number(PropertiesService.getScriptProperties().getProperty('INV_FETCH') || 0),
  };
}
function investOrder(who, o) {
  const side = o.side === '賣' ? '賣' : '買', code = normCode(o.code);
  if (!InvestEngine.STOCKS.some(s => s.code === code)) throw new Error('沒有這檔股票');
  const reason = String(o.reason || '').trim().slice(0, 200);
  if (reason.length < 4) throw new Error('請寫下為什麼要' + side + '（投資日記，至少 4 個字）');
  withLock(() => {
    const now = new Date(), today = ymd(now), next = InvestEngine.orderDay(today, hmNow());
    const P = investPrices(), days = InvestEngine.tradingDays(P);
    const mine = tradeRows().filter(t => t.who === who.key);
    const b = InvestEngine.book(mine, P, days);
    let amount = '', units = '';
    if (side === '買') {
      amount = Math.floor(Number(o.amount) * 100) / 100;
      if (!(amount >= 1)) throw new Error('至少要投入 1 枚投資幣');
      if (amount > b.avail + 1e-9) throw new Error('投資幣不夠（現在可用 ' + b.avail + ' 枚）');
    } else {
      units = Math.floor(Number(o.units) * 1e6) / 1e6;
      if (!(units > 0)) throw new Error('請輸入要賣的單位');
      const pend = mine.filter(t => b.pending.indexOf(t.id) >= 0 && t.side === '賣' && t.code === code).reduce((s, t) => s + t.units, 0);
      const can = InvestEngine.sellable(b, code, days, next, pend);
      if (units > can + 1e-6) throw new Error(can > 0 ? '最多只能賣 ' + can + ' 單位（買進滿 ' + InvestEngine.RULES.HOLD + ' 個交易日的部分）' : '這檔還沒有滿 ' + InvestEngine.RULES.HOLD + ' 個交易日的持股，還不能賣');
    }
    const sh = tradeSheet(), id = Utilities.getUuid().slice(0, 8);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEAD_TRADE.length).setValues([[now, InvestEngine.seasonOf(next), who.key, side, code, amount, units, reason, '待成交', '', '', '', '', '', '', id]]);
  });
  return investState(who);
}
function investCancel(who, id) {
  withLock(() => {
    const all = tradeRows(), t = all.find(x => x.id === id);
    if (!t || t.who !== who.key) throw new Error('找不到這筆委託');
    const P = investPrices(), days = InvestEngine.tradingDays(P);
    const b = InvestEngine.book(all.filter(x => x.who === who.key), P, days);
    if (b.pending.indexOf(id) < 0) throw new Error('這筆已經成交（或取消）了，不能取消');
    tradeSheet().getRange(t.row, 9).setValue('已取消');
  });
  return investState(who);
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

/* ── 投資競賽引擎 ───────────────────────────────────────────────
 * 這一段和 gas/Code.gs 最下方的 InvestEngine 是同一份程式，修改時兩邊要一起改。
 * （網頁的測試模式在手機上模擬；正式的由 Google Apps Script 計算）
 *
 * 規則：
 *   1. 第一次參加時拿到 1,000 枚投資幣；之後「不歸零」，投資組合一直延續（學習長期投資）。
 *   2. 每個月是一季：每季的名次看「這一季的報酬率」＝季末總值 ÷ 季初總值 − 1。另外有「累計報酬率」排行。
 *   3. 下單後以「當天收盤價」成交（13:30 以後下單＝下一個交易日的收盤價）。可以買零碎的單位。
 *   4. 買進、賣出都收手續費 0.1425%；賣出另收交易稅（股票 0.3%、ETF 0.1%）。
 *   5. 買進後至少要持有 3 個交易日才能賣（先買的先賣）。
 *   6. 持有的股票除息時，現金股利會自動發到現金。
 *   7. 只要有成交紀錄（至少 1 筆，每筆都寫了理由＝投資日記）就加入排行、有領獎資格；報酬率一樣就並列。
 *   8. 穩健獎：有資格、這一季報酬率是正的、平均至少一半的錢放在股票裡，每天漲跌起伏（波動度）最小的人。
 *   9. noPrize（導師）：一起排名，但不領獎、不佔同學的得獎名額、不參加穩健獎。
 * 日期一律用 'yyyy/MM/dd' 字串；季＝'yyyy/MM'。
 */
var InvestEngine = (function () {
  var RULES = {
    START: 1000, FEE: 0.001425, TAX_STOCK: 0.003, TAX_ETF: 0.001, HOLD: 3, DIARY: 1,
    PRIZE: [15, 10, 10, 5, 5, 5, 5, 5, 5, 5], STEADY: 5, JOIN: 1, MIN_INV: 0.5, CLOSE: '13:30',
  };
  // group：畫面上依產業分組（可以收合）
  var STOCKS = [
    { code: '0050', name: '元大台灣50', type: 'etf', short: '0050', group: 'ETF' },
    { code: '0056', name: '元大高股息', type: 'etf', short: '高股息', group: 'ETF' },
    { code: '00632R', name: '元大台灣50反1', type: 'etf', short: '反一', group: 'ETF' },
    { code: '00631L', name: '元大台灣50正2', type: 'etf', short: '正二', group: 'ETF' },
    { code: '2330', name: '台積電', type: 'stock', short: '台積電', group: '半導體' },
    { code: '2454', name: '聯發科', type: 'stock', short: '聯發科', group: '半導體' },
    { code: '2303', name: '聯電', type: 'stock', short: '聯電', group: '半導體' },
    { code: '3711', name: '日月光投控', type: 'stock', short: '日月光', group: '半導體' },
    { code: '3443', name: '創意', type: 'stock', short: '創意', group: '半導體' },
    { code: '2408', name: '南亞科', type: 'stock', short: '南亞科', group: '半導體' },
    { code: '2344', name: '華邦電', type: 'stock', short: '華邦電', group: '半導體' },
    { code: '6515', name: '穎崴', type: 'stock', short: '穎崴', group: '半導體' },
    { code: '2317', name: '鴻海', type: 'stock', short: '鴻海', group: '電子製造／AI 伺服器' },
    { code: '2382', name: '廣達', type: 'stock', short: '廣達', group: '電子製造／AI 伺服器' },
    { code: '3231', name: '緯創', type: 'stock', short: '緯創', group: '電子製造／AI 伺服器' },
    { code: '2357', name: '華碩', type: 'stock', short: '華碩', group: '電子製造／AI 伺服器' },
    { code: '2308', name: '台達電', type: 'stock', short: '台達電', group: '電子零組件' },
    { code: '2345', name: '智邦', type: 'stock', short: '智邦', group: '電子零組件' },
    { code: '3037', name: '欣興', type: 'stock', short: '欣興', group: '電子零組件' },
    { code: '2881', name: '富邦金', type: 'stock', short: '富邦金', group: '金融' },
    { code: '2882', name: '國泰金', type: 'stock', short: '國泰金', group: '金融' },
    { code: '2891', name: '中信金', type: 'stock', short: '中信金', group: '金融' },
    { code: '2886', name: '兆豐金', type: 'stock', short: '兆豐金', group: '金融' },
    { code: '2412', name: '中華電', type: 'stock', short: '中華電', group: '電信' },
    { code: '1216', name: '統一', type: 'stock', short: '統一', group: '食品／零售' },
    { code: '2912', name: '統一超', type: 'stock', short: '統一超', group: '食品／零售' },
    { code: '1301', name: '台塑', type: 'stock', short: '台塑', group: '傳統產業' },
    { code: '2002', name: '中鋼', type: 'stock', short: '中鋼', group: '傳統產業' },
    { code: '2603', name: '長榮', type: 'stock', short: '長榮', group: '航運' },
  ];
  var TYPE = {};
  STOCKS.forEach(function (s) { TYPE[s.code] = s.type; });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) { var a = String(s).split('/'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function fmt(d) { return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return fmt(d); }
  function isWeekday(s) { var w = parse(s).getDay(); return w > 0 && w < 6; }
  function nextWeekday(s) { do { s = addDays(s, 1); } while (!isWeekday(s)); return s; }
  function seasonOf(s) { return String(s).slice(0, 7); }
  function nextSeason(s) { var a = s.split('/'), d = new Date(+a[0], +a[1], 1); return d.getFullYear() + '/' + pad(d.getMonth() + 1); }
  /** 這一季（月）最後一個週一～週五 */
  function lastWeekday(season) {
    var a = season.split('/'), d = new Date(+a[0], +a[1], 0);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return fmt(d);
  }
  /** 下單後預計哪一天的收盤價成交（13:30 以前＝今天；以後或假日＝下一個平日） */
  function orderDay(ymd, hm) { return isWeekday(ymd) && hm < RULES.CLOSE ? ymd : nextWeekday(ymd); }
  function r2(x) { return Math.round(x * 100) / 100; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  /** prices：{ 代號: { 日期: { c: 收盤價, div: 現金股利 } } } → 所有交易日（排序好） */
  function tradingDays(prices) {
    var set = {};
    Object.keys(prices).forEach(function (c) { Object.keys(prices[c]).forEach(function (d) { if (prices[c][d].c > 0) set[d] = 1; }); });
    return Object.keys(set).sort();
  }

  /**
   * 重算一個人從第一次下單到現在的帳本（不分季、不歸零）。
   * trades：[{ id, ymd, hm, t, side: '買'|'賣', code, amount(買的投資幣), units(賣的單位), status }]
   *   status：'已取消' 的不算；其他（待成交、已成交）都照規則重新計算。
   * days：所有交易日（tradingDays 的結果）
   */
  function book(trades, prices, days) {
    var idx = {};
    days.forEach(function (d, i) { idx[d] = i; });
    var cash = RULES.START, lots = {}, last = {}, fills = {}, divs = [], snaps = [];
    STOCKS.forEach(function (s) { lots[s.code] = []; });
    var pend = trades.filter(function (t) { return t.status !== '已取消'; })
      .map(function (t) { return { tr: t, eff: orderDay(t.ymd, t.hm) }; })
      .sort(function (a, b) { return a.tr.t - b.tr.t; });
    var start = pend.length ? pend.reduce(function (m, o) { return o.eff < m ? o.eff : m; }, '9999') : '9999';
    var held = function (code) { return (lots[code] || []).reduce(function (s, l) { return s + l.u; }, 0); };
    var between = function (a, d) { return (idx[d] === undefined ? days.length : idx[d]) - idx[a]; };
    days.forEach(function (D) {
      STOCKS.forEach(function (s) { var p = prices[s.code] && prices[s.code][D]; if (p && p.c > 0) last[s.code] = p.c; });
      if (D < start) return;                             // 還沒開始投資
      // 1. 除息：前一天收盤時持有的人領現金股利
      STOCKS.forEach(function (s) {
        var p = prices[s.code] && prices[s.code][D];
        if (!p || !(p.div > 0)) return;
        var u = held(s.code);
        if (u > 1e-9) { var amt = r2(u * p.div); cash = r2(cash + amt); divs.push({ d: D, code: s.code, units: r6(u), per: p.div, amount: amt }); }
      });
      // 2. 成交
      pend.forEach(function (o) {
        if (fills[o.tr.id] || o.eff > D) return;
        var tr = o.tr, p = prices[tr.code] && prices[tr.code][D];
        if (!p || !(p.c > 0)) return;
        if (tr.side === '買') {
          var fee = r2(tr.amount * RULES.FEE), u = r6((tr.amount - fee) / p.c);
          cash = r2(cash - tr.amount);
          lots[tr.code].push({ d: D, u: u, cost: tr.amount });
          fills[tr.id] = { d: D, price: p.c, units: u, amount: tr.amount, fee: fee, tax: 0, net: -tr.amount };
        } else {
          var have = held(tr.code), want = Math.min(tr.units, have);
          if (want <= 1e-6) { fills[tr.id] = { d: D, fail: '已經沒有持股' }; return; }
          var ok = lots[tr.code].filter(function (l) { return between(l.d, D) >= RULES.HOLD; }).reduce(function (s, l) { return s + l.u; }, 0);
          if (ok < want - 1e-6) return;                 // 還沒滿 3 個交易日：等下一天
          var left = want, cost = 0;
          while (left > 1e-9 && lots[tr.code].length) {  // 先買的先賣
            var l = lots[tr.code][0], take = Math.min(l.u, left), part = l.cost * take / l.u;
            cost += part; l.cost -= part; l.u = r6(l.u - take); left = r6(left - take);
            if (l.u <= 1e-9) lots[tr.code].shift();
          }
          var gross = want * p.c, f2 = r2(gross * RULES.FEE), tax = r2(gross * (TYPE[tr.code] === 'stock' ? RULES.TAX_STOCK : RULES.TAX_ETF));
          var net = r2(gross - f2 - tax);
          cash = r2(cash + net);
          fills[tr.id] = { d: D, price: p.c, units: r6(want), amount: r2(gross), fee: f2, tax: tax, net: net, profit: r2(net - cost) };
        }
      });
      // 3. 收盤後的總值
      var inv = 0;
      STOCKS.forEach(function (s) { inv += held(s.code) * (last[s.code] || 0); });
      snaps.push({ d: D, v: r2(cash + inv), inv: cash + inv > 0 ? inv / (cash + inv) : 0 });
    });
    var holdings = STOCKS.map(function (s) {
      var u = held(s.code), cost = lots[s.code].reduce(function (t, l) { return t + l.cost; }, 0);
      return { code: s.code, units: r6(u), cost: r2(cost), price: last[s.code] || 0, value: r2(u * (last[s.code] || 0)), lots: lots[s.code].map(function (l) { return { d: l.d, u: l.u }; }) };
    }).filter(function (h) { return h.units > 1e-9; });
    var pending = pend.filter(function (o) { return !fills[o.tr.id]; }).map(function (o) { return o.tr.id; });
    var reserved = pend.filter(function (o) { return !fills[o.tr.id] && o.tr.side === '買'; }).reduce(function (s, o) { return s + o.tr.amount; }, 0);
    var value = snaps.length ? snaps[snaps.length - 1].v : RULES.START;
    var fillDays = Object.keys(fills).filter(function (id) { return !fills[id].fail; }).map(function (id) { return fills[id].d; });
    return {
      cash: r2(cash), avail: r2(cash - reserved), value: value, total: value / RULES.START - 1,
      holdings: holdings, fills: fills, divs: divs, snaps: snaps, pending: pending, fillDays: fillDays,
      diary: fillDays.length, eligible: fillDays.length >= RULES.DIARY,
    };
  }

  /** 某一季的成績：季初總值（上一季最後一天收盤，第一次參加＝1,000）→ 季末（或到目前為止）總值 */
  function seasonStats(b, season) {
    var inS = b.snaps.filter(function (s) { return seasonOf(s.d) === season; });
    var before = b.snaps.filter(function (s) { return seasonOf(s.d) < season; });
    var v0 = before.length ? before[before.length - 1].v : RULES.START;
    var v1 = inS.length ? inS[inS.length - 1].v : v0;
    var diary = b.fillDays.filter(function (d) { return seasonOf(d) <= season; }).length;
    var series = [v0].concat(inS.map(function (s) { return s.v; })), rets = [];
    for (var i = 1; i < series.length; i++) rets.push(series[i] / series[i - 1] - 1);
    var mean = rets.reduce(function (s, x) { return s + x; }, 0) / (rets.length || 1);
    var vol = rets.length ? Math.sqrt(rets.reduce(function (s, x) { return s + (x - mean) * (x - mean); }, 0) / rets.length) : 0;
    return {
      start: v0, value: v1, ret: v1 / v0 - 1, total: v1 / RULES.START - 1, diary: diary, eligible: diary >= RULES.DIARY, active: diary > 0,
      seasonTrades: b.fillDays.filter(function (d) { return seasonOf(d) === season; }).length,
      vol: vol, days: rets.length, avgInv: inS.length ? inS.reduce(function (s, x) { return s + x.inv; }, 0) / inS.length : 0,
    };
  }

  /** 現在還能賣多少單位（已經滿 3 個交易日、扣掉已經掛單要賣的） */
  function sellable(b, code, days, sellDay, pendingSellUnits) {
    var h = b.holdings.find(function (x) { return x.code === code; });
    if (!h) return 0;
    var idx = {};
    days.forEach(function (d, i) { idx[d] = i; });
    var at = idx[sellDay] !== undefined ? idx[sellDay] : days.length;  // 還沒到的日子＝下一個交易日
    var ok = h.lots.filter(function (l) { return at - idx[l.d] >= RULES.HOLD; }).reduce(function (s, l) { return s + l.u; }, 0);
    return Math.max(0, r6(ok - (pendingSellUnits || 0)));
  }

  /** 排名：只有符合資格的人有名次（報酬率到 0.01% 一樣就並列）；另外算穩健獎、獎勵點數。
      noPrize（導師）：一起排名，但不領獎、不佔同學的得獎名額、不參加穩健獎 */
  function standings(list) {
    var rk = function (x) { return Math.round(x.ret * 1e4); };
    var el = list.filter(function (x) { return x.eligible; }).sort(function (a, b) { return b.ret - a.ret; });
    var rank = 0;
    el.forEach(function (x, i) { if (i === 0 || rk(x) !== rk(el[i - 1])) rank = i + 1; x.rank = rank; });
    var stu = el.filter(function (x) { return !x.noPrize; }), pr = 0;
    stu.forEach(function (x, i) { if (i === 0 || rk(x) !== rk(stu[i - 1])) pr = i + 1; x.prank = pr; x.prize = RULES.PRIZE[pr - 1] || 0; });
    el.forEach(function (x) { if (x.noPrize) { x.prank = null; x.prize = 0; } });
    var cand = stu.filter(function (x) { return x.ret > 0 && x.avgInv >= RULES.MIN_INV && x.days >= 2; })
      .sort(function (a, b) { return a.vol - b.vol || b.ret - a.ret; });
    var steady = cand[0] || null;
    list.forEach(function (x) { if (!x.eligible) { x.rank = null; x.prize = 0; } x.steady = x === steady; });
    var rest = list.filter(function (x) { return !x.eligible; }).sort(function (a, b) { return b.ret - a.ret; });
    return { list: el.concat(rest), steady: steady };
  }

  return {
    RULES: RULES, STOCKS: STOCKS, parse: parse, fmt: fmt, addDays: addDays, isWeekday: isWeekday, nextWeekday: nextWeekday,
    seasonOf: seasonOf, nextSeason: nextSeason, lastWeekday: lastWeekday, orderDay: orderDay, tradingDays: tradingDays,
    book: book, seasonStats: seasonStats, sellable: sellable, standings: standings,
  };
})();
