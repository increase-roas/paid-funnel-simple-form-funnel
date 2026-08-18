import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("deployment contract", () => {
  it("applies production migrations through the FUNNEL_DB binding", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.deploy).toBe(
      "npm run build && wrangler d1 migrations apply FUNNEL_DB --remote --config wrangler.toml && wrangler deploy --config dist/server/wrangler.json",
    );
  });

  it("deploys Astro's generated Worker instead of rebundling raw Astro source", () => {
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.deploy).toContain(
      "wrangler deploy --config dist/server/wrangler.json",
    );
    expect(packageJson.scripts.deploy).not.toContain(
      "wrangler deploy --config wrangler.toml",
    );
  });

  it("documents the same binding-based production migration command", () => {
    const wiring = read("docs/WIRING.md");

    expect(wiring).toContain(
      "wrangler d1 migrations apply FUNNEL_DB --remote --config wrangler.toml",
    );
    expect(wiring).not.toContain(
      "wrangler d1 migrations apply paid-funnel-events --remote",
    );
  });
});
