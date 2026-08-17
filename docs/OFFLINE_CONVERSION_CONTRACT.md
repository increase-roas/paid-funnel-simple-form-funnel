# Offline conversion contract

The CRM reports downstream lifecycle changes to:

```http
POST /api/funnel/{slug}/conversion
Authorization: Bearer <CRM_CALLBACK_SECRET>
Content-Type: application/json
```

`CRM_CALLBACK_SECRET` is mandatory. A missing secret fails closed with `503`;
an invalid bearer token returns `401`.

## Exact stage mapping

| Pipeline stage | Callback `stage` | Meta event | Value rule |
|---|---|---|---|
| `Hot Pursuit` | `qualified` | `QualifiedLead` | Explicit finite nonnegative value, otherwise `75` |
| `Appointment Set` | `appointment` | `Schedule` | Explicit finite nonnegative value, otherwise `300` |
| `Showed` | `show` | `Showed` | Explicit finite nonnegative value, otherwise `600` |
| `Sold` | `sale` | `Purchase` | Explicit positive value required |

`Purchase` has no default or universal sale value. The callback is rejected
unless its value is greater than zero. No new per-stage environment variables
are part of this contract.

## Stable lead join

The canonical join key is `leadUuid`, copied from the lead-delivery payload.
It is the stable D1 lead ID used to query `leads.id`. `leadId` remains accepted
only as a backward-compatible alias. If both names are present, they must be
identical or the callback is rejected.

Example:

```json
{
  "leadUuid": "32c886da-4ac7-4cc0-9ee2-6785ae23d85f",
  "idempotencyKey": "ghl-appointment-contact-123",
  "stage": "appointment",
  "currency": "USD"
}
```

## Idempotency and event ID reuse

The callback's `idempotencyKey` is stored as
`downstream_conversions.external_id`. The first accepted callback creates and
stores one Meta event ID in `downstream_conversions.event_id`. A duplicate
`idempotencyKey` returns the already stored `eventId` and does not create or
dispatch a second event. Retries therefore reuse the same Meta `event_id`.

## Original attribution reuse

Offline events reuse attribution stored with the original D1 lead, not values
from the later CRM callback:

- `first_url` supplies the Meta event source URL.
- `original_query_string`, `fbc`, and `fbp` remain on the reconstructed
  funnel session.
- `ip_address` and `user_agent` populate the attribution request used for
  server dispatch.

Required runtime secrets are `CRM_CALLBACK_SECRET`,
`STAGE_WEBHOOK_SECRET`, `META_CAPI_ACCESS_TOKEN`, `GHL_API_KEY`,
`GHL_LOCATION_ID`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
