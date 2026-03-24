import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "OKRunit integrations — connect with Zapier, Make, n8n, GitHub Actions, Terraform, LangChain, and more.",
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
        status: "coming_soon",
      },
      {
        name: "CrewAI",
        description:
          "Custom tool for CrewAI agents that requires human approval before proceeding with high-stakes actions in multi-agent workflows.",
        status: "coming_soon",
      },
      {
        name: "AutoGen",
        description:
          "Integration for Microsoft AutoGen that adds human-in-the-loop approval to multi-agent conversations and task execution.",
        status: "coming_soon",
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
        status: "coming_soon",
      },
      {
        name: "Vercel",
        description:
          "Deployment protection integration that requires human approval before promoting preview deployments to production.",
        status: "coming_soon",
      },
      {
        name: "Netlify",
        description:
          "Build plugin and deploy hook integration that gates production deployments behind human approval.",
        status: "coming_soon",
      },
    ],
  },
  {
    name: "Enterprise Platforms",
    description:
      "Connect OKRunit to enterprise automation and internal tool platforms.",
    integrations: [
      {
        name: "Power Automate",
        description:
          "Custom connector for Microsoft Power Automate that adds approval steps to Power Automate flows using OKRunit as the backend.",
        status: "coming_soon",
      },
      {
        name: "Retool",
        description:
          "Retool component and workflow integration for building custom approval dashboards and embedding approval controls in internal tools.",
        status: "coming_soon",
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
          "Prefect task and flow that pauses a Prefect flow run pending human approval via OKRunit. Integrates with Prefect Cloud notifications.",
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
        OKRunit connects to 19 platforms across automation, AI agents,
        infrastructure, and workflow engines. Every integration uses the same
        underlying REST API, so you can also build your own with a few HTTP
        calls.
      </p>

      {/* Universal API */}
      <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-900">
          Works with any HTTP client
        </h3>
        <p className="mt-1 text-sm text-emerald-800">
          Every platform listed below uses the OKRunit REST API under the hood.
          If your platform is not listed, you can integrate directly with a
          single POST request.{" "}
          <a href="/docs/api" className="underline">
            See the API reference.
          </a>
        </p>
      </div>

      {/* Categories */}
      {CATEGORIES.map((category) => (
        <section key={category.name} className="mt-12">
          <h2 className="text-2xl font-semibold text-zinc-900">
            {category.name}
          </h2>
          <p className="mt-2 text-zinc-600">{category.description}</p>

          <div className="mt-6 space-y-4">
            {category.integrations.map((integration) => (
              <div
                key={integration.name}
                className="rounded-lg border border-zinc-200 p-4"
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-zinc-900">
                    {integration.name}
                  </h3>
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

      {/* Building your own */}
      <h2 className="mt-12 text-2xl font-semibold text-zinc-900">
        Building your own integration
      </h2>
      <p className="mt-4 text-zinc-700">
        All OKRunit integrations use the same REST API. To build your own:
      </p>
      <ol className="mt-4 space-y-3 text-zinc-700">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            1
          </span>
          <span>
            Create a connection in the OKRunit dashboard and save the API key.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            2
          </span>
          <span>
            POST to <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">/api/v1/approvals</code> with
            your approval details and a callback URL.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            3
          </span>
          <span>
            Handle the webhook callback (or poll the GET endpoint) to receive
            the decision.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            4
          </span>
          <span>
            Set the{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-800">source</code> field
            to your platform name for filtering and analytics.
          </span>
        </li>
      </ol>

      <p className="mt-6 text-zinc-700">
        Refer to the{" "}
        <a href="/docs/api" className="text-emerald-600 hover:underline">
          API Reference
        </a>{" "}
        for complete endpoint documentation and the{" "}
        <a href="/docs/webhooks" className="text-emerald-600 hover:underline">
          Webhooks guide
        </a>{" "}
        for callback signature verification.
      </p>
    </article>
  );
}
