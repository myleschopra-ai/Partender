import SwiftUI
import AVFoundation

struct LiveCameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    final class PreviewView: UIView {
        override static var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var videoLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
    }
    func makeUIView(context: Context) -> PreviewView {
        let view=PreviewView();view.backgroundColor = .black
        view.videoLayer.session=session
        view.videoLayer.videoGravity = .resizeAspect
        return view
    }
    func updateUIView(_ view: PreviewView, context: Context) {
        if view.videoLayer.session !== session {view.videoLayer.session=session}
    }
}

struct LiveCaptureScreen: View {
    @ObservedObject var controller: CaptureController
    @State private var mode=VideoMode.preferred[0]
    @State private var confirmation=false
    @State private var showCameraGuide=false

    var body:some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:14){
                    #if targetEnvironment(simulator)
                    VStack(alignment: .leading, spacing: 7) {
                        Label("VIRTUAL iPHONE — NO CAMERA HARDWARE", systemImage: "iphone.gen3.radiowaves.left.and.right")
                            .font(.subheadline.bold())
                        Text("The iOS Simulator can validate SwiftUI, frame analysis and stroke decisions, but cannot validate physical camera modes or actual capture.")
                            .font(.caption)
                        Button("Run synthetic overhead tests", systemImage: "checkmark.circle") {
                            controller.runSimulatorDiagnostics()
                        }.buttonStyle(.borderedProminent)
                        if let summary = controller.simulatorSummary {
                            Text(summary)
                                .font(.caption.bold())
                                .foregroundStyle(controller.simulatorReportPassed == false ? .red : .primary)
                                .accessibilityIdentifier("simulatorReportSummary")
                        }
                    }.padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.yellow.opacity(0.14))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    #endif
                    Text("Native overhead detection").font(.title2.bold())
                    Text("Fixed iPhone · automatically clip a stroke · verify the suggested impact")
                        .foregroundStyle(.secondary).font(.footnote)
                    ZStack {
                        LiveCameraPreview(session:controller.session)
                            .frame(maxWidth:.infinity).frame(height:325)
                            .background(Color.black)
                            .clipShape(RoundedRectangle(cornerRadius:16))
                        // Alignment guide only. It does NOT imply automatically located ball coordinates.
                        Circle().stroke(.white.opacity(0.4),style:StrokeStyle(lineWidth:1,dash:[6,7]))
                            .frame(width:72,height:72)
                        VStack {
                            HStack {
                                Label(controller.isArmed ? "RECORDING" : "CAMERA",systemImage:"record.circle")
                                    .font(.caption.bold()).padding(7).background(.black.opacity(0.75)).clipShape(Capsule())
                                Spacer()
                            }
                            Spacer()
                            Text("Position ball and putter in frame. Keep phone completely still.")
                                .font(.caption).padding(7).background(.black.opacity(0.75)).clipShape(RoundedRectangle(cornerRadius:8))
                        }.padding(12).foregroundStyle(.white)
                    }
                    VStack(alignment:.leading,spacing:5){
                        HStack {
                            Circle().fill(controller.isDetectionReady ? Color.green : Color.yellow).frame(width:11,height:11)
                            Text(controller.isDetectionReady ? "BALL ACQUIRED · READY" : "SEARCHING FOR STABLE BALL")
                                .font(.caption.bold())
                        }
                        Text(controller.status).font(.headline)
                        Text(controller.confidenceMessage).font(.caption).foregroundStyle(.secondary)
                        HStack{
                            Text("Selected format: \(controller.deviceMode)")
                            Spacer()
                        }.font(.caption2)
                        Text("Observed delivered rate: \(controller.measuredFPS)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Picker("Capture mode",selection:$mode){
                        Text("Impact 1080p / 240 fps").tag(VideoMode.preferred[0])
                        Text("Geometry 4K / 120 fps").tag(VideoMode.preferred[1])
                        Text("1080p / 120 fps").tag(VideoMode.preferred[2])
                        Text("1080p / 60 fps").tag(VideoMode.preferred[3])
                    }
                    .pickerStyle(.menu)
                    .disabled(controller.isArmed)
                    HStack(spacing:9){
                        Button("Apply camera mode",systemImage:"gearshape") {controller.start(mode:mode)}
                            .buttonStyle(.bordered).disabled(controller.isArmed)
                        Button("Setup guide",systemImage:"questionmark.circle") {showCameraGuide=true}
                            .buttonStyle(.bordered)
                    }
                    if controller.isArmed {
                        Button("Stop recording",systemImage:"stop.circle.fill") {controller.stop()}
                            .buttonStyle(.borderedProminent).tint(.red).frame(maxWidth:.infinity)
                    } else {
                        Button("Arm automatic stroke capture",systemImage:"record.circle") {controller.arm()}
                            .buttonStyle(.borderedProminent).disabled(!controller.isCameraReady || controller.isFinalizing)
                            .frame(maxWidth:.infinity)
                    }
                    if controller.isFinalizing {ProgressView("Saving and trimming stroke…")}
                    VStack(alignment:.leading,spacing:7){
                        Text("Automatic analysis").font(.headline)
                        Label("Identifies probable ball departure after nearby moving-putter evidence",systemImage:"checkmark.circle")
                        Label("Keeps the full recording and exports a shorter review clip",systemImage:"film.stack")
                        Label("Suggests start, reversal, impact, and follow-through when observable",systemImage:"timeline.selection")
                        Text("All markers and metric values are unverified proposals. Face orientation cannot be inferred from a moving-patch center alone.")
                            .foregroundStyle(.secondary)
                    }.font(.caption).padding(12).background(Color.secondary.opacity(0.12)).clipShape(RoundedRectangle(cornerRadius:12))
                    Text("Recording automatically stops 1.1 seconds after a detected candidate or after 25 seconds. No server upload occurs; everything stays in this phone's Documents folder.")
                        .font(.caption2).foregroundStyle(.secondary)
                }.padding()
            }
            .navigationTitle("Putting Lab")
            .onAppear {
                #if targetEnvironment(simulator)
                controller.status = "Simulator-only demo — real camera unavailable"
                if ProcessInfo.processInfo.arguments.contains("-PuttingLabSyntheticTest") {
                    controller.runSimulatorDiagnostics()
                }
                #else
                if !controller.isCameraReady && !controller.isArmed {
                    controller.start(mode: mode)
                }
                #endif
            }
            .sheet(item:$controller.review){ReviewClipScreen(controller:controller,original:$0)}
            .alert("Capture issue",isPresented:Binding(get:{controller.errorMessage != nil},set:{if !$0 {controller.errorMessage=nil}})) {
                Button("OK") {controller.errorMessage=nil}
            }message:{Text(controller.errorMessage ?? "Unknown camera error")}
            .alert("Overhead setup",isPresented:$showCameraGuide){Button("Got it",role:.cancel){} }message:{
                Text("Mount the rear camera over a contrasting golf ball and visible putter head. Keep the target line vertical in the image when possible. Bright, stable lighting matters more than maximum resolution. Native camera settings are requested explicitly, but actual delivered FPS is measured from frame timestamps.")
            }
        }
    }
}
