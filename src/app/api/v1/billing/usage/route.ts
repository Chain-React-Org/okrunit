import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getUsageSummary } from "@/lib/billing/enforce";

export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const summary = await getUsageSummary(ctx.org.id);

  return NextResponse.json(summary);
}
