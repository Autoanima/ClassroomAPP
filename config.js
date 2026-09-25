/*
 * 網站設定
 *
 * gasUrl     ：Google Apps Script 部署後的「網頁應用程式網址」（…/exec）
 *              放在公開的 GitHub 上沒關係，因為還需要密碼（或學生的身分證字號）才能讀寫資料。
 *              還沒設定時可以先用測試模式（密碼輸入 test）試用。
 * resetHours ：掃地檢查紀錄幾小時後自動清空
 *
 * ⚠ 密碼不要寫在這裡，因為 GitHub 上的檔案所有人都看得到。
 */
window.APP_CONFIG = {
  gasUrl: 'https://script.google.com/macros/s/AKfycbxx3fbtNORxbXP7M0pywVkVNcDi9vKiqggLWVckq6xJlbVOTx9-btsNRDXFgmj749VLFQ/exec',
  resetHours: 20,
};
