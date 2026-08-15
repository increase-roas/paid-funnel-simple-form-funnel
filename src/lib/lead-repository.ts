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
