import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Calendar, Clock } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogPost } from "@/lib/types/database";

interface Props {
  params: Promise<{ slug: string }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  "AI Safety": "bg-red-50 text-red-700",
  Guides: "bg-blue-50 text-blue-700",
  "Best Practices": "bg-emerald-50 text-emerald-700",
  Enterprise: "bg-violet-50 text-violet-700",
  Announcements: "bg-amber-50 text-amber-700",
};

async function getPost(slug: string): Promise<BlogPost | null> {
  await connection();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single<BlogPost>();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const post = await getPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} - OKrunit Blog`,
    description: post.description,
    alternates: { canonical: `https://okrunit.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      url: `https://okrunit.com/blog/${post.slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

export default function BlogPostPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-100" />
          <div className="mt-8 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      }
    >
      <BlogPostContent params={params} />
    </Suspense>
  );
}

async function BlogPostContent({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = DOMPurify.sanitize(
    marked.parse(post.content, { async: false }) as string,
  );

  return (
    <div>
      {/* Post header */}
      <div className="mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] ?? "bg-zinc-100 text-zinc-600"}`}
          >
            {post.category}
          </span>
          {post.published_at && (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Calendar className="size-3" />
              {new Date(post.published_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-zinc-400">
            <Clock className="size-3" />
            {post.read_time}
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600">
          {post.description}
        </p>
      </div>

      {/* Rendered markdown content */}
      <div
        className="text-zinc-700 leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-900 [&_h1]:mt-8 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-1.5 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_pre]:rounded-lg [&_pre]:bg-zinc-50 [&_pre]:border [&_pre]:border-zinc-200 [&_pre]:p-4 [&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:text-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-500 [&_blockquote]:mb-4 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4 [&_th]:border [&_th]:border-zinc-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-zinc-50 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2 [&_hr]:my-8 [&_hr]:border-zinc-200"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
