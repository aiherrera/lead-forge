import type { Business } from "./types";
import { leadScore } from "./quality";
import { domainOf, isReadyToExport } from "./cleanup";

export type SegmentFilters = {
  category_id?: string | null; // null/undefined = any
  status?: string;
  cleanup_status?: string;
  score_min?: number;
  score_max?: number;
  rating_min?: number;
  rating_max?: number;
  reviews_min?: number;
  reviews_max?: number;
  has_phone?: boolean;
  has_website?: boolean;
  has_email?: boolean;
  has_address?: boolean;
  has_gmaps?: boolean;
  missing_phone?: boolean;
  missing_website?: boolean;
  exclude_duplicates?: boolean;
  exclude_bad_data?: boolean;
  only_ready?: boolean;
  import_id?: string;
  imported_after?: string;
  imported_before?: string;
};

export type SavedSegment = {
  id: string;
  name: string;
  filters: SegmentFilters;
  last_exported_at: string | null;
  created_at: string;
  updated_at: string;
};

export function matchSegment(b: Business, f: SegmentFilters): boolean {
  if (f.category_id && b.category_id !== f.category_id) return false;
  if (f.status && f.status !== "all" && b.status !== f.status) return false;
  if (f.cleanup_status && f.cleanup_status !== "all" && b.cleanup_status !== f.cleanup_status) return false;

  const s = leadScore(b);
  if (f.score_min != null && s < f.score_min) return false;
  if (f.score_max != null && s > f.score_max) return false;

  if (f.rating_min != null && (b.rating ?? 0) < f.rating_min) return false;
  if (f.rating_max != null && (b.rating ?? 0) > f.rating_max) return false;

  if (f.reviews_min != null && (b.review_count ?? 0) < f.reviews_min) return false;
  if (f.reviews_max != null && (b.review_count ?? 0) > f.reviews_max) return false;

  if (f.has_phone && !b.phone) return false;
  if (f.has_website && !b.website_url) return false;
  if (f.has_email && !b.email) return false;
  if (f.has_address && !b.address) return false;
  if (f.has_gmaps && !b.gmaps_url) return false;
  if (f.missing_phone && b.phone) return false;
  if (f.missing_website && b.website_url) return false;

  if (f.exclude_duplicates && b.status === "duplicate") return false;
  if (f.exclude_bad_data && b.status === "bad_data") return false;
  if (f.only_ready && !isReadyToExport(b)) return false;

  if (f.import_id && b.import_id !== f.import_id) return false;
  if (f.imported_after && new Date(b.created_at) < new Date(f.imported_after)) return false;
  if (f.imported_before && new Date(b.created_at) > new Date(f.imported_before)) return false;
  return true;
}

export function describeFilters(f: SegmentFilters, catName?: (id: string) => string): string[] {
  const out: string[] = [];
  if (f.category_id) out.push(`Category: ${catName?.(f.category_id) ?? f.category_id}`);
  if (f.status && f.status !== "all") out.push(`Status: ${f.status}`);
  if (f.cleanup_status && f.cleanup_status !== "all") out.push(`Cleanup: ${f.cleanup_status}`);
  if (f.score_min != null || f.score_max != null) out.push(`Score ${f.score_min ?? 0}–${f.score_max ?? 100}`);
  if (f.rating_min != null) out.push(`Rating ≥ ${f.rating_min}`);
  if (f.reviews_min != null) out.push(`Reviews ≥ ${f.reviews_min}`);
  if (f.has_phone) out.push("Has phone");
  if (f.has_website) out.push("Has website");
  if (f.has_email) out.push("Has email");
  if (f.missing_phone) out.push("Missing phone");
  if (f.missing_website) out.push("Missing website");
  if (f.exclude_duplicates) out.push("No duplicates");
  if (f.exclude_bad_data) out.push("No bad data");
  if (f.only_ready) out.push("Ready only");
  return out;
}

export function defaultFilters(): SegmentFilters {
  return { exclude_duplicates: true, exclude_bad_data: true };
}

// re-export for convenience
export { domainOf };
