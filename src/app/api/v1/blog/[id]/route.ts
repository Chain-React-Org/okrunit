// ---------------------------------------------------------------------------
// OKrunit -- Blog API: GET (single) + PUT (update) + DELETE
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  content: z.string().optional(),
  category: z.string().max(50).optional(),
  read_time: z.string().max(20).optional(),
  published: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/v1/blog/:id -- get a single post by ID (admin only, for editor)
export async function GET(_request: Request, { params }: RouteParams) {
  const profile = await getAppAdminContext();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

// PUT /api/v1/blog/:id -- update a blog post (admin only)
export async function PUT(request: Request, { params }: RouteParams) {
  const profile = await getAppAdminContext();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: input } = parsed;
  const admin = createAdminClient();

  // If publishing for the first time, set published_at
  const updates: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  if (input.published === true) {
    // Only set published_at if it wasn't already set
    const { data: existing } = await admin
      .from("blog_posts")
      .select("published_at")
      .eq("id", id)
      .single();

    if (existing && !existing.published_at) {
      updates.published_at = new Date().toISOString();
    }
  }

  const { data, error } = await admin
    .from("blog_posts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

// DELETE /api/v1/blog/:id -- delete a blog post (admin only)
export async function DELETE(_request: Request, { params }: RouteParams) {
  const profile = await getAppAdminContext();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("blog_posts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
