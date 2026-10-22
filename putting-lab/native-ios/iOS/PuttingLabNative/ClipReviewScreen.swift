import SwiftUI
import AVKit

struct ClipLibraryScreen: View {
    @ObservedObject var controller: CaptureController
    @State private var selected: StrokeClip?
    var body:some View {
        NavigationStack {
            List(controller.clips){clip in
                Button {selected=clip} label: {
                    VStack(alignment:.leading,spacing:4){
                        Text(clip.createdAt,style:.date).font(.headline)
                        Text("Candidate at \(String(format:"%.3f",clip.events.impact.time)) seconds")
                        Text("\(clip.width)×\(clip.height) · \(String(format:"%.1f",clip.deliveredFPS)) fps observed · \(clip.droppedWriterFrames) writer skips")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .overlay {if controller.clips.isEmpty {ContentUnavailableView("No saved strokes",systemImage:"video",description:Text("Arm live overhead capture to create your first candidate clip."))}}
            .navigationTitle("Saved Strokes")
            .toolbar{Button("Refresh",systemImage:"arrow.clockwise"){controller.reloadClips()}}
            .sheet(item:$selected){ReviewClipScreen(controller:controller,original:$0)}
        }
    }
}

struct ReviewClipScreen: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var controller:CaptureController
    let original: StrokeClip
    @State private var edited:StrokeClip
    @State private var playhead:Double
    @State private var activePhase=0
    @State private var adjustBall=false
    @State private var player:AVPlayer
    private let names=["Start","Transition","Impact","Follow-through"]

    init(controller:CaptureController,original:StrokeClip) {
        self.controller=controller;self.original=original
        _edited=State(initialValue:original)
        _playhead=State(initialValue:original.events.impact.time)
        _player=State(initialValue:AVPlayer(url:original.videoURL))
    }
    private var maxTime:Double {max(0.5,edited.events.clipEnd)}
    private func marker(_ index:Int)->EventMarker? {
        switch index {case 0:return edited.events.start;case 1:return edited.events.transition;case 2:return edited.events.impact;default:return edited.events.followThrough}
    }
    private func setMarker(_ index:Int,_ marker:EventMarker?){
        switch index {case 0:edited.events.start=marker;case 1:edited.events.transition=marker
        case 2:if let marker {edited.events.impact=marker}
        default:edited.events.followThrough=marker}
    }
    var body:some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:12){
                    GeometryReader { geometry in
                        ZStack {
                            VideoPlayer(player:player)
                            let px=Double(geometry.size.width),py=Double(geometry.size.height)
                            let scale=min(px/Double(max(1,edited.width)),py/Double(max(1,edited.height)))
                            let offsetX=(px-Double(edited.width)*scale)/2
                            let offsetY=(py-Double(edited.height)*scale)/2
                            Circle().stroke(edited.ballConfirmed ? Color.green : Color.yellow,lineWidth:3)
                                .frame(width:25,height:25)
                                .position(x:offsetX+edited.events.ballAtAddress.x*scale,y:offsetY+edited.events.ballAtAddress.y*scale)
                                .allowsHitTesting(adjustBall)
                                .gesture(DragGesture(minimumDistance:4,coordinateSpace:.named("videoFrame")).onChanged { gesture in
                                    guard adjustBall else{return}
                                    edited.events.ballAtAddress=ImagePoint(
                                        max(0,min(Double(edited.width),(Double(gesture.location.x)-offsetX)/scale)),
                                        max(0,min(Double(edited.height),(Double(gesture.location.y)-offsetY)/scale)))
                                    edited.ballConfirmed=false
                                    // Adjusting a calibration landmark invalidates previous speed proposals.
                                    for i in edited.metrics.indices where edited.metrics[i].label.contains("speed") {
                                        edited.metrics[i].status=nil
                                        edited.metrics[i].value=nil
                                    }
                                })
                        }.coordinateSpace(name:"videoFrame").clipShape(RoundedRectangle(cornerRadius:12))
                    }.frame(height:245)
                    HStack {
                        Button(adjustBall ? "Finish ball adjustment" : "Adjust ball circle") {adjustBall.toggle()}
                            .buttonStyle(.bordered)
                        Button(edited.ballConfirmed ? "Ball confirmed" : "Confirm ball") {edited.ballConfirmed=true;adjustBall=false}
                            .buttonStyle(.borderedProminent)
                    }.font(.caption)
                    Text("Ball circle is a PROPOSAL on the original video coordinate system. Confirm or adjust it; camera orientation may require device-specific calibration.")
                        .font(.caption2).foregroundStyle(.secondary)
                    Text("Automatic event markers — PROPOSED until confirmed")
                        .font(.headline)
                    HStack(spacing:6){
                        ForEach(0..<names.count,id:\.self){i in
                            Button{
                                activePhase=i
                                if let phase=marker(i){playhead=phase.time;player.seek(to:CMTime(seconds:playhead,preferredTimescale:600),toleranceBefore:.zero,toleranceAfter:.zero)}
                            }label:{
                                VStack(spacing:3){
                                    Text(names[i]).font(.caption2)
                                    Text(marker(i).map{String(format:"%.2fs",$0.time)} ?? "—")
                                        .font(.caption2.monospacedDigit())
                                    Image(systemName:marker(i)?.status == .confirmed ? "checkmark.seal.fill" : "circle.dashed")
                                }.padding(7).frame(maxWidth:.infinity)
                                    .background(activePhase==i ? Color.green.opacity(0.28):Color.secondary.opacity(0.13))
                                    .clipShape(RoundedRectangle(cornerRadius:9))
                            }.buttonStyle(.plain)
                        }
                    }
                    HStack{Text("Selected: \(names[activePhase])").font(.subheadline.bold());Spacer();Text(String(format:"%.3fs",playhead)).monospacedDigit()}
                    Slider(value:$playhead,in:0...maxTime,step:1.0/240.0){isEditing in
                        if !isEditing {player.pause();player.seek(to:CMTime(seconds:playhead,preferredTimescale:600),toleranceBefore:.zero,toleranceAfter:.zero)}
                    }
                    HStack{
                        Button("−1 frame") {nudge(-1)}.buttonStyle(.bordered)
                        Spacer()
                        Button("Set selected here") {setMarker(activePhase,EventMarker(time:playhead,confidence:1))}.buttonStyle(.bordered)
                        Spacer()
                        Button("+1 frame") {nudge(1)}.buttonStyle(.bordered)
                    }.font(.caption)
                    Button("Confirm selected marker",systemImage:"checkmark.seal") {
                        if var m=marker(activePhase){m.status = .confirmed;setMarker(activePhase,m)}
                    }.buttonStyle(.borderedProminent).disabled(marker(activePhase)==nil)
                    Divider()
                    Text("Image-space measurement proposals").font(.headline)
                    ForEach(edited.metrics.indices,id:\.self){i in
                        HStack(alignment:.top){
                            VStack(alignment:.leading,spacing:4){
                                Text(edited.metrics[i].label).font(.subheadline.bold())
                                Text(edited.metrics[i].explanation).font(.caption2).foregroundStyle(.secondary)
                            }
                            Spacer(minLength:6)
                            VStack(alignment:.trailing,spacing:4){
                                Text(edited.metrics[i].value.map{String(format:"%.2f",$0)+" "+edited.metrics[i].units} ?? "NOT MEASURABLE")
                                    .font(.caption.bold()).multilineTextAlignment(.trailing)
                                if edited.metrics[i].value != nil {
                                    Button(edited.metrics[i].status == .confirmed ? "✓ Confirmed" : "Confirm") {
                                        edited.metrics[i].status = .confirmed
                                    }
                                    .buttonStyle(.bordered).font(.caption2)
                                }
                            }
                        }.padding(.vertical,5)
                    }
                    Text("No numerical face measurement is generated until a credible clubface edge detector is validated. Physical speed estimates rely on observed ball diameter and high-confidence tracks; they are NOT launch-monitor certified.")
                        .font(.caption2).foregroundStyle(.secondary)
                    HStack{
                        Button("Save reviewed markers",systemImage:"square.and.arrow.down"){
                            do{try ClipLibrary.save(edited);controller.reloadClips();dismiss()}
                            catch{controller.errorMessage=error.localizedDescription}
                        }.buttonStyle(.borderedProminent)
                        ShareLink(item:edited.videoURL){Label("Share clipped video",systemImage:"square.and.arrow.up")}.buttonStyle(.bordered)
                    }
                    Text("Original recording is retained separately. Clip boundaries are a proposed stroke window; physical trimming may start/end at nearby encoded frames.")
                        .font(.caption2).foregroundStyle(.secondary)
                }.padding()
            }
            .navigationTitle("Verify Stroke")
            .toolbar{ToolbarItem(placement:.topBarTrailing){Button("Done"){dismiss()}}}
            .onDisappear{player.pause()}
        }
    }
    private func nudge(_ dir:Int){
        playhead=min(max(0,playhead+Double(dir)/Double(max(1,original.requestedFPS))),maxTime)
        player.pause();player.seek(to:CMTime(seconds:playhead,preferredTimescale:600),toleranceBefore:.zero,toleranceAfter:.zero)
    }
}
