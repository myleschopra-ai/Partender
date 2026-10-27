# Putting Lab v1 preview — camera-first video and temporal detector

**Status:** development branch only. Not deployed to Cloudflare production.

## Implemented

- Full-viewport browser camera feed, overlaid live controls for Camera, Set ball, Arm, Stop, and Settings. Settings are in a floating drawer.
- The review overlay retains the actual clip and provides scrub, play, frame stepping, impact correction, next stroke, and marker Move/Add/Review over the video.
- Live detector changed from a static brightness patch to the new `temporal-detector.js`, using a stable ball reference, background subtraction, local putter movement, a tracked moving ball after departure, and camera-shake checks. Other stationary white objects are rejected using their lack of change from the reference frame.
- Analysis width increased from 192 to 320 pixels; live attempts a ~30Hz processing ceiling via `requestVideoFrameCallback` when supported. The imported-video second pass can analyze up to ~24Hz.

## Verified

- 7/7 controlled synthetic motion/detection scenarios pass (straight, push-right, slow putt, stationary, occlusion, dim lighting, camera shake).
- JavaScript and inline HTML scripts parse; published and source asset manifests match.
- Chromium portrait and landscape UI smoke tests pass. Encoded WebM imported to video review; timeline, marker editing, and full-video layouts exercised.
- Screenshots: https://github.com/myleschopra-ai/Partender/actions/runs/40584468332/artifacts/12770374897
- CI: https://github.com/myleschopra-ai/Partender/actions/runs/40584468332

## Not validated

The supplied recording shows the app interface, **not source-resolution clean overhead ball/club footage**, so it cannot establish real detection accuracy. The synthetic tests do not prove performance on iPhone Safari, impact precision, high-speed frame delivery, putter-face orientation, physical speed or sub-five-second latency. Measurements remain proposals requiring review. Safari's browser chrome may remain visible, as this is immersive HTML rather than native OS fullscreen.

## Next gate

Test 50+ original iPhone overhead strokes, including distractors, variable light, putter shapes, and different launch directions. Annotate independent impact frames and ball trajectories; measure recall, false triggers, timing error, clip latency and device FPS. Replace low-resolution threshold blobs with high-resolution ROI segmentation and multi-frame optical flow where real footage shows misses. **Do not advertise near-perfect measurements without benchmark data.**
