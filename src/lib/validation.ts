import { env } from "cloudflare:workers";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { z } from "zod";
import { DISPOSABLE_EMAIL_DOMAINS } from "../data/disposable-email-domains";
import type { ContactData, FunnelSession } from "../types/funnel";
import { funnelConfig, isServedZip } from "./config";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(24),
  email: z.string().trim().max(254),
  consentAccepted: z.literal(true),
  honeypot: z.string().max(0),
});

export type ValidationErrorCode =
  | "zip"
  | "area"
  | "answer"
  | "contact"
  | "phone"
  | "email"
  | "consent"
  | "duplicate"
  | "bot";

export type FinalValidationResult =
  | {
      ok: true;
      contact: ContactData;
      mergeLeadId?: string;
    }
  | {
      ok: false;
      code: ValidationErrorCode;
      reason: string;
    };

export function normalizePhoneE164(rawPhone: string, defaultCountry: string): string | null {
  const parsed = parsePhoneNumberFromString(rawPhone, defaultCountry as CountryCode);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.has(domain) : false;
}

function hasEveryConfiguredAnswer(session: FunnelSession): boolean {
  return funnelConfig.surveyQuestions.every((question) => {
    const answer = session.answers[question.id];
    if (Array.isArray(answer)) return answer.length > 0;
    return typeof answer === "string" && answer.trim().length > 0;
  });
}

async function findDuplicateLead(
  leadId: string,
  phoneE164: string,
  email: string,
): Promise<{ id: string; source: string } | null> {
  const windowStart = new Date(
    Date.now() - funnelConfig.validation.duplicateWindowHours * 60 * 60 * 1000,
  ).toISOString();

  const result = await env.FUNNEL_DB.prepare(
    `SELECT id, source FROM leads
     WHERE id != ?
       AND created_at >= ?
       AND status IN ('qualified', 'delivered')
       AND (phone_e164 = ? OR (? != '' AND email_normalized = ?))
     LIMIT 1`,
  )
    .bind(leadId, windowStart, phoneE164, email, email)
    .first<{ id: string; source: string }>();

  return result ?? null;
}

export async function validateFinalSubmission(input: {
  session: FunnelSession;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  consentAccepted: boolean;
  honeypot: string;
}): Promise<FinalValidationResult> {
  if (input.honeypot.trim()) {
    return { ok: false, code: "bot", reason: "Honeypot field was populated." };
  }

  if (!input.consentAccepted) {
    return { ok: false, code: "consent", reason: "Required consent was not accepted." };
  }

  const parsed = contactSchema.safeParse({ ...input, honeypot: input.honeypot.trim() });
  if (!parsed.success) {
    return { ok: false, code: "contact", reason: "Contact fields failed validation." };
  }

  if (!input.session.zip || !/^\d{5}$/.test(input.session.zip)) {
    return { ok: false, code: "zip", reason: "A valid ZIP is required." };
  }

  if (!isServedZip(input.session.zip)) {
    return { ok: false, code: "area", reason: "ZIP is outside the configured service area." };
  }

  if (!hasEveryConfiguredAnswer(input.session)) {
    return { ok: false, code: "answer", reason: "One or more configured survey answers are missing." };
  }

  const phone = normalizePhoneE164(input.phone, funnelConfig.validation.defaultCountry);
  if (!phone) {
    return { ok: false, code: "phone", reason: "Phone number is not valid for E.164 normalization." };
  }

  const email = normalizeEmail(input.email);
  if (funnelConfig.contact.emailRequired && !email) {
    return { ok: false, code: "email", reason: "Email is required." };
  }

  if (email) {
    const emailResult = z.string().email().safeParse(email);
    if (!emailResult.success || isDisposableEmail(email)) {
      return { ok: false, code: "email", reason: "Email is invalid or uses a disposable domain." };
    }
  }

  if (!input.session.leadId) {
    return { ok: false, code: "contact", reason: "The partial lead record is missing." };
  }

  const duplicate = await findDuplicateLead(input.session.leadId, phone, email);
  if (duplicate && duplicate.source !== "phone") {
    return { ok: false, code: "duplicate", reason: "A matching recent lead already exists." };
  }

  return {
    ok: true,
    contact: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone,
      email,
    },
    ...(duplicate ? { mergeLeadId: duplicate.id } : {}),
  };
}
