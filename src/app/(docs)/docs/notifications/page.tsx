import type { Metadata } from "next";
import { DocsImage } from "@/components/docs/docs-image";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Notifications & Quiet Hours",
  description: "Configure notification channels, quiet hours, priority filters, and notification history in OKrunit.",
};

export default function NotificationsPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Notifications", href: "/docs/notifications" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Notifications &amp; Quiet Hours</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        OKrunit notifies your team through 7 channels when approval requests need attention or decisions are made.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Notification Channels</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-zinc-200"><th className="text-left py-3 px-4 font-semibold text-zinc-900">Channel</th><th className="text-left py-3 px-4 font-semibold text-zinc-900">Setup</th><th className="text-left py-3 px-4 font-semibold text-zinc-900">Features</th></tr></thead>
          <tbody className="divide-y divide-zinc-100">
            <tr><td className="py-3 px-4 font-medium">Email</td><td className="py-3 px-4 text-zinc-600">Automatic (uses account email)</td><td className="py-3 px-4 text-zinc-600">One-click approve/reject links, rich HTML</td></tr>
            <tr><td className="py-3 px-4 font-medium">Slack</td><td className="py-3 px-4 text-zinc-600">Connect via Messaging settings</td><td className="py-3 px-4 text-zinc-600">Interactive buttons, channel routing</td></tr>
            <tr><td className="py-3 px-4 font-medium">Discord</td><td className="py-3 px-4 text-zinc-600">Webhook URL or bot token</td><td className="py-3 px-4 text-zinc-600">Rich embeds with action buttons</td></tr>
            <tr><td className="py-3 px-4 font-medium">Microsoft Teams</td><td className="py-3 px-4 text-zinc-600">Webhook URL</td><td className="py-3 px-4 text-zinc-600">Adaptive cards</td></tr>
            <tr><td className="py-3 px-4 font-medium">Telegram</td><td className="py-3 px-4 text-zinc-600">Bot token + channel ID</td><td className="py-3 px-4 text-zinc-600">Inline buttons</td></tr>
            <tr><td className="py-3 px-4 font-medium">Web Push</td><td className="py-3 px-4 text-zinc-600">Browser permission prompt</td><td className="py-3 px-4 text-zinc-600">Native browser notifications</td></tr>
            <tr><td className="py-3 px-4 font-medium">In-App</td><td className="py-3 px-4 text-zinc-600">Automatic</td><td className="py-3 px-4 text-zinc-600">Bell icon badge, notification panel, history page</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Notification Events</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">Notifications are sent for these events:</p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li><strong>New request</strong>: When an approval request is created</li>
        <li><strong>Decision made</strong>: When a request is approved, rejected, cancelled, or expired</li>
        <li><strong>Comment added</strong>: When someone comments on a request</li>
        <li><strong>Next approver</strong>: When it&apos;s your turn in a sequential approval chain</li>
        <li><strong>SLA breached</strong>: When a request passes its SLA deadline</li>
        <li><strong>Escalated</strong>: When a request is escalated to a higher level</li>
        <li><strong>Team invite</strong>: When you&apos;re invited to an organization</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Per-User Preferences</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Each user can configure their notification preferences in <strong>Settings → Account</strong>:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Email enabled/disabled</strong>: Toggle email notifications on or off</li>
        <li><strong>Push enabled/disabled</strong>: Toggle browser push notifications</li>
        <li><strong>Minimum priority</strong>: Only notify for requests at or above this priority (e.g. only High and Critical)</li>
        <li><strong>Skip confirmation</strong>: Skip the confirmation dialog when approving/rejecting</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Quiet Hours</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Set times when you don&apos;t want to receive notifications. Navigate to <strong>Settings → Account → Notifications</strong>:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Enable quiet hours</strong>: Toggle on to suppress notifications during set hours</li>
        <li><strong>Start/end time</strong>: e.g. 10:00 PM to 8:00 AM</li>
        <li><strong>Timezone</strong>: Select your timezone so hours are calculated correctly</li>
        <li><strong>Per-day schedule</strong>: Set different quiet hours for different days of the week (e.g. all day on weekends, evenings only on weekdays)</li>
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Notification History</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        View all past notifications at <strong>Settings → Notification History</strong>. You can:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-1 text-zinc-600">
        <li>Filter by category (Awaiting, Decided, Expiring, Invites)</li>
        <li>Filter by read/unread status</li>
        <li>Mark all as read</li>
        <li>Click any notification to navigate to the related resource</li>
      </ul>

      <DocsImage
        src="/screenshots/docs/notification-history.webp"
        alt="Notification history page showing filtered notifications with category tabs and read/unread status"
        caption="Browse and filter your full notification history."
      />

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Real-Time Updates</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        The notification bell in the header updates in real-time via Supabase Realtime. When a new notification arrives,
        the badge count increments immediately without needing to refresh the page. The sidebar&apos;s pending request
        count also updates live as new requests come in or get decided.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Email Bounce Handling</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        If an email bounces (hard bounce), OKrunit automatically disables email notifications for that address
        to protect your sending reputation. The bounce is logged in the audit trail.
      </p>
    </article>
  );
}
