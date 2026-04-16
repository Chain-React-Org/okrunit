import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Calendar } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BlogPost } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Blog - OKrunit",
  description:
    "Insights on human-in-the-loop approvals, automation safety, and workflow best practices.",
  alternates: { canonical: "https://okrunit.com/blog" },
};

const CATEGORY_COLORS: Record<string, string> = {
  "AI Safety": "bg-red-50 text-red-700",
  Guides: "bg-blue-50 text-blue-700",
  "Best Practices": "bg-emerald-50 text-emerald-700",
  Enterprise: "bg-violet-50 text-violet-700",
  Announcements: "bg-amber-50 text-amber-700",
};

export default function BlogPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Blog
        </h1>
        <p className="mt-2 text-lg text-zinc-600">
          Insights on human-in-the-loop approvals, automation safety, and
          workflow best practices.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-100" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-100" />
                <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        }
      >
        <BlogPostList />
      </Suspense>
    </div>
  );
}

async function BlogPostList() {
  await connection();
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from("blog_posts")
    .select(
      "id, slug, title, description, category, published_at, read_time",
    )
    .eq("published", true)
    .order("published_at", { ascending: false })
    .returns<BlogPost[]>();

  if (!posts || posts.length === 0) {
    return <p className="text-zinc-500">No posts yet. Check back soon.</p>;
  }

  return (
    <div className="space-y-10">
      {posts.map((post) => (
        <article key={post.id} className="group">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] ?? "bg-zinc-100 text-zinc-600"}`}
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
            <span className="text-xs text-zinc-400">
              {post.read_time}
            </span>
          </div>
          <Link href={`/blog/${post.slug}`}>
            <h2 className="text-xl font-semibold text-zinc-900 transition-colors group-hover:text-primary">
              {post.title}
            </h2>
          </Link>
          <p className="mt-2 leading-relaxed text-zinc-600">
            {post.description}
          </p>
          <Link
            href={`/blog/${post.slug}`}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Read more <ArrowRight className="size-3" />
          </Link>
        </article>
      ))}
    </div>
  );
}
