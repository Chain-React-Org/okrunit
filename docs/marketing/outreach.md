# Cold Outreach Templates

## Email to Automation Agencies/Freelancers

Find these on: Zapier Expert directory, Make Partner directory, Upwork ("Zapier expert", "automation consultant"), Fiverr, LinkedIn.

**Subject line options** (test different ones):
- "Quick question about your automation workflows"
- "Do your clients ever worry about automation mistakes?"
- "Human approval step for your client automations"

**Email**:
```
Hi [Name],

I saw your work on [Zapier Expert directory / Upwork / their website] and noticed you build automations for [industry/type].

Quick question: do your clients ever worry about automations doing something destructive without a human check? Things like accidental bulk deletes, emails going to the wrong list, or a deploy that breaks production?

I built OKrunit to solve this. It's a simple API that adds a human approval step to any automation. Your client's team gets notified (Slack, email, etc.), reviews the action, and approves or rejects before it runs.

It works with Zapier, Make, n8n, and anything with HTTP/webhooks. Takes about 2 minutes to add to an existing workflow.

Would you be open to trying it on a client project? I'm happy to give you an extended free trial and help with setup.

Best,
Nathaniel
okrunit.com
```

---

## Email to DevOps/Platform Teams

Find these on: LinkedIn (search "DevOps lead" or "Platform engineer" at companies that use automation heavily).

**Subject**: "Human approval for your CI/CD and automation pipelines"

**Email**:
```
Hi [Name],

I'm reaching out because [Company] likely runs automated pipelines that touch production infrastructure. I'm curious whether you have a formal approval step before destructive actions (deploys, database migrations, credential rotations, etc.).

I built OKrunit as a lightweight approval gateway. It's a single API call that pauses execution and routes the request to the right person via Slack, email, or your preferred channel. They approve or reject, and the pipeline continues.

It's not a full change management system - more like a programmable "are you sure?" that integrates with whatever you're already using.

Free tier available, no vendor lock-in. Would it be worth a 10-minute demo?

Best,
Nathaniel
https://okrunit.com
```

---

## LinkedIn Connection Request Messages

**To automation consultants**:
```
Hi [Name], I noticed you build [Zapier/Make/n8n] automations for clients. I built a tool that adds human approval to automated workflows before they run destructive actions. Would love to connect and share it with you.
```

**To DevOps/Platform engineers**:
```
Hi [Name], I built OKrunit, a human approval gateway for automations and CI/CD pipelines. Curious if you've ever dealt with an automation doing something destructive without a human check. Would love to connect.
```

---

## Partnership Pitch (to automation platforms, SaaS tools)

**Subject**: "Integration partnership: human approval step for [Platform] users"

**Email**:
```
Hi [Name],

I'm the founder of OKrunit (okrunit.com), a human-in-the-loop approval gateway for automated workflows.

We already have [users/integrations] using OKrunit with [Platform], and I think there's a natural partnership opportunity. Many of your users need a way to add a human verification step before their automations perform sensitive actions.

What we bring:
- A working integration with [Platform]
- A use case that reduces automation errors (good for [Platform]'s reputation)
- Content we can co-create (blog post, integration guide, webinar)

Would you be open to a conversation about listing OKrunit in your [marketplace/integration directory] or co-marketing?

Best,
Nathaniel
Founder, OKrunit
```

---

## Indie Hackers Post

Post at: indiehackers.com

**Title**: "I built a SaaS that adds 'are you sure?' to automations"

**Body**:
```
Hey IH! I'm building OKrunit, a human approval gateway for automated workflows.

The pitch: when your Zapier zap, Make scenario, or AI agent is about to do something destructive, OKrunit pauses it and asks a human to approve first.

I got the idea after watching an automation delete 10,000 customer records at a previous job. A misconfigured filter, no confirmation step, instant damage.

Stack: Next.js 16, Supabase, Vercel, Stripe
Business model: Freemium (free: 100 requests/month, paid: $20-60/month)
Status: Live at okrunit.com

Would love feedback from the community:
1. Does this solve a real problem for you?
2. Is the pricing reasonable?
3. What would make you switch from whatever you're doing now?

Happy to share revenue numbers, tech decisions, and mistakes along the way.
```
