// ---------------------------------------------------------------------------
// OKrunit -- Blog API: GET (list) + POST (create)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().max(500).default(""),
  content: z.string().default(""),
  category: z.string().max(50).default("Announcements"),
  read_time: z.string().max(20).default("3 min read"),
  published: z.boolean().default(false),
});

// GET /api/v1/blog -- list posts (public: published only, admin: all)
export async function GET() {
  const profile = await getAppAdminContext();
  const admin = createAdminClient();

  let query = admin
    .from("blog_posts")
    .select("id, slug, title, description, category, published, published_at, read_time, created_at, updated_at")
    .order("published_at", { ascending: false, nullsFirst: false });

  // Non-admins only see published posts
  if (!profile) {
    query = query.eq("published", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: data });
}

// POST /api/v1/blog -- create a new blog post (admin only)
export async function POST(request: Request) {
  const profile = await getAppAdminContext();
  if (!profile) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data: input } = parsed;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("blog_posts")
    .insert({
      ...input,
      author_id: profile.id,
      published_at: input.published ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A post with this slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
