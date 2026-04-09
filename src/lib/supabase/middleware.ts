import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/security",
  "/sitemap.xml",
  "/robots.txt",
]);

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Skip auth validation for paths that don't need it. Saves a Supabase round-trip
  const pathname = request.nextUrl.pathname;
  const isPublicPath =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/mfa-verify") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/approve") ||
    pathname.startsWith("/reject") ||
    pathname.startsWith("/docs");

  if (isPublicPath) {
    supabaseResponse.headers.set("x-pathname", pathname);
    return supabaseResponse;
  }

  // Use getUser() instead of getSession() for server-side auth verification.
  // getSession() only reads from storage and doesn't validate with Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes - redirect unauthenticated users to login
  if (
    !user &&
    !pathname.startsWith("/invite")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";

    // For OAuth authorize requests, preserve the full URL so the user
    // returns to the consent page after login.
    if (request.nextUrl.pathname.startsWith("/oauth/authorize")) {
      url.searchParams.set("redirect_to", request.nextUrl.pathname + request.nextUrl.search);
    }

    return NextResponse.redirect(url);
  }

  // Enforce MFA: if user has TOTP enrolled but session is AAL1, redirect to verify
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    const url = request.nextUrl.clone();
    const redirectTo = pathname + request.nextUrl.search;
    url.pathname = "/mfa-verify";
    url.searchParams.set("redirect_to", redirectTo);
    return NextResponse.redirect(url);
  }

  // Expose the current pathname to server components via a custom header.
  supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);

  return supabaseResponse;
}
