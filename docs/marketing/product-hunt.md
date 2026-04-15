# Product Hunt Launch Materials

Copy-paste these when you're ready to submit at producthunt.com/posts/new.

---

## Tagline (60 chars max)

```
Human approval gateway for automations and AI agents
```

## Description

```
OKrunit pauses your automation before it does something dangerous.

When your Zapier zap, Make scenario, n8n workflow, or AI agent is about to delete records, send bulk emails, deploy to production, or touch sensitive data, OKrunit stops execution and asks a human to approve or reject.

One API call. One dashboard. Works with any tool that can make an HTTP request.

How it works:
1. Your automation sends a request to OKrunit (native integrations for Zapier, Make, and n8n, or a simple POST to our API)
2. The right people get notified via Slack, email, Discord, Teams, or Telegram
3. A human reviews the details and approves or rejects
4. Your automation gets the decision and continues (or stops)

What makes OKrunit different:
- Works with every automation platform, not just one
- Multi-step approval chains (require 2 of 3 approvers, sequential review)
- Routing rules: different approvers for different action types
- Real-time dashboard with audit trail
- SLA tracking so requests don't sit forever
- Free tier with 100 requests/month, no credit card required

Built for teams that move fast but need guardrails. Start free at okrunit.com.
```

## Topics/Tags

```
Productivity, SaaS, Automation, Developer Tools, Artificial Intelligence
```

## Thumbnail

Use the hero screenshot from the landing page or record a 30-second GIF showing:
1. A request arriving in the dashboard
2. Clicking to open the detail panel
3. Clicking "Approve"
4. The status changing to approved

## Maker's First Comment

Post this as a comment immediately after launch:

```
Hey PH! I'm Nathaniel, the maker of OKrunit.

I built this because I watched an automation delete 10,000 customer records at a previous company. The Zapier zap was supposed to archive inactive accounts, but a filter was misconfigured and it nuked active ones instead. There was no "are you sure?" step.

That's the problem OKrunit solves. It's a simple concept: before your automation does something irreversible, pause and ask a human.

The tricky part was making it work with everything. Zapier, Make, n8n, GitHub Actions, custom scripts, AI agents... they all need to integrate differently. So I built native integrations for the big platforms and a dead-simple REST API for everything else.

The free tier gives you 100 requests/month, which is plenty for most small teams. No credit card required.

I'd love your feedback on what's working and what's not. Happy to answer any questions!
```

## Outreach template (send to people before launch day)

```
Subject: Launching OKrunit on Product Hunt tomorrow - would love your support

Hey [Name],

I'm launching OKrunit on Product Hunt [tomorrow/on DATE]. It's a human approval gateway for automations - it pauses Zapier, Make, n8n, and AI agent workflows before they do something dangerous, so a human can approve or reject.

Would you be willing to check it out and leave an upvote + comment if you think it's useful? Early engagement makes a huge difference.

Here's the link (goes live at midnight PT): [LINK]

Thanks!
Nathaniel
```
