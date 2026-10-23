const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../js/',f),'utf8');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');

test('announcement controls persist hide/show preference and auto-open omits hidden posts',async()=>{
  const events={}, bodyEvents={}, buttons={}, pref=new Set(['p1']);
  let html='';
  const A={
    $:id=>buttons[id] ||= {addEventListener:(ev,fn)=>{buttons[id][ev]=fn;}},
    esc,toast(){},store:{get:(k,f)=>f,set(){}},
    D:{teacherLabel:'導師'},me:()=> 'student',isTeacher:()=>false,isStaff:()=>false,isGuest:()=>false,
    started:()=>true,fmtDate:()=> '2026/10/23',sheetHead:()=>'',sheetHandlers:{},sheetMode:()=>null,
    sheetBody:{addEventListener:(ev,fn)=>bodyEvents[ev]=fn},
    openSheet:(mode,s)=>{html=s;},on:(ev,fn)=>events[ev]=fn,
    api:async(action,p)=>{
      if(action==='getBoard')return {posts:[{id:'p1',date:'2026/10/23',time:'2026/10/23 12:00',text:'隱藏公告',by:'導師'},{id:'p2',date:'2026/10/23',time:'2026/10/23 13:00',text:'持續公告',by:'導師'}]};
      if(action==='setBoardPref')p.hidden?pref.add(p.id):pref.delete(p.id);
      return {hidden:[...pref]};
    },
  };
  vm.runInNewContext(read('board.js'),{window:{App:A},document:{addEventListener(){}},sessionStorage:{getItem:()=>null,setItem(){}},setTimeout(){},console});
  await events.start();
  assert.ok(html.includes('持續公告'));assert.ok(!html.includes('隱藏公告'));
  await buttons['#boardBtn'].click();
  assert.ok(html.includes('隱藏公告'));assert.ok(html.includes('data-id="p1" checked'));
  const note={textContent:''}, checkbox={dataset:{act:'boardPref',id:'p1'},checked:false,closest:()=>({querySelector:()=>note})};
  await bodyEvents.change({target:checkbox});
  assert.equal(pref.has('p1'),false);assert.equal(note.textContent,'持續顯示');
  checkbox.checked=true;await bodyEvents.change({target:checkbox});
  assert.equal(pref.has('p1'),true);assert.match(note.textContent,/週一恢復/);
});

test('seat leave type is inside the name container and safely escaped',()=>{
  const source=read('seats.js');
  const fn=source.slice(source.indexOf('  function seatHtml(s) {'),source.indexOf('  function seatClass(s) {'));
  const c=vm.createContext({esc,inSel:()=>false,cur:()=>({A1:'student'}),parseKey:()=>({code:'料01',name:'同學'}),faceHtml:()=>'<img>',weather:[],A:{fmtDate:()=> '2026/10/23',onLeave:()=>['病假 第1節～第7節'],arenaLost:()=>false}});
  vm.runInContext(fn,c);
  const html=c.seatHtml({id:'A1'});
  assert.match(html,/<span class="sn"><span class="seat-leave"/);
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
  const c=vm.createContext({esc,$:()=>root,sub:'chart',selLive:()=>false,studentBanner:()=>'',A:{isStudent:()=>true,fmtDate:()=> '2026/10/23',leaveState:()=>state}});
  vm.runInContext(fn,c);c.renderTop();assert.match(root.innerHTML,/0 位/);
  state={...state,error:'請更新後端部署'};c.renderTop();assert.match(root.innerHTML,/讀取失敗/);assert.match(root.innerHTML,/請更新後端部署/);
  state={...state,error:'',leaves:{'料01同學':['病假 第1節']}};c.renderTop();
  assert.match(root.innerHTML,/1 位/);assert.match(root.innerHTML,/料01同學：病假/);
});
