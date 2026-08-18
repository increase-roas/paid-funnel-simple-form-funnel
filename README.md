# Increase ROAS Paid Funnel Standard

**Contract version: 1**

This repository is a reusable **paid funnel template**.

Repository:

https://github.com/increase-roas/paid-funnel-simple-form-funnel

This repo currently implements the **Simple Form Funnel / Shape A**:

**ZIP → Contact → Thank You → 5 inventory slots**

## IMPORTANT — SOURCE OF TRUTH

This README defines the canonical naming and integration language for Increase ROAS paid-funnel templates.

All paid-funnel repositories should follow this contract unless a deliberate **contract-version change** is made.

### DO NOT casually rename:

* configuration fields
* environment variables
* Cloudflare secrets
* Cloudflare bindings
* webhook names
* callback names
* deployment resource names

Launchpad will depend on these names.

Changing CSS, components, layouts, images, copy, or internal implementation should **not** require Launchpad to be rewired.

Changing this contract can require Launchpad changes.

---

# Architecture Rule

Use:

```text
ONE REPOSITORY
=
ONE REUSABLE FUNNEL TEMPLATE
```

Examples:

```text
paid-funnel-simple-form-funnel
paid-funnel-financing
paid-funnel-event
paid-funnel-advertorial
```

Do **not** create a separate source-code repository for every customer.

Customers are instances of templates:

```text
Simple Form Funnel template
        ↓
Paradise Spas configuration

Simple Form Funnel template
        ↓
Client B configuration

Simple Form Funnel template
        ↓
Client C configuration
```

The reusable code stays in this repository.

Client-specific values live in Site Launchpad.

---

# Safe Changes

These normally **DO NOT require Launchpad changes**:

* CSS
* fonts
* spacing
* colors
* responsive behavior
* components
* animations
* page layout
* internal refactors
* performance improvements
* bug fixes
* default template imagery
* inventory-card design
* thank-you-page design
* visual improvements

As long as the public configuration/integration contract remains compatible, Launchpad should keep working.

---

# Contract Changes

These **CAN require Launchpad changes**:

* renaming a config property
* removing a required config property
* adding a new required config property
* renaming a secret
* adding a required secret
* changing a Cloudflare binding
* changing required infrastructure
* changing webhook behavior
* changing callback payload expectations
* changing config structure incompatibly

If a contract change is genuinely necessary:

1. Do not silently rename it.
2. Increase the contract version.
3. Update this README.
4. Update the template's machine-readable Launchpad manifest.
5. Update tests.
6. Update Site Launchpad support in the same change set.
7. Verify an existing client configuration still works or provide an explicit migration.

---

# Canonical Secret Language

These names are **case-sensitive contracts**.

## `META_CAPI_ACCESS_TOKEN`

**Type:** Cloudflare secret
**Scope:** Client/funnel deployment
**Purpose:** Authentication for server-side Meta Conversions API events.

Do not rename this to:

* `META_TOKEN`
* `FACEBOOK_TOKEN`
* `CAPI_TOKEN`
* another invented variant

Launchpad should display a friendly explanation while preserving the exact runtime name:

`META_CAPI_ACCESS_TOKEN`

---

## `META_TEST_EVENT_CODE`

**Type:** Cloudflare secret
**Scope:** Temporary development/smoke testing only
**Purpose:** Sends Meta events into Events Manager test mode.

### WARNING

This must **NOT remain enabled in production**.

Production readiness must fail if a test-event code remains configured for a live deployment.

Launchpad should clearly label this:

> Testing only — remove before production.

---

## Direct GHL lead delivery

**Type:** Cloudflare secrets
**Scope:** Client
**Purpose:** Create or update the lead through the GHL API and persist the returned contact ID.

Required secrets:

* `GHL_API_KEY`
* `GHL_LOCATION_ID`

The Worker writes the lead to D1 before calling GHL. Failed delivery remains
recoverable from D1 and is mirrored to the `Missed Leads` sheet when Google
Sheets is configured. This template does not use a GHL inbound-webhook URL.

---

## `CRM_CALLBACK_SECRET`

**Type:** Cloudflare secret
**Scope:** Client/funnel deployment
**Purpose:** Bearer authentication for:

`POST /api/funnel/{slug}/conversion`

This protects CRM lifecycle callbacks for:

* appointment
* show
* sale

### Canonical name

Use:

`CRM_CALLBACK_SECRET`

Older/internal documentation may refer to a similar concept as:

`STAGE_WEBHOOK_SECRET`

For the slugged callback above, the canonical runtime name is:

`CRM_CALLBACK_SECRET`

`POST /api/lead-stage` and `POST /api/phone-lead` intentionally use
`STAGE_WEBHOOK_SECRET`. The two names are separate route contracts and must not
be substituted for one another.

### Recommended Launchpad behavior

Launchpad should generate this value securely for the client rather than requiring Alex to invent one manually.

Never reuse one client's callback secret for another client.

---

## `ALERT_WEBHOOK_URL`

**Type:** Cloudflare secret
**Scope:** Optional alerting configuration
**Purpose:** Sends an operational alert when GHL delivery fails.

Canonical paid-funnel name:

`ALERT_WEBHOOK_URL`

Do not use the legacy `SUBMISSION_ALERT_WEBHOOK_URL` name in generated deployments.

---

# Cloudflare Variables

These are variables, **not secrets**.

## `ENVIRONMENT`

Expected values should distinguish development/test from production.

Production gates must verify the correct environment before release.

## `META_GRAPH_API_VERSION`

Current template value:

`v26.0`

Do not hard-code different API-version terminology throughout the application.

Keep one canonical variable.

---

# Cloudflare Binding Names

These names are also contracts.

Do not rename them casually.

## `ASSETS`

Static Astro build assets.

## `FUNNEL_SESSIONS`

Cloudflare KV binding used for session/attribution state.

## `FUNNEL_DB`

Cloudflare D1 binding used for leads and event records.

## `CAPI_RETRY_QUEUE`

Cloudflare Queue binding for retrying failed Meta CAPI events.

If a future funnel does not require one of these resources, its template manifest should explicitly state that.

Do not invent a different binding name for the same job in another funnel.

---

# Common Configuration Language

Where a paid funnel uses these concepts, use the same names across repositories.

## Client

```text
client.name
client.phone
client.logoUrl
client.logoAlt
```

## Funnel

```text
funnel.slug
funnel.shape
```

Shape values:

```text
A
B
C
```

## Offer

```text
offer.headline
offer.subheadline
```

## Meta

```text
meta.pixelId
meta.conversionEventName
meta.currency
meta.defaultConversionValue
```

`meta.pixelId` is configuration.

It is **not** a secret.

## Service Area

```text
serviceAreaZipCodes
```

## GHL

GHL credentials are Worker secrets and never appear in `funnel.config.ts`.

## Contact Consent

Keep consent as explicit structured configuration rather than burying legal copy in components.

## Inventory

Templates supporting inventory should use the established `inventory` structure rather than creating arbitrary new names.

The Simple Form Funnel currently expects exactly five inventory product slots.

---

# Template-Specific Configuration

Not every funnel needs identical fields.

That is okay.

Use two layers:

```text
COMMON PAID-FUNNEL CONTRACT
+
TEMPLATE-SPECIFIC REQUIREMENTS
```

Do not distort every funnel into one gigantic universal schema.

For example:

* Simple Form may require inventory.
* A booking funnel may require a calendar URL.
* An advertorial may require additional page content.
* Another funnel may use survey questions.

Those differences belong to the template's declared contract.

---

# Launchpad Template Manifest

Every funnel template integrated with Site Launchpad should have one machine-readable manifest:

```text
launchpad.template.json
```

Minimum concept:

```json
{
  "schemaVersion": 1,
  "contractVersion": 1,
  "templateKey": "simple-form",
  "name": "Simple Form Funnel",
  "repo": "increase-roas/paid-funnel-simple-form-funnel",
  "defaultBranch": "main",
  "type": "paid-funnel",
  "shape": "A",
  "active": true
}
```

Site Launchpad should use the manifest to associate client funnel instances with this template.

The manifest should never contain secret values.

---

# Launchpad Rule

Site Launchpad should store:

```text
client
+
templateKey
+
templateRepo
+
contractVersion
+
client configuration
+
client asset overrides
+
encrypted client secrets
```

It should **not duplicate the source code of this template into Launchpad**.

It should **not require Alex to work in GitHub to create a client funnel**.

---

# Template Assets

Default imagery belongs to the template.

If the template already has a default:

* hero image
* background
* graphic
* placeholder product image

the operator should not have to upload it again for every client.

Launchpad should support:

```text
Use Template Default
```

or:

```text
Override With Client Media
```

Client media should be uploaded once and reused within that client's configuration.

---

# Secret UI Rules

Launchpad should show human-friendly labels and instructions, but the underlying runtime names stay canonical.

Example:

```text
Meta CAPI Access Token
Runtime key: META_CAPI_ACCESS_TOKEN

Where do I find this?
[short explanation]
[official documentation link]
```

Never ask an operator to understand why the application calls it that.

But never silently change the runtime name either.

For every secret, Launchpad should distinguish:

```text
YOU PROVIDE THIS
```

from:

```text
LAUNCHPAD GENERATES THIS
```

and:

```text
TESTING ONLY
```

---

# Never Put Secrets In

* Git
* source code
* README examples containing real values
* commits
* PR descriptions
* screenshots
* logs
* browser artifacts
* generated public config files
* client-visible URLs

Use placeholders only in documentation.

---

# Simple Form Funnel — Current Flow

This repo currently implements:

```text
ZIP
↓
Contact
↓
Thank You
↓
5 inventory slots
```

Runtime customer configuration is loaded from the root `funnel.config.ts`.
Every environment enforces its `serviceAreaZipCodes`; there is no ZIP bypass.

Local:

```bash
npm install
npm run dev
```

Open: `http://localhost:3000/lp/hot-tub-offer/step/1`

Checks:

```bash
npm run gate
npm test
npm run check
npm run build
```

Go-live wiring checklist (secrets, Meta, GHL, callbacks):

**[docs/WIRING.md](./docs/WIRING.md)**

The GitHub Actions `Deploy` workflow is triggered manually only. It checks out
the repository, uses the Node version in `.nvmrc`, runs `npm ci`, then runs:

```bash
npm run deploy
```

The deployment script applies D1 migrations through the configured binding:

```bash
wrangler d1 migrations apply FUNNEL_DB --remote --config wrangler.toml
```

Production deployment requires explicit owner approval.

---

# Production Gate

Before a production release, verify at minimum:

```text
npm run gate
PASS

npm test
PASS

npm run check
PASS

npm run build
PASS
```

Then verify the complete browser flow.

Never call a funnel live merely because the build completed.

---

# Final Rule

**Implementation can evolve freely. The contract cannot drift silently.**

If an AI coding agent edits this repository, it must determine whether the requested change is:

### IMPLEMENTATION-ONLY

No Launchpad wiring change necessary.

or:

### CONTRACT CHANGE

Requires explicit contract-version handling and coordinated Launchpad validation.

When uncertain, preserve the existing contract.
