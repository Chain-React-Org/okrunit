// ---------------------------------------------------------------------------
// OKrunit -- Avatar Upload & Delete API
// ---------------------------------------------------------------------------
// POST: Upload a new avatar image (replaces any existing one)
// DELETE: Remove the current avatar
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

// ---- POST /api/v1/account/avatar ------------------------------------------

export async function POST(request: Request) {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request body must be multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;

  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: 'A file must be provided in the "file" field' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds the 2 MB limit (got ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
      { status: 400 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" is not allowed. Use JPEG, PNG, WebP, or GIF.` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Delete any existing avatar files for this user
  const { data: existing } = await admin.storage
    .from("avatars")
    .list(user.id);

  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${user.id}/${f.name}`);
    await admin.storage.from("avatars").remove(paths);
  }

  // Upload the new avatar
  const ext = file.name.split(".").pop() ?? "png";
  const storagePath = `${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[Avatar] Upload failed:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload avatar" },
      { status: 500 },
    );
  }

  // Get the public URL
  const { data: urlData } = admin.storage
    .from("avatars")
    .getPublicUrl(storagePath);

  // Since the bucket is private, use a signed URL instead
  const { data: signedData, error: signedError } = await admin.storage
    .from("avatars")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

  const avatarUrl = signedError ? urlData.publicUrl : signedData.signedUrl;

  // Update the user profile with the new avatar URL
  const { error: updateError } = await admin
    .from("user_profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    console.error("[Avatar] Profile update failed:", updateError);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}

// ---- DELETE /api/v1/account/avatar ----------------------------------------

export async function DELETE() {
  const { user } = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Remove all avatar files for this user
  const { data: existing } = await admin.storage
    .from("avatars")
    .list(user.id);

  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${user.id}/${f.name}`);
    await admin.storage.from("avatars").remove(paths);
  }

  // Clear avatar_url from profile
  const { error: updateError } = await admin
    .from("user_profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (updateError) {
    console.error("[Avatar] Profile clear failed:", updateError);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ avatar_url: null });
}
