import { supabase } from "@/integrations/supabase/client";
import { fetchSequenceSteps, insertEmailJobs, updateCampaignLead, fetchCampaign } from "./db";
import { renderForBusiness } from "./sender";
import type { Business, Category } from "../types";
import type { CampaignLead, EmailJob, SequenceStep } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

/**
 * After a successful send for `lead`, queue the next sequence step if one exists,
 * the lead hasn't replied/bounced/unsubscribed, and the step's send conditions allow it.
 *
 * Returns the inserted job (if any).
 */
export async function scheduleNextStepForLead(
  lead: CampaignLead,
  justSentStepNumber: number,
): Promise<EmailJob | null> {
  if (lead.replied_at || lead.unsubscribed_at || lead.bounced_at) return null;

  const steps = await fetchSequenceSteps(lead.campaign_id);
  const next = steps.find((s) => s.step_number === justSentStepNumber + 1);
  if (!next) {
    await updateCampaignLead(lead.id, { status: "completed", current_step: justSentStepNumber });
    return null;
  }

  const cond = next.send_condition ?? {};
  if (cond.send_if_no_reply && lead.replied_at) return null;
  if (cond.send_if_not_bounced && lead.bounced_at) return null;
  if (cond.send_if_not_unsubscribed && lead.unsubscribed_at) return null;

  const campaign = await fetchCampaign(lead.campaign_id);
  if (!campaign) return null;

  const { data: businessRow } = await sb.from("businesses").select("*").eq("id", lead.business_id).maybeSingle();
  if (!businessRow) return null;
  const business = businessRow as Business;
  if (!business.email) {
    await updateCampaignLead(lead.id, {
      status: "skipped",
      skipped_at: new Date().toISOString(),
      skip_reason: "missing_email_at_step_" + next.step_number,
    });
    return null;
  }

  let category: Category | null = null;
  if (business.category_id) {
    const { data: catRow } = await sb.from("categories").select("*").eq("id", business.category_id).maybeSingle();
    category = (catRow as Category | null) ?? null;
  }

  const rendered = renderForBusiness(next.subject, next.body_text, business, category, campaign);
  const scheduledAt = new Date(Date.now() + next.delay_days * 24 * 60 * 60 * 1000).toISOString();

  const [job] = await insertEmailJobs([
    {
      campaign_id: lead.campaign_id,
      campaign_lead_id: lead.id,
      business_id: lead.business_id,
      sequence_step_id: next.id,
      sender_account_id: campaign.sender_account_id,
      recipient_email: business.email,
      subject: rendered.subject,
      body_text: rendered.bodyText,
      body_html: rendered.bodyHtml,
      status: "scheduled",
      is_simulated: false,
      scheduled_at: scheduledAt,
      unsubscribe_token: lead.unsubscribe_token,
    },
  ]);

  await updateCampaignLead(lead.id, {
    current_step: next.step_number,
    next_email_scheduled_at: scheduledAt,
    status: "scheduled",
  });

  return job ?? null;
}

export function summarizeStep(s: SequenceStep): string {
  const parts: string[] = [`Step ${s.step_number}`];
  if (s.delay_days > 0) parts.push(`+${s.delay_days}d`);
  if (s.send_condition?.send_if_no_reply) parts.push("if no reply");
  if (s.send_condition?.stop_after_reply) parts.push("stop on reply");
  return parts.join(" · ");
}
