import * as XLSX from "xlsx";
import type { Business, Category } from "./types";
import { leadScore } from "./quality";
import { domainOf, normalizeWebsite } from "./cleanup";
import { normalizePhone } from "./coerce";
import { toCsv } from "./csv";

export type ExportField =
  | "businessName" | "businessCategory" | "category" | "rating" | "reviewCount"
  | "leadQualityScore" | "phone" | "email" | "websiteUrl" | "googleMapsUrl"
  | "address" | "city" | "state" | "openingStatus" | "closingTime"
  | "status" | "cleanupStatus" | "notes" | "sourceImport" | "importedDate" | "rawData";

export const ALL_FIELDS: { key: ExportField; label: string }[] = [
  { key: "businessName", label: "Business name" },
  { key: "businessCategory", label: "Business type" },
  { key: "category", label: "Category" },
  { key: "rating", label: "Rating" },
  { key: "reviewCount", label: "Review count" },
  { key: "leadQualityScore", label: "Lead score" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "websiteUrl", label: "Website" },
  { key: "googleMapsUrl", label: "Google Maps URL" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "openingStatus", label: "Opening status" },
  { key: "closingTime", label: "Closing time" },
  { key: "status", label: "Status" },
  { key: "cleanupStatus", label: "Cleanup status" },
  { key: "notes", label: "Notes" },
  { key: "sourceImport", label: "Source import" },
  { key: "importedDate", label: "Imported date" },
  { key: "rawData", label: "Raw data" },
];

export const DEFAULT_FIELDS: ExportField[] = [
  "businessName", "phone", "websiteUrl", "googleMapsUrl",
  "address", "rating", "reviewCount", "category", "status", "notes",
];

export type ExportOptions = {
  excludeDuplicates: boolean;
  excludeBadData: boolean;
  onlyReady: boolean;
  includeNotes: boolean;
  includeRawData: boolean;
  includeSourceImport: boolean;
  normalizePhones: boolean;
  normalizeWebsites: boolean;
};

export const DEFAULT_OPTIONS: ExportOptions = {
  excludeDuplicates: true,
  excludeBadData: true,
  onlyReady: false,
  includeNotes: true,
  includeRawData: false,
  includeSourceImport: true,
  normalizePhones: true,
  normalizeWebsites: true,
};

export type ExportFormat = "csv" | "xlsx" | "json";

export function buildRows(
  businesses: Business[],
  fields: ExportField[],
  options: ExportOptions,
  ctx: { categories: Map<string, Category>; imports?: Map<string, { filename: string }> },
): Record<string, unknown>[] {
  return businesses.map((b) => {
    const row: Record<string, unknown> = {};
    for (const f of fields) {
      switch (f) {
        case "businessName": row.businessName = b.name; break;
        case "businessCategory": row.businessCategory = b.business_category; break;
        case "category": row.category = b.category_id ? ctx.categories.get(b.category_id)?.name ?? "" : ""; break;
        case "rating": row.rating = b.rating; break;
        case "reviewCount": row.reviewCount = b.review_count; break;
        case "leadQualityScore": row.leadQualityScore = leadScore(b); break;
        case "phone": row.phone = options.normalizePhones && b.phone ? normalizePhone(b.phone) : b.phone; break;
        case "email": row.email = b.email; break;
        case "websiteUrl": row.websiteUrl = options.normalizeWebsites && b.website_url ? normalizeWebsite(b.website_url) : b.website_url; break;
        case "googleMapsUrl": row.googleMapsUrl = b.gmaps_url; break;
        case "address": row.address = b.address; break;
        case "city": row.city = b.city; break;
        case "state": row.state = b.state; break;
        case "openingStatus": row.openingStatus = b.opening_status; break;
        case "closingTime": row.closingTime = b.closing_time; break;
        case "status": row.status = b.status; break;
        case "cleanupStatus": row.cleanupStatus = b.cleanup_status; break;
        case "notes": if (options.includeNotes) row.notes = b.notes; break;
        case "sourceImport":
          if (options.includeSourceImport)
            row.sourceImport = b.import_id ? ctx.imports?.get(b.import_id)?.filename ?? b.source_file ?? "" : b.source_file ?? "";
          break;
        case "importedDate": row.importedDate = b.imported_date; break;
        case "rawData": if (options.includeRawData) row.rawData = JSON.stringify(b.raw_data ?? {}); break;
      }
    }
    return row;
  });
}

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportFile(
  filename: string,
  rows: Record<string, unknown>[],
  format: ExportFormat,
) {
  if (format === "csv") {
    const csv = toCsv(rows);
    download(filename, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  } else if (format === "json") {
    download(filename, new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" }));
  } else {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Businesses");
    const ab = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    download(filename, new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  }
}

export function makeFilename(label: string, format: ExportFormat): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";
  return `leadforge-${slug}-${date}.${format}`;
}

export { domainOf };
