import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let mediaSchemaReady: Promise<void> | null = null;

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
    ]).then(() => undefined).catch((error) => {
      mediaSchemaReady = null;
      throw error;
    });
  }
  return mediaSchemaReady;
}
