// ---------------------------------------------------------------------------
// OKrunit -- Org Switch API: Switch Active Organization
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Validation -----------------------------------------------------------

const switchOrgSchema = z.object({
  org_id: z.string().uuid("Invalid organization ID"),
});

// ---- POST /api/v1/org/switch ----------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can switch organizations");
    }

    let body: z.infer<typeof switchOrgSchema>;
    try {
      body = switchOrgSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    const admin = createAdminClient();

    // Verify the user has a membership in the target org.
    const { data: targetMembership } = await admin
      .from("org_memberships")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("org_id", body.org_id)
      .single();

    if (!targetMembership) {
      throw new ApiError(404, "Not a member of this organization");
    }

    // Clear the current default.
    await admin
      .from("org_memberships")
      .update({ is_default: false })
      .eq("user_id", auth.user.id)
      .eq("is_default", true);

    // Set the new default.
    await admin
      .from("org_memberships")
      .update({ is_default: true })
      .eq("user_id", auth.user.id)
      .eq("org_id", body.org_id);

    revalidateTags(CacheTags.orgContext(auth.user.id));

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
