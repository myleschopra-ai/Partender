# Putting Lab v0.9 — Separate capture, evidence-gated proposals

Production-connected branch: `feature/putting-lab-v0.4`
Cloudflare Worker: `partendinglab`; build root: `putting-lab`; Wrangler config: `putting-lab/wrangler.jsonc`.

## What changed
- Live automatic capture and uploaded-video review are dedicated interfaces that share the same conservative analysis engine without sharing the active source video.
- Auto-analysis now attempts ball travel, putter motion-centroid, regulation-ball scale, and visible face-edge proposals. Each proposal carries a reason/confidence trail, stays marked **Candidate**, and needs an explicit user-confirmation action.
- Face, path, start-line, ball-speed, and putter-speed numbers remain blank whenever their exact supporting evidence is absent. User confirmation is recorded separately from instrument validation.
- The original imported or recorded file remains unchanged. The bounded review window is virtual, and exported clips are new copies.
- Short imported overhead videos (up to 12 seconds) are automatically scanned for a stationary, visually recognizable ball and a probable ball departure after nearby putter motion.
- Proposed ball and impact markers are **not committed silently**. The user can inspect the candidate frame, adjust using video controls, and confirm it. The algorithm cannot infer validated impact face/path/speed from one camera.
- Default Review mode **never adds a pin** on taps, swipes or two-finger pinch gestures.
- Edit mode allows selecting and dragging an existing mark without creating duplicates.
- Add mode is explicit; single short stationary tap places a mark.
- Built-in 1×/2×/3× video-and-overlay zoom maps pointer edits to the original image coordinates.
- One-tap guide seeds the existing experimental putter landmark tracker. Its points require visual review.
- Advanced manual annotation and planar replay are collapsed by default on narrow screens.

## Validation
Controlled Chromium/Edge mobile-browser checks cover separate workspaces, responsive layout, candidate confirmation controls, and no uncaught startup exceptions. Deterministic synthetic tests cover accepted/withheld putter and ball tracks, face-edge gating, and ball-scale proposals.
Synthetic cases: clear straight and push-right produced candidates; camera shake and occlusion withheld; low light did not yield a confident ball location. The straight trial produced a candidate ~0.14 seconds after modeled impact; this **does not validate timing precision on iPhone**.
Real iPhone camera accuracy, all shot types, and sub-five-second review remain unverified.

## Usage
Open the HTTPS Worker URL. Import a short overhead stroke, wait for auto-analysis, inspect candidate, confirm or correct it. In Edit mode drag a selected point; use Add mode only when you explicitly need a new point. For putter path, tap Track putter to place one seed (if needed), then tap again to run the experimental tracker.

## Rollback
Use the previously verified branch commit and Cloudflare Deployments rollback. A GitHub commit does not by itself prove that the Worker is live.

This folder is isolated from the unrelated Partender full-stack application. Do not change the Worker build root back to the repository root.
