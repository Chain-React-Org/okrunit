import type { Metadata } from "next";

import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Custom Roles",
  description: "Create custom roles like 'Security Reviewer' or 'Finance Approver' that map to base permission levels.",
};

export default function CustomRolesPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Custom Roles", href: "/docs/custom-roles" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Custom Roles</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Create named roles that give your team structure beyond the built-in Member, Approver, Admin, and Owner roles.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Built-in Permission Levels</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Every custom role maps to one of three base permission levels:
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-zinc-200"><th className="text-left py-3 px-4 font-semibold text-zinc-900">Level</th><th className="text-left py-3 px-4 font-semibold text-zinc-900">Can Do</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="py-3 px-4 font-medium">Member</td><td className="py-3 px-4 text-zinc-600">View approval requests and analytics</td></tr>
            <tr><td className="py-3 px-4 font-medium">Approver</td><td className="py-3 px-4 text-zinc-600">Everything Member can do + approve/reject requests</td></tr>
            <tr><td className="py-3 px-4 font-medium">Admin</td><td className="py-3 px-4 text-zinc-600">Everything Approver can do + manage settings, connections, rules, teams</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Creating a Custom Role</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Navigate to <strong>Organization → Roles</strong> and click <strong>New Role</strong>.
      </p>
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-zinc-600">
        <li>Enter a <strong>role name</strong> (e.g. &quot;Security Reviewer&quot;, &quot;Finance Approver&quot;)</li>
        <li>Add an optional <strong>description</strong></li>
        <li>Select the <strong>base permission level</strong> (Member, Approver, or Admin)</li>
        <li>Choose a <strong>color</strong> for visual identification</li>
        <li>Toggle <strong>can approve</strong> if you want this role to have approval permissions regardless of base level</li>
      </ol>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Assigning Custom Roles</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        After creating a custom role, assign it to members on the <strong>Members</strong> page. The member will see
        their custom role name displayed, but their actual permissions come from the base level you selected.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Examples</h2>
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Security Reviewer</p>
          <p className="text-sm text-zinc-600 mt-1">Base: Approver · Color: Red · Can approve: Yes</p>
          <p className="text-xs text-zinc-500 mt-1">Team members who review security-sensitive deployments</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Finance Observer</p>
          <p className="text-sm text-zinc-600 mt-1">Base: Member · Color: Amber · Can approve: No</p>
          <p className="text-xs text-zinc-500 mt-1">Finance team members who need visibility but don&apos;t approve</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="font-semibold text-zinc-900">Ops Lead</p>
          <p className="text-sm text-zinc-600 mt-1">Base: Admin · Color: Purple · Can approve: Yes</p>
          <p className="text-xs text-zinc-500 mt-1">Operations leads who manage routing and approve infrastructure changes</p>
        </div>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">API</h2>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm">
        <code className="text-zinc-100">{`GET    /api/v1/custom-roles          # List roles
POST   /api/v1/custom-roles          # Create role
PATCH  /api/v1/custom-roles/:id      # Update role
DELETE /api/v1/custom-roles/:id      # Delete role`}</code>
      </pre>
    </article>
  );
}
