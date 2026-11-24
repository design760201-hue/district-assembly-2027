let sandplayAssetsPromise = null, sandplayExportBusy = false;
const sandplayLastDownloads = new Map();
function sandplayFileLink(file){return file?`<a class="sandplay-direct" href="${esc(file.url)}" download="${esc(file.filename)}">下載已產生的 PDF</a><span class="saved-note">若未自動下載，請點此連結。</span>`:''}
const RELATED_DOWNLOADS=[
  {kind:'formal',title:'正式沙推表',format:'PDF · A3 橫式 · 正反兩頁'},
  {kind:'rehearsal',title:'彩排沙推表',format:'PDF · A3 橫式 · 單頁'},
  {kind:'program',title:'正式程序表',format:'PDF · A4 直式 · 單頁'},
  {kind:'review',title:'彩排檢討表',format:'PDF · A4 直式 · 單頁'}
];
function sandplayDownloadIds(kind){const base=kind==='formal'?'sandplay':kind;return {button:'download-'+base,status:base+'-download-status',file:base+'-file'}}
function sandplayDownloadKey(name,kind){return JSON.stringify([name,kind])}
function sandplayDownloadPage(s) {
 const slot=AssemblySandplay.slot(s.time);
 return '<div class="related-downloads" aria-label="相關下載">'+RELATED_DOWNLOADS.map(({kind,title,format})=>{
  const ids=sandplayDownloadIds(kind),ready=sandplayLastDownloads.get(sandplayDownloadKey(s.name,kind)),isRehearsal=['rehearsal','review'].includes(kind);
  const description=kind==='formal'?`${s.name}地區的${slot.label}沙推表，依已儲存的人員安排自動套入。`:kind==='rehearsal'?'依本地區彩排時間、場地及各組負責人，產生獨立的彩排沙推表。':kind==='program'?'依本地區正式總會場次，帶入程序時間及擔當者。':'帶入本地區彩排資料與程序擔當者，保留計時及建議空格供現場填寫。';
  return `<section class="panel sandplay-download" aria-labelledby="${kind}-download-heading"><h2 id="${kind}-download-heading">${title}下載</h2><p class="sandplay-description">${esc(description)}</p><dl class="sandplay-facts"><div><dt>${isRehearsal?'彩排':'正式總會'}</dt><dd>${esc(dateLabel(isRehearsal?s.rehearsal:s.date))} ${esc(isRehearsal?s.rehearsalTime:s.time)} · ${esc(isRehearsal?s.venue:'文化會堂')}</dd></div><div><dt>下載格式</dt><dd>${format}</dd></div></dl><button type="button" class="btn sandplay-download-button" id="${ids.button}" data-document-kind="${kind}" ${cloudEnabled()&&!cloudConnected?'disabled':''}>${tabIcon('M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5')}<span>下載${esc(s.name)}地區${title}</span></button><p id="${ids.status}" class="saved-note download-status" role="status" aria-live="polite">${cloudEnabled()&&!cloudConnected?'正在連接共用資料，連接完成後即可下載。':ready?'PDF 已產生，可使用下方連結下載。':'點選後會重新讀取已儲存資料，再產生 PDF。'}</p><div id="${ids.file}" class="sandplay-file">${sandplayFileLink(ready)}</div><div class="sandplay-notes"><p>${kind==='formal'?'表頭帶入各工作組負責人，程序內文帶入對應擔當者。':kind==='rehearsal'?'時間由網站彩排時段起點（集合準備）依範本分鐘數推算。':kind==='review'?'計時與建議留白，請於彩排現場記錄。':'依正式開始時間推算各程序，歡迎進場安排於正式開始前 30 分鐘。'}未確認的人員顯示「待確認」，幸福1+1 人選暫不帶入。</p><p>${kind==='formal'?'使用 A3 紙張、雙面短邊翻頁；PDF 已設定對應列印偏好，實際套用依印表機支援。':'已預排紙張尺寸與分頁，直接下載本地區的獨立檔案。'}</p></div></section>`;
 }).join('')+'</div>';
}
function sandplayLoadScript(src, check) {
  if (check()) return Promise.resolve();
  return new Promise((resolve,reject) => {
    const script=document.createElement('script');script.src=src;script.async=true;
    const timer=setTimeout(()=>{script.remove();reject(Error('PDF 元件讀取逾時，請確認網路後重試。'))},30000);
    script.onload=()=>{clearTimeout(timer);check()?resolve():reject(Error('PDF 元件載入不完整，請重新整理後重試。'))};
    script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('無法讀取 PDF 元件，請確認網路後重試。'))};
    document.head.append(script);
  });
}
async function sandplayAssets() {
  if (!sandplayAssetsPromise) sandplayAssetsPromise=(async()=>{
    const read=async(url,type)=>{const response=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('PDF 範本或字型無法讀取，請稍後重試。');return type==='json'?response.json():response.arrayBuffer()};
    const [grids,fontBytes,relatedGrids]=await Promise.all([
      read('assets/sandplay-grid.json','json'),read('assets/NotoSansTC-Regular.ttf','bytes'),read('assets/related-grids.json','json'),
      sandplayLoadScript('assets/vendor/pdf-lib-1.17.1.min.js',()=>Boolean(window.PDFLib)),
      sandplayLoadScript('assets/vendor/fontkit-1.1.1.min.js',()=>Boolean(window.fontkit))
    ]);
    return {grids,fontBytes,relatedGrids};
  })().catch(error=>{sandplayAssetsPromise=null;throw error});
  return sandplayAssetsPromise;
}
function bindSandplayDownload() {
 const buttons=Array.from(document.querySelectorAll('[data-document-kind]'));
 buttons.forEach(button=>button.onclick=async()=>{
  if(sandplayExportBusy)return;
  const kind=button.dataset.documentKind,definition=RELATED_DOWNLOADS.find(v=>v.kind===kind);if(!definition)return;
  const name=selected,key=sandplayDownloadKey(name,kind),schedule=SCHEDULE.find(s=>s.name===name),ids=sandplayDownloadIds(kind),status=$('#'+ids.status),label=button.querySelector('span');
  sandplayExportBusy=true;buttons.forEach(b=>b.disabled=true);button.setAttribute('aria-busy','true');label.textContent='正在產生 PDF…';
  const previous=sandplayLastDownloads.get(key);if(previous)URL.revokeObjectURL(previous.url);sandplayLastDownloads.delete(key);const fileArea=$('#'+ids.file);if(fileArea)fileArea.innerHTML='';
  status.textContent='正在讀取已儲存的人員資料與範本…';
  try {
   const assetsPromise=sandplayAssets();assetsPromise.catch(()=>{});
   let raw=data(name),directory=cloudDirectory,duty=cloudDuty,womenDuty=cloudWomenDuty;
   if(cloudEnabled()){
    const result=await cloudRequest('load');
    if(!result.state?.districts)throw Error('無法取得共用人員資料，請重新連接雲端後重試。');
    if(result.directory?.error)throw Error('總結幹部資料暫時無法讀取，請稍後重試。');
    if(result.duty?.error||result.womenDuty?.error)throw Error('執勤人員資料暫時無法讀取，請稍後重試。');
    raw=result.state.districts[name]||{meetings:[],staff:{},counts:{},tasks:{}};
    directory=result.directory||{districts:{}};duty=result.duty||{entries:[]};womenDuty=result.womenDuty||{entries:[]};
   }
   const latest=latestWeeklyMeeting(raw),current=overviewCurrentData(raw,latest),model=AssemblySandplay.model(schedule,current,latest,directory,duty,womenDuty,new Date().toISOString()),assets=await assetsPromise;
   status.textContent='正在排版'+definition.title+'，請稍候…';
   const result=kind==='formal'?await AssemblySandplay.createPdf(model,assets.grids,assets.fontBytes,window.PDFLib,window.fontkit):await AssemblyRelated.createPdf(kind,model,assets.relatedGrids,assets.fontBytes,window.PDFLib,window.fontkit,current);
   const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'})),file={url,filename:result.filename};sandplayLastDownloads.set(key,file);
   if(selected===name&&$('#'+ids.file))$('#'+ids.file).innerHTML=sandplayFileLink(file);
   const link=document.createElement('a');link.href=url;link.download=result.filename;document.body.append(link);link.click();link.remove();
   status.textContent=`${name}地區${definition.title} PDF 已產生。下載後請確認標示「待確認」的人員。`;
   toast(definition.title+' PDF 已產生');
  }catch(error){status.textContent='下載未完成：'+error.message+' 請再按一次下載重試。';toast('無法下載，請查看該文件下方說明後重試。')}
  finally{sandplayExportBusy=false;buttons.forEach(b=>b.disabled=false);button.removeAttribute('aria-busy');label.textContent='下載'+name+'地區'+definition.title}
 });
}
