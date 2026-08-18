import type { APIRoute } from "astro";
import {
  funnelConfig,
  getBookStep,
  getContactStep,
  getOutOfAreaPath,
  getStep,
  getStepPath,
  getThankYouPath,
  isKnownSlug,
  isServedZip,
} from "../../../../../lib/config";
import { deliverLeadToGhl, sendSubmissionAlert } from "../../../../../lib/lead-delivery";
import {
  ensureLeadRecord,
  markLeadStatus,
  mergeFormLeadIntoExistingIdentity,
  syncPartialLead,
  updateValidatedContact,
} from "../../../../../lib/lead-repository";
import { getOrCreateFunnelSession, saveFunnelSession } from "../../../../../lib/session";
import { validateFinalSubmission } from "../../../../../lib/validation";

export const prerender = false;

function redirectWithError(request: Request, step: number, code: string): Response {
  const url = new URL(getStepPath(step), request.url);
  url.searchParams.set("error", code);
  return Response.redirect(url, 303);
}

function redirectTo(request: Request, path: string): Response {
  return Response.redirect(new URL(path, request.url), 303);
}

export const POST: APIRoute = async ({ request, params, cookies, locals }) => {
  const jsonNavigation = request.headers.get("x-funnel-navigation") === "preloaded";
  const navigate = (path: string, status = 200): Response =>
    jsonNavigation
      ? Response.json({ ok: true, nextPath: path }, { status })
      : redirectTo(request, path);
  const fail = (stepNumber: number, code: string, status = 422): Response =>
    jsonNavigation
      ? Response.json({ ok: false, error: code, nextPath: getStepPath(stepNumber) }, { status })
      : redirectWithError(request, stepNumber, code);

  const stepNumber = Number.parseInt(params.n ?? "", 10);
  const step = getStep(stepNumber);
  if (!isKnownSlug(params.slug) || !step) {
    return new Response("Not found", { status: 404 });
  }

  const session = await getOrCreateFunnelSession(request, cookies);
  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")
    ? await request.formData()
    : new FormData();
  session.tabId = String(formData.get("tabId") ?? "").slice(0, 80) || session.tabId;

  if (step.kind === "zip") {
    const zip = String(formData.get("zip") ?? "").trim();
    if (!/^\d{5}$/.test(zip)) return fail(step.number, "zip");

    session.zip = zip;
    session.geo.postalCode = zip;
    session.completedStep = Math.max(session.completedStep, step.number);
    await saveFunnelSession(session);

    if (!isServedZip(zip)) {
      return navigate(getOutOfAreaPath());
    }

    session.leadId = await ensureLeadRecord(session, request);
    await saveFunnelSession(session);
    await syncPartialLead(session, request);
    return navigate(getStepPath(2));
  }

  if (!isServedZip(session.zip)) {
    return jsonNavigation
      ? Response.json({ ok: false, error: "zip", nextPath: getStepPath(1) }, { status: 409 })
      : redirectTo(request, getStepPath(1));
  }

  session.leadId = await ensureLeadRecord(session, request);

  if (step.kind === "question") {
    const question = funnelConfig.surveyQuestions[step.questionIndex];
    if (!question) return new Response("Not found", { status: 404 });

    const rawAnswers = formData
      .getAll("answer")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (question.type === "text") {
      const answer = rawAnswers[0]?.slice(0, 500);
      if (!answer) return fail(step.number, "answer");
      session.answers[question.id] = answer;
    } else {
      const allowed = new Set(question.options?.map((option) => option.value) ?? []);
      const answers = rawAnswers.filter((answer) => allowed.has(answer));
      if (answers.length === 0 || answers.length !== rawAnswers.length) {
        return fail(step.number, "answer");
      }
      session.answers[question.id] = question.type === "single-choice" ? answers[0]! : answers;

      const intentAnswer = answers[0];
      if (intentAnswer && question.intentValues?.[intentAnswer] !== undefined) {
        session.conversionValue = question.intentValues[intentAnswer];
      }
    }

    session.completedStep = Math.max(session.completedStep, step.number);
    await saveFunnelSession(session);
    await syncPartialLead(session, request);
    return navigate(getStepPath(step.number + 1));
  }

  if (step.kind === "interstitial") {
    return navigate(getStepPath(getContactStep()));
  }

  if (step.kind === "book") {
    if (session.leadStatus !== "delivered") {
      return navigate(getStepPath(getContactStep()));
    }
    session.completedStep = Math.max(session.completedStep, step.number);
    await saveFunnelSession(session);
    return navigate(getThankYouPath());
  }

  if (step.kind !== "contact") {
    return new Response("Not found", { status: 404 });
  }

  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 80);
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 80);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 24);
  const email = String(formData.get("email") ?? "").trim().slice(0, 254);
  const consentAccepted = formData.get("consent") === "accepted";
  const honeypot = String(formData.get("website") ?? "");

  session.contact = { firstName, lastName, phone, email };
  if (consentAccepted) {
    session.consent = {
      accepted: true,
      text: funnelConfig.contact.consent.text,
      version: funnelConfig.contact.consent.version,
      acceptedAt: new Date().toISOString(),
    };
  }
  session.completedStep = Math.max(session.completedStep, step.number);
  await saveFunnelSession(session);
  await syncPartialLead(session, request);

  const validation = await validateFinalSubmission({
    session,
    firstName,
    lastName,
    phone,
    email,
    consentAccepted,
    honeypot,
  });

  if (!validation.ok) {
    if (validation.code === "bot") {
      session.leadStatus = "rejected";
      await saveFunnelSession(session);
      if (session.leadId) await markLeadStatus(session.leadId, "rejected");
      return jsonNavigation
        ? Response.json({ ok: true, accepted: true }, { status: 202 })
        : new Response("Accepted", { status: 202 });
    }

    if (validation.code === "duplicate") {
      session.leadStatus = "duplicate";
      await saveFunnelSession(session);
      if (session.leadId) await markLeadStatus(session.leadId, "duplicate");
    }

    return fail(step.number, validation.code);
  }

  session.contact = validation.contact;
  if (validation.mergeLeadId && validation.mergeLeadId !== session.leadId) {
    await mergeFormLeadIntoExistingIdentity(session, request, validation.mergeLeadId);
    session.leadId = validation.mergeLeadId;
  }
  session.leadStatus = "qualified";
  await saveFunnelSession(session);
  await updateValidatedContact(session);
  if (session.leadId) await markLeadStatus(session.leadId, "qualified");

  const delivery = await deliverLeadToGhl(session);
  if (delivery.vaultStatus === "failed") {
    locals.cfContext.waitUntil(
      sendSubmissionAlert({
        leadId: session.leadId,
        sessionId: session.sessionId,
        stage: "lead-vault",
        message: delivery.vaultError ?? "Lead-vault delivery failed.",
      }),
    );
  }

  if (!delivery.ok) {
    locals.cfContext.waitUntil(
      sendSubmissionAlert({
        leadId: session.leadId,
        sessionId: session.sessionId,
        stage: "ghl-delivery",
        message: delivery.error ?? `GHL delivery failed with HTTP ${delivery.status}.`,
      }),
    );
  } else {
    const deliveredAt = new Date().toISOString();
    session.deliveredToGhlAt = deliveredAt;
    session.leadStatus = "delivered";
    await saveFunnelSession(session);
    if (session.leadId) {
      await markLeadStatus(session.leadId, "delivered", { deliveredAt });
    }
  }

  const bookStep = getBookStep();
  return navigate(bookStep ? getStepPath(bookStep) : getThankYouPath());
};
