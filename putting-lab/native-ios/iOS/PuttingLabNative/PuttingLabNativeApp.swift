import SwiftUI

@main
struct PuttingLabNativeApp: App {
    @StateObject private var camera=CaptureController()
    var body: some Scene {
        WindowGroup {
            TabView {
                LiveCaptureScreen(controller:camera)
                    .tabItem { Label("Live Overhead",systemImage:"camera.viewfinder") }
                ClipLibraryScreen(controller:camera)
                    .tabItem { Label("Saved Strokes",systemImage:"video.stack") }
            }
            .tint(Color(red:0.56,green:0.85,blue:0.46))
        }
    }
}
