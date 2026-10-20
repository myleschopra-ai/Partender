# Putting Lab v0.4 (self-contained browser beta)

This folder contains the Putting Lab v0.4 **standalone HTML** build. Open `index.html` in a browser to explore the interface and upload recorded strokes. The live camera requires a secure HTTPS origin and user camera permission.

## Features
- Video upload and playback; timeline annotation
- Reference-target and putter path overlays, ghost stroke comparison, impact freeze
- Experimental motion-triggered Smart Capture
- Voice result logging and evidence-gated adaptive coaching

## Important limitations
- Smart Capture is motion-zone detection, **not** verified automatic impact recognition.
- Face/path angles and ball speed must not be used as validated fitting measurements.
- Five-second automatic replay on actual iPhone video has not been demonstrated.
- Local file previews may not permit camera access.

## Cloudflare deployment
This is a **nested application** inside the existing Partender repository, so merging this branch will NOT by itself publish it at `partendinglab.myleschopra.workers.dev`. The Cloudflare Worker build must be configured to deploy this folder or (preferably) use a dedicated repository, without overwriting the existing Partender app. Verify Cloudflare build configuration and target before merging.

Release date: October 2026. Browser simulation only; real-device validation pending.

## Deployment trigger

Cloudflare production build requested after connecting this branch and setting the root directory to `putting-lab` (2026-10-20). This commit contains no changes to application behavior.
