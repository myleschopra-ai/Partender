"use client";

import { useEffect, useRef, useState } from "react";

type MediaAsset = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  category: string;
  notes: string;
  status: string;
  createdAt: string;
  uploadedAt: string | null;
  streamUrl: string | null;
};

type UploadJob = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "complete" | "failed" | "cancelled";
  detail: string;
};

const categories = [
  ["reference-swing", "Reference swing"],
  ["round-footage", "Round footage"],
  ["tournament-operations", "Tournament operations"],
  ["equipment-b-roll", "Equipment / B-roll"],
  ["voiceover", "Voiceover performance"],
  ["other", "Other footage"],
] as const;

const categoryLabels = Object.fromEntries(categories);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function formatDate(value: string | null) {
  if (!value) return "Upload incomplete";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

async function responseError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error || `Upload failed (${response.status})`;
}

export default function MediaLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRequested = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const activeAssetId = useRef<string | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [category, setCategory] = useState("reference-swing");
  const [notes, setNotes] = useState("");
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [libraryError, setLibraryError] = useState("");

  async function refreshAssets() {
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json() as { assets: MediaAsset[] };
      setAssets(payload.assets.filter((asset) => asset.status !== "cancelled"));
      setLibraryError("");
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "Media library is unavailable");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/media", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<{ assets: MediaAsset[] }>;
      })
      .then((payload) => {
        setAssets(payload.assets.filter((asset) => asset.status !== "cancelled"));
        setLibraryError("");
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setLibraryError(error instanceof Error ? error.message : "Media library is unavailable");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
  }

  async function uploadPart(assetId: string, partNumber: number, part: Blob, jobId: string) {
    let lastError = "Part upload failed";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (cancelRequested.current) throw new DOMException("Upload cancelled", "AbortError");
      const controller = new AbortController();
      requestController.current = controller;
      try {
        const response = await fetch(`/api/media?action=part&assetId=${encodeURIComponent(assetId)}&partNumber=${partNumber}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream", "x-part-size": String(part.size) },
          body: part,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseError(response));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        lastError = error instanceof Error ? error.message : lastError;
        if (attempt < 3) {
          updateJob(jobId, { detail: `Connection interrupted · retry ${attempt + 1} of 3` });
          await new Promise((resolve) => window.setTimeout(resolve, attempt * 900));
        }
      }
    }
    throw new Error(lastError);
  }

  async function uploadFile(file: File, jobId: string, selectedCategory: string, selectedNotes: string) {
    updateJob(jobId, { status: "uploading", detail: "Preparing secure upload" });
    const initiate = await fetch("/api/media?action=initiate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type, byteSize: file.size, category: selectedCategory, notes: selectedNotes }),
    });
    if (!initiate.ok) throw new Error(await responseError(initiate));
    const session = await initiate.json() as { assetId: string; partSize: number; partCount: number };
    activeAssetId.current = session.assetId;

    try {
      for (let partIndex = 0; partIndex < session.partCount; partIndex += 1) {
        const start = partIndex * session.partSize;
        const part = file.slice(start, Math.min(start + session.partSize, file.size));
        updateJob(jobId, { detail: `Uploading part ${partIndex + 1} of ${session.partCount}` });
        await uploadPart(session.assetId, partIndex + 1, part, jobId);
        updateJob(jobId, { progress: Math.round(((partIndex + 1) / session.partCount) * 100) });
      }

      updateJob(jobId, { detail: "Finalizing source video" });
      const complete = await fetch("/api/media?action=complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId: session.assetId }),
      });
      if (!complete.ok) throw new Error(await responseError(complete));
      updateJob(jobId, { status: "complete", progress: 100, detail: "Ready for production" });
      activeAssetId.current = null;
      await refreshAssets();
    } catch (error) {
      if (cancelRequested.current || (error instanceof DOMException && error.name === "AbortError")) {
        await fetch("/api/media?action=abort", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId: session.assetId }) }).catch(() => undefined);
        updateJob(jobId, { status: "cancelled", detail: "Upload cancelled" });
        activeAssetId.current = null;
        return;
      }
      updateJob(jobId, { status: "failed", detail: error instanceof Error ? error.message : "Upload failed" });
      activeAssetId.current = null;
    }
  }

  async function handleSelection(files: FileList | null) {
    if (!files?.length || uploading) return;
    const selected = Array.from(files);
    const batch = selected.map((file, index) => ({ id: `${Date.now()}-${index}`, file }));
    setJobs(batch.map(({ id, file }) => ({ id, name: file.name, progress: 0, status: "queued", detail: formatBytes(file.size) })));
    setUploading(true);
    cancelRequested.current = false;
    const selectedCategory = category;
    const selectedNotes = notes.trim();
    for (const { id, file } of batch) {
      if (cancelRequested.current) {
        updateJob(id, { status: "cancelled", detail: "Upload cancelled" });
        continue;
      }
      try {
        await uploadFile(file, id, selectedCategory, selectedNotes);
      } catch (error) {
        updateJob(id, { status: "failed", detail: error instanceof Error ? error.message : "Upload failed" });
      }
    }
    setUploading(false);
    requestController.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  function cancelUpload() {
    cancelRequested.current = true;
    requestController.current?.abort();
  }

  const readyAssets = assets.filter((asset) => asset.status === "ready");
  const incompleteAssets = assets.filter((asset) => asset.status !== "ready");

  return (
    <section className="page-section media-page">
      <header className="section-heading media-heading">
        <div>
          <p className="eyebrow">Mobile footage intake</p>
          <h2>Your source-video library.</h2>
          <p className="section-copy">Upload original clips from your phone once, label what they are for, and keep production-ready sources with the Partender workflow.</p>
        </div>
        <span className="media-count"><b>{readyAssets.length}</b> ready videos</span>
      </header>

      <div className="media-intake-grid">
        <article className="upload-panel">
          <div className="upload-panel-top">
            <div><p className="eyebrow">Add footage</p><h3>From Camera Roll to production</h3></div>
            <span>Private workspace</span>
          </div>
          <div className="upload-fields">
            <label><span>Footage type</span><select value={category} onChange={(event) => setCategory(event.target.value)} disabled={uploading}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Production note <i>optional</i></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} disabled={uploading} placeholder="Example: Driver, down-the-line, navy shirt · Episode 001" /></label>
          </div>
          <input id="partender-video-upload" ref={inputRef} className="visually-hidden" type="file" accept="video/mp4,video/quicktime,video/x-m4v,video/webm,video/mpeg,video/3gpp,.mp4,.mov,.m4v,.webm,.mpeg,.mpg,.3gp" multiple disabled={uploading} onChange={(event) => void handleSelection(event.target.files)} />
          <label className={`phone-upload-button${uploading ? " disabled" : ""}`} htmlFor="partender-video-upload" aria-disabled={uploading}>
            <span aria-hidden="true">↑</span><strong>{uploading ? "Uploading…" : "Choose videos from phone"}</strong><small>MP4 · MOV · M4V · WebM · up to 5 GB each</small>
          </label>
          <div className="upload-assurance"><span>8 MB resumable parts</span><span>Automatic retry</span><span>Original quality preserved</span></div>

          {jobs.length ? <div className="upload-queue" aria-live="polite">{jobs.map((job) => <div className={`upload-job ${job.status}`} key={job.id}><div className="upload-job-line"><strong>{job.name}</strong><span>{job.status === "uploading" ? `${job.progress}%` : job.status}</span></div><div className="upload-progress"><i style={{ width: `${job.progress}%` }} /></div><small>{job.detail}</small></div>)}{uploading ? <button className="cancel-upload" onClick={cancelUpload}>Cancel remaining upload</button> : null}</div> : null}
        </article>

        <aside className="capture-recipe">
          <p className="eyebrow">Reference-video standard</p>
          <h3>Give the AI designer clean evidence—not more footage.</h3>
          <ol><li><b>Lock the phone</b><span>Tripod, landscape, 4K/60 when available.</span></li><li><b>Show the full body</b><span>Clubhead and feet remain in frame throughout.</span></li><li><b>Capture both angles</b><span>Face-on and down-the-line for each swing family.</span></li><li><b>Keep one wardrobe</b><span>Hat, glove, shoes and outfit remain consistent.</span></li></ol>
          <div><strong>Episode 001 minimum</strong><span>Driver · iron · wedge · putt · walk · setup · reaction</span></div>
        </aside>
      </div>

      <div className="library-heading"><div><p className="eyebrow">Production sources</p><h3>Ready to review and download</h3></div><button onClick={() => void refreshAssets()} disabled={loading}>{loading ? "Loading…" : "Refresh library"}</button></div>
      {libraryError ? <div className="library-error" role="alert"><strong>Media storage needs attention.</strong><span>{libraryError}</span></div> : null}
      {!loading && !libraryError && readyAssets.length === 0 ? <div className="empty-library"><span>◉</span><h3>No source videos yet.</h3><p>Your first upload will appear here with its original quality and production label intact.</p></div> : null}
      {readyAssets.length ? <div className="media-library-grid">{readyAssets.map((asset) => <article className="media-card" key={asset.id}><div className="video-frame"><video controls playsInline preload="metadata" src={asset.streamUrl ?? undefined}>Your browser cannot preview this video.</video><span>ORIGINAL</span></div><div className="media-card-body"><div className="media-card-meta"><span>{categoryLabels[asset.category] ?? "Other footage"}</span><i>Ready</i></div><h3 title={asset.fileName}>{asset.fileName}</h3>{asset.notes ? <p>{asset.notes}</p> : <p className="muted-note">No production note</p>}<div className="media-card-footer"><small>{formatBytes(asset.byteSize)} · {formatDate(asset.uploadedAt)}</small>{asset.streamUrl ? <a href={asset.streamUrl} download={asset.fileName}>Download source ↓</a> : null}</div></div></article>)}</div> : null}
      {incompleteAssets.length ? <div className="incomplete-note"><strong>{incompleteAssets.length} incomplete upload{incompleteAssets.length === 1 ? "" : "s"}</strong><span>Interrupted uploads are never shown as production-ready. Re-select the original video to upload a clean copy.</span></div> : null}
    </section>
  );
}
