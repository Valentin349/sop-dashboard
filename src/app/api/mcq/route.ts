import { NextResponse } from "next/server";

import { listMcqsByPlatform } from "@/lib/onboarding/queries";

export const dynamic = "force-dynamic";

// ?platform=<id> → the MCQs an onboarding topic on that platform may link to (the platform's own
// plus the platform-less ones). Read-only: the quizzes themselves are authored elsewhere.
export async function GET(req: Request) {
  const platform = Number(new URL(req.url).searchParams.get("platform"));
  if (!Number.isInteger(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const mcqs = await listMcqsByPlatform(platform);
  return NextResponse.json({ mcqs });
}
