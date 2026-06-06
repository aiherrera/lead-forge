import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendViaProvider, type ProviderName } from "@/lib/outreach/providers";

/**
 * Cron-triggered queue processor. Picks due email_jobs (status queued/scheduled,
 * scheduled_at <= now) and sends them through their configured account.
 *
 * Auth: pass the Supabase anon key in the `apikey` header (the documented
 * `/api/public/*` cron pattern).
 *
 * NOTE: this duplicates the per-account send logic so we don't depend on the
 * createServerFn boundary inside a route handler.
 */
export const Route = createFileRoute("/api/public/hooks/process-email-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("Apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb: any = supabaseAdmin;
        const { data: settings } = await sb
          .from("app_settings").select("*").eq("id", 1).maybeSingle();
        const mockMode = settings?.mock_mode ?? true;

        const nowIso = new Date().toISOString();
        const { data: jobs, error } = await sb
          .from("email_jobs")
          .select("*")
          .in("status", ["queued", "scheduled"])
          .lte("scheduled_at", nowIso)
          .order("scheduled_at", { ascending: true })
          .limit(50);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        const results = { processed: 0, sent: 0, failed: 0, skipped: 0, bounced: 0, mockMode };
        for (const job of jobs ?? []) {
          results.processed++;
          try {
            const r = await sendSingle(job, mockMode);
            if (r === "sent") results.sent++;
            else if (r === "bounced") results.bounced++;
            else if (r === "skipped") results.skipped++;
            else results.failed++;
          } catch (e) {
            results.failed++;
            console.error("[queue] job failed", job.id, e);
          }
        }

        return new Response(JSON.stringify(results), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

type Outcome = "sent" | "failed" | "skipped" | "bounced";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSingle(job: any, mockMode: boolean): Promise<Outcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin;
  const now = new Date().toISOString();

  if (!job.recipient_email) {
    await sb.from("email_jobs").update({ status: "failed", failed_at: now, failure_reason: "missing_recipient_email" }).eq("id", job.id);
    return "failed";
  }
  const { data: supp } = await sb.from("suppression_list").select("id").eq("email", job.recipient_email.toLowerCase()).limit(1);
  if (supp && supp.length > 0) {
    await sb.from("email_jobs").update({ status: "skipped", failure_reason: "recipient_suppressed" }).eq("id", job.id);
    return "skipped";
  }

  // Mock mode short-circuit: simulate success
  if (mockMode) {
    await sb.from("email_jobs").update({ status: "sent", sent_at: now, is_simulated: true }).eq("id", job.id);
    await sb.from("email_events").insert({
      email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
      event_type: "simulated_send", metadata: { simulated: true, source: "cron" },
    });
    if (job.campaign_lead_id) {
      await sb.from("campaign_leads").update({ status: "sent", last_email_sent_at: now }).eq("id", job.campaign_lead_id);
    }
    return "sent";
  }

  // Real send
  if (!job.sender_account_id) return await fail(job.id, "no_sender_account");
  const { data: account } = await sb.from("email_accounts").select("*").eq("id", job.sender_account_id).maybeSingle();
  if (!account || !account.is_enabled) return await fail(job.id, "sender_account_unavailable");
  const provider = account.provider as string;
  if (provider === "mock" || provider === "smtp" || provider === "gmail") {
    return await fail(job.id, `provider_unsupported:${provider}`);
  }
  const secretName = account.smtp_password_secret as string | null;
  const apiKey = secretName ? process.env[secretName] : undefined;
  if (!apiKey) return await fail(job.id, `missing_secret:${secretName ?? "unset"}`);

  await sb.from("email_jobs").update({ status: "sending" }).eq("id", job.id);
  const result = await sendViaProvider(provider as ProviderName, apiKey, {
    from: { name: account.sender_name, email: account.sender_email },
    to: job.recipient_email,
    replyTo: account.reply_to_email,
    subject: job.subject,
    html: job.body_html ?? job.body_text,
    text: job.body_text,
    extras: { domain: account.smtp_host ?? undefined, region: account.smtp_username ?? undefined },
  });
  if (result.ok) {
    await sb.from("email_jobs").update({ status: "sent", sent_at: now, is_simulated: false }).eq("id", job.id);
    await sb.from("email_events").insert({
      email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
      event_type: "sent", metadata: { provider, providerMessageId: result.providerMessageId },
    });
    if (job.business_id) {
      await sb.from("businesses").update({ last_contacted_at: now, last_emailed_at: now, last_activity_at: now }).eq("id", job.business_id);
    }
    if (job.campaign_lead_id) {
      await sb.from("campaign_leads").update({ status: "sent", last_email_sent_at: now }).eq("id", job.campaign_lead_id);
    }
    if (job.campaign_id) {
      const { data: c } = await sb.from("campaigns").select("sent_count").eq("id", job.campaign_id).maybeSingle();
      await sb.from("campaigns").update({ sent_count: (c?.sent_count ?? 0) + 1, last_activity_at: now }).eq("id", job.campaign_id);
    }
    return "sent";
  }
  if (result.bounced) {
    await sb.from("email_jobs").update({ status: "bounced", bounced_at: now, failed_at: now, failure_reason: result.error.slice(0, 500) }).eq("id", job.id);
    await sb.from("email_events").insert({
      email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
      event_type: "bounced", metadata: { provider, error: result.error },
    });
    await sb.from("suppression_list").upsert({
      email: job.recipient_email.toLowerCase(), reason: "bounced", source: provider,
      campaign_id: job.campaign_id, business_id: job.business_id,
    }, { onConflict: "email" });
    if (job.campaign_lead_id) {
      await sb.from("campaign_leads").update({ status: "bounced", bounced_at: now }).eq("id", job.campaign_lead_id);
    }
    return "bounced";
  }
  return await fail(job.id, result.error.slice(0, 500));
}

async function fail(jobId: string, reason: string): Promise<Outcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin;
  const now = new Date().toISOString();
  await sb.from("email_jobs").update({ status: "failed", failed_at: now, failure_reason: reason }).eq("id", jobId);
  await sb.from("email_events").insert({ email_job_id: jobId, event_type: "failed", metadata: { reason } });
  return "failed";
}
