# Putting Lab v0.7 — Auto Mark + Auto Clip

**Release scope:** overhead video uploads and recorded live-camera strokes.

## User-facing changes

- Automatically proposes four time-coded phases from supported overhead strokes: **Start (first sustained local motion), Transition (possible reversal), Impact (ball departure candidate), Follow-through (last observed local activity)**. These are estimates, not instrument-grade impact measurements.
- Draws a labeled proposed ball center and motion-position indicators on the video. Colored on-video reference dots represent activity seen at DIFFERENT timestamps; they are not simultaneous clubhead positions.
- Places interactive phase chips and color-coded timeline ticks immediately beneath the video/scrubber. Tap to inspect; step frames; correct selected marker at the visible frame; confirm proposals. Unidentifiable phases remain explicitly **Needs review**.
- Builds a **virtual stroke clip** with padding around detected movement, preserves full footage, and constrains playback/scrubbing to that window. Switch back to the original take at any time.
- Adds **Export trimmed clip (beta)** using Canvas capture + MediaRecorder when supported. It creates a new silent re-encoded video file; unsupported browsers retain virtual clip review. In Chromium simulation a 2.21-second MP4 was created from a 2.6-second synthetic source and probed with ffprobe.
- Uses the same phase refinement after a **live impact-candidate recording** loads into review mode, based on the initially selected ball center and candidate event time.
- Existing editing protections remain: Review mode cannot create phantom points, and point movement requires explicit Edit mode.

## Validation (synthetic browser tests, not real-device validation)

- Straight stroke and push-right: **4 phase suggestions** (provisional) and an automatic clipped review window each.
- Camera shake / ball occlusion / low light: no unsupported impact or four-phase clip generated.
- Verified: automatic upload analysis; zero phase timestamps committed until user confirmation; phase selection/seek/correction/confirmation; bounded clip toggle; cleared proposal state on new upload; no touch-gesture pins; 390 px mobile layout without overflow; simulated live-camera-to-review workflow; silent MP4 export in Chromium.
- No uncaught JS errors in completed browser tests; standalone `<script>` blocks passed `node --check`.

## What remains unresolved

- Phase onset, reversal and follow-through are **low-confidence heuristics**; do not use them for professional fitting or coaching until verified against reference video/hardware.
- No measured face-to-target angle, launch direction, ball speed, vertical dynamics, or reconstructed 3D.
- Actual iPhone 17 Pro Max Safari camera, capture frame rate, export format support, device memory and end-to-end five-second latency require physical validation.
- Exported clips are silent and re-encoded, so output quality/format can differ from the source. The full original source remains available for review.

## Deploy

Production-connected branch: `feature/putting-lab-v0.4`; Cloudflare Worker: `partendinglab`; root: `putting-lab`; Wrangler assets directory `./public`. The name of the branch is historical and is deliberately retained to preserve Cloudflare production settings.

Back up the current release or use Cloudflare deployment rollback if needed.