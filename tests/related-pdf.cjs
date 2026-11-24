const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const PDFLib=require('../assets/vendor/pdf-lib-1.17.1.min.js'),fontkit=require('../assets/vendor/fontkit-1.1.1.min.js');
const formal=new Function(fs.readFileSync('sandplay-pdf.js','utf8')+';return globalThis.AssemblySandplay')();
const related=new Function(fs.readFileSync('related-pdf.js','utf8')+';return globalThis.AssemblyRelated')();
const grids=JSON.parse(fs.readFileSync('assets/related-grids.json')),font=fs.readFileSync('assets/NotoSansTC-Regular.ttf'),src=fs.readFileSync('app.js','utf8');
const schedules=vm.runInNewContext(src.slice(src.indexOf('const SCHEDULE='),src.indexOf('const KEY='))+'SCHEDULE');
const current={staff:{場控:'王場控',催場:'林催場',金城會音效:'李音效',電腦播放:'張電腦',未來部負責人:'曾未來',程序司儀:'陳司儀',地區部長:'林壯部長',地區婦人部長:'李婦部長',頒贈禮物引導:'許引導',地區聚光燈負責人:'黃聚光',攝影人員:'郭攝影',地區男子部長:'鄭男子部長',唱導人員:'王唱導',彩排指導幹部:'彩排指導林前輩','幸福1+1／體驗發表人':'不應出現的提報姓名'}};
for(const name of ['曾凱怡','劉富源','林昕柔','陳書涵','林妍汝'])assert(!JSON.stringify(grids).includes(name),'sample name leaked '+name);
(async()=>{
 fs.mkdirSync('release-checks/related',{recursive:true});
 for(const s of schedules){const m=formal.model(s,current,null,{districts:{[s.name]:{guidance:'總結幹部李前輩'}}},{entries:[]},{entries:[]},'2026-11-24T19:30:00Z');
  for(const kind of Object.keys(related.names)){const info=related.spec(kind,m,grids[kind]),extra=related.extraPeople(current);assert.equal(info.date,kind==='program'?s.date:s.rehearsal);assert.equal(info.venue,kind==='program'?'文化會堂':s.venue);if(kind==='program')assert.equal(info.times[1].start,s.time);if(kind==='rehearsal'){assert.equal(info.times[0].start,s.rehearsalTime);assert.equal(info.total,97)}const texts=grids[kind].cells.map(c=>related.cellText(kind,c,m,info,extra)).join('\n');assert(!texts.includes('不應出現的提報姓名'));assert(texts.includes('待定稿'));assert(texts.includes('林壯部長'));assert(texts.includes('陳司儀'));
   if(['光興','坪林','烏日'].includes(s.name)){const out=await related.createPdf(kind,m,grids,font,PDFLib,fontkit,current);const pdf=await PDFLib.PDFDocument.load(out.bytes);assert.equal(pdf.getPageCount(),1);assert(out.minimumFontSize>=9);assert(out.filename.startsWith(s.name+'地區-'+info.date));fs.writeFileSync('release-checks/related/'+s.name+'-'+kind+'.pdf',out.bytes);console.log(s.name,kind,out.bytes.length,'font',out.minimumFontSize);}
  }
 }
 const empty=related.extraPeople({staff:{}});assert.equal(empty.chant,'待確認');assert.equal(empty.rehearsalGuidance,'待確認');
 assert(src.includes("['sandplay','相關下載'"));assert(!src.includes("$('#download-sandplay')?.click()"));
 console.log('PASS: 22 districts × three independent forms, rehearsal clock/location, all formal time slots, sample-name removal, role mapping, pending happiness, printable PDFs, neutral downloads entry');
})().catch(e=>{console.error(e);process.exitCode=1});
