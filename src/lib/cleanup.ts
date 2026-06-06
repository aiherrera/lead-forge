import type { Business } from "./types";
import { isValidPhone, isValidUrl, leadScore } from "./quality";

export type CleanupStatus = "needs_review" | "clean" | "ignored" | "merged" | "bad_data";

export const CLEANUP_STATUS_META: Record<CleanupStatus, { label: string; tone: string }> = {
  needs_review: { label: "Needs review", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  clean: { label: "Clean", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  ignored: { label: "Ignored", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  merged: { label: "Merged", tone: "bg-violet-100 text-violet-700 border-violet-200" },
  bad_data: { label: "Bad data", tone: "bg-rose-100 text-rose-700 border-rose-200" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IMG_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?.*)?$/i;

export function isValidEmail(v: string | null | undefined): boolean {
  return !!v && EMAIL_RE.test(v.trim());
}

export function isValidImageUrl(v: string | null | undefined): boolean {
  if (!v) return false;
  if (!isValidUrl(v)) return false;
  return IMG_RE.test(v) || /googleusercontent|gstatic|fbsbx/i.test(v);
}

export function isValidRating(r: number | null | undefined): boolean {
  return r == null || (r >= 0 && r <= 5);
}

export function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeWebsite(url: string | null | undefined): string {
  if (!url) return "";
  let s = url.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return u.protocol + "//" + host + path + (u.search || "");
  } catch {
    return url.trim();
  }
}

export function normalizeName(n: string | null | undefined): string {
  if (!n) return "";
  return n.replace(/\s+/g, " ").trim();
}

export function normalizeAddress(a: string | null | undefined): string {
  if (!a) return "";
  return a.replace(/\s+/g, " ").trim();
}

// ---------- invalid detection ----------
export function getInvalidFields(b: Business): string[] {
  const out: string[] = [];
  if (b.phone && !isValidPhone(b.phone)) out.push("phone");
  if (b.website_url && !isValidUrl(b.website_url)) out.push("website");
  if (b.email && !isValidEmail(b.email)) out.push("email");
  if (b.image_url && !isValidImageUrl(b.image_url)) out.push("image");
  if (!isValidRating(b.rating)) out.push("rating");
  return out;
}

// ---------- ready to export ----------
export function isReadyToExport(b: Business): boolean {
  if (b.status === "duplicate" || b.status === "bad_data") return false;
  if ((b as unknown as { cleanup_status?: CleanupStatus }).cleanup_status === "merged") return false;
  if (!b.name?.trim()) return false;
  if (!b.phone && !b.website_url) return false;
  if (getInvalidFields(b).length > 0) return false;
  return true;
}

// ---------- duplicate clustering ----------
function nameKey(n: string | null): string {
  return (n ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function addrKey(a: string | null): string {
  return (a ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
}
function phoneKey(p: string | null): string {
  return (p ?? "").replace(/\D/g, "");
}

export type Cluster = { key: string; reason: string; businesses: Business[] };

export function buildClusters(list: Business[]): Cluster[] {
  // Union-find
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let p = parent.get(x) ?? x;
    if (p !== x) { p = find(p); parent.set(x, p); }
    return p;
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  list.forEach((b) => parent.set(b.id, b.id));

  const groups = [
    new Map<string, string[]>(), // gmaps
    new Map<string, string[]>(), // phone
    new Map<string, string[]>(), // domain
    new Map<string, string[]>(), // name+addr
    new Map<string, string[]>(), // name+phone
    new Map<string, string[]>(), // name+domain
  ];
  const reasons = [
    "Same Google Maps URL",
    "Same phone number",
    "Same website domain",
    "Similar name + similar address",
    "Similar name + same phone",
    "Similar name + same website",
  ];
  const reasonByPair = new Map<string, string>();

  for (const b of list) {
    const g = b.gmaps_url ? b.gmaps_url.trim().toLowerCase() : "";
    const p = phoneKey(b.phone);
    const d = domainOf(b.website_url);
    const n = nameKey(b.name);
    const a = addrKey(b.address);
    if (g) (groups[0].get(g) ?? groups[0].set(g, []).get(g)!).push(b.id);
    if (p && p.length >= 7) (groups[1].get(p) ?? groups[1].set(p, []).get(p)!).push(b.id);
    if (d) (groups[2].get(d) ?? groups[2].set(d, []).get(d)!).push(b.id);
    if (n && a) (groups[3].get(n + "|" + a) ?? groups[3].set(n + "|" + a, []).get(n + "|" + a)!).push(b.id);
    if (n && p && p.length >= 7) (groups[4].get(n + "|" + p) ?? groups[4].set(n + "|" + p, []).get(n + "|" + p)!).push(b.id);
    if (n && d) (groups[5].get(n + "|" + d) ?? groups[5].set(n + "|" + d, []).get(n + "|" + d)!).push(b.id);
  }

  groups.forEach((m, i) => {
    for (const ids of m.values()) {
      if (ids.length < 2) continue;
      for (let j = 1; j < ids.length; j++) {
        union(ids[0], ids[j]);
        const pair = [ids[0], ids[j]].sort().join(":");
        if (!reasonByPair.has(pair)) reasonByPair.set(pair, reasons[i]);
      }
    }
  });

  const byRoot = new Map<string, Business[]>();
  for (const b of list) {
    const r = find(b.id);
    const arr = byRoot.get(r) ?? [];
    arr.push(b);
    byRoot.set(r, arr);
  }
  const clusters: Cluster[] = [];
  for (const [k, bs] of byRoot) {
    if (bs.length < 2) continue;
    // pick a representative reason
    let reason = "Possible duplicate";
    outer: for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const pair = [bs[i].id, bs[j].id].sort().join(":");
        const r = reasonByPair.get(pair);
        if (r) { reason = r; break outer; }
      }
    }
    clusters.push({ key: k, reason, businesses: bs.sort((a, b) => leadScore(b) - leadScore(a)) });
  }
  clusters.sort((a, b) => b.businesses.length - a.businesses.length);
  return clusters;
}

// ---------- merge ----------
export function mergeInto(primary: Business, others: Business[]): Partial<Business> {
  const pick = <K extends keyof Business>(key: K): Business[K] => {
    if (primary[key] != null && primary[key] !== "") return primary[key];
    for (const o of others) {
      if (o[key] != null && o[key] !== "") return o[key];
    }
    return primary[key];
  };
  const mergedIds = [
    ...((primary as unknown as { merged_from?: string[] }).merged_from ?? []),
    ...others.map((o) => o.id),
  ];
  const rawCombined: Record<string, unknown> = {
    primary: primary.raw_data ?? {},
    merged: others.map((o) => ({ id: o.id, name: o.name, raw: o.raw_data })),
  };
  return {
    name: pick("name"),
    business_category: pick("business_category"),
    phone: pick("phone"),
    email: pick("email"),
    website_url: pick("website_url"),
    gmaps_url: pick("gmaps_url"),
    image_url: pick("image_url"),
    address: pick("address"),
    city: pick("city"),
    state: pick("state"),
    rating: primary.rating ?? others.find((o) => o.rating != null)?.rating ?? null,
    review_count: primary.review_count ?? others.find((o) => o.review_count != null)?.review_count ?? null,
    rating_label: pick("rating_label"),
    opening_status: pick("opening_status"),
    closing_time: pick("closing_time"),
    review_snippet: pick("review_snippet"),
    raw_data: rawCombined,
    ...({ merged_from: mergedIds, cleanup_status: "clean" } as Partial<Business>),
  };
}
