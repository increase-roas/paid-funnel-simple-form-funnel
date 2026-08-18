import { env } from "cloudflare:workers";
import type { FunnelSession } from "../types/funnel";
import { funnelConfig, getActiveInventoryProducts } from "./config";
import { buildGhlTags, syncToGhl } from "./ghl";
import { recordLeadDelivery } from "./lead-repository";
import { appendMissedLead, upsertAllLeads, type SheetsConfig, type VaultLead } from "./sheets";

interface DeliveryResult {
  ok: boolean;
  status: number;
  error?: string;
  ghlContactId?: string;
  vaultStatus: "sent" | "failed" | "unconfigured";
  vaultError?: string;
}

function getSheetsConfig(): SheetsConfig | null {
  if (
    !env.GOOGLE_SHEETS_ID ||
    !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return null;
  }
  return {
    spreadsheetId: env.GOOGLE_SHEETS_ID,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
}

function interestedProduct(session: FunnelSession) {
  const answerValues = Object.values(session.answers).flat();
  return getActiveInventoryProducts().find(
    (product) => answerValues.includes(product.id) || answerValues.includes(product.name),
  );
}

function getVaultLead(session: FunnelSession, ghlContactId: string): VaultLead {
  if (!session.leadId || !session.contact) throw new Error("Persisted contact is required for lead delivery");
  return {
    leadUuid: session.leadId,
    createdAt: session.createdAt,
    firstName: session.contact.firstName,
    lastName: session.contact.lastName,
    email: session.contact.email,
    phone: session.contact.phone,
    zip: session.zip ?? "",
    source: "Paid Ads Funnel",
    ghlContactId,
    answersJson: JSON.stringify(session.answers),
    firstUrl: session.firstUrl,
    originalQueryString: session.originalQueryString,
  };
}

export async function deliverLeadToGhl(session: FunnelSession): Promise<DeliveryResult> {
  if (!session.leadId || !session.contact) {
    return {
      ok: false,
      status: 0,
      error: "Persisted contact is required for lead delivery.",
      vaultStatus: "unconfigured",
    };
  }

  const product = interestedProduct(session);
  const productName = product?.name ?? "";
  const ghlConfigured = Boolean(env.GHL_API_KEY && env.GHL_LOCATION_ID);
  const ghl = ghlConfigured
    ? await syncToGhl(
        { apiKey: env.GHL_API_KEY!, locationId: env.GHL_LOCATION_ID! },
        {
          firstName: session.contact.firstName,
          lastName: session.contact.lastName,
          email: session.contact.email,
          phone: session.contact.phone,
          source: "Paid Ads Funnel",
          tags: buildGhlTags({ funnelSlug: funnelConfig.funnel.slug, productName }),
          customFields: {
            lead_uuid: session.leadId,
            funnel_slug: funnelConfig.funnel.slug,
            zip: session.zip ?? "",
            product_interest: productName,
            product_id: product?.id ?? "",
            product_name: product?.name ?? "",
            product_price: product?.priceLabel ?? "",
            original_query_string: session.originalQueryString,
            first_url: session.firstUrl,
          },
        },
      )
    : { ok: false, status: 0, contactId: "", detail: "GHL is not configured" };

  const sheetsConfig = getSheetsConfig();
  let vaultStatus: "sent" | "failed" | "unconfigured" = sheetsConfig ? "sent" : "unconfigured";
  let vaultError = "";

  try {
    if (sheetsConfig) {
      const vaultLead = getVaultLead(session, ghl.contactId);
      await upsertAllLeads(sheetsConfig, vaultLead);
      if (!ghl.ok) {
        await appendMissedLead(sheetsConfig, vaultLead, ghl.detail || `GHL HTTP ${ghl.status}`);
      }
    }
  } catch (error) {
    vaultStatus = "failed";
    vaultError = error instanceof Error ? error.message : "Lead-vault request failed";
  }

  await recordLeadDelivery(session.leadId, {
    ghlContactId: ghl.contactId,
    ghlStatus: ghl.ok ? "sent" : ghlConfigured ? "failed" : "unconfigured",
    ghlError: ghl.ok ? undefined : ghl.detail,
    vaultStatus,
    vaultError: vaultError || undefined,
  });

  return ghl.ok
    ? {
        ok: true,
        status: ghl.status,
        ghlContactId: ghl.contactId,
        vaultStatus,
        vaultError: vaultError || undefined,
      }
    : {
        ok: false,
        status: ghl.status,
        error: ghl.detail,
        ghlContactId: ghl.contactId,
        vaultStatus,
        vaultError: vaultError || undefined,
      };
}

export async function sendSubmissionAlert(input: {
  leadId?: string;
  sessionId: string;
  stage: string;
  message: string;
}): Promise<void> {
  if (!env.ALERT_WEBHOOK_URL) return;

  try {
    await fetch(env.ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        severity: "error",
        component: "paid-funnel-submit",
        ...input,
        occurredAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    console.error("Submission alert delivery failed");
  }
}
