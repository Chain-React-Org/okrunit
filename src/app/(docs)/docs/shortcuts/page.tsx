import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Keyboard Shortcuts",
  description: "Keyboard shortcuts and the command palette for fast navigation and actions in OKrunit.",
};

export default function ShortcutsPage() {
  return (
    <article>
      <BreadcrumbJsonLd items={[
        { name: "Docs", href: "/docs" },
        { name: "Keyboard Shortcuts", href: "/docs/shortcuts" },
      ]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Keyboard Shortcuts</h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        Navigate faster and take actions without touching the mouse.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Command Palette</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        Press <kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-mono">⌘K</kbd> (Mac)
        or <kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-mono">Ctrl+K</kbd> (Windows/Linux)
        to open the command palette from anywhere in the dashboard.
      </p>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        The command palette lets you:
      </p>
      <ul className="mt-3 list-disc pl-6 space-y-2 text-zinc-600">
        <li><strong>Search approval requests</strong>: Type 2+ characters to search by title. Results appear instantly with status indicators.</li>
        <li><strong>Navigate to any page</strong>: Jump to Requests, Connections, Routes, Rules, Analytics, SLA, Teams, Members, Settings, and more.</li>
        <li><strong>Quick access</strong>: No need to click through menus. Just type and press Enter.</li>
      </ul>
      <p className="mt-3 text-zinc-600 leading-relaxed">
        You can also click the <strong>Search bar</strong> in the header to open the command palette.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Approval Shortcuts</h2>
      <p className="mt-4 text-zinc-600 leading-relaxed">
        When the approval detail panel is open and the request is pending:
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Key</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Action</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">a</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Approve the request</td>
              <td className="py-3 px-4 text-zinc-500 text-xs">Detail panel open, request pending, not typing in an input</td>
            </tr>
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">r</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Reject the request</td>
              <td className="py-3 px-4 text-zinc-500 text-xs">Detail panel open, request pending, not typing in an input</td>
            </tr>
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">Esc</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Close the detail panel or command palette</td>
              <td className="py-3 px-4 text-zinc-500 text-xs">Any panel or dialog open</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-zinc-500 text-sm">
        Keyboard shortcuts are disabled when your cursor is in a text input, textarea, or select field to prevent accidental actions.
      </p>

      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">Navigation Shortcuts</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Shortcut</th>
              <th className="text-left py-3 px-4 font-semibold text-zinc-900">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">⌘K</kbd> / <kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">Ctrl+K</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Open command palette</td>
            </tr>
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">↑</kbd> <kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">↓</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Navigate command palette results</td>
            </tr>
            <tr>
              <td className="py-3 px-4"><kbd className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-sm font-mono">Enter</kbd></td>
              <td className="py-3 px-4 text-zinc-600">Select command palette result</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
