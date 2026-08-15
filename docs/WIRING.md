# Wiring checklist — paid-funnel-simple-form-funnel

Use this before go-live. Check every row. **This repo is the Astro paid funnel** (ZIP → contact → thank-you inventory). It is **not** the Lead Vault sheet stack — rows marked **N/A here** belong to other deployables or GHL-side setup.

Legend: **CF secret** = `npx wrangler secret put …` · **config** = `funnel.config.ts` · **GHL** = configure in GoHighLevel workflow/custom values

---

## Go-live gate (run locally first)

- [ ] `npm run gate` passes
- [ ] `npm test` passes
- [ ] `npm run check` passes
- [ ] Smoke: `/lp/{slug}/step/1` → ZIP → contact → thank-you shows 5 inventory slots
- [ ] Production: `ENVIRONMENT = "production"` in `wrangler.toml`
- [ ] Production: **no** `META_TEST_EVENT_CODE` set (gate blocks if present)

---

## CRM — lead delivery

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **CF secret** `GHL_WEBHOOK_URL` **or** **config** `ghlWebhookUrl` | Inbound webhook — GHL workflow creates/updates contact from funnel JSON | No GHL contact; lead still saved in D1; visitor sees contact-step error; optional alert fires |
| [ ] | **GHL** workflow maps webhook fields → contact + tags | Contact upsert inside GHL (this repo does **not** call GHL REST API) | Contact empty or wrong fields |
| [ ] | **GHL** workflow on webhook failure → alert you | Ops visibility | Failed delivery only in Worker logs |

### Not wired in this repo (Lead Vault / direct API pattern)

| User name | Status here |
|-----------|-------------|
| `GHL_API_KEY` | **N/A** — no direct GHL API upsert in this funnel |
| `GHL_LOCATION_ID` | **N/A** — location is implicit in the inbound webhook URL |

---

## Meta — pixel + CAPI

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **config** `meta.pixelId` | Browser pixel + CAPI pixel id | No ad signal; server CAPI cannot send |
| [ ] | **CF secret** `META_CAPI_ACCESS_TOKEN` | Server-side conversion auth | Browser may fire; CAPI rows stay `skipped`; no server dedupe |
| [ ] | **CF var** `META_GRAPH_API_VERSION` | Graph API version (`wrangler.toml`, default `v26.0`) | Wrong API version on CAPI posts |
| [ ] | **CF secret** `META_TEST_EVENT_CODE` | **Dev/smoke only** — Events Manager test mode | If **left set in production**, conversions stay test events forever — **delete after smoke test** |
| [ ] | **config** `meta.conversionEventName` | Lead event name (default `Lead`) | Wrong event in Ads Manager |
| [ ] | **config** `meta.defaultConversionValue` | Initial lead value on thank-you | Meta learns wrong economics for this client |
| [ ] | **config** `meta.currency` | Currency on lead + lifecycle events | Wrong currency in reporting |

### Value ladder (appointment → show → sale)

This repo does **not** use env vars `META_VALUE_QUALIFIED` / `_SCHEDULE` / `_SHOWED`. Lifecycle values come from the **CRM callback** payload:

| Stage | Meta event (server) | Value source |
|-------|---------------------|--------------|
| Lead | `meta.conversionEventName` | `meta.defaultConversionValue` (+ survey `intentValues` on B/C shapes) |
| Appointment | `Schedule` | `POST /api/funnel/{slug}/conversion` body `value` |
| Show | `AppointmentShowed` | same |
| Sale | `Purchase` | same |

- [ ] GHL (or Make) sends realistic `value` per stage in callback JSON — not generic 75/300/600 from another client

---

## CRM → site lifecycle callback (value ladder)

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **CF secret** `CRM_CALLBACK_SECRET` | Bearer auth for `POST /api/funnel/{slug}/conversion` | **503** on every stage event — whole value ladder dropped (loud in logs) |
| [ ] | **GHL** custom value / workflow `site_base_url` | Base URL for callback, e.g. `https://funnel.client.com` | Blank/stale URL → every stage post goes nowhere |
| [ ] | **GHL** workflow posts to `{site_base_url}/api/funnel/{slug}/conversion` | Schedule / show / sale upstream | No downstream Meta lifecycle events |
| [ ] | Callback body includes stable `idempotencyKey` | Dedupes retries | Duplicate Meta events |

Example:

```http
POST /api/funnel/hot-tub-offer/conversion
Authorization: Bearer <CRM_CALLBACK_SECRET>
Content-Type: application/json

{
  "leadId": "<uuid from webhook payload>",
  "idempotencyKey": "ghl-appointment-<contact-id>",
  "stage": "appointment",
  "value": 250,
  "currency": "USD"
}
```

Allowed `stage`: `appointment` | `show` | `sale`.

---

## Alerts

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **CF secret** `SUBMISSION_ALERT_WEBHOOK_URL` | Slack-compatible webhook on GHL delivery failure | Failures only in console — nobody pinged; site otherwise OK |

### Not wired in this repo

| User name | Status here |
|-----------|-------------|
| `ALERT_WEBHOOK_URL` | Use **`SUBMISSION_ALERT_WEBHOOK_URL`** (same role, different name) |

---

## Google Sheets vault

| User name | Status here |
|-----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | **N/A** — no Sheet rows in this repo |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | **N/A** |
| `GOOGLE_SHEETS_ID` | **N/A** |

Leads live in **Cloudflare D1** (`leads`, `tracking_events`). Export via dashboard or separate Lead Vault if needed.

---

## GA4 (optional)

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **config** `ga4MeasurementId` | GA4 loader (`G-…`) | No GA4 — OK if Meta-only |
| [ ] | **config** `googleEnhancedConversions: true` | Enhanced conversion payload on thank-you | Requires valid `ga4MeasurementId`; off by default |

---

## Admin inventory panel

| User name | Status here |
|-----------|-------------|
| `ADMIN_PASSWORD` | **N/A** — no `/admin` in this repo |
| `ADMIN_SESSION_SECRET` | **N/A** |

Inventory is **config-only**: five slots in `funnel.config.ts` → `inventory.products`.

---

## Domain / canonical URL

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **Cloudflare** custom domain on Worker/Pages | Public funnel URL | Wrong host on live links |
| [ ] | First-touch `first_url` stored at lead creation | CAPI `event_source_url` | Wrong if users hit wrong domain before ads |
| [ ] | **GHL** `site_base_url` matches deployed domain | CRM callbacks hit this Worker | 404/503 on lifecycle events |

### Not a dedicated env in this repo

| User name | Equivalent |
|-----------|------------|
| `siteUrl` config file | Deploy domain + request URL at capture time — set GHL `site_base_url` to match |

---

## Cloudflare platform bindings

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **wrangler.toml** `FUNNEL_SESSIONS` KV id (not all-zeros in prod) | Session + attribution | Sessions fail |
| [ ] | **wrangler.toml** `FUNNEL_DB` D1 id | Leads + event ledger | No persistence |
| [ ] | **wrangler.toml** `CAPI_RETRY_QUEUE` + DLQ | CAPI retry | Failed CAPI not retried |
| [ ] | `npx wrangler d1 migrations apply paid-funnel-events --remote` | Schema on prod D1 | 500 on lead save |

---

## Funnel config (`funnel.config.ts`)

| Check | Field | Purpose |
|-------|--------|---------|
| [ ] | `client.phone` | E.164 — trust / tel CTAs |
| [ ] | `funnel.slug` | URL path `/lp/{slug}/…` |
| [ ] | `inventory.products` (×5) | Thank-you inventory cards; `active: false` hides slot |
| [ ] | `inventory.pageUrl` | Optional “full inventory page” link below grid |
| [ ] | `serviceAreaZipCodes` | ZIP gate (or `ALLOW_ANY_ZIP` in dev) |
| [ ] | `contact.consent` | Legal snapshot stored with lead |

---

## Production secrets — copy/paste

```bash
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put GHL_WEBHOOK_URL
npx wrangler secret put CRM_CALLBACK_SECRET
npx wrangler secret put SUBMISSION_ALERT_WEBHOOK_URL   # optional
```

Local: copy `.dev.vars.example` → `.dev.vars`.

---

## Deploy

```bash
npm run deploy
```

Post-deploy:

- [ ] Thank-you loads after test lead
- [ ] GHL contact created
- [ ] Meta Events Manager shows Lead (then remove test code)
- [ ] Callback smoke: appointment stage returns 202
