import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
    });
    expect(JSON.stringify(manifest)).not.toMatch(/secret|token|password/i);
  });
});
