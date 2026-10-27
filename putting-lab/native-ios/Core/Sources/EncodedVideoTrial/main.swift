import Foundation
import PuttingStrokeCore

struct Trial: Codable {var scenario:String;var frames:[FrameEvidence]}
struct Result: Codable {var scenario:String;var frames:Int;var impact:Double?;var start:Double?;var transition:Double?;var verdict:String;var metrics:[QuantifiedCandidate]}
let fm=FileManager.default
let paths=CommandLine.arguments.dropFirst()
for filename in paths {
 let input=try JSONDecoder().decode(Trial.self,from:Data(contentsOf:URL(fileURLWithPath:filename)))
 let detector=StrokeEventDetector()
 for f in input.frames { _ = detector.consume(f) }
 let c=detector.candidate
 let metrics=c.map{MetricProposals.calculate(detector.observations,impact:$0.impact.time,width:640,height:360)} ?? []
 let res=Result(scenario:input.scenario,frames:input.frames.count,impact:c?.impact.time,start:c?.start?.time,transition:c?.transition?.time,verdict:c == nil ? "WITHHELD":"CANDIDATE (human review required)",metrics:metrics)
 let encoder=JSONEncoder();encoder.outputFormatting=[.sortedKeys]
 print(String(data:try encoder.encode(res),encoding:.utf8)!)
}
