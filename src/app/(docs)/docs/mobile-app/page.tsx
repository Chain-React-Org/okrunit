import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Mobile App",
  description:
    "Install OKrunit on your phone or tablet for instant access to approval requests. Works on iPhone, iPad, Android, and desktop.",
};

export default function MobileAppPage() {
  return (
    <article>
      <BreadcrumbJsonLd
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Mobile App", href: "/docs/mobile-app" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Mobile App
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Install OKrunit on your phone, tablet, or desktop for instant access
        to approval requests. No app store required.
      </p>

      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-sm font-medium text-emerald-800">
          OKrunit works as an installable app directly from your browser. Once
          installed, it launches full-screen with its own icon, works offline,
          and delivers push notifications for pending approvals.
        </p>
      </div>

      {/* iPhone / iPad */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        iPhone and iPad (Safari)
      </h2>
      <ol className="mt-4 space-y-4 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            1
          </span>
          <div>
            <strong className="text-zinc-900">Open OKrunit in Safari.</strong>{" "}
            Navigate to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
              okrunit.com
            </code>{" "}
            and sign in. This must be done in Safari (not Chrome or another browser).
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            2
          </span>
          <div>
            <strong className="text-zinc-900">Tap the Share button.</strong>{" "}
            It is the square icon with an arrow pointing up, located at the
            bottom of Safari (iPhone) or at the top (iPad).
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            3
          </span>
          <div>
            <strong className="text-zinc-900">
              Scroll down and tap &quot;Add to Home Screen&quot;.
            </strong>{" "}
            You may need to scroll past the first row of sharing options to find it.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            4
          </span>
          <div>
            <strong className="text-zinc-900">Tap &quot;Add&quot;.</strong>{" "}
            OKrunit will appear on your home screen with its green checkmark icon.
            Tap it to launch the app in full-screen mode.
          </div>
        </li>
      </ol>

      {/* Android */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Android (Chrome)
      </h2>
      <ol className="mt-4 space-y-4 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            1
          </span>
          <div>
            <strong className="text-zinc-900">Open OKrunit in Chrome.</strong>{" "}
            Navigate to{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
              okrunit.com
            </code>{" "}
            and sign in.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            2
          </span>
          <div>
            <strong className="text-zinc-900">
              Tap &quot;Install App&quot; when prompted.
            </strong>{" "}
            Chrome will show an install banner at the bottom of the screen.
            Tap <strong>Install</strong> to add OKrunit to your home screen and app drawer.
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            3
          </span>
          <div>
            <strong className="text-zinc-900">
              Or use the browser menu.
            </strong>{" "}
            If the banner does not appear, tap the three-dot menu in Chrome and
            select <strong>&quot;Install app&quot;</strong> or{" "}
            <strong>&quot;Add to Home screen&quot;</strong>.
          </div>
        </li>
      </ol>

      {/* Desktop */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Desktop (Chrome, Edge)
      </h2>
      <ol className="mt-4 space-y-4 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            1
          </span>
          <div>
            <strong className="text-zinc-900">Open OKrunit in Chrome or Edge.</strong>{" "}
            Look for the install icon in the address bar (a monitor with a down
            arrow, or a &quot;+&quot; icon).
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
            2
          </span>
          <div>
            <strong className="text-zinc-900">Click &quot;Install&quot;.</strong>{" "}
            OKrunit opens in its own window with no browser toolbar. You can find
            it in your taskbar, dock, or Start menu like any other app.
          </div>
        </li>
      </ol>
      <p className="mt-3 text-sm text-zinc-500">
        You can also install from the dashboard: click your avatar in the top right
        and select <strong>Install App</strong> from the dropdown menu.
      </p>

      {/* What you get */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        What you get
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">Full-screen experience</p>
          <p className="mt-1 text-sm text-zinc-600">
            No browser chrome or address bar. OKrunit looks and feels like a native app.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">Push notifications</p>
          <p className="mt-1 text-sm text-zinc-600">
            Get alerted when new approval requests arrive. Approve or reject directly from the notification.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">Offline support</p>
          <p className="mt-1 text-sm text-zinc-600">
            Previously visited pages are cached and available even without an internet connection.
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-semibold text-zinc-900">Quick access shortcuts</p>
          <p className="mt-1 text-sm text-zinc-600">
            Long-press the OKrunit icon on Android to jump directly to Requests or Connections.
          </p>
        </div>
      </div>

      {/* Troubleshooting */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Troubleshooting
      </h2>
      <div className="mt-4 space-y-4 text-zinc-700">
        <div>
          <p className="font-medium text-zinc-900">
            I don&apos;t see the install banner
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            On iOS, the install banner is not supported by Safari. Follow the
            manual steps above (Share &gt; Add to Home Screen). On Android, the
            banner may not appear if you previously dismissed it. Use the Chrome
            menu instead.
          </p>
        </div>
        <div>
          <p className="font-medium text-zinc-900">
            Notifications are not working
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Make sure notifications are enabled in your device settings for
            OKrunit (or for your browser if using the web version). You can
            manage notification preferences from{" "}
            <strong>Settings &gt; Notifications</strong> in the dashboard.
          </p>
        </div>
        <div>
          <p className="font-medium text-zinc-900">
            The app shows an old version
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Close and reopen the app. The service worker updates automatically
            in the background. If the issue persists, uninstall and reinstall the app.
          </p>
        </div>
      </div>
    </article>
  );
}
