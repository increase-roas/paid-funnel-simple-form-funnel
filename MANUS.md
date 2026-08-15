# Manus — read this first

**Repo:** `paid-funnel-advertorial`  
**Baseline engine (do not fork logic from scratch):** https://github.com/increase-roas/paid-funnel-template  
**Product:** Astro 7 paid funnel on Cloudflare Workers. Config-driven. Not a website.

---

## Your job for a quick client funnel

Configure an **existing** funnel. Do **not** build a new app.

1. Edit client data in **`funnel.config.ts`** and/or **`src/lib/funnelDefaults.ts`**
2. Run checks: `npm run gate && npm test && npm run check`
3. Preview locally: `npm run dev` → open `/lp/{slug}/step/1`
4. Hand off config + screenshot URL. Operator deploys with Wrangler later.

---

## Hard stops (violations = fail the task)

| Do NOT | Why |
|--------|-----|
| Rebuild as React, Next, Vue, or a SPA | Not the product. Fake preview. |
| Port components to Manus demo host | Missing KV, D1, Queues, Meta/GHL contracts |
| Create a new repo or duplicate the engine | Use this repo only |
| Change `src/pages/api/*`, tracking, session, D1 schema for a “quick client” | Config-only unless owner asks |
| Deploy to production Cloudflare without owner approval | Operator-only |
| Use client **`sun-pool-spa`** or protected names without break-glass | Blocked |
| Replace Astro with static HTML export | Breaks Worker + progressive capture |

---

## The right preview (only this)

```bash
cd paid-funnel-advertorial   # or full path on operator machine
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/lp/{funnel.slug}/step/1
```

If you **cannot** run terminal on the operator machine, say **BLOCKED: no terminal** and deliver:

- The exact `funnel.config.ts` diff
- Shape chosen (A / B / C)
- The local URL they should open after `npm run dev`

Do **not** substitute a React rebuild because terminal is blocked.

---

## Pick a shape (client brief)

| Shape | Flow | Steps | When |
|-------|------|-------|------|
| **A** | ZIP → contact → thank-you | 2 | Fastest lead. No survey. |
| **B** | ZIP → survey → interstitial → contact → thank-you | 7 (with 4 questions) | Default. Qualified lead. |
| **C** | B + book (GHL calendar iframe) → thank-you | 8 | Needs `calendarUrl` |

**Quick client:** usually **A** or **B**.

In `funnel.config.ts`:

```ts
export default defineFunnelConfig(buildFunnelInput("A")); // or "B" or "C"
```

For **A**: `surveyQuestions` must be `[]` in the built config.  
For **C**: add `calendarUrl` (real GHL booking widget URL).

Preview multiple shapes locally:

```bash
FUNNEL_SHAPE=A npm run dev -- --port 3001
FUNNEL_SHAPE=B npm run dev -- --port 3002
FUNNEL_SHAPE=C npm run dev -- --port 3003
```

---

## What to edit per client (config only)

Edit **`src/lib/funnelDefaults.ts`** (`buildFunnelInput`) or override in **`funnel.config.ts`**.

| Field | Example |
|-------|---------|
| `client.name` | "Acme Hot Tubs" |
| `client.phone` | E.164 `+17015550142` |
| `funnel.slug` | `acme-hot-tub-offer` → URL `/lp/acme-hot-tub-offer/step/1` |
| `offer.headline` / `subheadline` | Ad match copy |
| `geoH1Template` | Must include `{city}` and `{state}` |
| `serviceAreaZipCodes` | Client ZIP list |
| `surveyQuestions` | B/C only. Unique `id` per question. |
| `meta.pixelId` | Client pixel (placeholder OK for preview) |
| `ghlWebhookUrl` | GHL inbound webhook (`.invalid` OK for local) |
| `calendarUrl` | Required for shape C |

After edits:

```bash
npm run gate && npm test && npm run check
```

Gate must pass before you call the task done.

---

## Advertorial hero (this repo only)

This fork is for **HomeBuddy-style step-1 hero** (blue hero, mascot, bullets, before/after).

- Hero work belongs **only on the ZIP step** (`step.kind === "zip"`).
- Do **not** slow survey steps with heavy images or new JS.
- Hero assets: WebP, fixed dimensions, one mascot + one proof image max.
- If hero components do not exist yet, **only add config fields** and stop — do not invent a parallel UI in React.

---

## Deploy (operator only — not Manus unless explicitly approved)

```bash
npm run deploy
```

Requires: Wrangler login, KV/D1/queues created, production secrets.  
**Proof of live:** funnel loads on workers.dev and test lead reaches GHL.

Manus default deliverable: **config + local preview proof**, not production deploy.

---

## Done checklist

- [ ] Shape A, B, or C set intentionally
- [ ] Client name, slug, offer, ZIPs, survey (if B/C) updated
- [ ] `npm run gate && npm test && npm run check` pass
- [ ] Preview URL documented: `/lp/{slug}/step/1`
- [ ] No React port, no Manus-only demo app
- [ ] No secrets printed in chat

---

## If stuck

Reply exactly:

```text
BLOCKED: [reason]
Need: [config value or owner decision]
Suggested local command: npm run dev
```

Do not improvise a different stack.
