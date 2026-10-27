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
      if(fs.existsSync('/tmp/putting-lab-ui-fixture.mp4')){
        // Test the actual recorded-video review surface without requiring camera hardware.
        await page.locator('#videoFile').setInputFiles('/tmp/putting-lab-ui-fixture.mp4');
        await page.waitForFunction(()=>document.querySelector('#reviewVideo')?.readyState>=1,{timeout:15000});
        await page.waitForSelector('#plControls.pl-reviewing',{timeout:10000});
        const scrub=page.locator('#plTimeline');
        assert.ok(await scrub.isVisible(),'In-video review timeline missing');
        await page.locator('#plMarker').selectOption('ball');
        await page.locator('#plMove').click();
        await page.locator('#plAdd').click();
        await page.locator('#plReview').click();
        await page.screenshot({path:'putting-lab/ui-evidence/'+label+'-review.png'});
      }
      assert.deepEqual(errors,[],'Browser exception(s): '+errors.join(' | '));
      await context.close();
      console.log('PASS',label,'full-video camera overlay, settings, controls and review UI');
    }
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exit(1);});