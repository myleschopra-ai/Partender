import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../putting-lab/evidence-core.js', import.meta.url), 'utf8');
const context = { globalThis: {} };
vm.runInNewContext(source, context, { filename: 'evidence-core.js' });
const core = context.globalThis.PuttingEvidenceCore;

test('evidence core proposes a consistent pre-impact putter track', () => {
  const trace = Array.from({ length: 8 }, (_, i) => ({
    t: 0.62 + i * 0.035,
    motion: 0.04,
    global: 0.01,
    center: { x: 0.28 + i * 0.025, y: 0.47 + i * 0.001 },
  }));
  const result = core.selectPutterTrack(trace, 0.91);
  assert.ok(result);
  assert.equal(result.points.length, 8);
  assert.ok(result.residual < 0.003);
});

test('evidence core withholds inconsistent ball tracks', () => {
  const ball = { x: 0.5, y: 0.5, t: 1, area: 60 };
  const candidates = [
    { x: 0.52, y: 0.5, t: 1.04 },
    { x: 0.48, y: 0.54, t: 1.08 },
    { x: 0.57, y: 0.46, t: 1.12 },
    { x: 0.51, y: 0.57, t: 1.16 },
  ];
  assert.equal(core.selectBallTrack(candidates, ball, 1), null);
});

test('evidence core accepts monotonic post-impact ball travel and estimates scale', () => {
  const ball = { x: 0.35, y: 0.5, t: 1, area: Math.PI * 25 };
  const candidates = Array.from({ length: 5 }, (_, i) => ({ x: 0.365 + i * 0.018, y: 0.5 + i * 0.0005, t: 1.035 + i * 0.035 }));
  const track = core.selectBallTrack(candidates, ball, 1);
  const scale = core.scaleFromBall(ball, 320);
  assert.ok(track);
  assert.ok(track.points.length >= 4);
  assert.ok(scale);
  assert.ok(Math.abs(scale.diameterPx - 10) < 0.01);
});

test('face proposal requires an elongated edge perpendicular to path', () => {
  const w = 96, h = 72, gray = new Uint8Array(w * h).fill(110);
  for (let y = 18; y < 55; y++) for (let x = 47; x <= 49; x++) gray[y * w + x] = 235;
  const face = core.faceLineFromFrame({ gray, w, h }, { x: 0.5, y: 0.5, t: 1 }, 0);
  assert.ok(face);
  assert.equal(face.points.length, 2);
  assert.ok(face.anisotropy > 3.2);
});
