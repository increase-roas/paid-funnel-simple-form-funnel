import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  import.meta.dirname,
  "../.github/workflows/deploy.yml",
);

describe("deployment workflow", () => {
  it("is manual-only and uses the repository deployment script", () => {
    const workflowExists = existsSync(workflowPath);
    expect(workflowExists).toBe(true);

    const workflow = workflowExists ? readFileSync(workflowPath, "utf8") : "";
    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:\s*$/m);
    expect(workflow).not.toMatch(
      /^\s{2}(push|pull_request|schedule|workflow_call):/m,
    );
    expect(workflow).toContain("uses: actions/checkout@v4");
    expect(workflow).toContain("uses: actions/setup-node@v4");
    expect(workflow).toContain("node-version-file: .nvmrc");
    expect(workflow).toContain("run: npm ci");
    expect(workflow).toContain("run: npm run deploy");
    expect(workflow).toContain(
      "CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}",
    );
    expect(workflow).toContain(
      "CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    );
    expect(workflow).not.toContain("cloudflare/wrangler-action");
  });
});
