# OKRunit Launch Readiness Checklist

Work through each section. Check items off as you complete them.

---

## Billing (Stripe)
*You're already testing this. Don't skip any of these flows.*

- [ ] Upgrade from Free to Pro
- [ ] Upgrade from Pro to Business
- [ ] Downgrade from Business to Pro
- [ ] Downgrade to Free (cancel subscription)
- [ ] Switch from monthly to annual billing
- [ ] Switch from annual to monthly billing
- [ ] Verify plan limits enforce correctly after upgrade (connections, team members, history retention)
- [ ] Verify plan limits enforce correctly after downgrade
- [ ] Test payment failure handling (use Stripe test card `4000 0000 0000 0341`)
- [ ] Verify Stripe webhook events process correctly (check Stripe dashboard > Webhooks > Recent events)
- [ ] Confirm invoice/receipt emails arrive from Stripe

---

## Messaging Channels (Re-test Round-Trip)
*For each channel: send an approval request, verify the notification arrives, click Approve/Reject, verify the decision is recorded in the dashboard.*

- [ ] **Slack**: notification arrives, approve button works, decision recorded
- [ ] **Slack**: reject button works with reason
- [ ] **Discord**: notification arrives, approve button works, decision recorded
- [ ] **Discord**: reject button works with reason modal
- [ ] **Telegram**: notification arrives, inline keyboard works, decision recorded
- [ ] **Email**: notification arrives, approve/reject links work, decision recorded
- [ ] ~~**Teams**: skip for now (need Microsoft 365 tenant)~~

---

## SSO/SAML
*Free to test with Okta Developer (developer.okta.com).*

- [ ] Sign up for free Okta Developer account
- [ ] Create a SAML 2.0 application in Okta pointing to your ACS URL
- [ ] Configure SSO in OKRunit dashboard (Business tier required, temporarily upgrade or test locally)
- [ ] Test SAML login flow end-to-end
- [ ] Verify user auto-provisioning works (new user created on first SAML login)
- [ ] Test logout / SLO (Single Logout)

---

## Core Approval Flow
*These should already work if Zapier/Make/n8n are working, but worth a quick sanity check.*

- [ ] Create approval via API (curl or playground)
- [ ] Verify webhook callback fires with correct HMAC signature
- [ ] Approve from dashboard: callback delivers "approved"
- [ ] Reject from dashboard: callback delivers "rejected" with reason
- [ ] Test approval expiry (set short TTL, let it expire)
- [ ] Test batch approve/reject

---

## Rules Engine
- [ ] Create a routing rule (e.g., "critical priority → specific team member")
- [ ] Send a request matching the rule, verify it routes correctly
- [ ] Verify non-matching requests use default routing
- [ ] Test auto-approve rule

---

## Email Templates
*Most are already working. Verify the ones you haven't explicitly tested.*

- [ ] Welcome email (new signup)
- [ ] Team invitation email (invite a new member)
- [ ] Approval request notification email
- [ ] Approval decided email (approve/reject notification)
- [ ] Escalation email (if applicable)

---

## WebAuthn / Passkeys
- [ ] Register a passkey from Settings
- [ ] Log out and log back in using the passkey
- [ ] Delete the passkey from Settings

---

## Other Integrations
*These use your REST API directly. If the API works (it does), these work. But if you want to be thorough:*

- [ ] GitHub Actions: test the action in a test repo workflow
- [ ] CLI: `npx okrunit-cli request "Test" --api-key YOUR_KEY`

*Lower priority (these are code libraries, they'll work if the API works):*

- [ ] Temporal: run a test workflow
- [ ] Dagster: run a test op
- [ ] Windmill: run a test script
- [ ] Pipedream: run a test component
- [ ] Prefect: run a test flow

---

## Final Pre-Launch
- [ ] Check all environment variables are set in Vercel (production)
- [ ] Verify custom domain DNS is configured
- [ ] Test signup flow end-to-end on production URL
- [ ] Test the landing page loads correctly on mobile
- [ ] Review Stripe is in **live mode** (not test mode) before launch
- [ ] Remove any test data from production database

---

*Estimated time: Most of this is ~2-3 hours of clicking through flows. SSO setup is the most involved (~30 min). Skip Teams and the lower-priority integrations unless you have time.*
