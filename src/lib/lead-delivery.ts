import { env } from "cloudflare:workers";
import type { FunnelSession } from "../types/funnel";
import { funnelConfig } from "./config";

interface DeliveryResult {
  ok: boolean;
  status: number;
  error?: string;
}

function getGhlWebhookUrl(): string {
  return env.GHL_WEBHOOK_URL || funnelConfig.ghlWebhookUrl;
}

export async function deliverLeadToGhl(session: FunnelSession): Promise<DeliveryResult> {
  const webhookUrl = getGhlWebhookUrl();
  if (new URL(webhookUrl).hostname.endsWith(".invalid") && env.ENVIRONMENT !== "production") {
    console.warn("GHL delivery skipped in local development because no webhook is configured.");
    return { ok: true, status: 204 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "paid-funnel-advertorial/1.0",
      },
      body: JSON.stringify({
        source: "Paid Ads Funnel",
        funnelSlug: funnelConfig.funnel.slug,
        clientName: funnelConfig.client.name,
        leadId: session.leadId,
        sessionId: session.sessionId,
        contact: session.contact,
        zip: session.zip,
        location: session.geo,
        answers: session.answers,
        conversionValue: session.conversionValue ?? funnelConfig.meta.defaultConversionValue,
        attribution: {
          firstUrl: session.firstUrl,
          originalQueryString: session.originalQueryString,
          fbc: session.fbc,
          fbp: session.fbp,
        },
        consent: session.consent,
        submittedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `GHL webhook returned HTTP ${response.status}.`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Unknown GHL webhook error.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendSubmissionAlert(input: {
  leadId?: string;
  sessionId: string;
  stage: string;
  message: string;
}): Promise<void> {
  if (!env.SUBMISSION_ALERT_WEBHOOK_URL) return;

  try {
    await fetch(env.SUBMISSION_ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        severity: "error",
        component: "paid-funnel-submit",
        ...input,
        occurredAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("Submission alert delivery failed", error);
  }
}
