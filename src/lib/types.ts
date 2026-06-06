export type Category = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
};

export type ImportStatus =
  | "draft"
  | "mapping_required"
  | "ready"
  | "imported"
  | "failed";

export type ValidationReport = {
  total: number;
  ready: number;
  duplicates: number;
  missing_name: number;
  missing_phone: number;
  missing_website: number;
  missing_address: number;
  invalid_phone: number;
  invalid_url: number;
};

export type DetectedColumn = {
  rawHeader: string;
  uniqueHeader: string;
  position: number;
  detectedField: string | "";
  confidence: number;
  uniqueRatio: number;
  nonEmptyCount: number;
  totalSampled: number;
  sampleValues: string[];
  reason?: string;
};

export type DuplicateMode = "skip" | "mark" | "all";

export type ImportRecord = {
  id: string;
  filename: string;
  category_id: string | null;
  row_count: number;
  imported_rows: number;
  skipped_rows: number;
  duplicate_rows: number;
  missing_required_rows: number;
  mapping: Record<string, string> | null;
  headers: string[] | null;
  mapping_template_id: string | null;
  status: ImportStatus;
  validation_report: ValidationReport | null;
  detected_columns: DetectedColumn[] | null;
  template_match_score: number | null;
  duplicate_mode: DuplicateMode;
  created_at: string;
  updated_at: string;
};

export const IMPORT_STATUS_META: Record<ImportStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  mapping_required: { label: "Mapping required", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  ready: { label: "Ready to import", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  imported: { label: "Imported", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", tone: "bg-rose-100 text-rose-700 border-rose-200" },
};

export type BusinessStatus =
  | "new"
  | "reviewed"
  | "qualified"
  | "contacted"
  | "not_interested"
  | "bad_data"
  | "duplicate";

export type Business = {
  id: string;
  category_id: string | null;
  import_id: string | null;
  name: string | null;
  business_category: string | null;
  rating: number | null;
  review_count: number | null;
  rating_label: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  gmaps_url: string | null;
  image_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  opening_status: string | null;
  closing_time: string | null;
  review_snippet: string | null;
  status: BusinessStatus;
  notes: string | null;
  source_file: string | null;
  raw_data: Record<string, unknown> | null;
  imported_date: string;
  created_at: string;
  updated_at: string;
  cleanup_status: "needs_review" | "clean" | "ignored" | "merged" | "bad_data";
  merged_from: string[];
  pipeline_stage: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_activity_at: string | null;
  last_contacted_at: string | null;
  deal_value_estimate: number | null;
  pipeline_notes: string | null;
  do_not_contact: boolean;
  unsubscribed_at: string | null;
  last_emailed_at: string | null;
  reply_outcome: string | null;
};

export type MappingTemplate = {
  id: string;
  name: string;
  raw_headers: string[];
  normalized_mapping: Record<string, string>;
  confidence_summary: Record<string, number>;
  fingerprints: { header: string; topField: string; topScore: number; uniqueRatio: number }[];
  sample_values: Record<string, string[]> | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_OPTIONS: { value: BusinessStatus; label: string; tone: string }[] = [
  { value: "new", label: "New", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "reviewed", label: "Reviewed", tone: "bg-violet-100 text-violet-700 border-violet-200" },
  { value: "qualified", label: "Qualified", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "contacted", label: "Contacted", tone: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "not_interested", label: "Not interested", tone: "bg-slate-100 text-slate-600 border-slate-200" },
  { value: "bad_data", label: "Bad data", tone: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "duplicate", label: "Duplicate", tone: "bg-orange-100 text-orange-700 border-orange-200" },
];

export const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#3b82f6",
];
