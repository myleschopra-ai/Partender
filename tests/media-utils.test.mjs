import assert from "node:assert/strict";
import test from "node:test";

import {
  MEDIA_CHUNK_SIZE,
  buildObjectKey,
  expectedPartCount,
  expectedPartSize,
  normalizeFileName,
  parseByteRange,
  resolveVideoType,
} from "../app/api/media/media-utils.ts";

test("normalizes unsafe mobile filenames without losing the extension", () => {
  assert.equal(normalizeFileName("../../Driver Swing (DTL) #1.MOV"), "Driver-Swing-DTL-1.MOV");
  assert.equal(resolveVideoType("Driver-Swing.MOV", ""), "video/quicktime");
  assert.equal(resolveVideoType("notes.pdf", "application/pdf"), null);
});

test("splits video uploads into uniform 8 MB parts with a smaller final part", () => {
  const byteSize = MEDIA_CHUNK_SIZE * 2 + 137;
  assert.equal(expectedPartCount(byteSize), 3);
  assert.equal(expectedPartSize(byteSize, 1), MEDIA_CHUNK_SIZE);
  assert.equal(expectedPartSize(byteSize, 2), MEDIA_CHUNK_SIZE);
  assert.equal(expectedPartSize(byteSize, 3), 137);
  assert.equal(expectedPartSize(byteSize, 4), 0);
});

test("builds private object keys and validates playback ranges", () => {
  assert.equal(
    buildObjectKey("asset-1", "My Swing.mov", new Date("2026-08-05T12:00:00Z")),
    "media/2026/08/asset-1/My-Swing.mov",
  );
  assert.deepEqual(parseByteRange("bytes=10-19", 100), { offset: 10, length: 10, start: 10, end: 19 });
  assert.deepEqual(parseByteRange("bytes=90-", 100), { offset: 90, length: 10, start: 90, end: 99 });
  assert.equal(parseByteRange("bytes=100-101", 100), null);
});
