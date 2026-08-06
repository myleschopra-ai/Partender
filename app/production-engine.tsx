"use client";

import { useCallback, useEffect, useState } from "react";

type Project = { id: string; title: string; courseName: string; roundDate: string; status: string };
type Asset = { id: string; fileName: string; category: string; notes: string; contentType: string; streamUrl: string };
type LinkedAsset = { projectId: string; assetId: string; analysisStatus: string };
type Shot = { id: string; hole: number; shotNumber: number; club: string; startPoint: string; endPoint: string; distanceYards?: number | null; dataSource?: string };
type Job = { id: string; kind: string; status: string; outputUrl?: string | null; error?: string | null };
type Profile = { id: string; club: string; source: string; ballSpeedMph?: number | null; launchAngleTenths?: number | null; spinRpm?: number | null; carryYards?: number | null; apexFeet?: number | null };
type Workspace = { projects: Project[]; assets: Asset[]; profiles?: Profile[]; linkedAssets?: LinkedAsset[]; shots?: Shot[]; jobs?: Job[]; engineConnected: boolean };

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
  const [launch, setLaunch] = useState({ club: "Driver", ballSpeedMph: "", launchAngle: "", launchDirection: "", spinRpm: "", spinAxis: "", carryYards: "", apexFeet: "", shotType: "" });

  const load = useCallback(async (id = projectId) => {
    const response = await fetch(`/api/production${id ? `?projectId=${encodeURIComponent(id)}` : ""}`);
    if (!response.ok) throw new Error("Production workspace is unavailable");
    const payload = await response.json() as Workspace;
    setData(payload);
    if (!id && payload.projects[0]) setProjectId(payload.projects[0].id);
  }, [projectId]);

  // These effects synchronize the component with the persistent production API.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (projectId) void load(projectId).catch((error) => setMessage(error.message)); }, [projectId]);

  const project = data.projects.find((item) => item.id === projectId);
  const attached = new Set((data.linkedAssets ?? []).map((item) => item.assetId));
  const footageAssets = data.assets.filter((asset) => !asset.contentType.startsWith("image/"));
  const courseReferences = data.assets.filter((asset) => asset.category === "course-reference" || asset.contentType.startsWith("image/"));

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

  async function createWestfieldsProof() {
    setBusy(true); setMessage("");
    try { const result = await send("create-westfields-poc", {}) as { project: Project }; setProjectId(result.project.id); await load(result.project.id); setMessage("Westfields No. 16 proof created. Attach the uploaded driver swing next."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create proof project"); }
    finally { setBusy(false); }
  }

  function move(direction: -1 | 1) {
    if (!project) return;
    const index = Math.max(0, Math.min(stages.indexOf(project.status) + direction, stages.length - 1));
    if (stages[index] !== project.status) void act("move-project", { projectId, status: stages[index] }, `Moved to ${labels[stages[index]]}.`);
  }

  return <div className="production-workspace">
    <div className="production-toolbar"><div><p className="eyebrow">Production engine workspace</p><h3>Build the first composited round.</h3></div><div className="engine-toolbar-actions"><button disabled={busy} onClick={() => void createWestfieldsProof()}>＋ Westfields 16 proof</button><span className={data.engineConnected ? "engine-connected" : "engine-disconnected"}>{data.engineConnected ? "MEDIA WORKER CONNECTED" : "MEDIA WORKER NOT CONNECTED"}</span></div></div>
    {!data.projects.length ? <><div className="proof-callout"><strong>Recommended first test</strong><span>Create the 384-yard Westfields No. 16 Boom Boom template, then attach your uploaded driver swing.</span></div><div className="project-create"><input value={projectDraft.title} onChange={(event) => setProjectDraft({ ...projectDraft, title: event.target.value })} placeholder="Project title" /><input value={projectDraft.courseName} onChange={(event) => setProjectDraft({ ...projectDraft, courseName: event.target.value })} placeholder="Course name" /><input type="date" value={projectDraft.roundDate} onChange={(event) => setProjectDraft({ ...projectDraft, roundDate: event.target.value })} /><button disabled={busy || !projectDraft.title.trim()} onClick={() => void createProject()}>Create custom project</button></div></> : <>
      <div className="project-selector"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{data.projects.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="project-stage"><button disabled={busy || project?.status === stages[0]} onClick={() => move(-1)}>← Previous stage</button><strong>{labels[project?.status ?? ""]}</strong><button disabled={busy || project?.status === stages.at(-1)} onClick={() => move(1)}>Next stage →</button></div></div>
      <div className="production-columns">
        <section><p className="eyebrow">01 · Source footage</p><h4>Attach and analyze real swings</h4>{footageAssets.length ? <div className="source-pick-list visual">{footageAssets.map((asset) => { const isAttached = attached.has(asset.id); const link = data.linkedAssets?.find((item) => item.assetId === asset.id); return <article key={asset.id}><video muted playsInline preload="metadata" src={`${asset.streamUrl}#t=0.1`} aria-label={`Frame preview of ${asset.fileName}`} /><div><strong>{asset.notes || asset.fileName}</strong><small>{asset.category} · {link?.analysisStatus ?? "not attached"}</small><small className="source-file-name">{asset.fileName}</small></div>{!isAttached ? <button disabled={busy} onClick={() => void act("attach-asset", { projectId, assetId: asset.id }, "Source video attached.")}>Attach</button> : <button disabled={busy || !data.engineConnected} title={!data.engineConnected ? "Connect the media worker first" : "Analyze footage"} onClick={() => void act("request-job", { projectId, assetId: asset.id, kind: "analyze-footage" }, "Footage analysis queued.")}>Analyze</button>}</article>; })}</div> : <p className="production-empty">Upload source videos before assigning footage.</p>}</section>
        <section><p className="eyebrow">02 · Arccos shots</p><h4>Add verified shot data</h4><div className="course-reference-block"><div><strong>Hole visual reference</strong><small>Upload an Arccos hole screenshot or licensed course image under Source videos → Course / hole reference.</small></div>{courseReferences.length ? <div className="course-reference-list">{courseReferences.map((asset) => <article key={asset.id}><img src={asset.streamUrl} alt={`Course reference ${asset.fileName}`} /><span>{asset.notes || asset.fileName}</span><button disabled={busy || attached.has(asset.id)} onClick={() => void act("attach-asset", { projectId, assetId: asset.id }, "Course reference attached.")}>{attached.has(asset.id) ? "Attached" : "Use for hole"}</button></article>)}</div> : <p>No course reference uploaded yet.</p>}</div><div className="shot-form"><label><span>Hole number</span><input type="number" min="1" max="18" value={shot.hole} onChange={(event) => setShot({ ...shot, hole: event.target.value })} /></label><label><span>Shot number</span><input type="number" min="1" value={shot.shotNumber} onChange={(event) => setShot({ ...shot, shotNumber: event.target.value })} /></label><label><span>Club</span><input value={shot.club} onChange={(event) => setShot({ ...shot, club: event.target.value })} /></label><label><span>Starting lie / point</span><input value={shot.startPoint} onChange={(event) => setShot({ ...shot, startPoint: event.target.value })} /></label><label><span>Ending lie / point</span><input value={shot.endPoint} onChange={(event) => setShot({ ...shot, endPoint: event.target.value })} /></label><label><span>Shot distance (yards)</span><input type="number" placeholder="Optional" value={shot.distanceYards} onChange={(event) => setShot({ ...shot, distanceYards: event.target.value })} /></label><button disabled={busy} onClick={() => void act("add-shot", { projectId, ...shot }, "Arccos shot added.")}>Add shot</button></div><div className="shot-list">{(data.shots ?? []).map((item) => <article className={item.dataSource === "synthetic-proof" ? "synthetic" : ""} key={item.id}><b>Hole {item.hole} · Shot {item.shotNumber}</b><span>{item.club}</span><small>{item.startPoint} → {item.endPoint}{item.distanceYards ? ` · ${item.distanceYards} yd` : ""}</small>{item.dataSource === "synthetic-proof" ? <em>SIMULATED PROOF INPUT</em> : null}</article>)}</div></section>
      </div>
      <section className="launch-profile-panel"><div><p className="eyebrow">MLM2PRO launch library</p><h4>Calibrate future flights to your swing.</h4><p>Optional for this flow test. The Westfields preview remains clearly synthetic until a driver profile exists.</p></div><div className="launch-form"><input aria-label="Launch club" value={launch.club} onChange={(event) => setLaunch({ ...launch, club: event.target.value })} /><input aria-label="Ball speed" placeholder="Ball mph" value={launch.ballSpeedMph} onChange={(event) => setLaunch({ ...launch, ballSpeedMph: event.target.value })} /><input aria-label="Launch angle" placeholder="Launch °" value={launch.launchAngle} onChange={(event) => setLaunch({ ...launch, launchAngle: event.target.value })} /><input aria-label="Spin" placeholder="Spin rpm" value={launch.spinRpm} onChange={(event) => setLaunch({ ...launch, spinRpm: event.target.value })} /><input aria-label="Carry" placeholder="Carry yd" value={launch.carryYards} onChange={(event) => setLaunch({ ...launch, carryYards: event.target.value })} /><input aria-label="Apex" placeholder="Apex ft" value={launch.apexFeet} onChange={(event) => setLaunch({ ...launch, apexFeet: event.target.value })} /><button disabled={busy} onClick={() => void act("add-launch-sample", launch, "MLM2PRO sample saved.")}>Save sample</button></div><span className="sample-count">{data.profiles?.filter((item) => item.club.toLowerCase() === "driver").length ?? 0} driver samples</span></section>
      <div className="flow-readiness"><span className={attached.size ? "ready" : "waiting"}>1 · {attached.size ? "Footage attached" : "Attach driver footage"}</span><span className={(data.shots ?? []).length ? "ready" : "waiting"}>2 · {(data.shots ?? []).length ? "Shot input ready" : "Add shot input"}</span><span className={data.engineConnected ? "ready" : "waiting"}>3 · {data.engineConnected ? "Worker connected" : "Worker connection pending"}</span></div>
      <div className="render-bar"><div><p className="eyebrow">Preview render</p><strong>Composite approved swings, course scenes, tracer and shot graphics.</strong><small>{data.engineConnected ? "The connected media worker will return a playable draft here." : "Connect the external media worker before rendering. Projects and shot plans can be prepared now."}</small></div><button disabled={busy || !data.engineConnected || !(data.shots ?? []).length} onClick={() => void act("request-job", { projectId, kind: "render-preview" }, "Preview render queued.")}>Generate preview</button></div>
      {(data.jobs ?? []).length ? <div className="job-list">{data.jobs?.slice(0, 5).map((job) => <article key={job.id}><span>{job.kind}</span><b>{job.status}</b>{job.outputUrl ? <a href={job.outputUrl} target="_blank" rel="noreferrer">Open render ↗</a> : null}{job.error ? <small>{job.error}</small> : null}</article>)}</div> : null}
    </>}
    {message ? <p className="production-notice" aria-live="polite">{message}</p> : null}
  </div>;
}
