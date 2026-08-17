# Wiring checklist — paid-funnel-simple-form-funnel

Use this before go-live. Check every row. **This repo is the Astro paid funnel** (ZIP → contact → thank-you inventory) with the same D1-first GHL and lead-vault boundaries as the dealer-site reference.

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
| [ ] | **CF secret** `GHL_API_KEY` | Direct contact upsert without exposing the credential to browser or Git | Lead remains in D1; a `Missed Leads` row and optional alert record the delivery failure |
| [ ] | **CF secret** `GHL_LOCATION_ID` | Selects the client GHL location | GHL upsert is not attempted |
| [ ] | **CF secrets** `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | UUID-upserted `All Leads` vault plus `Missed Leads` delivery failures | D1 remains authoritative, but the sheet mirror is marked unconfigured |
| [ ] | **CF secret** `STAGE_WEBHOOK_SECRET` | Authenticates `/api/phone-lead` and `/api/lead-stage` | Both compatibility endpoints return 503 |

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

### Offline conversion stage mapping

This repo does **not** use env vars `META_VALUE_QUALIFIED` / `_SCHEDULE` / `_SHOWED`.

| GHL pipeline stage | Callback `stage` | Meta event (server) | Value rule |
|--------------------|------------------|---------------------|------------|
| Hot Pursuit | `qualified` | `QualifiedLead` | Explicit finite nonnegative callback value, otherwise `75` |
| Appointment Set | `appointment` | `Schedule` | Explicit finite nonnegative callback value, otherwise `300` |
| Showed | `show` | `Showed` | Explicit finite nonnegative callback value, otherwise `600` |
| Sold | `sale` | `Purchase` | Explicit positive callback value required |

The initial website Lead still uses `meta.conversionEventName` and
`meta.defaultConversionValue` (+ survey `intentValues` on B/C shapes).
`Purchase` has no default and no universal sale value.

---

## CRM → site lifecycle callback (value ladder)

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **CF secret** `CRM_CALLBACK_SECRET` | Bearer auth for `POST /api/funnel/{slug}/conversion` | **503** on every stage event — whole value ladder dropped (loud in logs) |
| [ ] | **GHL** custom value / workflow `site_base_url` | Base URL for callback, e.g. `https://funnel.client.com` | Blank/stale URL → every stage post goes nowhere |
| [ ] | **GHL** workflow posts to `{site_base_url}/api/funnel/{slug}/conversion` | Qualified / appointment / show / sale upstream | No downstream Meta lifecycle events |
| [ ] | Callback body includes the stable webhook `leadUuid` | Joins the original D1 lead and stored attribution | Callback cannot match the lead |
| [ ] | Callback body includes stable `idempotencyKey` | Stores as `downstream_conversions.external_id`; duplicate responses reuse `downstream_conversions.event_id` | Duplicate Meta events |

Example:

```http
POST /api/funnel/hot-tub-offer/conversion
Authorization: Bearer <CRM_CALLBACK_SECRET>
Content-Type: application/json

{
  "leadUuid": "<uuid from webhook payload>",
  "idempotencyKey": "ghl-appointment-<contact-id>",
  "stage": "appointment",
  "currency": "USD"
}
```

Allowed `stage`: `qualified` | `appointment` | `show` | `sale`.

For `qualified`, `appointment`, and `show`, an explicitly supplied finite
nonnegative `value` is preserved; when omitted, the defaults are `75`, `300`,
and `600`. `sale` requires an explicit value greater than zero. The callback
reuses the original lead's `first_url`, `original_query_string`, `fbc`, `fbp`,
IP address, and user agent.

Full contract: [`OFFLINE_CONVERSION_CONTRACT.md`](OFFLINE_CONVERSION_CONTRACT.md).

---

## Alerts

| Check | Where | Purpose | If missing / wrong |
|-------|--------|---------|-------------------|
| [ ] | **CF secret** `ALERT_WEBHOOK_URL` | Slack-compatible webhook on GHL delivery failure | Failures only in console — nobody pinged; site otherwise OK |

---

## Google Sheets vault

| User name | Status here |
|-----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Required for signed Sheets API access |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Required for signed Sheets API access |
| `GOOGLE_SHEETS_ID` | Required for UUID upserts to `All Leads` and failures to `Missed Leads` |

Leads are written to **Cloudflare D1** first, then mirrored to Google Sheets. D1 remains authoritative when any external delivery fails.

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
| [ ] | `wrangler d1 migrations apply FUNNEL_DB --remote --config wrangler.toml` | Schema on prod D1 | 500 on lead save |

---

## Funnel config (`funnel.config.ts`)

| Check | Field | Purpose |
|-------|--------|---------|
| [ ] | `client.phone` | E.164 — trust / tel CTAs |
| [ ] | `funnel.slug` | URL path `/lp/{slug}/…` |
| [ ] | `inventory.products` (×5) | Thank-you inventory cards; `active: false` hides slot |
| [ ] | `inventory.pageUrl` | Optional “full inventory page” link below grid |
| [ ] | `serviceAreaZipCodes` | Enforced ZIP allowlist in every runtime environment |
| [ ] | `contact.consent` | Legal snapshot stored with lead |

---

## Production secrets — copy/paste

```bash
npx wrangler secret put META_CAPI_ACCESS_TOKEN
npx wrangler secret put GHL_API_KEY
npx wrangler secret put GHL_LOCATION_ID
npx wrangler secret put GOOGLE_SHEETS_ID
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
npx wrangler secret put STAGE_WEBHOOK_SECRET
npx wrangler secret put CRM_CALLBACK_SECRET
npx wrangler secret put ALERT_WEBHOOK_URL               # optional
```

Local: copy `.dev.vars.example` → `.dev.vars`.

---

## Deploy

The GitHub Actions `Deploy` workflow is manual-only and requires the repository
secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. It runs:

```bash
npm run deploy
```

That script applies production migrations with:

```bash
wrangler d1 migrations apply FUNNEL_DB --remote --config wrangler.toml
```

Post-deploy:

- [ ] Thank-you loads after test lead
- [ ] GHL contact created
- [ ] Meta Events Manager shows Lead (then remove test code)
- [ ] Callback smoke: appointment stage returns 202
