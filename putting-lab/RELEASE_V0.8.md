# Putting Lab v0.8 — Separate Live and Upload Workspaces + Evidence-Gated Metrics

## Intended deployment
- GitHub repository: `myleschopra-ai/Partender`
- Production-connected branch: `feature/putting-lab-v0.4`
- Cloudflare Worker: `partendinglab`
- Build root: `putting-lab`, static assets in `putting-lab/public/` (Wrangler static-assets configuration).

## User-facing changes
1. Dedicated **Live auto-detection** workspace with camera capture and an armed impact-candidate review workflow, separate from **Video upload analysis**.
2. Dedicated **Video upload analysis** workspace with an overhead profile and a low side-on *research* profile; original videos are retained.
3. Measurement-evidence panel shows **ball center, impact candidate, ball speed, start line, club face, club path, putter speed, vertical launch, spin and zero skid**; a number only appears if its supporting existing marker/track and geometry checks pass. Unavailable values stay blank with specific instructions. No invented face or velocity values.
4. Switching away from uploaded footage hides it in live capture mode; switching back restores the upload. (If a different live clip is recorded, returning to the upload may reload it and re-analyze; clip annotations may need reviewing again.)
5. Side-on camera setup explains high-speed footage, lens orientation, line-marked ball and why launch/spin/skid cannot yet be calculated.

## Research-guided measurement specification (independent implementation)
The Quintic Ball Roll *iPhone app* indicates 1080p/240fps, 12-inch ball travel, ground-level lens parallel to target line, 9–12-inch offset, a bold dark line on a ball, presets for indoor/overcast/sunny, automatic ball acquisition, and ball speed / launch / forward-neutral-back spin. Quintic's *professional system* separately documents true-roll/zero-skid distance and spin RPM. Do not assume the phone app supplies the latter values.

**Architecture:**
- Overhead: image-plane clubhead path/face candidate, ball position, 2D start direction, ball speed if calibrated. The app MUST withhold values if the video lacks a target line, scale reference, consistent timestamps, or adequate tracks.
- Side-on: initial ball speed and vertical launch can be developed from tracked ball trajectory relative to ground plane. Forward/backspin requires rotation of a marked ball. Signed slip ratio: `1 - (R*omega / v)`; only calculate reliable distance/time to zero skid after a contiguous series of valid translational and rotational observations. The current v0.8 build provides *setup guidance only*, not validated launch, spin, skid or continuous automatic clubface detection.
- Live browser capture may not deliver native 240 fps. For actual high-FPS footage, record using native iPhone camera and import. Real-device performance must be verified independently.

## Browser regression performed
- Chromium mobile viewport 390×844; both workspaces shown and switched; 0 horizontal overflow; 0 uncaught JS errors.
- Overhead synthetic clear putt: automatically located ball and proposed impact and four-phase clipped review; numerical measurements without full calibration were withheld.
- Side-on profile: disabled overhead auto-analysis, displayed appropriate missing-measurement states.
- Two-finger gesture at 3× zoom: created 0 phantom putter pins.
- Upload source preserved when switching to and from live mode.
- JavaScript parsed by Node.js.

## Not tested / remaining engineering
- Real iPhone camera permissions, high-speed frame timestamps, 5-second p95 processing, automatic accurate putter-face feature points, reliable putter-head speed measurement, actual spin RPM, skid distance, side-on launch angle, real cloud deployment after commit.

## Safety
Numeric measurement cards indicate candidate status pending human review, **not independently validated equipment-grade measurements**. Do not use the proposed face/path/ball speed values to make fitting decisions before comparison with calibrated instrumentation.