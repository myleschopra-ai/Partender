import Foundation
import AVFoundation
import Combine
import CoreMedia
import CoreVideo

struct VideoMode: Identifiable, Hashable {
    let width: Int, height: Int, fps: Int
    var id: String {"\(width)x\(height)@\(fps)"}
    var title: String {"\(width)x\(height) · \(fps) fps"}
    static let preferred=[VideoMode(width:1920,height:1080,fps:240),VideoMode(width:3840,height:2160,fps:120),VideoMode(width:1920,height:1080,fps:120),VideoMode(width:1920,height:1080,fps:60)]
}

final class CaptureController: NSObject,ObservableObject,AVCaptureVideoDataOutputSampleBufferDelegate {
    let session=AVCaptureSession()
    private let sessionQueue=DispatchQueue(label:"puttinglab.session")
    private let frameQueue=DispatchQueue(label:"puttinglab.capture.frames",qos:.userInitiated)
    private var vision=FrameVision()
    private var detector=StrokeEventDetector()
    private var writer=RollingCaptureWriter()
    private var framePTS: [Double]=[]
    private var selectedMode=VideoMode.preferred[0]
    private var actualMode: VideoMode?
    private var active=false
    private var armed=false
    private var candidate: StrokeEvents?
    private var armTime=0.0
    private var lastObservedTime=0.0
    private var observedWidth=0,observedHeight=0
    private var isWriting=false
    private var reportedReady=false
    private var firstCapturePTS=0.0

    @Published var status="Open camera to begin"
    @Published var requestedMode=VideoMode.preferred[0]
    @Published var deviceMode="Not opened"
    @Published var measuredFPS="—"
    @Published var isCameraReady=false
    @Published var isDetectionReady=false
    @Published var isArmed=false
    @Published var isFinalizing=false
    @Published var review: StrokeClip?
    @Published var clips=ClipLibrary.load()
    @Published var confidenceMessage="Awaiting ball acquisition"
    @Published var errorMessage: String?

    func reloadClips(){onMain{$0.clips=ClipLibrary.load()}}
    func start(mode:VideoMode) {
        sessionQueue.async { [weak self] in
            guard let self else{return}
            let permission=AVCaptureDevice.authorizationStatus(for:.video)
            if permission == .notDetermined {
                AVCaptureDevice.requestAccess(for:.video){ granted in
                    if granted { self.sessionQueue.async { self.configure(mode) } }
                    else { self.onMain { $0.errorMessage="Camera permission denied. Enable it in iOS Settings." } }
                }
            }else if permission == .authorized {self.configure(mode)}
            else {self.onMain{$0.errorMessage="Camera permission denied. Enable it in iOS Settings."}}
        }
    }
    private func onMain(_ update:@escaping (CaptureController)->Void){DispatchQueue.main.async{update(self)}}
    private func configure(_ requested:VideoMode){
        if active {session.stopRunning();active=false}
        session.beginConfiguration()
        session.sessionPreset = .inputPriority
        session.inputs.forEach{session.removeInput($0)}
        session.outputs.forEach{session.removeOutput($0)}
        guard let device=AVCaptureDevice.default(.builtInWideAngleCamera,for:.video,position:.back) else {
            session.commitConfiguration();onMain{$0.errorMessage="Rear camera unavailable"};return
        }
        do{
            let input=try AVCaptureDeviceInput(device:device)
            guard session.canAddInput(input) else {throw NSError(domain:"Capture",code:1)}
            session.addInput(input)
            let out=AVCaptureVideoDataOutput()
            out.alwaysDiscardsLateVideoFrames=true
            out.videoSettings=[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
            guard session.canAddOutput(out) else {throw NSError(domain:"Capture",code:2)}
            session.addOutput(out);out.setSampleBufferDelegate(self,queue:frameQueue)
            let choice=chooseFormat(device,preferred:requested)
            try device.lockForConfiguration()
            device.activeFormat=choice.0
            // High-speed exact formats require an input-priority session, not a generic preset.
            let duration=CMTime(value:1,timescale:CMTimeScale(choice.1.fps))
            device.activeVideoMinFrameDuration=duration
            device.activeVideoMaxFrameDuration=duration
            if device.isFocusModeSupported(.locked){device.focusMode = .locked}
            if device.isExposureModeSupported(.locked){device.exposureMode = .locked}
            if device.isWhiteBalanceModeSupported(.locked){device.whiteBalanceMode = .locked}
            device.unlockForConfiguration()
            selectedMode=requested;actualMode=choice.1
            session.commitConfiguration()
            session.startRunning();active=true
            vision.reset();detector.reset()
            frameQueue.async { [weak self] in self?.framePTS.removeAll() }
            onMain{controller in
                controller.isCameraReady=true;controller.requestedMode=requested
                controller.deviceMode=choice.1.title+" (format selected; delivered FPS is measured below)"
                controller.measuredFPS="Measuring…";controller.status="Camera running · position phone overhead"
            }
        }catch{
            session.commitConfiguration()
            onMain{$0.errorMessage="Camera configuration failed: \(error.localizedDescription)"}
        }
    }
    private func chooseFormat(_ device:AVCaptureDevice,preferred:VideoMode)->(AVCaptureDevice.Format,VideoMode){
        var options:[(AVCaptureDevice.Format,VideoMode)]=[]
        for f in device.formats {
            let dims=CMVideoFormatDescriptionGetDimensions(f.formatDescription)
            for fps in [240,120,60,30] where f.videoSupportedFrameRateRanges.contains(where:{$0.maxFrameRate+0.01>=Double(fps) && $0.minFrameRate-0.01<=Double(fps)}) {
                options.append((f,VideoMode(width:Int(dims.width),height:Int(dims.height),fps:fps)))
            }
        }
        let order=[preferred] + VideoMode.preferred.filter{$0 != preferred}+[VideoMode(width:1280,height:720,fps:60),VideoMode(width:1280,height:720,fps:30)]
        for wanted in order {
            if let x=options.first(where:{$0.1 == wanted}){return x}
        }
        let ranked=options.max(by:{ a,b in
            let score:(VideoMode)->Double={m in Double(m.fps)*1000 + min(Double(m.width*m.height)/10000,800)}
            return score(a.1)<score(b.1)
        })
        return ranked ?? (device.activeFormat,VideoMode(width:1920,height:1080,fps:30))
    }
    func arm(){
        frameQueue.async { [weak self] in
            guard let self,self.active,!self.armed,!self.isWriting else{return}
            self.vision.reset();self.detector.reset();self.writer=RollingCaptureWriter()
            self.candidate=nil;self.armed=true;self.armTime=0;self.firstCapturePTS=0;self.reportedReady=false
            self.onMain{$0.isDetectionReady=false;$0.isArmed=true;$0.status="ARMED · recording while looking for a putt";$0.confidenceMessage="Candidate detection: awaiting ball + putter motion"}
        }
    }
    func stop(){
        frameQueue.async { [weak self] in
            guard let self else{return}
            self.armed=false
            self.onMain{$0.isArmed=false;$0.status="Stopped"}
            if self.isWriting {self.finishCapture()}
        }
    }
    func markBallAtPreview(normalizedX:Double,normalizedY:Double){
        frameQueue.async { [weak self] in
            guard let self,self.observedWidth>0,self.observedHeight>0 else{return}
            self.vision.seedBall(x:normalizedX,y:normalizedY,frameWidth:self.observedWidth,frameHeight:self.observedHeight)
            self.onMain{$0.confidenceMessage="Manual ball reference selected; verify location"}
        }
    }
    func captureOutput(_ output:AVCaptureOutput,didOutput sampleBuffer:CMSampleBuffer,from connection:AVCaptureConnection) {
        guard let pixel=CMSampleBufferGetImageBuffer(sampleBuffer) else{return}
        let pts=CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        guard pts.isValid else {return}
        let t=CMTimeGetSeconds(pts)
        guard t.isFinite else{return}
        observedWidth=CVPixelBufferGetWidth(pixel);observedHeight=CVPixelBufferGetHeight(pixel)
        framePTS.append(t)
        while framePTS.count>180 {framePTS.removeFirst()}
        if framePTS.count >= 30, framePTS.count % 20 == 0,
           let first=framePTS.first,let last=framePTS.last,last>first {
            let fps=Double(framePTS.count-1)/(last-first)
            onMain{$0.measuredFPS=String(format:"%.1f captured fps",fps)}
        }
        guard armed || candidate != nil else{return}
        if armTime == 0 {armTime=t}
        if !isWriting {
            do{try writer.begin(at:sampleBuffer,width:observedWidth,height:observedHeight);isWriting=true;firstCapturePTS=t}
            catch{armed=false;onMain{$0.status="Recording failed";$0.errorMessage=error.localizedDescription;$0.isArmed=false};return}
        }else {writer.append(sampleBuffer)}
        // Sample detector at <=60fps, while writer still receives every arriving frame.
        if t-lastObservedTime>=1.0/60 {
            lastObservedTime=t
            let obs=vision.observe(pixel,timestamp:t)
            let result=detector.consume(obs)
            if detector.isReady && !reportedReady {
                reportedReady=true
                onMain{$0.isDetectionReady=true;$0.confidenceMessage="BALL ACQUIRED · camera stable · ready to putt"}
            }
            if let result,candidate==nil {
                candidate=result
                onMain{$0.status="POSSIBLE IMPACT · capturing follow-through";$0.confidenceMessage="Review required: candidate is based on ball departure"}
            }
        }
        if let event=candidate, t>event.impact.time+1.1 {
            armed=false;onMain{$0.isArmed=false;$0.isFinalizing=true;$0.status="Preparing stroke clip…"}
            finishCapture()
        }else if t-armTime>25 {
            armed=false;onMain{$0.isArmed=false;$0.status="25-second timeout · no confirmed stroke"}
            finishCapture()
        }
    }
    private func finishCapture(){
        guard isWriting else{return}
        isWriting=false
        let evt=candidate
        let frameObs=detector.observations
        let fpsEstimate=framePTS.count > 1 ? Double(framePTS.count-1)/(framePTS.last!-framePTS.first!) : 0
        let actual=actualMode ?? selectedMode
        let sourceStart=firstCapturePTS
        let missed=writer.skipped
        let measuredW=observedWidth,measuredH=observedHeight
        writer.finish{ [weak self] original,error in
            guard let self else{return}
            guard let original else {
                self.onMain{$0.isFinalizing=false;$0.errorMessage="Video writer failed: \(error?.localizedDescription ?? "unknown")"}
                return
            }
            guard let evt else {
                self.onMain{$0.isFinalizing=false;$0.status="No impact candidate. Original recording retained for manual review.";$0.clips=ClipLibrary.load()}
                return
            }
            let trimStart=max(0,evt.clipStart-sourceStart),trimEnd=max(trimStart+0.1,evt.clipEnd-sourceStart)
            RollingCaptureWriter.exportClip(original:original,from:trimStart,to:trimEnd){target,exportError in
                guard let target else {
                    self.onMain{$0.isFinalizing=false;$0.errorMessage="Clip export failed; original preserved: \(exportError?.localizedDescription ?? "unknown")"}
                    return
                }
                let metrics=MetricProposals.calculate(frameObs,impact:evt.impact.time,width:measuredW,height:measuredH)
                // Event timestamps must now refer to CLIP time, not capture uptime.
                func normalize(_ marker:EventMarker?)->EventMarker?{
                    guard var marker else{return nil};marker.time=max(0,marker.time-sourceStart-trimStart);return marker
                }
                var normalized=evt
                normalized.start=normalize(evt.start)
                normalized.transition=normalize(evt.transition)
                normalized.impact=normalize(evt.impact)!
                normalized.followThrough=normalize(evt.followThrough)
                normalized.clipStart=0;normalized.clipEnd=trimEnd-trimStart
                let record=StrokeClip(id:UUID(),createdAt:Date(),videoFilename:target.lastPathComponent,
                                      originalFilename:original.lastPathComponent,events:normalized,metrics:metrics,ballConfirmed:false,
                                      requestedFPS:self.selectedMode.fps,deliveredFPS:fpsEstimate,
                                      width:measuredW,height:measuredH,droppedWriterFrames:missed,
                                      notes:"Experimental ball-departure impact candidate. No face-angle value without face-edge tracking.")
                do{try ClipLibrary.save(record)}catch{
                    self.onMain{$0.errorMessage="Clip saved, but annotations failed: \(error.localizedDescription)"}
                }
                self.onMain{$0.review=record;$0.clips=ClipLibrary.load();$0.isFinalizing=false;$0.status="Stroke candidate ready for verification"}
            }
        }
    }
}
