import { handle } from "@astrojs/cloudflare/handler";
import type { CapiRetryMessage } from "./types/funnel";
import { sendCapiPayload, updateCapiStatus } from "./lib/tracking";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_QUEUE_DELAY_SECONDS = 24 * 60 * 60;
const BASE_RETRY_DELAY_SECONDS = 30;

function getRetryDelaySeconds(attempts: number): number {
  return Math.min(MAX_QUEUE_DELAY_SECONDS, BASE_RETRY_DELAY_SECONDS * 2 ** Math.max(0, attempts - 1));
}

async function recordDroppedEvent(
  env: Env,
  message: Message<CapiRetryMessage>,
  reason: string,
): Promise<void> {
  const droppedAt = new Date().toISOString();
  await env.FUNNEL_DB.prepare(
    `INSERT INTO dropped_capi_events (
      event_id, dropped_at, attempts, reason, payload_json
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      dropped_at = excluded.dropped_at,
      attempts = excluded.attempts,
      reason = excluded.reason,
      payload_json = excluded.payload_json`,
  )
    .bind(
      message.body.eventId,
      droppedAt,
      message.attempts,
      reason,
      JSON.stringify(message.body.payload),
    )
    .run();
  await updateCapiStatus(message.body.eventId, "dropped", reason);
}

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      const createdAt = Date.parse(message.body.createdAt);
      const ageMs = Number.isFinite(createdAt) ? Date.now() - createdAt : SEVEN_DAYS_MS;

      if (ageMs >= SEVEN_DAYS_MS) {
        await recordDroppedEvent(env, message, "CAPI retry window exceeded seven days.");
        console.error("Dropped expired CAPI event", {
          eventId: message.body.eventId,
          attempts: message.attempts,
        });
        message.ack();
        continue;
      }

      const result = await sendCapiPayload(message.body.payload);
      if (result.ok) {
        await updateCapiStatus(message.body.eventId, "sent");
        message.ack();
        continue;
      }

      await updateCapiStatus(message.body.eventId, "queued", result.error);
      message.retry({ delaySeconds: getRetryDelaySeconds(message.attempts) });
    }
  },
} satisfies ExportedHandler<Env, CapiRetryMessage>;
