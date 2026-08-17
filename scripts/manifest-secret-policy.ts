const REQUIRED_SECRET_NAMES = new Set([
  "CRM_CALLBACK_SECRET",
  "STAGE_WEBHOOK_SECRET",
  "META_PIXEL_ID",
  "META_CAPI_ACCESS_TOKEN",
  "GHL_API_KEY",
  "GHL_LOCATION_ID",
  "GOOGLE_SHEETS_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
]);

const ALLOWED_AUTHENTICATION_METADATA = "Bearer CRM_CALLBACK_SECRET";
const SENSITIVE_FIELD_NAME = /(credential|password|secret|token|webhook)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function findManifestCredentialValues(manifest: unknown): string[] {
  if (!isRecord(manifest)) return ["manifest must be an object"];

  const violations: string[] = [];

  function visit(value: unknown, path: string[]): void {
    const field = path.at(-1) ?? "";
    const location = path.join(".");

    if (
      location ===
      "offlineConversionContract.requiredRuntimeSecrets"
    ) {
      if (
        !Array.isArray(value) ||
        value.some(
          item =>
            typeof item !== "string" || !REQUIRED_SECRET_NAMES.has(item),
        )
      ) {
        violations.push(
          `${location} may contain required secret names only`,
        );
      }
      return;
    }

    if (location === "offlineConversionContract.callback.authentication") {
      if (value !== ALLOWED_AUTHENTICATION_METADATA) {
        violations.push(
          `${location} may describe the required bearer secret name only`,
        );
      }
      return;
    }

    if (SENSITIVE_FIELD_NAME.test(field)) {
      violations.push(`${location} may not contain a runtime secret value`);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, [...path, String(index)]));
      return;
    }

    if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        visit(item, [...path, key]);
      }
    }
  }

  visit(manifest, []);
  return violations;
}
