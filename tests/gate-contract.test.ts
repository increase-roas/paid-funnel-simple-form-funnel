import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasDuplicateLeadDetectionContract } from "../scripts/gate-contract";

const validationSource = readFileSync(
  resolve(import.meta.dirname, "../src/lib/validation.ts"),
  "utf8",
);

describe("duplicate lead detection build gate", () => {
  it("accepts the functional contract without depending on a function name", () => {
    expect(validationSource).not.toContain("isDuplicateLead");
    expect(hasDuplicateLeadDetectionContract(validationSource)).toBe(true);

    const renamedSource = validationSource.replaceAll(
      "findDuplicateLead",
      "lookupRecentLead",
    );
    expect(hasDuplicateLeadDetectionContract(renamedSource)).toBe(true);
  });

  it.each([
    "duplicateWindowHours",
    "status IN ('qualified', 'delivered')",
    "phone_e164 = ?",
    "email_normalized = ?",
    'duplicate.source !== "phone"',
    'code: "duplicate"',
    "mergeLeadId: duplicate.id",
  ])("rejects source missing %s", marker => {
    expect(validationSource).toContain(marker);
    expect(hasDuplicateLeadDetectionContract(validationSource.replace(marker, ""))).toBe(false);
  });
});
