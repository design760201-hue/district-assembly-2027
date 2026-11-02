const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync('app.js','utf8');
const constants=src.slice(src.indexOf('const WEEKLY_SESSIONS='),src.indexOf('let state='));
const validator=src.slice(src.indexOf('function validateWeeklyRecord('),src.indexOf('function bindWeeklyMeeting('));
const schedule=src.slice(src.indexOf('const SCHEDULE='),src.indexOf('const KEY='));const planning=src.slice(src.indexOf('function districtWeeklySessions('),src.indexOf('function weeklyMeeting('));const ctx={};vm.createContext(ctx);vm.runInContext(schedule+constants+planning+validator+';this.sessions=WEEKLY_SESSIONS;this.schedule=SCHEDULE;',ctx);
assert.equal(ctx.sessions.length,8);ctx.sessions.forEach((s,i)=>{assert.equal(new Date(s[0]+'T12:00:00Z').getUTCDay(),1);if(i)assert.equal((Date.parse(s[0])-Date.parse(ctx.sessions[i-1][0]))/86400000,7)});
const text={label:'',date:'',time:'',venue:'',notes:''};
const record={round:'1',date:'2026-11-02',weekly:{plan:Array.from({length:12},()=>({...text})),targets:Array.from({length:3},()=>Array(5).fill('')),work:Array.from({length:18},()=>({department:'',role:'',person:'',notes:''})),program:Array.from({length:6},()=>({role:'',person:'',notes:''})),districtGoal:'',personalGoal:'',nextAgenda:''}};
ctx.validateWeeklyRecord(record);
for(const mutate of [r=>r.date='2025-10-20',r=>r.round='10',r=>r.weekly.targets[0][0]=-1,r=>r.weekly.targets[0][0]=1.5,r=>r.weekly.work.pop(),r=>r.weekly.plan=[]]){const r=structuredClone(record);mutate(r);assert.throws(()=>ctx.validateWeeklyRecord(r));}
record.weekly.targets[0][0]=0;ctx.validateWeeklyRecord(record);
console.log('PASS: eight weekly dates, zero accepted, malformed records rejected');

const expectedCounts=[5,5,5,5,6,6,6,6,6,7,7,7,7,7,7,7,8,8,8,8,8,6];
ctx.schedule.forEach((district,i)=>{const sessions=ctx.districtWeeklySessions(district);assert.equal(sessions.length,expectedCounts[i],district.name);assert(sessions.every(v=>v[0]<district.date));for(const [sand] of sessions){const plan=ctx.weeklyPlan(district,{},sand);assert.equal(plan.length,sessions.length+2);assert.equal(plan.filter(v=>v.label==='沙推').length,0);assert.equal(plan.filter(v=>v.label.includes('含沙推')).length,0);assert.equal(plan.at(-1).venue,'文化會堂');assert.equal(plan.at(-2).venue,district.venue);assert.equal(ctx.weeklySandDate(district,{weekly:{sandDate:sand}}),sand);const r=structuredClone(record);r.district=district.name;r.date=sessions[0][0];r.weekly.schemaVersion=2;r.weekly.sandDate=sand;r.weekly.plan=JSON.parse(JSON.stringify(plan));ctx.validateWeeklyRecord(r);const bad=structuredClone(r);bad.weekly.sandDate=district.date;assert.throws(()=>ctx.validateWeeklyRecord(bad));}});
console.log('PASS: all 22 districts accept every displayed operation day for sand-table planning, reject outside dates, and preserve fixed venues');
// Compare the actual rendered menus, rather than only their date helpers.
ctx.editId=null;ctx.today=()=> '2026-11-01';ctx.esc=value=>String(value??'');ctx.field=()=>'';
vm.runInContext(src.match(/^const dateLabel=.*$/m)[0]+src.slice(src.indexOf('function weeklyInput('),src.indexOf('function districtWeeklySessions('))+src.slice(src.indexOf('function weeklyMeeting('),src.indexOf('function weeklyRecordFromForm(')),ctx);
for(const district of ctx.schedule){ctx.selected=district.name;const html=ctx.weeklyMeeting({meetings:[],staff:{}});const options=name=>[...html.match(new RegExp('<select[^>]*name="'+name+'"[^>]*>([\\s\\S]*?)</select>'))[1].matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].filter(m=>m[1]).map(m=>({value:m[1],label:m[2]}));const rounds=options('round'),sand=options('sandDate');assert.deepEqual(rounds.map((r,i)=>({value:ctx.districtWeeklySessions(district)[i][0],label:r.label})),sand,district.name);}
console.log('PASS: rendered operation and sand-table menus have identical dates, order and labels for all 22 districts');
ctx.selected='光興';ctx.editId=null;let existing={id:'old-record',attendees:'既有出席人員',weekly:{personalGoal:'既有個人目標'}};ctx.data=()=>({meetings:[existing]});ctx.FormData=class{get(name){return name==='round'?'1':null}};
vm.runInContext(src.slice(src.indexOf('function weeklyRecordFromForm('),src.indexOf('function validateWeeklyRecord(')),ctx);
const preserved=ctx.weeklyRecordFromForm({},'old-record');assert.equal(preserved.attendees,'既有出席人員');assert.equal(preserved.weekly.personalGoal,'既有個人目標');
ctx.selected='光興';const removedFieldsHtml=ctx.weeklyMeeting({meetings:[],staff:{}});assert(!removedFieldsHtml.includes('name="attendees"'));assert(!removedFieldsHtml.includes('name="personalGoal"'));
console.log('PASS: removed attendee and personal-goal inputs stay absent while editing preserves historical values');

const changyi=ctx.districtWeeklySessions(ctx.schedule.find(v=>v.name==='長億'));assert.equal(changyi.length,6);assert(changyi.every(v=>new Date(v[0]+'T12:00:00Z').getUTCDay()===3));assert.equal(changyi[0][0],'2026-11-04');assert.equal(changyi.at(-1)[0],'2026-12-09');console.log('PASS: Changyi uses exactly six Wednesdays');
