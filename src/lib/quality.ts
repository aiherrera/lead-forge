import type { Business } from "./types";

export type Warning =
  | "missing_phone"
  | "missing_website"
  | "missing_address"
  | "missing_rating"
  | "missing_gmaps"
  | "invalid_phone"
  | "invalid_url"
  | "possible_duplicate";

export const WARNING_LABEL: Record<Warning, string> = {
  missing_phone: "Missing phone",
  missing_website: "Missing website",
  missing_address: "Missing address",
  missing_rating: "Missing rating",
  missing_gmaps: "Missing Google Maps URL",
  invalid_phone: "Invalid phone",
  invalid_url: "Invalid website URL",
  possible_duplicate: "Possible duplicate",
};

export function isValidPhone(p: string | null): boolean {
  if (!p) return false;
  const d = p.replace(/\D/g, "");
  return d.length >= 7 && d.length <= 15;
}

export function isValidUrl(u: string | null): boolean {
  if (!u) return false;
  try {
    const url = new URL(u);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function leadScore(b: Business): number {
  let s = 0;
  if (b.phone && isValidPhone(b.phone)) s += 25;
  if (b.website_url && isValidUrl(b.website_url)) s += 20;
  if ((b.rating ?? 0) >= 4.5) s += 15;
  if ((b.review_count ?? 0) >= 20) s += 15;
  if (b.address) s += 10;
  if (b.gmaps_url) s += 10;
  if (b.opening_status || b.closing_time) s += 5;
  return Math.min(100, s);
}

export function scoreLabel(score: number): { label: string; tone: string } {
  if (score >= 80) return { label: "Strong lead", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (score >= 60) return { label: "Good lead", tone: "bg-sky-100 text-sky-700 border-sky-200" };
  if (score >= 40) return { label: "Needs review", tone: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "Weak data", tone: "bg-rose-100 text-rose-700 border-rose-200" };
}

function normKey(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type DuplicateIndex = {
  isDuplicate: (b: Business) => boolean;
  duplicatesOf: (b: Business) => Business[];
};

export function buildDuplicateIndex(list: Business[]): DuplicateIndex {
  const byGmaps = new Map<string, string[]>();
  const byPhone = new Map<string, string[]>();
  const bySite = new Map<string, string[]>();
  const byNameAddr = new Map<string, string[]>();
  const byId = new Map<string, Business>();

  const push = (m: Map<string, string[]>, k: string, id: string) => {
    if (!k) return;
    const arr = m.get(k) ?? [];
    arr.push(id);
    m.set(k, arr);
  };

  for (const b of list) {
    byId.set(b.id, b);
    if (b.gmaps_url) push(byGmaps, b.gmaps_url.trim().toLowerCase(), b.id);
    if (b.phone) push(byPhone, b.phone.replace(/\D/g, ""), b.id);
    if (b.website_url) push(bySite, b.website_url.trim().toLowerCase().replace(/\/+$/, ""), b.id);
    if (b.name && b.address) push(byNameAddr, normKey(b.name) + "|" + normKey(b.address), b.id);
  }

  const dupSet = new Set<string>();
  for (const m of [byGmaps, byPhone, bySite, byNameAddr]) {
    for (const ids of m.values()) {
      if (ids.length > 1) ids.forEach((id) => dupSet.add(id));
    }
  }

  function duplicatesOf(b: Business): Business[] {
    const ids = new Set<string>();
    const add = (m: Map<string, string[]>, k: string) => {
      if (!k) return;
      const arr = m.get(k);
      if (arr) arr.forEach((id) => id !== b.id && ids.add(id));
    };
    if (b.gmaps_url) add(byGmaps, b.gmaps_url.trim().toLowerCase());
    if (b.phone) add(byPhone, b.phone.replace(/\D/g, ""));
    if (b.website_url) add(bySite, b.website_url.trim().toLowerCase().replace(/\/+$/, ""));
    if (b.name && b.address) add(byNameAddr, normKey(b.name) + "|" + normKey(b.address));
    return [...ids].map((id) => byId.get(id)!).filter(Boolean);
  }

  return {
    isDuplicate: (b) => dupSet.has(b.id),
    duplicatesOf,
  };
}

export function getWarnings(b: Business, dup: DuplicateIndex): Warning[] {
  const w: Warning[] = [];
  if (!b.phone) w.push("missing_phone");
  else if (!isValidPhone(b.phone)) w.push("invalid_phone");
  if (!b.website_url) w.push("missing_website");
  else if (!isValidUrl(b.website_url)) w.push("invalid_url");
  if (!b.address) w.push("missing_address");
  if (b.rating == null) w.push("missing_rating");
  if (!b.gmaps_url) w.push("missing_gmaps");
  if (dup.isDuplicate(b)) w.push("possible_duplicate");
  return w;
}
