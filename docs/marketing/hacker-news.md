# Hacker News Show HN Post

Post at news.ycombinator.com/submit. Choose "Show HN" as the type.

---

## Title

```
Show HN: OKrunit - Human approval gateway for automations and AI agents
```

## URL

```
https://okrunit.com?utm_source=hackernews&utm_medium=show_hn&utm_campaign=launch
```

## Text (optional, but recommended for Show HN)

```
I built OKrunit after watching a Zapier automation delete 10,000 active customer records at a previous company. A filter was misconfigured, there was no confirmation step, and the damage was done before anyone noticed.

OKrunit is a simple concept: before your automation does something irreversible, pause and ask a human. It works as a webhook middleware - your automation sends a POST to OKrunit, OKrunit notifies the right people (Slack, email, Discord, Teams, or Telegram), and waits for a human to approve or reject. The automation gets the result via webhook callback or polling.

Architecture:
- Next.js 16 on Vercel (App Router, server components)
- Supabase (Postgres + Realtime + Auth)
- Native integrations for Zapier, Make, and n8n (the n8n one is an open-source community node)
- Simple REST API for everything else

What it does:
- Multi-step approval chains (e.g., require 2 of 3 approvers, sequential)
- Routing rules (different approvers for different action types)
- SLA tracking with escalation
- Audit trail
- Notification routing per source

Free tier: 100 requests/month, 2 connections, no credit card.

I'm looking for feedback on the product and the landing page. What's unclear? What would make you trust this enough to put it in a production workflow?

https://okrunit.com
API docs: https://okrunit.com/docs/api
```

## How to engage with comments

HN values:
- Technical honesty. If someone finds a flaw, acknowledge it.
- Direct answers. Don't dodge hard questions.
- Self-awareness about limitations. "We don't handle X yet" is better than "that's on our roadmap."
- No marketing speak. No "we're revolutionizing" or "game-changing."

Common questions to prepare for:
- "Why not just use Zapier's built-in approval step?" -- Zapier's approval step only works within Zapier. OKrunit works across every platform from one dashboard.
- "What happens if OKrunit is down?" -- Requests return an error and the automation can handle it (retry, fail open, fail closed, depending on how they configure it).
- "Can I self-host this?" -- Not currently. It's SaaS-only. Honest answer about why (Supabase Realtime, Vercel edge, managed infra).
- "Why not open source?" -- Be honest. If it's because you need revenue, say so. HN respects that.
