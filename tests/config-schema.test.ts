import { describe, expect, it } from "vitest";
import { funnelConfigSchema } from "../src/lib/config-schema";
import rawConfig from "../funnel.config";
import { buildFunnelInput } from "../src/lib/funnelDefaults";

describe("funnel config schema", () => {
  it("accepts the default simple-form config as shape A", () => {
    expect(funnelConfigSchema.parse(rawConfig).funnel.shape).toBe("A");
    expect(funnelConfigSchema.parse(rawConfig).inventory.enabled).toBe(true);
  });

  it("allows empty survey questions only for shape A", () => {
    const shapeA = funnelConfigSchema.parse({
      ...rawConfig,
      funnel: { ...rawConfig.funnel, shape: "A" },
      surveyQuestions: [],
    });
    expect(shapeA.funnel.shape).toBe("A");
    expect(shapeA.surveyQuestions).toEqual([]);

    expect(() =>
      funnelConfigSchema.parse({
        ...buildFunnelInput("B"),
        funnel: { ...buildFunnelInput("B").funnel, shape: "B" },
        inventory: { ...rawConfig.inventory, enabled: false },
        surveyQuestions: [],
      }),
    ).toThrow(/survey/i);
  });

  it("requires exactly five inventory slots when inventory is enabled", () => {
    expect(() =>
      funnelConfigSchema.parse({
        ...rawConfig,
        inventory: {
          ...rawConfig.inventory,
          products: rawConfig.inventory.products.slice(0, 4),
        },
      }),
    ).toThrow(/five product slots/i);

    expect(() =>
      funnelConfigSchema.parse({
        ...rawConfig,
        inventory: {
          ...rawConfig.inventory,
          products: rawConfig.inventory.products.map((product) => ({ ...product, active: false })),
        },
      }),
    ).toThrow(/active product/i);
  });

  it("requires calendarUrl only for shape C", () => {
    expect(() =>
      funnelConfigSchema.parse({
        ...buildFunnelInput("C"),
        inventory: { ...rawConfig.inventory, enabled: false },
        calendarUrl: undefined,
      }),
    ).toThrow(/calendarUrl/i);
  });

  it("rejects duplicate inventory product IDs", () => {
    const duplicateProduct = rawConfig.inventory.products[0];
    expect(() =>
      funnelConfigSchema.parse({
        ...rawConfig,
        inventory: {
          ...rawConfig.inventory,
          products: [duplicateProduct, duplicateProduct],
        },
      }),
    ).toThrow(/unique/i);
  });

  it("accepts progress, approval, geo, and optional Google fields", () => {
    const parsed = funnelConfigSchema.parse(rawConfig);
    expect(parsed.progressStyle).toBe("both");
    expect(parsed.approvedFramingHeadline.length).toBeGreaterThan(10);
    expect(parsed.geoH1Template).toContain("{city}");
    expect(parsed.googleEnhancedConversions).toBe(false);
    expect(parsed.ga4MeasurementId).toBeUndefined();
  });

  it("rejects malformed progress modes and geo templates", () => {
    expect(() => funnelConfigSchema.parse({ ...rawConfig, progressStyle: "dots" })).toThrow();
    expect(() => funnelConfigSchema.parse({ ...rawConfig, geoH1Template: "Find local service nearby" })).toThrow(/placeholder/i);
  });

  it("requires a valid GA4 ID when enhanced conversions are enabled", () => {
    expect(() => funnelConfigSchema.parse({ ...rawConfig, googleEnhancedConversions: true })).toThrow(/ga4MeasurementId/i);
    expect(() => funnelConfigSchema.parse({ ...rawConfig, ga4MeasurementId: "UA-123" })).toThrow();
  });
});
