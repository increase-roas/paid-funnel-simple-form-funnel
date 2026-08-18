import type { z } from "zod";
import type { funnelConfigSchema } from "./config-schema";

type FunnelInput = z.input<typeof funnelConfigSchema>;
export type PreviewShape = "A" | "B" | "C";

const surveyQuestions: FunnelInput["surveyQuestions"] = [
  {
    id: "productInterest",
    text: "Which type of spa are you considering?",
    type: "single-choice",
    options: [
      { label: "Hot tub", value: "hot-tub" },
      { label: "Swim spa", value: "swim-spa" },
      { label: "Not sure yet", value: "not-sure" },
    ],
  },
  {
    id: "purchaseTimeline",
    text: "When are you hoping to have it installed?",
    type: "single-choice",
    options: [
      { label: "Within 30 days", value: "within-30-days" },
      { label: "Within 1–3 months", value: "one-to-three-months" },
      { label: "Within 3–6 months", value: "three-to-six-months" },
      { label: "Just researching", value: "researching" },
    ],
    intentValues: {
      "within-30-days": 100,
      "one-to-three-months": 75,
      "three-to-six-months": 45,
      researching: 25,
    },
  },
  {
    id: "seatingCapacity",
    text: "How many people should it comfortably seat?",
    type: "single-choice",
    options: [
      { label: "2–3 people", value: "two-to-three" },
      { label: "4–5 people", value: "four-to-five" },
      { label: "6 or more", value: "six-plus" },
      { label: "Not sure", value: "not-sure" },
    ],
  },
  {
    id: "priorityFeatures",
    text: "Which features matter most?",
    helpText: "Choose all that apply.",
    type: "multi-choice",
    options: [
      { label: "Hydrotherapy", value: "hydrotherapy" },
      { label: "Low maintenance", value: "low-maintenance" },
      { label: "Energy efficiency", value: "energy-efficiency" },
      { label: "Entertainment features", value: "entertainment" },
    ],
  },
];

const inventoryProducts: NonNullable<FunnelInput["inventory"]>["products"] = [
  {
    id: "serenity-6",
    name: "Serenity 6-Person Hot Tub",
    description: "In stock now — hydrotherapy jets, LED lighting, energy-smart cover.",
    imageUrl:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $8,499",
    ctaLabel: "Check availability",
    ctaUrl: "tel:+17015550142",
    active: true,
  },
  {
    id: "aqua-swim-14",
    name: "Aqua Swim Spa 14'",
    description: "Active floor model — swim current, seating zone, low-maintenance shell.",
    imageUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $18,900",
    ctaLabel: "Schedule a visit",
    ctaUrl: "tel:+17015550142",
    active: true,
  },
  {
    id: "compact-4",
    name: "Compact 4-Person Spa",
    description: "Small footprint, plug-and-play ready for patios and decks.",
    imageUrl:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $5,299",
    ctaLabel: "Get pricing",
    ctaUrl: "tel:+17015550142",
    active: true,
  },
  {
    id: "legacy-model",
    name: "Legacy Clearance Model",
    description: "Previously featured — not currently on the showroom floor.",
    imageUrl:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80",
    priceLabel: "Sold out",
    ctaLabel: "Notify me",
    ctaUrl: "tel:+17015550142",
    active: false,
  },
  {
    id: "family-8",
    name: "Family 8-Person Spa",
    description: "Showroom favorite — lounge seating, waterfall, and smart controls.",
    imageUrl:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
    priceLabel: "From $11,200",
    ctaLabel: "View on inventory page",
    ctaUrl: "https://example.com/inventory",
    active: true,
  },
];

export function previewShapeFromEnv(value: string | undefined): PreviewShape {
  if (value === "B" || value === "C") return value;
  return "A";
}

export function buildFunnelInput(shape: PreviewShape): FunnelInput {
  const simpleForm = shape === "A";

  return {
    client: {
      name: "Northland Spas Demo",
      phone: "+17015550142",
      logoUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='%23155EEF' d='M8 16h40v8H16v8h40v8H24v8H8z'/%3E%3Cpath fill='%230B1F33' d='M48 16h8v8h-8zM8 40h8v8H8z'/%3E%3C/svg%3E",
      logoAlt: "Northland Spas Demo",
    },
    funnel: {
      slug: "hot-tub-offer",
      shape,
      entryStyle: simpleForm ? "simple" : "hero",
      ctaLabel: simpleForm ? "Next step" : "See Local Inventory Options",
      advertorialLabel: "Advertisement",
      qualifyingLine: "For homeowners inside the local delivery and service area.",
    },
    offer: {
      headline: simpleForm
        ? "See active inventory in the local area"
        : "How Much Does a Hot Tub Cost In The Local Area?",
      subheadline: simpleForm
        ? "Enter a ZIP code to view models that are actually in stock nearby."
        : "See Active Inventory That's Actually In Stock",
    },
    meta: {
      pixelId: "123456789012345",
      conversionEventName: "Lead",
      viewContentDelayMs: 4000,
      currency: "USD",
      defaultConversionValue: 25,
    },
    ga4MeasurementId: undefined,
    googleEnhancedConversions: false,
    progressStyle: "both",
    approvedFramingHeadline: simpleForm
      ? "Almost there — where should we send options?"
      : "Great News — You Qualify!",
    geoH1Template: "Active Hot Tub Inventory In The {city}, {state} Area",
    serviceAreaZipCodes: [
      "58701",
      "58702",
      "58703",
      "58704",
      "58705",
      "58707",
      "58722",
      "58735",
      "58746",
      "58759",
    ],
    surveyQuestions: shape === "A" ? [] : surveyQuestions,
    calendarUrl:
      shape === "C"
        ? "https://api.leadconnectorhq.com/widget/booking/demo"
        : undefined,
    contact: {
      headline: simpleForm
        ? "Join thousands of local homeowners checking current showroom stock."
        : "Where should the local showroom team send the options?",
      submitLabel: simpleForm ? "Next step" : "Get My Options",
      emailRequired: true,
      consent: {
        version: "2026-08-13",
        text:
          "I agree to receive calls and text messages about this request at the number provided. Consent is not a condition of purchase. Message and data rates may apply.",
      },
    },
    trust: {
      eyebrow: "What happens next",
      statement:
        "A local showroom specialist reviews the submitted ZIP and preferences before following up with current availability and next steps.",
    },
    thankYou: {
      headline: "Your request is in.",
      message:
        "A local showroom specialist will review the details and follow up using the contact information provided.",
    },
    outOfArea: {
      headline: "This ZIP is outside the current service area.",
      message:
        "The local showroom is not currently scheduling delivery or service in this ZIP code.",
    },
    validation: {
      defaultCountry: "US",
      duplicateWindowHours: 24,
    },
    inventory: {
      enabled: simpleForm,
      headline: "Active inventory near you",
      subheadline: "These models are in stock at the local showroom. Tap a product to view full details.",
      pageUrl: "https://example.com/inventory",
      products: inventoryProducts,
    },
  };
}
