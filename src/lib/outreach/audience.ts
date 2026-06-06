import type { Business } from "../types";
import type { AudienceConfig, AudienceType } from "./types";
import { matchSegment, type SegmentFilters } from "../segments";
import { isReadyToExport } from "../cleanup";

export type AudienceBreakdown = {
  total: number;
  sendable: Business[];
  excludedNoEmail: number;
  excludedSuppressed: number;
  excludedDoNotContact: number;
  excludedUnsubscribed: number;
  excludedDuplicate: number;
  excludedBadData: number;
};

export function resolveAudience(
  all: Business[],
  audienceType: AudienceType,
  config: AudienceConfig,
  suppressedEmails: Set<string>,
  suppressedDomains: Set<string>,
  segmentFilters?: SegmentFilters,
): AudienceBreakdown {
  let pool: Business[] = all;

  if (audienceType === "segment" && segmentFilters) {
    pool = all.filter((b) => matchSegment(b, segmentFilters));
  } else if (audienceType === "category" && config.category_id) {
    pool = all.filter((b) => b.category_id === config.category_id);
  } else if (audienceType === "selection" && config.business_ids?.length) {
    const ids = new Set(config.business_ids);
    pool = all.filter((b) => ids.has(b.id));
  } else if (audienceType === "ready") {
    pool = all.filter((b) => isReadyToExport(b));
  }

  if (config.only_ready) pool = pool.filter((b) => isReadyToExport(b));

  let excludedNoEmail = 0,
    excludedSuppressed = 0,
    excludedDoNotContact = 0,
    excludedUnsubscribed = 0,
    excludedDuplicate = 0,
    excludedBadData = 0;
  const sendable: Business[] = [];

  for (const b of pool) {
    if (b.status === "duplicate") {
      excludedDuplicate++;
      continue;
    }
    if (b.status === "bad_data") {
      excludedBadData++;
      continue;
    }
    if (b.do_not_contact) {
      excludedDoNotContact++;
      continue;
    }
    if (b.unsubscribed_at) {
      excludedUnsubscribed++;
      continue;
    }
    const email = (b.email ?? "").trim().toLowerCase();
    if (!email) {
      excludedNoEmail++;
      continue;
    }
    const domain = email.split("@")[1] ?? "";
    if (suppressedEmails.has(email) || suppressedDomains.has(domain)) {
      excludedSuppressed++;
      continue;
    }
    sendable.push(b);
  }

  return {
    total: pool.length,
    sendable,
    excludedNoEmail,
    excludedSuppressed,
    excludedDoNotContact,
    excludedUnsubscribed,
    excludedDuplicate,
    excludedBadData,
  };
}
