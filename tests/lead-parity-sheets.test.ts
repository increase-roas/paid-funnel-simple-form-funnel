import { afterEach, describe, expect, it, vi } from "vitest";
import { syncToGhl } from "../src/lib/ghl";
import {
  appendMissedLead,
  upsertAllLeads,
  type SheetsConfig,
  type VaultLead,
} from "../src/lib/sheets";

const config: SheetsConfig = {
  spreadsheetId: "sheet-id",
  serviceAccountEmail: "vault@example.test",
  privateKey: "-----BEGIN PRIVATE KEY-----\\nAA==\\n-----END PRIVATE KEY-----",
};

const lead: VaultLead = {
  leadUuid: "lead-uuid",
  createdAt: "2026-08-17T12:00:00.000Z",
  firstName: "Alex",
  lastName: "Lobaito",
  email: "alex@example.com",
  phone: "+17015550142",
  zip: "58701",
  source: "Paid Ads Funnel",
  ghlContactId: "ghl-contact",
  answersJson: "{}",
  firstUrl: "https://example.com/lp/offer/step/1",
  originalQueryString: "?utm_source=meta",
};

function mockSigning(): void {
  vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
  vi.spyOn(crypto.subtle, "sign").mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Google Sheets lead vault", () => {
  it("imports the exact decoded PKCS8 bytes from an ArrayBuffer", async () => {
    const importKey = vi.spyOn(crypto.subtle, "importKey").mockResolvedValue({} as CryptoKey);
    vi.spyOn(crypto.subtle, "sign").mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ values: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await upsertAllLeads(
      {
        ...config,
        privateKey: "-----BEGIN PRIVATE KEY-----\\nAAECA/8=\\n-----END PRIVATE KEY-----",
      },
      lead,
    );

    const keyData = importKey.mock.calls[0]?.[1];
    expect(keyData).toBeInstanceOf(ArrayBuffer);
    if (!(keyData instanceof ArrayBuffer)) throw new Error("Expected PKCS8 key data to be an ArrayBuffer");
    expect(Array.from(new Uint8Array(keyData))).toEqual([0, 1, 2, 3, 255]);
  });

  it("upserts All Leads by stable UUID", async () => {
    mockSigning();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [["lead_uuid"], ["other"], [lead.leadUuid]] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await upsertAllLeads(config, lead);

    const [writeUrl, writeInit] = fetchMock.mock.calls[3]!;
    expect(String(writeUrl)).toContain("'All%20Leads'!A3%3AL3");
    expect(writeInit?.method).toBe("PUT");
    expect(JSON.parse(String(writeInit?.body))).toEqual({ values: [expect.arrayContaining([lead.leadUuid])] });
  });

  it("upserts failed CRM delivery in Missed Leads by stable UUID", async () => {
    mockSigning();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ values: [["lead_uuid"], ["other"], [lead.leadUuid]] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await appendMissedLead(config, lead, "GHL delivery failed");

    const [writeUrl, writeInit] = fetchMock.mock.calls[3]!;
    expect(String(writeUrl)).toContain("'Missed%20Leads'!A3%3AM3");
    expect(writeInit?.method).toBe("PUT");
    expect(String(writeInit?.body)).toContain(lead.leadUuid);
  });
});

describe("secret-safe GHL errors", () => {
  it("does not return the remote body or API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("remote-fake-secret", { status: 500 })),
    );

    const result = await syncToGhl(
      { apiKey: "ghl-fake-secret", locationId: "location" },
      {
        firstName: "Alex",
        lastName: "Lobaito",
        email: "alex@example.com",
        phone: "+17015550142",
        source: "Paid Ads Funnel",
        tags: ["website-lead"],
        customFields: { lead_uuid: lead.leadUuid },
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 500,
      contactId: "",
      detail: "GHL delivery failed (HTTP 500)",
    });
    expect(JSON.stringify(result)).not.toContain("fake-secret");
  });

  it("rejects a successful HTTP response that has no contact ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ contact: {} }), { status: 200 })),
    );

    const result = await syncToGhl(
      { apiKey: "ghl-fake-secret", locationId: "location" },
      {
        firstName: "Alex",
        lastName: "Lobaito",
        email: "alex@example.com",
        phone: "+17015550142",
        source: "Paid Ads Funnel",
        tags: ["website-lead"],
        customFields: { lead_uuid: lead.leadUuid },
      },
    );

    expect(result).toEqual({
      ok: false,
      status: 200,
      contactId: "",
      detail: "GHL response contained no contact ID",
    });
  });
});
