import "server-only";

import { randomUUID } from "node:crypto";

import { getServerClient } from "@/lib/supabase/server";
import type {
  CategoryRow,
  KnowledgeBaseMediaRow,
  KnowledgeBaseRow,
} from "./types";

// Writes to ai_agent.knowledge_base and its media + storage objects. Service-role only.

export async function createCategory(fields: {
  platform_id: number;
  name: string;
  description: string | null;
}): Promise<CategoryRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base_categories")
    .insert({
      platform_id: fields.platform_id,
      name: fields.name,
      description: fields.description,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(
  id: number,
  patch: { name?: string; description?: string | null },
): Promise<CategoryRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base_categories")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Deleting a category would orphan any SOPs pointing at it, so refuse unless it's empty.
export async function deleteCategory(id: number): Promise<void> {
  const db = getServerClient();
  const { count, error: countErr } = await db
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    throw new Error(
      `Category has ${count} SOP(s). Move or delete them before deleting the category.`,
    );
  }
  const { error } = await db
    .from("knowledge_base_categories")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export interface SopPatch {
  title?: string;
  content?: string;
  category_id?: number;
  is_come_back?: boolean;
  data_source?: string;
  product_tags?: number[];
  vehicle_tags?: string[];
  driver_status_tags?: string[];
}

export async function updateSop(
  id: number,
  patch: SopPatch,
): Promise<KnowledgeBaseRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export interface NewSop {
  platform_id: number;
  category_id: number;
  title: string;
  content: string;
  is_come_back?: boolean;
  data_source?: string;
  product_tags?: number[];
  vehicle_tags?: string[];
  driver_status_tags?: string[];
}

export async function createSop(fields: NewSop): Promise<KnowledgeBaseRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base")
    .insert({
      platform_id: fields.platform_id,
      category_id: fields.category_id,
      title: fields.title,
      content: fields.content,
      is_come_back: fields.is_come_back ?? false,
      data_source: fields.data_source ?? "human",
      product_tags: fields.product_tags ?? [],
      vehicle_tags: fields.vehicle_tags ?? [],
      driver_status_tags: fields.driver_status_tags ?? [],
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Remove storage objects for a set of media rows, grouped by bucket.
async function removeMediaObjects(rows: KnowledgeBaseMediaRow[]): Promise<void> {
  const db = getServerClient();
  const byBucket = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.bucket || !r.path || !r.filename) continue;
    const keys = byBucket.get(r.bucket) ?? [];
    keys.push(`${r.path}/${r.filename}`);
    byBucket.set(r.bucket, keys);
  }
  await Promise.all(
    [...byBucket].map(async ([bucket, keys]) => {
      const { error } = await db.storage.from(bucket).remove(keys);
      if (error) throw error;
    }),
  );
}

export async function deleteSop(id: number): Promise<void> {
  const db = getServerClient();
  const { data: media, error: mediaErr } = await db
    .from("knowledge_base_media")
    .select("*")
    .eq("knowledge_base_id", id);
  if (mediaErr) throw mediaErr;

  if (media && media.length > 0) {
    await removeMediaObjects(media as KnowledgeBaseMediaRow[]);
    const { error } = await db
      .from("knowledge_base_media")
      .delete()
      .eq("knowledge_base_id", id);
    if (error) throw error;
  }

  const { error } = await db.from("knowledge_base").delete().eq("id", id);
  if (error) throw error;
}

// Look up the storage bucket for a SOP via its platform (public.platforms.bucket).
async function bucketForSop(sopId: number): Promise<string> {
  const db = getServerClient();
  const { data: sop, error } = await db
    .from("knowledge_base")
    .select("platform_id")
    .eq("id", sopId)
    .single();
  if (error) throw error;

  const { data: platform, error: pErr } = await db
    .schema("public")
    .from("platforms")
    .select("bucket")
    .eq("id", sop.platform_id)
    .single();
  if (pErr) throw pErr;
  if (!platform?.bucket) {
    throw new Error(`platform ${sop.platform_id} has no storage bucket configured`);
  }
  return platform.bucket as string;
}

function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  return `${randomUUID()}${ext.replace(/[^a-z0-9.]/g, "")}`;
}

export interface UploadInput {
  sopId: number;
  body: ArrayBuffer;
  contentType: string;
  originalName: string;
  description: string | null;
}

export async function uploadSopMedia(input: UploadInput): Promise<KnowledgeBaseMediaRow> {
  const db = getServerClient();
  const bucket = await bucketForSop(input.sopId);
  const mediaType = input.contentType.startsWith("video") ? "video" : "image";
  const path = mediaType === "video" ? "ai_agent/video" : "ai_agent/image";
  const filename = sanitizeFilename(input.originalName);

  const { error: upErr } = await db.storage
    .from(bucket)
    .upload(`${path}/${filename}`, input.body, {
      contentType: input.contentType,
      upsert: false,
    });
  if (upErr) throw upErr;

  // Append after the current last attachment.
  const { data: existing } = await db
    .from("knowledge_base_media")
    .select("index")
    .eq("knowledge_base_id", input.sopId)
    .order("index", { nullsFirst: false })
    .limit(1);
  const nextIndex = (existing?.[0]?.index ?? 0) + 1;

  const { data, error } = await db
    .from("knowledge_base_media")
    .insert({
      knowledge_base_id: input.sopId,
      bucket,
      path,
      filename,
      media_type: mediaType,
      description: input.description,
      index: nextIndex,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSopMedia(mediaId: number): Promise<void> {
  const db = getServerClient();
  const { data: row, error } = await db
    .from("knowledge_base_media")
    .select("*")
    .eq("id", mediaId)
    .single();
  if (error) throw error;

  await removeMediaObjects([row as KnowledgeBaseMediaRow]);
  const { error: delErr } = await db
    .from("knowledge_base_media")
    .delete()
    .eq("id", mediaId);
  if (delErr) throw delErr;
}

export async function updateMediaDescription(
  mediaId: number,
  description: string | null,
): Promise<void> {
  const db = getServerClient();
  const { error } = await db
    .from("knowledge_base_media")
    .update({ description })
    .eq("id", mediaId);
  if (error) throw error;
}

// Persist a new order by writing each id's position to its `index`.
export async function reorderMedia(orderedIds: number[]): Promise<void> {
  const db = getServerClient();
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .from("knowledge_base_media")
        .update({ index: i + 1 })
        .eq("id", id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ),
  );
}
