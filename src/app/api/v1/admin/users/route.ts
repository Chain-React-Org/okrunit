// ---------------------------------------------------------------------------
// OKrunit -- Admin Users CRUD: Create, Update, Delete
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Schemas --------------------------------------------------------------

const createUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1).optional(),
  is_app_admin: z.boolean().optional(),
  org_id: z.string().uuid().optional(),
  role: z.enum(["owner", "admin", "member"]).optional(),
});

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  is_app_admin: z.boolean().optional(),
});

const deleteUserSchema = z.object({
  user_id: z.string().uuid(),
});

// ---- POST /api/v1/admin/users - Create user -------------------------------

export async function POST(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const admin = createAdminClient();

    // Check if user already exists
    const { data: existing } = await admin
      .from("user_profiles")
      .select("id")
      .eq("email", validated.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 },
      );
    }

    // Create auth user via Supabase admin API
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email: validated.email,
        email_confirm: true,
        user_metadata: {
          full_name: validated.full_name ?? null,
        },
      });

    if (authError) {
      logger.error("[AdminUsers] Auth user creation failed:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 },
      );
    }

    const userId = authData.user.id;

    // Create profile
    await admin.from("user_profiles").upsert({
      id: userId,
      email: validated.email,
      full_name: validated.full_name ?? null,
      is_app_admin: validated.is_app_admin ?? false,
    });

    // Optionally add to org
    if (validated.org_id) {
      await admin.from("org_memberships").insert({
        user_id: userId,
        org_id: validated.org_id,
        role: validated.role ?? "member",
        is_default: true,
      });
    }

    return NextResponse.json({
      id: userId,
      email: validated.email,
      full_name: validated.full_name ?? null,
      is_app_admin: validated.is_app_admin ?? false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    logger.error("[AdminUsers] Create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---- PATCH /api/v1/admin/users - Update user ------------------------------

export async function PATCH(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    const admin = createAdminClient();

    const updates: Record<string, unknown> = {};
    if (validated.full_name !== undefined) updates.full_name = validated.full_name;
    if (validated.is_app_admin !== undefined) updates.is_app_admin = validated.is_app_admin;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await admin
      .from("user_profiles")
      .update(updates)
      .eq("id", validated.user_id);

    if (error) {
      logger.error("[AdminUsers] Update failed:", error);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 },
      );
    }

    // Also update auth metadata if name changed
    if (validated.full_name !== undefined) {
      await admin.auth.admin.updateUserById(validated.user_id, {
        user_metadata: { full_name: validated.full_name },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    logger.error("[AdminUsers] Update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---- DELETE /api/v1/admin/users - Delete user -----------------------------

export async function DELETE(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = deleteUserSchema.parse(body);

    // Prevent self-deletion
    if (validated.user_id === profile.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account from the admin panel" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Remove memberships
    await admin
      .from("org_memberships")
      .delete()
      .eq("user_id", validated.user_id);

    // Remove profile
    await admin
      .from("user_profiles")
      .delete()
      .eq("id", validated.user_id);

    // Remove auth user
    const { error: authError } = await admin.auth.admin.deleteUser(
      validated.user_id,
    );

    if (authError) {
      logger.error("[AdminUsers] Auth user deletion failed:", authError);
      // Profile already deleted, log but don't fail
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    logger.error("[AdminUsers] Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
