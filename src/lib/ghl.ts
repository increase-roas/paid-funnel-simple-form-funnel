export interface GhlContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  tags: string[];
  customFields: Record<string, string>;
}

export interface GhlResult {
  ok: boolean;
  status: number;
  contactId: string;
  detail: string;
}

export async function syncToGhl(
  config: { apiKey: string; locationId: string },
  contact: GhlContact,
  timeoutMs = 8_000,
): Promise<GhlResult> {
  const customFields = Object.entries(contact.customFields)
    .filter(([, value]) => value.length > 0)
    .map(([key, field_value]) => ({ key, field_value }));

  try {
    const response = await fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        version: "2021-07-28",
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        locationId: config.locationId,
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
        email: contact.email,
        phone: contact.phone,
        source: contact.source,
        tags: contact.tags,
        customFields,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        contactId: "",
        detail: `GHL delivery failed (HTTP ${response.status})`,
      };
    }
    let contactId = "";
    try {
      const data = JSON.parse(text) as { contact?: { id?: string }; id?: string };
      contactId = (data.contact?.id ?? data.id ?? "").trim();
    } catch {
      // A 2xx response without a usable contact ID is not a completed delivery.
    }
    if (!contactId) {
      return {
        ok: false,
        status: response.status,
        contactId: "",
        detail: "GHL response contained no contact ID",
      };
    }
    return { ok: true, status: response.status, contactId, detail: "" };
  } catch {
    return { ok: false, status: 0, contactId: "", detail: "GHL request failed" };
  }
}

export function buildGhlTags(input: { funnelSlug: string; productName?: string }): string[] {
  const tags = ["website-lead", `funnel-${input.funnelSlug}`];
  if (input.productName) tags.push(`model interest - ${input.productName}`);
  return tags.map((tag) => tag.toLowerCase().slice(0, 60));
}
