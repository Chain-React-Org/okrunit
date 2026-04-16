import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BlogPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <Link
        href="/blog"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to blog
      </Link>
      <article>{children}</article>
    </div>
  );
}
