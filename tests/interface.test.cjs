const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../js/',f),'utf8');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('announcement controls persist hide/show preference and auto-open omits hidden posts',async()=>{
  const events={}, bodyEvents={}, buttons={}, pref=new Set(['p1']), repeat=new Set();
  let html='';
  const A={
    $:id=>buttons[id] ||= {addEventListener:(ev,fn)=>{buttons[id][ev]=fn;}},
    esc,toast(){},store:{get:(k,f)=>f,set(){}},
    D:{teacherLabel:'導師'},me:()=> 'student',isTeacher:()=>false,isStaff:()=>false,isGuest:()=>false,
    started:()=>true,fmtDate:()=> '2026/10/23',sheetHead:()=>'',sheetHandlers:{},sheetMode:()=>null,
    sheetBody:{addEventListener:(ev,fn)=>bodyEvents[ev]=fn},
    openSheet:(mode,s)=>{html=s;},on:(ev,fn)=>events[ev]=fn,
    api:async(action,p)=>{
      if(action==='getBoard')return {posts:[{id:'p1',t:Date.now()-2*864e5,date:'2026/10/23',time:'2026/10/23 12:00',text:'隱藏公告',by:'導師'},{id:'p2',t:Date.now(),date:'2026/10/23',time:'2026/10/23 13:00',text:'持續公告',by:'導師'}]};
      if(action==='classControl'){const c=p.command;c.repeat?repeat.add(c.id):repeat.delete(c.id);}
      return {hidden:[...pref],repeat:[...repeat]};
    },
  };
  vm.runInNewContext(read('board.js'),{window:{App:A},document:{addEventListener(){}},sessionStorage:{getItem:()=>null,setItem(){}},setTimeout(){},console});
  await events.start();
  assert.ok(html.includes('持續公告'));assert.ok(!html.includes('隱藏公告'));
  await buttons['#boardBtn'].click();
  assert.ok(html.includes('隱藏公告'));assert.ok(html.includes('每日重複出現'));
  const note={textContent:''}, checkbox={dataset:{act:'boardPref',id:'p1'},checked:false,closest:()=>({querySelector:()=>note})};
  await bodyEvents.change({target:checkbox});
  assert.equal(repeat.has('p1'),false);assert.match(note.textContent,/只自動顯示一天/);
  checkbox.checked=true;await bodyEvents.change({target:checkbox});
  assert.equal(repeat.has('p1'),true);assert.match(note.textContent,/每天自動顯示/);
});

test('seat leave type fills the portrait above the name and is safely escaped',()=>{
  const source=read('seats.js');
  const fn=source.slice(source.indexOf('  function seatHtml(s) {'),source.indexOf('  function seatClass(s) {'));
  const c=vm.createContext({esc,inSel:()=>false,cur:()=>({A1:'student'}),parseKey:()=>({code:'料01',name:'同學'}),faceHtml:()=>'<img>',weather:[],A:{fmtDate:()=> '2026/10/23',onLeave:()=>['病假 第1節～第7節'],arenaLost:()=>false}});
  vm.runInContext(fn,c);
  const html=c.seatHtml({id:'A1'});
  assert.match(html,/<span class="seat-leave"/);
  assert.ok(html.indexOf('病假</span>')<html.indexOf('sn-name'));
  c.A.onLeave=()=>['<script> 第1節'];
  assert.ok(!c.seatHtml({id:'A1'}).includes('<script>'));
});

test('entering seats can bypass stale leave cache and match old seat names by department/number',async()=>{
  const source=read('app.js'), snippet=source.slice(source.indexOf('  let leaveMap ='),source.indexOf('  // 單位的狀態'));
  let day='2026/10/23', calls=0, data={'料01新名字':['病假 第1節～第7節']}, fail=false;
  const c=vm.createContext({settings:{gasUrl:'test'},TEST:false,fmtDate:()=>day,App:{emit(){}},api:async()=>{calls++;if(fail)throw new Error('沒有權限，請更新後端部署');return {leaves:data};}});
  vm.runInContext(snippet+'\nglobalThis.service = { loadLeaves, onLeave, leaveState };',c);
  await c.service.loadLeaves();
  assert.equal(c.service.onLeave('料1舊名字')[0],'病假 第1節～第7節');
  assert.equal(c.service.onLeave('料０１')[0],'病假 第1節～第7節');
  assert.equal(c.service.onLeave('多01別人'),null);
  data={'料02同學':['公假 第1節']};
  await c.service.loadLeaves();assert.equal(calls,1);
  await c.service.loadLeaves(null,true);assert.equal(calls,2);
  assert.equal(c.service.onLeave('料01新名字'),null);
  assert.equal(c.service.onLeave('料02同學')[0],'公假 第1節');
  fail=true;await c.service.loadLeaves(null,true);
  assert.match(c.service.leaveState().error,/沒有權限/);
  assert.equal(c.service.leaveState().loading,false);
  day='2026/10/24';assert.equal(c.service.onLeave('料02同學'),null);
});

test('seat header distinguishes no leave from a failed request',()=>{
  const source=read('seats.js'),fn=source.slice(source.indexOf('  function renderTop() {'),source.indexOf('  // 非導師的交換位置：試用提示'));
  const root={innerHTML:''};let state={date:'2026/10/23',leaves:{},loading:false,error:''};
  const c=vm.createContext({esc,$:()=>root,sub:'chart',selLive:()=>false,studentBanner:()=>'',A:{isStudent:()=>true,isGuest:()=>false,isTeacher:()=>false,fmtDate:()=> '2026/10/23',leaveState:()=>state}});
  vm.runInContext(fn,c);c.renderTop();assert.match(root.innerHTML,/0 位/);
  state={...state,error:'請更新後端部署'};c.renderTop();assert.match(root.innerHTML,/讀取失敗/);assert.match(root.innerHTML,/請更新後端部署/);
  state={...state,error:'',leaves:{'料01同學':['病假 第1節']}};c.renderTop();
  assert.match(root.innerHTML,/1 位/);assert.match(root.innerHTML,/料01同學：病假/);
});
test('many failed hatches show one message/animation; each successful hatch stays separate and nothing replays',async()=>{
  const s=read('pets.js');
  const grouping=s.slice(s.indexOf('  async function playGoneBatch('),s.indexOf('  const wait =',s.indexOf('  async function playGoneBatch(')));
  const events=s.slice(s.indexOf('  async function events()'),s.indexOf('  // ── 點寵物：'));
  let messages=0,animations=0;
  const seen={got:[],egg:[],hatch:[],dead:[],gone:[]};
  const pets=[0,1].map(i=>({id:'ok'+i,owner:'student',status:'寵物',hatch:Date.now()}));
  const c=vm.createContext({seen,P:{pets,gone:Array.from({length:150},(_,i)=>({id:'gone'+i,owner:'student',hatch:Date.now()}))},playing:false,geo:null,
    A:{currentTab:()=> 'seats',isGuest:()=>false,me:()=> 'student'},store:{set(){}},esc,nm:x=>x,look:()=>'',petName:x=>x.owner,EGG:'🥚',goneText:x=>({g:['🐦','fly'],what:'一隻小鳥',act:'飛走'}),goneHelp:()=>'',goneArt:()=>'<svg>bird</svg>',
    ensureLayer:()=>true,geometry:()=>({board:{x:0,y:0}}),seatCenter:()=>({x:100,y:200}),notice:async()=>{messages++;},fx:(html,cls)=>{animations++;assert.match(html,/class="seat-hatch"/);assert.match(html,/left:100px;top:200px/);assert.equal(cls,'hatch-party');return {remove(){}};},wait:async()=>{},banner(){},paintMap(){},remindWait(){}});
  vm.runInContext(grouping+events,c);await c.events();
  assert.equal(messages,3);assert.equal(animations,1);assert.equal(seen.gone.length,150);
  await c.events();assert.equal(messages,3);assert.equal(animations,1);
});
test('student seat panels keep calculation and order visible during selection and swapping',()=>{
  const s=read('seats.js'),fn=s.slice(s.indexOf('  function renderPanel()'),s.indexOf('  function legendHtml()'));
  const root={innerHTML:''},c=vm.createContext({$:()=>root,sub:'chart',A:{isTeacher:()=>false,isStudent:()=>true},rankExplainHtml:()=> '計分方式',rankReadHtml:()=> '全班排序',legendHtml:()=> '圖例'});
  vm.runInContext(fn,c);c.renderPanel();assert.match(root.innerHTML,/計分方式全班排序/);
  c.sub='swap';c.renderPanel();assert.match(root.innerHTML,/計分方式全班排序/);
});


test('seat weather hides expired or malformed cached dates and shows expiry',()=>{
  const source=read('seats.js');
  const fn=source.slice(source.indexOf('  function seatHtml(s) {'),source.indexOf('  function seatClass(s) {'));
  const c=vm.createContext({esc,inSel:()=>false,cur:()=>({A1:'student'}),parseKey:()=>({code:'料01',name:'同學'}),faceHtml:()=>'',weather:[{to:'student',kind:'sun',by:'A',exp:'2026/11/01'},{to:'student',kind:'sun',by:'A',exp:'Wed Oct 28 2026'},{to:'student',kind:'rain',by:'B',exp:'2026/11/02'}],A:{fmtDate:()=> '2026/11/02',onLeave:()=>null,arenaLost:()=>false}});
  vm.runInContext(fn,c);const html=c.seatHtml({id:'A1'});
  assert.ok(!html.includes('wx-sun'));assert.match(html,/wx-rain/);assert.match(html,/data-wx-exp="2026\/11\/02"/);assert.match(html,/有效至 2026\/11\/02/);
});


test('simulation storage stays in the tab and never touches production login or data',()=>{
  const s=read('app.js'), values=new Map(), calls=[];
  const local={getItem:()=>null,setItem:()=>{throw Error('production storage write');},removeItem:()=>{throw Error('production deletion');}};
  const session={getItem:k=>values.get(k),setItem:(k,v)=>{calls.push(k);values.set(k,v);},removeItem:k=>values.delete(k)};
  const c=vm.createContext({URLSearchParams,location:{search:'?simulate=jobs'},localStorage:local,sessionStorage:session,LS_MODE:'indoor.mode.v1'});
  vm.runInContext(s.slice(s.indexOf('  const SIM ='),s.indexOf('  const LS ='))+s.slice(s.indexOf('  const store ='),s.indexOf('  const idb ='))+';store.set("indoor.settings.v1",{role:"student"});globalThis.result={test:TEST,sim:SIM,data:store.get("indoor.settings.v1",null)};',c);
  assert.equal(c.result.test,true);assert.equal(c.result.sim,'jobs');assert.equal(c.result.data.role,'student');assert.deepEqual(calls,['classroom.sim.indoor.settings.v1']);
});


test('job simulation enforces capacity and turn and applies only its demo roster',async()=>{
  const s=read('classroom-control.js'),data={},students=['s1','s2'],roster={jobs:{J01:['old']}};let teacher=true,me='s1';
  const A={D:{teacherLabel:'導師'},students:()=>students,roster:()=>roster,isTeacher:()=>teacher,me:()=>me,store:{get:(k,d)=>data[k]||d,set:(k,v)=>data[k]=v},testSeatApi:async(a)=>a==='rankOrder'?{order:students}:null};
  const c=vm.createContext({A,defaultDefs:()=>[{id:'in:J01',name:'工作',cap:1}],canEdit:()=>teacher,console});
  vm.runInContext(s.slice(s.indexOf('  const fixedDemo ='),s.lastIndexOf('})();')),c);
  const call=command=>A.testSeatApi('classControl',{command});
  A.fmtDate=()=> '2026/11/02';
  await assert.rejects(call({act:'jobsStart'}),/總名額不足/);
  await call({act:'jobsConfig',defs:[{id:'in:J01',name:'工作',cap:2}]});await call({act:'jobsStart',exam:0});
  teacher=false;me='s2';await assert.rejects(call({act:'jobsPick',id:'in:J01'}),/還沒輪到/);
  me='s1';await call({act:'jobsPick',id:'in:J01'});assert.equal(data['indoor.demoroster.v1.test'],undefined);
  me='s2';const r=await call({act:'jobsPick',id:'in:J01'});assert.equal(r.open,false);assert.deepEqual(Array.from(data['indoor.demoroster.v1.test'].jobs.J01),students);assert.deepEqual(roster.jobs.J01,['old']);
});


test('work capacity display distinguishes draft values and shows the arithmetic',()=>{
 const s=read('classroom-control.js');const c=vm.createContext({});vm.runInContext(s.slice(s.indexOf('  function capacityHtml'),s.indexOf('  async function loadJobs')),c);
 const html=c.capacityHtml([{id:'in:J01',cap:27},{id:'out:J01',cap:14}],44,false);
 assert.match(html,/內掃 27 ＋外掃 14/);assert.match(html,/還差 3 個名額/);assert.match(html,/尚未儲存/);
 assert.match(c.capacityHtml([{id:'in:J01',cap:44}],44,true),/名額足夠/);
 assert.ok(read('app.js').includes('root.innerHTML = h + `<div id="jobPickRoot"></div>`'));
});


test('homework timeline keeps every incomplete item even months after deadline',()=>{
 const s=read('homework.js'),c=vm.createContext({Date,esc,stage:()=> 'late',remain:()=> '已截止'});
 vm.runInContext(s.slice(s.indexOf('  const hasMissing ='),s.indexOf('  function cardHtml'))+';globalThis.tracked=trackedHomework;',c);
 const now=Date.now(),items=Array.from({length:8},(_,i)=>({id:'old'+i,name:'未交項目'+i,start:now-100*864e5,end:now-60*864e5,n:i,total:10}));
 const html=c.timelineHtml(items);assert.equal((html.match(/class="hwt-row/g)||[]).length,8);assert.match(html,/8 項/);assert.match(html,/逾期未交/);
 assert.equal(c.tracked({end:now-60*864e5,n:10,total:10},now),false);
 assert.equal(c.tracked({end:now-60*864e5,forMe:true,myDone:null},now),true);
 assert.equal(c.tracked({end:now-60*864e5,forMe:true,myDone:now},now),false);
});


test('swap gift dialog permits an owned card with zero points and rejects no inventory',()=>{
 const src=read('shop.js');let html='';const S={unlimited:false,held:{交換位置卡:1},coins:0,me:'student',classmates:['student','other']};
 const c=vm.createContext({S,esc,CARD_PRICE:()=>({'交換位置卡':100}),A:{sheetHead:(t,d)=>t+d,openSheet:(m,h)=>html=h}});
 vm.runInContext(src.slice(src.indexOf('  function openCardGift('),src.indexOf('  A.sheetHandlers.giftcard')),c);
 c.openCardGift('交換位置卡','🔀');assert.match(html,/不扣點數/);assert.ok(!html.includes('100'));assert.ok(!html.includes(' disabled'));
 S.held={};c.openCardGift('交換位置卡','🔀');assert.match(html,/你沒有可轉送/);assert.match(html,/ disabled/);
});
