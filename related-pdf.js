/* Independent rehearsal, formal-program and rehearsal-review PDFs from the supplied workbook. */
(function(root){
'use strict';
const names={rehearsal:'彩排沙推表',program:'正式程序表',review:'彩排檢討表'};
const text=v=>String(v??'').trim();
const person=v=>text(v)||'待確認';
function minute(value){if(!/^\d{2}:\d{2}$/.test(value))throw Error('場次時間尚未確認');const [h,m]=value.split(':').map(Number);if(h>23||m>59)throw Error('場次時間不符');return h*60+m}
function clock(n){n=((n%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function spec(kind,m,grid){
 if(!names[kind]||!grid)throw Error('下載文件類型不符');
 const schedule=m.schedule,formal=kind==='program';
 const first=formal?minute(schedule.time)-30:minute(schedule.rehearsalTime);
 let cursor=first;const times=(grid.durations||[]).map(duration=>{if(!Number.isInteger(duration)||duration<0)throw Error('程序分鐘數不符');const start=cursor;cursor+=duration;return {start:clock(start),end:clock(cursor),duration}});
 return {kind,title:names[kind],date:formal?schedule.date:schedule.rehearsal,time:formal?schedule.time:schedule.rehearsalTime,venue:formal?'文化會堂':schedule.venue,times,total:cursor-first};
}
function extraPeople(current){const s=current?.staff||{};return {maleLead:person(s['地區男子部長']),chant:person(s['唱導人員']||s['唱導者']||s['唱導']),rehearsalGuidance:person(s['彩排總結幹部']||s['彩排指導幹部'])}}
function cellText(kind,c,m,info,extra){
 const p=m.people,e=extra||extraPeople({}),r=c.row,col=c.col;
 if(kind==='program'){
  const t=info.times[r-4];if(t){if(col===1)return r===4?'':String(r-4);if(col===4)return t.start;if(col===6)return t.end;if(col===7)return String(t.duration)+' 分';if(col===8)return ({4:p.computer,5:e.chant,6:p.host,7:p.future,8:p.welcome,9:'頒獎：'+p.awarder+'\n引導：'+p.gifts,10:p.sound,11:p.spotlight,12:p.happiness,13:p.guidance,14:e.chant,15:p.photo,16:p.farewell})[r]}
 }
 if(kind==='review'){
  if(r>=6&&col===1)return String(r-5);
  if(r>=6&&r<=13&&col===3)return ({6:p.future,7:p.happiness,8:p.welcome,9:p.gifts,10:p.sound,11:p.spotlight,12:p.host,13:e.rehearsalGuidance})[r];
  if(r===3&&col===1)return c.text;
 }
 if(kind==='rehearsal'){
  if(r===3){if(col===9)return '擔當者';if(col===10)return '音效：'+p.sound;if(col===11)return '創價班：'+p.soka;if(col===12)return '催場：'+p.cue}
  const t=info.times[r-4];
  if(t){if(col===2)return t.start;if(col===4)return t.end;if(col===5)return String(t.duration);if(col===9){
    const roles={4:'各工作組負責人（見表頭）',5:e.chant,6:e.maleLead,7:'未來部：'+p.future+'\n禮物引導：'+p.gifts+'\n聚光燈：'+p.spotlight+'\n幸福1+1：待定稿\n歡迎詞：'+p.welcome,8:e.chant,9:p.host,10:p.future,11:p.welcome,12:'頒獎：'+p.awarder+'\n引導：'+p.gifts,13:p.sound,14:p.spotlight,15:p.happiness,16:e.rehearsalGuidance,17:e.chant,18:'攝影：'+p.photo+'\n地區男子部長：'+e.maleLead+'\n說明預計要喊的口號和手勢'};
    if(r!==19)return roles[r]||'待確認';
  }}
  if(r===20){if(col===5)return String(info.total);if(col===11)return '電腦操作：'+p.computer;if(col===12)return '道搬：'+p.stage}
  return c.text.replace(/地區男子部長/g,'地區男子部長（'+e.maleLead+'）').replace(/催致歡迎詞人員待命/g,'催致歡迎詞（'+p.welcome+'）待命').replace(/確認輕鬆時間擔任者就位/g,'確認地區聚光燈擔當（'+p.spotlight+'）就位').replace(/確認【幸福1\+1】體驗發表者就位/g,'確認【幸福1+1】體驗發表者（待定稿）就位').replace(/確認【總結前輩】發表者就位/g,'確認【總結前輩】（'+e.rehearsalGuidance+'）就位');
 }
 return c.text;
}
function wrap(value,width,size,font,cache){const lines=[];for(const para of String(value).split('\n')){let line='',w=0;for(const char of para){if(!cache.has(char))cache.set(char,font.widthOfTextAtSize(char,1));const next=cache.get(char)*size;if(line&&w+next>width){lines.push(line);line='';w=0}line+=char;w+=next}lines.push(line)}return lines}
async function createPdf(kind,m,grids,fontBytes,PDFLib,fontkit,current){
 const grid=grids[kind],info=spec(kind,m,grid),e=extraPeople(current),{PDFDocument,rgb}=PDFLib;
 // Full static font avoids missing-glyph subset rendering in the new sparse grids.
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);const font=await pdf.embedFont(fontBytes,{subset:false});
 const rehearsal=kind==='rehearsal',width=rehearsal?1190.551181:595.275591,height=841.889764,margin=rehearsal?14.173228:22.677165;
 const base=rehearsal?[6,40,8,40,26,20,45,45,145,140,125,125]:kind==='program'?[22,80,115,42,10,42,42,110]:[22,72,94,46,58,58,152];
 const scale=(width-2*margin)/base.reduce((a,b)=>a+b,0),widths=base.map(v=>v*scale),xs=[margin];widths.forEach(v=>xs.push(xs.at(-1)+v));
 const cells=grid.cells.map(c=>({...c,text:cellText(kind,c,m,info,e)}));
 const title='2027 '+m.schedule.name+'地區友好總會｜'+info.title;
 const date=info.date.replaceAll('-','/');
 const subtitle=(kind==='program'?'正式總會：':'彩排：')+date+' '+info.time+'　'+info.venue;
 const note=kind==='rehearsal'?'時間由網站彩排時段起點（集合準備）依範本分鐘數推算；共 '+info.total+' 分鐘。':kind==='program'?'時間依正式場次推算；歡迎進場為正式開始前 30 分鐘。':'請於現場填寫計時與檢討建議。';
 const stamp='資料讀取：'+new Date(m.readAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
 const footer='未登錄的擔當者顯示待確認；幸福1+1人選尚待定稿。';
 const glyphs=new Set(font.getCharacterSet());for(const char of title+subtitle+note+stamp+footer+cells.map(c=>c.text).join(''))if(char.codePointAt(0)>31&&!glyphs.has(char.codePointAt(0)))throw Error('字型尚未支援「'+char+'」，請聯絡管理幹部。');
 const rows=Array.from({length:grid.lastRow-grid.firstRow+1},(_,i)=>grid.firstRow+i),cache=new Map();let layout,size;
 const startSize=rehearsal?10.6:11.2,minSize=9.0;
 for(size=startSize;size>=minSize-.01;size-=.2){
  const heights=Object.fromEntries(rows.map(r=>[r,kind==='review'&&r>=6?48:kind==='program'&&r>=4?36:24]));
  const fit=cells.map(c=>{const w=widths.slice(c.col-1,c.col-1+c.colspan).reduce((a,b)=>a+b,0),lines=wrap(c.text,w-9,size,font,cache);return {...c,w,lines,need:lines.length*size*1.34+10}});
  fit.sort((a,b)=>a.rowspan-b.rowspan).forEach(c=>{const span=rows.filter(r=>r>=c.row&&r<c.row+c.rowspan),have=span.reduce((a,r)=>a+heights[r],0);if(c.need>have)span.forEach(r=>heights[r]+=(c.need-have)/span.length)});
  const available=height-margin-94,total=Object.values(heights).reduce((a,b)=>a+b,0);
  if(total<=available){const grow=(available-total)/rows.length;rows.forEach(r=>heights[r]+=grow);layout={heights,fit};break}
 }
 if(!layout)throw Error('人員或說明內容過長，請縮短欄位說明後重試，以免列印文字過小。');
 const page=pdf.addPage([width,height]);page.drawText(title,{x:margin,y:height-30,size:rehearsal?17:14,font});page.drawText(subtitle,{x:margin,y:height-48,size:10,font});
 page.drawText(note,{x:margin,y:height-64,size:rehearsal?9.5:8.6,font});page.drawText(stamp,{x:margin,y:height-78,size:8,font});
 let top=height-90;const tops={};for(const r of rows){tops[r]=top;top-=layout.heights[r]}
 for(const c of layout.fit){const h=rows.filter(r=>r>=c.row&&r<c.row+c.rowspan).reduce((a,r)=>a+layout.heights[r],0),x=xs[c.col-1],y=tops[c.row]-h;
 const header=rehearsal?c.row===3:kind==='program'?c.row<4:c.row<=5;
 const pending=/待確認|待定稿/.test(c.text),fill=header?rgb(.91,.92,.93):pending?rgb(1,.98,.91):rgb(1,1,1);
 page.drawRectangle({x,y,width:c.w,height:h,color:fill,borderWidth:.5,borderColor:rgb(.23,.23,.23)});
 const centered=header||kind==='program'&&[1,4,5,6,7].includes(c.col)||kind==='review'&&c.col<=4||rehearsal&&c.col<=8;
 let lineY=centered?y+(h+c.lines.length*size*1.34)/2-size:tops[c.row]-5-size;
 for(const line of c.lines){page.drawText(line,{x:centered?x+(c.w-font.widthOfTextAtSize(line,size))/2:x+4.5,y:lineY,size,font});lineY-=size*1.34}
 }
 page.drawText(footer,{x:margin,y:10,size:7.8,font,color:rgb(.3,.3,.3)});
 const prefs=pdf.catalog.getOrCreateViewerPreferences();prefs.setPrintScaling(PDFLib.PrintScaling.None);prefs.setPickTrayByPDFSize(true);
 pdf.setTitle(m.schedule.name+'地區'+info.title);pdf.setAuthor('台中南區地區友好總會');
 return {bytes:await pdf.save(),filename:m.schedule.name+'地區-'+info.date+'-'+info.title+'.pdf',pageCount:1,minimumFontSize:size,info};
}
root.AssemblyRelated={names,spec,extraPeople,cellText,createPdf};
})(typeof window==='undefined'?globalThis:window);
