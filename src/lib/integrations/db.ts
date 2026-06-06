import { supabase } from "@/integrations/supabase/client";
import type { Integration, IntegrationMapping, SyncJob, SyncRule, SyncEvent, ExternalRecord } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export async function fetchIntegrations(): Promise<Integration[]> {
  const { data, error } = await sb.from("integrations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function fetchIntegration(id: string): Promise<Integration | null> {
  const { data, error } = await sb.from("integrations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function createIntegration(input: Partial<Integration>) {
  const { data, error } = await sb.from("integrations").insert(input).select().single();
  if (error) throw error;
  return data as Integration;
}
export async function updateIntegration(id: string, patch: Partial<Integration>) {
  const { error } = await sb.from("integrations").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteIntegration(id: string) {
  const { error } = await sb.from("integrations").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMappings(integrationId: string): Promise<IntegrationMapping[]> {
  const { data, error } = await sb.from("integration_mappings").select("*").eq("integration_id", integrationId).order("created_at");
  if (error) throw error;
  return data ?? [];
}
export async function upsertMappings(integrationId: string, mappings: Partial<IntegrationMapping>[]) {
  await sb.from("integration_mappings").delete().eq("integration_id", integrationId);
  if (!mappings.length) return;
  const rows = mappings.map((m) => ({ ...m, integration_id: integrationId }));
  const { error } = await sb.from("integration_mappings").insert(rows);
  if (error) throw error;
}

export async function fetchSyncRules(integrationId?: string): Promise<SyncRule[]> {
  let q = sb.from("sync_rules").select("*").order("created_at", { ascending: false });
  if (integrationId) q = q.eq("integration_id", integrationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function createSyncRule(input: Partial<SyncRule>) {
  const { data, error } = await sb.from("sync_rules").insert(input).select().single();
  if (error) throw error;
  return data as SyncRule;
}
export async function updateSyncRule(id: string, patch: Partial<SyncRule>) {
  const { error } = await sb.from("sync_rules").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteSyncRule(id: string) {
  const { error } = await sb.from("sync_rules").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSyncJobs(filter: { integrationId?: string; status?: string; businessId?: string } = {}): Promise<SyncJob[]> {
  let q = sb.from("sync_jobs").select("*").order("created_at", { ascending: false }).limit(500);
  if (filter.integrationId) q = q.eq("integration_id", filter.integrationId);
  if (filter.status) q = q.eq("status", filter.status);
  if (filter.businessId) q = q.eq("business_id", filter.businessId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function insertSyncJobs(rows: Partial<SyncJob>[]) {
  if (!rows.length) return [];
  const { data, error } = await sb.from("sync_jobs").insert(rows).select();
  if (error) throw error;
  return data as SyncJob[];
}
export async function updateSyncJob(id: string, patch: Partial<SyncJob>) {
  const { error } = await sb.from("sync_jobs").update(patch).eq("id", id);
  if (error) throw error;
}

export async function fetchSyncEvents(jobId?: string): Promise<SyncEvent[]> {
  let q = sb.from("sync_events").select("*").order("created_at", { ascending: false }).limit(500);
  if (jobId) q = q.eq("sync_job_id", jobId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
export async function logSyncEvent(input: Partial<SyncEvent> & { event_type: string }) {
  await sb.from("sync_events").insert(input);
}

export async function fetchExternalRecords(businessId?: string): Promise<ExternalRecord[]> {
  let q = sb.from("external_records").select("*").order("last_synced_at", { ascending: false });
  if (businessId) q = q.eq("business_id", businessId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
