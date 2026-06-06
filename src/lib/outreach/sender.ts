import type { Business, Category } from "../types";
import { updateEmailJob, logEmailEvent, addSuppression, isSuppressed, updateCampaignLead } from "./db";
import { supabase } from "@/integrations/supabase/client";
import { buildVariableMap, findMissingVariables, renderTemplate } from "./personalize";
import type { Campaign, EmailJob } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

/**
 * Process a single email job (mock sender). Simulates send with small failure/bounce chance.
 * Real SMTP would replace this implementation.
 */
export async function processJob(job: EmailJob): Promise<{ ok: boolean; reason?: string; bounced?: boolean }> {
  if (!job.recipient_email) {
    await markFailed(job.id, "missing_recipient_email");
    return { ok: false, reason: "missing_recipient_email" };
  }
  if (await isSuppressed(job.recipient_email)) {
    await markSkipped(job.id, "recipient_suppressed");
    return { ok: false, reason: "recipient_suppressed" };
  }

  // Decide between real send and simulation based on global mock_mode + account provider.
  const { data: settings } = await sb.from("app_settings").select("mock_mode").eq("id", 1).maybeSingle();
  const mockMode = settings?.mock_mode ?? true;
  let realProvider = false;
  if (!mockMode && job.sender_account_id) {
    const { data: acc } = await sb.from("email_accounts")
      .select("provider,is_enabled").eq("id", job.sender_account_id).maybeSingle();
    const p = acc?.provider as string | undefined;
    realProvider = !!acc?.is_enabled && (p === "resend" || p === "sendgrid" || p === "mailgun" || p === "postmark");
  }

  if (realProvider) {
    const { sendEmailJob } = await import("./send.functions");
    const r = await sendEmailJob({ data: { jobId: job.id } });
    if (r.ok) {
      await scheduleSequence(job);
      return { ok: true };
    }
    return { ok: false, reason: r.reason, bounced: r.reason === "bounced" };
  }

  // Simulated outcome (mock mode or no real provider configured)
  const roll = Math.random();
  const bounced = roll < 0.02;
  const failed = !bounced && roll < 0.04;

  if (bounced) {
    const now = new Date().toISOString();
    await updateEmailJob(job.id, {
      status: "bounced", bounced_at: now, failed_at: now, failure_reason: "simulated_hard_bounce",
    });
    await logEmailEvent({
      email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
      event_type: "bounced", metadata: { simulated: true },
    });
    await addSuppression({
      email: job.recipient_email, reason: "bounced",
      source: "mock_sender", campaign_id: job.campaign_id, business_id: job.business_id,
    });
    if (job.campaign_lead_id) {
      await updateCampaignLead(job.campaign_lead_id, { status: "bounced", bounced_at: now });
    }
    return { ok: false, bounced: true, reason: "bounced" };
  }
  if (failed) {
    await markFailed(job.id, "simulated_provider_error");
    return { ok: false, reason: "simulated_provider_error" };
  }

  const now = new Date().toISOString();
  await updateEmailJob(job.id, { status: "sent", sent_at: now, is_simulated: true });
  await logEmailEvent({
    email_job_id: job.id, campaign_id: job.campaign_id, business_id: job.business_id,
    event_type: "simulated_send", metadata: { simulated: true },
  });

  if (job.business_id) {
    await sb.from("businesses").update({
      last_contacted_at: now, last_emailed_at: now, last_activity_at: now,
    }).eq("id", job.business_id);
  }
  if (job.campaign_lead_id) {
    await updateCampaignLead(job.campaign_lead_id, {
      status: "sent", last_email_sent_at: now,
    });
  }
  if (job.campaign_id) {
    const { data: c } = await sb.from("campaigns").select("sent_count").eq("id", job.campaign_id).single();
    await sb.from("campaigns").update({
      sent_count: (c?.sent_count ?? 0) + 1, last_activity_at: now,
    }).eq("id", job.campaign_id);
  }
  await scheduleSequence(job);
  return { ok: true };
}

async function scheduleSequence(job: EmailJob) {
  if (!job.campaign_lead_id) return;
  try {
    const { data: leadRow } = await sb.from("campaign_leads").select("*").eq("id", job.campaign_lead_id).maybeSingle();
    if (!leadRow) return;
    const stepNumber = await resolveStepNumber(job);
    const { scheduleNextStepForLead } = await import("./sequence");
    await scheduleNextStepForLead(leadRow, stepNumber);
  } catch (e) {
    console.warn("[sequence] failed to schedule next step", e);
  }
}

async function resolveStepNumber(job: EmailJob): Promise<number> {
  if (!job.sequence_step_id) return 1;
  const { data } = await sb.from("campaign_sequence_steps").select("step_number").eq("id", job.sequence_step_id).maybeSingle();
  return (data?.step_number as number | undefined) ?? 1;
}

async function markFailed(jobId: string, reason: string) {
  const now = new Date().toISOString();
  await updateEmailJob(jobId, { status: "failed", failed_at: now, failure_reason: reason });
  await logEmailEvent({ email_job_id: jobId, event_type: "failed", metadata: { reason } });
}
async function markSkipped(jobId: string, reason: string) {
  await updateEmailJob(jobId, { status: "skipped", failure_reason: reason });
  await logEmailEvent({ email_job_id: jobId, event_type: "skipped", metadata: { reason } });
}

export type RenderedEmail = {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  missing: string[];
};

export function renderForBusiness(
  subject: string,
  body: string,
  business: Business,
  category: Category | null,
  campaign: Pick<Campaign, "sender_name" | "sender_company"> | null,
  fallbacks: Record<string, string> = {},
): RenderedEmail {
  const vars = { ...buildVariableMap({ business, category, campaign }) };
  for (const k of Object.keys(fallbacks)) {
    if (!vars[k as keyof typeof vars]) vars[k as keyof typeof vars] = fallbacks[k];
  }
  const missing = [...new Set([...findMissingVariables(subject, vars), ...findMissingVariables(body, vars)])];
  const renderedSubject = renderTemplate(subject, vars);
  const renderedText = renderTemplate(body, vars);
  const renderedHtml = textToHtml(renderedText);
  return { subject: renderedSubject, bodyText: renderedText, bodyHtml: renderedHtml, missing };
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
}
