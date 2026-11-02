const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '../gas/Code.gs'), 'utf8');

class Sheet {
  constructor() { this.rows = []; }
  getLastRow() { return this.rows.length; }
  getMaxRows() { return 1000; }
  setFrozenRows() {}
  appendRow(r) { this.rows.push([...r]); }
  getRange(row, col, nr = 1, nc = 1) {
    const s = this;
    return {
      getValues() { return Array.from({length: nr}, (_, i) => Array.from({length: nc}, (_, j) => s.rows[row+i-1]?.[col+j-1] ?? '')); },
      getValue() { return this.getValues()[0][0]; },
      getDisplayValues() { return this.getValues().map(r=>r.map(v=>String(v))); },
      setValues(v) { for(let i=0;i<nr;i++) for(let j=0;j<nc;j++) { s.rows[row+i-1] ||= []; s.rows[row+i-1][col+j-1] = v[i][j]; } return this; },
      setValue(v) { return this.setValues([[v]]); },
      clearContent() { return this.setValue(''); },
      setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; },
    };
  }
}
function setup(when = '2026-10-23T08:00:00Z') {
  let clock = Date.parse(when), seq = 0;
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const sheets = {}, props = {}, mails = [], spend = [];
  const db = { getSheetByName: n => sheets[n] || null, insertSheet: n => sheets[n] = new Sheet() };
  const local = d => new Date(d.getTime()+8*3600000);
  const c = vm.createContext({ Date: ClockDate, console,
    Logger: {log(){}},
    PropertiesService: {getScriptProperties: () => ({getProperty:k=>props[k] ?? null,setProperty(k,v){props[k]=v;}})},
    Utilities: {
      getUuid: () => 'uuid-'+ ++seq,
      formatDate(d,tz,f) { const x=local(d), day=x.toISOString().slice(0,10).replaceAll('-','/'); if(f==='u') return String(x.getUTCDay()||7); if(f==='HHmm') return x.toISOString().slice(11,16).replace(':',''); if(f==='yyyy/MM/dd') return day; return day+' '+x.toISOString().slice(11,16); },
      parseDate(s,tz,f) { return new ClockDate(s.replaceAll('/','-')+(s.length===10?'T00:00:00+08:00':'+08:00')); },
    },
  });
  vm.runInContext(source, c);
  Object.assign(c, {
    getSS: () => db, withLock: fn=>fn(), botMail: (list,from)=>mails.push(...list.map(x=>({to:x[0],text:x[1],from}))),
    getStudents:()=>({students:['cadre','inspector','helper','student']}),
    cadreRoles:k=>k==='cadre'?['班長']:[], courseHelperRoles:k=>k==='helper'?['英文小老師']:[], isInspector:k=>k==='inspector',
    scoringKeys:()=>['cadre','inspector','helper'],
    spendRows:()=>spend, addSpend:(who,points,use,target,note)=>spend.push({who,points,use,target,note,t:clock}),
    getLeave:()=>({ok:true}), resetAt:()=>0,
  });
  return {c,sheets,props,mails,spend, Date:ClockDate,setTime:t=>clock=Date.parse(t),eval:s=>vm.runInContext(s,c)};
}
function seedLeave(t, status='已上傳假卡') {
  const sh = t.eval('leaveSheet()');
  sh.appendRow(['leave1',new t.Date('2026-10-15T08:00:00Z'),'student','病假','2026/10/15',1,'2026/10/15',7,'',status,'photo1','','student',new t.Date(),new t.Date('2026-10-17T08:00:00Z'),'']);
  return sh;
}

test('invalid card resumes full overdue period, extra -0.3 only once per upload',()=>{
  const t=setup(), sh=seedLeave(t);
  assert.equal(t.c.leaveLatePenalties(0).length,0);
  t.c.setLeaveStatus({teacher:true},'leave1','假卡上傳錯誤','重新上傳');
  assert.equal(sh.rows[1][14],'');
  assert.equal(t.c.leaveLatePenalties(0)[0].p,-0.5);
  t.c.setLeaveStatus({teacher:true},'leave1','假卡上傳錯誤','重新上傳');
  assert.equal(t.sheets['加扣分紀錄'].rows.length,2);
  assert.equal(t.sheets['加扣分紀錄'].rows[1][2],-0.3);
  sh.rows[1][14]=new t.Date(); sh.rows[1][9]='已上傳假卡';
  t.setTime('2026-10-25T08:00:00Z');
  assert.equal(t.c.leaveLatePenalties(0)[0].p,-0.5);
  t.c.setLeaveStatus({teacher:true},'leave1','假卡上傳錯誤','再次錯誤');
  assert.equal(t.sheets['加扣分紀錄'].rows.length,3);
  assert.equal(t.c.leaveLatePenalties(0)[0].p,-0.7);
});
test('students cannot invalidate cards; unuploaded card cannot be penalized',()=>{
  const t=setup(), sh=seedLeave(t);
  assert.throws(()=>t.c.setLeaveStatus({key:'student'},'leave1','假卡上傳錯誤',''),/只有導師/);
  sh.rows[1][14]='';
  assert.throws(()=>t.c.setLeaveStatus({teacher:true},'leave1','假卡上傳錯誤',''),/沒有新的假卡/);
});
test('homework late rate is -0.2 per started day, stopped at submission',()=>{
  const t=setup();
  t.c.hwRows=()=>[{end:Date.parse('2026-10-22T07:00:00Z'),target:'all',done:{student:Date.parse('2026-10-22T08:00:00Z')},name:'作業'}];
  t.c.hwTargets=()=>['student','cadre'];
  const rows=t.c.hwLatePenalties(0);
  assert.equal(rows[0].p,-0.2); assert.equal(rows[1].p,-0.4);
});
test('scoring includes outside inspectors and course helpers, excludes ordinary students',()=>{
  const {c}=setup();
  for(const k of ['cadre','inspector','helper']) assert.equal(c.canScoreKey(k),true);
  assert.equal(c.canScoreKey('student'),false);
  assert.throws(()=>c.addPoints([{student:'student',points:1,reason:'test'}],{key:'student'}),/不能登記/);
});
test('Friday reminders are sent once; next week missing self-score costs -0.1 once',()=>{
  const t=setup(); t.c.weeklyCadreTick(); t.c.weeklyCadreTick();
  assert.deepEqual(t.mails.map(x=>x.to).sort(),['cadre','helper','inspector']);
  const ps=t.eval('pointsSheet()');
  ps.appendRow([new t.Date(),'cadre',1,'其他','努力','cadre',new t.Date(),'manual']);
  // Someone else giving the helper points is not self-scoring.
  ps.appendRow([new t.Date(),'helper',1,'其他','努力','cadre',new t.Date(),'other']);
  t.setTime('2026-10-26T00:00:00Z'); t.c.weeklyCadreTick(); t.c.weeklyCadreTick();
  const penalties=ps.rows.slice(1).filter(r=>r[2]<0);
  assert.equal(penalties.length,2); assert.ok(penalties.every(r=>r[2]===-0.1));
  assert.deepEqual(penalties.map(r=>r[1]).sort(),['helper','inspector']);
});
test('weekly button grants once; normal self-score prevents a duplicate grant',()=>{
  const t=setup(); let eggs=0; t.c.petLay=()=>++eggs;
  t.c.weeklySelfPoint({key:'inspector'});
  assert.throws(()=>t.c.weeklySelfPoint({key:'inspector'}),/已經/);
  assert.equal(eggs,1);
  const ps=t.eval('pointsSheet()');
  ps.appendRow([new t.Date(),'helper',1,'其他','努力','helper',new t.Date(),'manual']);
  assert.throws(()=>t.c.weeklySelfPoint({key:'helper'}),/已經/);
  assert.throws(()=>t.c.weeklySelfPoint({key:'student'}),/只有/);
});
test('announcement visibility is per account and expires Monday',()=>{
  const t=setup();t.c.getBoard=()=>[{id:'p1'}];
  t.c.setBoardPref({key:'student'},'p1',true);
  assert.equal(t.c.boardPrefs({key:'student'}).hidden.length,1);
  assert.equal(t.c.boardPrefs({key:'cadre'}).hidden.length,0);
  t.c.setBoardPref({key:'student'},'p1',false);
  assert.equal(t.c.boardPrefs({key:'student'}).hidden.length,0);
  t.c.setBoardPref({key:'student'},'p1',true);
  t.setTime('2026-10-26T00:00:00Z');
  assert.equal(t.c.boardPrefs({key:'student'}).hidden.length,0);
});
test('gift bonus is once per person/box; full-capacity eggs stay pending',()=>{
  const t=setup();let room=false, eggs=0;
  t.c.petRows=()=>[]; t.c.petLay=()=>room ? ++eggs : 0;
  t.c.boxBonus({key:'student'},'box1'); t.c.boxBonus({key:'student'},'box1');
  assert.equal(t.c.boxBonusRows().length,1);assert.equal(t.c.boxBonusRows()[0].points,3);
  assert.equal(t.c.boxBonusRows()[0].egg,'');
  room=true;t.c.claimBoxEggs('student');t.c.claimBoxEggs('student');
  assert.equal(eggs,1);assert.equal(t.c.boxBonusRows()[0].egg,'已領');
  t.c.boxBonus({key:'cadre'},'box1');assert.equal(t.c.boxBonusRows().length,2);
  assert.equal(t.c.boxBonus({teacher:true},'box1'),false);
});
test('incubator costs 5, consumes once, stacks 10/20/40/80/100 and rejects others/due eggs',()=>{
  const t=setup(); const egg={id:'egg',owner:'student',status:'待孵',hatch:0};
  t.c.petRows=()=>[egg];t.c.coinsOf=()=>({coins:5});t.c.shopState=()=>({ok:true});t.c.getPets=()=>({ok:true});
  t.c.buyIncubator({key:'student'});assert.equal(t.spend[0].points,5);
  t.c.useIncubator({key:'student'},'egg');assert.equal(t.c.incubatorsOf('student'),0);
  assert.throws(()=>t.c.useIncubator({key:'student'},'egg'),/購買/);
  for(let i=0;i<3;i++){t.c.buyIncubator({key:'student'});t.c.useIncubator({key:'student'},'egg');}
  t.c.buyIncubator({key:'student'});
  assert.throws(()=>t.c.useIncubator({key:'student'},'egg'),/100%/);
  assert.equal(t.c.incubatorsOf('student'),1);
  assert.throws(()=>t.c.useIncubator({key:'cadre'},'egg'),/自己/);
  egg.status='蛋';egg.hatch=t.Date.now()-1;
  assert.throws(()=>t.c.useIncubator({key:'student'},'egg'),/揭曉/);
  t.c.coinsOf=()=>({coins:4});assert.throws(()=>t.c.buyIncubator({key:'student'}),/5 點/);
});
test('actual hatching uses stacked boosts and caps success at 100%',()=>{
  for(const [uses, random, expected] of [[0,.15,'飛走'],[1,.15,'寵物'],[2,.35,'寵物'],[3,.75,'寵物'],[4,.999,'寵物']]) {
    const t=setup(), sheet=t.eval('petSheet()');
    const egg={row:2,id:'egg',owner:'student',status:'蛋',hatch:t.Date.now()-1000,hp:10,decay:'',cap:10};
    t.c.petRows=()=>[egg];t.c.petGiveAway=()=>{};t.c.petFix=()=>{};
    for(let i=0;i<uses;i++) t.spend.push({who:'student',use:'使用孵蛋器',target:'egg'});
    t.eval(`Math.random = () => ${random}`);
    t.c.petTick();assert.equal(sheet.rows[1][9],expected);
  }
});
test('gift coins are spendable income without adding grade points or creating extra eggs',()=>{
  const t=setup();t.c.petRows=()=>[];t.c.petLay=()=>0;
  t.c.boxBonus({key:'student'},'box1');
  t.c.invRows=()=>[];t.c.salesOf=()=>({items:[],income:0});t.c.packsFor=()=>[];t.c.investAwardsFor=()=>[];
  const coins=t.c.coinsOf('student');
  assert.equal(coins.coins,3);assert.equal(coins.earned,3);
  assert.equal(t.eval('pointsSheet().getLastRow()'),1);
});
test('opening the same gift box twice does not duplicate random reward, points or egg',()=>{
  const t=setup();let eggs=0;
  t.c.boxRows=()=>[{id:'box1',by:'導師'}];t.c.pickBoxReward=()=> '煙火';
  t.c.petRows=()=>[];t.c.petLay=()=>++eggs;
  const first=t.c.openGiftBox({key:'student',role:'S'},'box1',true);
  const again=t.c.openGiftBox({key:'student',role:'S'},'box1',true);
  assert.equal(first.bonus,true);assert.equal(again.bonus,false);
  assert.equal(t.c.boxBonusRows().length,1);assert.equal(eggs,1);
  assert.equal(t.eval('getSheet(SHEET_CARDS, HEAD_CARDS).getLastRow()'),2);
});
test('setup installs one hourly trigger, including when repeated',()=>{
  const t=setup(), triggers=[];
  t.c.ScriptApp={getProjectTriggers:()=>triggers,newTrigger:name=>({timeBased(){return this;},everyHours(n){assert.equal(n,1);return this;},create(){triggers.push({getHandlerFunction:()=>name});}})};
  t.c.setupFeatureUpdates();t.c.setupFeatureUpdates();
  assert.equal(triggers.length,1);
});
test('an inspector with an existing student session can score both self and classmates',()=>{
  const t=setup();t.c.readSession=()=> 'S|inspector';t.c.json=x=>x;t.c.petLay=()=>0;
  const rows=['inspector','student'].map(student=>({student,date:'2026/10/23',points:1,reason:'做好工作'}));
  const result=t.c.doPost({postData:{contents:JSON.stringify({sid:'test-session',action:'addPoints',rows})}});
  assert.equal(result.ok,true);assert.equal(t.eval('pointsSheet().getLastRow()'),3);
});
test('temporary egg-delivery failure keeps gift entitlement without duplicating the random prize',()=>{
  const t=setup();t.c.boxRows=()=>[{id:'box1',by:'導師'}];t.c.pickBoxReward=()=> '煙火';t.c.petRows=()=>[];
  t.c.petLay=()=>{throw new Error('temporary failure');};
  assert.equal(t.c.openGiftBox({key:'student',role:'S'},'box1',true).bonus,true);
  t.c.openGiftBox({key:'student',role:'S'},'box1',true);
  assert.equal(t.c.boxBonusRows().length,1);assert.equal(t.c.boxBonusRows()[0].egg,'');
  assert.equal(t.eval('getSheet(SHEET_CARDS, HEAD_CARDS).getLastRow()'),2);
});
test('students can read ranking order and score details, but guests cannot',()=>{
  const t=setup();
  t.c.examRanks=()=>({per:[{rank:{cadre:1,student:2},deptRank:{cadre:1,student:2},pct:{cadre:.1,student:.2},bonus:{cadre:1,student:-1},score:{cadre:91,student:79}}]});
  t.c.rankSheetUrl=()=>'';t.c.readSession=()=> 'S|student';t.c.json=x=>x;
  const r=t.c.doPost({postData:{contents:JSON.stringify({sid:'student-session',action:'rankOrder',exam:0})}});
  assert.equal(r.ok,true);assert.equal(r.order[0],'cadre');assert.equal(r.detail.student.score,79);
  assert.throws(()=>t.c.rankOrder({key:'student',role:'G'},0),/本班同學/);
});
test('student selection view exposes queue and ranks without exposing other wishes',()=>{
  const t=setup();
  const r=t.eval(`SelEngine.view({v:1,status:'ready',order:['cadre','student'],ranks:{cadre:1,student:2},turn:0,picks:{},deferred:{},wishes:{cadre:['A1'],student:['A2']},how:{},blocked:[],seats:['A1','A2']},'student',Date.now())`);
  assert.deepEqual([...r.order],['cadre','student']);assert.equal(r.ranks.cadre,1);
  assert.deepEqual([...r.myWishes],['A2']);assert.equal(r.wishes,undefined);
});

function dutySetup() {
  const t=setup('2026-11-02T00:00:00Z');
  t.c.getStudents=()=>({students:['多01','多02','多03','多04','料01','料02','料03','料04']});
  t.c.getDuty=()=>({date:t.eval('ymd(new Date())'),list:[]});
  t.c.cleanLeaves=()=>({leaves:{}});
  return t;
}
test('daily duty chooses two per department, avoids leave and keeps a seven-day reserve',()=>{
  const t=dutySetup();t.c.cleanLeaves=()=>({leaves:{'多01':['病假']}});
  const r=t.c.dutyStateV2({teacher:true});
  assert.equal(r.today.list.length,4);assert.equal(r.today.list.filter(k=>k.startsWith('多')).length,2);
  assert.ok(!r.today.list.includes('多01'));assert.equal(r.hold[0].key,'多01');assert.equal(r.hold[0].expires,'2026/11/09');
  const again=t.c.dutyStateV2({teacher:true});assert.deepEqual([...again.today.list],[...r.today.list]);
});
test('unfinished duty remains queued across same-day reads and continues next school day',()=>{
  const t=dutySetup(),r=t.c.dutyStateV2({teacher:true}),key=r.today.list[0];
  t.c.dutyChangeV2({teacher:true},{action:'bad',key});t.c.dutyStateV2({teacher:true});
  assert.ok(t.eval("controlRead('DUTY_AUTO_V2',{})").repeat.includes(key));
  t.setTime('2026-11-03T00:00:00Z');
  assert.ok(t.c.dutyStateV2({teacher:true}).today.list.includes(key));
});
test('newly registered leave replaces a scheduled duty student; manual restoration completes reserve',()=>{
  const t=dutySetup(),first=t.c.dutyStateV2({teacher:true}),key=first.today.list[0];
  t.c.cleanLeaves=()=>({leaves:{[key]:['曠課']}});
  const second=t.c.dutyStateV2({teacher:true});assert.ok(!second.today.list.includes(key));assert.ok(second.hold.some(x=>x.key===key));
  t.c.cleanLeaves=()=>({leaves:{}});
  const list=[...second.today.list],i=list.findIndex(k=>k[0]===key[0]);list[i]=key;
  const restored=t.c.dutyChangeV2({teacher:true},{list});assert.ok(restored.today.list.includes(key));assert.ok(!restored.hold.some(x=>x.key===key));
  assert.throws(()=>t.c.dutyChangeV2({key:'student'},{list}),/只有導師或幹部/);
});
test('cadres can register absence with author and time; ordinary students cannot',()=>{
  const t=setup('2026-11-02T00:00:00Z');
  assert.throws(()=>t.c.recordAbsence({key:'student'},{key:'student',date:'2026/11/02'}),/只有/);
  t.c.recordAbsence({key:'cadre'},{key:'student',date:'2026/11/02',fromP:1,toP:7});
  const row=t.c.leaveRows()[0];assert.equal(row.type,'曠課');assert.equal(row.by,'cadre');assert.ok(row.t>0);
  assert.equal(t.c.cleanLeaves('2026/11/02').leaves.student.length,1);
  assert.throws(()=>t.c.recordAbsence({key:'cadre'},{key:'student',date:'2026/11/02',fromP:1,toP:7}),/已登記/);
});
test('teacher removal reduces actual free-card inventory without charging or refunding coins',()=>{
  const t=setup();t.c.shopState=()=>({ok:true});t.c.adminItemList=()=>[{key:'student',items:[{type:'card',id:'煙火',name:'煙火',n:2}]}];
  t.eval("getSheet(SHEET_CARDS,HEAD_CARDS).appendRow([new Date(),'student','煙火',2,'贈送'])");
  t.c.adminRemoveItem({teacher:true},{key:'student',type:'card',id:'煙火',n:1});
  assert.equal(t.c.heldCards('student').煙火,1);assert.equal(t.spend.length,0);
  assert.throws(()=>t.c.adminRemoveItem({key:'cadre'},{key:'student',type:'card',id:'煙火'}),/只有導師/);
});
test('work selection enforces turn, capacity and locked roles, then persists more than two assignees',()=>{
  const t=setup();t.c.rankOrder=()=>({order:['cadre','inspector','helper'],label:'第一次段考'});
  assert.throws(()=>t.c.workPickConfigure({key:'cadre'},{defs:[]}),/只有導師/);
  t.c.workPickConfigure({teacher:true},{defs:[{id:'in:J06',name:'玻璃',cap:3},{id:'in:DUTY',name:'值日生',cap:4},{id:'in:I1',name:'環保',cap:1}]});
  assert.equal(t.c.workDefinitions().length,3);
  t.c.workPickStart({teacher:true},{exam:0});
  assert.throws(()=>t.c.workPickChoose({key:'helper'},{id:'in:J06'}),/還沒輪到/);
  for(const key of ['cadre','inspector','helper'])t.c.workPickChoose({key},{id:'in:J06'});
  assert.equal(t.eval("controlRead('ROSTER_EXTRA_IN',{})").J06.length,3);
  assert.equal(t.c.workPickView({key:'helper'}).open,false);
});
test('daily repeat preference remains per-user and can retain an older announcement',()=>{
  const t=setup();t.c.getBoard=()=>[{id:'post'}];
  t.c.boardRepeat({key:'student'},{id:'post',repeat:true});
  assert.deepEqual([...t.c.boardPrefs({key:'student'}).repeat],['post']);
  assert.equal(t.c.boardPrefs({key:'cadre'}).repeat.length,0);
  t.c.boardRepeat({key:'student'},{id:'post',repeat:false});assert.equal(t.c.boardPrefs({key:'student'}).repeat.length,0);
});
test('absence supports morning period zero and keeps original author after a cadre cancels',()=>{
  const t=setup('2026-11-02T00:00:00Z');
  t.c.recordAbsence({key:'cadre'},{key:'student',date:'2026/11/02',fromP:0,toP:0});
  const first=t.c.leaveRows()[0];assert.equal(first.toP,0);
  t.c.cancelLeave({key:'helper'},first.id);
  const row=t.c.leaveRows()[0];assert.equal(row.by,'cadre');assert.equal(row.cancelBy,'helper');assert.equal(row.status,'已取消');
  assert.equal(t.c.cleanLeaves('2026/11/02').leaves.student,undefined);
});
test('control data chunks preserve a large Chinese roster within script-property size limits',()=>{
  const t=setup();t.eval(`controlSave('BIG', {data:'同學名單'.repeat(2000)})`);
  assert.equal(t.eval(`controlRead('BIG',{}).data.length`),8000);
  assert.ok(Object.values(t.props).every(x=>Buffer.byteLength(x,'utf8')<9000));
});
test('teacher removal of an active weather card actually expires the effect',()=>{
  const t=setup();t.c.shopState=()=>({ok:true});t.c.adminItemList=()=>[{key:'student',items:[{type:'effect',id:'wx1',name:'小太陽卡',n:1}]}];
  t.eval(`getSheet(SHEET_SPEND,HEAD_SPEND).appendRow([new Date(),'student',5,'小太陽卡','student','2099/01/01','wx1'])`);
  t.c.adminRemoveItem({teacher:true},{key:'student',type:'effect',id:'wx1'});
  assert.equal(t.eval(`getSheet(SHEET_SPEND,HEAD_SPEND).getRange(2,6).getValue()`),'1900/01/01');
  assert.equal(t.eval(`getSheet(SHEET_SPEND,HEAD_SPEND).getRange(2,3).getValue()`),5);
});


test('weather expiry normalizes Sheets Date cells and rejects malformed expiry',()=>{
  const t=setup('2026-11-02T08:00:00Z');
  // Restore the real parser, which Sheets uses for date-formatted notes.
  vm.runInContext(source.slice(source.indexOf('function spendRows()'),source.indexOf('function addSpend(')),t.c);
  const sh=t.eval('getSheet(SHEET_SPEND, HEAD_SPEND)');
  sh.appendRow([new t.Date(),'student',5,'小太陽卡','student',new t.Date('2026-10-30T04:00:00Z'),'expired']);
  sh.appendRow([new t.Date(),'student',5,'小雨傘卡','student',new t.Date('2026-11-02T04:00:00Z'),'today']);
  sh.appendRow([new t.Date(),'student',5,'小太陽卡','student','not a date','invalid']);
  assert.equal(t.eval('spendRows()[0].note'),'2026/10/30');
  assert.equal(t.c.weatherList().length,1);assert.equal(t.c.weatherList()[0].kind,'rain');
  t.setTime('2026-11-02T16:00:00Z');assert.equal(t.c.weatherList().length,0);
});


test('work capacity reports exact deficit and unsaved settings separately',()=>{
 const t=setup();t.c.rankOrder=()=>({order:['a','b','c','d'],label:'測試'});
 assert.throws(()=>t.c.workPickStart({teacher:true},{exam:0}),/尚未儲存/);
 t.c.workPickConfigure({teacher:true},{defs:[{id:'in:J01',name:'內掃',cap:0},{id:'out:J01',name:'外掃',cap:1}]});
 const c=t.c.workPickView({teacher:true}).capacity;
 assert.equal(c.inside,0);assert.equal(c.outside,3);assert.equal(c.total,3);assert.equal(c.required,4);assert.equal(c.shortage,1);
 assert.throws(()=>t.c.workPickStart({teacher:true},{exam:0}),/還差 1 個名額/);
 t.c.workPickConfigure({teacher:true},{defs:[{id:'in:J01',name:'內掃',cap:1},{id:'out:J01',name:'外掃',cap:1}]});
 assert.equal(t.c.workPickView({teacher:true}).capacity.shortage,0);t.c.workPickStart({teacher:true},{exam:0});
});


test('only indoor environmental officer is fixed; outdoor inspectors can be replaced by picks',()=>{
 const t=setup();t.c.getRoster=()=>({inspectors:{I1:'cadre'},jobs:{}});t.c.rankOrder=()=>({order:['cadre','inspector','helper','student'],label:'測試'});
 t.c.workPickConfigure({teacher:true},{defs:[{id:'in:J01',name:'掃地',cap:1}]});
 const cap=t.c.workPickView({teacher:true}).capacity;assert.equal(cap.fixed,1);assert.equal(cap.required,3);assert.equal(cap.total,3);assert.equal(cap.shortage,0);
 const started=t.c.workPickStart({teacher:true},{exam:0});assert.deepEqual(Array.from(started.order),['inspector','helper','student']);
 t.c.workPickChoose({key:'inspector'},{id:'out:I1'});t.c.workPickChoose({key:'helper'},{id:'out:I2'});t.c.workPickChoose({key:'student'},{id:'in:J01'});
 const rows=t.eval('getSheet(SHEET_OUT,HEAD_ROSTER).rows');assert.ok(rows.some(r=>r[0]==='I1'&&r[2]==='inspector'));assert.ok(rows.some(r=>r[0]==='I2'&&r[2]==='helper'));
 assert.equal(t.eval("controlRead('ROSTER_EXTRA_OUT',{})").I1,undefined);
});


test('earned swap card transfers one owned card without buying or charging points',()=>{
 const t=setup();t.c.shopState=()=>({ok:true});t.c.coinsOf=()=>{throw Error('must not charge or check points for transfer');};
 t.eval("getSheet(SHEET_CARDS,HEAD_CARDS).appendRow([new Date(),'student','交換位置卡',1,'段考獎勵'])");
 assert.equal(t.c.heldCards('student').交換位置卡,1);
 t.c.giftCard({key:'student'},'交換位置卡','cadre');
 assert.equal(t.c.heldCards('student').交換位置卡,undefined);assert.equal(t.c.heldCards('cadre').交換位置卡,1);
 assert.equal(t.spend.length,1);assert.equal(t.spend[0].points,0);assert.equal(t.spend[0].use,'轉送道具');
 assert.throws(()=>t.c.giftCard({key:'student'},'交換位置卡','helper'),/沒有可轉送/);assert.equal(t.spend.length,1);
 t.c.giftCard({key:'cadre'},'交換位置卡','helper');assert.equal(t.c.heldCards('helper').交換位置卡,1);
 assert.throws(()=>t.c.giftCard({key:'helper'},'交換位置卡','helper'),/請選擇/);
});


test('all held special cards transfer without points or accidentally activating effects',()=>{
 const t=setup();t.c.shopState=()=>({ok:true});t.c.coinsOf=()=>{throw Error('must not charge');};t.c.drawWeights=()=>({});
 for(const card of ['交換位置卡','竊盜卡','抽籤必中卡','煙火','小太陽卡','小雨傘卡','抽籤轉移卡']){
   t.eval(`getSheet(SHEET_CARDS,HEAD_CARDS).appendRow([new Date(),'student',${JSON.stringify(card)},1,'獎勵'])`);
   t.c.giftCard({key:'student'},card,'cadre');assert.equal(t.c.heldCards('student')[card],undefined);assert.equal(t.c.heldCards('cadre')[card],1);
 }
 assert.equal(t.c.fireworksList().length,0);assert.equal(t.c.weatherList().length,0);assert.equal(t.c.drawFx().sure.length,0);assert.equal(t.c.drawFx().transfers.length,0);assert.ok(t.spend.every(x=>x.points===0));
 for(const card of ['禮物盒','信紙','創造卡'])assert.throws(()=>t.c.giftCard({key:'student'},card,'cadre'),/不能送人/);
 t.spend.push({who:'student',points:5,use:'購買孵蛋器'});t.c.giftCard({key:'student'},'孵蛋器','cadre');assert.equal(t.c.incubatorsOf('student'),0);assert.equal(t.c.incubatorsOf('cadre'),1);
 assert.throws(()=>t.c.giftCard({key:'student'},'孵蛋器','helper'),/沒有可轉送/);
});

test('vehicle transfer moves ownership, unmounts sender pets and rejects duplicate or missing vehicles',()=>{
 const t=setup();t.c.shopState=()=>({ok:true});t.c.coinsOf=()=>{throw Error('must not charge');};t.c.petRows=()=>[{owner:'student',id:'pet1'}];
 vm.runInContext(source.slice(source.indexOf('function spendRows()'),source.indexOf('function addSpend(')),t.c);
 const sh=t.eval('getSheet(SHEET_SPEND,HEAD_SPEND)');sh.appendRow([new t.Date(),'student',10,'寵物交通工具','car','','original']);t.props.PET_RIDE=JSON.stringify({pet1:{v:'car'}});
 t.c.giftRide({key:'student'},'car','cadre');assert.equal(t.c.ridesOf(t.c.spendRows(),'student').length,0);assert.deepEqual(Array.from(t.c.ridesOf(t.c.spendRows(),'cadre')),['car']);assert.equal(JSON.parse(t.props.PET_RIDE).pet1,undefined);
 assert.throws(()=>t.c.giftRide({key:'helper'},'car','cadre'),/已經有/);assert.throws(()=>t.c.giftRide({key:'student'},'car','helper'),/沒有可轉送/);
 t.c.giftRide({key:'cadre'},'car','helper');assert.deepEqual(Array.from(t.c.ridesOf(t.c.spendRows(),'helper')),['car']);assert.equal(t.c.ridesOf(t.c.spendRows(),'cadre').length,0);
 assert.equal(sh.rows.slice(2).reduce((n,r)=>n+Number(r[2]),0),0);
});

test('missing leave card reminders go only to students, never the teacher',()=>{
 const t=setup();const sh=seedLeave(t,'已登記');sh.getRange(2,15).setValue('');t.c.leaveTick();assert.equal(t.mails.length,1);assert.equal(t.mails[0].to,'student');t.c.leaveTick();assert.equal(t.mails.length,1);
});
