import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createPhoneLead, findRecentLeadByIdentity, recordLeadDelivery } from "../../lib/lead-repository";
import { upsertAllLeads, type SheetsConfig } from "../../lib/sheets";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function cleanMergeValue(value: unknown, limit: number): string {
  const text = typeof value === "string" ? value.trim().slice(0, limit) : "";
  return /^(?:null|undefined)$/i.test(text) ? "" : text;
}

async function secretsMatch(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

function sheetsConfig(): SheetsConfig | null {
  if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) return null;
  return {
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env.STAGE_WEBHOOK_SECRET) return json({ ok: false, error: "Phone lead webhook is not configured." }, 503);
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token || !(await secretsMatch(token, env.STAGE_WEBHOOK_SECRET))) return json({ ok: false, error: "Unauthorized." }, 401);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return json({ ok: false, error: "Invalid JSON." }, 400); }

  const phoneRaw = cleanMergeValue(body.phone, 40);
  const digits = phoneRaw.replace(/\D/g, "");
  if (digits.length < 10) return json({ ok: false, error: "phone with at least 10 digits is required." }, 400);
  const phoneE164 = `+${digits}`;
  const emailRaw = cleanMergeValue(body.email, 200).toLowerCase();
  const emailNormalized = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : "";
  const prior = await findRecentLeadByIdentity({ phoneE164, emailNormalized });
  if (prior) return json({ ok: true, leadUuid: prior.id, existing: true });

  const firstName = cleanMergeValue(body.firstName, 100);
  const lastName = cleanMergeValue(body.lastName, 100);
  const ghlContactId = cleanMergeValue(body.ghlContactId, 80);
  const callId = cleanMergeValue(body.callId, 120);
  const leadId = await createPhoneLead({ firstName, lastName, phoneRaw, phoneE164, emailRaw, emailNormalized, ghlContactId, callId, request });

  const vaultTask = (async () => {
    const config = sheetsConfig();
    if (!config) {
      await recordLeadDelivery(leadId, { ghlContactId, ghlStatus: ghlContactId ? "sent" : "unconfigured", vaultStatus: "unconfigured" });
      return;
    }
    try {
      await upsertAllLeads(config, {
        leadUuid: leadId, createdAt: new Date().toISOString(), firstName, lastName,
        email: emailNormalized, phone: phoneE164, zip: "", source: "Phone", ghlContactId,
        answersJson: callId ? JSON.stringify({ callId }) : "{}", firstUrl: "phone", originalQueryString: "",
      });
      await recordLeadDelivery(leadId, { ghlContactId, ghlStatus: ghlContactId ? "sent" : "unconfigured", vaultStatus: "sent" });
    } catch (error) {
      await recordLeadDelivery(leadId, {
        ghlContactId, ghlStatus: ghlContactId ? "sent" : "unconfigured", vaultStatus: "failed",
        vaultError: error instanceof Error ? error.message : "Lead-vault request failed",
      });
    }
  })();
  locals.cfContext?.waitUntil?.(vaultTask);
  return json({ ok: true, leadUuid: leadId, existing: false });
};
