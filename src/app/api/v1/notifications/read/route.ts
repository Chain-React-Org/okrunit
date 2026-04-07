// ---------------------------------------------------------------------------
// OKrunit -- Mark Notifications as Read
// ---------------------------------------------------------------------------
// POST with { id } marks a single notification as read.
// POST with { all: true } marks all of the user's notifications as read.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (body.clear === true) {
    const { error } = await admin
      .from("in_app_notifications")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to clear notifications" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.all === true) {
    let query = admin
      .from("in_app_notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);

    // Optional: only mark notifications created before a cutoff timestamp.
    // This lets callers preserve new notifications that arrive after page load.
    if (body.before) {
      query = query.lte("created_at", body.before);
    }

    const { error } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await admin
      .from("in_app_notifications")
      .update({ is_read: true, read_at: now })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide 'id' or 'all: true'" }, { status: 400 });
}
