// Shared (client + server) facts about SOP media uploads. No DB access here, so this is safe
// to import from Client Components — unlike `./mutations`, which is server-only.

// Supabase's project-wide storage limit. Uploads go straight from the browser to Storage, so
// this is the only ceiling left on the path; raise it in the Supabase dashboard
// (Settings → Storage → Upload file size limit) if SOP videos need to be bigger.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaType = "image" | "video";

export function mediaTypeFor(contentType: string): MediaType {
  return contentType.startsWith("video") ? "video" : "image";
}

// Objects are laid out per media type inside each platform's bucket.
export function storagePathFor(mediaType: MediaType): string {
  return mediaType === "video" ? "ai_agent/video" : "ai_agent/image";
}
