"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Code Snippets Generator
// Auto-generates curl, JavaScript fetch, and Python requests code snippets
// from the current playground request configuration.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CodeSnippetInput {
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
}

// ---------------------------------------------------------------------------
// Snippet generators
// ---------------------------------------------------------------------------

function generateCurl({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const parts: string[] = [`curl -X ${method}`];

  // Build full URL (for display purposes we use the relative path which will
  // be interpreted as same-origin, but for curl we show the absolute form).
  parts.push(`  '${url}'`);

  for (const h of headers) {
    if (h.key.trim() && h.value.trim()) {
      parts.push(`  -H '${h.key}: ${h.value}'`);
    }
  }

  if ((method === "POST" || method === "PATCH") && body.trim()) {
    // Escape single quotes in the body for safe shell use.
    const escaped = body.replace(/'/g, "'\\''");
    parts.push(`  -d '${escaped}'`);
  }

  return parts.join(" \\\n");
}

function generateFetch({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const headerEntries = headers.filter((h) => h.key.trim() && h.value.trim());

  const lines: string[] = [];
  lines.push(`const response = await fetch('${url}', {`);
  lines.push(`  method: '${method}',`);

  if (headerEntries.length > 0) {
    lines.push("  headers: {");
    for (const h of headerEntries) {
      lines.push(`    '${h.key}': '${h.value}',`);
    }
    lines.push("  },");
  }

  if ((method === "POST" || method === "PATCH") && body.trim()) {
    lines.push(`  body: JSON.stringify(${body.trim()}),`);
  }

  lines.push("});");
  lines.push("");
  lines.push("const data = await response.json();");
  lines.push("console.log(data);");

  return lines.join("\n");
}

function generatePython({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const headerEntries = headers.filter((h) => h.key.trim() && h.value.trim());

  const lines: string[] = [];
  lines.push("import requests");
  lines.push("");

  if (headerEntries.length > 0) {
    lines.push("headers = {");
    for (const h of headerEntries) {
      lines.push(`    "${h.key}": "${h.value}",`);
    }
    lines.push("}");
    lines.push("");
  }

  const hasBody = (method === "POST" || method === "PATCH") && body.trim();

  if (hasBody) {
    lines.push(`payload = ${body.trim()}`);
    lines.push("");
  }

  const args: string[] = [`"${url}"`];
  if (headerEntries.length > 0) args.push("headers=headers");
  if (hasBody) args.push("json=payload");

  lines.push(
    `response = requests.${method.toLowerCase()}(${args.join(", ")})`,
  );
  lines.push("print(response.status_code)");
  lines.push("print(response.json())");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// SDK snippet generators
// ---------------------------------------------------------------------------

/** Map API path + method to an SDK method call. */
function generateTypeScriptSDK({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const apiKey =
    headers.find((h) => h.key === "Authorization")?.value.replace("Bearer ", "") ??
    "YOUR_API_KEY";

  const lines: string[] = [];
  lines.push('import { OKRunitClient } from "@okrunit/sdk";');
  lines.push("");
  lines.push(`const client = new OKRunitClient({ apiKey: "${apiKey}" });`);
  lines.push("");

  // Try to map the endpoint to a specific SDK method
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const sdkCall = mapToSDKCall(method, path, body);
  lines.push(sdkCall);

  return lines.join("\n");
}

function generatePythonSDK({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const apiKey =
    headers.find((h) => h.key === "Authorization")?.value.replace("Bearer ", "") ??
    "YOUR_API_KEY";

  const lines: string[] = [];
  lines.push("from okrunit import OKRunitClient");
  lines.push("");
  lines.push(`client = OKRunitClient(api_key="${apiKey}")`);
  lines.push("");

  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const sdkCall = mapToPythonSDKCall(method, path, body);
  lines.push(sdkCall);

  return lines.join("\n");
}

function generateGoSDK({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput): string {
  const apiKey =
    headers.find((h) => h.key === "Authorization")?.value.replace("Bearer ", "") ??
    "YOUR_API_KEY";

  const lines: string[] = [];
  lines.push("package main");
  lines.push("");
  lines.push("import (");
  lines.push('\t"context"');
  lines.push('\t"fmt"');
  lines.push('\tokrunit "github.com/okrunit/okrunit-go"');
  lines.push(")");
  lines.push("");
  lines.push("func main() {");
  lines.push(`\tclient := okrunit.NewClient("${apiKey}")`);
  lines.push("\tctx := context.Background()");
  lines.push("");

  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const sdkCall = mapToGoSDKCall(method, path, body);
  lines.push(sdkCall);

  lines.push("}");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Endpoint → SDK method mapping helpers
// ---------------------------------------------------------------------------

/** Extract an {id} segment from a path like /api/v1/approvals/abc123 */
function extractId(path: string): string | null {
  const match = path.match(/\/api\/v1\/approvals\/([^/]+)$/);
  return match ? match[1] : null;
}

function extractCommentApprovalId(path: string): string | null {
  const match = path.match(/\/api\/v1\/approvals\/([^/]+)\/comments/);
  return match ? match[1] : null;
}

function parseBody(body: string): Record<string, unknown> {
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function formatObject(obj: Record<string, unknown>, indent = 2): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(indent);
  const inner = entries
    .map(([k, v]) => `${pad}  ${k}: ${JSON.stringify(v)},`)
    .join("\n");
  return `{\n${inner}\n${pad}}`;
}

function formatPythonDict(obj: Record<string, unknown>, indent = 4): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  const pad = " ".repeat(indent);
  const inner = entries
    .map(([k, v]) => `${pad}    "${k}": ${JSON.stringify(v)},`)
    .join("\n");
  return `{\n${inner}\n${pad}}`;
}

function mapToSDKCall(method: string, path: string, body: string): string {
  const commentApprovalId = extractCommentApprovalId(path);
  if (commentApprovalId) {
    if (method === "POST") {
      const parsed = parseBody(body);
      return `const comment = await client.addComment("${commentApprovalId}", ${JSON.stringify(parsed.body ?? "")});\nconsole.log(comment);`;
    }
    return `const comments = await client.listComments("${commentApprovalId}");\nconsole.log(comments);`;
  }

  const id = extractId(path);
  if (id) {
    if (method === "PATCH") {
      const parsed = parseBody(body);
      return `const approval = await client.respondToApproval("${id}", ${formatObject(parsed as Record<string, unknown>)});\nconsole.log(approval);`;
    }
    if (method === "DELETE") {
      return `await client.cancelApproval("${id}");\nconsole.log("Approval cancelled");`;
    }
    return `const approval = await client.getApproval("${id}");\nconsole.log(approval);`;
  }

  if (path.includes("/approvals/batch")) {
    const parsed = parseBody(body);
    return `const results = await client.batchRespond(${formatObject(parsed as Record<string, unknown>)});\nconsole.log(results);`;
  }

  if (method === "POST" && path.includes("/approvals")) {
    const parsed = parseBody(body);
    return `const approval = await client.createApproval(${formatObject(parsed as Record<string, unknown>)});\nconsole.log(approval);\n\n// Optionally wait for a decision:\n// const decided = await client.waitForDecision(approval.data.id);`;
  }

  if (method === "GET" && path.includes("/approvals")) {
    return `const approvals = await client.listApprovals();\nconsole.log(approvals);`;
  }

  // Fallback: show generic fetch with SDK auth
  return `// This endpoint doesn't have a dedicated SDK method yet.\n// Use the JavaScript fetch tab instead.`;
}

function mapToPythonSDKCall(method: string, path: string, body: string): string {
  const commentApprovalId = extractCommentApprovalId(path);
  if (commentApprovalId) {
    if (method === "POST") {
      const parsed = parseBody(body);
      return `comment = client.add_comment("${commentApprovalId}", ${JSON.stringify(parsed.body ?? "")})\nprint(comment)`;
    }
    return `comments = client.list_comments("${commentApprovalId}")\nprint(comments)`;
  }

  const id = extractId(path);
  if (id) {
    if (method === "PATCH") {
      const parsed = parseBody(body);
      return `approval = client.respond_to_approval("${id}", ${formatPythonDict(parsed as Record<string, unknown>)})\nprint(approval)`;
    }
    if (method === "DELETE") {
      return `client.cancel_approval("${id}")\nprint("Approval cancelled")`;
    }
    return `approval = client.get_approval("${id}")\nprint(approval)`;
  }

  if (path.includes("/approvals/batch")) {
    const parsed = parseBody(body);
    return `results = client.batch_respond(${formatPythonDict(parsed as Record<string, unknown>)})\nprint(results)`;
  }

  if (method === "POST" && path.includes("/approvals")) {
    const parsed = parseBody(body);
    return `approval = client.create_approval(${formatPythonDict(parsed as Record<string, unknown>)})\nprint(approval)\n\n# Optionally wait for a decision:\n# decided = client.wait_for_decision(approval["data"]["id"])`;
  }

  if (method === "GET" && path.includes("/approvals")) {
    return `approvals = client.list_approvals()\nprint(approvals)`;
  }

  return `# This endpoint doesn't have a dedicated SDK method yet.\n# Use the Python requests tab instead.`;
}

function mapToGoSDKCall(method: string, path: string, body: string): string {
  const commentApprovalId = extractCommentApprovalId(path);
  if (commentApprovalId) {
    if (method === "POST") {
      const parsed = parseBody(body);
      return `\tcomment, err := client.AddComment(ctx, "${commentApprovalId}", ${JSON.stringify(parsed.body ?? "")})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", comment)`;
    }
    return `\tcomments, err := client.ListComments(ctx, "${commentApprovalId}")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", comments)`;
  }

  const id = extractId(path);
  if (id) {
    if (method === "PATCH") {
      const parsed = parseBody(body);
      const goParams = Object.entries(parsed)
        .map(([k, v]) => `\t\t${k[0].toUpperCase() + k.slice(1)}: ${JSON.stringify(v)},`)
        .join("\n");
      return `\tapproval, err := client.RespondToApproval(ctx, "${id}", okrunit.RespondApprovalParams{\n${goParams}\n\t})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", approval)`;
    }
    if (method === "DELETE") {
      return `\terr := client.CancelApproval(ctx, "${id}")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Println("Approval cancelled")`;
    }
    return `\tapproval, err := client.GetApproval(ctx, "${id}")\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", approval)`;
  }

  if (method === "POST" && path.includes("/approvals")) {
    const parsed = parseBody(body);
    const goParams = Object.entries(parsed)
      .map(([k, v]) => {
        const goKey = k.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join("");
        return `\t\t${goKey}: ${JSON.stringify(v)},`;
      })
      .join("\n");
    return `\tapproval, err := client.CreateApproval(ctx, okrunit.CreateApprovalParams{\n${goParams}\n\t})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", approval)`;
  }

  if (method === "GET" && path.includes("/approvals")) {
    return `\tapprovals, err := client.ListApprovals(ctx, okrunit.ListApprovalsParams{})\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tfmt.Printf("%+v\\n", approvals)`;
  }

  return `\t// This endpoint doesn't have a dedicated SDK method yet.\n\t// Use a raw HTTP request instead.`;
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  return (
    <Button
      type="button"
      variant={copied ? "default" : "secondary"}
      size="sm"
      className="h-8 gap-1.5 text-xs"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied!" : "Copy code"}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CodeSnippets({
  method,
  url,
  headers,
  body,
}: CodeSnippetInput) {
  const input: CodeSnippetInput = { method, url, headers, body };
  const curlSnippet = generateCurl(input);
  const fetchSnippet = generateFetch(input);
  const pythonSnippet = generatePython(input);
  const tsSDKSnippet = generateTypeScriptSDK(input);
  const pySDKSnippet = generatePythonSDK(input);
  const goSDKSnippet = generateGoSDK(input);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-base">Code Snippets</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top">
              Auto-generated code examples based on your current request configuration. Copy these into your own projects to make the same API call.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="typescript-sdk">
          <div className="flex items-center justify-between gap-2">
            <TabsList className="flex-wrap h-auto gap-0.5">
              <TabsTrigger value="typescript-sdk">TypeScript SDK</TabsTrigger>
              <TabsTrigger value="python-sdk">Python SDK</TabsTrigger>
              <TabsTrigger value="go-sdk">Go SDK</TabsTrigger>
              <TabsTrigger value="curl">curl</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="typescript-sdk" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={tsSDKSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{tsSDKSnippet}</code>
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                Install: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">npm install @okrunit/sdk</code>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="python-sdk" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={pySDKSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{pySDKSnippet}</code>
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                Install: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">pip install okrunit</code>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="go-sdk" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={goSDKSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{goSDKSnippet}</code>
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                Install: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">go get github.com/okrunit/okrunit-go</code>
              </p>
            </div>
          </TabsContent>

          <TabsContent value="curl" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={curlSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{curlSnippet}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="javascript" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={fetchSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{fetchSnippet}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="python" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={pythonSnippet} />
              </div>
              <pre className="overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{pythonSnippet}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
