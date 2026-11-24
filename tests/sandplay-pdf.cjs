const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const PDFLib=require('../assets/vendor/pdf-lib-1.17.1.min.js');
const fontkit=require('../assets/vendor/fontkit-1.1.1.min.js');
const api=new Function(fs.readFileSync('sandplay-pdf.js','utf8')+';return globalThis.AssemblySandplay')(),grids=JSON.parse(fs.readFileSync('assets/sandplay-grid.json')),font=fs.readFileSync('assets/NotoSansTC-Regular.ttf');
const source=fs.readFileSync('app.js','utf8');const schedules=vm.runInNewContext(source.slice(source.indexOf('const SCHEDULE='),source.indexOf('const KEY='))+'SCHEDULE');
const raw={staff:{場控:'王場控',催場:'張催場',金城會音效:'李音效',電腦播放:'林電腦',筆電音控:'舊播放','場務負責人（壯）':'黃場務',服務組負責人:'陳服務',美化負責人:'蔡美化',輸送負責人:'曾輸送',程序司儀:'王司儀、林司儀',地區部長:'邱部長、陳婦部長',未來部負責人:'林未來',頒贈禮物引導:'張引導',地區聚光燈負責人:'陳聚光',攝影人員:'李攝影','幸福1+1／體驗發表人':'未定稿不應帶入',校稿人:'也不應帶入'},staffUpdatedAt:'2026-11-25T00:00:00Z'};
const d={districts:{}},duty={entries:[]},women={entries:[]};for(const s of schedules){d.districts[s.name]={guidance:'區長 陳指導'};duty.entries.push({district:s.name,leader:'郭創價'});women.entries.push({district:s.name,leader:'何女子'});}
(async()=>{
const snapshot=JSON.stringify(raw);const models=schedules.map(s=>api.model(s,raw,null,d,duty,women,'2026-11-24T16:30:00Z'));
assert.equal(models.length,22);assert.equal(models.filter(m=>m.slot.key==='morning').length,6);assert.equal(models.filter(m=>m.slot.key==='afternoon').length,6);assert.equal(models.filter(m=>m.slot.key==='evening').length,10);
assert.equal(JSON.stringify(raw),snapshot);assert.throws(()=>api.slot('12:00'));
for(const m of models){assert.equal(m.people.computer,'林電腦');assert.equal(m.people.guidance,'區長 陳指導');assert.equal(m.people.soka,'郭創價');assert.equal(m.people.women,'何女子');const text=grids[m.slot.key].cells.map(c=>api.cellText(c,m)).join('\n');assert(!text.includes('職稱+姓名'));assert(!text.includes('未定稿不應帶入'));assert(text.includes('指導前輩（區長 陳指導）座位上待命'));for(const [col,key] of Object.entries(m.columns))assert.equal(api.cellText({row:5,col:Number(col),text:''},m),m.people[key]);}
const missing=api.model(schedules[0],{staff:{}},null,{districts:{}},{entries:[]},{entries:[]});assert.equal(missing.people.guidance,'待確認');assert.equal(missing.people.awarder,'待確認');
const latest={updatedAt:'2026-11-26T00:00:00Z',weekly:{program:[{role:'司儀',person:'最新司儀'},{role:'致歡迎詞',person:'最新歡迎詞'}]}};assert.equal(api.model(schedules[0],raw,latest,d,duty,women).people.welcome,'最新歡迎詞');latest.updatedAt='2026-11-20';assert.equal(api.model(schedules[0],raw,latest,d,duty,women).people.welcome,raw.staff.地區部長);
fs.mkdirSync('release-checks/sandplay',{recursive:true});
for(const key of ['morning','afternoon','evening']){const m=models.find(m=>m.slot.key===key);const out=await api.createPdf(m,grids,font,PDFLib,fontkit);fs.writeFileSync('release-checks/sandplay/'+key+'.pdf',out.bytes);const doc=await PDFLib.PDFDocument.load(out.bytes);assert.equal(doc.getPageCount(),2);for(const page of doc.getPages()){assert(Math.abs(page.getWidth()-1190.551181)<.01);assert(Math.abs(page.getHeight()-841.889764)<.01)}assert.equal(doc.catalog.getOrCreateViewerPreferences().getDuplex(),'DuplexFlipShortEdge');assert(out.minimumFontSize>=7.2);console.log(key,out.bytes.length,'bytes; smallest font',out.minimumFontSize);}
console.log('PASS: all 22 districts route to one time slot; exact role mappings, placeholder replacement, pending happiness exclusion, newer data precedence, A3 two-page PDFs and duplex preference');
})().catch(e=>{console.error(e);process.exitCode=1});
