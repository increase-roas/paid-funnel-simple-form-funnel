import { describe, expect, it } from "vitest";
import {
  isDisposableEmail,
  normalizeEmail,
  normalizePhoneE164,
} from "../src/lib/validation";

describe("lead validation helpers", () => {
  it("normalizes a valid US phone to E.164", () => {
    expect(normalizePhoneE164("(701) 555-0142", "US")).toBe("+17015550142");
  });

  it("rejects an invalid phone number", () => {
    expect(normalizePhoneE164("123", "US")).toBeNull();
  });

  it("normalizes email casing and whitespace", () => {
    expect(normalizeEmail("  ALEX@Example.com ")).toBe("alex@example.com");
  });

  it("detects configured disposable email domains", () => {
    expect(isDisposableEmail("lead@mailinator.com")).toBe(true);
    expect(isDisposableEmail("lead@example.com")).toBe(false);
  });
});
