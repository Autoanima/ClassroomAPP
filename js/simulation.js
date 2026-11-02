
'use strict';
(() => {
  const A=window.App;if(!A.SIM)return;
  const bar=document.querySelector('.test-banner');
  if(A.SIM==='seats'){
    bar.innerHTML='<b>🧪 現場選位模擬・獨立示範資料</b><button id="simReset">重置模擬</button><button id="simExit">結束模擬</button>';
    document.querySelector('#simReset').onclick=async()=>{if(!await A.ask('清除本分頁的現場選位示範進度？','重置模擬'))return;Object.keys(sessionStorage).filter(k=>k.startsWith('classroom.sim.')).forEach(k=>sessionStorage.removeItem(k));location.reload();};
    document.querySelector('#simExit').onclick=()=>location.href=location.pathname;
    const h=document.createElement('p');h.className='panel sim-help';h.textContent='導師選擇段考順序 → 開始現場選位 → 開啟白板全畫面 → 點空位安排目前同學。右側可查看完整順序與已選名單。';bar.after(h);return;
  }
  bar.innerHTML=`<b>🧪 ${A.SIM==='jobs'?'依序選工作':'線上選位'}模擬・獨立示範資料</b><label>目前身分 <select id="simUser"><option value="${A.esc(A.D.teacherLabel)}">導師</option>${A.DEMO_STUDENTS.map(k=>`<option value="${A.esc(k)}">學生 ${A.esc(k)}</option>`).join('')}</select></label><button id="simCurrent">扮演目前輪到的同學</button><button id="simTeacher">回到導師</button><button id="simReset">重置模擬</button><button id="simExit">結束模擬</button>`;
  document.querySelector('#simUser').value=A.isTeacher()?A.D.teacherLabel:A.me();
  document.querySelector('#simUser').onchange=e=>A.simulateUser(e.target.value);
  document.querySelector('#simTeacher').onclick=()=>A.simulateUser(A.D.teacherLabel);
  document.querySelector('#simCurrent').onclick=async()=>{
    try {
      let key;
      if(A.SIM==='jobs'){const s=await A.api('classControl',{command:{act:'jobs'}});key=s.open&&s.order[s.turn];}
      else {const r=await A.api('selState');key=r.sel?.waiting;}
      if(!key)return A.toast('請先以導師身分載入順序並開始選取');
      A.simulateUser(key);
    }catch(e){A.toast(e.message);}
  };
  document.querySelector('#simReset').onclick=async()=>{if(!await A.ask('清除這個分頁的模擬進度並重新開始？','重置模擬'))return;Object.keys(sessionStorage).filter(k=>k.startsWith('classroom.sim.')).forEach(k=>sessionStorage.removeItem(k));location.reload();};
  document.querySelector('#simExit').onclick=()=>{location.href=location.pathname;};
  const hint=document.createElement('div');hint.className='panel sim-help';hint.textContent=A.SIM==='jobs'?'模擬步驟：導師設定名額並開放新一輪 → 扮演目前輪到的同學 → 選工作 → 回到導師確認進度。可選其他學生，確認未輪到時無法選取。':'模擬步驟：導師載入段考順序 → 開始選位 → 扮演目前輪到的同學 → 點座位確認 → 回到導師檢查進度。也可測試預選志願、暫停及繼續。';
  bar.after(hint);
})();
