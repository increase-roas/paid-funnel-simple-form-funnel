import type { APIRoute } from "astro";
import { z } from "zod";
import { getOrCreateFunnelSession, saveFunnelSession } from "../../../lib/session";
import {
  dispatchServerEvent,
  getTrackingEvent,
  markBrowserEventFired,
} from "../../../lib/tracking";

export const prerender = false;

const requestSchema = z.object({
  eventId: z.string().uuid(),
  triggerServer: z.boolean(),
  fbp: z.string().trim().max(200).optional(),
});

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return new Response("Bad request", { status: 400 });

  const session = await getOrCreateFunnelSession(request, cookies);
  const event = await getTrackingEvent(body.data.eventId, session.sessionId);
  if (!event) return new Response("Not found", { status: 404 });

  if (body.data.fbp && /^fb\.1\.\d+\.[A-Za-z0-9._-]+$/.test(body.data.fbp)) {
    session.fbp = session.fbp ?? body.data.fbp;
    await saveFunnelSession(session);
  }

  await markBrowserEventFired(event.eventId, session.sessionId);
  if (body.data.triggerServer) {
    locals.cfContext.waitUntil(dispatchServerEvent(event, session, request));
  }

  return new Response(null, { status: 202 });
};
