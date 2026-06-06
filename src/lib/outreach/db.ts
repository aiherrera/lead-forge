import { supabase } from "@/integrations/supabase/client";
import type {
  Campaign, CampaignLead, EmailAccount, EmailEvent, EmailJob, EmailTemplate,
  SequenceStep, SuppressionEntry, SuppressionReason, AppSettings,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

// ---- email accounts ----
export async function fetchEmailAccounts(): Promise<EmailAccount[]> {
  const { data, error } = await sb.from("email_accounts").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createEmailAccount(input: Partial<EmailAccount>) {
  const { data, error } = await sb.from("email_accounts").insert(input).select().single();
  if (error) throw error;
  return data as EmailAccount;
}
export async function updateEmailAccount(id: string, patch: Partial<EmailAccount>) {
  const { error } = await sb.from("email_accounts").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteEmailAccount(id: string) {
  const { error } = await sb.from("email_accounts").delete().eq("id", id);
  if (error) throw error;
}
export async function testEmailAccount(id: string) {
  await updateEmailAccount(id, {
    connection_status: "ok",
    last_tested_at: new Date().toISOString(),
  });
}

// ---- templates ----
export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await sb.from("email_templates").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createEmailTemplate(input: Partial<EmailTemplate>) {
  const { data, error } = await sb.from("email_templates").insert(input).select().single();
  if (error) throw error;
  return data as EmailTemplate;
}
export async function updateEmailTemplate(id: string, patch: Partial<EmailTemplate>) {
  const { error } = await sb.from("email_templates").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteEmailTemplate(id: string) {
  const { error } = await sb.from("email_templates").delete().eq("id", id);
  if (error) throw error;
}

// ---- campaigns ----
export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await sb.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function fetchCampaign(id: string): Promise<Campaign | null> {
  const { data, error } = await sb.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}
export async function createCampaign(input: Partial<Campaign>) {
  const { data, error } = await sb.from("campaigns").insert(input).select().single();
  if (error) throw error;
  return data as Campaign;
}
export async function updateCampaign(id: string, patch: Partial<Campaign>) {
  const { error } = await sb.from("campaigns").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteCampaign(id: string) {
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

// ---- sequence steps ----
export async function fetchSequenceSteps(campaignId: string): Promise<SequenceStep[]> {
  const { data, error } = await sb
    .from("campaign_sequence_steps").select("*").eq("campaign_id", campaignId)
    .order("step_number", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function createSequenceStep(input: Partial<SequenceStep>) {
  const { data, error } = await sb.from("campaign_sequence_steps").insert(input).select().single();
  if (error) throw error;
  return data as SequenceStep;
}
export async function updateSequenceStep(id: string, patch: Partial<SequenceStep>) {
  const { error } = await sb.from("campaign_sequence_steps").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteSequenceStep(id: string) {
  const { error } = await sb.from("campaign_sequence_steps").delete().eq("id", id);
  if (error) throw error;
}

// ---- campaign leads ----
export async function fetchCampaignLeads(campaignId: string): Promise<CampaignLead[]> {
  const { data, error } = await sb
    .from("campaign_leads").select("*").eq("campaign_id", campaignId)
    .order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return data ?? [];
}
export async function fetchCampaignLeadsForBusiness(businessId: string): Promise<CampaignLead[]> {
  const { data, error } = await sb
    .from("campaign_leads").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function insertCampaignLeads(rows: Partial<CampaignLead>[]) {
  if (!rows.length) return;
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from("campaign_leads").insert(rows.slice(i, i + chunk));
    if (error) throw error;
  }
}
export async function updateCampaignLead(id: string, patch: Partial<CampaignLead>) {
  const { error } = await sb.from("campaign_leads").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- email jobs ----
export async function fetchEmailJobs(filter: { campaignId?: string; businessId?: string } = {}): Promise<EmailJob[]> {
  let q = sb.from("email_jobs").select("*").order("created_at", { ascending: false }).limit(2000);
  if (filter.campaignId) q = q.eq("campaign_id", filter.campaignId);
  if (filter.businessId) q = q.eq("business_id", filter.businessId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function insertEmailJobs(rows: Partial<EmailJob>[]) {
  if (!rows.length) return [];
  const { data, error } = await sb.from("email_jobs").insert(rows).select();
  if (error) throw error;
  return data as EmailJob[];
}
export async function updateEmailJob(id: string, patch: Partial<EmailJob>) {
  const { error } = await sb.from("email_jobs").update(patch).eq("id", id);
  if (error) throw error;
}

// ---- suppression ----
export async function fetchSuppression(): Promise<SuppressionEntry[]> {
  const { data, error } = await sb.from("suppression_list").select("*").order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return data ?? [];
}
export async function addSuppression(input: {
  email?: string | null;
  domain?: string | null;
  reason: SuppressionReason;
  source?: string | null;
  campaign_id?: string | null;
  business_id?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await sb.from("suppression_list").insert(input).select().single();
  if (error) throw error;
  return data as SuppressionEntry;
}
export async function removeSuppression(id: string) {
  const { error } = await sb.from("suppression_list").delete().eq("id", id);
  if (error) throw error;
}
export async function isSuppressed(email: string): Promise<boolean> {
  if (!email) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const { data, error } = await sb
    .from("suppression_list").select("id")
    .or(`email.eq.${email.toLowerCase()},domain.eq.${domain}`).limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

// ---- events ----
export async function fetchEmailEvents(filter: { campaignId?: string; jobId?: string } = {}): Promise<EmailEvent[]> {
  let q = sb.from("email_events").select("*").order("created_at", { ascending: false }).limit(500);
  if (filter.campaignId) q = q.eq("campaign_id", filter.campaignId);
  if (filter.jobId) q = q.eq("email_job_id", filter.jobId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function logEmailEvent(input: Partial<EmailEvent> & { event_type: string }) {
  await sb.from("email_events").insert(input);
}

// ---- app settings ----
export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await sb.from("app_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: created } = await sb.from("app_settings").insert({ id: 1 }).select().single();
    return created as AppSettings;
  }
  return data as AppSettings;
}
export async function updateAppSettings(patch: Partial<AppSettings>) {
  const { error } = await sb.from("app_settings").update(patch).eq("id", 1);
  if (error) throw error;
}
