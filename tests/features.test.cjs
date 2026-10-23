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
