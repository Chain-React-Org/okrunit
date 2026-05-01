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
    "Pick a single shipped feature from the brief and tweet about it. Show what it actually does for the user. Concrete, no vague phrases like 'powerful' or 'seamless'. Lead with the user-visible behavior, not the implementation.",
  lesson:
    "Share a lesson learned, hot take, or non-obvious observation from the brief. Sound like a developer thinking out loud, not a marketer. Spicy is fine. Boring is not.",
  use_case:
    "Pick a real-world scenario from the use_cases section and walk through how OKrunit fits in. Make it concrete: name the integration, name the action, name what could go wrong without approval.",
  milestone:
    "Reference a milestone or build-in-public detail. If none fits, fall back to a feature tweet. Numbers and specifics over vague claims.",
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

# Hard rules
- Maximum ${TWEET_MAX_CHARS} characters total. This is enforced. Count every character.
- No em dashes anywhere. Use periods or commas.
- No hashtags. No emojis.
- No links unless directly useful.
- Don't say "OKrunit" more than once.
- Don't use the word "seamless", "powerful", "robust", "leverage", "revolutionary".
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

export async function generateTweet(
  brief: TweetBrief,
  config: TweetConfig,
  themeOverride?: TweetTheme,
): Promise<GenerationResult> {
  const theme = themeOverride ?? pickTheme(config);
  const prompt = buildPrompt(brief, theme);

  try {
    const result = await generateOnce(config.model, prompt);
    const content = cleanTweet(result.text);
    if (!content) throw new Error("Empty generation result");
    return {
      content,
      theme,
      metadata: {
        model: config.model,
        fallbackUsed: false,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      },
    };
  } catch (primaryErr) {
    logger.error("[Tweets] Primary model failed, trying fallback:", primaryErr);
    const result = await generateOnce(config.fallback_model, prompt);
    const content = cleanTweet(result.text);
    return {
      content,
      theme,
      metadata: {
        model: config.fallback_model,
        fallbackUsed: true,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      },
    };
  }
}
