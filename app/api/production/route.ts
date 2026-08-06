import { and, desc, eq } from "drizzle-orm";
import { ensureMediaSchema, ensureProductionSchema, getDb } from "../../../db";
import { launchProfiles, mediaAssets, productionAssets, productionJobs, productionProjects, productionShots } from "../../../db/schema";

export const dynamic = "force-dynamic";

const projectStatuses = new Set(["source-footage", "round-data", "shot-match", "virtual-course", "composite", "flight", "editing", "review", "published"]);
const jobKinds = new Set(["analyze-footage", "render-preview", "render-final"]);

type EngineEnv = { PRODUCTION_ENGINE_URL?: string; PRODUCTION_ENGINE_TOKEN?: string };

function jsonError(message: string, status: number) { return Response.json({ error: message }, { status }); }
function clean(value: unknown, max = 180) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

async function engineConfig() {
  const { env } = await import("cloudflare:workers") as { env: EngineEnv };
  return { url: env.PRODUCTION_ENGINE_URL?.trim(), token: env.PRODUCTION_ENGINE_TOKEN?.trim() };
}

export async function GET(request: Request) {
  try {
    await ensureMediaSchema();
    await ensureProductionSchema();
    const db = await getDb();
    const projectId = new URL(request.url).searchParams.get("projectId");
    const [projects, assets, profiles, config] = await Promise.all([
      db.select().from(productionProjects).orderBy(desc(productionProjects.updatedAt)),
      db.select({ id: mediaAssets.id, fileName: mediaAssets.fileName, category: mediaAssets.category, notes: mediaAssets.notes }).from(mediaAssets).where(eq(mediaAssets.status, "ready")).orderBy(desc(mediaAssets.uploadedAt)),
      db.select().from(launchProfiles).orderBy(desc(launchProfiles.createdAt)),
      engineConfig(),
    ]);
    if (!projectId) return Response.json({ projects, assets, profiles, engineConnected: Boolean(config.url && config.token) });
    const [linkedAssets, shots, jobs] = await Promise.all([
      db.select().from(productionAssets).where(eq(productionAssets.projectId, projectId)),
      db.select().from(productionShots).where(eq(productionShots.projectId, projectId)),
      db.select().from(productionJobs).where(eq(productionJobs.projectId, projectId)).orderBy(desc(productionJobs.createdAt)),
    ]);
    return Response.json({ projects, assets, profiles, linkedAssets, shots, jobs, engineConnected: Boolean(config.url && config.token) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to open production engine", 500);
  }
}

export async function POST(request: Request) {
  try {
    await ensureMediaSchema();
    await ensureProductionSchema();
    const db = await getDb();
    const action = new URL(request.url).searchParams.get("action");
    const body = await request.json() as Record<string, unknown>;

    if (action === "create-project") {
      const title = clean(body.title);
      if (!title) return jsonError("Project title is required", 400);
      const project = { id: crypto.randomUUID(), title, courseName: clean(body.courseName), roundDate: clean(body.roundDate, 10) };
      await db.insert(productionProjects).values(project);
      return Response.json({ project: { ...project, status: "source-footage" } }, { status: 201 });
    }

    if (action === "create-westfields-poc") {
      const id = crypto.randomUUID();
      const project = { id, title: "Westfields 16 · Driver proof", courseName: "Westfields Golf Club · Hole 16 · Boom Boom tees", roundDate: "" };
      await db.insert(productionProjects).values(project);
      await db.insert(productionShots).values({
        id: crypto.randomUUID(), projectId: id, hole: 16, shotNumber: 1, club: "Driver",
        startPoint: "Boom Boom tee", endPoint: "Right-center fairway · editable demonstration target",
        distanceYards: null, dataSource: "synthetic-proof",
        conditionsJson: JSON.stringify({ wind: "neutral placeholder", elevation: "neutral placeholder", shape: "modest right-to-left", holeYardage: 384, disclosure: "Simulated proof-of-concept flight; not an actual recorded Westfields shot." }),
      });
      return Response.json({ project: { ...project, status: "source-footage" } }, { status: 201 });
    }

    if (action === "add-launch-sample") {
      const club = clean(body.club, 40);
      if (!club) return jsonError("Club is required", 400);
      const number = (value: unknown, multiplier = 1) => {
        if (value === "" || value === null || value === undefined) return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.round(parsed * multiplier) : null;
      };
      const profile = {
        id: crypto.randomUUID(), club, source: "MLM2PRO",
        ballSpeedMph: number(body.ballSpeedMph), launchAngleTenths: number(body.launchAngle, 10),
        launchDirectionTenths: number(body.launchDirection, 10), spinRpm: number(body.spinRpm),
        spinAxisTenths: number(body.spinAxis, 10), carryYards: number(body.carryYards), apexFeet: number(body.apexFeet),
        shotType: clean(body.shotType, 40),
      };
      if ([profile.ballSpeedMph, profile.launchAngleTenths, profile.spinRpm, profile.carryYards].every((value) => value === null)) return jsonError("Enter at least one MLM2PRO metric", 400);
      await db.insert(launchProfiles).values(profile);
      return Response.json({ profile }, { status: 201 });
    }

    const projectId = clean(body.projectId, 80);
    if (!projectId) return jsonError("Project is required", 400);
    const [project] = await db.select().from(productionProjects).where(eq(productionProjects.id, projectId)).limit(1);
    if (!project) return jsonError("Production project not found", 404);

    if (action === "attach-asset") {
      const assetId = clean(body.assetId, 80);
      const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.id, assetId), eq(mediaAssets.status, "ready"))).limit(1);
      if (!asset) return jsonError("Choose a production-ready source video", 400);
      await db.insert(productionAssets).values({ projectId, assetId }).onConflictDoNothing();
      return Response.json({ ok: true });
    }

    if (action === "add-shot") {
      const hole = Number(body.hole); const shotNumber = Number(body.shotNumber); const distanceYards = body.distanceYards === "" ? null : Number(body.distanceYards);
      const club = clean(body.club, 40); const startPoint = clean(body.startPoint, 120); const endPoint = clean(body.endPoint, 120);
      if (!Number.isInteger(hole) || hole < 1 || hole > 18 || !Number.isInteger(shotNumber) || shotNumber < 1 || !club || !startPoint || !endPoint) return jsonError("Enter a valid hole, shot, club, beginning point and end point", 400);
      const shot = { id: crypto.randomUUID(), projectId, hole, shotNumber, club, startPoint, endPoint, distanceYards: Number.isFinite(distanceYards) ? distanceYards : null, dataSource: clean(body.dataSource, 30) || "verified", conditionsJson: clean(body.conditionsJson, 2000) || null };
      await db.insert(productionShots).values(shot);
      return Response.json({ shot }, { status: 201 });
    }

    if (action === "move-project") {
      const status = clean(body.status, 40);
      if (!projectStatuses.has(status)) return jsonError("Choose a valid production stage", 400);
      await db.update(productionProjects).set({ status, updatedAt: new Date().toISOString() }).where(eq(productionProjects.id, projectId));
      return Response.json({ ok: true });
    }

    if (action === "request-job") {
      const kind = clean(body.kind, 40); const assetId = clean(body.assetId, 80) || null;
      if (!jobKinds.has(kind)) return jsonError("Choose a valid production job", 400);
      if (kind === "analyze-footage" && !assetId) return jsonError("Choose footage to analyze", 400);
      const config = await engineConfig();
      if (!config.url || !config.token) return jsonError("The media worker is not connected yet. Configure PRODUCTION_ENGINE_URL and PRODUCTION_ENGINE_TOKEN before requesting analysis or renders.", 503);
      const jobId = crypto.randomUUID();
      let asset: typeof mediaAssets.$inferSelect | null = null;
      if (assetId) [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
      await db.insert(productionJobs).values({ id: jobId, projectId, assetId, kind, status: "dispatching" });
      const callbackUrl = new URL("/api/production?action=job-callback", request.url).toString();
      const response = await fetch(config.url, { method: "POST", headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" }, body: JSON.stringify({ jobId, kind, project, asset: asset ? { id: asset.id, objectKey: asset.objectKey, contentType: asset.contentType, fileName: asset.fileName } : null, callbackUrl }) });
      if (!response.ok) {
        const message = `Media worker rejected the job (${response.status})`;
        await db.update(productionJobs).set({ status: "failed", error: message, updatedAt: new Date().toISOString() }).where(eq(productionJobs.id, jobId));
        return jsonError(message, 502);
      }
      const result = await response.json().catch(() => ({})) as { providerJobId?: string };
      await db.update(productionJobs).set({ status: "queued", providerJobId: clean(result.providerJobId, 180) || null, updatedAt: new Date().toISOString() }).where(eq(productionJobs.id, jobId));
      if (kind === "analyze-footage" && assetId) await db.update(productionAssets).set({ analysisStatus: "queued", updatedAt: new Date().toISOString() }).where(and(eq(productionAssets.projectId, projectId), eq(productionAssets.assetId, assetId)));
      return Response.json({ jobId }, { status: 202 });
    }

    return jsonError("Unknown production action", 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Production request failed", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const action = new URL(request.url).searchParams.get("action");
    if (action !== "job-callback") return jsonError("Unknown production action", 400);
    const config = await engineConfig();
    if (!config.token || request.headers.get("authorization") !== `Bearer ${config.token}`) return jsonError("Unauthorized callback", 401);
    await ensureProductionSchema();
    const db = await getDb();
    const body = await request.json() as Record<string, unknown>;
    const jobId = clean(body.jobId, 80); const status = clean(body.status, 30);
    if (!jobId || !new Set(["processing", "complete", "failed"]).has(status)) return jsonError("Invalid job callback", 400);
    const [job] = await db.select().from(productionJobs).where(eq(productionJobs.id, jobId)).limit(1);
    if (!job) return jsonError("Production job not found", 404);
    await db.update(productionJobs).set({ status, outputUrl: clean(body.outputUrl, 1000) || null, error: clean(body.error, 500) || null, updatedAt: new Date().toISOString() }).where(eq(productionJobs.id, jobId));
    if (job.kind === "analyze-footage" && job.assetId) await db.update(productionAssets).set({ analysisStatus: status, analysisJson: body.analysis ? JSON.stringify(body.analysis).slice(0, 20000) : null, updatedAt: new Date().toISOString() }).where(and(eq(productionAssets.projectId, job.projectId), eq(productionAssets.assetId, job.assetId)));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Callback failed", 500);
  }
}
