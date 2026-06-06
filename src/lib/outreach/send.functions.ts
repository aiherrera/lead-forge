import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendViaProvider, type ProviderName } from "./providers";

/**
 * Server function that sends a single queued email job through the real
 * HTTP API provider configured on its email_account. Reads the provider
 * API key from `process.env[account.smtp_password_secret]`.
 *
 * Writes the result back into `email_jobs` and `email_events` and (on
 * bounce/suppression-grade failures) inserts into `suppression_list`.
 */
export const sendEmailJob = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabaseAdmin;
    const { data: job, error: jobErr } = await sb
      .from("email_jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (jobErr || !job) {
      return { ok: false as const, reason: "job_not_found", error: jobErr?.message ?? "not_found" };
    }
    if (job.status === "sent" || job.status === "bounced") {
      return { ok: true as const, alreadySent: true, providerMessageId: null };
    }
    if (!job.recipient_email) {
      await markFailed(job.id, "missing_recipient_email", job.campaign_id, job.business_id);
      return { ok: false as const, reason: "missing_recipient_email", error: "missing_recipient_email" };
    }

    // Suppression check
    const { data: supp } = await sb
      .from("suppression_list").select("id").eq("email", job.recipient_email.toLowerCase()).limit(1);
    if (supp && supp.length > 0) {
      await sb.from("email_jobs").update({ status: "skipped", failure_reason: "recipient_suppressed" }).eq("id", job.id);
      await sb.from("email_events").insert({
        email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
        event_type: "skipped", metadata: { reason: "recipient_suppressed" },
      });
      return { ok: false as const, reason: "recipient_suppressed", error: "suppressed" };
    }

    // Account
    if (!job.sender_account_id) {
      await markFailed(job.id, "no_sender_account", job.campaign_id, job.business_id);
      return { ok: false as const, reason: "no_sender_account", error: "no_sender_account" };
    }
    const { data: account } = await sb
      .from("email_accounts").select("*").eq("id", job.sender_account_id).maybeSingle();
    if (!account) {
      await markFailed(job.id, "sender_account_missing", job.campaign_id, job.business_id);
      return { ok: false as const, reason: "sender_account_missing", error: "missing" };
    }
    if (!account.is_enabled) {
      await markFailed(job.id, "sender_account_disabled", job.campaign_id, job.business_id);
      return { ok: false as const, reason: "sender_account_disabled", error: "disabled" };
    }
    const provider = account.provider as ProviderName | "mock" | "smtp" | "gmail";
    if (provider === "mock" || provider === "smtp" || provider === "gmail") {
      await markFailed(job.id, `provider_unsupported:${provider}`, job.campaign_id, job.business_id);
      return { ok: false as const, reason: "provider_unsupported", error: `provider ${provider} not supported on edge runtime` };
    }
    const secretName = account.smtp_password_secret as string | null;
    if (!secretName) {
      await markFailed(job.id, "missing_api_key_secret_name", job.campaign_id, job.business_id);
      return { ok: false as const, reason: "missing_api_key_secret_name", error: "set the API key secret name on the email account" };
    }
    const apiKey = process.env[secretName];
    if (!apiKey) {
      await markFailed(job.id, `missing_secret:${secretName}`, job.campaign_id, job.business_id);
      return { ok: false as const, reason: "missing_secret", error: `secret ${secretName} not configured` };
    }

    // Mark sending
    await sb.from("email_jobs").update({ status: "sending" }).eq("id", job.id);

    const extras: Record<string, string | undefined> = {};
    if (provider === "mailgun") {
      extras.domain = (account.smtp_host as string | null) ?? undefined;
      extras.region = (account.smtp_username as string | null) ?? undefined;
    }
    const result = await sendViaProvider(provider as ProviderName, apiKey, {
      from: { name: account.sender_name, email: account.sender_email },
      to: job.recipient_email,
      replyTo: account.reply_to_email,
      subject: job.subject,
      html: job.body_html ?? job.body_text,
      text: job.body_text,
      extras,
    });

    const now = new Date().toISOString();
    if (result.ok) {
      await sb.from("email_jobs").update({
        status: "sent", sent_at: now, is_simulated: false,
        failure_reason: null,
      }).eq("id", job.id);
      await sb.from("email_events").insert({
        email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
        event_type: "sent", metadata: { provider, providerMessageId: result.providerMessageId },
      });
      if (job.business_id) {
        await sb.from("businesses").update({
          last_contacted_at: now, last_emailed_at: now, last_activity_at: now,
        }).eq("id", job.business_id);
      }
      if (job.campaign_lead_id) {
        await sb.from("campaign_leads").update({
          status: "sent", last_email_sent_at: now,
        }).eq("id", job.campaign_lead_id);
      }
      if (job.campaign_id) {
        const { data: c } = await sb.from("campaigns").select("sent_count").eq("id", job.campaign_id).maybeSingle();
        await sb.from("campaigns").update({
          sent_count: (c?.sent_count ?? 0) + 1, last_activity_at: now,
        }).eq("id", job.campaign_id);
      }
      return { ok: true as const, providerMessageId: result.providerMessageId };
    }

    // Failure path
    if (result.bounced) {
      await sb.from("email_jobs").update({
        status: "bounced", bounced_at: now, failed_at: now,
        failure_reason: result.error.slice(0, 500),
      }).eq("id", job.id);
      await sb.from("email_events").insert({
        email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
        event_type: "bounced", metadata: { provider, status: result.status, error: result.error },
      });
      await sb.from("suppression_list").upsert({
        email: job.recipient_email.toLowerCase(), reason: "bounced",
        source: provider, campaign_id: job.campaign_id, business_id: job.business_id,
      }, { onConflict: "email" });
      if (job.campaign_lead_id) {
        await sb.from("campaign_leads").update({ status: "bounced", bounced_at: now }).eq("id", job.campaign_lead_id);
      }
      return { ok: false as const, reason: "bounced", error: result.error };
    }
    await markFailed(job.id, result.error.slice(0, 500), job.campaign_id, job.business_id, { provider, status: result.status });
    return { ok: false as const, reason: "send_failed", error: result.error };
  });

async function markFailed(
  jobId: string,
  reason: string,
  campaignId: string | null,
  businessId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any> = {},
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin;
  const now = new Date().toISOString();
  await sb.from("email_jobs").update({ status: "failed", failed_at: now, failure_reason: reason }).eq("id", jobId);
  await sb.from("email_events").insert({
    email_job_id: jobId, campaign_id: campaignId, business_id: businessId,
    event_type: "failed", metadata: { reason, ...metadata },
  });
}
