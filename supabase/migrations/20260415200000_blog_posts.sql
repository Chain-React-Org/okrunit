-- Blog posts table for the public marketing blog.
-- Only app admins can create/edit/delete via the admin panel.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null default '',
  content text not null default '',
  category text not null default 'Announcements',
  published boolean not null default false,
  published_at timestamptz,
  read_time text not null default '3 min read',
  author_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast slug lookup (public pages)
create index if not exists idx_blog_posts_slug on public.blog_posts(slug) where published = true;

-- Index for listing published posts ordered by date
create index if not exists idx_blog_posts_published on public.blog_posts(published, published_at desc);

-- RLS
alter table public.blog_posts enable row level security;

-- Anyone can read published posts
create policy "Public can read published blog posts"
  on public.blog_posts for select
  using (published = true);

-- App admins can do everything
create policy "App admins manage blog posts"
  on public.blog_posts for all
  using (
    exists (
      select 1 from user_profiles
      where user_profiles.id = auth.uid()
      and user_profiles.is_app_admin = true
    )
  );
