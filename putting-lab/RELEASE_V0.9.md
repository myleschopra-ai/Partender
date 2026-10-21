# Putting Lab v0.9 — Evidence proposal review

## Scope

- Keeps Live Auto-Detection and Video Upload Analysis as separate dedicated workspaces.
- Preserves the original source file; review clips are virtual and exports are copies.
- Adds conservative automatic proposal pipelines for ball travel, putter path landmarks, visible putter-face edges, and ball-size calibration.
- Derives ball speed, putter speed, start line, path, and face only when their existing geometry and timing gates pass.
- Requires an explicit **Confirm visible proposals** action. The saved record distinguishes human review from equipment validation.
- Keeps unsupported vertical launch, spin, and zero-skid measurements blank.

## Evidence model

Automatic points record source, confidence, and verification state. Ball tracking requires monotonic, directionally consistent travel. Putter tracking requires multiple low-global-motion observations with a small line-fit residual. Face detection requires a high-contrast elongated edge near the putter candidate and roughly perpendicular to its motion. Ball scale uses the detected silhouette and regulation diameter, so perspective and highlight bloom remain explicit uncertainty sources.

## Known limits

These are image-plane proposals, not launch-monitor measurements. Shadows, hands, shafts, alignment aids, motion blur, rolling shutter, frame-rate reporting, perspective, and lossy video can invalidate a candidate. Real iPhone accuracy and Cloudflare deployment must be verified separately.
