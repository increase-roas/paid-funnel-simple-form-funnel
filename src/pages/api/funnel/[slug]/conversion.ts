import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { funnelConfig, isKnownSlug } from "../../../../lib/config";
import { dispatchServerEvent } from "../../../../lib/tracking";
import type { EventRecord, FunnelSession } from "../../../../types/funnel";

export const prerender = false;

const callbackSchema = z
  .object({
    leadUuid: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    idempotencyKey: z.string().trim().min(6).max(160),
    stage: z.enum(["qualified", "appointment", "show", "sale"]),
    value: z.number().finite().nonnegative().optional(),
    currency: z.string().length(3).default("USD"),
    occurredAt: z.string().datetime().optional(),
  })
  .superRefine((input, context) => {
    if (!input.leadUuid && !input.leadId) {
      context.addIssue({
        code: "custom",
        path: ["leadUuid"],
        message: "leadUuid is required",
      });
    }
    if (input.leadUuid && input.leadId && input.leadUuid !== input.leadId) {
      context.addIssue({
        code: "custom",
        path: ["leadId"],
        message: "leadId must match leadUuid when both are provided",
      });
    }
    if (input.stage === "sale" && (input.value === undefined || input.value <= 0)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "sale requires an explicit positive value",
      });
    }
  });

const stageDefinitions = {
  qualified: { eventName: "QualifiedLead", defaultValue: 75 },
  appointment: { eventName: "Schedule", defaultValue: 300 },
  show: { eventName: "Showed", defaultValue: 600 },
  sale: { eventName: "Purchase", defaultValue: null },
} as const;

async function safeSecretEquals(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

export async function handleConversion(
  { request, params, locals }: Parameters<APIRoute>[0],
  callbackSecret: string | undefined,
): Promise<Response> {
  if (!isKnownSlug(params.slug)) return new Response("Not found", { status: 404 });
  if (!callbackSecret) return new Response("Callback is not configured", { status: 503 });

  const authorization = request.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!(await safeSecretEquals(providedSecret, callbackSecret))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const input = callbackSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return Response.json({ error: "Invalid callback payload", issues: input.error.issues }, { status: 400 });
  }
  const leadUuid = input.data.leadUuid ?? input.data.leadId!;

  const duplicateResponse = (eventId: string): Response => Response.json({
    accepted: true,
    duplicate: true,
    eventId,
    leadUuid,
  });

  const existing = await env.FUNNEL_DB.prepare(
    "SELECT event_id FROM downstream_conversions WHERE external_id = ? LIMIT 1",
  )
    .bind(input.data.idempotencyKey)
    .first<{ event_id: string }>();
  if (existing) {
    return duplicateResponse(existing.event_id);
  }

  const lead = await env.FUNNEL_DB.prepare(
    `SELECT id, session_id, status, zip, first_name, last_name, phone_e164,
            email_normalized, first_url, original_query_string, fbc, fbp,
            city, state, country, ip_address, user_agent, created_at, updated_at
     FROM leads WHERE id = ? AND funnel_slug = ? LIMIT 1`,
  )
    .bind(leadUuid, funnelConfig.funnel.slug)
    .first<{
      id: string;
      session_id: string;
      status: string;
      zip: string | null;
      first_name: string | null;
      last_name: string | null;
      phone_e164: string | null;
      email_normalized: string | null;
      first_url: string;
      original_query_string: string;
      fbc: string | null;
      fbp: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
      updated_at: string;
    }>();

  if (!lead || !["qualified", "delivered"].includes(lead.status)) {
    return new Response("Lead not found or not eligible", { status: 404 });
  }

  const eventTime = Math.floor(Date.parse(input.data.occurredAt ?? new Date().toISOString()) / 1000);
  if (!Number.isFinite(eventTime) || eventTime < Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60) {
    return new Response("occurredAt must be within the last seven days", { status: 400 });
  }

  const eventId = crypto.randomUUID();
  const databaseId = crypto.randomUUID();
  const stageDefinition = stageDefinitions[input.data.stage];
  const eventName = stageDefinition.eventName;
  const conversionValue = input.data.value ?? stageDefinition.defaultValue;
  if (conversionValue === null) {
    return new Response("sale requires an explicit positive value", { status: 400 });
  }
  const now = new Date().toISOString();
  const customData = {
    value: conversionValue,
    currency: input.data.currency.toUpperCase(),
    funnel_slug: funnelConfig.funnel.slug,
    lifecycle_stage: input.data.stage,
  };

  try {
    await env.FUNNEL_DB.batch([
      env.FUNNEL_DB.prepare(
        `INSERT INTO downstream_conversions (
          id, external_id, lead_id, stage, value, event_id, occurred_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        databaseId,
        input.data.idempotencyKey,
        lead.id,
        input.data.stage,
        conversionValue,
        eventId,
        new Date(eventTime * 1_000).toISOString(),
        now,
      ),
      env.FUNNEL_DB.prepare(
        `INSERT INTO tracking_events (
          event_id, session_id, lead_id, event_name, source, event_time,
          event_source_url, sequence, custom_data_json, capi_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'server', ?, ?, 1, ?, 'pending', ?, ?)`,
      ).bind(
        eventId,
        lead.session_id,
        lead.id,
        eventName,
        eventTime,
        lead.first_url,
        JSON.stringify(customData),
        now,
        now,
      ),
    ]);
  } catch (error) {
    const concurrent = await env.FUNNEL_DB.prepare(
      "SELECT event_id FROM downstream_conversions WHERE external_id = ? LIMIT 1",
    )
      .bind(input.data.idempotencyKey)
      .first<{ event_id: string }>();
    if (concurrent) return duplicateResponse(concurrent.event_id);
    throw error;
  }

  const session: FunnelSession = {
    sessionId: lead.session_id,
    leadId: lead.id,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
    firstUrl: lead.first_url,
    originalQueryString: lead.original_query_string,
    fbc: lead.fbc ?? undefined,
    fbp: lead.fbp ?? undefined,
    zip: lead.zip ?? undefined,
    geo: {
      city: lead.city ?? undefined,
      state: lead.state ?? undefined,
      country: lead.country ?? undefined,
      postalCode: lead.zip ?? undefined,
    },
    answers: {},
    contact: {
      firstName: lead.first_name ?? "",
      lastName: lead.last_name ?? "",
      phone: lead.phone_e164 ?? "",
      email: lead.email_normalized ?? "",
    },
    eventCounts: { [eventName]: 1 },
    completedStep: 0,
    leadStatus: "delivered",
  };

  const record: EventRecord = {
    eventId,
    sessionId: lead.session_id,
    leadId: lead.id,
    eventName,
    source: "server",
    eventTime,
    eventSourceUrl: lead.first_url,
    sequence: 1,
    customData,
    capiActionSource: "system_generated",
  };

  const originalHeaders = new Headers();
  if (lead.ip_address) originalHeaders.set("cf-connecting-ip", lead.ip_address);
  if (lead.user_agent) originalHeaders.set("user-agent", lead.user_agent);
  const attributionRequest = new Request(lead.first_url, { headers: originalHeaders });
  locals.cfContext.waitUntil(dispatchServerEvent(record, session, attributionRequest));

  return Response.json(
    { accepted: true, duplicate: false, eventId, leadUuid },
    { status: 202 },
  );
}

export const POST: APIRoute = context => handleConversion(context, env.CRM_CALLBACK_SECRET);
