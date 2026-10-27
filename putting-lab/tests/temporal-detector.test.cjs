'use strict';
const assert=require('node:assert/strict');
require('../public/temporal-detector.js');
const PuttingTemporalDetector=globalThis.PuttingTemporalDetector;
assert.equal(typeof PuttingTemporalDetector,'function','Browser module should expose the detector globally');
const W=192,H=108,X=96,Y=55,FPS=30;
function rect(g,x,y,r,value){for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(H,Math.ceil(y+r+1));yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(W,Math.ceil(x+r+1));xx++)g[yy*W+xx]=value;}
function ball(g,x,y,r,value){for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(H,Math.ceil(y+r+1));yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(W,Math.ceil(x+r+1));xx++)if((xx-x)**2+(yy-y)**2<r*r)g[yy*W+xx]=value;}
function frame(i,kind){
 const low=kind==='low-light',shake=kind==='camera-shake'&&i>=30;
 const g=new Uint8Array(W*H).fill(low?25:shake?(i%2?80:35):65);
 // Other bright stationary circular object — do not mistake for ball leaving.
 ball(g,132,53,5,225);
 if((kind==='occlusion'||kind==='static-decoy'||kind==='pickup-and-stop')&&i>=45){}else if(kind==='no-departure'||i<45)ball(g,X,Y,4,low?80:240);
 else if(kind==='static-decoy'){ball(g,X+22,Y,4,240);}
 else if(kind==='pickup-and-stop'){ball(g,X+35,Y+8,4,240);}
 else{const offset=kind==='slow-putt'?Math.round((i-44)*3.5):(i-44)*7;ball(g,X+offset,kind==='push-right'?Y+Math.round(offset*.18):Y,4,low?80:240);}
 if(i>=28&&i<=43)rect(g,25+(i-28)*4,58,4,145);
 return g;
}
let pass=0;
for(const [kind,want] of [['straight',true],['push-right',true],['slow-putt',true],['no-departure',false],['occlusion',false],['low-light',false],['camera-shake',false],['static-decoy',false],['pickup-and-stop',false]]){
 const detector=new PuttingTemporalDetector(W,H,{x:X/W,y:Y/H});
 let result=null;
 for(let i=0;i<65;i++){const found=detector.sample(frame(i,kind),1000*i/FPS);if(found.status==='candidate')result=found;}
 assert.equal(!!result,want,kind+': candidate status mismatch');
 console.log('PASS',kind,result?'candidate@'+result.time.toFixed(1)+'ms':'no candidate');
 pass++;
}
assert.equal(pass,9);
console.log('9/9 synthetic temporal tests passed — NOT a real-device accuracy claim.');
// Reject duplicate frame timestamps and abandon a ball identity across a long stream gap.
const gapTest=new PuttingTemporalDetector(W,H,{x:X/W,y:Y/H});
gapTest.sample(frame(0,'no-departure'),0);
assert.equal(gapTest.sample(frame(1,'no-departure'),0).status,'duplicate-frame');
assert.equal(gapTest.sample(frame(2,'no-departure'),1000).status,'stabilizing');
console.log('PASS duplicate and stalled stream timestamps');