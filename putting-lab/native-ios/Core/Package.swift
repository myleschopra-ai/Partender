// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "PuttingStrokeCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "PuttingStrokeCore", targets: ["PuttingStrokeCore"]),
        .executable(name: "EncodedVideoTrial", targets: ["EncodedVideoTrial"])],
    targets: [
        .target(name: "PuttingStrokeCore"),
        .executableTarget(name: "EncodedVideoTrial", dependencies: ["PuttingStrokeCore"], ),
        .testTarget(name: "PuttingStrokeCoreTests", dependencies: ["PuttingStrokeCore"])
    ]
)
