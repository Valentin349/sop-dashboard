import { NextResponse } from "next/server";

import { createUploadTicket } from "@/lib/sops/mutations";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/sops/media";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

// Hands the browser a one-shot signed URL for uploading one media object straight to Supabase
// Storage. The file itself never touches this app — see the note on createUploadTicket.
export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;

  const body = await req.json().catch(() => null);
  const sop = Number(body?.sop);
  const filename = typeof body?.filename === "string" ? body.filename : "";
  const contentType =
    typeof body?.contentType === "string" && body.contentType
      ? body.contentType
      : "application/octet-stream";
  const size = Number(body?.size);

  if (!Number.isInteger(sop) || !filename) {
    return NextResponse.json({ error: "sop and filename are required" }, { status: 400 });
  }
  // Storage would reject this anyway, but only after the browser pushed the whole file.
  if (Number.isFinite(size) && size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `"${filename}" is ${formatBytes(size)}. The storage limit is ${formatBytes(
          MAX_UPLOAD_BYTES,
        )} per file.`,
      },
      { status: 413 },
    );
  }

  try {
    const ticket = await createUploadTicket({
      sopId: sop,
      contentType,
      originalName: filename,
    });
    return NextResponse.json(ticket);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
