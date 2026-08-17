import { env } from "cloudflare:workers";
import type {
  BrowserEventEnvelope,
  CapiPayload,
  CapiRetryMessage,
  EventRecord,
  FunnelSession,
  MetaServerEvent,
  MetaUserData,
} from "../types/funnel";
import { funnelConfig } from "./config";
import { getClientIp, saveFunnelSession } from "./session";

interface CapiSendResult {
  ok: boolean;
  status: number;
  error?: string;
}

function unixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function normalizePersonValue(value: string): string {
  return value.trim().toLowerCase().normalize("NFKC");
}

function normalizeLocationValue(value: string): string {
  return normalizePersonValue(value).replace(/[^a-z0-9]/g, "");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashOptional(
  value: string | undefined,
  normalizer: (value: string) => string = normalizePersonValue,
): Promise<string[] | undefined> {
  if (!value?.trim()) return undefined;
  return [await sha256(normalizer(value))];
}

export function buildBrowserAdvancedMatching(session: FunnelSession): Record<string, string> {
  const match: Record<string, string> = {
    external_id: session.sessionId,
  };

  if (session.contact?.email) match.em = session.contact.email;
  if (session.contact?.phone) match.ph = session.contact.phone;
  if (session.contact?.firstName) match.fn = session.contact.firstName;
  if (session.contact?.lastName) match.ln = session.contact.lastName;
  if (session.zip) match.zp = session.zip;
  if (session.geo.city) match.ct = session.geo.city;
  if (session.geo.state) match.st = session.geo.state;
  if (session.geo.country) match.country = session.geo.country;
  return match;
}

export async function premintTrackingEvent(
  session: FunnelSession,
  eventName: string,
  eventSourceUrl: string,
  customData: Record<string, unknown>,
): Promise<EventRecord> {
  const eventId = crypto.randomUUID();
  const eventTime = unixSeconds();
  const sequence = (session.eventCounts[eventName] ?? 0) + 1;
  const now = new Date().toISOString();

  await env.FUNNEL_DB.prepare(
    `INSERT INTO tracking_events (
      event_id, session_id, lead_id, event_name, source, event_time,
      event_source_url, sequence, custom_data_json, capi_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'both', ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      eventId,
      session.sessionId,
      session.leadId ?? null,
      eventName,
      eventTime,
      eventSourceUrl,
      sequence,
      JSON.stringify(customData),
      now,
      now,
    )
    .run();

  session.eventCounts[eventName] = sequence;
  await saveFunnelSession(session);

  return {
    eventId,
    sessionId: session.sessionId,
    leadId: session.leadId,
    eventName,
    source: "both",
    eventTime,
    eventSourceUrl,
    sequence,
    customData,
  };
}

export function toBrowserEnvelope(record: EventRecord): BrowserEventEnvelope {
  return {
    eventId: record.eventId,
    eventName: record.eventName,
    eventTime: record.eventTime,
    eventSourceUrl: record.eventSourceUrl,
    customData: record.customData,
  };
}

export async function getTrackingEvent(
  eventId: string,
  sessionId: string,
): Promise<EventRecord | null> {
  const row = await env.FUNNEL_DB.prepare(
    `SELECT event_id, session_id, lead_id, event_name, source, event_time,
            event_source_url, sequence, custom_data_json
     FROM tracking_events
     WHERE event_id = ? AND session_id = ?
     LIMIT 1`,
  )
    .bind(eventId, sessionId)
    .first<{
      event_id: string;
      session_id: string;
      lead_id: string | null;
      event_name: string;
      source: "browser" | "server" | "both";
      event_time: number;
      event_source_url: string;
      sequence: number;
      custom_data_json: string;
    }>();

  if (!row) return null;
  return {
    eventId: row.event_id,
    sessionId: row.session_id,
    leadId: row.lead_id ?? undefined,
    eventName: row.event_name,
    source: row.source,
    eventTime: row.event_time,
    eventSourceUrl: row.event_source_url,
    sequence: row.sequence,
    customData: JSON.parse(row.custom_data_json) as Record<string, unknown>,
  };
}

export async function markBrowserEventFired(eventId: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `UPDATE tracking_events
     SET browser_fired_at = COALESCE(browser_fired_at, ?), updated_at = ?
     WHERE event_id = ? AND session_id = ?`,
  )
    .bind(now, now, eventId, sessionId)
    .run();
}

export async function buildCapiPayload(
  record: EventRecord,
  session: FunnelSession,
  request: Request,
): Promise<CapiPayload> {
  const phone = session.contact?.phone?.replace(/\D/g, "");
  const userData: MetaUserData = {
    em: await hashOptional(session.contact?.email),
    ph: await hashOptional(phone),
    fn: await hashOptional(session.contact?.firstName),
    ln: await hashOptional(session.contact?.lastName),
    zp: await hashOptional(session.zip, normalizeLocationValue),
    ct: await hashOptional(session.geo.city, normalizeLocationValue),
    st: await hashOptional(session.geo.state, normalizeLocationValue),
    country: await hashOptional(session.geo.country, normalizeLocationValue),
    external_id: [await sha256(normalizePersonValue(session.sessionId))],
    client_ip_address: getClientIp(request),
    client_user_agent: request.headers.get("user-agent") ?? undefined,
    fbc: session.fbc,
    fbp: session.fbp,
  };

  for (const key of Object.keys(userData) as Array<keyof MetaUserData>) {
    if (userData[key] === undefined) delete userData[key];
  }

  const event: MetaServerEvent = {
    event_name: record.eventName,
    event_time: record.eventTime,
    event_id: record.eventId,
    event_source_url: record.eventSourceUrl,
    action_source: record.capiActionSource ?? "website",
    user_data: userData,
    custom_data: record.customData,
  };

  const payload: CapiPayload = { data: [event] };
  if (env.ENVIRONMENT !== "production" && env.META_TEST_EVENT_CODE) {
    payload.test_event_code = env.META_TEST_EVENT_CODE;
  }
  return payload;
}

export async function sendCapiPayload(payload: CapiPayload): Promise<CapiSendResult> {
  if (!env.META_CAPI_ACCESS_TOKEN) {
    return {
      ok: false,
      status: 0,
      error: "META_CAPI_ACCESS_TOKEN is not configured.",
    };
  }

  const endpoint = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${funnelConfig.meta.pixelId}/events`,
  );
  endpoint.searchParams.set("access_token", env.META_CAPI_ACCESS_TOKEN);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.ok) return { ok: true, status: response.status };
    const responseText = (await response.text()).slice(0, 1_000);
    return {
      ok: false,
      status: response.status,
      error: `Meta CAPI HTTP ${response.status}: ${responseText}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unknown Meta CAPI error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function updateCapiStatus(
  eventId: string,
  status: "sent" | "queued" | "failed" | "dropped" | "skipped",
  error?: string,
): Promise<void> {
  const now = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `UPDATE tracking_events SET
      capi_status = ?,
      capi_attempts = capi_attempts + 1,
      capi_last_error = ?,
      server_fired_at = CASE WHEN ? = 'sent' THEN COALESCE(server_fired_at, ?) ELSE server_fired_at END,
      updated_at = ?
    WHERE event_id = ?`,
  )
    .bind(status, error ?? null, status, now, now, eventId)
    .run();
}

export async function dispatchServerEvent(
  record: EventRecord,
  session: FunnelSession,
  request: Request,
): Promise<void> {
  const payload = await buildCapiPayload(record, session, request);

  if (!env.META_CAPI_ACCESS_TOKEN && env.ENVIRONMENT !== "production") {
    await updateCapiStatus(record.eventId, "skipped", "Local development: no CAPI token configured.");
    return;
  }

  const result = await sendCapiPayload(payload);
  if (result.ok) {
    await updateCapiStatus(record.eventId, "sent");
    return;
  }

  await updateCapiStatus(record.eventId, "queued", result.error);
  const retryMessage: CapiRetryMessage = {
    createdAt: new Date().toISOString(),
    eventId: record.eventId,
    payload,
  };
  await env.CAPI_RETRY_QUEUE.send(retryMessage);
}
