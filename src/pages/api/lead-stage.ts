import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { funnelConfig } from "../../lib/config";
import { handleConversion } from "./funnel/[slug]/conversion";

export const prerender = false;

export const POST: APIRoute = context =>
  handleConversion(
    {
      ...context,
      params: { ...context.params, slug: funnelConfig.funnel.slug },
    },
    env.STAGE_WEBHOOK_SECRET,
  );
