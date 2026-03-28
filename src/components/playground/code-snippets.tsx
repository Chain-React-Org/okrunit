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
        <Tabs defaultValue="curl">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="curl">curl</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="curl" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={curlSnippet} />
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{curlSnippet}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="javascript" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={fetchSnippet} />
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{fetchSnippet}</code>
              </pre>
            </div>
          </TabsContent>

          <TabsContent value="python" className="mt-3">
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton text={pythonSnippet} />
              </div>
              <pre className="max-h-[320px] overflow-auto rounded-md border bg-zinc-950 p-4 pr-20 text-xs leading-relaxed font-mono text-zinc-100">
                <code>{pythonSnippet}</code>
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
