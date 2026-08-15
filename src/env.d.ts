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
      GHL_WEBHOOK_URL?: string;
      CRM_CALLBACK_SECRET?: string;
      SUBMISSION_ALERT_WEBHOOK_URL?: string;
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
