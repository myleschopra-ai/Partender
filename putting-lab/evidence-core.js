(function(root){
  'use strict';
  const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.t);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const wrap=a=>{while(a>90)a-=180;while(a< -90)a+=180;return a;};

  function lineFit(points){
    const pts=(points||[]).filter(finitePoint);
    if(pts.length<3)return null;
    const mt=pts.reduce((s,p)=>s+p.t,0)/pts.length;
    const mx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
    const my=pts.reduce((s,p)=>s+p.y,0)/pts.length;
    const den=pts.reduce((s,p)=>s+(p.t-mt)**2,0);
    if(den<1e-8)return null;
    const vx=pts.reduce((s,p)=>s+(p.t-mt)*(p.x-mx),0)/den;
    const vy=pts.reduce((s,p)=>s+(p.t-mt)*(p.y-my),0)/den;
    const residual=Math.sqrt(pts.reduce((s,p)=>s+(p.x-mx-vx*(p.t-mt))**2+(p.y-my-vy*(p.t-mt))**2,0)/pts.length);
    return {vx,vy,residual,angle:Math.atan2(vy,vx),travel:distance(pts[0],pts.at(-1)),points:pts};
  }

  function selectPutterTrack(trace,impact){
    const points=(trace||[]).filter(q=>q.center&&q.t>=impact-.42&&q.t<=impact-.015&&q.motion>=.027&&q.global<.085)
      .map(q=>({x:q.center.x,y:q.center.y,t:q.t,confidence:'low',source:'motion-centroid'}));
    const spaced=points.filter((p,i)=>i===0||p.t-points[i-1].t>=.018);
    const fit=lineFit(spaced);
    if(!fit||fit.points.length<3||fit.travel<.012||fit.residual>.018)return null;
    return {points:fit.points,angle:fit.angle,residual:fit.residual,confidence:fit.residual<.009?'medium':'low',
      reason:'Local pre-impact motion centroid; inspect every point because hands, shadows, or the shaft can attract the tracker.'};
  }

  function selectBallTrack(candidates,ball,impact){
    if(!ball)return null;
    const ordered=[{...ball,t:impact},...(candidates||[])]
      .filter(finitePoint).filter(p=>p.t>=impact&&p.t<=impact+.28)
      .sort((a,b)=>a.t-b.t);
    const moved=ordered.filter((p,i)=>i===0||distance(p,ball)>.004);
    if(moved.length<4)return null;
    let axis=null,last=0;const accepted=[moved[0]];
    for(const p of moved.slice(1)){
      const d=distance(p,ball);if(d<=last+.001||d>.32)continue;
      const a=Math.atan2(p.y-ball.y,p.x-ball.x);if(axis===null)axis=a;
      const delta=Math.abs(wrap((a-axis)*180/Math.PI));if(delta>24)continue;
      accepted.push(p);last=d;
    }
    const fit=lineFit(accepted);
    if(!fit||accepted.length<4||fit.travel<.012||fit.residual>.012)return null;
    return {points:accepted.map(p=>({...p,confidence:'medium',source:'bright-ball-track'})),angle:fit.angle,residual:fit.residual,
      confidence:fit.residual<.006?'medium':'low',reason:'Bright compact-object track after the departure candidate; verify that every circle remains on the ball.'};
  }

  function scaleFromBall(ball,frameWidth){
    if(!ball||!Number.isFinite(ball.area)||!Number.isFinite(frameWidth))return null;
    const diameter=2*Math.sqrt(ball.area/Math.PI);
    if(diameter<3.5||diameter>18)return null;
    const half=diameter/(2*frameWidth);
    return {points:[{x:ball.x-half,y:ball.y,t:ball.t},{x:ball.x+half,y:ball.y,t:ball.t}],diameterPx:diameter,
      confidence:'low',reason:'Scale inferred from the detected bright ball silhouette using the 42.67 mm regulation diameter; perspective and bloom can bias it.'};
  }

  function faceLineFromFrame(frame,center,pathAngle){
    if(!frame||!frame.gray||!center||!Number.isFinite(pathAngle))return null;
    const {gray,w,h}=frame,cx=Math.round(center.x*w),cy=Math.round(center.y*h),r=Math.max(12,Math.round(w*.055));
    const samples=[];let sum=0,count=0;
    for(let y=Math.max(1,cy-r);y<Math.min(h-1,cy+r);y++)for(let x=Math.max(1,cx-r);x<Math.min(w-1,cx+r);x++){sum+=gray[y*w+x];count++;}
    if(!count)return null;const mean=sum/count;
    for(let y=Math.max(2,cy-r);y<Math.min(h-2,cy+r);y++)for(let x=Math.max(2,cx-r);x<Math.min(w-2,cx+r);x++){
      const gx=gray[y*w+x+1]-gray[y*w+x-1],gy=gray[(y+1)*w+x]-gray[(y-1)*w+x];
      const contrast=Math.abs(gray[y*w+x]-mean),gradient=Math.hypot(gx,gy);
      if(contrast>30&&gradient>35)samples.push({x,y,weight:Math.min(255,contrast+gradient)});
    }
    if(samples.length<18)return null;
    const sw=samples.reduce((s,p)=>s+p.weight,0),mx=samples.reduce((s,p)=>s+p.x*p.weight,0)/sw,my=samples.reduce((s,p)=>s+p.y*p.weight,0)/sw;
    let xx=0,xy=0,yy=0;for(const p of samples){const dx=p.x-mx,dy=p.y-my;xx+=p.weight*dx*dx;xy+=p.weight*dx*dy;yy+=p.weight*dy*dy;}
    const theta=.5*Math.atan2(2*xy,xx-yy),major=(xx+yy)/2+Math.hypot((xx-yy)/2,xy),minor=(xx+yy)/2-Math.hypot((xx-yy)/2,xy);
    const anisotropy=major/Math.max(1,minor),perpendicular=Math.abs(wrap((theta-pathAngle)*180/Math.PI));
    if(anisotropy<3.2||Math.abs(perpendicular-90)>32)return null;
    const half=Math.min(r*.72,Math.max(7,Math.sqrt(major/sw)*1.25));
    return {points:[{x:(mx-Math.cos(theta)*half)/w,y:(my-Math.sin(theta)*half)/h,t:center.t},{x:(mx+Math.cos(theta)*half)/w,y:(my+Math.sin(theta)*half)/h,t:center.t}],
      angle:theta,anisotropy,confidence:anisotropy>6?'medium':'low',reason:'High-contrast elongated edge near the tracked putter head, gated to be approximately perpendicular to motion; verify it is the face, not a shadow or alignment aid.'};
  }

  function build({trace,brightCandidates,ball,impact,impactFrame,frameWidth}){
    const putter=selectPutterTrack(trace,impact),ballTrack=selectBallTrack(brightCandidates,ball,impact),scale=scaleFromBall(ball,frameWidth);
    const face=putter?faceLineFromFrame(impactFrame,{...putter.points.at(-1),t:impact},putter.angle):null;
    return {putter,ballTrack,scale,face,generatedAt:new Date().toISOString(),modelVersion:'0.9-evidence-1'};
  }

  root.PuttingEvidenceCore={lineFit,selectPutterTrack,selectBallTrack,scaleFromBall,faceLineFromFrame,build};
})(typeof window!=='undefined'?window:globalThis);
