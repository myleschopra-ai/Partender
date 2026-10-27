/* Putting Lab Temporal Detector v1.0 — consecutive grayscale frames, no AI claims.
   Keeps a stable ball identity, local pre-impact activity, and a multi-frame outbound track.
   Retains false-negative preference: never invent an impact when evidence is absent. */
(function(root){
'use strict';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
class PuttingTemporalDetector{
 constructor(w,h,roi){
  if(!roi||!Number.isFinite(roi.x)||!Number.isFinite(roi.y)||w<40||h<40)throw Error('Select a ball in the camera frame');
  this.w=w;this.h=h;this.seed={x:clip(roi.x*w,2,w-3),y:clip(roi.y*h,2,h-3)};
  this.ball=null;this.previous=null;this.reference=null;this.stable=0;this.lastPutter=-Infinity;
  this.frames=[];this.lastTime=null;this.outbound=null;this.departureStart=null;
  this.outboundCount=0;this.tripped=false;this.shakeCount=0;this.trace=[];
  this.minRadius=Math.max(2.5,w*.014);
 }
 mean(g,p,r,inner=0){
  let n=0,sum=0;
  for(let y=Math.max(0,Math.floor(p.y-r));y<=Math.min(this.h-1,Math.ceil(p.y+r));y++)
   for(let x=Math.max(0,Math.floor(p.x-r));x<=Math.min(this.w-1,Math.ceil(p.x+r));x++){
    const d=Math.hypot(x-p.x,y-p.y);
    if(d>r||d<inner)continue;sum+=g[y*this.w+x];n++;
   }
  return n?sum/n:0;
 }
 blobs(g,origin,radius,threshold,areaCap){
  const l=clip(Math.floor(origin.x-radius),0,this.w-1),r=clip(Math.ceil(origin.x+radius),0,this.w-1);
  const t=clip(Math.floor(origin.y-radius),0,this.h-1),b=clip(Math.ceil(origin.y+radius),0,this.h-1);
  const width=r-l+1,height=b-t+1,seen=new Uint8Array(width*height),out=[];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const seed=y*width+x;if(seen[seed]||g[(t+y)*this.w+l+x]<threshold)continue;
   const queue=[seed];seen[seed]=1;let count=0,sumx=0,sumy=0,minx=9999,maxx=0,miny=9999,maxy=0;
   for(let k=0;k<queue.length;k++){
    const index=queue[k],ix=index%width,iy=Math.floor(index/width);
    const px=l+ix,py=t+iy;
    count++;sumx+=px;sumy+=py;minx=Math.min(minx,px);maxx=Math.max(maxx,px);miny=Math.min(miny,py);maxy=Math.max(maxy,py);
    if(count>areaCap)break;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;const xx=ix+dx,yy=iy+dy;
     if(xx<0||xx>=width||yy<0||yy>=height)continue;
     const j=yy*width+xx;
     if(!seen[j]&&g[(t+yy)*this.w+l+xx]>=threshold){seen[j]=1;queue.push(j);}
    }
   }
   const bw=maxx-minx+1,bh=maxy-miny+1;
   if(count>=4&&count<=areaCap&&Math.max(bw,bh)/Math.max(1,Math.min(bw,bh))<2.3)
    out.push({x:sumx/count,y:sumy/count,area:count,box:bw*bh});
  }
  return out;
 }
 motion(g,global=false){
  if(!this.previous)return {count:0,total:1};
  const p=this.ball||this.seed;
  let count=0,total=0;
  const limit=global?Infinity:Math.max(this.w*.12,(this.ball?.radius||this.minRadius)*9);
  const inner=global?this.w*.22:(this.ball?.radius||this.minRadius)*1.6;
  const step=global?5:2;
  const x0=global?2:Math.max(1,Math.floor(p.x-limit)),x1=global?this.w-2:Math.min(this.w-2,Math.ceil(p.x+limit));
  const y0=global?2:Math.max(1,Math.floor(p.y-limit)),y1=global?this.h-2:Math.min(this.h-2,Math.ceil(p.y+limit));
  for(let y=y0;y<y1;y+=step)for(let x=x0;x<x1;x+=step){
   const d=Math.hypot(x-p.x,y-p.y);
   if(global?d<inner:d<inner||d>limit)continue;
   total++;if(Math.abs(g[y*this.w+x]-this.previous[y*this.w+x])>25)count++;
  }
  return {count,total:Math.max(1,total),ratio:count/Math.max(1,total)};
 }
 outboundBall(g){
  if(!this.ball||!this.reference)return null;
  const b=this.ball,radius=Math.min(this.w*.46,Math.max(this.w*.26,b.radius*18));
  const threshold=clip(Math.max(132,b.background+Math.max(35,b.contrast*.40)),0,249);
  const candidates=this.blobs(g,b,radius,threshold,Math.max(180,b.area*3.2));
  const low=Math.max(2.5,b.radius*1.25),high=radius-b.radius;
  const valid=candidates.filter(c=>{
   const moved=dist(c,b),size=c.area/b.area;
   if(moved<low||moved>high||size<.30||size>2.9||c.box>c.area*3.8)return false;
   const ix=clip(Math.round(c.x),0,this.w-1),iy=clip(Math.round(c.y),0,this.h-1),at=iy*this.w+ix;
   // Reject a second, already-present stationary white ball or training target.
   if(g[at]-this.reference[at]<28)return false;
   if(this.outbound&&dist(this.outbound,c)>Math.max(36,this.w*.23))return false;
   return true;
  });
  const expected=this.outbound||b;
  return valid.sort((a,b)=>dist(a,expected)-dist(b,expected))[0]||null;
 }
 sample(g,time){
  if(!g||g.length!==this.w*this.h||!Number.isFinite(time))return {status:'invalid-frame'};
  if(this.lastTime!==null){
   const dt=time-this.lastTime;
   if(dt<=0)return{status:'duplicate-frame'};
   if(dt>300){
    // Camera paused, browser dropped frames, or iOS changed the stream.
    // Abandon stale identity instead of joining unrelated image evidence.
    this.lastTime=time;this.previous=g.slice();this.ball=null;this.reference=null;
    this.stable=0;this.lastPutter=-Infinity;this.outbound=null;this.outboundCount=0;
    this.departureStart=null;this.trace=[];this.frames=[];
    return{status:'stabilizing',reason:'Frame gap: reacquiring stationary ball'};
   }
   this.frames.push(dt);if(this.frames.length>40)this.frames.shift();
  }
  this.lastTime=time;
  if(!this.previous){this.previous=g.slice();return {status:'stabilizing',frames:0};}
  const global=this.motion(g,true).ratio;
  if(global>.18){
   this.shakeCount++;this.previous=g.slice();this.ball=null;this.reference=null;this.stable=0;this.lastPutter=-Infinity;
   this.outbound=null;this.outboundCount=0;return {status:'camera-moving',global};
  }
  if(!this.ball||this.stable<9){
   const bg=this.mean(g,this.seed,this.minRadius*4.2,this.minRadius*2);
   const blobs=this.blobs(g,this.seed,this.minRadius*2.7,Math.max(132,bg+45),Math.max(200,this.minRadius*this.minRadius*14));
   const b=blobs.sort((a,b)=>dist(a,this.seed)-dist(b,this.seed))[0];
   if(!b||dist(b,this.seed)>this.minRadius*2.1||b.box>b.area*3.4){
    this.previous=g.slice();this.stable=0;this.ball=null;return{status:'low-contrast',reason:'Re-select actual golf ball'};
   }
   const radius=Math.sqrt(b.area/Math.PI);
   const contrast=this.mean(g,b,Math.max(1.2,radius*.75))-bg;
   if(contrast<35||radius>this.minRadius*2.4){
    this.previous=g.slice();this.stable=0;this.ball=null;return{status:'low-contrast',contrast};
   }
   if(this.ball&&dist(this.ball,b)>Math.max(1.5,radius*.55))this.stable=0;
   this.ball={x:b.x,y:b.y,area:b.area,radius,contrast,background:bg};
   this.stable++;
   if(this.stable>=9){this.reference=g.slice();this.seed={x:b.x,y:b.y};}
   this.previous=g.slice();
   return{status:this.stable>=9?'ready':'stabilizing',frames:this.stable,global,ball:{x:b.x/this.w,y:b.y/this.h}};
  }
  const approach=this.motion(g,false);
  const b=this.ball,near=this.mean(g,b,Math.max(1.3,b.radius*.7)),base=this.mean(this.reference,b,Math.max(1.3,b.radius*.7));
  const departed=base-near>Math.max(22,b.contrast*.38);
  if(!departed&&approach.count>=7&&approach.ratio>.008)this.lastPutter=time;
  const recent=time-this.lastPutter<=1000;
  const moved=(departed||this.outbound)?this.outboundBall(g):null;
  if(moved&&recent){
   const old=this.outbound;
   // A bright stationary decoy, a shadow, or an uncovered second golf ball
   // cannot be counted as multiple outbound positions just because it persists.
   const forward=!old||(moved.area>0 &&
    movedDistance(moved,b)>=movedDistance(old,b)+Math.max(0.8,b.radius*.22) &&
    movedDistance(moved,old)>=Math.max(0.8,b.radius*.22) &&
    movedDistance(moved,old)<Math.max(32,this.w*.22) &&
    (moved.x-old.x)*(old.x-b.x)+(moved.y-old.y)*(old.y-b.y)>=-b.radius*b.radius*.05);
   if(forward){if(!this.outboundCount)this.departureStart=time;this.outbound=moved;this.outboundCount++;}
   else{this.outboundCount=0;this.outbound=null;this.departureStart=null;}
  }else if(!moved){this.outboundCount=0;this.outbound=null;this.departureStart=null;}
  this.previous=g.slice();
  if(moved){this.trace.push({t:time,x:moved.x/this.w,y:moved.y/this.h});if(this.trace.length>70)this.trace.shift();}
  if(this.outboundCount>=2&&!this.tripped){
   this.tripped=true;
   return{status:'candidate',time:this.departureStart,sampleMs:this.frames.length?this.frames.reduce((a,b)=>a+b,0)/this.frames.length:null,
    global,centerDrop:base-near,approachMotion:approach.ratio,ballTrack:this.trace.slice(),
    reason:'Tracked ball departures after nearby putter motion; review exact impact'};
  }
  return{status:departed?(moved?'departure-unverified':'occlusion-unverified'):recent?'approach':'ready',
   global,centerDrop:base-near,contrast:b.contrast,approachMotion:approach.ratio};
 }
}
function movedDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
root.PuttingTemporalDetector=PuttingTemporalDetector;
if(typeof module!=='undefined'&&module.exports)module.exports={PuttingTemporalDetector};
})(typeof window!=='undefined'?window:globalThis);