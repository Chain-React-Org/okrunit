import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const visitSchema = z.object({
  visitorId: z.string().min(1),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  referrer: z.string().optional(),
  landingPage: z.string().optional(),
  deviceType: z.string().optional(),
  browser: z.string().optional(),
  // Duration update (sent on page unload)
  duration: z.number().int().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const body = visitSchema.parse(await request.json());
    const admin = createAdminClient();

    // Duration update: patch the most recent visit for this visitor
    if (body.duration) {
      await admin
        .from("visitor_tracking")
        .update({ duration_seconds: body.duration })
        .eq("visitor_id", body.visitorId)
        .is("duration_seconds", null)
        .order("visited_at", { ascending: false })
        .limit(1);

      return NextResponse.json({ success: true });
    }

    // New visit
    await admin.from("visitor_tracking").insert({
      visitor_id: body.visitorId,
      utm_source: body.utmSource || null,
      utm_medium: body.utmMedium || null,
      utm_campaign: body.utmCampaign || null,
      referrer: body.referrer || null,
      landing_page: body.landingPage || null,
      device_type: body.deviceType || null,
      browser: body.browser || null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
