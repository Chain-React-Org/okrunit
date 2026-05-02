// ---------------------------------------------------------------------------
// OKrunit -- Tweet Automation Types
// ---------------------------------------------------------------------------

export type TweetTheme = "feature" | "lesson" | "use_case" | "milestone";

export type TweetDraftStatus =
  | "pending_approval"
  | "approved"
  | "posted"
  | "rejected"
  | "failed"
  | "expired";

export interface TweetBrief {
  id: boolean;
  app_description: string;
  voice_guidelines: string;
  shipped_features: string;
  hot_takes: string;
  use_cases: string;
  do_not_mention: string;
  example_tweets: string;
  updated_at: string;
}

export interface TweetConfig {
  id: boolean;
  enabled: boolean;
  posting_slots: string[];
  posting_days: number[];
  generation_lead_minutes: number;
  model: string;
  fallback_model: string;
  theme_feature_pct: number;
  theme_lesson_pct: number;
  theme_use_case_pct: number;
  theme_milestone_pct: number;
  notify_connection_ids: string[];
  auto_regenerate_on_reject: boolean;
  post_webhook_url: string | null;
  auto_approve_feature: boolean;
  auto_approve_lesson: boolean;
  auto_approve_use_case: boolean;
  auto_approve_milestone: boolean;
  updated_at: string;
}

export function isThemeAutoApproved(
  config: TweetConfig,
  theme: TweetTheme,
): boolean {
  switch (theme) {
    case "feature":
      return config.auto_approve_feature;
    case "lesson":
      return config.auto_approve_lesson;
    case "use_case":
      return config.auto_approve_use_case;
    case "milestone":
      return config.auto_approve_milestone;
  }
}

export interface TweetDraft {
  id: string;
  content: string;
  original_content: string;
  theme: TweetTheme;
  status: TweetDraftStatus;
  scheduled_for: string;
  posted_at: string | null;
  twitter_post_id: string | null;
  twitter_post_url: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  edited_by: string | null;
  edited_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  generation_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GenerationResult {
  content: string;
  theme: TweetTheme;
  metadata: {
    model: string;
    fallbackUsed: boolean;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export const TWEET_MAX_CHARS = 280;
