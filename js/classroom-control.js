'use strict';
(() => {
  const A = window.App, { $, esc, toast } = A;
  const canEdit = () => A.isTeacher() || A.canPoints();
  const call = command => A.api('classControl', { command });
  let duty = null, jobs = null, absenceRows = [], dutyBusy = false, jobsBusy = false;
  const options = (keys, selected) => `<option value="">請選擇</option>${keys.map(k => `<option value="${esc(k)}"${k === selected ? ' selected' : ''}>${esc(k)}</option>`).join('')}`;
  const error = (root, err, retry) => { root.innerHTML = `<div class="panel"><p class="hw-red">${esc(err.message)}</p><button class="btn" data-cc="${retry}">重新讀取</button></div>`; };

  async function loadDuty() {
    if (dutyBusy) return;
    dutyBusy = true;
    try { duty = await call({ act: 'duty' }); A.updateDuty(duty.today); renderDuty(); }
    catch (err) { error($('#dutyRoot'), err, 'dutyReload'); }
    finally { dutyBusy = false; }
  }
  function renderDuty() {
    const root = $('#dutyRoot');
    if (!duty) { root.innerHTML = '<div class="panel">讀取值日生中…</div>'; return; }
    const row = duty.today, editable = duty.canEdit;
    let h = `<div class="panel"><h2>🧹 值日生控制</h2><p>平日每科兩位，依座號輪值；今日請假或曠課自動補位。保留區一週內可手動補當。</p><p><b>${esc(row.date)}・${esc(row.by || '')}</b></p><button class="btn" data-cc="dutyReload">重新整理排班</button></div>`;
    h += `<div class="panel"><h3>今日名單</h3>`;
    for (const dept of ['多', '料']) {
      const keys = A.students().filter(k => k.startsWith(dept)), chosen = row.list.filter(k => k.startsWith(dept));
      h += `<h4>${dept === '多' ? '多媒科' : '資料科'}</h4><div class="duty-pick">${[0, 1].map(i => `<select data-duty-slot="${dept}:${i}"${editable ? '' : ' disabled'}>${options(keys, chosen[i])}</select>`).join('')}</div>`;
    }
    if (editable && row.by !== '非上課日') h += `<button class="btn btn--primary" data-cc="dutySave">儲存今日名單</button>`;
    h += `<ul class="control-list">${row.list.map(k => `<li><b>${esc(k)}</b><span>${esc(row.status?.[k] || '待完成')}</span>${editable ? `<button class="btn" data-cc="dutyGood" data-key="${esc(k)}">已完成</button><button class="btn btn--danger" data-cc="dutyBad" data-key="${esc(k)}">工作沒做好，隔日續任</button>` : ''}</li>`).join('')}</ul></div>`;
    h += `<div class="panel"><h3>📥 值日生工作保留區（${duty.hold.length}）</h3>${duty.hold.length ? `<ul class="control-list">${duty.hold.map(x => `<li><b>${esc(x.key)}</b><span>${esc(x.date)}・${esc(x.reason)}・保留至 ${esc(x.expires)}</span>${editable ? `<button class="btn" data-cc="dutyRestore" data-key="${esc(x.key)}">帶入今日名單補當</button>` : ''}</li>`).join('')}</ul>` : '<p class="muted">目前沒有待補當的同學。</p>'}</div>`;
    h += `<details class="panel"><summary>最近排班與紀錄</summary>${Object.keys(duty.history).sort().reverse().map(d => `<p><b>${esc(d)}</b> ${duty.history[d].list.map(esc).join('、')}<br><small>最後調整：${esc(duty.history[d].by)}</small></p>`).join('')}</details>`;
    root.innerHTML = h;
  }
  function defaultDefs() {
    const roster = A.roster(), existing = jobs?.defs || [], old = Object.fromEntries(existing.map(x => [x.id, x]));
    const defs = A.D.jobs.filter(j => !j.fixed).map(j => ({ id: 'in:' + j.id, name: '內掃：' + j.title, cap: j.slots }));
    if (roster?.outdoor) (A.D.outdoor?.jobs || []).forEach(j => defs.push({ id: 'out:' + j.id, name: '外掃：' + (roster.outdoor.labels?.[j.id] || j.title), cap: j.slots }));
    return defs.map(d => old[d.id] || d);
  }
  async function loadJobs() {
    if (jobsBusy) return;
    jobsBusy = true;
    try { jobs = await call({ act: 'jobs' }); A.renderWorkPick(); }
    catch (err) { const root = $('#jobPickRoot'); if (root) error(root, err, 'jobsReload'); }
    finally { jobsBusy = false; }
  }
  A.renderWorkPick = () => {
    const root = $('#jobPickRoot'); if (!root || !A.started()) return;
    if (!jobs) { root.innerHTML = '<div class="panel">讀取工作選填中…</div>'; loadJobs(); return; }
    let h = `<div class="panel"><h2>🙋 依序選工作</h2><p>依選座位的段考班名次輪流選填。環保股長職位不變；紙容器、塑膠餐盒、廚餘固定由值日生負責。</p><button class="btn" data-cc="jobsReload">重新整理進度</button>`;
    if (jobs.teacher) {
      h += `<details class="job-config"><summary>導師設定各掃區人數</summary><p>先停止選填再更改；每位同學一個工作，總名額須足夠全班。</p><div class="job-cap-grid">${defaultDefs().map(d => `<label>${esc(d.name)}<input type="number" min="0" max="44" data-job-cap="${d.id}" data-name="${esc(d.name)}" value="${d.cap}"${jobs.open ? ' disabled' : ''}></label>`).join('')}</div><button class="btn" data-cc="jobsConfig"${jobs.open ? ' disabled' : ''}>儲存人數設定</button></details>`;
      h += `<div class="actions"><select id="jobPickExam">${['第一次','第二次','第三次'].map((x,i)=>`<option value="${i}">${x}段考順序</option>`).join('')}</select><button class="btn btn--primary" data-cc="jobsStart"${jobs.open ? ' disabled' : ''}>開放新一輪選填</button><button class="btn" data-cc="jobsSkip"${jobs.open ? '' : ' disabled'}>目前同學延後</button><button class="btn" data-cc="jobsStop"${jobs.open ? '' : ' disabled'}>停止選填</button></div>`;
    }
    const current = jobs.order?.[jobs.turn];
    h += `<p><b>${jobs.open ? `目前輪到：${esc(current || '')}` : jobs.order?.length ? '本輪已結束／停止' : '尚未開放'}</b>${jobs.myTurn ? '・輪到你了，請選擇下方工作！' : ''}</p><div class="work-options">`;
    for (const d of jobs.defs) {
      const picked = Object.keys(jobs.picks || {}).filter(k => jobs.picks[k] === d.id), available = d.cap - picked.length;
      h += `<div class="work-option"><b>${esc(d.name)}</b><span>${picked.length}／${d.cap} 人</span><small>${picked.map(esc).join('、') || '尚無人選'}</small><button class="btn btn--primary" data-cc="jobsPick" data-id="${d.id}"${jobs.open && (jobs.myTurn || jobs.teacher) && available > 0 ? '' : ' disabled'}>${jobs.teacher ? '幫目前同學選這項' : '選這項工作'}</button></div>`;
    }
    h += `</div><details><summary>完整選填順序</summary><ol>${(jobs.order || []).map((k,i) => `<li>${esc(k)}${i === jobs.turn && jobs.open ? ' ← 目前' : ''}${jobs.picks?.[k] ? ' ✓' : ''}</li>`).join('')}</ol></details></div>`;
    root.innerHTML = h;
  };
  async function reloadWorkRoster() { try { await A.reloadWorkRoster(); } catch(err) { toast(err.message); } }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-cc]'); if (!b || b.disabled) return;
    const act = b.dataset.cc;
    if (act === 'dutyReload') return loadDuty();
    if (act === 'jobsReload') { await loadJobs(); return reloadWorkRoster(); }
    if (act === 'dutyRestore') {
      const dept = b.dataset.key[0], el = $(`[data-duty-slot="${dept}:0"]`); if (el) el.value = b.dataset.key;
      return toast('已帶入該科第一個名額，請確認四位名單後儲存');
    }
    if (act.startsWith('duty')) {
      let command = { act: 'dutyChange' };
      if (act === 'dutySave') command.list = [...document.querySelectorAll('[data-duty-slot]')].map(x=>x.value);
      else { command.action = act === 'dutyBad' ? 'bad' : 'good'; command.key = b.dataset.key; }
      if (act === 'dutyBad' && !await A.ask(`讓 ${b.dataset.key} 下一個上課日繼續當值日生？`, '登記未完成')) return;
      b.disabled = true;
      try { duty = await call(command); A.updateDuty(duty.today); renderDuty(); toast('值日生已更新，操作人已記錄'); } catch(err) { toast(err.message); b.disabled = false; }
    } else if (act.startsWith('jobs')) {
      let command = { act };
      if (act === 'jobsConfig') command.defs = [...document.querySelectorAll('[data-job-cap]')].map(x=>({id:x.dataset.jobCap,name:x.dataset.name,cap:Number(x.value)}));
      if (act === 'jobsStart') { command.exam = Number($('#jobPickExam').value); if (!await A.ask('開始新一輪依序選工作？目前工作分配會在本輪選完後更新。', '開放選填')) return; }
      if (act === 'jobsPick') { command.id = b.dataset.id; if (!await A.ask('確定選擇這項工作？會留下選填紀錄。', '選這項')) return; }
      b.disabled = true;
      try { jobs = await call(command); A.renderWorkPick(); await reloadWorkRoster(); toast('已更新工作選填'); } catch(err) { toast(err.message); b.disabled = false; }
    }
  });

  A.renderAbsences = async () => {
    const root = $('#absenceControl'); if (!root || !canEdit()) return;
    const date = A.fmtDate(new Date()).replace(/\//g,'-');
    root.innerHTML = `<details class="panel"><summary><b>🚫 曠課登記（導師／幹部）</b></summary><p class="small">每筆保留登記人及時間，並供值日生自動排班判斷。</p><div class="attendance-form"><select id="absStudent">${options(A.students())}</select><input type="date" id="absDate" value="${date}"><label>從第 <input type="number" id="absFrom" min="0" max="7" value="1"> 節</label><label>到第 <input type="number" id="absTo" min="0" max="7" value="7"> 節</label><input id="absNote" maxlength="200" placeholder="說明（選填）"><button class="btn btn--primary" data-attendance="add">登記曠課</button></div><div id="absenceRows">讀取紀錄中…</div></details>`;
    try {
      const r = await call({act:'absences'}); absenceRows = r.rows || [];
      const rows = $('#absenceRows'); if (!rows) return;
      rows.innerHTML = absenceRows.map(x=>`<div class="absence-row"><b>${esc(x.key)}・${esc(x.from)} 第${x.fromP}～${x.toP}節</b><small>登記：${esc(x.by)}・${esc(x.time)}${x.status==='已取消' ? `・已取消（${esc(x.cancelBy)}）` : ''}</small>${x.status!=='已取消'?`<button class="btn" data-attendance="cancel" data-id="${esc(x.id)}">取消錯誤紀錄</button>`:''}</div>`).join('') || '<p class="muted">目前沒有曠課紀錄。</p>';
    } catch(err) { const rows=$('#absenceRows'); if(rows)rows.textContent=err.message; }
  };
  document.addEventListener('click', async e => {
    const b=e.target.closest('[data-attendance]');if(!b||b.disabled)return;
    b.disabled=true;
    try {
      if(b.dataset.attendance==='add') await call({act:'absence',key:$('#absStudent').value,date:$('#absDate').value.replace(/-/g,'/'),fromP:Number($('#absFrom').value),toP:Number($('#absTo').value),note:$('#absNote').value});
      else { if(!await A.ask('取消這筆曠課？原紀錄與取消人會保留。','取消曠課',true)){b.disabled=false;return;} await A.api('cancelLeave',{id:b.dataset.id}); }
      toast('已更新曠課紀錄');A.renderAbsences();A.loadLeaves(null,true);
      // 更新請假日曆與名單。
      A.refreshLeave?.();
    }catch(err){toast(err.message);b.disabled=false;}
  });
  A.tabHooks.duty = () => { renderDuty(); loadDuty(); };
  A.on('start', () => { if (!A.isGuest()) loadDuty(); if(A.currentTab()==='jobs')loadJobs(); });
  setInterval(() => {
    if(document.hidden||!A.started()||A.isGuest())return;
    if(A.currentTab()==='duty'&&!document.activeElement?.closest('[data-duty-slot]'))loadDuty();
    if(A.currentTab()==='jobs'&&!document.activeElement?.closest('.job-config'))loadJobs();
  },15000);

  // 示範模式與正式資料隔離，讓白板和控制頁可在本機試用。
  const previousTest = A.testSeatApi;
  A.testSeatApi = async (action, p = {}) => {
    const me = A.isTeacher() ? A.D.teacherLabel : A.me(), key = 'indoor.control.v2.test';
    const state = A.store.get(key, { duty: null, jobs: { open:false,order:[],turn:0,picks:{},defs:[] }, repeat:{} });
    if (action === 'boardPrefs') {
      const r = await previousTest(action,p); return {...r,repeat:state.repeat[me]||[]};
    }
    if(action !== 'classControl') return previousTest ? previousTest(action,p) : null;
    const c = p.command || {}, today = A.fmtDate(new Date());
    const save = () => A.store.set(key,state);
    if(c.act === 'boardRepeat') {
      state.repeat[me]=(state.repeat[me]||[]).filter(id=>id!==c.id);if(c.repeat)state.repeat[me].push(c.id);save();
      return {ok:true,repeat:state.repeat[me]};
    }
    if(c.act === 'absences') return {ok:true,rows:A.store.get('indoor.leave.v1.test',[]).filter(x=>x.type==='曠課').reverse()};
    if(c.act === 'absence') {
      if(!canEdit())throw new Error('只有幹部可登記曠課');
      const rows=A.store.get('indoor.leave.v1.test',[]);
      rows.push({id:'abs'+Date.now(),t:Date.now(),time:A.fmtTime(new Date()),key:c.key,type:'曠課',from:c.date,to:c.date,fromP:c.fromP,toP:c.toP,by:me,status:'已確認',cards:[],note:c.note||''});
      A.store.set('indoor.leave.v1.test',rows);return {ok:true};
    }
    if(c.act?.startsWith('jobs')) {
      const s=state.jobs;
      if(c.act==='jobsConfig'){if(!A.isTeacher())throw new Error('只有導師可設定');s.defs=c.defs;}
      if(c.act==='jobsStart'){if(!A.isTeacher())throw new Error('只有導師可開放');const r=await A.testSeatApi('rankOrder',{exam:c.exam});s.order=r.order;s.turn=0;s.picks={};s.open=true;}
      if(c.act==='jobsStop')s.open=false;
      if(c.act==='jobsSkip'&&s.open)s.order.push(s.order.splice(s.turn,1)[0]);
      if(c.act==='jobsPick'){
        if(!s.open||(!A.isTeacher()&&s.order[s.turn]!==me))throw new Error('還沒輪到你');
        const d=s.defs.find(x=>x.id===c.id);if(!d||Object.values(s.picks).filter(x=>x===c.id).length>=d.cap)throw new Error('人數已滿');
        s.picks[s.order[s.turn++]]=c.id;if(s.turn>=s.order.length)s.open=false;
      }
      save();return {ok:true,...s,teacher:A.isTeacher(),myTurn:s.open&&s.order[s.turn]===me};
    }
    if(!state.duty||state.duty.today.date!==today||(!state.duty.today.list.length && A.students().length)){
      const list=['多','料'].flatMap(d=>A.students().filter(k=>k.startsWith(d)).slice(0,2));
      state.duty={ok:true,today:{date:today,list,status:{},by:'測試自動排班'},hold:[],history:{},repeat:[]};
    }
    const d=state.duty;d.canEdit=canEdit();
    if(c.act==='dutyChange'){
      if(!canEdit())throw new Error('只有幹部可調整');
      if(c.action==='bad'){d.today.status[c.key]='工作未完成，隔日續任';d.repeat=[...new Set([...d.repeat,c.key])];}
      else if(c.action==='good'){d.today.status[c.key]='已完成';d.repeat=d.repeat.filter(k=>k!==c.key);}
      else d.today.list=c.list;
      d.today.by=me;
    }
    d.history[today]=d.today;save();return d;
  };
})();
