import type { Business } from "./types";
import type { ValidationReport, DuplicateMode } from "./types";

const PHONE_RE = /^\+?\d?[\s.\-()]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}(?:\s*(?:ext|x)\.?\s*\d+)?$/i;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function sigsFor(b: Record<string, unknown>): string[] {
  const out: string[] = [];
  const g = b.gmaps_url as string | undefined;
  const w = b.website_url as string | undefined;
  const p = b.phone as string | undefined;
  const n = b.name as string | undefined;
  const a = b.address as string | undefined;
  if (g) out.push("g:" + g.toLowerCase());
  if (w) out.push("w:" + w.toLowerCase());
  if (p) out.push("p:" + p.replace(/\D/g, ""));
  if (n && a) out.push("na:" + (n + "|" + a).toLowerCase());
  return out;
}

export function buildExistingSigs(existing: Business[]): Set<string> {
  const s = new Set<string>();
  for (const e of existing) for (const x of sigsFor(e as unknown as Record<string, unknown>)) s.add(x);
  return s;
}

export function buildValidationReport(
  mappedRows: Record<string, unknown>[],
  existing: Business[],
): ValidationReport & { duplicateIndexes: number[] } {
  const existingSigs = buildExistingSigs(existing);
  const seen = new Set<string>();
  let dups = 0,
    missingName = 0,
    missingPhone = 0,
    missingWebsite = 0,
    missingAddress = 0,
    invalidPhone = 0,
    invalidUrl = 0,
    ready = 0;
  const duplicateIndexes: number[] = [];

  mappedRows.forEach((r, idx) => {
    const phone = (r.phone as string | undefined)?.trim();
    const website = (r.website_url as string | undefined)?.trim();
    const name = (r.name as string | undefined)?.trim();
    const address = (r.address as string | undefined)?.trim();

    if (!name) missingName++;
    if (!phone) missingPhone++;
    if (!website) missingWebsite++;
    if (!address) missingAddress++;
    if (phone && !PHONE_RE.test(phone)) invalidPhone++;
    if (website && !URL_RE.test(website)) invalidUrl++;

    const rs = sigsFor(r);
    const isDup = rs.length > 0 && (rs.some((s) => existingSigs.has(s)) || rs.some((s) => seen.has(s)));
    if (isDup) {
      dups++;
      duplicateIndexes.push(idx);
    } else {
      rs.forEach((s) => seen.add(s));
      if (name) ready++;
    }
  });

  return {
    total: mappedRows.length,
    ready,
    duplicates: dups,
    missing_name: missingName,
    missing_phone: missingPhone,
    missing_website: missingWebsite,
    missing_address: missingAddress,
    invalid_phone: invalidPhone,
    invalid_url: invalidUrl,
    duplicateIndexes,
  };
}

export function applyDuplicateMode(
  mappedRows: Record<string, unknown>[],
  duplicateIndexes: number[],
  mode: DuplicateMode,
): { toInsert: Record<string, unknown>[]; insertedDuplicates: number; skipped: number } {
  const dupSet = new Set(duplicateIndexes);
  if (mode === "skip") {
    const toInsert = mappedRows.filter((_, i) => !dupSet.has(i));
    return { toInsert, insertedDuplicates: 0, skipped: dupSet.size };
  }
  if (mode === "mark") {
    const toInsert = mappedRows.map((r, i) =>
      dupSet.has(i) ? { ...r, status: "duplicate" } : r,
    );
    return { toInsert, insertedDuplicates: dupSet.size, skipped: 0 };
  }
  return { toInsert: mappedRows, insertedDuplicates: dupSet.size, skipped: 0 };
}
