import { supabase } from "@/integrations/supabase/client";
import type { Business, Category, ImportRecord, MappingTemplate } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await sb.from("categories").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(input: { name: string; color: string; description?: string | null }) {
  const { data, error } = await sb.from("categories").insert(input).select().single();
  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { error } = await sb.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBusinesses(): Promise<Business[]> {
  const { data, error } = await sb
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data ?? [];
}

export async function updateBusiness(id: string, patch: Partial<Business>) {
  const { error } = await sb.from("businesses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBusinesses(ids: string[]) {
  const { error } = await sb.from("businesses").delete().in("id", ids);
  if (error) throw error;
}

export async function bulkUpdateBusinesses(ids: string[], patch: Partial<Business>) {
  const { error } = await sb.from("businesses").update(patch).in("id", ids);
  if (error) throw error;
}

export async function fetchImports(): Promise<ImportRecord[]> {
  const { data, error } = await sb.from("imports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchImport(id: string): Promise<ImportRecord | null> {
  const { data, error } = await sb.from("imports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchBusinessesByImport(importId: string): Promise<Business[]> {
  const { data, error } = await sb.from("businesses").select("*").eq("import_id", importId);
  if (error) throw error;
  return data ?? [];
}

export async function insertImport(rec: Partial<ImportRecord> & { filename: string; category_id: string | null }) {
  const { data, error } = await sb.from("imports").insert(rec).select().single();
  if (error) throw error;
  return data as ImportRecord;
}

export async function updateImport(id: string, patch: Partial<ImportRecord>) {
  const { error } = await sb.from("imports").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteImport(id: string) {
  const { error } = await sb.from("imports").delete().eq("id", id);
  if (error) throw error;
}

export async function insertBusinesses(rows: Partial<Business>[]) {
  if (rows.length === 0) return;
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await sb.from("businesses").insert(rows.slice(i, i + chunk));
    if (error) throw error;
  }
}

// ---------- Mapping templates ----------
export async function fetchMappingTemplates(): Promise<MappingTemplate[]> {
  const { data, error } = await sb
    .from("mapping_templates")
    .select("*")
    .order("last_used_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertMappingTemplate(input: {
  name: string;
  raw_headers: string[];
  normalized_mapping: Record<string, string>;
  confidence_summary: Record<string, number>;
  fingerprints: { header: string; topField: string; topScore: number; uniqueRatio: number }[];
  sample_values?: Record<string, string[]>;
}) {
  const { data, error } = await sb
    .from("mapping_templates")
    .insert({ ...input, use_count: 1, last_used_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as MappingTemplate;
}

export async function updateMappingTemplate(id: string, patch: Partial<MappingTemplate>) {
  const { error } = await sb.from("mapping_templates").update(patch).eq("id", id);
  if (error) throw error;
}

export async function duplicateMappingTemplate(t: MappingTemplate) {
  const { data, error } = await sb
    .from("mapping_templates")
    .insert({
      name: t.name + " (copy)",
      raw_headers: t.raw_headers,
      normalized_mapping: t.normalized_mapping,
      confidence_summary: t.confidence_summary,
      fingerprints: t.fingerprints,
      sample_values: t.sample_values,
      use_count: 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as MappingTemplate;
}

export async function bumpMappingTemplate(id: string) {
  const { data: cur } = await sb.from("mapping_templates").select("use_count").eq("id", id).single();
  await sb
    .from("mapping_templates")
    .update({ use_count: (cur?.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq("id", id);
}

export async function deleteMappingTemplate(id: string) {
  const { error } = await sb.from("mapping_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchImportsByTemplate(templateId: string): Promise<ImportRecord[]> {
  const { data, error } = await sb
    .from("imports")
    .select("*")
    .eq("mapping_template_id", templateId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------- Saved segments ----------
import type { SavedSegment, SegmentFilters } from "./segments";

export async function fetchSegments(): Promise<SavedSegment[]> {
  const { data, error } = await sb.from("saved_segments").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createSegment(input: { name: string; filters: SegmentFilters }) {
  const { data, error } = await sb.from("saved_segments").insert(input).select().single();
  if (error) throw error;
  return data as SavedSegment;
}
export async function updateSegment(id: string, patch: Partial<SavedSegment>) {
  const { error } = await sb.from("saved_segments").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteSegment(id: string) {
  const { error } = await sb.from("saved_segments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Exports history ----------
export type ExportRecord = {
  id: string;
  name: string;
  source_type: string;
  segment_id: string | null;
  category_id: string | null;
  record_count: number;
  format: string;
  fields: string[];
  options: Record<string, unknown>;
  filters_snapshot: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchExports(): Promise<ExportRecord[]> {
  const { data, error } = await sb.from("exports").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data ?? [];
}
export async function createExportRecord(input: Partial<ExportRecord>) {
  const { data, error } = await sb.from("exports").insert(input).select().single();
  if (error) throw error;
  return data as ExportRecord;
}
export async function deleteExportRecord(id: string) {
  const { error } = await sb.from("exports").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Pipeline stages ----------
import type { PipelineStage, Activity, Task } from "./pipeline";

export async function fetchPipelineStages(): Promise<PipelineStage[]> {
  const { data, error } = await sb.from("pipeline_stages").select("*").order("order_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
export async function createPipelineStage(input: { name: string; order_index: number }) {
  const { data, error } = await sb.from("pipeline_stages").insert(input).select().single();
  if (error) throw error;
  return data as PipelineStage;
}
export async function updatePipelineStage(id: string, patch: Partial<PipelineStage>) {
  const { error } = await sb.from("pipeline_stages").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deletePipelineStage(id: string) {
  const { error } = await sb.from("pipeline_stages").delete().eq("id", id);
  if (error) throw error;
}
export async function resetDefaultStages() {
  await sb.from("pipeline_stages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const defaults = [
    "New","Cleaned","Qualified","Ready for outreach","Contacted manually",
    "Follow-up needed","Not interested","Bad fit","Won","Lost",
  ];
  await sb.from("pipeline_stages").insert(
    defaults.map((name, i) => ({ name, order_index: i, is_default: true })),
  );
}

// ---------- Activities ----------
export async function fetchActivities(businessId: string): Promise<Activity[]> {
  const { data, error } = await sb
    .from("activities").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export async function createActivity(
  input: Partial<Activity> & { business_id: string; type: string; title: string },
) {
  const { data, error } = await sb.from("activities").insert(input).select().single();
  if (error) throw error;
  await sb.from("businesses").update({ last_activity_at: new Date().toISOString() }).eq("id", input.business_id);
  return data as Activity;
}
export async function updateActivity(id: string, patch: Partial<Activity>) {
  const { error } = await sb.from("activities").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteActivity(id: string) {
  const { error } = await sb.from("activities").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Tasks ----------
export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await sb
    .from("tasks").select("*")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
export async function createTask(input: Partial<Task> & { title: string }) {
  const { data, error } = await sb.from("tasks").insert(input).select().single();
  if (error) throw error;
  return data as Task;
}
export async function updateTask(id: string, patch: Partial<Task>) {
  const { error } = await sb.from("tasks").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTask(id: string) {
  const { error } = await sb.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
