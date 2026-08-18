import { env } from "cloudflare:workers";
import type { FunnelSession } from "../types/funnel";
import { funnelConfig } from "./config";
import { getClientIp } from "./session";

export async function ensureLeadRecord(session: FunnelSession, request: Request): Promise<string> {
  const now = new Date().toISOString();
  const leadId = session.leadId ?? crypto.randomUUID();

  await env.FUNNEL_DB.prepare(
    `INSERT INTO leads (
      id, session_id, funnel_slug, status, zip, answers_json,
      first_url, original_query_string, fbc, fbp, city, state, country,
      ip_address, user_agent, conversion_value, created_at, updated_at
    ) VALUES (?, ?, ?, 'partial', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      zip = excluded.zip,
      answers_json = excluded.answers_json,
      fbc = COALESCE(leads.fbc, excluded.fbc),
      fbp = COALESCE(leads.fbp, excluded.fbp),
      city = COALESCE(leads.city, excluded.city),
      state = COALESCE(leads.state, excluded.state),
      country = COALESCE(leads.country, excluded.country),
      conversion_value = excluded.conversion_value,
      updated_at = excluded.updated_at`,
  )
    .bind(
      leadId,
      session.sessionId,
      funnelConfig.funnel.slug,
      session.zip ?? null,
      JSON.stringify(session.answers),
      session.firstUrl,
      session.originalQueryString,
      session.fbc ?? null,
      session.fbp ?? null,
      session.geo.city ?? null,
      session.geo.state ?? null,
      session.geo.country ?? null,
      getClientIp(request) ?? null,
      request.headers.get("user-agent"),
      session.conversionValue ?? funnelConfig.meta.defaultConversionValue,
      session.createdAt,
      now,
    )
    .run();

  return leadId;
}

export async function syncPartialLead(session: FunnelSession, request: Request): Promise<void> {
  if (!session.leadId) return;

  await env.FUNNEL_DB.prepare(
    `UPDATE leads SET
      zip = ?,
      answers_json = ?,
      first_name = ?,
      last_name = ?,
      phone_raw = ?,
      email_raw = ?,
      consent_json = ?,
      fbc = COALESCE(fbc, ?),
      fbp = COALESCE(fbp, ?),
      city = COALESCE(city, ?),
      state = COALESCE(state, ?),
      country = COALESCE(country, ?),
      ip_address = COALESCE(ip_address, ?),
      user_agent = COALESCE(user_agent, ?),
      conversion_value = ?,
      updated_at = ?
    WHERE id = ?`,
  )
    .bind(
      session.zip ?? null,
      JSON.stringify(session.answers),
      session.contact?.firstName ?? null,
      session.contact?.lastName ?? null,
      session.contact?.phone ?? null,
      session.contact?.email ?? null,
      session.consent ? JSON.stringify(session.consent) : null,
      session.fbc ?? null,
      session.fbp ?? null,
      session.geo.city ?? null,
      session.geo.state ?? null,
      session.geo.country ?? null,
      getClientIp(request) ?? null,
      request.headers.get("user-agent"),
      session.conversionValue ?? funnelConfig.meta.defaultConversionValue,
      new Date().toISOString(),
      session.leadId,
    )
    .run();
}

export async function updateValidatedContact(session: FunnelSession): Promise<void> {
  if (!session.leadId || !session.contact) return;

  await env.FUNNEL_DB.prepare(
    `UPDATE leads SET
      first_name = ?,
      last_name = ?,
      phone_raw = ?,
      phone_e164 = ?,
      email_raw = ?,
      email_normalized = ?,
      consent_json = ?,
      conversion_value = ?,
      updated_at = ?
    WHERE id = ?`,
  )
    .bind(
      session.contact.firstName,
      session.contact.lastName,
      session.contact.phone,
      session.contact.phone,
      session.contact.email,
      session.contact.email,
      session.consent ? JSON.stringify(session.consent) : null,
      session.conversionValue ?? funnelConfig.meta.defaultConversionValue,
      new Date().toISOString(),
      session.leadId,
    )
    .run();
}

export async function mergeFormLeadIntoExistingIdentity(
  session: FunnelSession,
  request: Request,
  existingLeadId: string,
): Promise<void> {
  if (!session.leadId || !session.contact || session.leadId === existingLeadId) return;

  const partialLeadId = session.leadId;
  const now = new Date().toISOString();
  const parkedSessionId = `merged:${partialLeadId}`;

  await env.FUNNEL_DB.batch([
    env.FUNNEL_DB.prepare(
      "UPDATE leads SET session_id = ?, updated_at = ? WHERE id = ?",
    ).bind(parkedSessionId, now, partialLeadId),
    env.FUNNEL_DB.prepare(
      "UPDATE tracking_events SET lead_id = ?, session_id = ? WHERE lead_id = ?",
    ).bind(existingLeadId, session.sessionId, partialLeadId),
    env.FUNNEL_DB.prepare(
      "UPDATE downstream_conversions SET lead_id = ? WHERE lead_id = ?",
    ).bind(existingLeadId, partialLeadId),
    env.FUNNEL_DB.prepare(
      `UPDATE leads SET
        session_id = ?,
        funnel_slug = ?,
        status = 'qualified',
        zip = ?,
        answers_json = ?,
        first_name = ?,
        last_name = ?,
        phone_raw = ?,
        phone_e164 = ?,
        email_raw = ?,
        email_normalized = ?,
        consent_json = ?,
        first_url = ?,
        original_query_string = ?,
        fbc = COALESCE(fbc, ?),
        fbp = COALESCE(fbp, ?),
        city = COALESCE(city, ?),
        state = COALESCE(state, ?),
        country = COALESCE(country, ?),
        ip_address = COALESCE(ip_address, ?),
        user_agent = COALESCE(user_agent, ?),
        conversion_value = ?,
        completed_at = COALESCE(completed_at, ?),
        updated_at = ?
      WHERE id = ? AND source = 'phone'`,
    ).bind(
      session.sessionId,
      funnelConfig.funnel.slug,
      session.zip ?? null,
      JSON.stringify(session.answers),
      session.contact.firstName,
      session.contact.lastName,
      session.contact.phone,
      session.contact.phone,
      session.contact.email,
      session.contact.email,
      session.consent ? JSON.stringify(session.consent) : null,
      session.firstUrl,
      session.originalQueryString,
      session.fbc ?? null,
      session.fbp ?? null,
      session.geo.city ?? null,
      session.geo.state ?? null,
      session.geo.country ?? null,
      getClientIp(request) ?? null,
      request.headers.get("user-agent"),
      session.conversionValue ?? funnelConfig.meta.defaultConversionValue,
      now,
      now,
      existingLeadId,
    ),
    env.FUNNEL_DB.prepare("DELETE FROM leads WHERE id = ?").bind(partialLeadId),
  ]);
}

export async function markLeadStatus(
  leadId: string,
  status: "qualified" | "duplicate" | "rejected" | "delivered",
  details: { conversionEventId?: string; deliveredAt?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `UPDATE leads SET
      status = ?,
      conversion_event_id = COALESCE(?, conversion_event_id),
      completed_at = CASE WHEN ? = 'qualified' THEN COALESCE(completed_at, ?) ELSE completed_at END,
      delivered_to_ghl_at = COALESCE(?, delivered_to_ghl_at),
      updated_at = ?
    WHERE id = ?`,
  )
    .bind(
      status,
      details.conversionEventId ?? null,
      status,
      now,
      details.deliveredAt ?? null,
      now,
      leadId,
    )
    .run();
}

export async function recordLeadDelivery(
  leadId: string,
  result: {
    ghlContactId?: string;
    ghlStatus: "sent" | "failed" | "unconfigured";
    ghlError?: string;
    vaultStatus: "sent" | "failed" | "unconfigured";
    vaultError?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `UPDATE leads SET
      ghl_contact_id = COALESCE(?, ghl_contact_id),
      ghl_status = ?,
      ghl_error = ?,
      delivered_to_ghl_at = CASE WHEN ? = 'sent' THEN COALESCE(delivered_to_ghl_at, ?) ELSE delivered_to_ghl_at END,
      vault_status = ?,
      vault_error = ?,
      vault_synced_at = CASE WHEN ? = 'sent' THEN ? ELSE vault_synced_at END,
      updated_at = ?
    WHERE id = ?`,
  )
    .bind(
      result.ghlContactId || null,
      result.ghlStatus,
      result.ghlError?.slice(0, 300) ?? null,
      result.ghlStatus,
      now,
      result.vaultStatus,
      result.vaultError?.slice(0, 300) ?? null,
      result.vaultStatus,
      now,
      now,
      leadId,
    )
    .run();
}

export async function findRecentLeadByIdentity(input: {
  phoneE164: string;
  emailNormalized: string;
  now?: Date;
}): Promise<{ id: string } | null> {
  const cutoff = new Date((input.now ?? new Date()).getTime() - 24 * 60 * 60 * 1_000).toISOString();
  if (!input.phoneE164 && !input.emailNormalized) return null;
  const row = await env.FUNNEL_DB.prepare(
    `SELECT id FROM leads
     WHERE created_at >= ?
       AND ((? <> '' AND phone_e164 = ?) OR (? <> '' AND email_normalized = ?))
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(cutoff, input.phoneE164, input.phoneE164, input.emailNormalized, input.emailNormalized)
    .first<{ id: string }>();
  return row ?? null;
}

export async function createPhoneLead(input: {
  firstName: string;
  lastName: string;
  phoneRaw: string;
  phoneE164: string;
  emailRaw: string;
  emailNormalized: string;
  ghlContactId: string;
  callId: string;
  request: Request;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `INSERT INTO leads (
      id, session_id, funnel_slug, status, source, first_name, last_name,
      phone_raw, phone_e164, email_raw, email_normalized, answers_json,
      first_url, original_query_string, ip_address, user_agent,
      ghl_contact_id, ghl_status, delivered_to_ghl_at, created_at, updated_at
    ) VALUES (?, ?, ?, 'qualified', 'phone', ?, ?, ?, ?, ?, ?, '{}',
      'phone', '', ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id, `phone:${id}`, funnelConfig.funnel.slug,
      input.firstName || null, input.lastName || null,
      input.phoneRaw, input.phoneE164, input.emailRaw || null, input.emailNormalized || null,
      getClientIp(input.request) ?? null, input.request.headers.get("user-agent"),
      input.ghlContactId || null, input.ghlContactId ? "sent" : "unconfigured",
      input.ghlContactId ? now : null, now, now,
    )
    .run();
  return id;
}
