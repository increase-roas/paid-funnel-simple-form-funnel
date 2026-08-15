# Manus — read this first

**Repo:** `paid-funnel-simple-form-funnel`  
**Contract:** `README.md` (version 1) + `launchpad.template.json`  
**Product:** Astro 7 paid funnel on Cloudflare Workers. **Shape A only.**

```text
ZIP → Contact → Thank You → 5 inventory slots
```

This is **one reusable template**, not a per-customer repo and not a multi-shape app.

---

## Your job for a quick client funnel

Configure this template. Do **not** build a new app. Do **not** add Shape B or C here.

1. Edit client data in **`funnel.config.ts`** and/or **`src/lib/funnelDefaults.ts`**
2. Keep `funnel.shape` = `"A"`
3. Keep **exactly 5** inventory product slots
4. Run: `npm run gate && npm test && npm run check`
5. Preview: `npm run dev` → `/lp/{slug}/step/1`
6. Hand off config + screenshot. Operator deploys with Wrangler later.

Client-specific values belong in Site Launchpad later. Do not fork this repo per customer.

---

## Hard stops (violations = fail the task)

| Do NOT | Why |
|--------|-----|
| Rebuild as React, Next, Vue, or a SPA | Not the product. Fake preview. |
| Port components to Manus demo host | Missing KV, D1, Queues, Meta/GHL contracts |
| Create a new repo per customer | One template, many configs |
| Switch this repo to Shape B or C | Other templates. This contract is Shape A |
| Rename secrets, bindings, or config keys | Launchpad contract. See README |
| Deploy to production Cloudflare without owner approval | Operator-only |
| Use client **`sun-pool-spa`** without break-glass | Blocked |
| Put secrets in git, README, logs, or chat | Contract |

---

## The right preview (only this)

```bash
cd /Users/alexlobaito/paid-funnel-simple-form-funnel
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/lp/{funnel.slug}/step/1
```

If you **cannot** run terminal on the operator machine, say **BLOCKED: no terminal** and deliver the `funnel.config.ts` diff plus the local URL.

Do **not** substitute a React rebuild because terminal is blocked.

---

## Canonical runtime names (do not rename)

Secrets: `META_CAPI_ACCESS_TOKEN`, `META_TEST_EVENT_CODE` (test only), `GHL_WEBHOOK_URL`, `CRM_CALLBACK_SECRET`, `SUBMISSION_ALERT_WEBHOOK_URL`

Bindings: `ASSETS`, `FUNNEL_SESSIONS`, `FUNNEL_DB`, `CAPI_RETRY_QUEUE`

Lead create is inbound webhook only. Do not add `GHL_API_KEY` / `GHL_LOCATION_ID` here.

---

## Done checklist

- [ ] Shape A (ZIP → contact → thank-you inventory)
- [ ] Client name, slug, offer, ZIPs, 5 inventory slots
- [ ] `npm run gate && npm test && npm run check` pass
- [ ] Preview URL documented
- [ ] No React port
- [ ] No secrets printed
- [ ] `launchpad.template.json` untouched unless this is an explicit contract-version change

---

## If stuck

```text
BLOCKED: [reason]
Need: [config value or owner decision]
Suggested local command: npm run dev
```
