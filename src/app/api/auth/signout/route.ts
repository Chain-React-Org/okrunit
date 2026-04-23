// ---------------------------------------------------------------------------
// OKrunit -- Sign out
// ---------------------------------------------------------------------------
// POST /api/auth/signout
// Body: { returnTo?: string } (optional)
//
// Clears the Supabase auth session server-side. Used by forms that can't
// (or shouldn't) run supabase.auth.signOut() client-side, such as the
// /link landing page's "sign out and sign in as a different user" link.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function safeNext(nextParam: string | null | undefined): string {
  if (!nextParam) return "/login";
  // Only allow same-origin relative paths to avoid open redirects.
  if (nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return nextParam;
  }
  return "/login";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL(request.url);
  // Form posts can pass a `next` form field or a querystring.
  let next: string | null = url.searchParams.get("next");
  if (!next) {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData().catch(() => null);
      const n = form?.get("next");
      if (typeof n === "string") next = n;
    } else if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as { next?: string };
      if (typeof body.next === "string") next = body.next;
    }
  }

  const target = safeNext(next);
  return NextResponse.redirect(new URL(target, APP_URL), { status: 303 });
}
