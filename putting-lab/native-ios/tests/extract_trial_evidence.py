"""Synthetic video integration fixture: independent segmentation of the known synthetic ball
and putter colors; feeds REAL encoded-frame timestamps and observations to Swift detector.
This does not verify the actual native FrameVision heuristics or iPhone device capture.
"""
import json, pathlib, cv2, numpy as np
here=pathlib.Path(__file__).resolve().parent
out=here/'generated';out.mkdir(exist_ok=True)
for video in sorted((here/'fixtures').glob('*.mp4')):
    capture=cv2.VideoCapture(str(video))
    if not capture.isOpened():raise RuntimeError(str(video))
    fps=capture.get(cv2.CAP_PROP_FPS)
    seq=[]; prev=None;i=0
    while True:
        ok,frame=capture.read()
        if not ok:break
        if i%2:
            i+=1;continue
        t=i/fps;i+=1
        # Synthetic fixture's white ball & warm metallic putter are intentionally distinctive.
        # These thresholds would NOT generalize to arbitrary real golf-ball/putter appearances.
        bm=cv2.inRange(frame,np.array([220,220,220],np.uint8),np.array([255,255,255],np.uint8))
        pm=cv2.inRange(frame,np.array([170,165,115],np.uint8),np.array([240,245,210],np.uint8))
        ball=None;putter=None;dia=None
        count=int(cv2.countNonZero(bm))
        if count>20:
            cs,_=cv2.findContours(bm,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            contours=sorted(cs,key=cv2.contourArea,reverse=True)
            if contours:
                c=contours[0];mom=cv2.moments(c)
                if mom['m00']>10:
                    ball={'x':mom['m10']/mom['m00'],'y':mom['m01']/mom['m00']}
                    bx,by,bw,bh=cv2.boundingRect(c);dia=float((bw+bh)/2)
        count=int(cv2.countNonZero(pm))
        if count>15:
            ccs,_=cv2.findContours(pm,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
            c=max(ccs,key=cv2.contourArea)
            mom=cv2.moments(c)
            if mom['m00']>10: putter={'x':mom['m10']/mom['m00'],'y':mom['m01']/mom['m00']}
        gray=cv2.cvtColor(frame,cv2.COLOR_BGR2GRAY)
        gray=cv2.resize(gray,(192,108),interpolation=cv2.INTER_AREA)
        motion=float(np.mean(np.abs(gray.astype(np.int16)-prev.astype(np.int16))>30)) if prev is not None else 0.0
        prev=gray
        seq.append({'time':t,'ball':ball,'putter':putter,'ballDiameterPixels':dia,'cameraMotion':motion,
                    'ballConfidence':0.95 if ball is not None else 0.0,
                    'putterConfidence':0.9 if putter is not None else 0.0})
    capture.release()
    outfile=out/(video.stem+'.json')
    outfile.write_text(json.dumps({'scenario':video.stem,'frames':seq}))
    print(video.name,len(seq),'motion-max',round(max(x['cameraMotion'] for x in seq),3),'->',outfile.name)
