import "server-only";

import { randomUUID } from "node:crypto";

import { getServerClient } from "@/lib/supabase/server";
import { type MediaType, mediaTypeFor, storagePathFor } from "./media";
import { renameToken, tokensIn } from "./variables";
import type {
  CategoryRow,
  ChangeKind,
  KnowledgeBaseMediaRow,
  KnowledgeBaseRow,
  KnowledgeBaseVersionRow,
  SopVariableRow,
} from "./types";

// Writes to ai_agent.knowledge_base and its media + storage objects. Service-role only.

// --- Versions --------------------------------------------------------------------------------
// A trigger (db/sop-versions.sql) snapshots a SOP into knowledge_base_versions on every save
// that changes an editable field. It can't know who saved or why — it only sees the row — so
// every SOP write here goes through writeSop: note the latest version number, write, then label
// the version the trigger just created, and only that one. If nothing editable changed, the
// trigger wrote nothing and nothing gets labelled.

export interface ChangeLabel {
  kind: ChangeKind;
  // The signed-in user's email.
  by: string | null;
}

async function latestVersionNo(sopId: number): Promise<number> {
  const db = getServerClient();
  const { data, error } = await db
    .from("knowledge_base_versions")
    .select("version_no")
    .eq("knowledge_base_id", sopId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.version_no ?? 0;
}

// Best-effort on purpose: by the time this runs the save has gone through, and an error here
// would tell the writer their save failed when it didn't. A label that doesn't land leaves an
// honest "unknown" in the history.
async function labelVersionsAfter(
  sopId: number,
  after: number,
  label: ChangeLabel,
): Promise<void> {
  const db = getServerClient();
  const { error } = await db
    .from("knowledge_base_versions")
    .update({ change_kind: label.kind, changed_by: label.by })
    .eq("knowledge_base_id", sopId)
    .gt("version_no", after)
    .is("change_kind", null);
  if (error) console.error(`Could not label the new version of SOP ${sopId}: ${error.message}`);
}

async function writeSop(
  id: number,
  patch: SopPatch,
  label: ChangeLabel,
): Promise<KnowledgeBaseRow> {
  const db = getServerClient();
  const before = await latestVersionNo(id).catch((e: Error) => {
    console.error(`Could not read versions of SOP ${id}: ${e.message}`);
    return null;
  });

  const { data, error } = await db
    .from("knowledge_base")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  if (before !== null) await labelVersionsAfter(id, before, label);
  return data;
}

// Restoring never rewrites history: the old fields go back through updateSop, so the body is
// checked against today's variables (a placeholder renamed or deleted since is refused, as on
// any save) and the restore is itself a new version.
export async function restoreSopVersion(
  id: number,
  versionNo: number,
  by: string | null,
): Promise<KnowledgeBaseRow> {
  const db = getServerClient();
  const { data: v, error } = await db
    .from("knowledge_base_versions")
    .select("*")
    .eq("knowledge_base_id", id)
    .eq("version_no", versionNo)
    .maybeSingle();
  if (error) throw error;
  const version = v as KnowledgeBaseVersionRow | null;
  if (!version) throw new Error(`Version ${versionNo} of this SOP no longer exists.`);

  const patch: SopPatch = {
    content: version.content ?? "",
    is_come_back: version.is_come_back ?? false,
    product_tags: version.product_tags ?? [],
    vehicle_tags: version.vehicle_tags ?? [],
    driver_status_tags: version.driver_status_tags ?? [],
  };
  if (version.title !== null) patch.title = version.title;
  if (version.category_id !== null) patch.category_id = Number(version.category_id);
  return updateSop(id, patch, by, "restore");
}

// --- Variables -------------------------------------------------------------------------------
// knowledge_base.content holds {{TOKEN}}s. Nothing substitutes them here: the index rebuild does
// it once, on the way into the vector store, which is the only path from a SOP to the agent.
// What this layer guarantees is that a token in a body always has a variable behind it.

async function variableNames(platformId: number): Promise<Set<string>> {
  const db = getServerClient();
  const { data, error } = await db
    .from("sop_variables")
    .select("name")
    .eq("platform_id", platformId);
  if (error) throw error;
  return new Set((data ?? []).map((v) => v.name));
}

// A body referencing a variable that doesn't exist would survive all the way into an embedding
// as a literal "{{NAME}}", so refuse the write.
async function assertTokensDefined(content: string, platformId: number): Promise<void> {
  const defined = await variableNames(platformId);
  const missing = tokensIn(content).filter((t) => !defined.has(t));
  if (missing.length > 0) {
    throw new Error(
      `No variable named ${missing.map((m) => `"${m}"`).join(", ")} on this platform. ` +
        `Create it first, or remove the placeholder.`,
    );
  }
}

export async function createVariable(fields: {
  platform_id: number;
  name: string;
  value: string;
  description: string | null;
}): Promise<SopVariableRow> {
  const db = getServerClient();
  const { data, error } = await db
    .from("sop_variables")
    .insert(fields)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariable(
  id: number,
  patch: { name?: string; value?: string; description?: string | null },
  by: string | null,
): Promise<{ variable: SopVariableRow; rewritten: number }> {
  const db = getServerClient();

  const { data: before, error: readErr } = await db
    .from("sop_variables")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr) throw readErr;

  // A rename has to move every reference with it, or those bodies point at nothing. A value
  // change rewrites nothing at all — the token stays put and resolves to the new value.
  let rewritten = 0;
  if (patch.name && patch.name !== before.name) {
    const { data: rows, error } = await db
      .from("knowledge_base")
      .select("id,content")
      .eq("platform_id", before.platform_id);
    if (error) throw error;
    for (const row of rows ?? []) {
      if (!row.content) continue;
      const next = renameToken(row.content, before.name, patch.name);
      if (next === row.content) continue;
      // Each rewritten body is a version of its own, labelled so history shows the rename for
      // what it is rather than as a hand edit.
      await writeSop(row.id, { content: next }, { kind: "variable_rename", by });
      rewritten++;
    }
  }

  const { data, error } = await db
    .from("sop_variables")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  return { variable: data, rewritten };
}

// Deleting a variable still referenced would leave a literal "{{NAME}}" to be embedded, so refuse
// and say where it is used.
export async function deleteVariable(id: number): Promise<void> {
  const db = getServerClient();
  const { data: variable, error: readErr } = await db
    .from("sop_variables")
    .select("*")
    .eq("id", id)
    .single();
  if (readErr) throw readErr;

  const { data: rows, error } = await db
    .from("knowledge_base")
    .select("id,title,content")
    .eq("platform_id", variable.platform_id);
  if (error) throw error;

  const used = (rows ?? []).filter((r) => tokensIn(r.content).includes(variable.name));
  if (used.length > 0) {
    const names = used
      .slice(0, 3)
      .map((r) => `"${r.title ?? `#${r.id}`}"`)
      .join(", ");
    throw new Error(
      `"${variable.name}" is still used by ${used.length} SOP${used.length === 1 ? "" : "s"} ` +
        `(${names}${used.length > 3 ? ", …" : ""}). Remove the placeholder from those first.`,
    );
  }

  const { error: delErr } = await db.from("sop_variables").delete().eq("id", id);
  if (delErr) throw delErr;
}

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
  by: string | null,
  kind: ChangeKind = "edit",
): Promise<KnowledgeBaseRow> {
  const db = getServerClient();

  if (patch.content !== undefined) {
    const { data: row, error: readErr } = await db
      .from("knowledge_base")
      .select("platform_id")
      .eq("id", id)
      .single();
    if (readErr) throw readErr;
    await assertTokensDefined(patch.content, row.platform_id as number);
  }

  return writeSop(id, patch, { kind, by });
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

export async function createSop(fields: NewSop, by: string | null): Promise<KnowledgeBaseRow> {
  const db = getServerClient();
  await assertTokensDefined(fields.content, fields.platform_id);
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
  // The insert trigger wrote version 1; label it.
  await labelVersionsAfter(data.id, 0, { kind: "create", by });
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

// Only names minted by sanitizeFilename above are accepted back from the client.
const MINTED_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/;

export interface UploadTicket {
  bucket: string;
  key: string;
  token: string;
  filename: string;
  mediaType: MediaType;
}

// Media bytes never pass through this app. A route handler taking the file would have to clear
// two body-size ceilings, and video clears neither: Vercel caps a function's request body at
// 4.5MB (413 FUNCTION_PAYLOAD_TOO_LARGE — not raisable by any config), and Next buffers proxied
// bodies at 10MB, silently truncating past that so formData() throws. So the server mints a
// one-shot signed upload URL and the browser PUTs straight to Supabase Storage; only this small
// JSON crosses the app. The remaining limit is Supabase's own (MAX_UPLOAD_BYTES).
export async function createUploadTicket(input: {
  sopId: number;
  contentType: string;
  originalName: string;
}): Promise<UploadTicket> {
  const db = getServerClient();
  const bucket = await bucketForSop(input.sopId);
  const mediaType = mediaTypeFor(input.contentType);
  const filename = sanitizeFilename(input.originalName);
  const key = `${storagePathFor(mediaType)}/${filename}`;

  const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(key);
  if (error) throw error;
  return { bucket, key, token: data.token, filename, mediaType };
}

export interface RegisterInput {
  sopId: number;
  filename: string;
  mediaType: MediaType;
  description: string | null;
}

// Record an object the browser has already uploaded with a ticket from createUploadTicket.
// The client sends back only the filename it was issued: bucket and path are re-derived from
// the SOP here, and the object must really exist, so a forged request can't point a media row
// at an arbitrary storage key.
export async function registerSopMedia(input: RegisterInput): Promise<KnowledgeBaseMediaRow> {
  const db = getServerClient();
  if (!MINTED_FILENAME.test(input.filename)) {
    throw new Error("filename was not issued by this server");
  }
  const bucket = await bucketForSop(input.sopId);
  const path = storagePathFor(input.mediaType);

  const { data: found, error: listErr } = await db.storage
    .from(bucket)
    .list(path, { search: input.filename, limit: 1 });
  if (listErr) throw listErr;
  if (!found?.some((o) => o.name === input.filename)) {
    throw new Error("upload did not complete — object not found in storage");
  }

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
      filename: input.filename,
      media_type: input.mediaType,
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
