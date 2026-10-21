import AVFoundation
import CoreVideo

/// Low-resolution grayscale observations taken from real AVCaptureVideoDataOutput frames.
/// Deliberately conservative: the 'putter' is a moving image patch, not a verified club model.
/// It is NOT a substitute for a trained object detector or a calibrated camera.
final class FrameVision {
    private let smallWidth = 192, smallHeight = 108
    private var previous: [UInt8]?
    private(set) var anchor: ImagePoint?
    private var lastBall: ImagePoint?
    private var lastMovingPatch: ImagePoint?
    private var selectedBall: ImagePoint?
    private var ballDiameter: Double?

    func reset() { previous = nil; anchor = nil; lastBall = nil; lastMovingPatch = nil; ballDiameter = nil }
    func seedBall(x: Double, y: Double, frameWidth: Int, frameHeight: Int) {
        selectedBall = ImagePoint(x * Double(frameWidth), y * Double(frameHeight))
        anchor = selectedBall
    }
    func clearBallSeed() { selectedBall = nil; anchor = nil }

    func observe(_ buffer: CVPixelBuffer, timestamp: Double) -> FrameEvidence {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let originalW = CVPixelBufferGetWidth(buffer), originalH = CVPixelBufferGetHeight(buffer)
        let pixelType = CVPixelBufferGetPixelFormatType(buffer)
        var data = [UInt8](repeating: 0, count: smallWidth * smallHeight)
        let bytes: UnsafeMutablePointer<UInt8>?
        let bytesPerRow: Int
        let step = 1
        if CVPixelBufferIsPlanar(buffer) {
            bytes = CVPixelBufferGetBaseAddressOfPlane(buffer, 0)?.assumingMemoryBound(to: UInt8.self)
            bytesPerRow = CVPixelBufferGetBytesPerRowOfPlane(buffer, 0)
        } else if pixelType == kCVPixelFormatType_32BGRA {
            bytes = CVPixelBufferGetBaseAddress(buffer)?.assumingMemoryBound(to: UInt8.self)
            bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
        } else { bytes = nil; bytesPerRow = 0 }
        guard let bytes else {
            return FrameEvidence(time: timestamp, ball: nil, putter: nil, ballDiameterPixels: nil, cameraMotion: 1, ballConfidence: 0, putterConfidence: 0)
        }
        for y in 0..<smallHeight {
            let sy = min(originalH-1, Int(Double(y) * Double(originalH) / Double(smallHeight)))
            for x in 0..<smallWidth {
                let sx = min(originalW-1, Int(Double(x) * Double(originalW) / Double(smallWidth)))
                data[y*smallWidth+x] = bytes[sy*bytesPerRow+sx*(pixelType == kCVPixelFormatType_32BGRA ? 4 : step)]
            }
        }
        let sxScale = Double(originalW)/Double(smallWidth), syScale=Double(originalH)/Double(smallHeight)
        let motion: Double
        if let prev = previous {
            var largeChanges=0, total=0
            // sample background excluding the ball's neighborhood to detect camera disturbance
            for y in stride(from: 5, to: smallHeight-5, by: 5) {
                for x in stride(from: 5, to: smallWidth-5, by: 5) {
                    let idx=y*smallWidth+x
                    if abs(Int(data[idx])-Int(prev[idx]))>35 { largeChanges += 1 }
                    total += 1
                }
            }
            motion=Double(largeChanges)/Double(max(total,1))
        } else { motion=0 }
        // Scan for a compact bright center with a darker surrounding annulus.
        // A manual seed is permitted when the ball cannot be identified automatically.
        let near = lastBall ?? selectedBall
        var bestScore = -Double.infinity
        var bestX: Int?; var bestY:Int?
        let radius = 4
        for y in stride(from: 9, to: smallHeight-9, by: 2) {
            for x in stride(from: 9, to: smallWidth-9, by: 2) {
                if let near {
                    let tx=Double(x)*sxScale, ty=Double(y)*syScale
                    let allowable = anchor == nil ? 0.25*Double(originalW) : 0.32*Double(originalW)
                    if hypot(tx-near.x,ty-near.y)>allowable { continue }
                }
                let c = Double(data[y*smallWidth+x])
                guard c > 145 else { continue }
                let offsets = [(-radius,0),(radius,0),(0,-radius),(0,radius),(-radius,-radius),(radius,radius)]
                let ring = offsets.map { Double(data[(y+$0.1*2)*smallWidth+x+$0.0*2]) }.reduce(0,+)/6
                let contrast=c-ring
                guard contrast > 25 else { continue }
                var score = contrast + (c-145)*0.18
                if let near {
                    let distance = hypot(Double(x)*sxScale-near.x,Double(y)*syScale-near.y)
                    score -= min(40,distance/Double(originalW)*110)
                } else {
                    score -= abs(Double(x)/Double(smallWidth)-0.5)*13
                }
                if score>bestScore { bestScore=score;bestX=x;bestY=y }
            }
        }
        let ball: ImagePoint?
        let confidence: Double
        if let x=bestX,let y=bestY,bestScore>35 {
            ball=ImagePoint(Double(x)*sxScale,Double(y)*syScale)
            confidence=min(0.95,0.55+max(0,bestScore-35)*0.004)
            if anchor == nil {anchor=ball}
            lastBall=ball
            // Diameter must be *observed* from the bright component, not hard-coded.
            // This rough estimate is gated; fine metrology requires independent calibration.
            let row=y*smallWidth;let cutoff=max(130,Int(data[row+x])-45)
            var left=x,right=x
            while left>1 && Int(data[row+left-1])>=cutoff && x-left<14 {left-=1}
            while right<smallWidth-2 && Int(data[row+right+1])>=cutoff && right-x<14 {right+=1}
            let measured=Double(right-left+1)*sxScale
            if (7...Double(originalW)/8).contains(measured) { ballDiameter=measured }
        } else if let manual=selectedBall, previous == nil {
            ball=manual;confidence=0.65;lastBall=manual
        } else { ball=nil;confidence=0 }
        var patch: ImagePoint?
        var patchConfidence=0.0
        if let prev=previous, let anchor,
           // Do not mistake a departing ball for the moving putter head.
           ball.map({ $0.distance(to: anchor) <= max(3.0,(ballDiameter ?? 10)*0.35) }) ?? true {
            let bx=anchor.x/sxScale,by=anchor.y/syScale
            var total=0.0,sx=0.0,sy=0.0,count=0
            for y in stride(from: max(4,Int(by)-38), to: min(smallHeight-4,Int(by)+38), by: 2) {
                for x in stride(from: max(4,Int(bx)-55), to: min(smallWidth-4,Int(bx)+55), by: 2) {
                    let dist=hypot(Double(x)-bx,Double(y)-by)
                    if dist < 7 || dist > 60 {continue}
                    let diff=abs(Int(data[y*smallWidth+x])-Int(prev[y*smallWidth+x]))
                    if diff > 35 {let w=Double(diff-35);total+=w;sx+=Double(x)*w;sy+=Double(y)*w;count+=1}
                }
            }
            if count>=4 && total>160 && motion<0.15 {
                patch=ImagePoint(sx/total*sxScale,sy/total*syScale)
                patchConfidence=min(0.75,0.55+Double(count)/180)
                lastMovingPatch=patch
            }
        }
        previous=data
        return FrameEvidence(time:timestamp,ball:ball,putter:patch,ballDiameterPixels:ballDiameter,
                             cameraMotion:motion,ballConfidence:confidence,putterConfidence:patchConfidence)
    }
}
