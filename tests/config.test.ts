import { describe, expect, it } from "vitest";
import { funnelConfigSchema } from "../src/lib/config-schema";
import rawConfig from "../funnel.config";
import {
  funnelConfig,
  getActiveInventoryProducts,
  getStep,
  getTotalSteps,
  INVENTORY_SLOT_COUNT,
  resolveStep,
  resolveTotalSteps,
} from "../src/lib/config";
import { previewShapeFromEnv } from "../src/lib/funnelDefaults";

describe("simple form funnel steps", () => {
  it("derives ZIP then contact for shape A", () => {
    expect(getTotalSteps()).toBe(2);
    expect(getStep(1)).toMatchObject({ kind: "zip", key: "zip" });
    expect(getStep(2)).toMatchObject({ kind: "contact", key: "contact" });
    expect(getStep(3)).toBeNull();
  });

  it("reserves five inventory slots on thank-you", () => {
    expect(INVENTORY_SLOT_COUNT).toBe(5);
    expect(funnelConfig.inventory.products).toHaveLength(5);
    const active = getActiveInventoryProducts();
    expect(active.length).toBeGreaterThan(0);
    expect(active.every((product) => product.active)).toBe(true);
  });

  it("resolves shape A as two steps regardless of inventory", () => {
    const config = funnelConfigSchema.parse({
      ...rawConfig,
      funnel: { ...rawConfig.funnel, shape: "A" },
      surveyQuestions: [],
      inventory: { ...rawConfig.inventory, enabled: true },
    });
    expect(resolveTotalSteps(config)).toBe(2);
    expect(resolveStep(config, 1)).toMatchObject({ kind: "zip" });
    expect(resolveStep(config, 2)).toMatchObject({ kind: "contact" });
    expect(resolveStep(config, 3)).toBeNull();
  });

  it("defaults preview env to shape A", () => {
    expect(previewShapeFromEnv("A")).toBe("A");
    expect(previewShapeFromEnv("B")).toBe("B");
    expect(previewShapeFromEnv(undefined)).toBe("A");
  });

  it("rejects out-of-range step numbers", () => {
    expect(getStep(0)).toBeNull();
    expect(getStep(getTotalSteps() + 1)).toBeNull();
  });

  it("uses simple entry style in the default config", () => {
    expect(funnelConfig.funnel.entryStyle).toBe("simple");
    expect(funnelConfig.inventory.enabled).toBe(true);
  });
});
