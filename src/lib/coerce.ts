// Value coercion + normalization helpers shared by import + table display.
import type { NormalizedField } from "./normalized-fields";

export function coerceRating(v: string): number | null {
  const m = v.match(/[0-5](?:\.\d{1,2})?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return n >= 0 && n <= 5 ? n : null;
}

export function coerceReviewCount(v: string): number | null {
  // "(28)", "(1,203)", "234 reviews", "1,200 reviews", "1.2K reviews"
  let s = v.trim();
  const kMatch = s.match(/([\d.]+)\s*K/i);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  s = s.replace(/[(),]/g, "");
  const m = s.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

export function normalizePhone(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `+1 ${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return v.trim();
}

export function coerceForField(field: NormalizedField, raw: string): unknown {
  if (raw == null || raw === "") return null;
  switch (field) {
    case "rating":
      return coerceRating(raw);
    case "review_count":
      return coerceReviewCount(raw);
    case "phone":
      return normalizePhone(raw);
    case "email":
      return raw.trim().toLowerCase();
    default:
      return raw.trim();
  }
}
