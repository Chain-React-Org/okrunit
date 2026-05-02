// ---------------------------------------------------------------------------
// OKrunit -- Tweet Generator
// ---------------------------------------------------------------------------
// Picks a theme based on configured weights, builds a prompt from the brief,
// and calls the AI Gateway to produce a draft tweet. Falls back to the
// secondary model if the primary fails.
// ---------------------------------------------------------------------------

import { generateText } from "ai";
import { logger } from "@/lib/monitoring/logger";
import { TWEET_MAX_CHARS } from "@/lib/tweets/types";
import type {
  GenerationResult,
  TweetBrief,
  TweetConfig,
  TweetTheme,
} from "@/lib/tweets/types";

const THEME_INSTRUCTIONS: Record<TweetTheme, string> = {
  feature:
    "Pick ONE specific shipped feature from the brief. Tweet about it in 2-4 sentences. Sentence 1: name the user-visible behavior. Sentence 2-3: the concrete scenario or detail that makes it land. Optional sentence 4: a kicker or aside. Always include at least one concrete proper noun: an integration name (Slack, Zapier, n8n, etc.), a specific action, or a named scenario.",
  lesson:
    "State a lesson, hot take, or observation in 2-4 sentences. Sentence 1: the claim, stated directly. Sentence 2-3: why it's true or what evidence backs it. Sound like a developer thinking out loud, not a marketer. Spicy and contrarian is fine. Generic platitudes are not.",
  use_case:
    "Walk through ONE real-world scenario from the use_cases section in 2-4 sentences. Name the integration. Name the workflow action. Name what would go wrong without an approval gate. Then name what OKrunit actually does in that flow.",
  milestone:
    "Reference a milestone, shipped detail, or build-in-public observation in 2-4 sentences. Numbers and specifics only. If you don't have a real number from the brief, do NOT invent one. Fall back to a feature or lesson tweet instead.",
};

export function pickTheme(config: TweetConfig): TweetTheme {
  const roll = Math.random() * 100;
  let acc = 0;
  acc += config.theme_feature_pct;
  if (roll < acc) return "feature";
  acc += config.theme_lesson_pct;
  if (roll < acc) return "lesson";
  acc += config.theme_use_case_pct;
  if (roll < acc) return "use_case";
  return "milestone";
}

function buildPrompt(brief: TweetBrief, theme: TweetTheme): string {
  return `You are a developer-tone Twitter ghostwriter for OKrunit, posting build-in-public style tweets from the founder's account.

# About OKrunit
${brief.app_description || "Human-in-the-loop approval gateway for automated workflows."}

# Voice
${brief.voice_guidelines || "Direct, dev-style, no marketing fluff. No emojis. No hashtags. No em dashes (use periods or commas instead). Sentences can be punchy fragments. First-person OK."}

# Shipped features
${brief.shipped_features || "(none provided)"}

# Hot takes / lessons
${brief.hot_takes || "(none provided)"}

# Use cases
${brief.use_cases || "(none provided)"}

# Examples of good tweets
${brief.example_tweets || "(none provided)"}

# Do not mention
${brief.do_not_mention || "(none provided)"}

# Tweet to write
Theme: ${theme}
Instruction: ${THEME_INSTRUCTIONS[theme]}

# Length and substance rules
- Length: between 140 and ${TWEET_MAX_CHARS} characters. Aim for 180-260. Anything under 100 characters reads as a stub headline and is unacceptable.
- Multiple sentences. A single fragment like "Need someone else to cover your approvals" is not a tweet, it is a sub-headline. Reject and rewrite if you produce one.
- Concrete > vague. Every tweet must include at least one specific proper noun (an integration name, action verb, or scenario) drawn from the brief. Avoid abstract claims with no anchor.
- Show, don't tell. Don't describe a feature ("delegation lets you cover approvals"). Show the situation ("You're heading on vacation. Hand off your approvals to a teammate. They get the pings, you don't.").

# Anti-patterns to NEVER produce
- "Need someone else to cover your approvals" (stub headline, no scenario, no detail)
- "Powerful approval workflows for modern teams" (generic marketing)
- "Just shipped..." or "Excited to announce..." (LinkedIn voice)
- Any tweet that could be auto-generated for any other product by find-and-replacing the name

# Hard rules
- Maximum ${TWEET_MAX_CHARS} characters total. This is enforced. Count every character.
- No em dashes anywhere. Use periods or commas.
- No hashtags. No emojis.
- No links unless directly useful.
- Don't say "OKrunit" more than once.
- Don't use the words: seamless, powerful, robust, leverage, revolutionary, game-changing, effortless, magical.
- Output ONLY the tweet text. No quotes around it. No preamble. No explanation. No "Here's the tweet:" framing.`;
}

async function generateOnce(
  model: string,
  prompt: string,
): Promise<{ text: string; usage: { promptTokens?: number; completionTokens?: number } }> {
  const result = await generateText({
    model,
    prompt,
    temperature: 0.9,
    maxOutputTokens: 200,
  });

  return {
    text: result.text.trim(),
    usage: {
      promptTokens: result.usage?.inputTokens,
      completionTokens: result.usage?.outputTokens,
    },
  };
}

function cleanTweet(raw: string): string {
  let text = raw.trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  text = text.replace(/—/g, ",").replace(/–/g, ",");
  if (text.length > TWEET_MAX_CHARS) {
    text = text.slice(0, TWEET_MAX_CHARS - 1).trimEnd();
  }
  return text;
}

const MIN_TWEET_CHARS = 100;
const MAX_RETRIES_PER_MODEL = 2;

function isAcceptable(content: string): boolean {
  if (content.length < MIN_TWEET_CHARS) return false;
  if (!content.includes(" ")) return false;
  if (!/[.!?]/.test(content)) return false;
  return true;
}

async function tryGenerate(
  model: string,
  prompt: string,
): Promise<{ content: string; usage: { promptTokens?: number; completionTokens?: number } } | null> {
  for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
    const result = await generateOnce(model, prompt);
    const content = cleanTweet(result.text);
    if (isAcceptable(content)) {
      return { content, usage: result.usage };
    }
    logger.error(
      `[Tweets] ${model} produced unacceptable output (attempt ${attempt + 1}, len=${content.length}): "${content}"`,
    );
  }
  return null;
}

export async function generateTweet(
  brief: TweetBrief,
  config: TweetConfig,
  themeOverride?: TweetTheme,
): Promise<GenerationResult> {
  const theme = themeOverride ?? pickTheme(config);
  const prompt = buildPrompt(brief, theme);

  const primary = await tryGenerate(config.model, prompt).catch((err) => {
    logger.error("[Tweets] Primary model threw:", err);
    return null;
  });
  if (primary) {
    return {
      content: primary.content,
      theme,
      metadata: {
        model: config.model,
        fallbackUsed: false,
        promptTokens: primary.usage.promptTokens,
        completionTokens: primary.usage.completionTokens,
      },
    };
  }

  const fallback = await tryGenerate(config.fallback_model, prompt);
  if (!fallback) {
    throw new Error("Both primary and fallback models failed to produce an acceptable tweet");
  }
  return {
    content: fallback.content,
    theme,
    metadata: {
      model: config.fallback_model,
      fallbackUsed: true,
      promptTokens: fallback.usage.promptTokens,
      completionTokens: fallback.usage.completionTokens,
    },
  };
}
