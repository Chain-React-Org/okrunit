# Social Media Posts

Ready to copy-paste. Adjust tone for your voice.

---

## Twitter/X Threads

### Launch thread

```
1/ I built OKrunit because I watched a Zapier automation delete 10,000 customer records.

A filter was misconfigured. There was no "are you sure?" step. The damage was done before anyone noticed.

Here's what I built to prevent that from ever happening again: 🧵

2/ OKrunit is a human approval gateway. It sits between your automation and the dangerous action.

Before your Zap, Make scenario, n8n workflow, or AI agent deletes records, sends emails, or deploys to prod, it pauses and asks a human.

3/ How it works:

Your automation → OKrunit API → Notify humans (Slack, email, Discord, Teams, Telegram) → Human approves/rejects → Automation continues or stops

One API call. That's it.

4/ It works with everything:
- Zapier (native integration)
- Make (native integration)
- n8n (community node, open source)
- GitHub Actions
- Any tool that can make an HTTP request

5/ Features that matter:
- Multi-step approvals (2 of 3 must approve)
- Sequential chains (CTO reviews after manager approves)
- Routing rules per action type
- SLA tracking (escalate if no response in 5 min)
- Full audit trail

6/ Free tier: 100 requests/month, 2 connections. No credit card.

If you're running automations that touch production data, customer records, or anything you can't undo, give it a try.

https://okrunit.com
```

### Pain point tweets (post 1-2 per week)

```
Your Zapier Zap is one misconfigured filter away from deleting your entire customer database.

Ask me how I know.

(I built okrunit.com to prevent this.)
```

```
Hot take: every AI agent should have a human approval step before it can:
- Delete data
- Send emails
- Modify infrastructure
- Touch billing

"But that slows things down!" Yes. That's the point.
```

```
The scariest automation is the one that works perfectly 99% of the time.

Because the 1% where it fails, nobody is watching.
```

```
If your automation can do it, your automation can do it wrong.

Built OKrunit so humans can catch the "wrong" before it happens.
```

```
Automation without oversight is just scheduled chaos with extra steps.
```

```
Every team that uses Zapier/Make/n8n needs this workflow:

1. Automation wants to do something destructive
2. Automation pauses and asks a human
3. Human approves or rejects
4. Automation continues or stops

That's it. That's the whole product. okrunit.com
```

```
I'm not anti-automation. I'm anti-automation-without-a-safety-net.

100 requests/month free: okrunit.com
```

---

## LinkedIn Posts

### Launch post

```
I'm launching OKrunit today.

It's a human approval gateway for automated workflows.

The backstory: At a previous role, I watched a Zapier automation delete 10,000 active customer records. A filter was misconfigured, there was no confirmation step, and the damage was done before anyone noticed.

OKrunit solves this with a simple pattern:

Before your automation does something irreversible, it pauses and asks a human to approve.

It works with Zapier, Make, n8n, GitHub Actions, AI agents, and anything that can make an HTTP request.

Features:
- Multi-step approval chains
- Notification routing (Slack, email, Discord, Teams, Telegram)
- SLA tracking with escalation
- Full audit trail
- Free tier (100 requests/month)

If your team runs automations that touch production data, customer records, or anything you can't undo, I'd love for you to try it.

https://okrunit.com

#automation #saas #zapier #workflow #aisafety
```

### AI safety angle

```
AI agents are getting really good at using tools.

They can browse the web, write code, query databases, send emails, and modify infrastructure.

But here's the question nobody is asking: who approves the dangerous actions?

When an AI agent wants to:
- Delete 10,000 user records
- Send a bulk email to your entire customer base
- Deploy code to production
- Modify billing settings

Should it just... do it?

I built OKrunit as a guardrail. When an AI agent (or any automation) wants to perform a high-risk action, it calls our API. We pause execution, notify the right humans, and wait for a decision.

The agent provides context. The human makes the call. The agent continues.

Human-in-the-loop isn't a bottleneck. It's a safety net.

https://okrunit.com

#aisafety #aiagents #automation #humanintheloop
```

### Operations angle

```
Every ops team I've talked to has the same story:

"We had an automation that was supposed to [do X]. Instead it [did Y]. We didn't notice for [Z hours/days]."

The common thread? No human verification step before the destructive action.

I built OKrunit to fix this. It's a simple pattern:

Automation → Pause → Notify human → Human approves/rejects → Continue

Works with Zapier, Make, n8n, and any REST API. Free tier available.

If your team has ever been burned by an automation gone wrong, I'd love to hear your story.

https://okrunit.com
```

### Feature spotlight posts (rotate weekly)

```
Quick tip for Zapier users:

You can add a human approval step to any Zap in about 2 minutes.

1. Add OKrunit as a step in your Zap
2. Map the action details to the request
3. When the Zap fires, it pauses and notifies your team
4. Someone approves or rejects from the dashboard
5. The Zap continues or stops

Free for up to 100 requests/month.

Setup guide: https://okrunit.com/docs/integrations
```

```
One thing I'm really proud of in OKrunit: the routing system.

You can set up rules like:
- Production deploys need CTO approval
- Bulk deletes need 2 of 3 approvers
- Low-priority requests auto-approve after 30 minutes
- Critical requests escalate to Slack #ops-critical

All configurable per connection, per action type. No code required.
```
