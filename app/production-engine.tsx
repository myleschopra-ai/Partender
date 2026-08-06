"use client";

import { useCallback, useEffect, useState } from "react";

type Project = { id: string; title: string; courseName: string; roundDate: string; status: string };
type Asset = { id: string; fileName: string; category: string; notes: string };
type LinkedAsset = { projectId: string; assetId: string; analysisStatus: string };
type Shot = { id: string; hole: number; shotNumber: number; club: string; startPoint: string; endPoint: string; distanceYards?: number | null };
type Job = { id: string; kind: string; status: string; outputUrl?: string | null; error?: string | null };
type Workspace = { projects: Project[]; assets: Asset[]; linkedAssets?: LinkedAsset[]; shots?: Shot[]; jobs?: Job[]; engineConnected: boolean };

const stages = ["source-footage", "round-data", "shot-match", "virtual-course", "composite", "flight", "editing", "review", "published"];
const labels: Record<string, string> = { "source-footage": "Source footage", "round-data": "Round data", "shot-match": "Shot match", "virtual-course": "Virtual course", composite: "Swing composite", flight: "Flight simulation", editing: "Editor and render", review: "Review", published: "Published" };

async function send(action: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/production?action=${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Production request failed");
  return payload;
}

export default function ProductionEngine() {
  const [data, setData] = useState<Workspace>({ projects: [], assets: [], engineConnected: false });
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ title: "Episode 001", courseName: "", roundDate: "" });
  const [shot, setShot] = useState({ hole: "1", shotNumber: "1", club: "Driver", startPoint: "Tee", endPoint: "Fairway", distanceYards: "" });

  const load = useCallback(async (id = projectId) => {
    const response = await fetch(`/api/production${id ? `?projectId=${encodeURIComponent(id)}` : ""}`);
    if (!response.ok) throw new Error("Production workspace is unavailable");
    const payload = await response.json() as Workspace;
    setData(payload);
    if (!id && payload.projects[0]) setProjectId(payload.projects[0].id);
  }, [projectId]);

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (projectId) void load(projectId).catch((error) => setMessage(error.message)); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const project = data.projects.find((item) => item.id === projectId);
  const attached = new Set((data.linkedAssets ?? []).map((item) => item.assetId));

  async function act(action: string, body: Record<string, unknown>, success: string) {
    setBusy(true); setMessage("");
    try { await send(action, body); await load(projectId); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Production request failed"); }
    finally { setBusy(false); }
  }

  async function createProject() {
    setBusy(true); setMessage("");
    try { const result = await send("create-project", projectDraft) as { project: Project }; setProjectId(result.project.id); await load(result.project.id); setMessage("Production project created."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create project"); }
    finally { setBusy(false); }
  }

  function move(direction: -1 | 1) {
    if (!project) return;
    const index = Math.max(0, Math.min(stages.indexOf(project.status) + direction, stages.length - 1));
    if (stages[index] !== project.status) void act("move-project", { projectId, status: stages[index] }, `Moved to ${labels[stages[index]]}.`);
  }

  return <div className="production-workspace">
    <div className="production-toolbar"><div><p className="eyebrow">Production engine workspace</p><h3>Build the first composited round.</h3></div><span className={data.engineConnected ? "engine-connected" : "engine-disconnected"}>{data.engineConnected ? "MEDIA WORKER CONNECTED" : "MEDIA WORKER NOT CONNECTED"}</span></div>
    {!data.projects.length ? <div className="project-create"><input value={projectDraft.title} onChange={(event) => setProjectDraft({ ...projectDraft, title: event.target.value })} placeholder="Project title" /><input value={projectDraft.courseName} onChange={(event) => setProjectDraft({ ...projectDraft, courseName: event.target.value })} placeholder="Course name" /><input type="date" value={projectDraft.roundDate} onChange={(event) => setProjectDraft({ ...projectDraft, roundDate: event.target.value })} /><button disabled={busy || !projectDraft.title.trim()} onClick={() => void createProject()}>Create production project</button></div> : <>
      <div className="project-selector"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{data.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="project-stage"><button disabled={busy || project?.status === stages[0]} onClick={() => move(-1)}>← Previous stage</button><strong>{labels[project?.status ?? ""]}</strong><button disabled={busy || project?.status === stages.at(-1)} onClick={() => move(1)}>Next stage →</button></div></div>
      <div className="production-columns">
        <section><p className="eyebrow">01 · Source footage</p><h4>Attach and analyze real swings</h4>{data.assets.length ? <div className="source-pick-list">{data.assets.map((asset) => { const isAttached = attached.has(asset.id); const link = data.linkedAssets?.find((item) => item.assetId === asset.id); return <article key={asset.id}><div><strong>{asset.fileName}</strong><small>{asset.category} · {link?.analysisStatus ?? "not attached"}</small></div>{!isAttached ? <button disabled={busy} onClick={() => void act("attach-asset", { projectId, assetId: asset.id }, "Source video attached.")}>Attach</button> : <button disabled={busy || !data.engineConnected} title={!data.engineConnected ? "Connect the media worker first" : "Analyze footage"} onClick={() => void act("request-job", { projectId, assetId: asset.id, kind: "analyze-footage" }, "Footage analysis queued.")}>Analyze</button>}</article>; })}</div> : <p className="production-empty">Upload source videos before assigning footage.</p>}</section>
        <section><p className="eyebrow">02 · Arccos shots</p><h4>Add verified shot data</h4><div className="shot-form"><input type="number" min="1" max="18" aria-label="Hole" value={shot.hole} onChange={(event) => setShot({ ...shot, hole: event.target.value })} /><input type="number" min="1" aria-label="Shot" value={shot.shotNumber} onChange={(event) => setShot({ ...shot, shotNumber: event.target.value })} /><input aria-label="Club" value={shot.club} onChange={(event) => setShot({ ...shot, club: event.target.value })} /><input aria-label="Beginning point" value={shot.startPoint} onChange={(event) => setShot({ ...shot, startPoint: event.target.value })} /><input aria-label="End point" value={shot.endPoint} onChange={(event) => setShot({ ...shot, endPoint: event.target.value })} /><input type="number" aria-label="Distance yards" placeholder="Yards" value={shot.distanceYards} onChange={(event) => setShot({ ...shot, distanceYards: event.target.value })} /><button disabled={busy} onClick={() => void act("add-shot", { projectId, ...shot }, "Arccos shot added.")}>Add shot</button></div><div className="shot-list">{(data.shots ?? []).map((item) => <article key={item.id}><b>H{item.hole} · {item.shotNumber}</b><span>{item.club}</span><small>{item.startPoint} → {item.endPoint}{item.distanceYards ? ` · ${item.distanceYards} yd` : ""}</small></article>)}</div></section>
      </div>
      <div className="render-bar"><div><p className="eyebrow">Preview render</p><strong>Composite approved swings, course scenes, tracer and shot graphics.</strong><small>{data.engineConnected ? "The connected media worker will return a playable draft here." : "Connect the external media worker before rendering. Projects and shot plans can be prepared now."}</small></div><button disabled={busy || !data.engineConnected || !(data.shots ?? []).length} onClick={() => void act("request-job", { projectId, kind: "render-preview" }, "Preview render queued.")}>Generate preview</button></div>
      {(data.jobs ?? []).length ? <div className="job-list">{data.jobs?.slice(0, 5).map((job) => <article key={job.id}><span>{job.kind}</span><b>{job.status}</b>{job.outputUrl ? <a href={job.outputUrl} target="_blank" rel="noreferrer">Open render ↗</a> : null}{job.error ? <small>{job.error}</small> : null}</article>)}</div> : null}
    </>}
    {message ? <p className="production-notice" aria-live="polite">{message}</p> : null}
  </div>;
}
