import { NextResponse } from "next/server";

import { listVariables } from "@/lib/sops/queries";
import { createVariable } from "@/lib/sops/mutations";
import { isValidVariableName } from "@/lib/sops/variables";
import { requireApi } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = await requireApi();
  if (g.error) return g.error;

  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  try {
    return NextResponse.json({ variables: await listVariables(platform) });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const g = await requireApi(true);
  if (g.error) return g.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid body" }, { status: 400 });

  const platform_id = Number(body.platform_id);
  const name = typeof body.name === "string" ? body.name.trim().toUpperCase() : "";
  const value = typeof body.value === "string" ? body.value : "";

  if (!Number.isInteger(platform_id)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  if (!isValidVariableName(name)) {
    return NextResponse.json(
      { error: "A name uses capitals, digits and underscores, and starts with a letter." },
      { status: 400 },
    );
  }
  if (!value.trim()) {
    return NextResponse.json({ error: "Give the variable a value." }, { status: 400 });
  }

  try {
    const variable = await createVariable({
      platform_id,
      name,
      value,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
    });
    return NextResponse.json({ variable });
  } catch (e) {
    const message = (e as Error).message;
    // The unique index is the only thing standing between two variables with one name.
    const conflict = message.includes("sop_variables_platform_name_key");
    return NextResponse.json(
      { error: conflict ? `"${name}" already exists on this platform.` : String(message) },
      { status: conflict ? 409 : 500 },
    );
  }
}
