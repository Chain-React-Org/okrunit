# Reddit Posts

Space these 2-3 days apart. Don't post to multiple subreddits on the same day.

---

## r/zapier

**Title:**
```
I built a tool that adds human approval to any Zap before it runs a destructive action
```

**Body:**
```
I kept seeing posts in this sub from people who had automations go wrong - accidentally deleting records, sending emails to the wrong list, etc.

So I built OKrunit. It's a Zapier integration that pauses your Zap and waits for a human to approve before continuing. You add it as a step in your Zap, and when it fires, the right people get notified (Slack, email, etc.) and can approve or reject from a dashboard.

Use cases I've seen so far:
- Bulk delete/archive actions that need a sanity check
- Sending emails to large lists
- CRM updates that could break downstream automations
- Anything touching production data

It has a free tier (100 requests/month) if you want to try it: https://okrunit.com?utm_source=reddit&utm_medium=post&utm_campaign=r_zapier

Happy to answer questions. Would love feedback on what would make this more useful for your workflows.
```

---

## r/n8n

**Title:**
```
I made an n8n community node that adds human approval to workflows
```

**Body:**
```
Hey everyone, I built a community node called n8n-nodes-okrunit that adds a human-in-the-loop approval step to any n8n workflow.

How it works: You add the OKrunit node to your workflow. When it executes, it creates an approval request and pauses. A human reviews and approves/rejects from the OKrunit dashboard (or via Slack/email notification). The workflow continues with the decision.

It supports:
- Multiple approvers (require N of M to approve)
- Sequential approval chains
- Priority levels
- Custom metadata so the approver has full context
- Webhook callbacks when a decision is made

Install: npm install n8n-nodes-okrunit (or search "okrunit" in the community nodes UI)

Free tier: 100 requests/month. The node is open source.

Docs: https://okrunit.com/docs/integrations?utm_source=reddit&utm_medium=post&utm_campaign=r_n8n

Would love feedback from the n8n community. What features would make this more useful for your workflows?
```

---

## r/automation

**Title:**
```
How do you handle "are you sure?" moments in your automations?
```

**Body:**
```
Genuine question first: how do you all handle the situation where an automation is about to do something destructive and you want a human to verify before it runs?

I built a tool for this (OKrunit) after a bad experience where a misconfigured Zapier filter caused a bulk delete of active customer records. No confirmation step, no undo.

The approach I took:
1. Automation hits the OKrunit API before the dangerous step
2. OKrunit notifies the right people (Slack, email, Discord, Teams, Telegram)
3. Human reviews the context and approves or rejects
4. Automation gets the decision and continues or stops

It works with Zapier, Make, n8n, GitHub Actions, and anything that can make an HTTP request.

Curious how others solve this. Do you just trust your automations? Add manual checks? Use platform-specific approval features?

https://okrunit.com?utm_source=reddit&utm_medium=post&utm_campaign=r_automation
```

---

## r/SaaS or r/indiehackers

**Title:**
```
I built and launched OKrunit - a human approval gateway for automations. Here's what I learned.
```

**Body:**
```
OKrunit adds a human approval step to automated workflows. When your Zapier zap, Make scenario, n8n workflow, or AI agent is about to do something sensitive, it pauses and asks a human to approve.

Some numbers since launch:
- [X] signups in [Y] days
- [X]% conversion from landing page
- [X] approval requests processed
- Built with Next.js, Supabase, Vercel
- Revenue: $[X] MRR (or "pre-revenue, free tier only so far")

What worked:
- Targeting a specific pain point (automation mistakes) rather than a broad category
- Native integrations for Zapier/Make/n8n so it's not just an API
- Free tier generous enough to be useful (100 requests/month)

What didn't work:
- [Be honest about what flopped - people love authenticity]

Tech stack: Next.js 16, Supabase (Postgres + Realtime + Auth), Vercel, Stripe for billing, Resend for emails.

Happy to answer questions about the product, tech, or business side.

https://okrunit.com?utm_source=reddit&utm_medium=post&utm_campaign=r_saas
```

---

## r/artificial

**Title:**
```
Built a guardrail tool for AI agents - pauses execution and asks a human before destructive actions
```

**Body:**
```
With AI agents getting more autonomous (tool use, function calling, multi-step reasoning), I think we're going to see more cases where an agent does something its operator didn't intend.

I built OKrunit as a simple guardrail: when your AI agent is about to perform a high-risk action (delete data, send communications, modify infrastructure), it calls OKrunit's API, which pauses execution and routes the request to a human for approval.

The agent's tool call includes the full context (what it wants to do and why), so the human reviewer can make an informed decision. Once approved or rejected, the agent gets the result and continues.

Works with any agent framework that supports tool/function calling - just add an HTTP tool that hits our API.

Free tier, no credit card: https://okrunit.com?utm_source=reddit&utm_medium=post&utm_campaign=r_artificial

Curious what the community thinks about human-in-the-loop patterns for AI agents. Is this the right approach, or do you see better alternatives?
```
