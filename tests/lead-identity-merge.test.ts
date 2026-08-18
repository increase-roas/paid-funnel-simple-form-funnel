import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { funnelConfig } from "../src/lib/config";
import { mergeFormLeadIntoExistingIdentity } from "../src/lib/lead-repository";
import { validateFinalSubmission } from "../src/lib/validation";
import type { FunnelSession } from "../src/types/funnel";

interface TestStatement {
  sql: string;
  params: unknown[];
  first<T>(): Promise<T | null>;
}

class MergeDatabase {
  readonly batches: TestStatement[][] = [];

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]): TestStatement => ({
        sql,
        params,
        first: async <T>(): Promise<T | null> =>
          (sql.includes("SELECT id, source FROM leads")
            ? { id: "phone-lead-id", source: "phone" }
            : null) as unknown as T | null,
      }),
    };
  }

  async batch(statements: TestStatement[]): Promise<unknown[]> {
    this.batches.push(statements);
    return [];
  }
}

const workerEnv = env as unknown as Record<string, unknown>;

function formSession(): FunnelSession {
  const now = "2026-08-17T18:00:00.000Z";
  return {
    sessionId: "form-session-id",
    leadId: "partial-form-lead-id",
    createdAt: now,
    updatedAt: now,
    firstUrl: `https://example.com/lp/${funnelConfig.funnel.slug}/step/1`,
    originalQueryString: "?utm_source=meta",
    fbc: "fb.1.1786622400000.click",
    fbp: "fb.1.1786622400000.browser",
    zip: funnelConfig.serviceAreaZipCodes[0],
    geo: { city: "Minot", state: "ND", country: "US" },
    answers: Object.fromEntries(
      funnelConfig.surveyQuestions.map((question) => [
        question.id,
        question.type === "text" ? "answer" : question.options?.[0]?.value ?? "answer",
      ]),
    ),
    consent: {
      accepted: true,
      text: "I agree",
      version: "test",
      acceptedAt: now,
    },
    eventCounts: {},
    completedStep: 2,
  };
}

beforeEach(() => {
  for (const key of Object.keys(workerEnv)) delete workerEnv[key];
});

describe("bidirectional phone and form lead identity", () => {
  it("merges a later form submission into the existing phone identity", async () => {
    const database = new MergeDatabase();
    workerEnv.FUNNEL_DB = database;
    const session = formSession();

    const validation = await validateFinalSubmission({
      session,
      firstName: "Alex",
      lastName: "Lobaito",
      phone: "+1 (701) 555-0142",
      email: "Alex@Example.com",
      consentAccepted: true,
      honeypot: "",
    });

    expect(validation).toMatchObject({ ok: true, mergeLeadId: "phone-lead-id" });
    if (!validation.ok) throw new Error("Expected valid form submission.");
    session.contact = validation.contact;

    await mergeFormLeadIntoExistingIdentity(
      session,
      new Request("https://example.com/form", {
        headers: { "user-agent": "Merge Test/1.0", "cf-connecting-ip": "203.0.113.8" },
      }),
      validation.mergeLeadId!,
    );

    expect(database.batches).toHaveLength(1);
    const statements = database.batches[0]!;
    expect(statements).toHaveLength(5);
    expect(statements[0]?.sql).toContain("UPDATE leads SET session_id");
    expect(statements[1]?.sql).toContain("UPDATE tracking_events SET lead_id");
    expect(statements[2]?.sql).toContain("UPDATE downstream_conversions SET lead_id");
    expect(statements[3]?.sql).toContain("WHERE id = ? AND source = 'phone'");
    expect(statements[4]?.sql).toContain("DELETE FROM leads WHERE id = ?");
    expect(statements[3]?.params).toContain("form-session-id");
    expect(statements[3]?.params).toContain("+17015550142");
    expect(statements[3]?.params).toContain("alex@example.com");
    expect(statements[3]?.params.at(-1)).toBe("phone-lead-id");
    expect(statements[4]?.params).toEqual(["partial-form-lead-id"]);
  });
});
