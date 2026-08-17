import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverLeadToGhl } from "../src/lib/lead-delivery";
import { funnelConfig } from "../src/lib/config";
import { dispatchServerEvent } from "../src/lib/tracking";
import { POST } from "../src/pages/api/funnel/[slug]/conversion";
import type { FunnelSession } from "../src/types/funnel";

vi.mock("../src/lib/tracking", () => ({
  dispatchServerEvent: vi.fn(async () => undefined),
}));

interface TestStatement {
  sql: string;
  params: unknown[];
  first<T>(): Promise<T | null>;
}

const leadUuid = "32c886da-4ac7-4cc0-9ee2-6785ae23d85f";
const legacyLeadId = "09b0d5ab-3a27-4c9b-8cbd-5d444875d031";
const originalFirstUrl =
  "https://example.com/lp/hot-tub-offer/step/1?utm_source=meta&fbclid=first-click";
const originalQueryString = "?utm_source=meta&fbclid=first-click";

const leadRow = {
  id: leadUuid,
  session_id: "b1daff95-0306-491f-8348-2725814ed6f1",
  status: "delivered",
  zip: "58701",
  first_name: "Alex",
  last_name: "Lobaito",
  phone_e164: "+17015550142",
  email_normalized: "alex@example.com",
  first_url: originalFirstUrl,
  original_query_string: originalQueryString,
  fbc: "fb.1.1786622400000.first-click",
  fbp: "fb.1.1786622400000.123456",
  city: "Minot",
  state: "ND",
  country: "US",
  ip_address: "203.0.113.42",
  user_agent: "Original Browser/1.0",
  created_at: "2026-08-13T12:00:00.000Z",
  updated_at: "2026-08-13T12:05:00.000Z",
};

class TestDatabase {
  readonly statements: TestStatement[] = [];
  readonly batches: TestStatement[][] = [];
  existingEventId: string | null = null;

  prepare(sql: string) {
    return {
      bind: (...params: unknown[]): TestStatement => {
        const statement: TestStatement = {
          sql,
          params,
          first: async <T>(): Promise<T | null> => {
            if (sql.includes("FROM downstream_conversions")) {
              return (this.existingEventId
                ? { event_id: this.existingEventId }
                : null) as unknown as T | null;
            }
            if (sql.includes("FROM leads")) return leadRow as unknown as T;
            return null;
          },
        };
        this.statements.push(statement);
        return statement;
      },
    };
  }

  async batch(statements: TestStatement[]): Promise<unknown[]> {
    this.batches.push(statements);
    return [];
  }
}

type TestRouteHandler = (context: {
  request: Request;
  params: { slug: string };
  locals: { cfContext: { waitUntil(promise: Promise<unknown>): void } };
}) => Promise<Response>;

const post = POST as unknown as TestRouteHandler;
const dispatchServerEventMock = vi.mocked(dispatchServerEvent);
const workerEnv = env as unknown as Record<string, unknown>;

function setWorkerEnv(database: TestDatabase): void {
  workerEnv.CRM_CALLBACK_SECRET = "callback-secret";
  workerEnv.FUNNEL_DB = database;
  workerEnv.ENVIRONMENT = "test";
  workerEnv.GHL_WEBHOOK_URL = "https://hooks.example.test/lead";
}

async function postConversion(
  database: TestDatabase,
  payload: Record<string, unknown>,
): Promise<Response> {
  setWorkerEnv(database);
  return await post({
    request: new Request(
      `https://example.com/api/funnel/${funnelConfig.funnel.slug}/conversion`,
      {
        method: "POST",
        headers: {
          authorization: "Bearer callback-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    ),
    params: { slug: funnelConfig.funnel.slug },
    locals: { cfContext: { waitUntil: vi.fn() } },
  });
}

beforeEach(() => {
  for (const key of Object.keys(workerEnv)) delete workerEnv[key];
  dispatchServerEventMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline conversion callback", () => {
  it.each([
    ["qualified", "QualifiedLead", 75],
    ["appointment", "Schedule", 300],
    ["show", "Showed", 600],
    ["sale", "Purchase", 1_250],
  ] as const)(
    "maps %s to %s and resolves value %s",
    async (stage, expectedEvent, expectedValue) => {
      const database = new TestDatabase();
      const response = await postConversion(database, {
        leadUuid,
        idempotencyKey: `crm-${stage}-001`,
        stage,
        ...(stage === "sale" ? { value: expectedValue } : {}),
      });

      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        accepted: true,
        duplicate: false,
        leadUuid,
      });
      expect(database.batches).toHaveLength(1);

      const [record, session, attributionRequest] =
        dispatchServerEventMock.mock.calls[0]!;
      expect(record).toMatchObject({
        leadId: leadUuid,
        eventName: expectedEvent,
        eventSourceUrl: originalFirstUrl,
        customData: {
          value: expectedValue,
          currency: "USD",
          lifecycle_stage: stage,
        },
      });
      expect(session).toMatchObject({
        leadId: leadUuid,
        firstUrl: originalFirstUrl,
        originalQueryString,
        fbc: leadRow.fbc,
        fbp: leadRow.fbp,
      });
      expect(attributionRequest.url).toBe(originalFirstUrl);
      expect(attributionRequest.headers.get("cf-connecting-ip")).toBe(
        leadRow.ip_address,
      );
      expect(attributionRequest.headers.get("user-agent")).toBe(
        leadRow.user_agent,
      );

      const leadLookup = database.statements.find((statement) =>
        statement.sql.includes("FROM leads"),
      );
      expect(leadLookup?.params).toEqual([
        leadUuid,
        funnelConfig.funnel.slug,
      ]);
    },
  );

  it("preserves an explicitly supplied nonnegative value before sale", async () => {
    const response = await postConversion(new TestDatabase(), {
      leadUuid,
      idempotencyKey: "crm-qualified-explicit-zero",
      stage: "qualified",
      value: 0,
    });

    expect(response.status).toBe(202);
    expect(dispatchServerEventMock.mock.calls[0]?.[0].customData.value).toBe(0);
  });

  it.each([undefined, 0])(
    "rejects sale without an explicit positive value (%s)",
    async (value) => {
      const payload: Record<string, unknown> = {
        leadUuid,
        idempotencyKey: "crm-sale-without-value",
        stage: "sale",
      };
      if (value !== undefined) payload.value = value;

      const response = await postConversion(new TestDatabase(), payload);

      expect(response.status).toBe(400);
      expect(dispatchServerEventMock).not.toHaveBeenCalled();
    },
  );

  it("accepts leadId only as a legacy alias for the stable leadUuid join", async () => {
    const database = new TestDatabase();
    const response = await postConversion(database, {
      leadId: legacyLeadId,
      idempotencyKey: "crm-legacy-lead-id",
      stage: "appointment",
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      leadUuid: legacyLeadId,
    });
    const leadLookup = database.statements.find((statement) =>
      statement.sql.includes("FROM leads"),
    );
    expect(leadLookup?.params[0]).toBe(legacyLeadId);
  });

  it("rejects conflicting canonical and legacy lead IDs", async () => {
    const database = new TestDatabase();
    const response = await postConversion(database, {
      leadUuid,
      leadId: legacyLeadId,
      idempotencyKey: "crm-conflicting-lead-ids",
      stage: "appointment",
    });

    expect(response.status).toBe(400);
    expect(database.statements).toHaveLength(0);
    expect(dispatchServerEventMock).not.toHaveBeenCalled();
  });

  it("returns the persisted event ID when idempotencyKey is a duplicate", async () => {
    const database = new TestDatabase();
    database.existingEventId = "persisted-meta-event-id";

    const response = await postConversion(database, {
      leadUuid,
      idempotencyKey: "crm-appointment-duplicate",
      stage: "appointment",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      duplicate: true,
      eventId: "persisted-meta-event-id",
      leadUuid,
    });
    expect(database.batches).toHaveLength(0);
    expect(dispatchServerEventMock).not.toHaveBeenCalled();
  });
});

describe("lead delivery payload", () => {
  it("sends canonical leadUuid while retaining legacy leadId", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    setWorkerEnv(new TestDatabase());

    const session: FunnelSession = {
      sessionId: leadRow.session_id,
      leadId: leadUuid,
      createdAt: leadRow.created_at,
      updatedAt: leadRow.updated_at,
      firstUrl: originalFirstUrl,
      originalQueryString,
      fbc: leadRow.fbc,
      fbp: leadRow.fbp,
      zip: leadRow.zip,
      geo: {
        city: leadRow.city,
        state: leadRow.state,
        country: leadRow.country,
        postalCode: leadRow.zip,
      },
      answers: {},
      contact: {
        firstName: leadRow.first_name,
        lastName: leadRow.last_name,
        phone: leadRow.phone_e164,
        email: leadRow.email_normalized,
      },
      eventCounts: {},
      completedStep: 2,
      leadStatus: "delivered",
    };

    await expect(deliverLeadToGhl(session)).resolves.toMatchObject({
      ok: true,
      status: 204,
    });

    const request = fetchMock.mock.calls[0]?.[1];
    expect(request).toBeDefined();
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      leadUuid,
      leadId: leadUuid,
    });
  });
});
