// ---------------------------------------------------------------------------
// OKrunit -- One-Click Approve Page
// ---------------------------------------------------------------------------
//
// Public page linked from Teams (and potentially other) notifications.
// Looks up the token, shows the approval request details, and provides a
// single "Confirm Approval" button. No login required -- the token itself
// is the authentication.
// ---------------------------------------------------------------------------

import { Suspense } from "react";
import { Metadata } from "next";
import { connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { TokenActionForm } from "@/components/token-action-form";

export const metadata: Metadata = {
  title: "Approve Request - OKrunit",
  description: "Confirm approval for a pending request.",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function ApprovePage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      }
    >
      <ApproveContent params={params} />
    </Suspense>
  );
}

async function ApproveContent({ params }: PageProps) {
  await connection();
  const { token } = await params;

  const admin = createAdminClient();

  // Look up the token without consuming it -- consumption happens on form submit.
  const { data: tokenRow, error: lookupError } = await admin
    .from("email_action_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (lookupError || !tokenRow) {
    return <TokenErrorPage message="This link is invalid or does not exist." />;
  }

  if (tokenRow.consumed_at) {
    return <TokenErrorPage message="This link has already been used." />;
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return <TokenErrorPage message="This link has expired." />;
  }

  if (tokenRow.action !== "approve") {
    return <TokenErrorPage message="This link is not valid for approving." />;
  }

  // Fetch the approval request for display.
  const { data: approval } = await admin
    .from("approval_requests")
    .select("id, title, description, priority, status")
    .eq("id", tokenRow.request_id)
    .single();

  if (!approval) {
    return <TokenErrorPage message="The approval request could not be found." />;
  }

  if (approval.status !== "pending") {
    return (
      <TokenInfoPage
        title="Already Decided"
        message={`This request has already been ${approval.status}. No further action is needed.`}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          {/* Header */}
          <div className="bg-slate-800 px-6 py-4">
            <h1 className="text-lg font-semibold text-white">OKrunit</h1>
          </div>

          {/* Body */}
          <div className="px-6 py-8">
            {/* Request details */}
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-green-700">
                Approve Request
              </p>
              <h2 className="text-lg font-semibold text-gray-900">
                {approval.title}
              </h2>
              {approval.description && (
                <p className="mt-1 text-sm text-gray-600">
                  {approval.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <PriorityBadge priority={approval.priority} />
                <span className="font-mono text-xs text-gray-400">
                  {approval.id.slice(0, 8)}...
                </span>
              </div>
            </div>

            {/* Action form (client component) */}
            <TokenActionForm
              token={token}
              action="approve"
              requestTitle={approval.title}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function TokenErrorPage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="bg-slate-800 px-6 py-4">
            <h1 className="text-lg font-semibold text-white">OKrunit</h1>
          </div>
          <div className="px-6 py-8">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h2 className="text-base font-semibold text-red-800">
                Link No Longer Valid
              </h2>
              <p className="mt-1 text-sm text-red-700">{message}</p>
            </div>
            <div className="mt-6 text-center">
              <a
                href="/org/overview"
                className="inline-block rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenInfoPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <div className="bg-slate-800 px-6 py-4">
            <h1 className="text-lg font-semibold text-white">OKrunit</h1>
          </div>
          <div className="px-6 py-8">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h2 className="text-base font-semibold text-blue-800">{title}</h2>
              <p className="mt-1 text-sm text-blue-700">{message}</p>
            </div>
            <div className="mt-6 text-center">
              <a
                href="/org/overview"
                className="inline-block rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-green-100 text-green-800",
  };
  const style = styles[priority] ?? "bg-gray-100 text-gray-800";

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}
