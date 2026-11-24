/* Formal sandplay PDF: local, read-only rendering of the supplied three time-slot grids. */
(function (root) {
  'use strict';
  const clean = value => String(value ?? '').trim();
  const pending = value => !clean(value) || /待確認|待確|暫定|待討論|待定|未填寫|未確認|協議安排|依.*確認/.test(clean(value));
  const person = value => clean(value) || '待確認';
  const unique = values => [...new Set(values.map(clean).filter(Boolean))].join('、');
  function slot(time) {
    const known = {'09:30': ['morning', '早上場'], '14:00': ['afternoon', '下午場'], '19:50': ['evening', '晚上場']};
    if (!known[time]) throw Error('本場次時間尚無對應範本，請聯絡管理幹部確認。');
    return {key: known[time][0], label: known[time][1]};
  }
  function model(schedule, current, latest, directory, duty, womenDuty, readAt) {
    const staff = current.staff || {}, roster = directory?.districts?.[schedule.name] || {};
    const program = latest?.weekly?.program || [];
    // Respect the same precedence as the district overview, including a newer staff edit.
    const weeklyWins = latest && (latest.updatedAt || '') > (current.staffUpdatedAt || '');
    const programPerson = (role, index, ...keys) => {
      const entry = program.find(v => v.role === role) || program[index];
      if (weeklyWins && entry) return person(entry.person);
      return person(keys.map(k => staff[k]).find(v => clean(v)));
    };
    const service = entries => (entries || []).find(v => v.district === schedule.name);
    const people = {
      control: person(staff['場控']), cue: person(staff['催場']), sound: person(staff['金城會音效']),
      computer: person(staff['電腦播放'] || staff['筆電音控']),
      women: person(service(womenDuty?.entries)?.leader || staff['頒贈禮物引導']),
      soka: person(service(duty?.entries)?.leader || staff['創價班負責人']),
      general: unique([staff['報到處負責人'] && '報到：' + staff['報到處負責人'], staff['庶務負責人'] && '庶務：' + staff['庶務負責人'], staff['場務負責人（壯）'] && '場務：' + staff['場務負責人（壯）']]) || '待確認',
      service: person(staff['服務組負責人']), beauty: person(staff['美化負責人']),
      stage: person(staff['場務負責人（壯）']), transport: person(staff['輸送負責人']),
      host: programPerson('司儀', 0, '程序司儀') === '待確認' ? person(unique([staff['司儀（男）'],staff['司儀（女）']])) : programPerson('司儀', 0, '程序司儀'),
      welcome: weeklyWins ? programPerson('致歡迎詞', 1, '地區部長', '致歡迎詞') : person(staff['致歡迎詞'] || unique([staff['地區部長'],staff['地區婦人部長']])),
      future: person(staff['未來部負責人']), gifts: person(staff['頒贈禮物引導']),
      spotlight: person(staff['地區聚光燈負責人']), guidance: person(roster.guidance || staff['指導幹部']),
      awarder: person(staff['頒獎前輩'] || staff['頒贈禮物前輩']),
      photo: person(staff['攝影人員']), farewell: programPerson('歡迎、歡送式', 5, '歡迎、歡送式'),
      happiness: '待定稿（暫不帶入提報人選）'
    };
    const columns = {9: 'control', 10: 'cue', 12: 'sound', 13: 'computer', 14: 'women', 15: 'soka', 16: 'general', 17: 'service', 18: 'beauty', 19: 'stage', 20: 'transport'};
    return {schedule: {...schedule}, slot: slot(schedule.time), people, columns, readAt: readAt || new Date().toISOString(), sourceDate: latest?.date || '', pending: Object.entries(people).filter(([,v]) => pending(v)).map(([k]) => k)};
  }
  function cellText(cell, m) {
    if (cell.col === 1 && cell.row >= 6) { const order = [6,7,8,9,11,13,15,17,19,21,22,24,26,28,30,32].indexOf(cell.row); if (order >= 0) return String(order+1); }
    if (cell.row === 5 && m.columns[cell.col]) return m.people[m.columns[cell.col]];
    let text = cell.text;
    const p = m.people;
    if (cell.col === 6) {
      const role = {11: p.host, 13: p.future, 15: p.welcome, 17: p.gifts, 21: p.spotlight, 22: p.happiness, 24: p.guidance, 28: p.photo, 30: p.farewell}[cell.row];
      if (role) text = text.replace(/\s+V$/, '') + '\n' + role;
    }
    return text
      .replace(/指導前輩\(職稱[+＋]姓名\)/g, '指導前輩（' + p.guidance + '）')
      .replace(/前輩\(職稱[+＋]姓名\)/g, '前輩（' + p.awarder + '）')
      .replace(/地區聚光燈\(擔當者\)/g, '地區聚光燈（' + p.spotlight + '）')
      .replace(/地區壯婦部長/g, '致歡迎詞擔當（' + p.welcome + '）')
      .replace(/地區部長&地區婦人部長/g, '致歡迎詞擔當（' + p.welcome + '）')
      .replace(/體驗擔當人員_+/g, '體驗擔當人員（待定稿）')
      .replace(/攝影人員準備/g, '攝影人員（' + p.photo + '）準備')
      .replace(/_+組/g, '待確認組').replace(/_+/g, '待確認')
      .replace(/[ \t]{2,}/g, ' ').trim();
  }
  function wrap(text, width, size, font, cache) {
    const result = [];
    for (const paragraph of String(text).split('\n')) {
      let line = '', length = 0;
      for (const char of Array.from(paragraph)) {
        if (!cache.has(char)) cache.set(char, font.widthOfTextAtSize(char, 1));
        const next = cache.get(char) * size;
        if (line && length + next > width) {result.push(line); line = ''; length = 0;}
        line += char; length += next;
      }
      result.push(line);
    }
    return result;
  }
  async function createPdf(m, grids, fontBytes, PDFLib, fontkit) {
    const {PDFDocument, rgb} = PDFLib;
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(fontBytes, {subset: true});
    const glyphs = new Set(font.getCharacterSet());
    const grid = grids[m.slot.key];
    if (!grid?.cells?.length) throw Error('沙推表範本不完整，請重新下載。');
    const texts = grid.cells.map(c => cellText(c, m));
    const date = m.schedule.date.replaceAll('-', '/'), rehearse = m.schedule.rehearsal.replaceAll('-', '/');
    const subtitle = '正式：' + date + ' ' + m.schedule.time + ' 文化會堂　／　彩排：' + rehearse + ' ' + m.schedule.rehearsalTime + ' ' + m.schedule.venue;
    const stamp = new Date(m.readAt).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei', hour12: false});
    const heading = '2027 ' + m.schedule.name + '地區友好總會｜正式沙推表・' + m.slot.label;
    const footer = '姓名依網站已儲存分工與執勤表套入；待確認項目請於現場確認。幸福1+1人選待定稿。';
    for (const c of Array.from(texts.join('') + subtitle + heading + footer + stamp + '正面背面資料讀取第頁0123456789 / A3 橫式雙面短邊翻頁')) {
      if (c.codePointAt(0) > 31 && !glyphs.has(c.codePointAt(0))) throw Error('字型尚未支援姓名中的「' + c + '」，請聯絡管理幹部協助。');
    }
    const width = 1190.551181, height = 841.889764, margin = 14.173228;
    const base = [18,34,8,34,28,8,62,18,80,24,58,90,94,75,90,65,75,65,55,76];
    const ratio = (width - margin * 2) / base.reduce((a,b) => a+b, 0);
    const widths = base.map(v => v * ratio), xs = [margin]; widths.forEach(v => xs.push(xs.at(-1) + v));
    const pages = [Array.from({length: 17}, (_,i) => i+4), [4,5,...Array.from({length: 13}, (_,i) => i+21)]];
    const cache = new Map(); let minimumFontSize = Infinity;
    for (let n = 0; n < pages.length; n++) {
      const rows = pages[n], cells = grid.cells.filter(c => rows.includes(c.row));
      let size = 8.6, layout;
      for (; size >= 7.2; size -= .2) {
        const heights = Object.fromEntries(rows.map(r => [r, r <= 5 ? 25 : 19]));
        const fitted = cells.map(c => {
          const text = cellText(c,m), w = widths.slice(c.col-1,c.col-1+c.colspan).reduce((a,b) => a+b,0);
          const lines = wrap(text, w-7, size, font, cache);
          return {...c, text, lines, w, need: lines.length * size * 1.34 + 8};
        });
        // Grow short rows first, then merged spans, keeping every instruction intact.
        fitted.sort((a,b) => a.rowspan-b.rowspan).forEach(c => {
          const span = rows.filter(r => r >= c.row && r < c.row+c.rowspan);
          const have = span.reduce((sum,r) => sum+heights[r],0);
          if (c.need > have) span.forEach(r => heights[r] += (c.need-have)/span.length);
        });
        const total = Object.values(heights).reduce((a,b) => a+b,0), available = height-margin-78;
        if (total <= available) {
          const surplus = (available-total)/(rows.length-2);
          rows.filter(r => r>5).forEach(r => heights[r] += surplus);
          layout = {heights, fitted}; break;
        }
      }
      if (!layout) throw Error('部分填寫內容過長，兩頁 A3 無法清楚容納，請縮短人員欄位的說明後再下載。');
      minimumFontSize = Math.min(minimumFontSize,size);
      const page = pdf.addPage([width,height]);
      page.drawText(heading, {x: margin, y: height-29, size: 17, font});
      page.drawText((n ? '背面' : '正面') + '　' + (n+1) + ' / 2', {x: width-110, y: height-28, size: 11, font});
      page.drawText(subtitle, {x: margin, y: height-47, size: 10, font});
      page.drawText('資料讀取：' + stamp + (m.sourceDate ? '　最近運營紀錄：' + m.sourceDate : '') + '　｜　A3 橫式・雙面短邊翻頁', {x: margin, y: height-63, size: 8.4, font});
      const tops = {}; let y = height-73; rows.forEach(r => {tops[r]=y; y-=layout.heights[r];});
      for (const c of layout.fitted) {
        const h = rows.filter(r => r>=c.row && r<c.row+c.rowspan).reduce((sum,r) => sum+layout.heights[r],0);
        const x = xs[c.col-1], bottom = tops[c.row]-h;
        const fill = c.row <= 5 ? rgb(.91,.92,.93) : pending(c.text) ? rgb(1,.98,.91) : rgb(1,1,1);
        page.drawRectangle({x, y: bottom, width: c.w, height: h, color: fill, borderWidth: .45, borderColor: rgb(.22,.22,.22)});
        const centered = c.row<=5 || c.col<=8;
        let lineY = centered ? bottom+(h+c.lines.length*size*1.34)/2-size : tops[c.row]-5-size;
        for (const line of c.lines) {
          const lineWidth = font.widthOfTextAtSize(line,size);
          page.drawText(line, {x: centered ? x+(c.w-lineWidth)/2 : x+3.5, y: lineY, size, font, color: rgb(.06,.06,.06)});
          lineY -= size*1.34;
        }
      }
      page.drawText(footer, {x: margin, y: 8, size: 7.2, font, color: rgb(.3,.3,.3)});
    }
    pdf.setTitle(m.schedule.name+'地區正式沙推表 - '+m.slot.label);
    pdf.setSubject('A3 橫式，兩頁，雙面短邊翻頁');
    pdf.setAuthor('台中南區地區友好總會');
    // Request actual-size, correct tray and landscape duplex. Printer support still governs printing.
    const preferences = pdf.catalog.getOrCreateViewerPreferences();
    preferences.setPrintScaling(PDFLib.PrintScaling.None);
    preferences.setDuplex(PDFLib.Duplex.DuplexFlipShortEdge);
    preferences.setPickTrayByPDFSize(true);
    return {bytes: await pdf.save(), minimumFontSize, filename: m.schedule.name+'地區-'+m.schedule.date+'-'+m.slot.label+'-正式沙推表-A3雙面.pdf'};
  }
  root.AssemblySandplay = {slot, model, cellText, createPdf};
})(typeof window === 'undefined' ? globalThis : window);
