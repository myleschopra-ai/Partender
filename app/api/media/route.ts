import { asc, desc, eq } from "drizzle-orm";
import { ensureMediaSchema, getDb } from "../../../db";
import { mediaAssets, mediaUploadParts } from "../../../db/schema";
import {
  MAX_MEDIA_SIZE,
  MEDIA_CHUNK_SIZE,
  buildObjectKey,
  expectedPartCount,
  expectedPartSize,
  mediaCategories,
  normalizeFileName,
  parseByteRange,
  resolveVideoType,
} from "./media-utils";

export const dynamic = "force-dynamic";

type MediaAssetRow = typeof mediaAssets.$inferSelect;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected media storage error";
}

async function getBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) throw new Error("Media storage is not configured");
  return env.BUCKET;
}

function toClientAsset(asset: MediaAssetRow) {
  return {
    id: asset.id,
    fileName: asset.fileName,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    category: asset.category,
    notes: asset.notes,
    status: asset.status,
    createdAt: asset.createdAt,
    uploadedAt: asset.uploadedAt,
    streamUrl: asset.status === "ready" ? `/api/media?id=${encodeURIComponent(asset.id)}` : null,
  };
}

async function findAsset(id: string) {
  await ensureMediaSchema();
  const db = await getDb();
  const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return asset ?? null;
}

function mediaHeaders(asset: MediaAssetRow) {
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=300",
    "content-type": asset.contentType,
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
    "x-content-type-options": "nosniff",
  });
  return headers;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) {
      await ensureMediaSchema();
      const db = await getDb();
      const assets = await db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt), asc(mediaAssets.fileName));
      return Response.json({ assets: assets.map(toClientAsset) });
    }

    const asset = await findAsset(id);
    if (!asset || asset.status !== "ready") return jsonError("Video not found", 404);
    const bucket = await getBucket();
    const range = parseByteRange(request.headers.get("range"), asset.byteSize);
    const object = await bucket.get(asset.objectKey, range ? { range: { offset: range.offset, length: range.length } } : undefined);
    if (!object) return jsonError("Video object not found", 404);

    const headers = mediaHeaders(asset);
    headers.set("etag", object.httpEtag);
    if (range) {
      headers.set("content-length", String(range.length));
      headers.set("content-range", `bytes ${range.start}-${range.end}/${asset.byteSize}`);
      return new Response(object.body, { status: 206, headers });
    }
    headers.set("content-length", String(asset.byteSize));
    return new Response(object.body, { headers });
  } catch (error) {
    return jsonError(errorMessage(error), 500);
  }
}

export async function HEAD(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("Video id is required", 400);
    const asset = await findAsset(id);
    if (!asset || asset.status !== "ready") return jsonError("Video not found", 404);
    const headers = mediaHeaders(asset);
    headers.set("content-length", String(asset.byteSize));
    return new Response(null, { headers });
  } catch (error) {
    return jsonError(errorMessage(error), 500);
  }
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get("action");
  try {
    if (action === "initiate") {
      const body = await request.json() as { fileName?: string; contentType?: string; byteSize?: number; category?: string; notes?: string };
      const fileName = normalizeFileName(body.fileName ?? "");
      const byteSize = Number(body.byteSize);
      const contentType = resolveVideoType(fileName, body.contentType);
      const category = body.category?.trim() ?? "reference-swing";
      const notes = body.notes?.trim().slice(0, 500) ?? "";
      if (!contentType) return jsonError("Choose a supported video or a JPG, PNG, WebP, HEIC, or HEIF course image", 415);
      if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > MAX_MEDIA_SIZE) return jsonError("Video must be between 1 byte and 5 GB", 400);
      if (!mediaCategories.has(category)) return jsonError("Choose a valid footage category", 400);

      const id = crypto.randomUUID();
      const objectKey = buildObjectKey(id, fileName);
      const bucket = await getBucket();
      const multipart = await bucket.createMultipartUpload(objectKey, {
        httpMetadata: { contentType, contentDisposition: `inline; filename="${fileName.replace(/"/g, "")}"` },
      });
      try {
        await ensureMediaSchema();
        const db = await getDb();
        await db.insert(mediaAssets).values({
          id,
          objectKey,
          fileName,
          contentType,
          byteSize,
          category,
          notes,
          status: "uploading",
          multipartUploadId: multipart.uploadId,
          uploadedBy: request.headers.get("oai-authenticated-user-email"),
        });
      } catch (error) {
        await multipart.abort().catch(() => undefined);
        throw error;
      }
      return Response.json({ assetId: id, partSize: MEDIA_CHUNK_SIZE, partCount: expectedPartCount(byteSize) }, { status: 201 });
    }

    const body = await request.json() as { assetId?: string };
    const assetId = body.assetId?.trim() ?? "";
    if (!assetId) return jsonError("Video id is required", 400);
    const asset = await findAsset(assetId);
    if (!asset) return jsonError("Video not found", 404);
    if (!asset.multipartUploadId) return jsonError("Upload session is no longer active", 409);
    const bucket = await getBucket();
    const multipart = bucket.resumeMultipartUpload(asset.objectKey, asset.multipartUploadId);

    if (action === "complete") {
      if (asset.status !== "uploading") return jsonError("Upload is not active", 409);
      const db = await getDb();
      const parts = await db.select().from(mediaUploadParts).where(eq(mediaUploadParts.assetId, asset.id)).orderBy(asc(mediaUploadParts.partNumber));
      const expectedCount = expectedPartCount(asset.byteSize);
      const validParts = parts.length === expectedCount && parts.every((part, index) => part.partNumber === index + 1 && part.byteSize === expectedPartSize(asset.byteSize, part.partNumber));
      if (!validParts) return jsonError("Some video parts are missing; resume the upload before completing it", 409);
      await multipart.complete(parts.map((part) => ({ partNumber: part.partNumber, etag: part.etag })));
      const uploadedAt = new Date().toISOString();
      const [updated] = await db.update(mediaAssets).set({ status: "ready", uploadedAt, multipartUploadId: null }).where(eq(mediaAssets.id, asset.id)).returning();
      return Response.json({ asset: toClientAsset(updated) });
    }

    if (action === "abort") {
      if (asset.status === "uploading") await multipart.abort().catch(() => undefined);
      const db = await getDb();
      await db.update(mediaAssets).set({ status: "cancelled", multipartUploadId: null }).where(eq(mediaAssets.id, asset.id));
      return Response.json({ ok: true });
    }

    return jsonError("Unknown media action", 400);
  } catch (error) {
    return jsonError(errorMessage(error), 500);
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("action") !== "part") return jsonError("Unknown media action", 400);
    const assetId = url.searchParams.get("assetId")?.trim() ?? "";
    const partNumber = Number(url.searchParams.get("partNumber"));
    const claimedPartSize = Number(request.headers.get("x-part-size") ?? request.headers.get("content-length"));
    if (!assetId || !Number.isInteger(partNumber)) return jsonError("Video id and part number are required", 400);
    const asset = await findAsset(assetId);
    if (!asset || asset.status !== "uploading" || !asset.multipartUploadId) return jsonError("Upload session is not active", 409);
    const requiredSize = expectedPartSize(asset.byteSize, partNumber);
    if (!requiredSize || claimedPartSize !== requiredSize) return jsonError("Video part size does not match this upload", 400);
    if (!request.body) return jsonError("Video part is empty", 400);

    const bucket = await getBucket();
    const multipart = bucket.resumeMultipartUpload(asset.objectKey, asset.multipartUploadId);
    const uploaded = await multipart.uploadPart(partNumber, request.body);
    const db = await getDb();
    await db.insert(mediaUploadParts).values({
      assetId: asset.id,
      partNumber: uploaded.partNumber,
      etag: uploaded.etag,
      byteSize: claimedPartSize,
    }).onConflictDoUpdate({
      target: [mediaUploadParts.assetId, mediaUploadParts.partNumber],
      set: { etag: uploaded.etag, byteSize: claimedPartSize, createdAt: new Date().toISOString() },
    });
    return Response.json({ partNumber: uploaded.partNumber });
  } catch (error) {
    return jsonError(errorMessage(error), 500);
  }
}
