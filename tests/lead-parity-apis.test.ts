import { env } from "cloudflare:workers";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPhoneLead: vi.fn(),
  findRecentLeadByIdentity: vi.fn(),
  recordLeadDelivery: vi.fn(),
  upsertAllLeads: vi.fn(),
}));

vi.mock("../src/lib/lead-repository", () => ({
  createPhoneLead: mocks.createPhoneLead,
  findRecentLeadByIdentity: mocks.findRecentLeadByIdentity,
  recordLeadDelivery: mocks.recordLeadDelivery,
}));

vi.mock("../src/lib/sheets", () => ({
  upsertAllLeads: mocks.upsertAllLeads,
}));

import { POST } from "../src/pages/api/phone-lead";

type PhoneRoute = (context: {
  request: Request;
  locals: { cfContext: { waitUntil(promise: Promise<unknown>): void } };
}) => Promise<Response>;

const post = POST as unknown as PhoneRoute;
const workerEnv = env as unknown as Record<string, unknown>;

function setEnvironment(): void {
  workerEnv.STAGE_WEBHOOK_SECRET = "stage-secret";
  workerEnv.GOOGLE_SHEETS_ID = "sheet-id";
  workerEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL = "vault@example.test";
  workerEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "private-key";
}

function phoneRequest(body: Record<string, unknown>): Request {
  return new Request("https://example.com/api/phone-lead", {
    method: "POST",
    headers: {
      authorization: "Bearer stage-secret",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  for (const key of Object.keys(workerEnv)) delete workerEnv[key];
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.recordLeadDelivery.mockResolvedValue(undefined);
  mocks.upsertAllLeads.mockResolvedValue(undefined);
  setEnvironment();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("phone and form lead identity", () => {
  it("returns the existing UUID instead of creating a duplicate phone lead", async () => {
    mocks.findRecentLeadByIdentity.mockResolvedValue({ id: "existing-form-lead" });

    const response = await post({
      request: phoneRequest({ phone: "+1 (701) 555-0142", email: "Alex@Example.com" }),
      locals: { cfContext: { waitUntil: vi.fn() } },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      leadUuid: "existing-form-lead",
      existing: true,
    });
    expect(mocks.findRecentLeadByIdentity).toHaveBeenCalledWith({
      phoneE164: "+17015550142",
      emailNormalized: "alex@example.com",
    });
    expect(mocks.createPhoneLead).not.toHaveBeenCalled();
    expect(mocks.upsertAllLeads).not.toHaveBeenCalled();
  });

  it("persists D1 before starting the Google Sheets write", async () => {
    const order: string[] = [];
    mocks.findRecentLeadByIdentity.mockResolvedValue(null);
    mocks.createPhoneLead.mockImplementation(async () => {
      order.push("d1");
      return "new-phone-lead";
    });
    mocks.upsertAllLeads.mockImplementation(async () => {
      order.push("sheets");
    });
    const background: Promise<unknown>[] = [];

    const response = await post({
      request: phoneRequest({
        firstName: "Alex",
        lastName: "Lobaito",
        phone: "+1 701 555 0142",
        ghlContactId: "ghl-123",
      }),
      locals: { cfContext: { waitUntil: (promise) => background.push(promise) } },
    });
    await Promise.all(background);

    expect(response.status).toBe(200);
    expect(order).toEqual(["d1", "sheets"]);
    expect(mocks.upsertAllLeads).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ leadUuid: "new-phone-lead", ghlContactId: "ghl-123" }),
    );
  });
});

describe("form submission ordering", () => {
  it("writes the validated contact to D1 before direct GHL delivery", () => {
    const source = readFileSync(
      new URL("../src/pages/api/funnel/[slug]/step/[n].ts", import.meta.url),
      "utf8",
    );
    const persist = source.indexOf("await updateValidatedContact(session)");
    const deliver = source.indexOf("await deliverLeadToGhl(session)");

    expect(persist).toBeGreaterThan(-1);
    expect(deliver).toBeGreaterThan(persist);
  });
});
