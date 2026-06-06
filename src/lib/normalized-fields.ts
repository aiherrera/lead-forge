export type NormalizedField =
  | "name"
  | "business_category"
  | "rating"
  | "review_count"
  | "rating_label"
  | "phone"
  | "email"
  | "website_url"
  | "gmaps_url"
  | "image_url"
  | "address"
  | "opening_status"
  | "closing_time"
  | "review_snippet";

export const NORMALIZED_FIELDS: { key: NormalizedField; label: string; important?: boolean }[] = [
  { key: "name", label: "Business name", important: true },
  { key: "business_category", label: "Business category" },
  { key: "rating", label: "Rating (0–5)", important: true },
  { key: "review_count", label: "Review count" },
  { key: "rating_label", label: "Rating label" },
  { key: "phone", label: "Phone", important: true },
  { key: "email", label: "Email" },
  { key: "website_url", label: "Website URL", important: true },
  { key: "gmaps_url", label: "Google Maps URL" },
  { key: "image_url", label: "Image URL" },
  { key: "address", label: "Address" },
  { key: "opening_status", label: "Opening status" },
  { key: "closing_time", label: "Closing time" },
  { key: "review_snippet", label: "Review snippet" },
];

export const FIELD_LABEL: Record<NormalizedField, string> = Object.fromEntries(
  NORMALIZED_FIELDS.map((f) => [f.key, f.label]),
) as Record<NormalizedField, string>;
