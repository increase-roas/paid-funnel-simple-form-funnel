import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findManifestCredentialValues } from "../scripts/manifest-secret-policy";

const manifestPath = resolve(import.meta.dirname, "../launchpad.template.json");

describe("launchpad.template.json", () => {
  it("declares contract version 1 for the simple-form Shape A template", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      schemaVersion: number;
      contractVersion: number;
      templateKey: string;
      name: string;
      repo: string;
      defaultBranch: string;
      type: string;
      shape: string;
      active: boolean;
      optionalRuntimeSecrets: string[];
      offlineConversionContract: {
        version: number;
        joinKey: string;
        callback: {
          method: string;
          route: string;
          authentication: string;
        };
        stageMappings: Array<{
          pipelineStage: string;
          callbackStage: string;
          metaEvent: string;
        }>;
        requiredRuntimeSecrets: string[];
        deduplication: {
          idempotencyKey: string;
          eventId: string;
        };
        originalAttribution: {
          reuse: boolean;
          fields: string[];
        };
        purchase: {
          requiresExplicitPositiveValue: boolean;
        };
      };
    };

    expect(manifest).toEqual({
      schemaVersion: 1,
      contractVersion: 1,
      templateKey: "simple-form",
      name: "Simple Form Funnel",
      repo: "increase-roas/paid-funnel-simple-form-funnel",
      defaultBranch: "main",
      type: "paid-funnel",
      shape: "A",
      active: true,
      optionalRuntimeSecrets: ["ALERT_WEBHOOK_URL"],
      offlineConversionContract: {
        version: 1,
        joinKey: "leadUuid",
        callback: {
          method: "POST",
          route: "/api/lead-stage",
          authentication: "Bearer STAGE_WEBHOOK_SECRET",
        },
        stageMappings: [
          {
            pipelineStage: "Hot Pursuit",
            callbackStage: "qualified",
            metaEvent: "QualifiedLead",
          },
          {
            pipelineStage: "Appointment Set",
            callbackStage: "appointment",
            metaEvent: "Schedule",
          },
          {
            pipelineStage: "Showed",
            callbackStage: "show",
            metaEvent: "Showed",
          },
          {
            pipelineStage: "Sold",
            callbackStage: "sale",
            metaEvent: "Purchase",
          },
        ],
        requiredRuntimeSecrets: [
          "GHL_API_KEY",
          "GHL_LOCATION_ID",
          "GOOGLE_SHEETS_ID",
          "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
          "META_PIXEL_ID",
          "META_CAPI_ACCESS_TOKEN",
          "STAGE_WEBHOOK_SECRET",
        ],
        deduplication: {
          idempotencyKey: "downstream_conversions.external_id",
          eventId: "downstream_conversions.event_id",
        },
        originalAttribution: {
          reuse: true,
          fields: [
            "first_url",
            "original_query_string",
            "fbc",
            "fbp",
            "ip_address",
            "user_agent",
          ],
        },
        purchase: { requiresExplicitPositiveValue: true },
      },
    });
  });

  it("allows required secret names but rejects runtime credential values", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(findManifestCredentialValues(manifest)).toEqual([]);

    expect(
      findManifestCredentialValues({
        ...manifest,
        optionalRuntimeSecrets: ["ALERT_WEBHOOK_URL", "GHL_WEBHOOK_URL"],
      }),
    ).toEqual([
      "optionalRuntimeSecrets may contain optional secret names only",
    ]);

    for (const field of [
      "credential",
      "password",
      "secretValue",
      "token",
      "webhookSecret",
    ]) {
      expect(
        findManifestCredentialValues({
          ...manifest,
          [field]: "test-only-not-a-real-credential",
        }),
      ).toEqual([`${field} may not contain a runtime secret value`]);
    }

    const offlineConversionContract = manifest.offlineConversionContract as {
      requiredRuntimeSecrets: string[];
    };
    expect(
      findManifestCredentialValues({
        ...manifest,
        offlineConversionContract: {
          ...offlineConversionContract,
          requiredRuntimeSecrets: [
            ...offlineConversionContract.requiredRuntimeSecrets,
            "test-only-not-a-secret-name",
          ],
        },
      }),
    ).toEqual([
      "offlineConversionContract.requiredRuntimeSecrets may contain required secret names only",
    ]);
  });
});
