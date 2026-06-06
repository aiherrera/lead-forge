import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Auth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "custom_header"; header: string; value: string };

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

type AirtableConfig = {
  secret_name: string;
  base_id: string;
  table_name: string;
};

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
    businessName: b.name ?? "",
    businessCategory: b.business_category ?? "",
    category: b.business_category ?? "",
    rating: b.rating ?? 0,
    reviewCount: b.review_count ?? 0,
    leadQualityScore: b.lead_quality_score ?? 0,
    phone: b.phone ?? "",
    email: b.email ?? "",
    websiteUrl: b.website_url ?? "",
    googleMapsUrl: b.gmaps_url ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    state: b.state ?? "",
    contactPageUrl: b.contact_page_url ?? "",
    pipelineStage: b.pipeline_stage ?? "",
    priority: b.priority ?? "",
    status: b.status ?? "",
    cleanupStatus: b.cleanup_status ?? "",
    lastContactedAt: b.last_contacted_at ?? "",
    lastEmailSentAt: b.last_emailed_at ?? "",
    replyStatus: b.reply_outcome ?? "",
    notes: b.notes ?? "",
    sourceImport: b.source_file ?? "",
    campaignName: "",
  };
}

function render(template: string, vars: Record<string, unknown>): unknown {
  try {
    const parsed = JSON.parse(template);
    return walk(parsed, vars);
  } catch {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
  }
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

export type SyncBusinessesInput = {
  integrationId: string;
  businessIds: string[];
};

export type SyncBusinessesResult = {
  total: number;
  succeeded: number;
  failed: number;
  errors: { businessId: string; message: string }[];
};

export const syncBusinesses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SyncBusinessesInput) => d)
  .handler(async ({ data, context }): Promise<SyncBusinessesResult> => {
    const { supabase } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = supabase;

    const { data: integration, error: ie } = await sb.from("integrations").select("*").eq("id", data.integrationId).maybeSingle();
    if (ie || !integration) throw new Error("Integration not found");
    if (!integration.is_enabled) throw new Error("Integration is disabled");

    const { data: mappings } = await sb.from("integration_mappings").select("*").eq("integration_id", data.integrationId);

    const { data: businesses, error: be } = await sb.from("businesses").select("*").in("id", data.businessIds);
    if (be) throw be;

    const result: SyncBusinessesResult = { total: businesses?.length ?? 0, succeeded: 0, failed: 0, errors: [] };

    for (const biz of businesses ?? []) {
      const vars = buildVars(biz);
      let payload: unknown;
      let mapped: Record<string, unknown> = {};

      if (mappings && mappings.length > 0) {
        for (const m of mappings) {
          mapped[m.target_field] = applyTransform(vars[m.source_field], m.transformation || "text");
        }
      } else {
        mapped = vars;
      }

      try {
        let status = 0;
        let response: unknown = null;

        if (integration.provider === "webhook" || integration.provider === "zapier" || integration.provider === "make") {
          const cfg = integration.config as WebhookConfig;
          // Use mapping output if any, else render template
          if (mappings && mappings.length > 0) {
            payload = mapped;
          } else {
            payload = cfg.payload_template ? render(cfg.payload_template, vars) : vars;
          }
          const headers: Record<string, string> = { "content-type": "application/json", ...(cfg.custom_headers ?? {}) };
          if (cfg.auth_type === "bearer") headers["authorization"] = `Bearer ${cfg.bearer_token ?? ""}`;
          if (cfg.auth_type === "custom_header" && cfg.header_name) headers[cfg.header_name.toLowerCase()] = cfg.header_value ?? "";
          const res = await fetch(cfg.url, { method: cfg.method ?? "POST", headers, body: JSON.stringify(payload) });
          status = res.status;
          response = (await res.text().catch(() => "")).slice(0, 4000);
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        } else if (integration.provider === "airtable") {
          const cfg = integration.config as AirtableConfig;
          const key = process.env[cfg.secret_name];
          if (!key) throw new Error(`Secret "${cfg.secret_name}" is not set`);
          payload = { fields: mapped };
          const url = `https://api.airtable.com/v0/${encodeURIComponent(cfg.base_id)}/${encodeURIComponent(cfg.table_name)}`;
          const res = await fetch(url, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          status = res.status;
          const json = await res.json().catch(() => ({}));
          response = json;
          if (!res.ok) throw new Error((json as { error?: { message?: string } })?.error?.message ?? `${res.status} ${res.statusText}`);
          if ((json as { id?: string }).id) {
            await sb.from("external_records").upsert({
              integration_id: integration.id,
              business_id: biz.id,
              provider: integration.provider,
              external_object_type: "record",
              external_record_id: (json as { id: string }).id,
              external_url: `https://airtable.com/${cfg.base_id}/${(json as { id: string }).id}`,
              last_synced_at: new Date().toISOString(),
            }, { onConflict: "integration_id,business_id" });
          }
        } else {
          throw new Error(`Provider ${integration.provider} is not enabled for sync yet`);
        }

        await sb.from("sync_jobs").insert({
          integration_id: integration.id,
          business_id: biz.id,
          target_object: "lead",
          action: "create",
          status: "success",
          payload: payload as Record<string, unknown>,
          response: response as Record<string, unknown> | null,
          status_code: status,
          completed_at: new Date().toISOString(),
        });
        result.succeeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb.from("sync_jobs").insert({
          integration_id: integration.id,
          business_id: biz.id,
          target_object: "lead",
          action: "create",
          status: "failed",
          payload: payload as Record<string, unknown> ?? mapped,
          error_message: msg,
          completed_at: new Date().toISOString(),
        });
        result.failed++;
        result.errors.push({ businessId: biz.id, message: msg });
      }
    }

    await sb.from("integrations").update({
      last_sync_at: new Date().toISOString(),
      last_error: result.failed > 0 ? `${result.failed} of ${result.total} failed` : null,
      status: result.failed === result.total && result.total > 0 ? "error" : "connected",
    }).eq("id", integration.id);

    return result;
  });
