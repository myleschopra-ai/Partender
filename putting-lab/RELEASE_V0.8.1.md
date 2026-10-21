# Putting Lab v0.8.1 — Adaptive high-speed overhead camera

## Behavior
- In **Live Auto-Detection**, the rear camera now requests **3840×2160 at 120 fps** and attempts exact high-speed/resolution combinations before falling back.
- User-selectable preferences: Best for Impact (prefer 4K120), Highest Frame Rate (prefer 1080p240), Highest Resolution (prefer 4K), and Compatible (prefer 1080p60).
- The UI shows actual camera-stream settings from `MediaStreamTrack.getSettings()` instead of presenting the requested settings as achieved.
- The camera can be rechecked after opening; quality changes during recording are blocked.
- Upload analysis stays distinct and overhead remains its default camera profile.

## Critical limitations
- The native iPhone 17 Pro Max Camera app supports 4K120 Dolby Vision; 4K120 **ProRes** requires approved external USB-C recording storage. Adding an external drive does not unlock Safari's restricted camera modes.
- Browser `getUserMedia()` capabilities may differ from the native Camera app, and `MediaRecorder` may encode fewer frames than the requested/live-stream FPS. The reported track FPS is not measured output-clip FPS.
- The live experimental detector samples at approximately 14 Hz, upload analysis approximately 18 Hz. A 120-fps requested source does not, by itself, produce 120-fps impact detection.
- For reliable 4K120 or 1080p240 source footage, record using the native Camera app and import into Video Upload Analysis. Sustained high-fps live instrument capture will require an AVFoundation-based iPhone companion in a future version.
- Real-device Safari mode negotiation and recorded FPS are not validated yet.

## Testing
- JavaScript syntax validation passed.
- Controlled browser tests passed for 4K120, 1080p120, 720p30, 1080p240, 4K60, 1080p60, capabilities-limited 1080p30, and older Safari mode without `applyConstraints()`.
- Existing overhead-upload and live/upload workspace regression tests passed.
- Mobile 390px wide layout had no horizontal overflow; no uncaught JS errors in test flows.
- Tests used simulated media tracks, NOT native iPhone output.

## Delivery
- Repository: `myleschopra-ai/Partender`
- Cloudflare-connected branch: `feature/putting-lab-v0.4`
- Worker: `partendinglab`; project root: `putting-lab`
- Rollout to production must be confirmed via Cloudflare Deployments.
