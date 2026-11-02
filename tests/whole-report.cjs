const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const messages=[],requests=[];let scenario='success',conflicts=0,navigation=0;
const record={id:'draft-a',kind:'weekly-v1',district:'光興',date:'2026-11-02',round:'1',recorder:'紀錄人',decisions:'決議',updatedAt:'first',weekly:{}},change={counts:{男子部:{target:1,invited:0}},tasks:{0:'進行中'},counter:'統計人'};
const ctx={Map,URL,structuredClone,crypto:require('crypto').webcrypto,window:{addEventListener(){}},document:{},dirty:true,editId:null,state:{districts:{光興:{meetings:[],staff:{},counts:{},tasks:{}}}},data:n=>ctx.state.districts[n],toast:t=>messages.push(t),render(){},esc:s=>String(s),dateLabel:s=>s};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('cloud-client.js','utf8'),ctx);
ctx.respond=async(action,p)=>{requests.push({action,p:structuredClone(p)});if(scenario==='offline')throw Error('連線中斷');if(scenario==='conflict'&&conflicts++===0)return {conflict:true,conflicts:[{path:['meeting','decisions'],mine:'決議',latest:'新決議'}],merged:{record:{...p.record,decisions:'新決議'},change:p.change},baseRecord:{...p.record,decisions:'新決議'},baseChange:p.change};return {record:{...p.record,id:'saved',updatedAt:'saved-at',statistics:p.change,preparation:p.change,cloud:{revision:1,fileId:'fake'}},change:p.change,updatedAt:'saved-at',revision:1}};
ctx.choose=async r=>scenario==='cancel'?null:r.merged;ctx.success=()=>navigation++;
vm.runInContext("cloudConnected=true;cloudBusyUi=value=>{cloudBusy=value};cloudKeepLocal=()=>{};cloudSuccess=()=>{};showMeetingSuccess=()=>success();cloudRequest=(a,p)=>respond(a,p);resolveReportConflict=r=>choose(r)",ctx);
(async()=>{
 const packet={record,change,baseRecord:record,baseChange:{counts:{},tasks:{},counter:''}};
 scenario='offline';const before=JSON.stringify(ctx.state);await ctx.cloudSaveWholeReport(packet);assert.equal(JSON.stringify(ctx.state),before);assert.equal(ctx.dirty,true);assert.equal(navigation,0);const firstId=requests.at(-1).p.requestId;
 await ctx.cloudSaveWholeReport({...packet,record:{...record,id:'another-draft-id',updatedAt:'later'}});assert.equal(requests.at(-1).p.requestId,firstId);assert(messages.at(-1).includes('輸入仍保留'));
 scenario='success';await ctx.cloudSaveWholeReport(packet);assert.equal(navigation,1);assert.equal(ctx.state.districts.光興.counter,'統計人');assert.equal(ctx.state.districts.光興.meetings.length,1);assert.equal(ctx.dirty,false);
 scenario='conflict';ctx.dirty=true;await ctx.cloudSaveWholeReport(packet);assert.equal(ctx.state.districts.光興.meetings[0].decisions,'新決議');assert.equal(navigation,2);assert.equal(requests.at(-1).action,'submitBundle');
 scenario='cancel';ctx.dirty=true;ctx.choose=async()=>null;ctx.respond=async()=>({conflict:true});const old=JSON.stringify(ctx.state);await ctx.cloudSaveWholeReport(packet);assert.equal(JSON.stringify(ctx.state),old);assert.equal(ctx.dirty,true);assert.equal(navigation,2);
 console.log('PASS: whole-page submit updates all local sections only after server success; offline and conflict cancellation retain input; retry identifiers survive timestamp changes; conflict choices are resubmitted together');
})().catch(e=>{console.error(e);process.exitCode=1});
