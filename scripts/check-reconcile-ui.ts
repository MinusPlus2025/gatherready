/** Isolated browser fixture check. Does NOT prove live payment or remote DB behavior. */
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {loadMockState} from '../src/web/lib/mockState.js';
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--no-sandbox']});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage();await page.setViewport({width,height:900});
  const state=loadMockState('funding',null);state.session.role='organizer';let posts=0;let fail=false;
  await page.setRequestInterception(true);
  page.on('request',req=>{
   const url=new URL(req.url());
   if(url.pathname==='/api/state')return void req.respond({contentType:'application/json',body:JSON.stringify(state)});
   if(url.pathname.endsWith('/reconcile')){posts++;return void req.respond({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:{message:'fixture unavailable'}}:state)});}
   void req.continue();
  });
  await page.goto('http://localhost:5295/organizer/funding');await page.waitForSelector('.reconcile-panel');
  assert.equal(posts,0);await page.click('.reconcile-panel summary');
  assert.equal(await page.$eval('.reconcile-panel button',(e:any)=>e.disabled),true);
  await page.click('.reconcile-panel input');await page.click('.reconcile-panel button');
  await page.waitForFunction(()=>document.querySelector('.reconcile-panel [role=status]')?.textContent?.includes('check finished'));
  assert.equal(posts,1);assert.equal(await page.$eval('.reconcile-panel input',(e:any)=>e.checked),false);
  fail=true;await page.click('.reconcile-panel input');await page.click('.reconcile-panel button');await page.waitForSelector('.reconcile-panel [role=alert]');
  assert.equal(posts,2);assert.match(await page.$eval('.reconcile-panel [role=alert]',e=>e.textContent??''),/may still be pending/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(JSON.stringify({width,explicitPosts:posts,initialPosts:0,successAndFailure:true,horizontalOverflow:false}));
  await page.close();
 }
} finally {await browser.close();}
