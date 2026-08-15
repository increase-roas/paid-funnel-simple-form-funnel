# Paid Funnel Feature Expansion

- [x] Add desktop exit intent and mobile back-intent modal with `wizard_leave_attempt`, `_cancel_project`, and `_return_to_project` dataLayer events.
- [x] Add Page Visibility-aware active-time retention events at 30, 60, 120, 180, 300, 600, and 1800 seconds.
- [x] Insert a 3–4 second factual “Validating results” interstitial between the final survey answer and contact form.
- [x] Add configurable approved/qualified framing to the contact step.
- [x] Support configurable `counter`, `bar`, and `both` progress styles on every funnel screen.
- [x] Add first-step geo-localized H1 rendering from Cloudflare request city and region with a generic fallback.
- [x] Add BroadcastChannel and sessionStorage multi-tab guarding that suppresses duplicate fires.
- [x] Add optional Google Ads manual enhanced-conversion dataLayer payload on the guarded thank-you conversion.
- [x] Add optional GA4 loader and guarded `generate_lead` event on successful submission.
- [x] Preload the complete question route set client-side for zero-latency transitions while preserving numeric URLs and server saves.
- [x] Extend `funnel.config.ts`, Zod validation, types, and gate checks for all new fields.
- [x] Update unit tests, HTTP smoke coverage, and README documentation.
- [x] Run gate, tests, type check, production build, smoke flow, and responsive screenshot validation.
- [x] Save a new checkpoint and export the updated clean source ZIP.
