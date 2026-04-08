// ---------------------------------------------------------------------------
// OKrunit -- Approval Attachments API: GET (list) + POST (upload)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- Constants ------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CONTENT_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // PDFs
  "application/pdf",
  // Text
  "text/plain",
  "text/csv",
  "text/markdown",
  // Documents
  "application/json",
]);

// ---- Helpers ----------------------------------------------------------------

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, "_")     // Remove path separators
    .replace(/\.\./g, "_")      // Remove directory traversal
    .replace(/[^\w.\-]/g, "_")  // Only allow word chars, dots, hyphens
    .slice(0, 200);             // Limit length
}

// ---- GET /api/v1/approvals/[id]/attachments --------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate (both API key and session supported)
    const auth = await authenticateRequest(request);
    const admin = createAdminClient();

    // 2. Verify the approval exists and belongs to the org
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Fetch attachments ordered chronologically
    const { data: attachments, error: attachmentsError } = await admin
      .from("approval_attachments")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (attachmentsError) {
      console.error(
        "[Attachments] Failed to fetch attachments:",
        attachmentsError,
      );
      throw new ApiError(500, "Failed to fetch attachments");
    }

    return NextResponse.json({ data: attachments });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- POST /api/v1/approvals/[id]/attachments -------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate (both API key and session supported)
    const auth = await authenticateRequest(request);
    const admin = createAdminClient();

    // 2. Verify the approval exists and belongs to the org
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Parse the request as FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiError(
        400,
        "Request body must be multipart/form-data",
        "INVALID_CONTENT_TYPE",
      );
    }

    const file = formData.get("file") as File | null;

    // 4. Validate the file
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new ApiError(
        400,
        'A file must be provided in the "file" field',
        "FILE_REQUIRED",
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        400,
        `File size exceeds the 10 MB limit (got ${(file.size / 1024 / 1024).toFixed(1)} MB)`,
        "FILE_TOO_LARGE",
      );
    }

    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      throw new ApiError(
        400,
        `File type "${file.type}" is not allowed. Accepted types: images, PDFs, and text files.`,
        "INVALID_FILE_TYPE",
      );
    }

    // 5. Generate a unique storage path
    const storagePath = `attachments/${auth.orgId}/${id}/${Date.now()}_${sanitizeFilename(file.name)}`;

    // 6. Read file into a buffer and upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from("approval-attachments")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Attachments] Storage upload failed:", uploadError);
      throw new ApiError(500, "Failed to upload file to storage");
    }

    // 7. Insert the attachment record into the database
    const { data: attachment, error: insertError } = await admin
      .from("approval_attachments")
      .insert({
        request_id: id,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
        storage_path: storagePath,
        uploaded_by: auth.type === "session" ? auth.user.id : null,
        connection_id: auth.type === "api_key" ? auth.connection.id : null,
      })
      .select("*")
      .single();

    if (insertError || !attachment) {
      console.error("[Attachments] DB insert failed:", insertError);
      // Attempt to clean up the orphaned storage object
      void admin.storage.from("approval-attachments").remove([storagePath]);
      throw new ApiError(500, "Failed to save attachment record");
    }

    // 8. Audit log
    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.type === "session" ? auth.user.id : undefined,
      connectionId: auth.type === "api_key" ? auth.connection.id : undefined,
      action: "attachment.uploaded",
      resourceType: "approval_attachment",
      resourceId: attachment.id,
      ipAddress: getClientIp(request),
      details: {
        request_id: id,
        file_name: file.name,
        file_size: file.size,
        content_type: file.type,
      },
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
