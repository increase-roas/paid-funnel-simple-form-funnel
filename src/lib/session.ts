import type { AstroCookies } from "astro";
import { env } from "cloudflare:workers";
import type { FunnelSession, GeoSnapshot } from "../types/funnel";

const SESSION_COOKIE = "pf_sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getRequestGeo(request: Request): GeoSnapshot {
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  if (!cf) return {};

  return {
    city: typeof cf.city === "string" ? cf.city : undefined,
    state: typeof cf.regionCode === "string"
      ? cf.regionCode
      : typeof cf.region === "string"
        ? cf.region
        : undefined,
    postalCode: typeof cf.postalCode === "string" ? cf.postalCode : undefined,
    country: typeof cf.country === "string" ? cf.country : undefined,
    latitude: typeof cf.latitude === "string" ? cf.latitude : undefined,
    longitude: typeof cf.longitude === "string" ? cf.longitude : undefined,
  };
}

function buildFirstTouchFbc(url: URL, cookies: AstroCookies): string | undefined {
  const existingFbc = cookies.get("_fbc")?.value;
  if (existingFbc) return existingFbc;

  const fbclid = url.searchParams.get("fbclid");
  if (!fbclid) return undefined;
  return `fb.1.${Date.now()}.${fbclid}`;
}

function mergeGeo(current: GeoSnapshot, incoming: GeoSnapshot): GeoSnapshot {
  return {
    city: current.city ?? incoming.city,
    state: current.state ?? incoming.state,
    postalCode: current.postalCode ?? incoming.postalCode,
    country: current.country ?? incoming.country,
    latitude: current.latitude ?? incoming.latitude,
    longitude: current.longitude ?? incoming.longitude,
  };
}

export async function getOrCreateFunnelSession(
  request: Request,
  cookies: AstroCookies,
): Promise<FunnelSession> {
  const url = new URL(request.url);
  const sessionId = cookies.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    const existing = await env.FUNNEL_SESSIONS.get<FunnelSession>(`session:${sessionId}`, "json");
    if (existing) {
      const requestGeo = getRequestGeo(request);
      const updated: FunnelSession = {
        ...existing,
        fbc: existing.fbc ?? buildFirstTouchFbc(url, cookies),
        fbp: existing.fbp ?? cookies.get("_fbp")?.value,
        geo: mergeGeo(existing.geo, requestGeo),
      };
      await saveFunnelSession(updated);
      setSessionCookie(cookies, sessionId, url.protocol === "https:");
      return updated;
    }
  }

  const now = new Date().toISOString();
  const newSessionId = crypto.randomUUID();
  const session: FunnelSession = {
    sessionId: newSessionId,
    createdAt: now,
    updatedAt: now,
    firstUrl: url.toString(),
    originalQueryString: url.search,
    fbc: buildFirstTouchFbc(url, cookies),
    fbp: cookies.get("_fbp")?.value,
    geo: getRequestGeo(request),
    answers: {},
    eventCounts: {},
    completedStep: 0,
  };

  await saveFunnelSession(session);
  setSessionCookie(cookies, newSessionId, url.protocol === "https:");
  return session;
}

export async function saveFunnelSession(session: FunnelSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await env.FUNNEL_SESSIONS.put(`session:${session.sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
}

export async function getFunnelSessionById(sessionId: string): Promise<FunnelSession | null> {
  return env.FUNNEL_SESSIONS.get<FunnelSession>(`session:${sessionId}`, "json");
}

export function getClientIp(request: Request): string | undefined {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    undefined
  );
}

function setSessionCookie(cookies: AstroCookies, sessionId: string, secure: boolean): void {
  cookies.set(SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
  });
}
