'use strict';
/* 🥚 孵化失敗時孵出來的 50 種東西，和來帶走牠們的配角：自己畫的 SVG（和寵物貓咪同一種畫風）。
   不用手機的 emoji，因為每支手機長得不一樣；往左走的畫成面向左邊、往右走的面向右邊。 */
(() => {
  const S = body => `<svg viewBox="0 0 64 64" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const eye = (x, y, r = 2.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#222"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.33}" fill="#fff"/>`;
  const cheek = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.8" ry="1.6" fill="#ff8fa3" opacity=".65"/>`;
  const sweat = (x, y) => `<path d="M${x} ${y}q2.6 3.6 0 5.2q-2.6-1.6 0-5.2Z" fill="#74c0fc"/>`;
  const wheel = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="#343a40"/><circle cx="${x}" cy="${y}" r="2.5" fill="#ced4da"/>`;

  const ART = {
    // 1 小鳥（往右上飛）
    bird: S(`<path d="M22 32q-14-14-19-1q8 7 19 5Z" fill="#3d8fd1"/><ellipse cx="30" cy="38" rx="17" ry="13" fill="#5fb4f0"/><ellipse cx="33" cy="43" rx="10" ry="6.5" fill="#dff1ff"/>
      <path d="M14 42l-10 3 10 3Z" fill="#3d8fd1"/><circle cx="42" cy="28" r="9.5" fill="#5fb4f0"/><path d="M50 27l10 3-10 3.4Z" fill="#f6a623"/>${eye(44, 26)}${cheek(45, 31)}`),
    // 2 蝴蝶
    butterfly: S(`<path d="M32 30C22 9 3 12 8 28c3 10 16 8 24 4Z" fill="#ff9f43"/><path d="M32 30C42 9 61 12 56 28c-3 10-16 8-24 4Z" fill="#ff9f43"/>
      <path d="M32 34c-10 0-21 6-16 16 4 6 12 0 16-12Z" fill="#ffd166"/><path d="M32 34c10 0 21 6 16 16-4 6-12 0-16-12Z" fill="#ffd166"/>
      <circle cx="17" cy="23" r="4" fill="#fff" opacity=".75"/><circle cx="47" cy="23" r="4" fill="#fff" opacity=".75"/><circle cx="21" cy="44" r="2.5" fill="#fff" opacity=".7"/><circle cx="43" cy="44" r="2.5" fill="#fff" opacity=".7"/>
      <rect x="30" y="21" width="4" height="27" rx="2" fill="#4a3728"/><path d="M31 22q-3-8-8-10M33 22q3-8 8-10" stroke="#4a3728" stroke-width="1.6" fill="none"/>`),
    // 3 聖母瑪利亞（藍色斗篷、雙手合十、光環）
    mary: S(`<ellipse cx="32" cy="12" rx="12" ry="4" fill="none" stroke="#ffd43b" stroke-width="3"/>
      <path d="M32 13c-12 0-16 10-16 20 0 14-4 23-4 27h40c0-4-4-13-4-27 0-10-4-20-16-20Z" fill="#4a7fd4"/>
      <path d="M32 16c-6 0-9 5-9 11v6h18v-6c0-6-3-11-9-11Z" fill="#f8f9fa"/><circle cx="32" cy="25" r="7" fill="#fde0c5"/>
      <path d="M29.5 24.5q1 1 2 0M32.5 24.5q1 1 2 0" stroke="#5a3d2b" stroke-width="1.3" fill="none"/><path d="M30.5 28.5q1.5 1 3 0" stroke="#c9736b" stroke-width="1.3" fill="none"/>
      <path d="M32 36l-5 9h10Z" fill="#fde0c5"/><path d="M24 34q8 6 16 0" stroke="#3b6ab8" stroke-width="2" fill="none"/>`),
    // 4 耶穌（白袍紅肩帶、張開雙手、光環）
    jesus: S(`<ellipse cx="32" cy="9" rx="12" ry="4" fill="none" stroke="#ffd43b" stroke-width="3"/>
      <path d="M22 31q-10 3-16 11l5 3 12-8ZM42 31q10 3 16 11l-5 3-12-8Z" fill="#f1f3f5"/><circle cx="7" cy="43" r="3" fill="#f3cfa9"/><circle cx="57" cy="43" r="3" fill="#f3cfa9"/>
      <path d="M22 29h20l5 31H17Z" fill="#f1f3f5"/><path d="M39 29l-13 31h8l9-29Z" fill="#c0392b" opacity=".85"/>
      <path d="M23 18c0-9 18-9 18 0v13c0 3-18 3-18 0Z" fill="#7a4b2a"/><ellipse cx="32" cy="21" rx="6.5" ry="7.5" fill="#f3cfa9"/>
      <path d="M26 24q6 10 12 0q-6 4-12 0Z" fill="#7a4b2a"/><circle cx="29.5" cy="20" r="1.2" fill="#3b2a1a"/><circle cx="34.5" cy="20" r="1.2" fill="#3b2a1a"/>`),
    // 5 佛祖（盤腿坐、光暈）
    buddha: S(`<circle cx="32" cy="22" r="17" fill="#ffe8a3" opacity=".55"/><path d="M10 56c0-15 8-23 22-23s22 8 22 23Z" fill="#f08c2e"/>
      <path d="M12 56c5-6 13-8 20-8s15 2 20 8Z" fill="#e0782a"/><path d="M24 33l8 9 8-9" fill="#f7c873"/><ellipse cx="32" cy="48" rx="8" ry="3.4" fill="#f7c873"/>
      <ellipse cx="22.5" cy="21" rx="1.8" ry="4.5" fill="#f7c873"/><ellipse cx="41.5" cy="21" rx="1.8" ry="4.5" fill="#f7c873"/><circle cx="32" cy="21" r="9" fill="#f7c873"/>
      <path d="M23 18a9 9 0 0 1 18 0q-9-4-18 0Z" fill="#5a3d1e"/><circle cx="32" cy="10" r="3.4" fill="#5a3d1e"/><circle cx="32" cy="17.5" r="1" fill="#e8590c"/>
      <path d="M27.5 22q1.5 1 3 0M33.5 22q1.5 1 3 0" stroke="#5a3d1e" stroke-width="1.4" fill="none"/><path d="M29.5 26q2.5 2 5 0" stroke="#b5562f" stroke-width="1.4" fill="none"/>`),
    // 6 趕著上班的老伯（往右跑）
    oldman: S(`<path d="M26 44l-8 11M35 44l9 9" stroke="#3b3b55" stroke-width="5"/><path d="M18 55h-6M44 53l5 3" stroke="#2b2b2b" stroke-width="4"/>
      <path d="M21 27h20l2 19H19Z" fill="#4a5a7a"/><path d="M28 27l3 4 3-4Z" fill="#fff"/><path d="M31 30l-2 6 2 7 2-7Z" fill="#d6404b"/>
      <path d="M21 31l-9 5M41 31l8-7" stroke="#4a5a7a" stroke-width="5"/><circle cx="12" cy="36" r="2.6" fill="#f6d2b0"/><circle cx="49" cy="24" r="2.6" fill="#f6d2b0"/>
      <circle cx="33" cy="16" r="9" fill="#f6d2b0"/><path d="M24.5 15q0-5 3-7M41.5 15q0-5-3-7" stroke="#e9ecef" stroke-width="3.4" fill="none"/>
      <circle cx="30" cy="16" r="2.7" fill="none" stroke="#333" stroke-width="1.2"/><circle cx="37" cy="16" r="2.7" fill="none" stroke="#333" stroke-width="1.2"/><path d="M32.7 16h1.6" stroke="#333" stroke-width="1.2"/>
      <path d="M31 21q2.5 1.5 4.5-.5" stroke="#a15c4f" stroke-width="1.3" fill="none"/>${sweat(45, 8)}`),
    // 7 沒人吃的便當
    bento: S(`<rect x="7" y="20" width="50" height="32" rx="6" fill="#b5522f"/><rect x="10" y="23" width="44" height="26" rx="3" fill="#fff8ec"/><path d="M32 23v26" stroke="#b5522f" stroke-width="2.4"/>
      <circle cx="21" cy="36" r="3.4" fill="#e74c3c"/><path d="M14 29h.01M18 44h.01M26 30h.01M27 43h.01M15 39h.01" stroke="#868e96" stroke-width="1.6"/>
      <ellipse cx="42" cy="30" rx="7" ry="4.2" fill="#ffd43b"/><ellipse cx="42" cy="30" rx="3" ry="2" fill="#ffa94d"/><path d="M36 40h10" stroke="#e8594f" stroke-width="5"/><circle cx="49" cy="44" r="3.6" fill="#4caf50"/><circle cx="46" cy="46" r="2.6" fill="#40a845"/>
      <path d="M18 14q-3-4 0-7M26 15q-3-4 0-7M34 14q-3-4 0-7" stroke="#adb5bd" stroke-width="1.8" fill="none"/>`),
    // 8 法拉利（面向左，被拖吊車往左拖）
    ferrari: S(`<path d="M3 44q0-6 7-8l11-7q6-3 14-3h7q6 0 10 6l6 3q4 1 4 6v5H3Z" fill="#e62020"/><path d="M22 31q4-3 12-3h7q4 0 6 3l-2 4H20Z" fill="#9fd8ff"/>
      <path d="M33 28v7" stroke="#e62020" stroke-width="2"/><rect x="3" y="41" width="7" height="3" rx="1" fill="#ffe066"/><path d="M54 33l7-3v5h-7Z" fill="#b51515"/><circle cx="36" cy="40" r="2.2" fill="#ffd43b"/>
      ${wheel(16, 49)}${wheel(48, 49)}`),
    // 9 氣球
    balloon: S(`<path d="M32 4c-12 0-18 10-18 19 0 12 10 20 18 22 8-2 18-10 18-22 0-9-6-19-18-19Z" fill="#ff5c7a"/><path d="M29.5 45l2.5 3.5 2.5-3.5Z" fill="#e0405e"/>
      <path d="M32 48q-6 6 0 9t0 6" stroke="#868e96" stroke-width="1.4" fill="none"/><ellipse cx="24" cy="14" rx="3.6" ry="6" fill="#fff" opacity=".5"/>${eye(27, 24, 2)}${eye(37, 24, 2)}<path d="M29 29q3 2.4 6 0" stroke="#5a1a2a" stroke-width="1.4" fill="none"/>`),
    // 10 雞（面向左，往左跑）
    chicken: S(`<path d="M30 50l-2 9M40 50l2 9" stroke="#f0a020" stroke-width="3"/><path d="M50 30q11-8 9 7q-5 2-9 2Z" fill="#f1f3f5" stroke="#dee2e6" stroke-width="1.2"/>
      <ellipse cx="36" cy="39" rx="18" ry="13" fill="#fff" stroke="#dee2e6" stroke-width="1.2"/><path d="M31 37q8-5 14 3q-8 5-14-3Z" fill="#e9ecef"/>
      <circle cx="21" cy="24" r="9" fill="#fff" stroke="#dee2e6" stroke-width="1.2"/><path d="M15 16q2-7 5-2q2-6 5 0q4-4 4 3l-13 2Z" fill="#e53935"/>
      <path d="M12 23l-7 2.5 7 2.5Z" fill="#f6a623"/><path d="M14 28q-1 6 3 6q1-3-1-6Z" fill="#e53935"/>${eye(18, 22, 2)}`),
    // 11 鴨子（往右）
    duck: S(`<path d="M28 52l-2 7h-5M37 52l2 7h5" stroke="#f08c00" stroke-width="3" fill="none"/><path d="M13 38q-7-7-2-11q4 6 7 6Z" fill="#ffd43b"/>
      <ellipse cx="29" cy="41" rx="18" ry="12" fill="#ffd43b"/><path d="M21 39q8-6 16 2q-8 6-16-2Z" fill="#fcc419"/>
      <circle cx="40" cy="23" r="10" fill="#ffd43b"/><path d="M48 24q10-1 13 2q-4 4-13 2Z" fill="#ff922b"/>${eye(43, 20)}${cheek(39, 27)}`),
    // 12 火箭（朝上）
    rocket: S(`<path d="M32 3c10 8 12 22 10 37H22c-2-15 0-29 10-37Z" fill="#f1f3f5" stroke="#ced4da" stroke-width="1.2"/><path d="M32 3c5 4 8 9 9 14H23c1-5 4-10 9-14Z" fill="#e03131"/>
      <circle cx="32" cy="26" r="5" fill="#74c0fc" stroke="#495057" stroke-width="2"/><path d="M22 31l-8 13 8-3ZM42 31l8 13-8-3Z" fill="#e03131"/><rect x="26" y="40" width="12" height="5" rx="2" fill="#868e96"/>`),
    // 13 0 分考卷
    exam: S(`<path d="M13 5h28l10 10v44H13Z" fill="#fff" stroke="#ced4da" stroke-width="1.5"/><path d="M41 5v10h10" fill="#e9ecef" stroke="#ced4da" stroke-width="1.5"/>
      <path d="M19 15h15M19 21h24M19 27h20" stroke="#adb5bd" stroke-width="2"/><ellipse cx="32" cy="43" rx="8" ry="10" fill="none" stroke="#e03131" stroke-width="4"/><path d="M21 56h22" stroke="#e03131" stroke-width="2.4"/>`),
    // 14 小幽靈
    ghost: S(`<path d="M14 56V28C14 16 22 8 32 8s18 8 18 20v28l-6-4-6 4-6-4-6 4-6-4Z" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.5"/>
      <ellipse cx="25" cy="28" rx="3" ry="4" fill="#343a40"/><ellipse cx="39" cy="28" rx="3" ry="4" fill="#343a40"/><ellipse cx="32" cy="38" rx="3" ry="2.4" fill="#343a40"/>${cheek(20, 34)}${cheek(44, 34)}`),
    // 15 烏龜（往右慢慢爬）
    turtle: S(`<path d="M18 46v7M38 46v7" stroke="#a9e34b" stroke-width="6"/><path d="M11 43l-6 2" stroke="#a9e34b" stroke-width="4"/>
      <path d="M10 44q0-22 20-22t20 22Z" fill="#74b816"/><path d="M18 42l5-11h14l5 11M30 22v9" stroke="#5c940d" stroke-width="2" fill="none"/><ellipse cx="30" cy="45" rx="21" ry="4" fill="#94d82d"/>
      <circle cx="53" cy="38" r="7.5" fill="#a9e34b"/>${eye(55, 36, 2)}<path d="M53 42q2 1 4 0" stroke="#5c940d" stroke-width="1.2" fill="none"/>`),
    // 16 獨角獸（往右上踩彩虹）
    unicorn: S(`<path d="M16 48v10M23 49v9M33 49v9M40 48v10" stroke="#f1f3f5" stroke-width="4"/><path d="M12 36q-8 0-8 10q6-2 9-6Z" fill="#f783ac"/>
      <ellipse cx="28" cy="40" rx="17" ry="11" fill="#fff" stroke="#e9ecef" stroke-width="1.2"/><path d="M37 34l7-12 8 4-4 11Z" fill="#fff"/>
      <ellipse cx="50" cy="22" rx="9" ry="6.5" fill="#fff" stroke="#e9ecef" stroke-width="1.2"/><path d="M49 16l3-13 3 12Z" fill="#fcc419"/>
      <path d="M43 16q-6 5-4 15M46 18q-4 6-2 14" stroke="#da77f2" stroke-width="3" fill="none"/><path d="M41 15q-3 3-3 7" stroke="#74c0fc" stroke-width="3" fill="none"/>${eye(52, 20, 1.8)}${cheek(55, 25)}`),
    // 17 外星人
    alien: S(`<path d="M24 52q8 8 16 0v-6H24Z" fill="#69db7c"/><path d="M24 13l-4-8M40 13l4-8" stroke="#69db7c" stroke-width="2.5"/><circle cx="20" cy="5" r="3" fill="#ffd43b"/><circle cx="44" cy="5" r="3" fill="#ffd43b"/>
      <ellipse cx="32" cy="30" rx="18" ry="20" fill="#8ce99a"/><ellipse cx="24" cy="30" rx="5.5" ry="8" fill="#212529" transform="rotate(-20 24 30)"/><ellipse cx="40" cy="30" rx="5.5" ry="8" fill="#212529" transform="rotate(20 40 30)"/>
      <circle cx="22" cy="27" r="1.8" fill="#fff"/><circle cx="38" cy="27" r="1.8" fill="#fff"/><path d="M29 42q3 2 6 0" stroke="#2b8a3e" stroke-width="1.6" fill="none"/>`),
    // 18 魚（往右跳回大海）
    fish: S(`<path d="M16 32L3 20v24Z" fill="#ff922b"/><ellipse cx="34" cy="32" rx="22" ry="14" fill="#ffa94d"/><path d="M27 19q7-9 13 0Z" fill="#ff922b"/><path d="M30 46q5 6 9 0Z" fill="#ff922b"/>
      <path d="M28 20q-4 12 0 24" stroke="#ff922b" stroke-width="2" fill="none"/><circle cx="46" cy="28" r="3.2" fill="#fff"/><circle cx="47" cy="28" r="1.7" fill="#222"/><path d="M51 36q2.5 2 5 0" stroke="#d9480f" stroke-width="1.6" fill="none"/>`),
    // 19 地址寫錯的包裹
    parcel: S(`<rect x="9" y="17" width="46" height="38" rx="3" fill="#d9a066"/><rect x="9" y="17" width="46" height="8" fill="#c58a52"/><rect x="28" y="17" width="8" height="38" fill="#f1d6a8"/>
      <rect x="13" y="33" width="12" height="9" rx="1" fill="#fff"/><path d="M15 36h8M15 39h6" stroke="#adb5bd" stroke-width="1.2"/>
      <path d="M42 31q0-4 4-4t4 4q0 3-4 4v2" stroke="#e03131" stroke-width="2.2" fill="none"/><circle cx="46" cy="42" r="1.4" fill="#e03131"/>`),
    // 20 忍者
    ninja: S(`<path d="M41 40l15-11" stroke="#adb5bd" stroke-width="3"/><ellipse cx="32" cy="47" rx="14" ry="12" fill="#343a40"/><circle cx="32" cy="24" r="14" fill="#343a40"/>
      <rect x="19" y="20" width="26" height="9" rx="4" fill="#fde0c5"/><circle cx="27" cy="24.5" r="2" fill="#222"/><circle cx="37" cy="24.5" r="2" fill="#222"/><path d="M25 21l3.5 1M39 21l-3.5 1" stroke="#222" stroke-width="1.4"/>
      <path d="M18 16h28" stroke="#e03131" stroke-width="3"/><path d="M46 16q8 0 10 6M46 17q6 4 6 10" stroke="#e03131" stroke-width="2.5" fill="none"/>`),
    // 21 小恐龍（往右，慢慢消失）
    dino: S(`<path d="M16 40Q4 40 2 30q8 6 16 4Z" fill="#38d9a9"/><path d="M22 49v9h6v-6M32 49v9h6v-6" fill="#38d9a9"/><ellipse cx="28" cy="40" rx="15" ry="12" fill="#38d9a9"/><ellipse cx="28" cy="44" rx="9" ry="6" fill="#96f2d7"/>
      <ellipse cx="43" cy="22" rx="13" ry="9" fill="#38d9a9"/><path d="M38 14l3-6 3 6 3-5 3 6" fill="#12b886"/><path d="M50 27l2 2 2-2 2 2" stroke="#fff" stroke-width="1.6" fill="none"/>
      ${eye(47, 19)}<path d="M38 33q6 0 6 5" stroke="#38d9a9" stroke-width="3" fill="none"/>${sweat(36, 8)}`),
    // 22 手機
    phone: S(`<rect x="18" y="4" width="28" height="56" rx="6" fill="#343a40"/><rect x="21" y="10" width="22" height="42" rx="2" fill="#4dabf7"/><rect x="24" y="14" width="16" height="6" rx="2" fill="#fff" opacity=".9"/>
      <rect x="24" y="24" width="7" height="7" rx="2" fill="#ffd43b"/><rect x="33" y="24" width="7" height="7" rx="2" fill="#ff8787"/><rect x="24" y="33" width="7" height="7" rx="2" fill="#69db7c"/><rect x="33" y="33" width="7" height="7" rx="2" fill="#b197fc"/>
      <circle cx="32" cy="56" r="1.6" fill="#868e96"/><circle cx="45" cy="7" r="5" fill="#e03131"/>`),
    // 23 蜜蜂（往右）
    bee: S(`<ellipse cx="25" cy="20" rx="9" ry="7" fill="#e7f5ff" stroke="#a5d8ff" stroke-width="1.2"/><ellipse cx="38" cy="18" rx="9" ry="7" fill="#e7f5ff" stroke="#a5d8ff" stroke-width="1.2"/>
      <path d="M12 38l-6 1 6 2Z" fill="#343a40"/><ellipse cx="31" cy="38" rx="19" ry="14" fill="#fcc419"/>
      <path d="M22 26c-4 8-4 16 0 24h5c-3-8-3-16 0-24ZM33 24c-4 9-4 19 0 28h5c-3-9-3-19 0-28Z" fill="#343a40"/>${eye(45, 34, 2.2)}${cheek(46, 41)}`),
    // 24 迷你火山
    volcano: S(`<circle cx="26" cy="13" r="5" fill="#adb5bd"/><circle cx="34" cy="9" r="6" fill="#ced4da"/><circle cx="41" cy="14" r="4" fill="#adb5bd"/>
      <path d="M4 56l18-30h20l18 30Z" fill="#8d6e63"/><ellipse cx="32" cy="26" rx="10" ry="3" fill="#e8590c"/><path d="M24 27q-2 10 2 15M39 27q2 8-1 13" stroke="#ff6b3d" stroke-width="3" fill="none"/>
      <path d="M12 48q8-4 14 0M38 50q8-4 14 0" stroke="#6d4c41" stroke-width="2" fill="none"/>`),
    // 25 千元大鈔（往右，被收去當班費）
    cash: S(`<rect x="4" y="18" width="56" height="30" rx="3" fill="#a5d8ff" stroke="#1971c2" stroke-width="2"/><circle cx="32" cy="33" r="9" fill="#d0ebff" stroke="#1971c2" stroke-width="1.5"/>
      <text x="32" y="37" font-size="10" font-weight="700" text-anchor="middle" fill="#1864ab" font-family="sans-serif">1000</text><path d="M9 23h8M47 43h8" stroke="#1971c2" stroke-width="1.6"/>`),
    // 26 披薩
    pizza: S(`<path d="M9 13q23-11 46 0L32 61Z" fill="#ffd43b"/><path d="M9 13q23-11 46 0l-2 5q-21-9-42 0Z" fill="#e8a25c"/>
      <circle cx="25" cy="25" r="4" fill="#e03131"/><circle cx="39" cy="27" r="4" fill="#e03131"/><circle cx="32" cy="41" r="3.5" fill="#e03131"/><path d="M22 33q1 4-1 7" stroke="#ffe066" stroke-width="3"/>`),
    // 27 雪人（融化）
    snowman: S(`<circle cx="32" cy="45" r="15" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.4"/><circle cx="32" cy="22" r="11" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.4"/>
      <rect x="23" y="5" width="18" height="9" rx="1" fill="#343a40"/><rect x="20" y="13" width="24" height="3" rx="1" fill="#343a40"/>
      <circle cx="28" cy="21" r="1.6" fill="#222"/><circle cx="36" cy="21" r="1.6" fill="#222"/><path d="M32 24l8 2-8 1Z" fill="#ff922b"/>
      <path d="M22 31h20M38 31l2 8" stroke="#e03131" stroke-width="4"/><circle cx="32" cy="41" r="1.6" fill="#343a40"/><circle cx="32" cy="48" r="1.6" fill="#343a40"/>${sweat(43, 12)}`),
    // 28 企鵝（往右，熱到找冷氣）
    penguin: S(`<path d="M24 58h8M34 58h8" stroke="#ff922b" stroke-width="3"/><ellipse cx="30" cy="36" rx="16" ry="22" fill="#343a40"/><ellipse cx="33" cy="40" rx="11" ry="16" fill="#fff"/>
      <path d="M15 32q-7 8-2 15q4-6 4-10Z" fill="#212529"/><path d="M42 21l9 2-9 3.4Z" fill="#ff922b"/><circle cx="37" cy="19" r="2.4" fill="#fff"/><circle cx="37.8" cy="19" r="1.3" fill="#222"/>${cheek(40, 26)}${sweat(24, 8)}`),
    // 29 龍（往右上飛，去龍舟賽）
    dragon: S(`<path d="M5 46q8-17 19-7t18-4q8-8 11-14" stroke="#40c057" stroke-width="9" fill="none"/><path d="M5 46q8-17 19-7t18-4" stroke="#ffd43b" stroke-width="2.6" fill="none" stroke-dasharray="2 4"/>
      <path d="M14 39l-2-5M30 35v-5M42 33l2-5" stroke="#fab005" stroke-width="2"/><ellipse cx="52" cy="18" rx="9" ry="7" fill="#40c057"/>
      <path d="M48 12l-2-7 4 5M54 11l1-7 2 6" stroke="#fab005" stroke-width="2" fill="none"/>${eye(54, 16, 2)}<path d="M59 21q4 2 2 6M57 23q2 4-2 6" stroke="#fab005" stroke-width="1.5" fill="none"/><path d="M56 22h5" stroke="#e03131" stroke-width="2"/>`),
    // 30 聖誕老公公
    santa: S(`<path d="M13 60q0-18 19-18t19 18Z" fill="#e03131"/><path d="M30 46h4v14h-4Z" fill="#fff"/><path d="M17 26q0-17 15-17q10 0 14 8l7-2-2 7q-4-4-5 4Z" fill="#e03131"/><circle cx="54" cy="14" r="4" fill="#fff"/>
      <rect x="15" y="24" width="34" height="6" rx="3" fill="#fff"/><circle cx="32" cy="34" r="9" fill="#fde0c5"/><path d="M20 34q2 18 12 18t12-18q-4 6-12 6t-12-6Z" fill="#fff"/>
      <circle cx="28" cy="32" r="1.6" fill="#222"/><circle cx="36" cy="32" r="1.6" fill="#222"/><circle cx="32" cy="36" r="2" fill="#ff8787"/>`),
    // 31 風箏
    kite: S(`<path d="M32 3l18 22-18 27-18-27Z" fill="#ff6b6b"/><path d="M32 3l18 22H32Z" fill="#ffd43b"/><path d="M14 25h18v27Z" fill="#4dabf7"/><path d="M32 3v49M14 25h36" stroke="#c92a2a" stroke-width="1.5"/>
      <path d="M32 52q-6 4 0 7t-2 5" stroke="#495057" stroke-width="1.2" fill="none"/><path d="M27 56l5 2-5 2ZM37 58l-5 2 5 2Z" fill="#69db7c"/>`),
    // 32 掃地機器人
    robot: S(`<ellipse cx="32" cy="43" rx="26" ry="10" fill="#495057"/><ellipse cx="32" cy="39" rx="26" ry="10" fill="#dee2e6"/><ellipse cx="32" cy="37" rx="12" ry="4" fill="#adb5bd"/>
      <circle cx="26" cy="37" r="1.8" fill="#4dabf7"/><circle cx="38" cy="37" r="1.8" fill="#4dabf7"/><circle cx="52" cy="39" r="2" fill="#51cf66"/>
      <path d="M8 48l-4 5M14 50l-2 6" stroke="#868e96" stroke-width="2"/><path d="M4 30h.01M10 26h.01" stroke="#adb5bd" stroke-width="3"/>`),
    // 33 野貓（灰色虎斑，往右跳出窗外）
    cat: S(`<path d="M12 44q-11-6-6-16" stroke="#868e96" stroke-width="4" fill="none"/><path d="M20 52v6M36 52v6" stroke="#adb5bd" stroke-width="5"/><ellipse cx="28" cy="44" rx="16" ry="11" fill="#adb5bd"/>
      <path d="M22 37l3 7M28 35l2 8M34 36l1 7" stroke="#868e96" stroke-width="2"/><path d="M36 21l-1-11 8 6ZM51 17l5-8v11Z" fill="#adb5bd"/><circle cx="45" cy="28" r="11" fill="#adb5bd"/>
      <path d="M45 18v4M41 19l1 3M49 19l-1 3" stroke="#868e96" stroke-width="1.6"/><ellipse cx="41.5" cy="28" rx="1.6" ry="2.4" fill="#2b2b2b"/><ellipse cx="49.5" cy="28" rx="1.6" ry="2.4" fill="#2b2b2b"/>
      <path d="M44 32l1.5 1.5 1.5-1.5" stroke="#5c3d2e" stroke-width="1.2" fill="none"/><path d="M53 31h7M53 34l7 1" stroke="#495057" stroke-width=".9"/>`),
    // 34 青蛙
    frog: S(`<path d="M10 54q-4 4 2 6h8M54 54q4 4-2 6h-8" stroke="#40c057" stroke-width="4" fill="none"/><ellipse cx="32" cy="42" rx="22" ry="15" fill="#51cf66"/><ellipse cx="32" cy="48" rx="12" ry="7" fill="#b2f2bb"/>
      <circle cx="21" cy="25" r="8" fill="#51cf66"/><circle cx="43" cy="25" r="8" fill="#51cf66"/><circle cx="21" cy="25" r="4.5" fill="#fff"/><circle cx="43" cy="25" r="4.5" fill="#fff"/>
      <circle cx="22" cy="26" r="2.4" fill="#222"/><circle cx="44" cy="26" r="2.4" fill="#222"/><path d="M22 40q10 8 20 0" stroke="#2b8a3e" stroke-width="2" fill="none"/>${cheek(15, 36)}${cheek(49, 36)}`),
    // 35 袋鼠（往右跳）
    kangaroo: S(`<path d="M18 48Q4 52 2 60q12-2 20-8Z" fill="#c08552"/><path d="M24 54l-4 7h10M34 54l4 6h8" stroke="#c08552" stroke-width="5" fill="none"/>
      <ellipse cx="28" cy="40" rx="12" ry="15" fill="#d08c4f"/><ellipse cx="30" cy="45" rx="7" ry="8" fill="#f0c49a"/><circle cx="30" cy="41" r="3" fill="#d08c4f"/><circle cx="31" cy="40.5" r=".8" fill="#222"/>
      <path d="M36 30l8 4" stroke="#c08552" stroke-width="3"/><path d="M36 14l-2-10 5 8ZM41 13l2-10 2 10Z" fill="#c08552"/><ellipse cx="41" cy="20" rx="9" ry="7" fill="#d08c4f"/>${eye(44, 18, 1.8)}<circle cx="49.5" cy="21" r="1.4" fill="#5c3d2e"/>`),
    // 36 老虎（面向左，往左跑）
    tiger: S(`<path d="M54 38q8-2 8-12" stroke="#ff922b" stroke-width="4" fill="none"/><path d="M26 50v8M34 50v8M42 50v8M48 48v8" stroke="#ff922b" stroke-width="5"/><ellipse cx="36" cy="40" rx="18" ry="11" fill="#ff922b"/>
      <path d="M32 30v8M38 30v9M44 31v8" stroke="#343a40" stroke-width="2.4"/><circle cx="11" cy="21" r="4" fill="#ff922b"/><circle cx="25" cy="21" r="4" fill="#ff922b"/><circle cx="18" cy="30" r="11" fill="#ff922b"/>
      <ellipse cx="17" cy="35" rx="6" ry="4" fill="#fff"/>${eye(14, 28, 1.8)}${eye(22, 28, 1.8)}<path d="M16 33l2 1.5 2-1.5" stroke="#222" stroke-width="1.2" fill="none"/><path d="M18 20v4M13 23l1 2M23 23l-1 2" stroke="#343a40" stroke-width="1.6"/>`),
    // 37 珍珠奶茶
    boba: S(`<path d="M18 18h28l-4 40H22Z" fill="#e9d6c4" stroke="#ced4da" stroke-width="1.5"/><path d="M19 27h26l-3 31H22Z" fill="#c8956d"/>
      <circle cx="26" cy="52" r="2.6" fill="#3b2a1a"/><circle cx="32" cy="54" r="2.6" fill="#3b2a1a"/><circle cx="38" cy="52" r="2.6" fill="#3b2a1a"/><circle cx="29" cy="48" r="2.6" fill="#3b2a1a"/><circle cx="35" cy="48" r="2.6" fill="#3b2a1a"/>
      <rect x="16" y="14" width="32" height="5" rx="2" fill="#f8f9fa"/><path d="M37 3l-4 47" stroke="#ff6b6b" stroke-width="4"/>`),
    // 38 冰淇淋
    icecream: S(`<path d="M20 30l12 30 12-30Z" fill="#e8a25c"/><path d="M22 34l18 6M24 40l14 6M27 34l9 18" stroke="#c97b35" stroke-width="1.2"/>
      <circle cx="32" cy="22" r="13" fill="#ffa8c5"/><path d="M19 26q2 7 5 2q2 6 5 1q3 5 6 0q3 6 6-1q3 3 3-3Z" fill="#ffa8c5"/><path d="M41 31q1 6-1 8" stroke="#ffa8c5" stroke-width="3"/>
      <circle cx="32" cy="8" r="3" fill="#e03131"/><ellipse cx="27" cy="17" rx="3" ry="2" fill="#fff" opacity=".6"/>`),
    // 39 章魚
    octopus: S(`<path d="M14 40q-6 10 0 15M22 42q-4 12 2 15M31 44q0 12 4 13M39 42q4 12-2 15M47 40q6 10 0 15" stroke="#9775fa" stroke-width="5" fill="none"/>
      <ellipse cx="31" cy="28" rx="18" ry="17" fill="#b197fc"/>${eye(25, 28, 2.8)}${eye(37, 28, 2.8)}<ellipse cx="31" cy="37" rx="3" ry="2.4" fill="#7048e8"/><ellipse cx="22" cy="18" rx="4" ry="3" fill="#fff" opacity=".35"/>`),
    // 40 蝙蝠
    bat: S(`<path d="M32 27q-10-13-28-6q4 4 2 10q6-2 8 4q4-4 8 0q4-4 10-8Z" fill="#495057"/><path d="M32 27q10-13 28-6q-4 4-2 10q-6-2-8 4q-4-4-8 0q-4-4-10-8Z" fill="#495057"/>
      <path d="M25 25l-1-8 5 5ZM39 25l1-8-5 5Z" fill="#343a40"/><ellipse cx="32" cy="33" rx="9" ry="10" fill="#343a40"/>
      <circle cx="29" cy="31" r="1.9" fill="#ffd43b"/><circle cx="35" cy="31" r="1.9" fill="#ffd43b"/><path d="M30 37l1 2 1-2M32 37l1 2 1-2" stroke="#fff" stroke-width="1" fill="none"/>`),
    // 41 公車（面向左，往左開）
    bus: S(`<rect x="4" y="15" width="56" height="33" rx="6" fill="#fab005"/><rect x="4" y="15" width="56" height="6" rx="3" fill="#f08c00"/>
      <rect x="6" y="23" width="10" height="13" rx="2" fill="#a5d8ff"/><rect x="20" y="23" width="9" height="10" rx="1.5" fill="#a5d8ff"/><rect x="32" y="23" width="9" height="10" rx="1.5" fill="#a5d8ff"/><rect x="44" y="23" width="9" height="10" rx="1.5" fill="#a5d8ff"/>
      <rect x="4" y="40" width="5" height="4" rx="1" fill="#fff3bf"/><path d="M6 38h10" stroke="#f08c00" stroke-width="2"/>${wheel(16, 49)}${wheel(48, 49)}`),
    // 42 飯糰
    riceball: S(`<path d="M32 7Q44 7 54 42q2 13-10 15H20Q8 55 10 42Q20 7 32 7Z" fill="#fff" stroke="#dee2e6" stroke-width="1.5"/><rect x="22" y="40" width="20" height="18" rx="2" fill="#2b3a2f"/>
      <circle cx="27" cy="29" r="2" fill="#343a40"/><circle cx="37" cy="29" r="2" fill="#343a40"/><path d="M30 34q2 2 4 0" stroke="#343a40" stroke-width="1.4" fill="none"/>${cheek(23, 33)}${cheek(41, 33)}`),
    // 43 臭襪子
    sock: S(`<path d="M21 4h19v28l12 12q6 8-2 14q-6 4-12-2L21 40Z" fill="#f8f9fa" stroke="#ced4da" stroke-width="1.5"/><path d="M21 10h19M21 16h19M21 22h19" stroke="#ff6b6b" stroke-width="3"/>
      <path d="M50 22q-3-4 0-8M56 27q-3-4 0-8M45 16q-3-4 0-8" stroke="#94d82d" stroke-width="2" fill="none"/>`),
    // 44 閃電
    lightning: S(`<path d="M38 2L12 36h16l-6 26 30-38H34Z" fill="#ffd43b" stroke="#f08c00" stroke-width="2"/>`),
    // 45 咖啡
    coffee: S(`<path d="M44 30q10 0 10 8t-10 8" stroke="#ced4da" stroke-width="4" fill="none"/><path d="M14 24h30v24q0 8-8 8H22q-8 0-8-8Z" fill="#f8f9fa" stroke="#ced4da" stroke-width="1.5"/>
      <ellipse cx="29" cy="25" rx="14" ry="3" fill="#7a4b2a"/><path d="M24 18q-3-4 0-8t0-8M33 18q-3-4 0-8t0-8" stroke="#adb5bd" stroke-width="2" fill="none"/>
      <path d="M29 44l-4-4a2.6 2.6 0 0 1 4-3a2.6 2.6 0 0 1 4 3Z" fill="#ff8787"/>`),
    // 46 綿羊（睡著）
    sheep: S(`<path d="M20 52v6M29 52v6M38 52v6M46 52v6" stroke="#495057" stroke-width="4"/>
      <g fill="#f8f9fa" stroke="#dee2e6" stroke-width="1.2"><circle cx="22" cy="38" r="9"/><circle cx="32" cy="32" r="10"/><circle cx="42" cy="38" r="9"/><circle cx="34" cy="46" r="10"/><circle cx="23" cy="46" r="9"/></g>
      <ellipse cx="44" cy="28" rx="3" ry="1.8" fill="#495057"/><ellipse cx="51" cy="33" rx="7" ry="8" fill="#495057"/><path d="M47 32q1.5 1.5 3 0M52 32q1.5 1.5 3 0" stroke="#fff" stroke-width="1.2" fill="none"/>`),
    // 47 倉鼠
    hamster: S(`<path d="M26 56h4M34 56h4" stroke="#f4b183" stroke-width="3"/><circle cx="18" cy="22" r="5" fill="#f4b183"/><circle cx="46" cy="22" r="5" fill="#f4b183"/><circle cx="18" cy="22" r="2.5" fill="#ffc9c9"/><circle cx="46" cy="22" r="2.5" fill="#ffc9c9"/>
      <ellipse cx="32" cy="38" rx="20" ry="18" fill="#f4b183"/><ellipse cx="32" cy="44" rx="13" ry="11" fill="#fff4e6"/>${eye(25, 33)}${eye(39, 33)}
      <ellipse cx="32" cy="37" rx="1.6" ry="1.2" fill="#e8590c"/><ellipse cx="20" cy="40" rx="5" ry="4" fill="#ffd8a8"/><ellipse cx="44" cy="40" rx="5" ry="4" fill="#ffd8a8"/>`),
    // 48 星星
    star: S(`<path d="M32 4l8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2Z" fill="#ffd43b" stroke="#fab005" stroke-width="2"/>
      <circle cx="27" cy="31" r="2" fill="#5c3d00"/><circle cx="37" cy="31" r="2" fill="#5c3d00"/><path d="M29 36q3 2.5 6 0" stroke="#5c3d00" stroke-width="1.6" fill="none"/>`),
    // 49 小龍捲風
    tornado: S(`<path d="M8 10h48q-2 6-10 8H18Q8 16 8 10Z" fill="#adb5bd"/><path d="M14 22h36q-2 6-10 7H22q-8-1-8-7Z" fill="#ced4da"/><path d="M20 33h24q-2 5-8 6h-8q-6-1-8-6Z" fill="#adb5bd"/>
      <path d="M25 43h14q-1 4-5 5h-4q-4-1-5-5Z" fill="#ced4da"/><path d="M29 51h6q0 4-3 7q-3-3-3-7Z" fill="#adb5bd"/><path d="M14 10q10 4 20 0M20 22q8 3 16 0" stroke="#868e96" stroke-width="1.5" fill="none"/>`),
    // 50 蝸牛（往右慢慢爬）
    snail: S(`<path d="M4 54q0-6 8-6h36q6-12 10-14q2 6-2 14q-2 6-8 6Z" fill="#d8f5a2"/><path d="M50 35l-2-10M56 35l2-10" stroke="#a9e34b" stroke-width="2"/><circle cx="48" cy="24" r="2" fill="#222"/><circle cx="58" cy="24" r="2" fill="#222"/>
      <circle cx="28" cy="34" r="16" fill="#e8a25c"/><path d="M28 34m-3 0a3 3 0 1 1 6 0a7 7 0 1 1-14 0a11 11 0 1 1 22 0" stroke="#b07a45" stroke-width="2.5" fill="none"/>`),
  };

  // 配角（把牠們帶走的）
  const HELP = {
    oldman: S(`<path d="M24 22v-6h16v6" stroke="#5c3a1a" stroke-width="4" fill="none"/><rect x="8" y="22" width="48" height="32" rx="4" fill="#8d5524"/><rect x="8" y="34" width="48" height="4" fill="#5c3a1a"/><rect x="28" y="32" width="8" height="8" rx="1" fill="#fcc419"/>`),
    bento: S(`<rect x="26" y="9" width="12" height="6" rx="2" fill="#2f9e44"/><rect x="10" y="15" width="44" height="7" rx="2" fill="#2f9e44"/><path d="M14 22h36l-4 37H18Z" fill="#40c057"/><path d="M24 30v22M32 30v22M40 30v22" stroke="#2b8a3e" stroke-width="2.5"/>`),
    ferrari: S(`<rect x="22" y="30" width="38" height="12" rx="2" fill="#fab005"/><path d="M4 42V30q0-6 6-8h12v20Z" fill="#fab005"/><path d="M8 24h10v8H6Z" fill="#a5d8ff"/><rect x="10" y="18" width="7" height="3" rx="1" fill="#e03131"/>
      <path d="M44 30l12-16" stroke="#495057" stroke-width="3"/><path d="M56 14v12" stroke="#495057" stroke-width="1.5"/><path d="M53 26q3 4 6 0" stroke="#495057" stroke-width="2" fill="none"/>${wheel(14, 46)}${wheel(48, 46)}`),
    parcel: S(`<rect x="38" y="20" width="18" height="16" rx="2" fill="#fd7e14"/><path d="M14 48l6-16h10l4 12h16" stroke="#e03131" stroke-width="5" fill="none"/><path d="M20 32l-4-6h6" stroke="#495057" stroke-width="3" fill="none"/>
      <path d="M30 20l-2 13h8" stroke="#1c7ed6" stroke-width="5" fill="none"/><circle cx="31" cy="14" r="6" fill="#4dabf7"/><rect x="25" y="13" width="12" height="3" rx="1.5" fill="#1c7ed6"/>${wheel(14, 50)}${wheel(50, 50)}`),
    officer: S(`<rect x="18" y="34" width="28" height="26" rx="6" fill="#364fc7"/><circle cx="26" cy="42" r="2" fill="#fcc419"/><circle cx="32" cy="24" r="10" fill="#fde0c5"/>
      <rect x="18" y="13" width="28" height="7" rx="2" fill="#364fc7"/><rect x="20" y="19" width="24" height="3" fill="#212529"/><circle cx="32" cy="15.5" r="2.4" fill="#fcc419"/>
      <circle cx="28" cy="25" r="1.6" fill="#222"/><circle cx="36" cy="25" r="1.6" fill="#222"/><path d="M29 30h6" stroke="#a15c4f" stroke-width="1.5"/>`),
    teacher: S(`<rect x="18" y="34" width="28" height="26" rx="6" fill="#ae3ec9"/><path d="M32 34v26" stroke="#fff" stroke-width="2"/><circle cx="32" cy="24" r="10" fill="#fde0c5"/>
      <path d="M22 22q0-12 10-12t10 12q-4-6-10-6t-10 6Z" fill="#5c3d2e"/><circle cx="28" cy="25" r="3" fill="none" stroke="#333" stroke-width="1.3"/><circle cx="36" cy="25" r="3" fill="none" stroke="#333" stroke-width="1.3"/>
      <path d="M31 25h2" stroke="#333" stroke-width="1.3"/><path d="M29 30q3 2 6 0" stroke="#a15c4f" stroke-width="1.4" fill="none"/>`),
    alien: S(`<ellipse cx="32" cy="22" rx="12" ry="10" fill="#a5d8ff" opacity=".85"/><ellipse cx="32" cy="32" rx="28" ry="9" fill="#868e96"/><ellipse cx="32" cy="30" rx="28" ry="7" fill="#ced4da"/>
      <circle cx="16" cy="31" r="2" fill="#ffd43b"/><circle cx="32" cy="34" r="2" fill="#ffd43b"/><circle cx="48" cy="31" r="2" fill="#ffd43b"/>`),
    buddha: S(`<path d="M32 40q-6-14 0-24q6 10 0 24Z" fill="#f783ac"/><path d="M32 40q-16-6-18-18q12 2 18 18ZM32 40q16-6 18-18q-12 2-18 18Z" fill="#faa2c1"/>
      <path d="M32 40q-22 0-26-10q14-2 26 10ZM32 40q22 0 26-10q-14-2-26 10Z" fill="#fcc2d7"/><ellipse cx="32" cy="42" rx="20" ry="4" fill="#63e6be"/>`),
    santa: S(`<path d="M18 46l-6 10M24 47l-2 10M34 47l4 9M40 45l6 9" stroke="#a0522d" stroke-width="4"/><ellipse cx="28" cy="40" rx="16" ry="9" fill="#a0522d"/><path d="M40 32l2 6" stroke="#a0522d" stroke-width="6"/>
      <path d="M42 20q-4-8-10-10M40 14l-6 2M48 20q2-8 8-12M54 12l4 2" stroke="#6b3e1f" stroke-width="2" fill="none"/><ellipse cx="46" cy="26" rx="8" ry="7" fill="#a0522d"/>
      <circle cx="54" cy="27" r="3" fill="#e03131"/>${eye(47, 24, 1.6)}`),
  };
  HELP.boba = HELP.coffee = HELP.teacher;
  HELP.phone = HELP.officer;
  window.PET_ART = { art: ART, help: HELP };
})();
