# Putting Lab v0.9 — Native iPhone Overhead Capture (Engineering Beta)

**This is an Xcode iOS application, not a Cloudflare deployment or an installable signed IPA.**
The existing `partendinglab.myleschopra.workers.dev` remains the separate Web Upload and Analysis dashboard.

## Open the app on an iPhone

1. Use **macOS with current Xcode**. Open `iOS/PuttingLabNative.xcodeproj`.
2. Choose the `PuttingLabNative` app target and select your Apple development team under Signing & Capabilities. Set a unique bundle ID if necessary.
3. Connect an iPhone 17 Pro Max, enable Developer Mode on iOS if requested, and build/run on the actual device. Grant camera access.
4. Mount the iPhone with the **rear wide camera directly above** a visible ball and putter. Keep it still with consistent light. The green `BALL ACQUIRED · READY` cue requires an approximately 0.37-second stable-ball baseline in the detector.
5. Select **Impact 1080p / 240 fps** or **Geometry 4K / 120 fps**, tap `Apply camera mode`, then `Arm automatic stroke capture`. The interface shows selected format and **observed frame delivery rate separately**.
6. Make one stroke. A candidate based on putter motion followed by ball departure causes recording to stop ~1.1 seconds later. An on-device `.mov` clip is physically exported, and the full source is retained.
7. Inspect the detected ball circle and proposed phase markers. Step ±1 frame, correct a marker and **confirm each measurement** before saving. Unsupported measurements remain unavailable.
8. Use the **Saved Strokes** tab to review clips and share their local `.mov` files. No footage is automatically sent to Cloudflare.

## Native implementation

- `AVCaptureDevice` format enumeration and exact frame duration. The code **prefers 1080p/240 fps** for impact timing, then can switch to 4K/120 fps for more pixel detail. Camera mode compatibility is determined from the device's advertised formats; actual frame cadence is measured from `CMSampleBuffer` timestamps.
- `AVCaptureVideoDataOutput` feeds a serial high-priority queue. The analyzer samples up to ~60 fps, while the original stream is offered to an `AVAssetWriter` HEVC encoder at the camera's delivered cadence. Writer drop counts are recorded. This is **not** 240-fps analysis.
- A **disk-backed recording spool** starts on arming. It avoids keeping multiple seconds of raw 4K frames in RAM and retains all pre-impact frames, at the expense of recording a full source clip before trimming. Maximum armed session: 25 seconds.
- Automatically proposes **ball center, initial movement, reversal (if visible), ball-departure impact candidate, follow-through (if observed)**, then physically trims a `.mov` review clip without deleting the original. A candidate is not instrument-verified contact time.
- **Ball speed and putter speed** are candidates only when enough tracked frames and an automatically estimated ball diameter pass regression gates. A user-confirmed target line is required before reporting path/start-line deviation. Face angle stays **unavailable**, because tracking one moving putter landmark cannot determine orientation.
- Local JSON sidecars preserve source names, candidate status, frame timestamps, metric provenance, and user confirmations. Footage stays on-device.

## Validated on this development environment

- `swift test` on Linux: **9/9** deterministic stroke-core tests pass.
- Five **encoded 120-fps synthetic videos**, analyzed using a test-only color-segmentation observation extractor, then passed to the real Swift detector: **5/5 expected scenario classifications**; two putts flagged, shake/occlusion/low light withheld. Synthetic candidate impacts: 1.50 s and 1.65 s against simulated impact 1.50 s.
- All iOS Swift sources pass Swift parser syntax checks; Xcode `.pbxproj` passes `plutil -lint`.
- NOT validated: iOS SDK **typechecking/compilation**, live camera capture, format support, HEVC recording throughput, video export on the iPhone, device temperature, end-to-end latency, or physical measurement accuracy. This environment has no macOS/Xcode/iPhone.

## Key caveats

1. **The image detector is heuristic.** It looks for a compact bright ball and nearby moving pixels; the putter estimate may reflect grass, shadows or other moving objects. It is not a trained, independently validated putter-face detector. You must review proposals before coaching/fitting use.
2. **High-fps recording is not necessarily high-fps inference.** Analyze at <=60 samples/s and record every delivered frame if the HEVC writer keeps up. Check recorded dropped-frame count and observed actual fps. For stable 240-fps impact precision, optimize the detector and storage and benchmark with reference instrumentation.
3. **Not a full 3D launch monitor.** One overhead camera cannot measure vertical launch, forward spin, or skid reliably. Face rotation requires better vision and geometry calibration. No fabricated numbers appear.
4. **iOS orientation and overlay alignment** need physical-device verification. The review circle uses image coordinates and may require correction on different mount orientations.
5. Clip export uses pass-through trimming, which may start/end on nearby encoded frames rather than exact sub-frame boundaries. Measured FPS reflects capture timestamp rate, not exact frames successfully encoded.

## Testing commands

From `Core/`:

```bash
swift test
swift run EncodedVideoTrial ../tests/generated/*.json > ../tests/video_trial_results.jsonl
python ../tests/check_video_results.py
```

Regenerate evidence on systems with OpenCV and NumPy:

```bash
python tests/extract_trial_evidence.py
```

Native app syntax check from release root on Linux: `swiftc -frontend -parse iOS/PuttingLabNative/*.swift`.

## Development priorities

1. **Real-device metrology tests** with an iPhone 17 Pro Max fixed overhead, stable alignment target, and reference launch monitor. Measure capture FPS, encoder skips, thermal dropouts, impact-offset distribution and first-review latency over at least 50 strokes.
2. **Train/validate dedicated ball and putter-head/face segmentation**, stabilize the camera image, add a calibrated target line and automatic confidence-aware face/path metrics. A manual confirmation interface should never turn a low-quality guess into accurate data.

The Xcode project is generated by `tools/generate_xcodeproj.py`; iOS app core is the same file as `Core/Sources/PuttingStrokeCore/StrokeCore.swift` (keep in sync when editing).
