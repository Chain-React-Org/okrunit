// ---------------------------------------------------------------------------
// OKrunit -- Error Fingerprinting / Grouping
// ---------------------------------------------------------------------------
// Generates a deterministic fingerprint from an error so that duplicate
// occurrences of the same bug group into a single issue. Two errors share
// a fingerprint if they have the same type, normalised message, and
// top stack frames.
// ---------------------------------------------------------------------------

import { createHash } from "crypto";

/**
 * Generate a SHA-256 fingerprint for an error.
 *
 * The fingerprint is built from:
 * 1. Error type (e.g. "TypeError", "ApiError")
 * 2. Normalised message (UUIDs, numbers, timestamps stripped)
 * 3. First 5 stack frames with paths normalised
 */
export function generateFingerprint(error: unknown): string {
  const { type, message, frames } = extractErrorParts(error);
  const normalised = normalizeMessage(message);
  const frameKey = frames.slice(0, 5).map(normalizeFrame).join("|");
  const raw = `${type}:${normalised}:${frameKey}`;
  return createHash("sha256").update(raw).digest("hex");
}

/** Extract structured parts from any thrown value. */
function extractErrorParts(error: unknown): {
  type: string;
  message: string;
  frames: string[];
} {
  if (error instanceof Error) {
    return {
      type: error.constructor.name || "Error",
      message: error.message || "",
      frames: parseStackFrames(error.stack),
    };
  }

  if (typeof error === "string") {
    return { type: "StringError", message: error, frames: [] };
  }

  if (error == null) {
    return { type: "UnknownError", message: String(error), frames: [] };
  }

  try {
    return { type: "UnknownError", message: JSON.stringify(error), frames: [] };
  } catch {
    return { type: "UnknownError", message: String(error), frames: [] };
  }
}

/** Parse a V8 stack trace string into individual frame lines. */
function parseStackFrames(stack?: string): string[] {
  if (!stack) return [];
  return stack
    .split("\n")
    .filter((line) => line.trim().startsWith("at "))
    .map((line) => line.trim());
}

/**
 * Normalise a stack frame line by:
 * - Stripping absolute paths (keep only relative from src/)
 * - Removing line and column numbers
 * - Removing query strings and hashes
 */
function normalizeFrame(frame: string): string {
  // Extract the function and file parts
  let normalised = frame;

  // Strip absolute paths - keep from src/ or node_modules/ onwards
  normalised = normalised.replace(
    /\(?\/?(?:.*?\/)(src\/[^):\s]+|node_modules\/[^):\s]+)/g,
    "($1",
  );

  // Strip line:column numbers
  normalised = normalised.replace(/:\d+:\d+\)?/g, ")");

  // Strip webpack/turbopack chunk hashes
  normalised = normalised.replace(/\?[a-f0-9]+/g, "");

  return normalised;
}

/**
 * Normalise an error message to group variable parts:
 * - UUIDs → <UUID>
 * - Numbers (4+ digits) → <N>
 * - ISO timestamps → <TS>
 * - Quoted strings → <STR>
 * - Email addresses → <EMAIL>
 */
function normalizeMessage(message: string): string {
  return message
    // UUIDs
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "<UUID>",
    )
    // ISO timestamps
    .replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g,
      "<TS>",
    )
    // Long numeric IDs (4+ digits)
    .replace(/\b\d{4,}\b/g, "<N>")
    // Trim whitespace
    .trim();
}
