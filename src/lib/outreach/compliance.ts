import type { Campaign, SequenceStep } from "./types";
import { extractVariables } from "./personalize";
import { TEMPLATE_VARIABLES } from "./types";

export type ComplianceIssue = {
  id: string;
  severity: "error" | "warning";
  message: string;
};

/**
 * Pre-send compliance validator. Returns a list of issues. Errors are hard-blocks
 * and must be resolved before the campaign can be moved to `sending`.
 */
export function validateCampaignCompliance(
  campaign: Pick<
    Campaign,
    | "email_type"
    | "sender_name"
    | "sender_company"
    | "reply_to_email"
    | "compliance_address"
    | "unsubscribe_enabled"
    | "sender_account_id"
    | "daily_limit"
    | "hourly_limit"
    | "send_window_start"
    | "send_window_end"
  >,
  steps: Pick<SequenceStep, "subject" | "body_text" | "name" | "step_number">[],
  options: { sendableCount: number; suppressedCount?: number } = { sendableCount: 0 },
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  if (!campaign.sender_account_id) {
    issues.push({ id: "no_sender_account", severity: "error", message: "Select a sender email account." });
  }
  if (!campaign.sender_name?.trim()) {
    issues.push({ id: "no_sender_name", severity: "error", message: "Sender name is required." });
  }

  const isCommercial = campaign.email_type === "commercial";
  if (isCommercial) {
    if (!campaign.compliance_address?.trim()) {
      issues.push({
        id: "no_physical_address",
        severity: "error",
        message: "Commercial emails require a physical mailing address (CAN-SPAM / GDPR).",
      });
    }
    if (!campaign.unsubscribe_enabled) {
      issues.push({
        id: "no_unsubscribe",
        severity: "error",
        message: "Commercial emails must include an unsubscribe link.",
      });
    }
  }

  if (!steps.length) {
    issues.push({ id: "no_steps", severity: "error", message: "Add at least one email step." });
  }

  steps.forEach((s, idx) => {
    if (!s.subject?.trim()) {
      issues.push({ id: `step_${idx}_subject`, severity: "error", message: `Step ${s.step_number}: subject is empty.` });
    }
    if (!s.body_text?.trim()) {
      issues.push({ id: `step_${idx}_body`, severity: "error", message: `Step ${s.step_number}: body is empty.` });
    }
    const vars = [...extractVariables(s.subject ?? ""), ...extractVariables(s.body_text ?? "")];
    const unknown = vars.filter((v) => !(TEMPLATE_VARIABLES as readonly string[]).includes(v));
    if (unknown.length) {
      issues.push({
        id: `step_${idx}_unknown_vars`,
        severity: "warning",
        message: `Step ${s.step_number}: unknown variable(s): ${unknown.join(", ")}`,
      });
    }
    if (campaign.unsubscribe_enabled && isCommercial) {
      const hasUnsub = /\{\{\s*unsubscribe/i.test(s.body_text ?? "") || /unsubscribe/i.test(s.body_text ?? "");
      if (!hasUnsub) {
        issues.push({
          id: `step_${idx}_unsub_link`,
          severity: "warning",
          message: `Step ${s.step_number}: body has no visible unsubscribe text. A link will be auto-appended.`,
        });
      }
    }
    const upper = (s.subject ?? "").replace(/[^A-Za-z]/g, "");
    if (upper.length > 4 && upper === upper.toUpperCase()) {
      issues.push({
        id: `step_${idx}_caps`,
        severity: "warning",
        message: `Step ${s.step_number}: subject is ALL CAPS — likely to trigger spam filters.`,
      });
    }
    if ((s.subject ?? "").length > 90) {
      issues.push({
        id: `step_${idx}_subject_long`,
        severity: "warning",
        message: `Step ${s.step_number}: subject is very long (${s.subject.length} chars).`,
      });
    }
  });

  if (options.sendableCount === 0) {
    issues.push({ id: "no_audience", severity: "error", message: "Audience has 0 sendable leads." });
  }
  if (campaign.daily_limit < 1) {
    issues.push({ id: "bad_daily", severity: "error", message: "Daily limit must be at least 1." });
  }
  if (campaign.hourly_limit < 1) {
    issues.push({ id: "bad_hourly", severity: "error", message: "Hourly limit must be at least 1." });
  }
  if (campaign.send_window_start >= campaign.send_window_end) {
    issues.push({ id: "bad_window", severity: "error", message: "Sending window end must be after start." });
  }

  return issues;
}

export function hasBlockingIssues(issues: ComplianceIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
