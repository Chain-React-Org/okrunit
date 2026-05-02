import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TweetEditor } from "@/components/admin/tweets/tweet-editor";
import type { TweetDraft } from "@/lib/tweets/types";

export const metadata = {
  title: "Edit Tweet - Admin - OKrunit",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTweetEditPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tweet_drafts")
    .select("*")
    .eq("id", id)
    .single<TweetDraft>();
  if (error || !data) notFound();

  return <TweetEditor initialDraft={data} />;
}
