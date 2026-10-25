const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync('app.js','utf8');
const constants=src.slice(src.indexOf('const WEEKLY_SESSIONS='),src.indexOf('let state='));
const validator=src.slice(src.indexOf('function validateWeeklyRecord('),src.indexOf('function bindWeeklyMeeting('));
const schedule=src.slice(src.indexOf('const SCHEDULE='),src.indexOf('const KEY='));const planning=src.slice(src.indexOf('function districtWeeklySessions('),src.indexOf('function weeklyMeeting('));const ctx={};vm.createContext(ctx);vm.runInContext(schedule+constants+planning+validator+';this.sessions=WEEKLY_SESSIONS;this.schedule=SCHEDULE;',ctx);
assert.equal(ctx.sessions.length,9);ctx.sessions.forEach((s,i)=>{assert.equal(new Date(s[0]+'T12:00:00Z').getUTCDay(),1);if(i)assert.equal((Date.parse(s[0])-Date.parse(ctx.sessions[i-1][0]))/86400000,7)});
const text={label:'',date:'',time:'',venue:'',notes:''};
const record={round:'1',date:'2026-10-26',weekly:{plan:Array.from({length:12},()=>({...text})),targets:Array.from({length:3},()=>Array(5).fill('')),work:Array.from({length:18},()=>({department:'',role:'',person:'',notes:''})),program:Array.from({length:6},()=>({role:'',person:'',notes:''})),districtGoal:'',personalGoal:'',nextAgenda:''}};
ctx.validateWeeklyRecord(record);
for(const mutate of [r=>r.date='2025-10-20',r=>r.round='10',r=>r.weekly.targets[0][0]=-1,r=>r.weekly.targets[0][0]=1.5,r=>r.weekly.work.pop(),r=>r.weekly.plan=[]]){const r=structuredClone(record);mutate(r);assert.throws(()=>ctx.validateWeeklyRecord(r));}
record.weekly.targets[0][0]=0;ctx.validateWeeklyRecord(record);
console.log('PASS: nine weekly dates, zero accepted, malformed records rejected');

const expectedCounts=[6,6,6,6,7,7,7,7,7,8,8,8,8,8,8,8,9,9,9,9,9,9];
ctx.schedule.forEach((district,i)=>{const sessions=ctx.districtWeeklySessions(district);assert.equal(sessions.length,expectedCounts[i],district.name);assert(sessions.every(v=>v[0]<district.date));const candidates=sessions.filter(v=>v[0]<district.rehearsal);const sand=candidates.at(-1)[0];const plan=ctx.weeklyPlan(district,{},sand);assert.equal(plan.length,sessions.length+2);assert.equal(plan.filter(v=>v.label==='沙推').length,0);assert.equal(plan.filter(v=>v.label.includes('含沙推')).length,1);assert.equal(plan.at(-1).venue,'文化會堂');assert.equal(plan.at(-2).venue,district.venue);const r=structuredClone(record);r.district=district.name;r.weekly.schemaVersion=2;r.weekly.sandDate=sand;r.weekly.plan=JSON.parse(JSON.stringify(plan));ctx.validateWeeklyRecord(r);const bad=structuredClone(r);bad.weekly.sandDate=sessions.at(-1)[0];if(bad.weekly.sandDate>=district.rehearsal)assert.throws(()=>ctx.validateWeeklyRecord(bad));});
console.log('PASS: 22 district session counts, sand table within rehearsal cutoff, fixed venues');
