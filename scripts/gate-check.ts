import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { funnelConfig, getActiveInventoryProducts, getStep, getTotalSteps } from "../src/lib/config";
import { findManifestCredentialValues } from "./manifest-secret-policy";

const root = resolve(import.meta.dirname, "..");
const failures: string[] = [];

function requireCondition(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function read(relativePath: string): string {
  const path = resolve(root, relativePath);
  requireCondition(existsSync(path), `Required file is missing: ${relativePath}`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function collectUserFacingCopy(): string[] {
  return [
    funnelConfig.client.name,
    funnelConfig.client.logoAlt,
    funnelConfig.funnel.ctaLabel,
    funnelConfig.funnel.advertorialLabel,
    funnelConfig.funnel.qualifyingLine,
    funnelConfig.offer.headline,
    funnelConfig.offer.subheadline,
    funnelConfig.approvedFramingHeadline,
    funnelConfig.geoH1Template,
    funnelConfig.contact.headline,
    funnelConfig.contact.submitLabel,
    funnelConfig.contact.consent.text,
    funnelConfig.trust.eyebrow,
    funnelConfig.trust.statement,
    funnelConfig.thankYou.headline,
    funnelConfig.thankYou.message,
    funnelConfig.outOfArea.headline,
    funnelConfig.outOfArea.message,
    funnelConfig.inventory.headline,
    funnelConfig.inventory.subheadline,
    ...getActiveInventoryProducts().flatMap((product) => [
      product.name,
      product.description ?? "",
      product.priceLabel ?? "",
      product.ctaLabel,
    ]),
    ...funnelConfig.surveyQuestions.flatMap((question) => [
      question.text,
      question.helpText ?? "",
      ...(question.options?.map((option) => option.label) ?? []),
    ]),
  ].filter(Boolean);
}

const totalSteps = getTotalSteps();
const shape = funnelConfig.funnel.shape;
requireCondition(shape === "A", "This template is Shape A only (ZIP → contact → thank-you inventory).");
const expectedTotal =
  shape === "A"
    ? 2
    : shape === "C"
      ? funnelConfig.surveyQuestions.length + 4
      : funnelConfig.surveyQuestions.length + 3;
requireCondition(totalSteps === expectedTotal, "Step count must follow the configured funnel shape.");
for (let number = 1; number <= totalSteps; number += 1) {
  const step = getStep(number);
  requireCondition(step !== null, `Configured step ${number} does not resolve.`);
  if (number === 1) requireCondition(step?.kind === "zip", "Step 1 must be ZIP only.");
  if (shape === "A" && number === 2) requireCondition(step?.kind === "contact", "Shape A step 2 must be contact capture.");
  if (shape === "B" && number === totalSteps - 1) requireCondition(step?.kind === "interstitial", "The penultimate step must validate results.");
  if (shape === "B" && number === totalSteps) requireCondition(step?.kind === "contact", "The final step must be contact capture.");
  if (shape === "C" && number === totalSteps - 2) requireCondition(step?.kind === "interstitial", "Shape C must keep the validation interstitial.");
  if (shape === "C" && number === totalSteps - 1) requireCondition(step?.kind === "contact", "Shape C contact must precede the book step.");
  if (shape === "C" && number === totalSteps) requireCondition(step?.kind === "book", "Shape C final step must be book.");
}
requireCondition(getStep(0) === null && getStep(totalSteps + 1) === null, "Out-of-range steps must not render.");

const copy = collectUserFacingCopy();
const placeholderPattern = /\b(lorem ipsum|placeholder copy|todo|tbd|coming soon|your company|company name)\b/i;
for (const value of copy) {
  requireCondition(!placeholderPattern.test(value), `Placeholder copy found: “${value}”`);
  requireCondition(!value.includes("*"), `Unresolved asterisk found in user-facing copy: “${value}”`);
}
requireCondition(
  !/\b(you|your|you'll|you will)\b/i.test(funnelConfig.offer.headline),
  "Offer headline contains a second-person promise.",
);

const layout = read("src/layouts/FunnelLayout.astro");
const stepPage = read("src/pages/lp/[slug]/step/[n].astro");
const thankYouPage = read("src/pages/lp/[slug]/thank-you.astro");
const outOfAreaPage = read("src/pages/lp/[slug]/out-of-area.astro");
const pixel = read("src/components/MetaPixel.astro");
const tracking = read("src/lib/tracking.ts");
const middleware = read("src/middleware.ts");
const robots = read("public/robots.txt");
const wrangler = read("wrangler.toml");
const manifestRaw = read("launchpad.template.json");
let manifest: {
  schemaVersion?: unknown;
  contractVersion?: unknown;
  templateKey?: unknown;
  name?: unknown;
  repo?: unknown;
  defaultBranch?: unknown;
  type?: unknown;
  shape?: unknown;
  active?: unknown;
} = {};
try {
  manifest = JSON.parse(manifestRaw) as typeof manifest;
} catch {
  failures.push("launchpad.template.json is not valid JSON.");
}
requireCondition(manifest.schemaVersion === 1, "launchpad.template.json schemaVersion must be 1.");
requireCondition(manifest.contractVersion === 1, "launchpad.template.json contractVersion must be 1.");
requireCondition(manifest.templateKey === "simple-form", "launchpad.template.json templateKey must be simple-form.");
requireCondition(manifest.name === "Simple Form Funnel", "launchpad.template.json name must match this template.");
requireCondition(manifest.repo === "increase-roas/paid-funnel-simple-form-funnel", "launchpad.template.json repo must match this repository.");
requireCondition(manifest.defaultBranch === "main", "launchpad.template.json defaultBranch must be main.");
requireCondition(manifest.type === "paid-funnel", "launchpad.template.json type must be paid-funnel.");
requireCondition(manifest.shape === "A", "launchpad.template.json shape must be A.");
requireCondition(manifest.active === true, "launchpad.template.json must be active.");
for (const violation of findManifestCredentialValues(manifest)) {
  failures.push(`launchpad.template.json ${violation}.`);
}
const migration = read("migrations/0001_initial.sql");
const validation = read("src/lib/validation.ts");
const worker = read("src/worker.ts");
const runtime = read("src/components/FunnelClientRuntime.astro");
const interstitial = read("src/components/ValidationInterstitial.astro");
const preloaded = read("src/components/PreloadedFunnel.astro");
const googleConversion = read("src/components/GoogleConversionEvents.astro");
const progress = read("src/components/ProgressBar.astro");
const configSchema = read("src/lib/config-schema.ts");
const runtimeConfig = read("src/lib/config.ts");

requireCondition(layout.includes("funnelConfig.funnel.advertorialLabel"), "Advertorial label is not rendered from config.");
requireCondition(layout.includes('name="robots"') && layout.includes("noindex"), "Paid layout is missing the noindex meta tag.");
requireCondition(middleware.includes("X-Robots-Tag") && middleware.includes('startsWith("/lp/")'), "Paid routes are missing the noindex response header.");
requireCondition(/Disallow:\s*\/lp\//.test(robots), "robots.txt must disallow /lp/.");
requireCondition(!layout.includes("maximum-scale") && !layout.includes("user-scalable"), "Viewport zoom must not be locked.");
requireCondition(!/<(?:div|span)[^>]+role=["']button["']/i.test(layout + stepPage), "Use real buttons, not button roles on generic elements.");

requireCondition(["counter", "bar", "both"].includes(funnelConfig.progressStyle), "progressStyle is invalid.");
requireCondition(funnelConfig.geoH1Template.includes("{city}") && funnelConfig.geoH1Template.includes("{state}"), "Geo H1 template placeholders are missing.");
requireCondition(stepPage.includes("geoH1Template") && stepPage.includes("session.geo.city"), "ZIP H1 is not geo-localized from Cloudflare session data.");
requireCondition(stepPage.includes("approvedFramingHeadline"), "Approved contact framing is not rendered from config.");
requireCondition(progress.includes('style !== "bar"') && progress.includes('style !== "counter"'), "Progress counter/bar modes are not independently configurable.");
requireCondition(configSchema.includes('z.enum(["counter", "bar", "both"])'), "Progress style is not schema validated.");

for (const eventName of ["wizard_leave_attempt", "_cancel_project", "_return_to_project"]) {
  requireCondition(runtime.includes(eventName), `Exit-intent dataLayer event ${eventName} is missing.`);
}
requireCondition(runtime.includes("BroadcastChannel") && runtime.includes("sessionStorage"), "Multi-tab guard is missing BroadcastChannel or sessionStorage ownership.");
requireCondition(runtime.includes("document.visibilityState === 'visible'"), "Retention timer does not require active page visibility.");
for (const seconds of [30, 60, 120, 180, 300, 600, 1800]) {
  requireCondition(runtime.includes(String(seconds)), `Retention threshold ${seconds}s is missing.`);
}
requireCondition(runtime.includes("retention_visible"), "Retention events are not pushed to dataLayer.");

requireCondition(interstitial.includes("Verifying your profile") && interstitial.includes("Checking service availability"), "Factual validation interstitial copy is missing.");
requireCondition(interstitial.includes("3600") && interstitial.includes("location.replace"), "Standalone interstitial does not auto-advance after 3–4 seconds.");
requireCondition(preloaded.includes("data-preloaded-funnel") && preloaded.includes("x-funnel-navigation"), "Full question set is not pre-rendered with optimistic persistence.");
requireCondition(configSchema.includes('"A"') && configSchema.includes('"B"') && configSchema.includes('"C"'), "Funnel shapes A, B, and C are not schema validated.");
const inventoryGrid = read("src/components/InventoryGrid.astro");
requireCondition(thankYouPage.includes("InventoryGrid"), "Thank-you inventory grid is missing.");
requireCondition(inventoryGrid.includes("inventory-grid--five") && inventoryGrid.includes("INVENTORY_SLOT_COUNT"), "Thank-you must render five inventory slots.");
requireCondition(configSchema.includes("inventoryProductSchema") || configSchema.includes("inventory:"), "Inventory config is not schema validated.");
requireCondition(preloaded.includes("premint") === false && stepPage.includes("preloadedTrackingSteps"), "Future event IDs must be pre-minted server-side before preloaded steps fire.");
requireCondition(preloaded.includes("history.pushState") && preloaded.includes("showStep"), "Preloaded steps do not update numeric URLs instantly.");

requireCondition(googleConversion.includes("generate_lead"), "GA4 generate_lead event is missing.");
for (const key of ["country", "zip", "first_name", "last_name", "phone", "email"]) {
  requireCondition(googleConversion.includes(key), `Enhanced conversion field ${key} is missing.`);
}
requireCondition(thankYouPage.includes("googleConversion={googleConversion}"), "Google conversion events are not gated by the one-time thank-you success.");

requireCondition(stepPage.includes("premintTrackingEvent"), "Step routes do not pre-mint tracking events.");
requireCondition(thankYouPage.includes("premintTrackingEvent"), "Thank-you conversion is not pre-minted.");
requireCondition(tracking.includes("INSERT INTO tracking_events"), "Pre-minted event IDs are not written to D1.");
requireCondition(pixel.includes("eventID: tracking.pageView.eventId"), "Browser PageView does not use its pre-minted event ID.");
requireCondition(pixel.includes("eventID: tracking.conversion.eventId"), "Browser conversion does not use its pre-minted event ID.");
requireCondition(tracking.includes("event_id: record.eventId"), "CAPI events do not reuse the browser event ID.");
requireCondition(tracking.includes("event_name: record.eventName"), "CAPI events do not reuse the browser event name.");
requireCondition(tracking.includes("fbc: session.fbc") && tracking.includes("fbp: session.fbp"), "CAPI click identifiers are missing.");
requireCondition(pixel.includes("fbq('init'") && !pixel.includes("fbq('init'\n"), "Pixel initialization is missing.");
requireCondition(!stepPage.includes("conversionEventName"), "Conversion event name must not fire on survey steps.");
requireCondition(!outOfAreaPage.includes("conversionEventName"), "Conversion event must not fire out of area.");
requireCondition(thankYouPage.includes("funnelConfig.meta.conversionEventName"), "Configured conversion event is not fired on thank-you.");
requireCondition(thankYouPage.includes("session.leadStatus !== \"delivered\""), "Thank-you conversion lacks its validated-delivery gate.");
requireCondition(pixel.includes("pagehide") && pixel.includes("clearTimeout"), "Timed ViewContent does not cancel on pagehide.");

requireCondition(validation.includes("normalizePhoneE164"), "E.164 phone validation is missing.");
requireCondition(validation.includes("isDisposableEmail"), "Disposable email validation is missing.");
requireCondition(runtimeConfig.includes("serviceAreaZipCodes.includes"), "Service-area ZIP validation is missing.");
requireCondition(
  !runtimeConfig.includes("ALLOW_ANY_ZIP") && !validation.includes("ALLOW_ANY_ZIP"),
  "Runtime ZIP bypasses are forbidden.",
);
requireCondition(validation.includes("isDuplicateLead"), "Duplicate lead detection is missing.");
requireCondition(validation.includes("honeypot"), "Server-side honeypot validation is missing.");

requireCondition(worker.includes("message.retry") && worker.includes("2 **"), "Queue exponential retry logic is missing.");
requireCondition(worker.includes("SEVEN_DAYS_MS"), "Queue does not abandon CAPI events after seven days.");
requireCondition(wrangler.includes('binding = "FUNNEL_SESSIONS"'), "Cloudflare KV binding is missing.");
requireCondition(wrangler.includes('binding = "FUNNEL_DB"'), "Cloudflare D1 binding is missing.");
requireCondition(wrangler.includes('binding = "CAPI_RETRY_QUEUE"'), "Cloudflare Queue producer is missing.");
requireCondition(migration.includes("tracking_events") && migration.includes("dropped_capi_events"), "D1 event ledger tables are missing.");

if (process.env.ENVIRONMENT === "production" && process.env.META_TEST_EVENT_CODE) {
  failures.push("META_TEST_EVENT_CODE must not be set in production.");
}

if (failures.length > 0) {
  console.error("\nPaid funnel gate failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Paid funnel gate passed: ${totalSteps} dynamic steps, 10 conversion features, tracking, validation, disclosure, robots, and Cloudflare bindings verified.`);
