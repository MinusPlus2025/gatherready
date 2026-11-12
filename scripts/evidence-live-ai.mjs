import fs from 'node:fs';
import puppeteer from '/Users/ming/Projects/小程序小应用/gatherready/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
const page=await b.newPage(); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const net=[]; page.on('response',async r=>{if(r.url().includes('/api/preferences/')){try{const json=await r.json();net.push({url:r.url(),status:r.status(),json});}catch{net.push({url:r.url(),status:r.status()});}}});
const api=async(m,url,body)=>page.evaluate(async(m,url,body)=>{const r=await fetch(url,{method:m,headers:{'content-type':'application/json','x-gatherready':'1'},body:body===undefined?undefined:JSON.stringify(body)});const t=await r.text();return t?JSON.parse(t):null;},m,url,body);
const click=async(t)=>page.evaluate((n)=>{const el=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').includes(n));el?.click();return Boolean(el);},t);
const shot=async(name)=>{await page.evaluate(()=>window.scrollTo(0,0));await sleep(250);await page.screenshot({path:`docs/screenshots/${name}`,fullPage:true});};
const sentence='I can do Saturday morning only, starting at 10.';
await page.setViewport({width:1440,height:1000});
await page.goto('http://localhost:5180/organizer/setup',{waitUntil:'networkidle0'}); await sleep(300);
await page.evaluate(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Load a sample'))?.click();}); await sleep(2000);
let st=await api('GET','/api/state'); const finn=st.participants.find(p=>p.displayName==='Finn');
await api('POST','/api/demo/view',{participantId:finn.id});
await page.goto('http://localhost:5180/participant/preferences',{waitUntil:'networkidle0'}); await sleep(600);
const savedBefore=st.preferences.find(p=>p.participantId===finn.id);
const planBefore=st.plan.slots.map(s=>({slot:s.slotId,fits:s.fits,meetsMinimum:s.meetsMinimum}));
await click('Change preference'); await sleep(400);
await page.evaluate((text)=>{const el=document.querySelector('#sourceText');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));for(const box of document.querySelectorAll('input[id^="tick-"]')){if(box.checked)box.click();}},sentence);
await sleep(300); await shot('participant-final-edit-before-1440.png');
const t0=Date.now(); await click('Extract conditions');
let previewMs=null;
for(let i=0;i<60;i++){await sleep(500);const p=net.find(x=>x.url.includes('/preferences/preview'));if(p){previewMs=Date.now()-t0;break;}}
await sleep(500);
const previewResponse=net.find(x=>x.url.includes('/preferences/preview'))?.json;
const savedDuring= (await api('GET','/api/state')).preferences.find(p=>p.participantId===finn.id);
await shot('participant-final-preview-1440.png');
// ensure at least one must-have is checked
await page.evaluate(()=>{const boxes=[...document.querySelectorAll('input[id^="accept-"]')];if(!boxes.some(b=>b.checked)&&boxes[0])boxes[0].click();});
await sleep(300);
await click('Confirm my preferences');
for(let i=0;i<30;i++){await sleep(400);const p=net.find(x=>x.url.includes('/preferences/revise'));if(p)break;}
let after=(await api('GET','/api/state')).preferences.find(p=>p.participantId===finn.id);
await sleep(500);
const reviseNet=net.find(x=>x.url.includes('/preferences/revise'));
await page.goto('http://localhost:5180/participant/preferences',{waitUntil:'networkidle0'}); await sleep(600);
await shot('participant-final-saved-1440.png');
const planAfter=(await api('GET','/api/state')).plan.slots.map(s=>({slot:s.slotId,fits:s.fits,meetsMinimum:s.meetsMinimum}));
// cancel/reload test after the new saved version
await click('Change preference'); await sleep(300);
await page.evaluate((text)=>{const el=document.querySelector('#sourceText');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));for(const box of document.querySelectorAll('input[id^="tick-"]')){if(box.checked)box.click();}},'I can do Saturday morning only.');
await click('Extract conditions');
for(let i=0;i<60;i++){await sleep(500);const before=net.filter(x=>x.url.includes('/preferences/preview')).length;if(before>=2)break;}
await sleep(400); await click('Cancel'); await sleep(400);
const afterCancel=(await api('GET','/api/state')).preferences.find(p=>p.participantId===finn.id);
await page.reload({waitUntil:'networkidle0'}); await sleep(500);
const afterRefresh=(await api('GET','/api/state')).preferences.find(p=>p.participantId===finn.id);
await shot('participant-final-cancel-refresh-1440.png');
await page.setViewport({width:390,height:844}); await page.reload({waitUntil:'networkidle0'}); await sleep(600);
await shot('participant-final-saved-390.png');
const record={capturedAt:new Date().toISOString(),health:await api('GET','/healthz'),sentence,savedBefore,planBefore,previewMs,preview:previewResponse?.preference ?? null,savedDuringPreview:{version:savedDuring.version,status:savedDuring.status},reviseStatus:reviseNet?.status ?? null,after:{version:after.version,status:after.status,sourceText:after.sourceText,accepted:after.acceptedSlotIds,conditions:after.conditions.map(c=>({slot:c.slotId,condition:c.condition,quote:c.sourceQuote}))},planAfter,afterCancel:{version:afterCancel.version,status:afterCancel.status},afterRefresh:{version:afterRefresh.version,status:afterRefresh.status},network:net.map(n=>({url:n.url.replace('http://localhost:5180',''),status:n.status}))};
fs.writeFileSync('docs/audit/ai-live-evidence.json',JSON.stringify(record,null,2));
console.log(JSON.stringify({previewMs,model:record.preview?.extractionModel,mode:record.preview?.extractionMode,accepted:record.preview?.acceptedSlotIds,conditions:record.preview?.conditions?.map(c=>({slot:c.slotId,condition:c.condition,quote:c.sourceQuote})),savedBefore:{v:savedBefore.version,s:savedBefore.status},savedDuringPreview:record.savedDuringPreview,reviseStatus:record.reviseStatus,after:{v:record.after.version,s:record.after.status,accepted:record.after.accepted},planBefore,planAfter,afterCancel:record.afterCancel,afterRefresh:record.afterRefresh,network:record.network},null,2));
await b.close();
