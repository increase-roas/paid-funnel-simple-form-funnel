import { describe, expect, it } from "vitest";
import { buildBrowserAdvancedMatching } from "../src/lib/tracking";
import type { FunnelSession } from "../src/types/funnel";

const session: FunnelSession = {
  sessionId: "b1daff95-0306-491f-8348-2725814ed6f1",
  leadId: "32c886da-4ac7-4cc0-9ee2-6785ae23d85f",
  createdAt: "2026-08-13T12:00:00.000Z",
  updatedAt: "2026-08-13T12:00:00.000Z",
  firstUrl: "https://example.com/lp/hot-tub-offer/step/1?fbclid=test",
  originalQueryString: "?fbclid=test",
  fbc: "fb.1.1786622400000.test",
  fbp: "fb.1.1786622400000.123456",
  zip: "58701",
  geo: { city: "Minot", state: "ND", country: "US", postalCode: "58701" },
  answers: {},
  contact: {
    firstName: "Alex",
    lastName: "Lobaito",
    phone: "+17015550142",
    email: "alex@example.com",
  },
  eventCounts: {},
  completedStep: 6,
  leadStatus: "delivered",
};

describe("progressive Meta advanced matching", () => {
  it("adds collected raw match keys without hashing in the browser", () => {
    expect(buildBrowserAdvancedMatching(session)).toEqual({
      external_id: session.sessionId,
      em: "alex@example.com",
      ph: "+17015550142",
      fn: "Alex",
      ln: "Lobaito",
      zp: "58701",
      ct: "Minot",
      st: "ND",
      country: "US",
    });
  });
});
