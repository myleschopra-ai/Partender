import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contentItems } from "../../../db/schema";

const statuses = new Set(["inbox", "develop", "production", "review", "published"]);

const seedItems = [
  { title: "What a +0.5 sees from 150", pillar: "player", format: "Carousel", status: "inbox", nextAction: "Write the hook", priority: 2 },
  { title: "Why starting-hole design matters", pillar: "professional", format: "Reel", status: "inbox", nextAction: "Set the privacy-safe angle", priority: 3 },
  { title: "The shot Arccos got wrong", pillar: "technology", format: "Short", status: "inbox", nextAction: "Capture the corrected shot", priority: 1 },
  { title: "Played, Not Filmed · trailer", pillar: "flagship", format: "Trailer", status: "develop", nextAction: "Complete the creative brief", priority: 1 },
  { title: "Build the digital twin", pillar: "technology", format: "Build log", status: "develop", nextAction: "Choose the reference angles", priority: 2 },
  { title: "One tournament lesson", pillar: "professional", format: "Reel", status: "develop", nextAction: "Write the 20-second script", priority: 3 },
  { title: "Partender origin story", pillar: "brand", format: "Reel", status: "production", nextAction: "Assemble the first cut", priority: 2 },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected storage error";
}

export async function GET() {
  try {
    const db = await getDb();
    let items = await db.select().from(contentItems).orderBy(asc(contentItems.priority), asc(contentItems.id));
    if (items.length === 0) {
      await db.insert(contentItems).values(seedItems);
      items = await db.select().from(contentItems).orderBy(asc(contentItems.priority), asc(contentItems.id));
    }
    return Response.json({ items });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { title?: string; pillar?: string; format?: string };
    const title = body.title?.trim() ?? "";
    if (!title || title.length > 180) return Response.json({ error: "Title must be 1–180 characters" }, { status: 400 });
    const db = await getDb();
    const [item] = await db.insert(contentItems).values({
      title,
      pillar: body.pillar?.trim().slice(0,40) || "player",
      format: body.format?.trim().slice(0,40) || "Short-form",
    }).returning();
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: number; status?: string };
    if (!Number.isInteger(body.id) || !body.status || !statuses.has(body.status)) return Response.json({ error: "Valid id and status are required" }, { status: 400 });
    const db = await getDb();
    const [item] = await db.update(contentItems).set({ status: body.status, updatedAt: new Date().toISOString() }).where(eq(contentItems.id, body.id as number)).returning();
    if (!item) return Response.json({ error: "Content item not found" }, { status: 404 });
    return Response.json({ item });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
