# Putting Lab v0.6 — Auto-first overhead stroke review

Production-connected branch: `feature/putting-lab-v0.4`
Cloudflare Worker: `partendinglab`; build root: `putting-lab`; Wrangler config: `putting-lab/wrangler.jsonc`.

## What changed
- Short imported overhead videos (up to 12 seconds) are automatically scanned for a stationary, visually recognizable ball and a probable ball departure after nearby putter motion.
- Proposed ball and impact markers are **not committed silently**. The user can inspect the candidate frame, adjust using video controls, and confirm it. The algorithm cannot infer validated impact face/path/speed from one camera.
- Default Review mode **never adds a pin** on taps, swipes or two-finger pinch gestures.
- Edit mode allows selecting and dragging an existing mark without creating duplicates.
- Add mode is explicit; single short stationary tap places a mark.
- Built-in 1×/2×/3× video-and-overlay zoom maps pointer edits to the original image coordinates.
- One-tap guide seeds the existing experimental putter landmark tracker. Its points require visual review.
- Advanced manual annotation and planar replay are collapsed by default on narrow screens.

## Validation
Controlled Chromium mobile-browser tests: upload, auto-analysis, candidate confirmation, 3× mark movement, no phantom pins on two-finger gesture, manual one-point placement, no uncaught JS exceptions.
Synthetic cases: clear straight and push-right produced candidates; camera shake and occlusion withheld; low light did not yield a confident ball location. The straight trial produced a candidate ~0.14 seconds after modeled impact; this **does not validate timing precision on iPhone**.
Real iPhone camera accuracy, all shot types, and sub-five-second review remain unverified.

## Usage
Open the HTTPS Worker URL. Import a short overhead stroke, wait for auto-analysis, inspect candidate, confirm or correct it. In Edit mode drag a selected point; use Add mode only when you explicitly need a new point. For putter path, tap Track putter to place one seed (if needed), then tap again to run the experimental tracker.

## Rollback
Previous production commit: `e2a597407c71b936ae6f3629426305fdc32fc2eb` (v0.5). Cloudflare Deployments offers rollback to prior successful deployment.

This folder is isolated from the unrelated Partender full-stack application. Do not change the Worker build root back to the repository root.
