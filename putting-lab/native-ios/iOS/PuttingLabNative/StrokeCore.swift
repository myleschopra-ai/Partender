import Foundation

/// Coordinates always refer to the ORIGINAL captured frame, with the origin in the upper-left.
/// Evidence is neither calibrated nor verified merely because it is automatically proposed.
public struct ImagePoint: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public init(_ x: Double, _ y: Double) { self.x = x; self.y = y }
    public func distance(to other: ImagePoint) -> Double { hypot(x - other.x, y - other.y) }
}

public struct FrameEvidence: Codable, Sendable {
    public var time: Double
    public var ball: ImagePoint?
    public var putter: ImagePoint?
    /// Width of the ball in ORIGINAL IMAGE PIXELS, estimated by the visual detector.
    public var ballDiameterPixels: Double?
    /// Median coarse background-frame difference divided by 255. Larger suggests camera shake.
    public var cameraMotion: Double
    public var ballConfidence: Double
    public var putterConfidence: Double
    public init(time: Double, ball: ImagePoint?, putter: ImagePoint?, ballDiameterPixels: Double?, cameraMotion: Double = 0, ballConfidence: Double = 1, putterConfidence: Double = 1) {
        self.time = time; self.ball = ball; self.putter = putter; self.ballDiameterPixels = ballDiameterPixels
        self.cameraMotion = cameraMotion; self.ballConfidence = ballConfidence; self.putterConfidence = putterConfidence
    }
}

public enum ProposalStatus: String, Codable, Sendable { case proposed, confirmed }
public struct EventMarker: Codable, Sendable {
    public var time: Double
    public var status: ProposalStatus
    public var confidence: Double
    public init(time: Double, status: ProposalStatus = .proposed, confidence: Double) {
        self.time = time; self.status = status; self.confidence = confidence
    }
}

public struct StrokeEvents: Codable, Sendable {
    public var start: EventMarker?
    public var transition: EventMarker?
    public var impact: EventMarker
    public var followThrough: EventMarker?
    public var ballAtAddress: ImagePoint
    public var clipStart: Double
    public var clipEnd: Double
    public var source: String
}

public struct QuantifiedCandidate: Codable, Sendable {
    public let label: String
    public var value: Double?
    public let units: String
    public let explanation: String
    public var status: ProposalStatus?
    public init(_ label: String, _ value: Double?, _ units: String, _ explanation: String, _ status: ProposalStatus? = nil) {
        self.label = label; self.value = value; self.units = units; self.explanation = explanation; self.status = value == nil ? nil : (status ?? .proposed)
    }
}

/// Pure, deterministically testable state machine; frame vision and AVFoundation run separately.
/// The candidate is ball DEPARTURE, not proven club-ball contact. It is never auto-confirmed.
public final class StrokeEventDetector {
    public private(set) var candidate: StrokeEvents?
    public var isReady: Bool {baselineReady}
    public private(set) var observations: [FrameEvidence] = []
    public private(set) var rejectionReason: String?
    public var requiredStableFrames = 7
    public var maxCameraMotion = 0.15
    private var referenceBall: ImagePoint?
    private var stableCount = 0
    private var baselineWindow: [ImagePoint] = []
    private var baselineReady = false
    private var missingBallFrames = 0
    private var firstMotionTime: Double?
    private var putterApproachCount = 0
    private var initialPutter: ImagePoint?
    private var lastPutter: ImagePoint?
    private var lastTime = -Double.infinity
    private var departedCount = 0
    private var departureBeginning: Double?
    private var lastNearPutterTime: Double?

    public init() {}
    public func reset() {
        candidate = nil; observations.removeAll(keepingCapacity: true); rejectionReason = nil
        referenceBall = nil; stableCount = 0; baselineWindow.removeAll(); baselineReady = false; missingBallFrames = 0; firstMotionTime = nil; putterApproachCount = 0
        initialPutter = nil; lastPutter = nil; lastTime = -.infinity; departedCount = 0
        departureBeginning = nil; lastNearPutterTime = nil
    }
    @discardableResult public func consume(_ f: FrameEvidence) -> StrokeEvents? {
        guard f.time > lastTime, f.time.isFinite else { return candidate }
        lastTime = f.time
        observations.append(f)
        // Bound decision history (~8 seconds at 60 Hz) without losing the active event.
        if observations.count > 500 { observations.removeFirst(observations.count - 500) }
        if f.cameraMotion > maxCameraMotion {
            rejectionReason = "Camera moved or the image changed globally"
            stableCount = 0; baselineWindow.removeAll(); baselineReady = false
            putterApproachCount = 0; departedCount = 0
            lastPutter = nil; firstMotionTime = nil
            return candidate
        }
        if candidate != nil {
            if let point = f.putter, f.putterConfidence >= 0.55,
               f.time <= candidate!.impact.time + 0.6,
               f.time >= candidate!.impact.time + 0.13,
               let prev = observations.dropLast().last(where: { $0.putter != nil && $0.putterConfidence >= 0.55 }),
               point.distance(to: prev.putter!) >= 2 {
                candidate!.followThrough = EventMarker(time: f.time, confidence: 0.45)
                candidate!.clipEnd = f.time + 0.45
            }
            return candidate
        }
        guard let ball = f.ball, f.ballConfidence >= 0.6 else {
            missingBallFrames += 1
            // A clubhead may obscure the ball for 1–3 sampled frames at contact.
            // A longer interruption invalidates the launch evidence.
            if missingBallFrames > 3 {
                rejectionReason = "Ball occluded for too long to establish a departure"
                referenceBall = nil;stableCount = 0;baselineReady = false;baselineWindow.removeAll()
                putterApproachCount = 0;firstMotionTime = nil;lastPutter = nil
                departedCount = 0;departureBeginning = nil;lastNearPutterTime = nil
            }
            return nil
        }
        missingBallFrames = 0
        let diameter = max(3.0, f.ballDiameterPixels ?? 10)
        // Require an extended motion-stable ball baseline before tracking strokes.
        // This guards against handheld camera wobble being mistaken for ball departure.
        if !baselineReady {
            baselineWindow.append(ball)
            if baselineWindow.count > 22 { baselineWindow.removeFirst() }
            if baselineWindow.count >= 22 {
                let rangeX = (baselineWindow.map(\.x).max() ?? 0) - (baselineWindow.map(\.x).min() ?? 0)
                let rangeY = (baselineWindow.map(\.y).max() ?? 0) - (baselineWindow.map(\.y).min() ?? 0)
                if hypot(rangeX,rangeY) <= max(3.5,diameter*0.45) {
                    baselineReady=true;referenceBall=ball;stableCount=requiredStableFrames
                } else {
                    rejectionReason = "Ball image is not stable; check the fixed camera mount"
                }
            }
            return nil
        }
        if referenceBall == nil { referenceBall = ball; stableCount = 1; return nil }
        guard let origin = referenceBall else { return nil }
        let ballShift = ball.distance(to: origin)
        if stableCount < requiredStableFrames {
            if ballShift < max(2.0, diameter * 0.20) { stableCount += 1 }
            else { stableCount = 1; referenceBall = ball; putterApproachCount = 0 }
            return nil
        }
        // Require a putter landmark visibly approaching/near the stationary ball.
        if let p = f.putter, f.putterConfidence >= 0.55 {
            let proximity = p.distance(to: origin)
            if let prev = lastPutter, f.time - (observations.dropLast().last(where: { $0.putter != nil })?.time ?? 0) < 0.13,
               p.distance(to: prev) >= 0.5, proximity < diameter * 7.0 {
                if firstMotionTime == nil { firstMotionTime = f.time }
                putterApproachCount += 1
                lastNearPutterTime = f.time
            }
            lastPutter = p
            if initialPutter == nil { initialPutter = p }
        }
        let departureThreshold = max(3.0, diameter * 0.48)
        if ballShift > departureThreshold && f.ballConfidence >= 0.7 {
            if departureBeginning == nil { departureBeginning = f.time }
            departedCount += 1
        } else if ballShift <= departureThreshold {
            // At high fps, transient false ball detections should not trigger a clip.
            departedCount = 0; departureBeginning = nil
        }
        guard departedCount >= 3, putterApproachCount >= 2,
              let near = lastNearPutterTime, f.time - near <= 0.22,
              let departure = departureBeginning else { return nil }
        // All times are proposals. Transition is only offered on strong observed reversal.
        let putterHistory = observations.filter { $0.time >= max(0, departure - 0.9) && $0.time <= departure && $0.putter != nil && $0.putterConfidence >= 0.55 }
        var transition: EventMarker?
        if putterHistory.count >= 5 {
            // A reversal is a local change in direction on a sufficiently long observed track.
            let xs = putterHistory.map { $0.putter!.x }
            let ys = putterHistory.map { $0.putter!.y }
            let spreadX = (xs.max() ?? 0) - (xs.min() ?? 0)
            let spreadY = (ys.max() ?? 0) - (ys.min() ?? 0)
            let dominant: [Double] = spreadX > spreadY ? xs : ys
            for i in 2..<(dominant.count - 2) {
                let before = dominant[i] - dominant[i-2], after = dominant[i+2] - dominant[i]
                if abs(before) >= 2 && abs(after) >= 2 && before * after < 0 {
                    transition = EventMarker(time: putterHistory[i].time, confidence: 0.45)
                    break
                }
            }
        }
        let address: EventMarker? = firstMotionTime.map { EventMarker(time: $0, confidence: 0.35) }
        candidate = StrokeEvents(start: address, transition: transition,
                                impact: EventMarker(time: departure, confidence: 0.65),
                                followThrough: nil, ballAtAddress: origin,
                                clipStart: max(0, (firstMotionTime ?? departure) - 0.65),
                                clipEnd: departure + 1.0, source: "native-overhead-departure-candidate")
        return candidate
    }
}

public enum MetricProposals {
    /// Does not infer a target line from image orientation. A user-selected target vector is required.
    public static func calculate(_ frames: [FrameEvidence], impact: Double, width: Int, height: Int, targetStart: ImagePoint? = nil, targetEnd: ImagePoint? = nil) -> [QuantifiedCandidate] {
        let after = frames.filter { $0.time > impact && $0.time <= impact + 0.20 && $0.ball != nil && $0.ballConfidence >= 0.72 }
        let before = frames.filter { $0.time >= impact - 0.12 && $0.time <= impact && $0.putter != nil && $0.putterConfidence >= 0.6 }
        let diameter = frames.filter { $0.ballDiameterPixels != nil && $0.ballConfidence >= 0.7 }.compactMap { $0.ballDiameterPixels }.sorted()
        let diameterPx = diameter.count >= 5 ? diameter[diameter.count / 2] : nil
        let ballTrack = linearTrack(after, point: { $0.ball })
        let clubTrack = linearTrack(before, point: { $0.putter })
        var results: [QuantifiedCandidate] = []
        let usableScale = diameterPx != nil && diameterPx! >= 7 && diameterPx! <= Double(min(width, height)) / 8
        func speed(_ track: TrackResult?) -> Double? {
            guard usableScale, let t = track, t.residual <= max(2.0, diameterPx! * 0.30), t.span >= 0.025 else { return nil }
            let v = hypot(t.vx, t.vy) * 0.04267 / diameterPx!
            return (0.05...12).contains(v) ? v : nil
        }
        results.append(QuantifiedCandidate("Ball speed", speed(ballTrack), "m/s", "Image-plane estimate using observed ball diameter and post-impact track. Verify physical scale and source frames."))
        results.append(QuantifiedCandidate("Clubhead speed", speed(clubTrack), "m/s", "Requires consistent visible clubhead points near impact; perspective causes scale bias."))
        if let t = ballTrack, t.residual < 3.5, let a = targetStart, let b = targetEnd,
           a.distance(to: b) > 20 {
            let face = atan2(t.vy,t.vx), target = atan2(b.y-a.y,b.x-a.x)
            var angle = (face-target) * 180/Double.pi
            while angle > 180 { angle -= 360 }; while angle < -180 { angle += 360 }
            results.append(QuantifiedCandidate("Start-line deviation", angle, "°", "Compared with user-confirmed target reference; camera roll must be stable."))
        } else { results.append(QuantifiedCandidate("Start-line deviation", nil, "°", "Requires measured ball track and user-confirmed target line.")) }
        if let t = clubTrack, t.residual < 3.5, let a = targetStart, let b = targetEnd, a.distance(to: b) > 20 {
            var angle = (atan2(t.vy,t.vx)-atan2(b.y-a.y,b.x-a.x))*180/Double.pi
            while angle > 180 { angle -= 360 }; while angle < -180 { angle += 360 }
            results.append(QuantifiedCandidate("Putter path", angle, "°", "Near-impact image-plane tangent, relative to user-confirmed target line."))
        } else { results.append(QuantifiedCandidate("Putter path", nil, "°", "Needs near-impact clubhead tracking and target reference.")) }
        results.append(QuantifiedCandidate("Face angle", nil, "°", "A putter-center trajectory does not determine the face line. Requires reliable heel/toe edge segmentation."))
        return results
    }
    private struct TrackResult { let vx: Double; let vy: Double; let residual: Double; let span: Double }
    private static func linearTrack(_ frames: [FrameEvidence], point: (FrameEvidence) -> ImagePoint?) -> TrackResult? {
        let valid = frames.compactMap { f -> (Double, ImagePoint)? in guard let p = point(f) else { return nil }; return (f.time,p) }
        guard valid.count >= 4, valid.last!.0 - valid.first!.0 > 0.025 else { return nil }
        let t0 = valid[0].0, values = valid.map { ($0.0-t0,$0.1) }, n = Double(values.count)
        let mt = values.reduce(0) { $0 + $1.0 } / n
        let mx = values.reduce(0) { $0 + $1.1.x } / n
        let my = values.reduce(0) { $0 + $1.1.y } / n
        let varT = values.reduce(0) { $0 + pow($1.0-mt,2) }
        guard varT > 1e-6 else { return nil }
        let vx = values.reduce(0) { $0 + ($1.0-mt)*($1.1.x-mx) } / varT
        let vy = values.reduce(0) { $0 + ($1.0-mt)*($1.1.y-my) } / varT
        let residual = sqrt(values.reduce(0) { $0 + pow($1.1.x-mx-vx*($1.0-mt),2)+pow($1.1.y-my-vy*($1.0-mt),2) }/n)
        return TrackResult(vx:vx,vy:vy,residual:residual,span:valid.last!.0-valid.first!.0)
    }
}
