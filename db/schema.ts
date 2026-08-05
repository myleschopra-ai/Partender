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
