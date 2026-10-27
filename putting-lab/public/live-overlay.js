/* Putting Lab v1 — camera-first controls. The actual video/annotation canvas stays visible.
 * Uses existing capture, analysis, and marker editing actions; no additional video stream.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const shell = $('videoShell'), stage = $('liveStage');
  if (!shell || !stage) return;

  const launch = document.createElement('button');
  launch.id = 'plLaunch'; launch.type = 'button';
  launch.textContent = '◉ Open full-screen putting camera';
  stage.prepend(launch);

  const controls = document.createElement('div');
  controls.id = 'plControls'; controls.hidden = true;
  controls.innerHTML = '<div class="pl-top"><div class="pl-status" role="status" aria-live="polite"><strong id="plTitle">CAMERA · IDLE</strong><span id="plMessage">Open the camera, then tap the actual ball in the video.</span></div><div class="pl-topbuttons"><button id="plGear" type="button">⚙ Settings</button><button id="plExit" type="button">✕ Exit</button></div></div><div class="pl-bottom"><div class="pl-scrub"><input id="plTimeline" type="range" min="0" max="1000" step="1" aria-label="Scrub stroke video"><small id="plTimestamp">0.000 s</small></div><div class="pl-buttons pl-live"><button id="plCamera" type="button">◉ Camera</button><button id="plBall" type="button">⌖ Set ball</button><button id="plArm" class="primary" type="button">◎ Arm detection</button><button id="plStop" class="danger" type="button" hidden>■ Stop</button></div><div class="pl-buttons pl-review"><button id="plBackward" type="button">− Frame</button><button id="plPlayback" type="button">▶ Play</button><button id="plForward" type="button">+ Frame</button><button id="plImpact" class="primary" type="button">⌖ Correct impact</button><button id="plNextStroke" type="button">↺ Next putt</button></div><div class="pl-buttons pl-review pl-review-tools"><select id="plMarker" aria-label="Choose marker type"><option value="ball">Ball</option><option value="putter">Putter</option><option value="target">Target</option><option value="face">Face edge</option><option value="scale">Ball width</option></select><button id="plMove" type="button">↔ Move</button><button id="plAdd" type="button">＋ Add</button><button id="plReview" type="button">✓ Review</button><button id="plSave" type="button">↓ Save</button></div></div><div id="plSettings" hidden role="dialog" aria-label="Putting camera settings"><h3>Capture &amp; analysis</h3><label>Camera preference<select id="plQuality"><option value="impact">Impact priority</option><option value="fps">Prefer frame rate</option><option value="detail">Prefer resolution</option><option value="reliable">Reliable fallback</option></select></label><button id="plApply" type="button">↻ Recheck camera</button><button id="plAnalyze" type="button">◎ Analyze recorded clip</button><p id="plCameraReadout">No camera stream active.</p><p>Temporal motion analysis uses consecutive frames at the browser-delivered rate; the result is a candidate, not a measurement-grade impact. Safari cannot guarantee true high-speed frames.</p><button id="plDoneSettings" class="primary" type="button">Done</button></div>';
  shell.append(controls);

  const click = id => { const b = $(id); if (!b || b.disabled) return false; b.click(); return true; };
  const on = (id, handler) => $(id).addEventListener('click', handler);
  function refresh() {
    if (!document.body.classList.contains('pl-immersive')) return;
    const reviewing = state.mode === 'review';
    const armed = smartCapture.armed;
    const camera = state.mode === 'live' && !!state.stream;
    const pending = window.PuttingPhaseReview?.data?.phases?.impact;
    controls.classList.toggle('pl-reviewing', reviewing);
    $('plTitle').textContent = reviewing ? (pending ? 'REVIEW · CANDIDATE' : 'REVIEW · VIDEO') :
      armed ? '● RECORDING · AUTO DETECT' : camera ? '● LIVE · OVERHEAD' : 'CAMERA · STANDBY';
    $('plMessage').textContent = reviewing
      ? ($('assistStatus')?.textContent || 'Scrub and correct markers directly on video.').slice(0,140)
      : armed ? ($('smartStatus')?.textContent || 'Recording').slice(0,140)
      : camera ? (smartCapture.roi ? 'Ball reference set. Arm before putting.' : 'Tap Set ball, then touch the actual ball.')
      : 'Open camera and allow access.';
    $('plCamera').hidden = camera;
    $('plBall').disabled = !camera || armed;
    $('plArm').disabled = !camera || armed;
    $('plStop').hidden = !armed;
    $('plCameraReadout').textContent = $('qualityStatus')?.textContent || 'No camera stream.';
    $('plQuality').value = $('qualityPriority').value;
    const seek = $('seekBar'), timeline = $('plTimeline');
    timeline.min = seek.min; timeline.max = seek.max;
    if (document.activeElement !== timeline) timeline.value = seek.value;
    $('plTimestamp').textContent = (Number.isFinite(video.currentTime) ? video.currentTime : 0).toFixed(3) + ' s';
    $('plPlayback').textContent = video.paused ? '▶ Play' : 'Ⅱ Pause';
    $('plImpact').textContent = pending ? '⌖ Correct impact' : '⌖ Mark impact';
  }
  function show() {
    document.body.classList.add('pl-immersive');
    controls.hidden = false;
    refresh();
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
  function hide() {
    document.body.classList.remove('pl-immersive');
    controls.hidden = true; $('plSettings').hidden = true;
    window.dispatchEvent(new Event('resize'));
  }

  on('plExit', hide);
  launch.addEventListener('click', () => { show(); if (state.mode === 'empty') click('emptyCamera'); });
  on('plGear', () => { $('plSettings').hidden = !$('plSettings').hidden; });
  on('plDoneSettings', () => { $('plSettings').hidden = true; });
  on('plCamera', () => { if (!click('cameraBtn')) click('emptyCamera'); });
  on('plBall', () => click('pickROI'));
  on('plArm', () => click('smartArm'));
  on('plStop', () => click('smartCancel'));
  on('plApply', () => {
    $('qualityPriority').value = $('plQuality').value;
    click('qualityRefresh');
    $('plSettings').hidden = true;
  });
  on('plAnalyze', () => { click('assistAuto'); $('plSettings').hidden = true; });
  on('plBackward', () => click('backBtn'));
  on('plForward', () => click('nextBtn'));
  on('plPlayback', () => click('playBtn'));
  on('plNextStroke', () => click('autoNextStroke'));
  on('plSave', () => click('saveStrokeBtn'));
  $('plTimeline').addEventListener('input', () => {
    const bar = $('seekBar');
    bar.value = $('plTimeline').value;
    bar.dispatchEvent(new Event('input', { bubbles: true }));
  });
  function selectTool() {
    document.querySelector('[data-tool="' + $('plMarker').value + '"]')?.click();
  }
  $('plMarker').addEventListener('change', selectTool);
  on('plMove', () => { selectTool(); click('assistEdit'); });
  on('plAdd', () => { selectTool(); click('assistPlace'); });
  on('plReview', () => click('assistReview'));
  on('plImpact', () => {
    const review = window.PuttingPhaseReview;
    if (review?.data?.phases?.impact) { review.selected = 'impact'; click('phaseCorrect'); }
    else click('markImpact');
  });
  const recorded = $('reviewVideo');
  recorded.addEventListener('timeupdate', refresh);
  recorded.addEventListener('loadedmetadata', refresh);
  recorded.addEventListener('seeked', refresh);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('pl-immersive')) hide();
  });
  window.setInterval(refresh, 350);
  window.PuttingLiveOverlay = { show, hide, refresh };
})();