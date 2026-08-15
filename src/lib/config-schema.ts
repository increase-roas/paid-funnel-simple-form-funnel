import { z } from "zod";

const optionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().regex(/^[a-z0-9][a-z0-9-]*$/),
});

const inventoryProductSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(8).max(280).optional(),
  imageUrl: z.string().trim().url(),
  priceLabel: z.string().trim().min(2).max(60).optional(),
  ctaLabel: z.string().trim().min(2).max(50),
  ctaUrl: z.string().trim().url(),
  active: z.boolean(),
});

const surveyQuestionSchema = z
  .object({
    id: z.string().trim().regex(/^[a-z][A-Za-z0-9]*$/),
    text: z.string().trim().min(8).max(220),
    helpText: z.string().trim().min(3).max(180).optional(),
    type: z.enum(["single-choice", "multi-choice", "text"]),
    options: z.array(optionSchema).max(12).optional(),
    intentValues: z.record(z.string(), z.number().nonnegative()).optional(),
  })
  .superRefine((question, context) => {
    const choiceQuestion = question.type !== "text";
    if (choiceQuestion && (!question.options || question.options.length < 2)) {
      context.addIssue({
        code: "custom",
        message: "Choice questions require at least two options.",
        path: ["options"],
      });
    }
    if (!choiceQuestion && question.options?.length) {
      context.addIssue({
        code: "custom",
        message: "Text questions cannot define options.",
        path: ["options"],
      });
    }
    if (question.intentValues) {
      const values = new Set(question.options?.map((option) => option.value) ?? []);
      for (const key of Object.keys(question.intentValues)) {
        if (!values.has(key)) {
          context.addIssue({
            code: "custom",
            message: `Intent value key \"${key}\" must match an option value.`,
            path: ["intentValues", key],
          });
        }
      }
    }
  });

export const funnelConfigSchema = z
  .object({
    client: z.object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
      logoUrl: z.string().trim().min(1),
      logoAlt: z.string().trim().min(2).max(120),
    }),
    funnel: z.object({
      slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      shape: z.enum(["A", "B", "C"]).default("A"),
      entryStyle: z.enum(["simple", "hero"]).default("simple"),
      ctaLabel: z.string().trim().min(3).max(50),
      advertorialLabel: z.string().trim().min(3).max(50),
      qualifyingLine: z.string().trim().min(12).max(180),
    }),
    offer: z.object({
      headline: z.string().trim().min(12).max(140),
      subheadline: z.string().trim().min(24).max(300),
    }),
    meta: z.object({
      pixelId: z.string().regex(/^\d{8,20}$/),
      conversionEventName: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
      viewContentDelayMs: z.number().int().min(3500).max(5000),
      currency: z.string().length(3).transform((value) => value.toUpperCase()),
      defaultConversionValue: z.number().nonnegative(),
    }),
    ga4MeasurementId: z
      .string()
      .trim()
      .regex(/^G-[A-Z0-9]{6,20}$/)
      .optional(),
    googleEnhancedConversions: z.boolean(),
    progressStyle: z.enum(["counter", "bar", "both"]),
    approvedFramingHeadline: z.string().trim().min(12).max(140),
    geoH1Template: z.string().trim().min(20).max(180),
    serviceAreaZipCodes: z
      .array(z.string().regex(/^\d{5}$/))
      .min(1)
      .transform((zips) => [...new Set(zips)]),
    surveyQuestions: z.array(surveyQuestionSchema).max(8),
    calendarUrl: z.string().url().optional(),
    contact: z.object({
      headline: z.string().trim().min(12).max(180),
      submitLabel: z.string().trim().min(3).max(50),
      emailRequired: z.boolean(),
      consent: z.object({
        version: z.string().trim().min(1).max(40),
        text: z.string().trim().min(40).max(700),
      }),
    }),
    trust: z.object({
      eyebrow: z.string().trim().min(2).max(60),
      statement: z.string().trim().min(20).max(400),
    }),
    thankYou: z.object({
      headline: z.string().trim().min(6).max(120),
      message: z.string().trim().min(20).max(400),
    }),
    outOfArea: z.object({
      headline: z.string().trim().min(8).max(140),
      message: z.string().trim().min(20).max(400),
    }),
    validation: z.object({
      defaultCountry: z.string().trim().length(2).transform((value) => value.toUpperCase()),
      duplicateWindowHours: z.number().int().min(1).max(168),
    }),
    ghlWebhookUrl: z.string().url(),
    inventory: z.object({
      enabled: z.boolean(),
      headline: z.string().trim().min(8).max(140),
      subheadline: z.string().trim().min(12).max(280),
      pageUrl: z.string().trim().url().optional(),
      products: z.array(inventoryProductSchema).length(5),
    }),
  })
  .superRefine((config, context) => {
    const ids = config.surveyQuestions.map((question) => question.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Every survey question id must be unique.",
        path: ["surveyQuestions"],
      });
    }

    for (const placeholder of ["{city}", "{state}"]) {
      if (!config.geoH1Template.includes(placeholder)) {
        context.addIssue({
          code: "custom",
          message: `geoH1Template must include the ${placeholder} placeholder.`,
          path: ["geoH1Template"],
        });
      }
    }

    if (config.googleEnhancedConversions && !config.ga4MeasurementId) {
      context.addIssue({
        code: "custom",
        message: "ga4MeasurementId is required when Google enhanced conversions are enabled.",
        path: ["ga4MeasurementId"],
      });
    }

    if (config.funnel.shape === "A" && config.surveyQuestions.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Shape A surveyQuestions must be empty.",
        path: ["surveyQuestions"],
      });
    }

    if (config.funnel.shape !== "A" && config.surveyQuestions.length < 1) {
      context.addIssue({
        code: "custom",
        message: "Shapes B and C require at least one survey question.",
        path: ["surveyQuestions"],
      });
    }

    if (config.funnel.shape === "C" && !config.calendarUrl) {
      context.addIssue({
        code: "custom",
        message: "calendarUrl is required when funnel shape is C.",
        path: ["calendarUrl"],
      });
    }

    const productIds = config.inventory.products.map((product) => product.id);
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({
        code: "custom",
        message: "Every inventory product id must be unique.",
        path: ["inventory", "products"],
      });
    }

    if (config.inventory.enabled) {
      const activeProducts = config.inventory.products.filter((product) => product.active);
      if (activeProducts.length < 1) {
        context.addIssue({
          code: "custom",
          message: "Inventory requires at least one active product.",
          path: ["inventory", "products"],
        });
      }
      if (config.inventory.products.length !== 5) {
        context.addIssue({
          code: "custom",
          message: "Inventory must define exactly five product slots.",
          path: ["inventory", "products"],
        });
      }
    }

    if (config.funnel.shape === "A" && config.inventory.enabled && config.surveyQuestions.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Shape A with inventory cannot include survey questions.",
        path: ["surveyQuestions"],
      });
    }
  });

export type FunnelConfig = z.infer<typeof funnelConfigSchema>;
export type SurveyQuestion = FunnelConfig["surveyQuestions"][number];

export function defineFunnelConfig(input: z.input<typeof funnelConfigSchema>) {
  return funnelConfigSchema.parse(input);
}
