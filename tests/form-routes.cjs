const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync('app.js','utf8');
const code=src.slice(src.indexOf('const GOOGLE_FORM_ROUTES='),src.indexOf('function meeting(d)'));
const ctx={URL,selected:'光興'};vm.createContext(ctx);vm.runInContext(code+';this.routes=GOOGLE_FORM_ROUTES;',ctx);
const expected=['光興','德芳','宜昌','烏日','坪林','樹義','內新','明道','永興','和平','霧峰','成功','建成','喀哩','塗城','大東','樂業','萬豐','十九甲','新坪','健康','長億'];
let total=0;for(const name of expected){const route=ctx.selectedFormRoute(name);assert(route,`${name} missing`);const options=route.options.filter(v=>v.startsWith(name+'地區'));assert(options.length>=3);for(const group of options){const url=new URL(ctx.externalFormUrl(name,group));assert.equal(url.pathname.split('/').at(-1),'viewform');assert.equal(url.searchParams.get(ctx.routes.branchEntry),route.branch);assert.equal(url.searchParams.get(route.entry),group);total++;}assert.equal(new URL(ctx.externalFormUrl(name,'別的地區組別')).searchParams.has(route.entry),false);}
assert.equal(ctx.selectedFormRoute('不存在'),undefined);assert.equal(new URL(ctx.externalFormUrl('不存在')).searchParams.has(ctx.routes.branchEntry),false);
console.log(`PASS: 22 districts, ${total} groups, valid prefills and invalid-group protection`);
