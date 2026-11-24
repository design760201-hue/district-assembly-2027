let sandplayAssetsPromise = null, sandplayExportBusy = false;
const sandplayLastDownloads = new Map();
function sandplayFileLink(file){return file?`<a class="sandplay-direct" href="${esc(file.url)}" download="${esc(file.filename)}">下載已產生的 PDF</a><span class="saved-note">若未自動下載，請點此連結。</span>`:''}
function sandplayDownloadPage(s) {
  const slot = AssemblySandplay.slot(s.time), ready=sandplayLastDownloads.get(s.name);
  return `<section class="panel sandplay-download" aria-labelledby="sandplay-heading"><h2 id="sandplay-heading">正式沙推表下載</h2><p class="sandplay-description">${esc(s.name)}地區的${esc(slot.label)}沙推表，依已儲存的人員安排自動套入。</p><dl class="sandplay-facts"><div><dt>正式總會</dt><dd>${esc(dateLabel(s.date))} ${esc(s.time)} · 文化會堂</dd></div><div><dt>下載格式</dt><dd>PDF · A3 橫式 · 正反兩頁</dd></div></dl><button type="button" class="btn sandplay-download-button" id="download-sandplay" ${cloudEnabled()&&!cloudConnected?'disabled':''}>${tabIcon('M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5')}<span>下載${esc(s.name)}地區正式沙推表</span></button><p id="sandplay-download-status" class="saved-note" role="status" aria-live="polite">${cloudEnabled()&&!cloudConnected?'正在連接共用資料，連接完成後即可下載。':ready?'PDF 已產生，可使用下方連結下載。':'點選後會重新讀取已儲存資料，再產生 PDF。'}</p><div id="sandplay-file" class="sandplay-file">${sandplayFileLink(ready)}</div><div class="sandplay-notes"><p>表頭帶入各工作組負責人，程序內文帶入對應擔當者；未確認的人員以「待確認」標示。幸福1+1 人選待定稿，暫不帶入提報名單。</p><p>列印版面已排好。使用 A3 紙張、雙面短邊翻頁；PDF 也已設定對應列印偏好，實際套用依印表機支援。</p></div></section>`;
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
    const [grids,fontBytes]=await Promise.all([
      read('assets/sandplay-grid.json','json'),read('assets/NotoSansTC-Regular.ttf','bytes'),
      sandplayLoadScript('assets/vendor/pdf-lib-1.17.1.min.js',()=>Boolean(window.PDFLib)),
      sandplayLoadScript('assets/vendor/fontkit-1.1.1.min.js',()=>Boolean(window.fontkit))
    ]);
    return {grids,fontBytes};
  })().catch(error=>{sandplayAssetsPromise=null;throw error});
  return sandplayAssetsPromise;
}
function bindSandplayDownload() {
  const button=$('#download-sandplay');if(!button)return;
  button.onclick=async()=>{
    if(sandplayExportBusy)return;
    const name=selected,schedule=SCHEDULE.find(s=>s.name===name),status=$('#sandplay-download-status');
    const label=button.querySelector('span');sandplayExportBusy=true;button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='正在產生 PDF…';
    const previous=sandplayLastDownloads.get(name);if(previous)URL.revokeObjectURL(previous.url);sandplayLastDownloads.delete(name);const fileArea=$('#sandplay-file');if(fileArea)fileArea.innerHTML='';
    status.textContent='正在讀取已儲存的人員資料與沙推表範本…';
    try {
      const assetsPromise=sandplayAssets();assetsPromise.catch(()=>{});
      let raw=data(name),directory=cloudDirectory,duty=cloudDuty,womenDuty=cloudWomenDuty;
      if(cloudEnabled()) {
        // Read the current shared state without applying it to or rerendering an open form.
        const result=await cloudRequest('load');
        if(!result.state?.districts)throw Error('無法取得共用人員資料，請重新連接雲端後重試。');
        if(result.directory?.error)throw Error('總結幹部資料暫時無法讀取，請稍後重試。');
        if(result.duty?.error||result.womenDuty?.error)throw Error('執勤人員資料暫時無法讀取，請稍後重試。');
        raw=result.state.districts[name]||{meetings:[],staff:{},counts:{},tasks:{}};
        directory=result.directory||{districts:{}};duty=result.duty||{entries:[]};womenDuty=result.womenDuty||{entries:[]};
      }
      const latest=latestWeeklyMeeting(raw),current=overviewCurrentData(raw,latest);
      const model=AssemblySandplay.model(schedule,current,latest,directory,duty,womenDuty,new Date().toISOString());
      const assets=await assetsPromise;
      status.textContent='正在排版 A3 正反兩頁，請稍候…';
      const result=await AssemblySandplay.createPdf(model,assets.grids,assets.fontBytes,window.PDFLib,window.fontkit);
      const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
      const file={url,filename:result.filename};sandplayLastDownloads.set(name,file);if(selected===name&&$('#sandplay-file'))$('#sandplay-file').innerHTML=sandplayFileLink(file);
      const link=document.createElement('a');link.href=url;link.download=result.filename;document.body.append(link);link.click();link.remove();
      status.textContent=`${name}地區${model.slot.label} PDF 已產生，共兩頁。下載後請確認標示「待確認」的人員。`;
      toast('正式沙推表 PDF 已產生');
    } catch(error) {
      status.textContent='下載未完成：'+error.message+' 請再按一次下載重試。';
      toast('無法下載沙推表，請查看下方說明後重試。');
    } finally {
      sandplayExportBusy=false;button.disabled=false;button.removeAttribute('aria-busy');label.textContent='下載'+name+'地區正式沙推表';
    }
  };
}
