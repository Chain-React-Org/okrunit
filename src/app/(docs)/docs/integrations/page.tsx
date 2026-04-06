import type { Metadata } from "next";
import Link from "next/link";
import { DocsImage } from "@/components/docs/docs-image";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "OKrunit integrations — connect with Zapier, Make, n8n, GitHub Actions, Terraform, LangChain, and more.",
};

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface Integration {
  name: string;
  description: string;
  status: "available" | "beta" | "coming_soon";
}

interface Category {
  name: string;
  description: string;
  integrations: Integration[];
}

const CATEGORIES: Category[] = [
  {
    name: "Automation Platforms",
    description:
      "Add human approval gates to your no-code and low-code automation workflows.",
    integrations: [
      {
        name: "Zapier",
        description:
          "Native Zapier app with triggers for new approvals and actions for creating/managing requests. Use it in any Zap to pause execution until a human approves.",
        status: "available",
      },
      {
        name: "Make (Integromat)",
        description:
          "Custom Make app with modules for creating approvals, watching for decisions, and searching existing requests.",
        status: "available",
      },
      {
        name: "n8n",
        description:
          "Community node for n8n that provides trigger and action nodes for approval workflows within your self-hosted or cloud n8n instance.",
        status: "available",
      },
      {
        name: "monday.com",
        description:
          "Native monday.com app with triggers and actions for adding human approval gates to your monday.com automations and workflows.",
        status: "available",
      },
    ],
  },
  {
    name: "AI Agents",
    description:
      "Gate destructive actions from AI agents with human oversight before execution.",
    integrations: [
      {
        name: "LangChain",
        description:
          "Python and TypeScript tools that integrate with LangChain agents. The agent pauses and waits for human approval before executing sensitive tool calls.",
        status: "available",
      },
      {
        name: "CrewAI",
        description:
          "Custom tool for CrewAI agents that requires human approval before proceeding with high-stakes actions in multi-agent workflows.",
        status: "available",
      },
      {
        name: "AutoGen",
        description:
          "Integration for Microsoft AutoGen that adds human-in-the-loop approval to multi-agent conversations and task execution.",
        status: "available",
      },
    ],
  },
  {
    name: "Infrastructure & DevOps",
    description:
      "Require human sign-off before infrastructure changes, deployments, and releases.",
    integrations: [
      {
        name: "GitHub Actions",
        description:
          "GitHub Action that creates an approval request and waits for a decision before continuing the workflow. Ideal for deployment gates.",
        status: "available",
      },
      {
        name: "Terraform",
        description:
          "External approval step for Terraform Cloud/Enterprise run tasks. Blocks plan application until a human reviews and approves the changes.",
        status: "available",
      },
      {
        name: "Vercel",
        description:
          "Deployment protection integration that requires human approval before promoting preview deployments to production.",
        status: "available",
      },
      {
        name: "Netlify",
        description:
          "Build plugin and deploy hook integration that gates production deployments behind human approval.",
        status: "available",
      },
    ],
  },
  {
    name: "Enterprise Platforms",
    description:
      "Connect OKrunit to enterprise automation and internal tool platforms.",
    integrations: [
      {
        name: "Power Automate",
        description:
          "Custom connector for Microsoft Power Automate that adds approval steps to Power Automate flows using OKrunit as the backend.",
        status: "coming_soon",
      },
      {
        name: "Retool",
        description:
          "Retool component and workflow integration for building custom approval dashboards and embedding approval controls in internal tools.",
        status: "available",
      },
    ],
  },
  {
    name: "Workflow Engines",
    description:
      "Add human approval activities and tasks to durable workflow engines.",
    integrations: [
      {
        name: "Temporal",
        description:
          "Python activity and workflow that creates an approval request and blocks the workflow until a decision is made. Supports heartbeats for long-running waits.",
        status: "available",
      },
      {
        name: "Prefect",
        description:
          "Prefect task and flow that pauses a Prefect flow run pending human approval via OKrunit. Integrates with Prefect Cloud notifications.",
        status: "available",
      },
      {
        name: "Dagster",
        description:
          "Dagster op and sensor for gating asset materializations and job runs behind human approval. Supports Dagster Cloud.",
        status: "available",
      },
      {
        name: "Windmill",
        description:
          "Deno scripts for Windmill that create approval requests and poll for decisions within Windmill flows.",
        status: "available",
      },
      {
        name: "Pipedream",
        description:
          "Pipedream source and action components for triggering on approval events and creating requests from Pipedream workflows.",
        status: "available",
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: Integration["status"] }) {
  const styles: Record<Integration["status"], string> = {
    available: "bg-emerald-100 text-emerald-700",
    beta: "bg-amber-100 text-amber-700",
    coming_soon: "bg-zinc-100 text-zinc-500",
  };
  const labels: Record<Integration["status"], string> = {
    available: "Available",
    beta: "Beta",
    coming_soon: "Coming soon",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  return (
    <article>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Integrations
      </h1>
      <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
        OKrunit connects to 19 platforms across automation, AI agents,
        infrastructure, and workflow engines. The easiest way to connect is to
        select the OKrunit node directly inside your automation platform — no
        code required.
      </p>

      {/* Main approach callout */}
      <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h3 className="text-lg font-semibold text-emerald-900">
          How to connect (the easy way)
        </h3>
        <p className="mt-2 text-sm text-emerald-800 leading-relaxed">
          For every supported platform, the process is the same:
        </p>
        <ol className="mt-3 space-y-2 text-sm text-emerald-800">
          <li className="flex gap-2">
            <span className="font-bold">1.</span>
            <span>
              Open your automation platform (Zapier, Make, n8n, monday.com,
              GitHub Actions, Temporal, etc.)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold">2.</span>
            <span>
              Add a new step and search for <strong>&quot;OKrunit&quot;</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold">3.</span>
            <span>
              Select the OKrunit node/module and connect your account when
              prompted
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold">4.</span>
            <span>
              Fill in the request details (title, description, priority) and
              you&apos;re done
            </span>
          </li>
        </ol>
        <p className="mt-3 text-sm text-emerald-800">
          Your workflow will pause at the OKrunit step until a human approves or
          rejects. The decision is automatically passed to the next step.
        </p>
      </div>

      <DocsImage
        src="/screenshots/docs/connections-list.webp"
        alt="OKrunit connections page showing active API connections"
        caption="Connections are created automatically when you link your account from a platform, or you can create them manually for API access."
      />

      {/* Platform-specific guides */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Platform-specific setup
      </h2>

      {/* Zapier */}
      <h3 id="zapier" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Zapier
      </h3>
      <p className="mt-2 text-zinc-700">
        OKrunit is available as a native Zapier app. Here&apos;s how to add it to
        any Zap:
      </p>
      <div className="mt-4 space-y-2">
        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>In the Zap editor, click the <strong>Action</strong> step to open the app picker.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-1-editor.webp"
          alt="Zapier editor showing the Action step highlighted"
          caption="Click the Action step in the Zap editor to add OKrunit."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Search for <strong>&quot;OKrunit&quot;</strong> in the app search.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-2-app-picker.webp"
          alt="Zapier app picker with the search bar highlighted"
          caption="Type 'OKrunit' in the search bar to find the app."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Select <strong>OKrunit</strong> from the results.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-3-search-okrunit.webp"
          alt="Zapier search results showing OKrunit"
          caption="Click OKrunit in the search results."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Choose the <strong>Request Approval</strong> action event from the dropdown.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-4b-request-approval.webp"
          alt="Zapier event dropdown showing Request Approval action"
          caption="Select 'Request Approval' to pause the Zap until a human decides."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">5</span>
          <span>Connect your OKrunit account — click <strong>Sign in to OKrunit</strong> to authorize via OAuth, or select an existing connection.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-5-account.webp"
          alt="Zapier account connection screen for OKrunit"
          caption="Connect your OKrunit account to authorize Zapier."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">6</span>
          <span>Map your trigger data to the approval fields — <strong>What needs approval?</strong>, <strong>Details</strong>, and optional <strong>Metadata</strong>.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-6-fields.webp"
          alt="Zapier field configuration showing title, details, and metadata fields"
          caption="Fill in the approval request fields. Use the + button to insert data from previous steps."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">7</span>
          <span>Click <strong>Test</strong> to verify the connection works — you should see a new pending request in your OKrunit dashboard.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/zapier-step-7-test-v2.webp"
          alt="Zapier test step button"
          caption="Test the step to confirm everything is connected."
        />
      </div>
      <p className="mt-3 text-sm text-zinc-500">
        Zapier also supports triggers for <strong>Approval Decided</strong> and
        <strong> Approval Created</strong>, so you can build Zaps that react to
        decisions. The Zap will wait <strong>indefinitely</strong> until someone
        approves or rejects — there is no timeout.
      </p>

      {/* Make */}
      <h3 id="make" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Make (Integromat)
      </h3>
      <p className="mt-2 text-zinc-700">
        OKrunit has a custom Make app with modules for creating and managing
        approval requests. Because Make&apos;s HTTP modules have a maximum timeout
        of 5 minutes, approvals use a <strong>two-scenario pattern</strong>:
      </p>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Two-scenario pattern</p>
        <p className="mt-1 text-sm text-amber-800 leading-relaxed">
          <strong>Scenario 1</strong> sets up a webhook to receive OKrunit&apos;s
          decision callback and performs the follow-up actions.{" "}
          <strong>Scenario 2</strong> creates the approval request (using the
          webhook URL from Scenario 1) and continues immediately without waiting.
          This allows the approval to take as long as needed with no timeout.
        </p>
      </div>

      <p className="mt-4 text-sm font-medium text-zinc-900">Scenario 1 — Set up the webhook (handle the decision):</p>
      <div className="mt-2 space-y-2">
        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Create a new scenario and click <strong>+</strong> to add a module.</span>
        </div>

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Search for <strong>&quot;Webhooks&quot;</strong> and select the <strong>Webhooks</strong> app.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-7-search-webhooks.webp"
          alt="Make app picker with Webhooks selected"
          caption="Search for 'Webhooks' in the app picker."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Choose <strong>Custom webhook</strong> as the trigger.</span>
        </div>
        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Choose <strong>Custom webhook</strong> as the trigger, click <strong>Add</strong> to create it, then <strong>copy the webhook URL</strong> — you&apos;ll need it for Scenario 2.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-9-webhook-url.webp"
          alt="Make webhooks page showing the generated webhook URL to copy"
          caption="Copy this webhook URL — you'll paste it into the Callback URL field in Scenario 2."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">5</span>
          <span>Add your follow-up modules after the webhook trigger — these will run when OKrunit sends the approval decision.</span>
        </div>
      </div>

      <p className="mt-4 text-sm font-medium text-zinc-900">Scenario 2 — Send the approval request:</p>
      <div className="mt-2 space-y-2">
        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Create a new scenario and click <strong>+</strong> to add a module.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-1-editor.webp"
          alt="Make scenario editor showing the + button to add a module"
          caption="Click the + icon in the scenario editor to open the app picker."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Search for <strong>&quot;OKrunit&quot;</strong> in the app search.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-2-search.webp"
          alt="Make app picker with the search bar highlighted"
          caption="Type 'OKrunit' in the search bar to find the app."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Select <strong>OKrunit</strong> from the results.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-3-select-okrunit.webp"
          alt="Make search results showing OKrunit"
          caption="Click OKrunit in the search results to see available modules."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Scroll to <strong>Actions</strong> and choose <strong>Request an Approval</strong>.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-4-select-module-v2.webp"
          alt="Make module list showing OKrunit triggers and actions"
          caption="Select 'Request an Approval' under Actions to create approval requests."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">5</span>
          <span>Click <strong>Add</strong> next to the Connection field and authorize your OKrunit account via OAuth.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-5-connection.webp"
          alt="Make module configuration showing Connection field with Add button"
          caption="Connect your OKrunit account to authorize Make."
        />

        <div className="flex gap-3 text-zinc-700">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">6</span>
          <span>Fill in the request fields — <strong>What needs approval?</strong>, <strong>Details</strong>, and paste the webhook URL from Scenario 1 into <strong>Callback URL</strong>.</span>
        </div>
        <DocsImage
          src="/screenshots/docs/integrations/make-step-6-fields-v2.webp"
          alt="Make module fields showing title, details, and callback URL"
          caption="Configure all the fields. Paste the webhook URL from Scenario 1 into Callback URL."
        />
      </div>

      {/* n8n */}
      <h3 id="n8n" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">n8n</h3>
      <p className="mt-2 text-zinc-700">
        OKrunit provides a community node for n8n. Use n8n&apos;s built-in{" "}
        <strong>Wait</strong> node to pause the workflow until the approval
        decision comes back — there is <strong>no timeout</strong> on self-hosted
        n8n.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>In your n8n workflow, click <strong>+</strong> and search for <strong>&quot;OKrunit&quot;</strong>.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Add the <strong>OKrunit</strong> action node to create the approval request.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Create credentials by entering your OKrunit API key (from the Connections page in the dashboard).</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>After the OKrunit node, add a <strong>Wait</strong> node configured to resume on webhook. Pass the Wait node&apos;s resume URL as the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">callback_url</code> in the OKrunit node.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">5</span>
          <span>Add your follow-up nodes after the Wait node — these run once the approval decision is received.</span>
        </li>
      </ol>

      {/* GitHub Actions */}
      <h3 id="github-actions" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        GitHub Actions
      </h3>
      <p className="mt-2 text-zinc-700">
        Add a human approval gate to any GitHub Actions workflow:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`- name: Request deployment approval
  uses: okrunit/approve-action@v1
  with:
    api-key: \${{ secrets.OKRUNIT_API_KEY }}
    title: "Deploy \${{ github.sha }} to production"
    description: "Triggered by \${{ github.actor }}"
    priority: high
    # The action waits until the request is approved or rejected
    # If rejected, the step fails and the workflow stops`}</code>
      </pre>
      <p className="mt-3 text-sm text-zinc-500">
        The action polls OKrunit every 30 seconds until a decision is made.
        GitHub Actions steps have a default <strong>6-hour timeout</strong> — you
        can increase it with{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">timeout-minutes</code> in
        your workflow YAML.
      </p>

      {/* monday.com */}
      <h3 id="monday" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        monday.com
      </h3>
      <p className="mt-2 text-zinc-700">
        OKrunit integrates with monday.com via integration recipes:
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Open your monday.com board and click <strong>Integrate</strong> in the top menu.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Search for <strong>&quot;OKrunit&quot;</strong> in the integration center.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Choose a recipe: <strong>When status changes, request approval</strong> or <strong>When item created, request approval</strong>.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Authorize your OKrunit account when prompted.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">5</span>
          <span>Add a second recipe: <strong>When OKrunit approval decided, update status</strong> — this listens for the decision webhook and updates your board automatically.</span>
        </li>
      </ol>
      <p className="mt-3 text-sm text-zinc-500">
        monday.com uses a two-recipe pattern: one to send the request, one to handle the decision. This allows the approval to take as long as needed.
      </p>

      {/* Temporal */}
      <h3 id="temporal" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Temporal
      </h3>
      <p className="mt-2 text-zinc-700">
        The <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">okrunit-temporal</code> Python
        package provides workflows and activities for durable human-in-the-loop
        approvals. The workflow waits <strong>indefinitely</strong> with heartbeat
        support.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Install the package: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">pip install okrunit-temporal</code></span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Create an API key on the <strong>Connections</strong> page in your OKrunit dashboard.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Import and register the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">ApprovalGateWorkflow</code> and OKrunit activities in your Temporal worker.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Start the workflow from your application code — it creates the approval request and polls until a decision is made, using heartbeats to stay alive.</span>
        </li>
      </ol>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`from okrunit_temporal import ApprovalGateWorkflow

# Start from your application code
result = await client.execute_workflow(
    ApprovalGateWorkflow.run,
    {"title": "Deploy v3.2 to production", "priority": "high"},
    id="deploy-approval",
    task_queue="okrunit",
)
# result.status == "approved" or "rejected"`}</code>
      </pre>

      {/* Prefect */}
      <h3 id="prefect" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Prefect
      </h3>
      <p className="mt-2 text-zinc-700">
        The <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">prefect-okrunit</code> Python
        package provides tasks and flows that pause Prefect flow runs until a
        human decision is made.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Install the package: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">pip install prefect-okrunit</code></span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Store your OKrunit API key in a Prefect Secret block named <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">okrunit-api-key</code>.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Use the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">approval_gate</code> flow in your Prefect flows to pause execution until the request is approved or rejected.</span>
        </li>
      </ol>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`from prefect_okrunit import approval_gate

@flow
def deploy_pipeline():
    # ... pre-deployment steps ...
    result = approval_gate(
        title="Deploy to production",
        priority="high",
    )
    if result.status == "approved":
        # ... deploy ...`}</code>
      </pre>

      {/* Dagster */}
      <h3 id="dagster" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Dagster
      </h3>
      <p className="mt-2 text-zinc-700">
        The <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">dagster-okrunit</code> Python
        package provides a resource, ops, and sensors for gating Dagster jobs
        behind human approval.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Install the package: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">pip install dagster-okrunit</code></span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Configure the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">OKRunitResource</code> with your API key in your Dagster definitions.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Use <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">approval_gate_op</code> in your jobs or add the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">approval_decided_sensor</code> to react to decisions.</span>
        </li>
      </ol>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`from dagster_okrunit import OKRunitResource, approval_gate_op

@job(resource_defs={"okrunit": OKRunitResource(api_key="ok_...")})
def deploy_with_approval():
    approval = approval_gate_op()
    deploy_to_prod(approval)`}</code>
      </pre>

      {/* Windmill */}
      <h3 id="windmill" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Windmill
      </h3>
      <p className="mt-2 text-zinc-700">
        OKrunit provides TypeScript scripts that you deploy directly to your
        Windmill instance using the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">wmill</code> CLI.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>Create an OKrunit resource type in Windmill using the provided <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">resource-type.json</code> schema.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Add a resource with your OKrunit API key.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Deploy the OKrunit scripts via <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">wmill push</code> or copy them into your workspace.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>Use the <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">wait_for_approval</code> flow in your Windmill workflows — it creates the request and polls until decided.</span>
        </li>
      </ol>

      {/* Pipedream */}
      <h3 id="pipedream" className="mt-8 scroll-mt-24 text-xl font-semibold text-zinc-900">
        Pipedream
      </h3>
      <p className="mt-2 text-zinc-700">
        OKrunit provides native Pipedream source and action components for
        building approval workflows.
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
          <span>In your Pipedream workflow, click <strong>+</strong> to add a step and search for <strong>&quot;OKrunit&quot;</strong>.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
          <span>Select an action: <strong>Create Approval</strong>, <strong>Get Approval</strong>, <strong>List Approvals</strong>, or <strong>Add Comment</strong>.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">3</span>
          <span>Connect your OKrunit account by entering your API key.</span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">4</span>
          <span>For triggers, use the <strong>New Approval</strong> or <strong>Approval Decided</strong> sources to start workflows when events occur in OKrunit.</span>
        </li>
      </ol>

      <DocsImage
        src="/screenshots/docs/routes-list.webp"
        alt="Approval routes configuration in the OKrunit dashboard"
        caption="Configure routing rules to control who gets notified and how many approvals are required per source."
      />

      {/* How your workflow waits */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        How your workflow waits for a decision
      </h2>
      <p className="mt-4 text-zinc-700">
        Each platform handles the &quot;pause and wait&quot; pattern differently.
        Here&apos;s how OKrunit works with each one to ensure your workflow waits
        as long as needed until a human approves or rejects.
      </p>

      <div className="mt-6 space-y-4">
        {/* Zapier */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">Zapier — Waits indefinitely</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            The <strong>Request Approval</strong> action uses Zapier&apos;s native callback
            pattern. When the Zap reaches the OKrunit step, it pauses execution and
            waits for OKrunit to send back the decision. There is <strong>no timeout</strong> —
            the Zap stays paused until someone approves or rejects, or you manually
            replay/cancel the execution. If the request is rejected, downstream
            steps are automatically skipped.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Single-step pause with callback resume (performResume)
          </p>
        </div>

        {/* Make */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">Make (Integromat) — Two-scenario pattern</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            Make&apos;s HTTP modules have a 40-second default timeout (configurable
            up to 5 minutes), which isn&apos;t enough for human approvals. Instead,
            use two scenarios: <strong>Scenario 1</strong> sets up a webhook
            trigger that listens for OKrunit&apos;s decision callback and
            performs the follow-up actions. <strong>Scenario 2</strong> creates the
            approval request (with the webhook URL from Scenario 1) and continues
            immediately. This pattern allows the approval to take as long as needed.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Two scenarios — fire-and-forget + webhook listener
          </p>
        </div>

        {/* n8n */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">n8n — Waits indefinitely</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            n8n&apos;s <strong>Wait</strong> node can pause a workflow until a
            webhook callback is received. Add the OKrunit node to create the
            request, followed by a Wait node configured to resume on webhook. When
            OKrunit sends the decision to the resume URL, the workflow continues.
            Self-hosted n8n has <strong>no timeout</strong> on Wait nodes. n8n Cloud
            may have execution time limits depending on your plan.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Single workflow with Wait node (webhook resume)
          </p>
        </div>

        {/* GitHub Actions */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">GitHub Actions — Polls until decided (6-hour default timeout)</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            The <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">okrunit/approve-action</code> GitHub
            Action creates the approval request and then polls OKrunit&apos;s API every
            30 seconds until a decision is made. GitHub Actions steps have a default{" "}
            <strong>6-hour timeout</strong>. You can increase this with{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-800">timeout-minutes</code> in
            your workflow YAML. If the request is rejected, the step fails and the
            workflow stops.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Polling loop with configurable timeout
          </p>
        </div>

        {/* monday.com */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">monday.com — Two-recipe pattern (no timeout)</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            monday.com&apos;s integration recipes don&apos;t support long-running
            pauses, so OKrunit uses a two-recipe approach: <strong>Recipe 1</strong> triggers
            on a board event (status change, item created) and sends the approval
            request to OKrunit. <strong>Recipe 2</strong> listens for OKrunit&apos;s
            decision webhook and updates the board item status accordingly. Since
            each recipe runs independently, there is <strong>no timeout</strong> on
            the approval decision.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Two recipes — event trigger + webhook listener
          </p>
        </div>

        {/* Workflow engines */}
        <div className="rounded-lg border border-zinc-200 p-5">
          <h4 className="font-semibold text-zinc-900">Temporal, Prefect, Dagster, Windmill, Pipedream — Waits indefinitely</h4>
          <p className="mt-2 text-sm text-zinc-700 leading-relaxed">
            Workflow engines are designed for long-running, durable workflows.
            The OKrunit activity/task creates the request and polls for the decision
            with configurable intervals and heartbeats. These engines handle
            retries, timeouts, and resumption natively — your workflow will wait as
            long as needed. Temporal and Prefect support <strong>heartbeats</strong> to
            keep the activity alive during extended waits.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Pattern: Durable polling with heartbeats
          </p>
        </div>
      </div>

      {/* Summary table */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left">
              <th className="pb-3 pr-4 font-semibold text-zinc-900">Platform</th>
              <th className="pb-3 pr-4 font-semibold text-zinc-900">Wait pattern</th>
              <th className="pb-3 font-semibold text-zinc-900">Timeout</th>
            </tr>
          </thead>
          <tbody className="text-zinc-700">
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 pr-4 font-medium">Zapier</td>
              <td className="py-2.5 pr-4">Callback resume (single Zap)</td>
              <td className="py-2.5">None</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 pr-4 font-medium">Make</td>
              <td className="py-2.5 pr-4">Two scenarios</td>
              <td className="py-2.5">None</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 pr-4 font-medium">n8n</td>
              <td className="py-2.5 pr-4">Wait node with webhook</td>
              <td className="py-2.5">None (self-hosted)</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 pr-4 font-medium">GitHub Actions</td>
              <td className="py-2.5 pr-4">Polling loop</td>
              <td className="py-2.5">6 hours (configurable)</td>
            </tr>
            <tr className="border-b border-zinc-100">
              <td className="py-2.5 pr-4 font-medium">monday.com</td>
              <td className="py-2.5 pr-4">Two recipes</td>
              <td className="py-2.5">None</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-medium">Workflow engines</td>
              <td className="py-2.5 pr-4">Durable polling + heartbeats</td>
              <td className="py-2.5">None</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* All integrations grid */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        All integrations
      </h2>
      <p className="mt-2 text-zinc-600">
        Below is the full list of 19 supported platforms, grouped by category.
      </p>

      {CATEGORIES.map((category) => (
        <section key={category.name} className="mt-10">
          <h3 className="text-xl font-semibold text-zinc-900">
            {category.name}
          </h3>
          <p className="mt-2 text-zinc-600">{category.description}</p>

          <div className="mt-4 space-y-3">
            {category.integrations.map((integration) => (
              <div
                key={integration.name}
                className="rounded-lg border border-zinc-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <h4 className="font-semibold text-zinc-900">
                    {integration.name}
                  </h4>
                  <StatusBadge status={integration.status} />
                </div>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
                  {integration.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* API for technical users */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        For developers: use the API directly
      </h2>
      <p className="mt-4 text-zinc-700">
        Every integration above uses the OKrunit REST API under the hood. If
        your platform is not listed, or you prefer to work in code, you can
        replicate everything with standard HTTP requests:
      </p>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Create an approval request
      </h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl -X POST https://okrunit.com/api/v1/approvals \\
  -H "Authorization: Bearer ok_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Delete user account #4821",
    "description": "Permanent deletion requested via support ticket",
    "priority": "high",
    "callback_url": "https://your-app.com/webhooks/okrunit",
    "source": "support-bot"
  }'`}</code>
      </pre>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Poll for the decision
      </h3>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-zinc-900 p-4 text-sm leading-relaxed">
        <code className="text-zinc-100">{`curl https://okrunit.com/api/v1/approvals/a1b2c3d4-... \\
  -H "Authorization: Bearer ok_your_api_key"

# Response when decided:
{
  "id": "a1b2c3d4-...",
  "status": "approved",
  "decided_at": "2026-03-24T11:30:00.000Z",
  "decided_by": "user-uuid"
}`}</code>
      </pre>

      <h3 className="mt-6 text-lg font-semibold text-zinc-900">
        Or receive a webhook callback
      </h3>
      <p className="mt-2 text-zinc-700">
        If you provided a{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">
          callback_url
        </code>
        , OKrunit will POST the decision to your endpoint automatically. See the{" "}
        <Link href="/docs/webhooks" className="text-emerald-600 hover:underline">
          Webhooks guide
        </Link>{" "}
        for payload format and HMAC verification.
      </p>

      <p className="mt-6 text-zinc-700">
        For complete endpoint documentation, see the{" "}
        <Link href="/docs/api" className="text-emerald-600 hover:underline">
          API Reference
        </Link>
        .
      </p>
    </article>
  );
}
