import type { Business } from "./types";
import { leadScore } from "./quality";

export type PipelineStage = {
  id: string;
  name: string;
  order_index: number;
  is_default: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type Priority = "low" | "medium" | "high" | "urgent";

export const PRIORITY_OPTIONS: { value: Priority; label: string; tone: string }[] = [
  { value: "low", label: "Low", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "medium", label: "Medium", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "high", label: "High", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "urgent", label: "Urgent", tone: "bg-rose-100 text-rose-700 border-rose-200" },
];

export const PRIORITY_META = Object.fromEntries(
  PRIORITY_OPTIONS.map((p) => [p.value, p]),
) as unknown as Record<Priority, { value: Priority; label: string; tone: string }>;

export type ActivityType =
  | "note"
  | "call_planned"
  | "call_completed"
  | "email_planned"
  | "manual_email_sent"
  | "meeting_planned"
  | "follow_up_needed"
  | "status_changed"
  | "data_updated";

export const ACTIVITY_TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call_planned", label: "Call planned" },
  { value: "call_completed", label: "Call completed" },
  { value: "email_planned", label: "Email planned" },
  { value: "manual_email_sent", label: "Manual email sent" },
  { value: "meeting_planned", label: "Meeting planned" },
  { value: "follow_up_needed", label: "Follow-up needed" },
  { value: "status_changed", label: "Status changed" },
  { value: "data_updated", label: "Data updated" },
];

export const ACTIVITY_LABEL = Object.fromEntries(
  ACTIVITY_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as unknown as Record<ActivityType, string>;

export type Activity = {
  id: string;
  business_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskStatus = "open" | "completed";

export type Task = {
  id: string;
  business_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export const DEFAULT_STAGE_NAMES = [
  "New",
  "Cleaned",
  "Qualified",
  "Ready for outreach",
  "Contacted manually",
  "Follow-up needed",
  "Not interested",
  "Bad fit",
  "Won",
  "Lost",
];

// Ready for outreach logic
export type OutreachReadiness = "ready" | "not_ready" | "needs_cleanup" | "missing_contact";

export const OUTREACH_META: Record<OutreachReadiness, { label: string; tone: string }> = {
  ready: { label: "Ready for outreach", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  not_ready: { label: "Not ready", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  needs_cleanup: { label: "Needs cleanup", tone: "bg-amber-100 text-amber-800 border-amber-200" },
  missing_contact: { label: "Missing contact method", tone: "bg-rose-100 text-rose-700 border-rose-200" },
};

export function outreachReadiness(
  b: Business,
  stageName: string | null,
  scoreThreshold = 60,
): OutreachReadiness {
  if (b.status === "duplicate" || b.status === "bad_data") return "not_ready";
  if (b.cleanup_status !== "clean" && b.cleanup_status !== "ignored") return "needs_cleanup";
  if (!b.name?.trim()) return "needs_cleanup";
  const hasContact = !!(b.phone || b.website_url || b.email);
  if (!hasContact) return "missing_contact";
  if (leadScore(b) < scoreThreshold) return "not_ready";
  if (stageName !== "Qualified" && stageName !== "Ready for outreach") return "not_ready";
  return "ready";
}

export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
