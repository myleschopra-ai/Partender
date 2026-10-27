import Foundation
import AVFoundation

struct StrokeClip: Identifiable, Codable {
    let id: UUID
    let createdAt: Date
    let videoFilename: String
    let originalFilename: String
    var events: StrokeEvents
    var metrics: [QuantifiedCandidate]
    var ballConfirmed: Bool
    var requestedFPS: Int
    var deliveredFPS: Double
    var width: Int
    var height: Int
    var droppedWriterFrames: Int
    var notes: String

    var videoURL: URL { ClipLibrary.folder.appendingPathComponent(videoFilename) }
    var originalURL: URL { ClipLibrary.folder.appendingPathComponent(originalFilename) }
}

enum ClipLibrary {
    static var folder: URL {
        let folder=FileManager.default.urls(for: .documentDirectory,in:.userDomainMask)[0].appendingPathComponent("PuttingLabClips",isDirectory:true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories:true)
        return folder
    }
    static func save(_ record: StrokeClip) throws {
        let data=try JSONEncoder().encode(record)
        let location=folder.appendingPathComponent(record.id.uuidString+".json")
        try data.write(to:location,options:.atomic)
    }
    static func load() -> [StrokeClip] {
        let files=(try? FileManager.default.contentsOfDirectory(at:folder,includingPropertiesForKeys:nil)) ?? []
        return files.filter{$0.pathExtension=="json"}.compactMap{url in
            guard let data=try? Data(contentsOf:url) else{return nil}
            return try? JSONDecoder().decode(StrokeClip.self,from:data)
        }.sorted{$0.createdAt>$1.createdAt}
    }
}

/// Persistent on-disk recording starts when armed. Every pre-impact frame is retained in the source
/// file; once a candidate finishes, this exporter also produces a *physically trimmed* .mov clip.
/// It avoids retaining three seconds of uncompressed 4K/120fps frames in RAM.
final class RollingCaptureWriter {
    private var writer: AVAssetWriter?
    private var videoInput: AVAssetWriterInput?
    private(set) var startedAt: CMTime?
    private(set) var originalURL: URL?
    private(set) var skipped = 0
    private(set) var appended = 0
    private var lastPTS = CMTime.invalid

    func begin(at sample: CMSampleBuffer, width: Int, height: Int) throws {
        guard writer == nil else { return }
        let url=ClipLibrary.folder.appendingPathComponent("original-\(UUID().uuidString).mov")
        let asset=try AVAssetWriter(outputURL:url,fileType:.mov)
        let bitrate=min(45_000_000,max(10_000_000,Int(Double(width*height)*5.0)))
        let input=AVAssetWriterInput(mediaType:.video,outputSettings:[
            AVVideoCodecKey: AVVideoCodecType.hevc,
            AVVideoWidthKey: width,AVVideoHeightKey:height,
            AVVideoCompressionPropertiesKey:[AVVideoAverageBitRateKey:bitrate]
        ])
        input.expectsMediaDataInRealTime=true
        guard asset.canAdd(input) else { throw NSError(domain:"PuttingLabWriter",code:1,userInfo:[NSLocalizedDescriptionKey:"Unsupported video encoder format"])}
        asset.add(input)
        guard asset.startWriting() else { throw asset.error ?? NSError(domain:"PuttingLabWriter",code:2) }
        let start=CMSampleBufferGetPresentationTimeStamp(sample)
        asset.startSession(atSourceTime:start)
        startedAt=start;originalURL=url;writer=asset;videoInput=input;skipped=0;appended=0;lastPTS = .invalid
        append(sample)
    }
    func append(_ sample: CMSampleBuffer) {
        guard let writer,writer.status == .writing,let input=videoInput else{return}
        let pts=CMSampleBufferGetPresentationTimeStamp(sample)
        guard !lastPTS.isValid || CMTimeCompare(pts,lastPTS)>0 else {skipped+=1;return}
        if input.isReadyForMoreMediaData && input.append(sample) {appended+=1;lastPTS=pts}
        else {skipped+=1}
    }
    func finish(_ completion: @escaping (URL?,Error?) -> Void) {
        guard let writer,let input=videoInput else {completion(nil,nil);return}
        let source=originalURL
        input.markAsFinished()
        writer.finishWriting { [weak self] in
            let result=writer.status == .completed ? source:nil
            let error=writer.status == .completed ? nil:writer.error
            self?.videoInput=nil;self?.writer=nil;self?.startedAt=nil
            completion(result,error)
        }
    }
    static func exportClip(original: URL, from start: Double,to end: Double,completion:@escaping(URL?,Error?)->Void) {
        let asset=AVURLAsset(url:original)
        guard let exp=AVAssetExportSession(asset:asset,presetName:AVAssetExportPresetPassthrough) else {
            completion(nil,NSError(domain:"PuttingLabExport",code:3,userInfo:[NSLocalizedDescriptionKey:"Pass-through export unavailable"]));return
        }
        let target=ClipLibrary.folder.appendingPathComponent("stroke-\(UUID().uuidString).mov")
        exp.outputURL=target;exp.outputFileType = .mov
        let begin=CMTime(seconds:max(0,start),preferredTimescale:600)
        exp.timeRange=CMTimeRange(start:begin,duration:CMTime(seconds:max(0.10,end-start),preferredTimescale:600))
        exp.exportAsynchronously {
            completion(exp.status == .completed ? target:nil,exp.error)
        }
    }
}
