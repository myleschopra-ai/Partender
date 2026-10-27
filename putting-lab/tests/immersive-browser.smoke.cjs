'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { chromium }=require('/tmp/puttinglab-playwright/node_modules/playwright');
(async()=>{
  fs.mkdirSync('putting-lab/ui-evidence',{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  try {
    for(const [label,viewport] of [['portrait',{width:430,height:932}],['landscape',{width:932,height:430}]]){
      const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true,permissions:['camera']});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',err=>errors.push(err.message));
      await page.goto('http://127.0.0.1:8765/',{waitUntil:'domcontentloaded'});
      const launch=page.locator('#plLaunch');
      await launch.waitFor({state:'visible',timeout:10000});
      await launch.click();
      await page.waitForSelector('body.pl-immersive');
      assert.equal(await page.locator('#plControls').isVisible(),true,'Overlay invisible');
      const box=await page.locator('#videoShell').boundingBox();
      assert.ok(box,'Video has no bounding rectangle');
      assert.ok(Math.abs(box.width-viewport.width)<2&&Math.abs(box.height-viewport.height)<2,
        'Video is not full screen on '+label+': '+JSON.stringify(box));
      await page.locator('#plGear').click();
      assert.equal(await page.locator('#plSettings').isVisible(),true,'Settings drawer did not open');
      await page.locator('#plQuality').selectOption('reliable');
      await page.locator('#plDoneSettings').click();
      assert.equal(await page.locator('#plSettings').isVisible(),false,'Settings drawer did not close');
      await page.screenshot({path:'putting-lab/ui-evidence/'+label+'-camera.png'});
      // Synthesize a real encoded WebM in Chromium so review is always tested.
      await page.evaluate(()=>{document.getElementById('assistAutoOnLoad').checked=false;});
      const bytes=await page.evaluate(async()=>{
        const c=document.createElement('canvas');c.width=320;c.height=180;
        const g=c.getContext('2d');const stream=c.captureStream(24),chunks=[];
        const type=MediaRecorder.isTypeSupported('video/webm;codecs=vp8')?'video/webm;codecs=vp8':'video/webm';
        const r=new MediaRecorder(stream,{mimeType:type});
        r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
        const stopped=new Promise(resolve=>{r.onstop=resolve;});
        let n=0;const draw=()=>{
          g.fillStyle='#38633d';g.fillRect(0,0,320,180);
          g.fillStyle='#ffffff';g.beginPath();g.arc(150+(n>22?(n-22)*4:0),90,7,0,Math.PI*2);g.fill();
          g.fillStyle='#555555';g.fillRect(90+Math.min(n,25)*2,97,25,8);
          n++;
        };
        draw();r.start(100);const timer=setInterval(draw,40);
        await new Promise(resolve=>setTimeout(resolve,1600));
        clearInterval(timer);r.stop();await stopped;
        stream.getTracks().forEach(t=>t.stop());
        return Array.from(new Uint8Array(await new Blob(chunks,{type}).arrayBuffer()));
      });
      assert.ok(bytes.length>1000,'Encoded review fixture is empty');
      await page.locator('#videoFile').setInputFiles({name:'virtual-putt.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
      await page.waitForFunction(()=>document.querySelector('#reviewVideo')?.readyState>=1,null,{timeout:15000});
      await page.waitForSelector('#plControls.pl-reviewing',{timeout:10000});
      const scrub=page.locator('#plTimeline');
      assert.ok(await scrub.isVisible(),'In-video review timeline missing');
      await page.locator('#plMarker').selectOption('ball');
      await page.locator('#plMove').click();
      await page.locator('#plAdd').click();
      await page.locator('#plReview').click();
      await page.screenshot({path:'putting-lab/ui-evidence/'+label+'-review.png'});
      assert.deepEqual(errors,[],'Browser exception(s): '+errors.join(' | '));
      await context.close();
      console.log('PASS',label,'full-video camera overlay, settings, controls and review UI');
    }
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exit(1);});