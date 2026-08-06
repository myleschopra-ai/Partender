import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let mediaSchemaReady: Promise<void> | null = null;
let productionSchemaReady: Promise<void> | null = null;

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureMediaSchema() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Media metadata storage is not configured");
  if (!mediaSchemaReady) {
    mediaSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS media_assets (
        id text PRIMARY KEY NOT NULL,
        object_key text NOT NULL UNIQUE,
        file_name text NOT NULL,
        content_type text NOT NULL,
        byte_size integer NOT NULL,
        category text DEFAULT 'reference-swing' NOT NULL,
        notes text DEFAULT '' NOT NULL,
        status text DEFAULT 'uploading' NOT NULL,
        multipart_upload_id text,
        uploaded_by text,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        uploaded_at text
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS media_upload_parts (
        asset_id text NOT NULL,
        part_number integer NOT NULL,
        etag text NOT NULL,
        byte_size integer NOT NULL,
        created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY(asset_id, part_number),
        FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON UPDATE no action ON DELETE cascade
      )`),
    ]).then(() => undefined).catch((error: unknown) => {
      mediaSchemaReady = null;
      throw error;
    });
  }
  return mediaSchemaReady;
}

export async function ensureProductionSchema() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Production storage is not configured");
  if (!productionSchemaReady) {
    productionSchemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_projects (id text PRIMARY KEY NOT NULL, title text NOT NULL, course_name text DEFAULT '' NOT NULL, round_date text DEFAULT '' NOT NULL, status text DEFAULT 'source-footage' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_assets (project_id text NOT NULL, asset_id text NOT NULL, analysis_status text DEFAULT 'not-requested' NOT NULL, analysis_json text, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, PRIMARY KEY(project_id, asset_id), FOREIGN KEY(project_id) REFERENCES production_projects(id) ON DELETE cascade, FOREIGN KEY(asset_id) REFERENCES media_assets(id) ON DELETE cascade)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_shots (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, hole integer NOT NULL, shot_number integer NOT NULL, club text NOT NULL, start_point text NOT NULL, end_point text NOT NULL, distance_yards integer, data_source text DEFAULT 'verified' NOT NULL, conditions_json text, asset_id text, status text DEFAULT 'needs-match' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY(project_id) REFERENCES production_projects(id) ON DELETE cascade, FOREIGN KEY(asset_id) REFERENCES media_assets(id) ON DELETE set null)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS launch_profiles (id text PRIMARY KEY NOT NULL, club text NOT NULL, source text DEFAULT 'MLM2PRO' NOT NULL, ball_speed_mph integer, launch_angle_tenths integer, launch_direction_tenths integer, spin_rpm integer, spin_axis_tenths integer, carry_yards integer, apex_feet integer, shot_type text DEFAULT '' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS production_jobs (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, asset_id text, kind text NOT NULL, status text DEFAULT 'queued' NOT NULL, provider_job_id text, output_url text, error text, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY(project_id) REFERENCES production_projects(id) ON DELETE cascade, FOREIGN KEY(asset_id) REFERENCES media_assets(id) ON DELETE set null)`),
    ]).then(() => undefined).catch((error: unknown) => { productionSchemaReady = null; throw error; });
  }
  return productionSchemaReady;
}
