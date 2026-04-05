#!/usr/bin/env node
// ---------------------------------------------------------------------------
// OKRunit CLI -- Entry Point
// ---------------------------------------------------------------------------

import { OKRunitClient } from "@okrunit/sdk";
import type { OutputFormat } from "./output";
import { formatApproval, formatApprovalList, formatCommentList, formatComment } from "./output";
import { getApiKey, getBaseUrl, saveConfig, loadConfig } from "./config";

const args = process.argv.slice(2);
const command = args[0];

function flag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

function getFormat(): OutputFormat {
  return flag("format") === "json" ? "json" : "table";
}

function getClient(): OKRunitClient {
  return new OKRunitClient({
    apiKey: getApiKey(),
    baseUrl: getBaseUrl(),
  });
}

async function main(): Promise<void> {
  switch (command) {
    case "request":
      return cmdRequest();
    case "get":
      return cmdGet();
    case "list":
      return cmdList();
    case "approve":
      return cmdRespond("approve");
    case "reject":
      return cmdRespond("reject");
    case "cancel":
      return cmdCancel();
    case "wait":
      return cmdWait();
    case "comment":
      return cmdComment();
    case "comments":
      return cmdComments();
    case "configure":
      return cmdConfigure();
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return cmdHelp();
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'okrunit help' for usage.");
      process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdRequest(): Promise<void> {
  const title = args[1];
  if (!title) {
    console.error("Usage: okrunit request <title> [--priority high] [--callback-url URL] [--wait]");
    process.exit(1);
  }

  const client = getClient();
  const { data: approval } = await client.createApproval({
    title,
    priority: (flag("priority") as "low" | "medium" | "high" | "critical") ?? undefined,
    callback_url: flag("callback-url"),
    action_type: flag("type"),
    description: flag("description"),
    idempotency_key: flag("idempotency-key"),
    metadata: flag("metadata") ? JSON.parse(flag("metadata")!) : undefined,
  });

  console.log(formatApproval(approval, getFormat()));

  if (hasFlag("wait")) {
    const timeout = flag("timeout") ? parseInt(flag("timeout")!, 10) * 1000 : 300_000;
    console.log("\nWaiting for decision...");
    const decided = await client.waitForDecision(approval.id, { timeout });
    console.log(`\nDecision: ${decided.status}`);
    if (decided.decision_comment) {
      console.log(`Comment: ${decided.decision_comment}`);
    }
    process.exit(decided.status === "approved" ? 0 : 1);
  }
}

async function cmdGet(): Promise<void> {
  const id = args[1];
  if (!id) {
    console.error("Usage: okrunit get <approval-id>");
    process.exit(1);
  }

  const client = getClient();
  const { data: approval } = await client.getApproval(id);
  console.log(formatApproval(approval, getFormat()));
}

async function cmdList(): Promise<void> {
  const client = getClient();
  const result = await client.listApprovals({
    status: (flag("status") as "pending" | "approved" | "rejected") ?? undefined,
    priority: (flag("priority") as "low" | "medium" | "high" | "critical") ?? undefined,
    search: flag("search"),
    page: flag("page") ? parseInt(flag("page")!, 10) : undefined,
    page_size: flag("page-size") ? parseInt(flag("page-size")!, 10) : undefined,
  });
  console.log(formatApprovalList(result.data, result.total, getFormat()));
}

async function cmdRespond(decision: "approve" | "reject"): Promise<void> {
  const id = args[1];
  if (!id) {
    console.error(`Usage: okrunit ${decision} <approval-id> [--comment "reason"]`);
    process.exit(1);
  }

  const client = getClient();
  const { data: approval } = await client.respondToApproval(id, {
    decision,
    comment: flag("comment"),
    source: "api",
  });
  console.log(formatApproval(approval, getFormat()));
}

async function cmdCancel(): Promise<void> {
  const id = args[1];
  if (!id) {
    console.error("Usage: okrunit cancel <approval-id>");
    process.exit(1);
  }

  const client = getClient();
  const { data: approval } = await client.cancelApproval(id);
  console.log(formatApproval(approval, getFormat()));
}

async function cmdWait(): Promise<void> {
  const id = args[1];
  if (!id) {
    console.error("Usage: okrunit wait <approval-id> [--timeout 300]");
    process.exit(1);
  }

  const timeout = flag("timeout") ? parseInt(flag("timeout")!, 10) * 1000 : 300_000;
  const client = getClient();

  console.log("Waiting for decision...");
  const decided = await client.waitForDecision(id, { timeout });
  console.log(formatApproval(decided, getFormat()));
  process.exit(decided.status === "approved" ? 0 : 1);
}

async function cmdComment(): Promise<void> {
  const id = args[1];
  const body = args[2] ?? flag("body");
  if (!id || !body) {
    console.error('Usage: okrunit comment <approval-id> "comment text"');
    process.exit(1);
  }

  const client = getClient();
  const { data: comment } = await client.addComment(id, body);
  console.log(formatComment(comment, getFormat()));
}

async function cmdComments(): Promise<void> {
  const id = args[1];
  if (!id) {
    console.error("Usage: okrunit comments <approval-id>");
    process.exit(1);
  }

  const client = getClient();
  const { data: comments } = await client.listComments(id);
  console.log(formatCommentList(comments, getFormat()));
}

function cmdConfigure(): void {
  const config = loadConfig();

  const key = flag("api-key") ?? args[1];
  if (key) config.api_key = key;

  const url = flag("base-url");
  if (url) config.base_url = url;

  if (!key && !url) {
    console.error("Usage: okrunit configure --api-key <key> [--base-url <url>]");
    process.exit(1);
  }

  saveConfig(config);
  console.log("Configuration saved to ~/.okrunit/config.json");
}

function cmdHelp(): void {
  console.log(`OKRunit CLI v0.1.0

USAGE
  okrunit <command> [options]

COMMANDS
  request <title>       Create an approval request
    --priority <level>    Priority: low, medium, high, critical
    --callback-url <url>  Callback URL for decision notification
    --type <type>         Action type
    --description <text>  Description
    --metadata <json>     JSON metadata
    --wait                Block until decision is made
    --timeout <seconds>   Timeout for --wait (default: 300)

  get <id>              Get approval details
  list                  List approvals
    --status <status>     Filter: pending, approved, rejected, cancelled, expired
    --priority <level>    Filter by priority
    --search <query>      Full-text search
    --page <n>            Page number
    --page-size <n>       Results per page

  approve <id>          Approve a request
    --comment <text>      Optional comment

  reject <id>           Reject a request
    --comment <text>      Optional comment

  cancel <id>           Cancel a pending request

  wait <id>             Wait for a decision
    --timeout <seconds>   Timeout (default: 300)

  comment <id> <text>   Add a comment
  comments <id>         List comments

  configure             Set API key and base URL
    --api-key <key>       Your OKRunit API key (ok_...)
    --base-url <url>      API base URL

GLOBAL OPTIONS
  --format json         Output as JSON instead of table

ENVIRONMENT
  OKRUNIT_API_KEY       API key (overrides config file)
  OKRUNIT_BASE_URL      Base URL (overrides config file)

CONFIG
  ~/.okrunit/config.json
`);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  if (err && typeof err === "object" && "statusCode" in err) {
    console.error(`Error (${err.statusCode}): ${err.message}`);
    if (err.code) console.error(`Code: ${err.code}`);
  } else {
    console.error("Error:", err?.message ?? err);
  }
  process.exit(1);
});
