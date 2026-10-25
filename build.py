from pathlib import Path
p=Path(__file__).parent
css=(p/'styles.css').read_text()
js=(p/'word-export.js').read_text()+'\n'+(p/'cloud-client.js').read_text()+'\n'+(p/'app.js').read_text()+'\ninitializeCloud();'
html='''<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#17334e"><link rel="apple-touch-icon" sizes="180x180" href="sgi-icon-180.png"><link rel="icon" type="image/png" sizes="192x192" href="sgi-icon-192.png"><link rel="manifest" href="site.webmanifest"><meta name="apple-mobile-web-app-title" content="地區友好總會"><title>2027 地區友好總會｜台中南區</title><style>CSS</style></head>
<body><div class="shell"><aside class="sidebar"><div class="brand">地區友好總會</div><div class="subbrand">台中南區 · 2027 年度</div><nav class="nav" aria-label="主要功能"><button data-page="overview">總會總覽</button><button data-page="district">地區工作區</button></nav><div class="side-note"><b>異體同心 · 勇躍前進</b><p>晴爽、歡喜、無事故<br>全員出席、大勝利<br>異體同心、人才輩出</p></div></aside><main class="main"><header class="topbar"><small>邁向創立一百週年 勇躍前進之年</small><span class="local">目前瀏覽器儲存 · 尚未共用</span></header><div class="content" id="content"></div></main></div><div class="toast" id="toast" role="status" aria-live="polite" hidden></div><script>JS</script></body></html>'''
(p/'index.html').write_text(html.replace('CSS',css).replace('JS',js))
