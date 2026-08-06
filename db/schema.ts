import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contentItems = sqliteTable("content_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  pillar: text("pillar").notNull().default("player"),
  format: text("format").notNull().default("Short-form"),
  channel: text("channel").notNull().default("Instagram"),
  status: text("status").notNull().default("inbox"),
  nextAction: text("next_action").notNull().default("Write the hook"),
  priority: integer("priority").notNull().default(3),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mediaAssets = sqliteTable("media_assets", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  category: text("category").notNull().default("reference-swing"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("uploading"),
  multipartUploadId: text("multipart_upload_id"),
  uploadedBy: text("uploaded_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  uploadedAt: text("uploaded_at"),
});

export const mediaUploadParts = sqliteTable("media_upload_parts", {
  assetId: text("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  partNumber: integer("part_number").notNull(),
  etag: text("etag").notNull(),
  byteSize: integer("byte_size").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.assetId, table.partNumber] }),
]);

export const productionProjects = sqliteTable("production_projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  courseName: text("course_name").notNull().default(""),
  roundDate: text("round_date").notNull().default(""),
  status: text("status").notNull().default("source-footage"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productionAssets = sqliteTable("production_assets", {
  projectId: text("project_id").notNull().references(() => productionProjects.id, { onDelete: "cascade" }),
  assetId: text("asset_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
  analysisStatus: text("analysis_status").notNull().default("not-requested"),
  analysisJson: text("analysis_json"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [primaryKey({ columns: [table.projectId, table.assetId] })]);

export const productionShots = sqliteTable("production_shots", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => productionProjects.id, { onDelete: "cascade" }),
  hole: integer("hole").notNull(),
  shotNumber: integer("shot_number").notNull(),
  club: text("club").notNull(),
  startPoint: text("start_point").notNull(),
  endPoint: text("end_point").notNull(),
  distanceYards: integer("distance_yards"),
  assetId: text("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  status: text("status").notNull().default("needs-match"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productionJobs = sqliteTable("production_jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => productionProjects.id, { onDelete: "cascade" }),
  assetId: text("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("queued"),
  providerJobId: text("provider_job_id"),
  outputUrl: text("output_url"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
