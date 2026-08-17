import rawConfig from "../../funnel.config";
import { defineFunnelConfig, type FunnelConfig } from "./config-schema";

export const funnelConfig = defineFunnelConfig(rawConfig);

export const INVENTORY_SLOT_COUNT = 5;

export type FunnelStep =
  | { number: 1; key: "zip"; kind: "zip" }
  | { number: number; key: string; kind: "question"; questionIndex: number }
  | { number: number; key: "validation"; kind: "interstitial" }
  | { number: number; key: "contact"; kind: "contact" }
  | { number: number; key: "book"; kind: "book" };

export function inventoryEnabled(config: FunnelConfig): boolean {
  return config.inventory.enabled && config.inventory.products.some((product) => product.active);
}

export function getActiveInventoryProducts(config: FunnelConfig = funnelConfig) {
  return config.inventory.products
    .slice(0, INVENTORY_SLOT_COUNT)
    .filter((product) => product.active);
}

export function resolveTotalSteps(config: FunnelConfig): number {
  switch (config.funnel.shape) {
    case "A":
      return 2;
    case "B":
      return config.surveyQuestions.length + 3;
    case "C":
      return config.surveyQuestions.length + 4;
    default: {
      const exhaustive: never = config.funnel.shape;
      throw new Error(`Unsupported funnel shape: ${exhaustive}`);
    }
  }
}

export function resolveStep(config: FunnelConfig, number: number): FunnelStep | null {
  const total = resolveTotalSteps(config);
  if (!Number.isInteger(number) || number < 1 || number > total) return null;
  if (number === 1) return { number: 1, key: "zip", kind: "zip" };

  if (config.funnel.shape === "A") {
    return number === 2 ? { number, key: "contact", kind: "contact" } : null;
  }

  const lastQuestion = 1 + config.surveyQuestions.length;
  const interstitial = lastQuestion + 1;
  const contact = interstitial + 1;
  const book = contact + 1;

  if (number >= 2 && number <= lastQuestion) {
    const questionIndex = number - 2;
    const question = config.surveyQuestions[questionIndex];
    if (!question) return null;
    return { number, key: question.id, kind: "question", questionIndex };
  }

  if (number === interstitial) return { number, key: "validation", kind: "interstitial" };
  if (number === contact) return { number, key: "contact", kind: "contact" };
  if (config.funnel.shape === "C" && number === book) {
    return { number, key: "book", kind: "book" };
  }

  return null;
}

export function getTotalSteps(): number {
  return resolveTotalSteps(funnelConfig);
}

export function getStep(number: number): FunnelStep | null {
  return resolveStep(funnelConfig, number);
}

export function getContactStep(): number {
  if (funnelConfig.funnel.shape === "A") return 2;
  const total = getTotalSteps();
  return funnelConfig.funnel.shape === "C" ? total - 1 : total;
}

export function getInterstitialStep(): number | null {
  if (funnelConfig.funnel.shape === "A") return null;
  return getContactStep() - 1;
}

export function getBookStep(): number | null {
  return funnelConfig.funnel.shape === "C" ? getTotalSteps() : null;
}

export function getStepPath(number: number): string {
  return `/lp/${funnelConfig.funnel.slug}/step/${number}`;
}

export function getThankYouPath(): string {
  return `/lp/${funnelConfig.funnel.slug}/thank-you`;
}

export function getOutOfAreaPath(): string {
  return `/lp/${funnelConfig.funnel.slug}/out-of-area`;
}

export function isServedZip(zip: string | undefined): boolean {
  if (!zip || !/^\d{5}$/.test(zip)) return false;
  return funnelConfig.serviceAreaZipCodes.includes(zip);
}

export function isKnownSlug(slug: string | undefined): boolean {
  return slug === funnelConfig.funnel.slug;
}
