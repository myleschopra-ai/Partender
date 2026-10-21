import XCTest
@testable import PuttingStrokeCore

final class StrokeCoreTests: XCTestCase {
    private func runScenario(cameraShake: Bool = false, departure: Bool = true, approach: Bool = true, occlude: Bool = false) -> StrokeEventDetector {
        let detector = StrokeEventDetector()
        for i in 0..<140 {
            let t=Double(i)/60
            let putter:ImagePoint? = approach ? ImagePoint(95+Double(min(i,95))*0.60, 95) : nil
            let ball:ImagePoint? = occlude && i >= 88 ? nil : ImagePoint(i < 90 || !departure ? 150 : 150+Double(i-89)*1.7, 95)
            let obs=FrameEvidence(time:t,ball:ball,putter:putter,ballDiameterPixels:10,
                                  cameraMotion: cameraShake && i > 70 ? 0.4 : 0.01,
                                  ballConfidence:0.95,putterConfidence:0.9)
            _ = detector.consume(obs)
        }
        return detector
    }
    func testClearImpactProducesUnverifiedClip() {
        let r=runScenario()
        XCTAssertNotNil(r.candidate)
        XCTAssertEqual(r.candidate?.impact.status,.proposed)
        XCTAssertTrue((r.candidate?.clipStart ?? -1) < (r.candidate?.impact.time ?? -1))
        XCTAssertTrue((r.candidate?.clipEnd ?? 0) > (r.candidate?.impact.time ?? 0))
    }
    func testNoDepartureDoesNotTrigger() { XCTAssertNil(runScenario(departure:false).candidate) }
    func testNoPutterDoesNotTrigger() { XCTAssertNil(runScenario(approach:false).candidate) }
    func testCameraShakeDoesNotTrigger() { XCTAssertNil(runScenario(cameraShake:true).candidate) }
    func testOcclusionDoesNotTrigger() { XCTAssertNil(runScenario(occlude:true).candidate) }
    func testRearmResetsState() { let d=runScenario(); XCTAssertNotNil(d.candidate); d.reset(); XCTAssertNil(d.candidate); XCTAssertEqual(d.observations.count,0) }
    func testNoUnsupportedFaceAngleClaim() {
        let r=runScenario()
        let m=MetricProposals.calculate(r.observations,impact:r.candidate?.impact.time ?? 1.5,width:1920,height:1080)
        XCTAssertNil(m.first(where:{$0.label=="Face angle"})?.value)
        XCTAssertNil(m.first(where:{$0.label=="Start-line deviation"})?.value)
    }
    func testBallSpeedRequiresValidMeasuredData() {
        let r=runScenario()
        let m=MetricProposals.calculate(r.observations,impact:r.candidate?.impact.time ?? 1.5,width:1920,height:1080)
        XCTAssertNotNil(m.first(where:{$0.label=="Ball speed"})?.value)
        let insufficient=MetricProposals.calculate([],impact:0,width:1920,height:1080)
        XCTAssertNil(insufficient.first(where:{$0.label=="Ball speed"})?.value)
    }
    func testNonMonotonicFramesIgnored() {
        let d=StrokeEventDetector();d.consume(.init(time:1,ball:.init(1,1),putter:nil,ballDiameterPixels:10));d.consume(.init(time:0.8,ball:.init(90,90),putter:nil,ballDiameterPixels:10));XCTAssertEqual(d.observations.count,1)
    }
}
