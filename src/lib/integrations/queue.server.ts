import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_RETRIES = 5;
const BATCH_SIZE = 50;

type WebhookConfig = {
  url: string;
  method: "POST" | "PUT";
  auth_type: "none" | "bearer" | "custom_header";
  bearer_token?: string;
  header_name?: string;
  header_value?: string;
  payload_template?: string;
  custom_headers?: Record<string, string>;
};
type AirtableConfig = { secret_name: string; base_id: string; table_name: string };

function applyTransform(value: unknown, transform: string): unknown {
  if (value == null) return null;
  const s = String(value);
  switch (transform) {
    case "number": { const n = Number(s); return Number.isFinite(n) ? n : null; }
    case "boolean": return /^(true|1|yes|y)$/i.test(s);
    case "url": return s.startsWith("http") ? s : `https://${s}`;
    case "email": return s.toLowerCase().trim();
    case "phone": return s.replace(/[^\d+]/g, "");
    case "csv": return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    case "domain": try { return new URL(s.startsWith("http") ? s : `https://${s}`).hostname.replace(/^www\./, ""); } catch { return s; }
    case "date": try { return new Date(s).toISOString(); } catch { return s; }
    default: return s;
  }
}

function buildVars(b: Record<string, unknown>): Record<string, unknown> {
  return {
    businessName: b.name ?? "", businessCategory: b.business_category ?? "", category: b.business_category ?? "",
    rating: b.rating ?? 0, reviewCount: b.review_count ?? 0, leadQualityScore: b.lead_quality_score ?? 0,
    phone: b.phone ?? "", email: b.email ?? "", websiteUrl: b.website_url ?? "", googleMapsUrl: b.gmaps_url ?? "",
    address: b.address ?? "", city: b.city ?? "", state: b.state ?? "", contactPageUrl: b.contact_page_url ?? "",
    pipelineStage: b.pipeline_stage ?? "", priority: b.priority ?? "", status: b.status ?? "",
    cleanupStatus: b.cleanup_status ?? "", lastContactedAt: b.last_contacted_at ?? "",
    lastEmailSentAt: b.last_emailed_at ?? "", replyStatus: b.reply_outcome ?? "",
    notes: b.notes ?? "", sourceImport: b.source_file ?? "", campaignName: "",
  };
}
function walk(node: unknown, vars: Record<string, unknown>): unknown {
  if (typeof node === "string") return node.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
  if (Array.isArray(node)) return node.map((n) => walk(n, vars));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, vars);
    return out;
  }
  return node;
}
function render(template: string, vars: Record<string, unknown>): unknown {
  try { return walk(JSON.parse(template), vars); } catch { return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? "")); }
}

export type ProcessQueueResult = {
  processed: number; succeeded: number; failed: number; retried: number; permanentlyFailed: number;
};

export async function processQueue(): Promise<ProcessQueueResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin;
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await sb.from("sync_jobs").select("*")
    .eq("status", "pending").lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true }).limit(BATCH_SIZE);
  if (error) throw error;

  const results: ProcessQueueResult = { processed: 0, succeeded: 0, failed: 0, retried: 0, permanentlyFailed: 0 };

  for (const job of jobs ?? []) {
    results.processed++;
    await sb.from("sync_jobs").update({ status: "running" }).eq("id", job.id);
    try {
      const r = await runOne(job);
      if (!r.ok) throw new Error(r.error || `HTTP ${r.status}`);
      results.succeeded++;
      await sb.from("sync_jobs").update({
        status: "success", status_code: r.status, response: r.response ?? null, completed_at: new Date().toISOString(),
      }).eq("id", job.id);
      await sb.from("sync_events").insert({
        sync_job_id: job.id, integration_id: job.integration_id, business_id: job.business_id,
        event_type: "success", message: `HTTP ${r.status}`,
      });
      if (r.externalId && job.business_id) {
        await sb.from("external_records").upsert({
          integration_id: job.integration_id, business_id: job.business_id, provider: r.provider,
          external_object_type: "record", external_record_id: r.externalId, external_url: r.externalUrl ?? null,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "integration_id,business_id" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retries = (job.retry_count ?? 0) + 1;
      if (retries >= MAX_RETRIES) {
        results.permanentlyFailed++;
        await sb.from("sync_jobs").update({
          status: "failed", retry_count: retries, error_message: msg, completed_at: new Date().toISOString(),
        }).eq("id", job.id);
        await sb.from("sync_events").insert({
          sync_job_id: job.id, integration_id: job.integration_id, business_id: job.business_id,
          event_type: "permanent_failure", message: msg,
        });
      } else {
        results.retried++;
        const backoffSec = Math.min(3600, Math.pow(2, retries) * 30);
        const next = new Date(Date.now() + backoffSec * 1000).toISOString();
        await sb.from("sync_jobs").update({
          status: "pending", retry_count: retries, error_message: msg, scheduled_at: next,
        }).eq("id", job.id);
        await sb.from("sync_events").insert({
          sync_job_id: job.id, integration_id: job.integration_id, business_id: job.business_id,
          event_type: "retry_scheduled", message: msg, metadata: { retries, next },
        });
      }
      results.failed++;
    }
  }
  return results;
}

type RunResult = {
  ok: boolean; status: number; response?: unknown; error?: string;
  externalId?: string; externalUrl?: string; provider: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runOne(job: any): Promise<RunResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = supabaseAdmin;
  const { data: integration } = await sb.from("integrations").select("*").eq("id", job.integration_id).maybeSingle();
  if (!integration) return { ok: false, status: 0, error: "Integration not found", provider: "unknown" };
  if (!integration.is_enabled) return { ok: false, status: 0, error: "Integration disabled", provider: integration.provider };

  const { data: mappings } = await sb.from("integration_mappings").select("*").eq("integration_id", integration.id);

  let business: Record<string, unknown> = {};
  if (job.business_id) {
    const { data: b } = await sb.from("businesses").select("*").eq("id", job.business_id).maybeSingle();
    business = b ?? {};
  }
  const vars = buildVars(business);

  let mapped: Record<string, unknown> = {};
  if (mappings && mappings.length > 0) {
    for (const m of mappings) mapped[m.target_field] = applyTransform(vars[m.source_field], m.transformation || "text");
  } else { mapped = vars; }

  if (integration.provider === "webhook" || integration.provider === "zapier" || integration.provider === "make") {
    const cfg = integration.config as WebhookConfig;
    const payload = mappings && mappings.length > 0 ? mapped : cfg.payload_template ? render(cfg.payload_template, vars) : vars;
    const headers: Record<string, string> = { "content-type": "application/json", ...(cfg.custom_headers ?? {}) };
    if (cfg.auth_type === "bearer") headers["authorization"] = `Bearer ${cfg.bearer_token ?? ""}`;
    if (cfg.auth_type === "custom_header" && cfg.header_name) headers[cfg.header_name.toLowerCase()] = cfg.header_value ?? "";
    const res = await fetch(cfg.url, { method: cfg.method ?? "POST", headers, body: JSON.stringify(payload) });
    const text = (await res.text().catch(() => "")).slice(0, 4000);
    return { ok: res.ok, status: res.status, response: text, error: res.ok ? undefined : `${res.status} ${res.statusText}`, provider: integration.provider };
  }
  if (integration.provider === "airtable") {
    const cfg = integration.config as AirtableConfig;
    const key = process.env[cfg.secret_name];
    if (!key) return { ok: false, status: 0, error: `Secret "${cfg.secret_name}" is not set`, provider: integration.provider };
    const res = await fetch(`https://api.airtable.com/v0/${encodeURIComponent(cfg.base_id)}/${encodeURIComponent(cfg.table_name)}`, {
      method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ fields: mapped }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message ?? `${res.status} ${res.statusText}`;
      return { ok: false, status: res.status, response: json, error: msg, provider: integration.provider };
    }
    const id = (json as { id?: string }).id;
    return { ok: true, status: res.status, response: json, provider: integration.provider,
      externalId: id, externalUrl: id ? `https://airtable.com/${cfg.base_id}/${id}` : undefined };
  }
  return { ok: false, status: 0, error: `Provider ${integration.provider} is not enabled for queue processing`, provider: integration.provider };
}
