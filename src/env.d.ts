/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly FUNNEL_SHAPE?: string;
}

import type { CapiRetryMessage } from "./types/funnel";

declare global {
  namespace Cloudflare {
    interface Env {
      ASSETS: Fetcher;
      FUNNEL_SESSIONS: KVNamespace;
      FUNNEL_DB: D1Database;
      CAPI_RETRY_QUEUE: Queue<CapiRetryMessage>;
      ENVIRONMENT: string;
      META_GRAPH_API_VERSION: string;
      META_CAPI_ACCESS_TOKEN?: string;
      META_TEST_EVENT_CODE?: string;
      GHL_API_KEY?: string;
      GHL_LOCATION_ID?: string;
      GOOGLE_SHEETS_ID?: string;
      GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
      META_PIXEL_ID?: string;
      STAGE_WEBHOOK_SECRET?: string;
      CRM_CALLBACK_SECRET?: string;
      ALERT_WEBHOOK_URL?: string;
    }
  }

  interface Env extends Cloudflare.Env {}

  namespace App {
    interface Locals {
      cfContext: ExecutionContext;
    }
  }
}

export {};
