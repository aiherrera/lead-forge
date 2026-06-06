import type { Business, Category } from "../types";
import type { Campaign, TemplateVariable } from "./types";
import { TEMPLATE_VARIABLES } from "./types";

export type PersonalizationContext = {
  business: Business;
  category?: Category | null;
  campaign?: Pick<Campaign, "sender_name" | "sender_company"> | null;
};

export function buildVariableMap(ctx: PersonalizationContext): Record<TemplateVariable, string> {
  const b = ctx.business;
  const cat = ctx.category;
  const firstWord = (b.name ?? "").trim().split(/\s+/)[0] ?? "";
  return {
    businessName: b.name ?? "",
    category: cat?.name ?? "",
    businessCategory: b.business_category ?? "",
    city: b.city ?? "",
    state: b.state ?? "",
    websiteUrl: b.website_url ?? "",
    contactPageUrl: b.website_url ? `${b.website_url.replace(/\/$/, "")}/contact` : "",
    rating: b.rating != null ? String(b.rating) : "",
    reviewCount: b.review_count != null ? String(b.review_count) : "",
    phone: b.phone ?? "",
    firstName: firstWord,
    companyName: b.name ?? "",
    senderName: ctx.campaign?.sender_name ?? "",
    senderCompany: ctx.campaign?.sender_company ?? "",
  };
}

const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g;

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(VAR_RE, (_, key: string) => vars[key] ?? "");
}

export function findMissingVariables(template: string, vars: Record<string, string>): string[] {
  const missing = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE.source, "g");
  while ((m = re.exec(template)) !== null) {
    const k = m[1];
    if (!(k in vars) || !vars[k]?.trim()) missing.add(k);
  }
  return [...missing];
}

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(VAR_RE.source, "g");
  while ((m = re.exec(template)) !== null) found.add(m[1]);
  return [...found];
}

export const ALL_VARIABLES = TEMPLATE_VARIABLES;
