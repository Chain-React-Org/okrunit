"use client";

import { useState, useEffect, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { BlogPost } from "@/lib/types/database";

const CATEGORIES = [
  "Announcements",
  "Guides",
  "Best Practices",
  "AI Safety",
  "Enterprise",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function estimateReadTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Announcements");
  const [published, setPublished] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/blog");
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      toast.error("Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function resetForm() {
    setTitle("");
    setSlug("");
    setDescription("");
    setContent("");
    setCategory("Announcements");
    setPublished(false);
    setSlugManual(false);
    setEditingPost(null);
    setPreviewing(false);
  }

  function openNew() {
    resetForm();
    setEditorOpen(true);
  }

  async function openEdit(post: BlogPost) {
    // Fetch full content
    try {
      const res = await fetch(`/api/v1/blog/${post.id}`);
      const data = await res.json();
      const full = data.post as BlogPost;
      setEditingPost(full);
      setTitle(full.title);
      setSlug(full.slug);
      setDescription(full.description);
      setContent(full.content);
      setCategory(full.category);
      setPublished(full.published);
      setSlugManual(true);
      setPreviewing(false);
      setEditorOpen(true);
    } catch {
      toast.error("Failed to load post");
    }
  }

  async function handleSave() {
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        content,
        category,
        published,
        read_time: estimateReadTime(content),
      };

      const isEdit = !!editingPost;
      const url = isEdit ? `/api/v1/blog/${editingPost.id}` : "/api/v1/blog";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to save post");
        return;
      }

      toast.success(isEdit ? "Post updated" : "Post created");
      setEditorOpen(false);
      resetForm();
      fetchPosts();
    } catch {
      toast.error("Failed to save post");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingPost) return;
    try {
      const res = await fetch(`/api/v1/blog/${deletingPost.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to delete post");
        return;
      }
      toast.success("Post deleted");
      setDeleteOpen(false);
      setDeletingPost(null);
      fetchPosts();
    } catch {
      toast.error("Failed to delete post");
    }
  }

  async function togglePublished(post: BlogPost) {
    try {
      const res = await fetch(`/api/v1/blog/${post.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !post.published }),
      });
      if (!res.ok) {
        toast.error("Failed to update post");
        return;
      }
      toast.success(post.published ? "Post unpublished" : "Post published");
      fetchPosts();
    } catch {
      toast.error("Failed to update post");
    }
  }

  const renderedHtml = previewing
    ? DOMPurify.sanitize(marked.parse(content, { async: false }) as string)
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Blog</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage blog posts. Write in Markdown.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="size-4" />
          New Post
        </Button>
      </div>

      {/* Post list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No blog posts yet. Click &quot;New Post&quot; to create your first
            one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{post.title}</p>
                  <Badge
                    variant={post.published ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {post.published ? "Published" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {post.category}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {post.description || "No description"}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  /blog/{post.slug}
                  {post.published_at &&
                    ` \u00b7 ${new Date(post.published_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {post.published && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    asChild
                    className="text-muted-foreground"
                  >
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => togglePublished(post)}
                  className="text-muted-foreground"
                  title={post.published ? "Unpublish" : "Publish"}
                >
                  {post.published ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(post)}
                  className="text-muted-foreground"
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setDeletingPost(post);
                    setDeleteOpen(true);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPost ? "Edit Post" : "New Blog Post"}
            </DialogTitle>
            <DialogDescription>
              Write your post in Markdown. Click Preview to see the rendered output.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugManual) {
                    setSlug(slugify(e.target.value));
                  }
                }}
                placeholder="Your blog post title"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManual(true);
                }}
                placeholder="your-blog-post-slug"
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL: /blog/{slug || "..."}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short summary for the blog index and SEO"
                className="mt-1"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-medium">Category</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewing(!previewing)}
                  className="gap-1.5"
                >
                  <Eye className="size-3.5" />
                  {previewing ? "Edit" : "Preview"}
                </Button>
              </div>
            </div>

            {/* Content editor / preview */}
            <div>
              <label className="text-sm font-medium">
                Content {previewing ? "(Preview)" : "(Markdown)"}
              </label>
              {previewing ? (
                <div
                  className="mt-1 min-h-[300px] rounded-md border bg-white p-4 text-sm leading-relaxed text-zinc-700 dark:bg-card [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-zinc-900 [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-900 [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_ol]:space-y-1 [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_code]:font-mono [&_pre]:rounded-lg [&_pre]:bg-zinc-50 [&_pre]:border [&_pre]:p-4 [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-zinc-500 [&_blockquote]:mb-3 [&_strong]:font-semibold [&_strong]:text-zinc-900 [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-zinc-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:bg-zinc-50 [&_td]:border [&_td]:border-zinc-200 [&_td]:px-3 [&_td]:py-2"
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={"# Your Blog Post\n\nWrite your content in Markdown...\n\n## Subheading\n\nParagraphs, **bold**, *italic*, `code`, [links](url), lists, and more."}
                  className="mt-1 min-h-[300px] w-full rounded-md border bg-white p-3 font-mono text-sm leading-relaxed text-foreground dark:bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              )}
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm mr-auto">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="rounded"
              />
              Publish immediately
            </label>
            <Button
              variant="outline"
              onClick={() => {
                setEditorOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Saving..."
                : editingPost
                  ? "Update Post"
                  : "Create Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingPost?.title}
              &quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
