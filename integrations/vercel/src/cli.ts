#!/usr/bin/env node
/**
 * OKRunit Vercel CLI
 *
 * Usage:
 *   npx @okrunit/vercel approve --title "Deploy to production" --priority critical
 *   npx @okrunit/vercel approve --timeout 1800
 */

import { requestApproval } from "./index.js";

const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

function printUsage(): void {
  console.log(`
OKRunit Vercel Approval Gate

Usage:
  npx @okrunit/vercel approve [options]

Options:
  --title <text>         Approval title (auto-generated from Vercel env if omitted)
  --description <text>   Additional context for the reviewer
  --priority <level>     low, medium, high, or critical (default: medium)
  --metadata <json>      JSON metadata string
  --timeout <seconds>    Max wait time (default: 3600)
  --poll-interval <sec>  Polling interval (default: 10)

Environment:
  OKRUNIT_API_KEY        Required. Your OKRunit API key (gk_...)
  OKRUNIT_API_URL        Optional. OKRunit instance URL (default: https://app.okrunit.com)

Examples:
  OKRUNIT_API_KEY=gk_... npx @okrunit/vercel approve --title "Deploy to prod" --priority critical
  OKRUNIT_API_KEY=gk_... npx @okrunit/vercel approve --timeout 1800
`.trim());
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      args[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith("--")) {
      args._command = argv[i];
    }
  }
  return args;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("--help") || rawArgs.includes("-h") || rawArgs.length === 0) {
    printUsage();
    process.exit(0);
  }

  const args = parseArgs(rawArgs);
  const command = args._command;

  if (command !== "approve") {
    console.error(`Unknown command: ${command ?? "(none)"}`);
    console.error('Run with "approve" or --help for usage.');
    process.exit(1);
  }

  const apiKey = process.env.OKRUNIT_API_KEY;
  if (!apiKey) {
    console.error("Error: OKRUNIT_API_KEY environment variable is required");
    process.exit(1);
  }

  const priority = args.priority ?? "medium";
  if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
    console.error(
      `Invalid priority "${priority}". Must be one of: ${VALID_PRIORITIES.join(", ")}`,
    );
    process.exit(1);
  }

  let metadata: Record<string, unknown> | undefined;
  if (args.metadata) {
    try {
      metadata = JSON.parse(args.metadata);
    } catch {
      console.error("Error: --metadata must be valid JSON");
      process.exit(1);
    }
  }

  const result = await requestApproval({
    apiKey,
    title: args.title,
    description: args.description,
    priority: priority as "low" | "medium" | "high" | "critical",
    metadata,
    timeout: args.timeout ? parseInt(args.timeout, 10) : undefined,
    pollInterval: args["poll-interval"]
      ? parseInt(args["poll-interval"], 10)
      : undefined,
  });

  if (result.status === "approved") {
    process.exit(0);
  }

  if (result.status === "rejected") {
    console.error(
      `Deployment rejected${result.decidedBy ? ` by ${result.decidedBy}` : ""}${result.comment ? `: ${result.comment}` : ""}`,
    );
    process.exit(1);
  }

  console.error(`Approval timed out. ID: ${result.id}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Unexpected error");
  process.exit(1);
});
