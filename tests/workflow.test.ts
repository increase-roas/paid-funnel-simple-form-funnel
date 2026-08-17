import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = resolve(
  import.meta.dirname,
  "../.github/workflows/deploy.yml",
);
const workflowExists = existsSync(workflowPath);
const workflow = workflowExists ? readFileSync(workflowPath, "utf8") : "";

describe("deployment workflow", () => {
  it("is manual-only and requires stable publish correlation inputs", () => {
    expect(workflowExists).toBe(true);

    expect(workflow).toMatch(/^on:\n {2}workflow_dispatch:\n/m);
    expect(workflow).not.toMatch(
      /^\s{2}(push|pull_request|schedule|workflow_call):/m,
    );
    expect(workflow).toMatch(
      /workflow_dispatch:\n {4}inputs:\n {6}publish_job_id:\n(?: {8}.+\n)+ {6}source_sha:/,
    );
    expect(workflow).toMatch(
      /publish_job_id:\n {8}description: .+\n {8}required: true\n {8}type: string/,
    );
    expect(workflow).toMatch(
      /source_sha:\n {8}description: .+\n {8}required: true\n {8}type: string/,
    );
    expect(workflow).toContain(
      "run-name: Deploy ${{ inputs.publish_job_id }} ${{ inputs.source_sha }}",
    );
  });

  it("validates a full commit SHA before checkout, install, or deploy", () => {
    const validationIndex = workflow.indexOf("- name: Validate source SHA");

    expect(validationIndex).toBeGreaterThan(-1);
    expect(workflow).toContain("SOURCE_SHA: ${{ inputs.source_sha }}");
    expect(workflow).toContain(
      '[[ ! "$SOURCE_SHA" =~ ^[0-9a-fA-F]{40}$ ]]',
    );

    for (const guardedStep of [
      "uses: actions/checkout@v4",
      "run: npm ci",
      "run: npm run deploy",
    ]) {
      const guardedStepIndex = workflow.indexOf(guardedStep);
      expect(guardedStepIndex).toBeGreaterThan(-1);
      expect(validationIndex).toBeLessThan(guardedStepIndex);
    }
  });

  it("checks out only the exact dispatched source SHA", () => {
    expect(workflow).toContain("uses: actions/checkout@v4");
    expect(workflow).toMatch(
      /uses: actions\/checkout@v4\n {8}with:\n {10}ref: \$\{\{ inputs\.source_sha \}\}/,
    );
    expect(workflow.match(/uses: actions\/checkout@v4/g) ?? []).toHaveLength(1);
    expect(
      [...workflow.matchAll(/^\s+ref:\s*(.+)$/gm)].map((match) => match[1]),
    ).toEqual(["${{ inputs.source_sha }}"]);
    expect(workflow).not.toMatch(
      /\$\{\{\s*github\.(?:ref|ref_name|sha)\s*\}\}/,
    );
  });

  it("uses the repository deployment script and required secrets", () => {
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
