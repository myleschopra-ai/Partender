export const MEDIA_CHUNK_SIZE = 8 * 1024 * 1024;
export const MAX_MEDIA_SIZE = 5 * 1024 * 1024 * 1024;

const videoTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/webm",
  "video/mpeg",
  "video/3gpp",
]);

const extensionTypes: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  webm: "video/webm",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
};

export const mediaCategories = new Set([
  "reference-swing",
  "round-footage",
  "tournament-operations",
  "equipment-b-roll",
  "voiceover",
  "other",
]);

export function normalizeFileName(input: string) {
  const leaf = input.split(/[\\/]/).pop()?.trim() || "video";
  const cleaned = leaf
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned || "video";
}

export function resolveVideoType(fileName: string, suppliedType?: string) {
  const normalizedType = suppliedType?.toLowerCase().split(";")[0].trim() ?? "";
  if (videoTypes.has(normalizedType)) return normalizedType;
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extensionTypes[extension] ?? null;
}

export function buildObjectKey(id: string, fileName: string, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${year}/${month}/${id}/${normalizeFileName(fileName)}`;
}

export function expectedPartSize(byteSize: number, partNumber: number) {
  const offset = (partNumber - 1) * MEDIA_CHUNK_SIZE;
  if (partNumber < 1 || offset >= byteSize) return 0;
  return Math.min(MEDIA_CHUNK_SIZE, byteSize - offset);
}

export function expectedPartCount(byteSize: number) {
  return Math.ceil(byteSize / MEDIA_CHUNK_SIZE);
}

export function parseByteRange(value: string | null, byteSize: number) {
  if (!value) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(value.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : byteSize - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= byteSize || requestedEnd < start) return null;
  const end = Math.min(requestedEnd, byteSize - 1);
  return { offset: start, length: end - start + 1, start, end };
}
