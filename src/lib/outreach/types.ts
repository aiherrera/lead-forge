export type EmailAccount = {
  id: string;
  name: string;
  provider: "mock" | "smtp" | "gmail" | "resend" | "sendgrid" | "mailgun" | "postmark";
  sender_name: string;
  sender_email: string;
  reply_to_email: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_username: string | null;
  smtp_password_secret: string | null;
  daily_limit: number;
  hourly_limit: number;
  is_enabled: boolean;
  connection_status: "untested" | "ok" | "failed";
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  body_html: string | null;
  body_text: string;
  signature: string | null;
  channel: string;
  goal: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignStatus =
  | "draft"
  | "ready"
  | "scheduled"
  | "sending"
  | "paused"
  | "completed"
  | "archived"
  | "failed";

export const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  ready: { label: "Ready", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  scheduled: { label: "Scheduled", tone: "bg-violet-100 text-violet-700 border-violet-200" },
  sending: { label: "Sending", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  paused: { label: "Paused", tone: "bg-orange-100 text-orange-700 border-orange-200" },
  completed: { label: "Completed", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  archived: { label: "Archived", tone: "bg-slate-100 text-slate-500 border-slate-200" },
  failed: { label: "Failed", tone: "bg-rose-100 text-rose-700 border-rose-200" },
};

export type AudienceType = "segment" | "category" | "selection" | "filter" | "ready";

export type AudienceConfig = {
  segment_id?: string | null;
  category_id?: string | null;
  business_ids?: string[];
  filters?: Record<string, unknown>;
  only_ready?: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  status: CampaignStatus;
  audience_type: AudienceType;
  audience_config: AudienceConfig;
  sender_account_id: string | null;
  goal: string | null;
  email_type: "commercial" | "transactional" | "manual_follow_up";
  sender_name: string | null;
  sender_company: string | null;
  reply_to_email: string | null;
  compliance_address: string | null;
  unsubscribe_enabled: boolean;
  send_mode: "immediate" | "scheduled";
  scheduled_at: string | null;
  daily_limit: number;
  hourly_limit: number;
  delay_seconds_min: number;
  delay_seconds_max: number;
  send_days: string[];
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  stop_on_bounce_rate: number;
  stop_after_reply: boolean;
  skip_unsubscribed: boolean;
  skip_suppressed_domains: boolean;
  total_leads: number;
  sendable_count: number;
  excluded_count: number;
  sent_count: number;
  failed_count: number;
  bounced_count: number;
  unsubscribed_count: number;
  replied_count: number;
  open_count: number;
  click_count: number;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SequenceStep = {
  id: string;
  campaign_id: string;
  step_number: number;
  name: string;
  delay_days: number;
  subject: string;
  body_html: string | null;
  body_text: string;
  send_condition: {
    send_if_no_reply?: boolean;
    send_if_not_bounced?: boolean;
    send_if_not_unsubscribed?: boolean;
    send_if_previous_sent?: boolean;
    stop_after_reply?: boolean;
    stop_after_unsubscribe?: boolean;
  };
  created_at: string;
  updated_at: string;
};

export type CampaignLeadStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "skipped"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "completed"
  | "failed";

export type ReplyOutcome =
  | "interested"
  | "not_interested"
  | "booked_call"
  | "requested_more_info"
  | "wrong_contact"
  | "do_not_contact";

export const REPLY_OUTCOMES: { value: ReplyOutcome; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "booked_call", label: "Booked call" },
  { value: "requested_more_info", label: "Requested more info" },
  { value: "wrong_contact", label: "Wrong contact" },
  { value: "do_not_contact", label: "Do not contact" },
];

export type CampaignLead = {
  id: string;
  campaign_id: string;
  business_id: string;
  status: CampaignLeadStatus;
  readiness_status: string;
  current_step: number;
  reply_outcome: ReplyOutcome | null;
  last_email_sent_at: string | null;
  next_email_scheduled_at: string | null;
  replied_at: string | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
};

export type EmailJobStatus =
  | "draft"
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "bounced"
  | "skipped"
  | "cancelled";

export const EMAIL_JOB_STATUS_META: Record<EmailJobStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  queued: { label: "Queued", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  scheduled: { label: "Scheduled", tone: "bg-violet-100 text-violet-700 border-violet-200" },
  sending: { label: "Sending", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  sent: { label: "Sent", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", tone: "bg-rose-100 text-rose-700 border-rose-200" },
  bounced: { label: "Bounced", tone: "bg-rose-100 text-rose-700 border-rose-200" },
  skipped: { label: "Skipped", tone: "bg-slate-100 text-slate-500 border-slate-200" },
  cancelled: { label: "Cancelled", tone: "bg-slate-100 text-slate-500 border-slate-200" },
};

export type EmailJob = {
  id: string;
  campaign_id: string | null;
  campaign_lead_id: string | null;
  business_id: string | null;
  sequence_step_id: string | null;
  sender_account_id: string | null;
  recipient_email: string;
  subject: string;
  body_html: string | null;
  body_text: string;
  status: EmailJobStatus;
  is_simulated: boolean;
  scheduled_at: string;
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string | null;
  created_at: string;
  updated_at: string;
};

export type SuppressionReason =
  | "unsubscribed"
  | "bounced"
  | "manual_block"
  | "complaint"
  | "invalid_email"
  | "do_not_contact";

export const SUPPRESSION_REASON_OPTIONS: { value: SuppressionReason; label: string }[] = [
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "manual_block", label: "Manual block" },
  { value: "complaint", label: "Complaint" },
  { value: "invalid_email", label: "Invalid email" },
  { value: "do_not_contact", label: "Do not contact" },
];

export type SuppressionEntry = {
  id: string;
  email: string | null;
  domain: string | null;
  reason: SuppressionReason;
  source: string | null;
  campaign_id: string | null;
  business_id: string | null;
  notes: string | null;
  created_at: string;
};

export type EmailEvent = {
  id: string;
  email_job_id: string | null;
  campaign_id: string | null;
  business_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AppSettings = {
  id: number;
  mock_mode: boolean;
  default_sender_account_id: string | null;
  default_compliance_address: string | null;
  default_sender_name: string | null;
  default_sender_company: string | null;
  global_daily_cap: number;
  bounce_alert_rate: number;
  created_at: string;
  updated_at: string;
};

export const TEMPLATE_VARIABLES = [
  "businessName",
  "category",
  "businessCategory",
  "city",
  "state",
  "websiteUrl",
  "contactPageUrl",
  "rating",
  "reviewCount",
  "phone",
  "firstName",
  "companyName",
  "senderName",
  "senderCompany",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
