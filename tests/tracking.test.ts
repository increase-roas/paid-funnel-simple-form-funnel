import { describe, expect, it } from "vitest";
import {
  buildBrowserAdvancedMatching,
  buildCapiPayload,
} from "../src/lib/tracking";
import type { EventRecord, FunnelSession } from "../src/types/funnel";

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

  it("uses system_generated only for explicitly marked offline lifecycle events", async () => {
    const websiteRecord: EventRecord = {
      eventId: "website-event",
      sessionId: session.sessionId,
      leadId: session.leadId,
      eventName: "Lead",
      source: "server",
      eventTime: 1_786_622_400,
      eventSourceUrl: session.firstUrl,
      sequence: 1,
      customData: {},
    };
    const offlineRecord: EventRecord = {
      ...websiteRecord,
      eventId: "offline-event",
      eventName: "QualifiedLead",
      capiActionSource: "system_generated",
    };
    const request = new Request(session.firstUrl);

    const offlinePayload = await buildCapiPayload(
      offlineRecord,
      session,
      request,
    );
    const websitePayload = await buildCapiPayload(
      websiteRecord,
      session,
      request,
    );

    expect(offlinePayload.data[0]?.action_source).toBe("system_generated");
    expect(websitePayload.data[0]?.action_source).toBe("website");
  });
});
