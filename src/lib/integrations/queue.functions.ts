import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnqueueInput = {
  integrationId: string;
  businessIds: string[];
  campaignId?: string | null;
  action?: "create" | "update";
  targetObject?: string;
};

export const enqueueSyncJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: EnqueueInput) => d)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase;
    const rows = data.businessIds.map((id) => ({
      integration_id: data.integrationId,
      business_id: id,
      campaign_id: data.campaignId ?? null,
      target_object: data.targetObject ?? "lead",
      action: data.action ?? "create",
      status: "pending",
      payload: {},
      scheduled_at: new Date().toISOString(),
    }));
    if (rows.length === 0) return { queued: 0 };
    const { error } = await sb.from("sync_jobs").insert(rows);
    if (error) throw error;
    return { queued: rows.length };
  });

export type ProcessQueueResult = {
  processed: number; succeeded: number; failed: number; retried: number; permanentlyFailed: number;
};

export const runQueueNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ProcessQueueResult> => {
    const { processQueue } = await import("./queue.server");
    return processQueue();
  });

export const retrySyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase;
    const { error } = await sb.from("sync_jobs").update({
      status: "pending", scheduled_at: new Date().toISOString(), error_message: null,
    }).eq("id", data.jobId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelSyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => d)
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = context.supabase;
    const { error } = await sb.from("sync_jobs").update({
      status: "cancelled", completed_at: new Date().toISOString(),
    }).eq("id", data.jobId).in("status", ["pending", "running"]);
    if (error) throw error;
    return { ok: true };
  });
