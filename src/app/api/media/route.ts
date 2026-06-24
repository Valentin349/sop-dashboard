import { NextResponse } from "next/server";

import { listSopMedia } from "@/lib/sops/queries";
import {
  deleteSopMedia,
  reorderMedia,
  updateMediaDescription,
  uploadSopMedia,
} from "@/lib/sops/mutations";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sop = Number(new URL(req.url).searchParams.get("sop"));
  if (!Number.isInteger(sop)) {
    return NextResponse.json({ error: "invalid sop" }, { status: 400 });
  }
  const media = await listSopMedia(sop);
  return NextResponse.json({ media });
}

export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const form = await req.formData().catch(() => null);
  const sop = Number(form?.get("sop"));
  const file = form?.get("file");
  if (!Number.isInteger(sop) || !(file instanceof File)) {
    return NextResponse.json({ error: "sop and file are required" }, { status: 400 });
  }
  const description = form?.get("description");
  try {
    await uploadSopMedia({
      sopId: sop,
      body: await file.arrayBuffer(),
      contentType: file.type || "application/octet-stream",
      originalName: file.name,
      description: typeof description === "string" && description ? description : null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  try {
    await deleteSopMedia(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;
  const body = await req.json().catch(() => null);
  try {
    if (Array.isArray(body?.order)) {
      await reorderMedia(body.order.map(Number).filter(Number.isInteger));
      return NextResponse.json({ ok: true });
    }
    if (Number.isInteger(body?.id)) {
      await updateMediaDescription(
        body.id,
        typeof body.description === "string" ? body.description : null,
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}
