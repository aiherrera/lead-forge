import type { Business } from "@/lib/types";

export type SampleContext = {
  business: Partial<Business>;
  campaignName?: string;
};

export function buildVariables(ctx: SampleContext): Record<string, string | number | null> {
  const b = ctx.business;
  const domain = b.website_url ? safeDomain(b.website_url) : "";
  return {
    businessName: b.name ?? "",
    businessCategory: b.business_category ?? "",
    category: b.business_category ?? "",
    rating: b.rating ?? 0,
    reviewCount: b.review_count ?? 0,
    leadQualityScore: 0,
    phone: b.phone ?? "",
    email: b.email ?? "",
    websiteUrl: b.website_url ?? "",
    googleMapsUrl: b.gmaps_url ?? "",
    address: b.address ?? "",
    city: b.city ?? "",
    state: b.state ?? "",
    contactPageUrl: "",
    pipelineStage: b.pipeline_stage ?? "",
    priority: b.priority ?? "",
    status: b.status ?? "",
    cleanupStatus: b.cleanup_status ?? "",
    lastContactedAt: b.last_contacted_at ?? "",
    lastEmailSentAt: b.last_emailed_at ?? "",
    replyStatus: b.reply_outcome ?? "",
    notes: b.notes ?? "",
    sourceImport: b.source_file ?? "",
    campaignName: ctx.campaignName ?? "",
    domain,
  };
}

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function renderJsonTemplate(template: string, vars: Record<string, unknown>): unknown {
  // Try to parse template as JSON, render values; if not JSON return rendered string.
  try {
    const parsed = JSON.parse(template);
    return walk(parsed, vars);
  } catch {
    return renderTemplate(template, vars);
  }
}

function walk(node: unknown, vars: Record<string, unknown>): unknown {
  if (typeof node === "string") return renderTemplate(node, vars);
  if (Array.isArray(node)) return node.map((n) => walk(n, vars));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = walk(v, vars);
    return out;
  }
  return node;
}

export function safeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function defaultWebhookTemplate(): string {
  return JSON.stringify(
    {
      event: "lead.sync",
      source: "leadforge",
      business: {
        name: "{{businessName}}",
        category: "{{businessCategory}}",
        email: "{{email}}",
        phone: "{{phone}}",
        website: "{{websiteUrl}}",
        googleMapsUrl: "{{googleMapsUrl}}",
        address: "{{address}}",
        city: "{{city}}",
        state: "{{state}}",
        rating: "{{rating}}",
        reviewCount: "{{reviewCount}}",
        pipelineStage: "{{pipelineStage}}",
        status: "{{status}}",
      },
      campaign: { name: "{{campaignName}}", lastEmailSentAt: "{{lastEmailSentAt}}", replyStatus: "{{replyStatus}}" },
    },
    null,
    2,
  );
}

export const SAMPLE_BUSINESS = {
  name: "Acme Coffee Roasters",
  business_category: "Coffee shop",
  rating: 4.6,
  review_count: 312,
  phone: "+1 415 555 0142",
  email: "hello@acmecoffee.com",
  website_url: "https://acmecoffee.com",
  gmaps_url: "https://maps.google.com/?cid=12345",
  address: "123 Market St, San Francisco, CA",
  city: "San Francisco",
  state: "CA",
  pipeline_stage: "qualified",
  status: "qualified",
  priority: "high",
  cleanup_status: "clean",
} as Partial<Business>;
