# Putting Lab Native v0.9 — Validation Summary (2026-10-21)

## Tests executed

| Layer | Test | Result | Caveat |
|---|---|---|---|
| Core | Swift Foundation detector XCTest | 9/9 PASS | Synthetic evidence only; Linux Swift 6.2 |
| Video integration | 5 encoded 640×360 @120fps synthetic fixture cases | 5/5 expected classifications | Test-only known-color segmentation used to obtain frame observations |
| Impact offsets | straight 1.50s, push-right 1.65s vs simulated 1.50s | +0ms / +150ms | Not a validated real-world timing accuracy claim |
| False positives | camera shake, occlusion, low-light | all withheld | Cases are synthetic and deliberately limited |
| Native iOS syntax | swiftc -frontend -parse, 7 Swift files | PASS | Does not typecheck SwiftUI/AVFoundation APIs |
| Xcode project | plutil -lint | PASS | Does not prove Xcode build or code signing |
| Clip encoding/export | Actual iPhone AVAssetWriter/AVAssetExportSession | NOT TESTED | Requires macOS Xcode and device |
| Camera format | 1080p240 vs 4K120 on iPhone 17 Pro Max | NOT TESTED | Native AVCaptureDevice format enumeration implemented |
| iPhone thermal and power | sustained session | NOT TESTED | Risk of dropped frames |
| Accuracy | ball speed, club speed, face/path startline vs instrument | NOT TESTED | No physical calibration/reference data |

## Product/engineering strengths

**S1 — Capture control and transparent telemetry.** Unlike Safari, the native code enumerates device camera formats, requests an exact FPS supported by a format, monitors real frame timestamps, and records encoder skips. This establishes auditable capture metadata, though the device must verify delivery.

**S2 — Reviewable, cautious analysis path.** Disk-backed pre-impact recording preserves the original, creates a bounded clip after a candidate, and attaches editable, unverified timing/measurement proposals. Strong synthetic-camera-shake/occlusion rejection prevents premature fitting conclusions.

## Weaknesses to address in the next task

**W1 — Detector is untrained and unvalidated with real footage.** Bright-blob/motion-patch logic can mistake reflections, ball markings, grass and moving hands for club/ball landmarks. It cannot currently provide calibrated face orientation, and target-line-relative path/start direction require user input. Next task: acquire labeled real overhead videos and build a tracked-club/ball segmentation model with independent reference measurements.

**W2 — Production iOS capture performance is unknown.** This release has not been built/signed/run in Xcode or profiled at 1080p240/4K120. Encoder backpressure and timestamped frames might be dropped; the analyzer currently samples up to 60 Hz, which may miss true contact frames. Next task: perform Xcode CI build + 50+ live iPhone trials, profile thermal/latency/FPS, then optimize with hardware-assisted capture and low-overhead CV.
