export type IntegrationProvider =
  | "webhook"
  | "airtable"
  | "zapier"
  | "make"
  | "hubspot"
  | "pipedrive"
  | "salesforce"
  | "gohighlevel"
  | "csv_scheduled";

export type IntegrationStatus = "not_connected" | "connected" | "error" | "disabled";

export type IntegrationAuthType = "none" | "oauth" | "api_key" | "webhook" | "manual_export" | "bearer" | "custom_header";

export type Integration = {
  id: string;
  provider: IntegrationProvider;
  name: string;
  status: IntegrationStatus;
  auth_type: IntegrationAuthType;
  config: Record<string, unknown>;
  secret_reference: string | null;
  is_enabled: boolean;
  last_tested_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationMapping = {
  id: string;
  integration_id: string;
  source_field: string;
  target_object: string;
  target_field: string;
  transformation: string;
  is_required: boolean;
  created_at: string;
  updated_at: string;
};

export type SyncRule = {
  id: string;
  integration_id: string;
  name: string;
  trigger_type: string;
  audience_config: Record<string, unknown>;
  sync_direction: "leadforge_to_crm" | "crm_to_leadforge" | "two_way";
  create_or_update_behavior: "create_only" | "update_only" | "create_or_update" | "skip_existing" | "ask";
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SyncJobStatus = "pending" | "running" | "success" | "failed" | "skipped" | "cancelled";

export type SyncJob = {
  id: string;
  integration_id: string;
  business_id: string | null;
  campaign_id: string | null;
  target_object: string;
  action: "create" | "update" | "skip";
  status: SyncJobStatus;
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status_code: number | null;
  error_message: string | null;
  retry_count: number;
  scheduled_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SyncEvent = {
  id: string;
  sync_job_id: string | null;
  integration_id: string | null;
  business_id: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ExternalRecord = {
  id: string;
  integration_id: string;
  business_id: string;
  provider: string;
  external_object_type: string;
  external_record_id: string;
  external_url: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export const PROVIDER_META: Record<IntegrationProvider, {
  label: string;
  description: string;
  supported: boolean;
  authType: IntegrationAuthType;
}> = {
  webhook: { label: "Generic Webhook", description: "Send leads to any HTTP endpoint — Zapier, Make, custom CRMs.", supported: true, authType: "webhook" },
  airtable: { label: "Airtable", description: "Sync leads to an Airtable base via API key.", supported: true, authType: "api_key" },
  zapier: { label: "Zapier", description: "Trigger Zaps via webhook URL.", supported: true, authType: "webhook" },
  make: { label: "Make (Integromat)", description: "Trigger Make scenarios via webhook URL.", supported: true, authType: "webhook" },
  hubspot: { label: "HubSpot", description: "Push contacts, companies, and deals to HubSpot CRM.", supported: false, authType: "oauth" },
  pipedrive: { label: "Pipedrive", description: "Push leads and deals to Pipedrive.", supported: false, authType: "api_key" },
  salesforce: { label: "Salesforce", description: "Enterprise CRM sync — leads, contacts, accounts.", supported: false, authType: "oauth" },
  gohighlevel: { label: "GoHighLevel", description: "Sync leads to GoHighLevel sub-accounts.", supported: false, authType: "api_key" },
  csv_scheduled: { label: "Scheduled CSV export", description: "Drop a CSV to a destination on a schedule.", supported: false, authType: "manual_export" },
};

export const LEADFORGE_FIELDS = [
  "businessName", "businessCategory", "category", "rating", "reviewCount",
  "leadQualityScore", "phone", "email", "websiteUrl", "googleMapsUrl",
  "address", "city", "state", "contactPageUrl", "pipelineStage", "priority",
  "status", "cleanupStatus", "lastContactedAt", "lastEmailSentAt", "replyStatus",
  "notes", "sourceImport", "campaignName",
] as const;

export const TRANSFORMATIONS = [
  { value: "text", label: "Plain text" },
  { value: "number", label: "Number" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone (normalized)" },
  { value: "email", label: "Email (lowercase)" },
  { value: "date", label: "Date (ISO)" },
  { value: "csv", label: "Comma-separated list" },
  { value: "domain", label: "Domain only" },
  { value: "boolean", label: "Boolean" },
] as const;

export const TRIGGER_TYPES = [
  { value: "manual", label: "Manual selection" },
  { value: "qualified", label: "Lead becomes Qualified" },
  { value: "ready", label: "Ready for outreach" },
  { value: "first_sent", label: "First email sent" },
  { value: "reply", label: "Lead replies" },
  { value: "interested", label: "Marked Interested" },
  { value: "won", label: "Marked Won" },
  { value: "added_to_campaign", label: "Added to campaign" },
  { value: "segment_change", label: "Saved segment changes" },
] as const;
