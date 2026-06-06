// Value-based CSV field detection engine for Google Maps scraper exports.
// We never trust headers alone — every column is profiled from sample values.

import type { NormalizedField } from "./normalized-fields";

export type Confidence = "high" | "medium" | "low" | "none";

export type ColumnProfile = {
  rawHeader: string;
  uniqueHeader: string; // disambiguated, e.g. "Span #2"
  position: number;
  sampleValues: string[]; // up to ~5 non-empty
  nonEmptyCount: number;
  totalSampled: number;
  uniqueRatio: number;
  scores: Record<NormalizedField, number>; // 0..1 per field
  detectedField: NormalizedField | "";
  confidence: number; // 0..1 for detectedField
  level: Confidence;
};

export type DetectionResult = {
  uniqueHeaders: string[];
  profiles: ColumnProfile[];
  // chosen mapping: uniqueHeader -> field ("" means ignore)
  mapping: Record<string, NormalizedField | "">;
};

// ---------- Regex helpers ----------
const RE = {
  gmaps: /google\.com\/maps/i,
  url: /^https?:\/\//i,
  imageExt: /\.(jpg|jpeg|png|webp|gif)(\?|$)/i,
  imageHost: /(gstatic|googleusercontent|ggpht|fbcdn|cloudfront|imgix|unsplash|cdninstagram)/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Phone-ish — US-friendly but tolerant
  phone: /^\+?\d?[\s.\-()]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}(?:\s*(?:ext|x)\.?\s*\d+)?$/i,
  ratingNum: /^[0-5](?:\.\d{1,2})?$/,
  reviewParen: /^\(?\s*[\d,]{1,7}\s*\)?$/,
  reviewWord: /\b[\d,]+\s+reviews?\b/i,
  ratingLabel: /\b[0-5](?:\.\d)?\s*stars?\b.*\breviews?\b/i,
  openStatus: /^(open(?:\s+24\s+hours)?|closed|temporarily closed|permanently closed|opens\b|closes\b)/i,
  hoursLine: /\b(opens?|closes?)\s+\d{1,2}(:\d{2})?\s?(am|pm)\b/i,
  streetWord:
    /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|way|pkwy|parkway|hwy|highway|suite|ste|fl|floor|apt|unit|plaza|sq|square)\b\.?/i,
  usState:
    /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/,
  zip: /\b\d{5}(-\d{4})?\b/,
  streetNum: /^\s*\d{1,6}\s+\w/,
};

const ALL_FIELDS: NormalizedField[] = [
  "name",
  "business_category",
  "rating",
  "review_count",
  "rating_label",
  "phone",
  "email",
  "website_url",
  "gmaps_url",
  "image_url",
  "address",
  "opening_status",
  "closing_time",
  "review_snippet",
];

// ---------- Per-value classifiers (return 0..1) ----------
type Classifier = (v: string) => number;

const isGmaps: Classifier = (v) => (RE.gmaps.test(v) ? 1 : 0);
const isImage: Classifier = (v) =>
  RE.url.test(v) && (RE.imageExt.test(v) || RE.imageHost.test(v)) ? 1 : 0;
const isWebsite: Classifier = (v) => {
  if (!RE.url.test(v)) return 0;
  if (RE.gmaps.test(v)) return 0;
  if (RE.imageExt.test(v) || RE.imageHost.test(v)) return 0;
  return 1;
};
const isEmail: Classifier = (v) => (RE.email.test(v.trim()) ? 1 : 0);
const isPhone: Classifier = (v) => {
  const digits = v.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 14) return 0;
  return RE.phone.test(v.trim()) ? 1 : 0;
};
const isRating: Classifier = (v) => {
  const s = v.trim();
  if (!RE.ratingNum.test(s)) return 0;
  const n = parseFloat(s);
  return n >= 0 && n <= 5 ? 1 : 0;
};
const isReviewCount: Classifier = (v) => {
  const s = v.trim();
  if (RE.reviewWord.test(s)) return 1;
  if (RE.reviewParen.test(s)) {
    const n = parseInt(s.replace(/[^\d]/g, ""), 10);
    return n > 0 && n < 10_000_000 ? 0.9 : 0;
  }
  return 0;
};
const isRatingLabel: Classifier = (v) => (RE.ratingLabel.test(v) ? 1 : 0);
const isOpeningStatus: Classifier = (v) => {
  const s = v.trim();
  if (!s) return 0;
  if (/^open(\s+24\s+hours)?$/i.test(s)) return 1;
  if (/^closed$/i.test(s)) return 1;
  if (/^(temporarily|permanently)\s+closed$/i.test(s)) return 1;
  if (RE.openStatus.test(s)) return 0.9;
  return 0;
};
const isClosingTime: Classifier = (v) => (RE.hoursLine.test(v) ? 1 : 0);
const isAddress: Classifier = (v) => {
  const s = v.trim();
  if (!s || s.length > 200) return 0;
  if (RE.url.test(s)) return 0;
  if (isPhone(s)) return 0;
  let score = 0;
  if (RE.streetNum.test(s)) score += 0.5;
  if (RE.streetWord.test(s)) score += 0.35;
  if (RE.usState.test(s)) score += 0.15;
  if (RE.zip.test(s)) score += 0.15;
  if (/,/.test(s)) score += 0.1;
  return Math.min(1, score);
};
const isCategoryish: Classifier = (v) => {
  const s = v.trim();
  if (!s || s.length > 60 || s.length < 3) return 0;
  if (RE.url.test(s) || isPhone(s) || isEmail(s)) return 0;
  if (/\d/.test(s)) return 0; // categories rarely have digits
  const words = s.split(/\s+/).length;
  return words <= 5 ? 0.8 : 0;
};
const isSnippet: Classifier = (v) => {
  const s = v.trim();
  if (s.length < 40) return 0;
  if (RE.url.test(s) || isPhone(s)) return 0;
  // sentence-like
  if (/[.!?]/.test(s) || /^["'"]/.test(s)) return 1;
  return s.length > 80 ? 0.7 : 0.4;
};
const isBusinessName: Classifier = (v) => {
  const s = v.trim();
  if (!s || s.length < 2 || s.length > 90) return 0;
  if (RE.url.test(s) || isPhone(s) || isEmail(s)) return 0;
  if (RE.ratingNum.test(s)) return 0;
  if (RE.streetNum.test(s) && RE.streetWord.test(s)) return 0;
  if (RE.openStatus.test(s) || RE.hoursLine.test(s)) return 0;
  // Looks like a real label / proper noun
  return /[A-Za-z]/.test(s) ? 0.6 : 0;
};

const CLASSIFIERS: Record<NormalizedField, Classifier> = {
  name: isBusinessName,
  business_category: isCategoryish,
  rating: isRating,
  review_count: isReviewCount,
  rating_label: isRatingLabel,
  phone: isPhone,
  email: isEmail,
  website_url: isWebsite,
  gmaps_url: isGmaps,
  image_url: isImage,
  address: isAddress,
  opening_status: isOpeningStatus,
  closing_time: isClosingTime,
  review_snippet: isSnippet,
};

// ---------- Public helpers ----------
export function disambiguateHeaders(headers: string[]): string[] {
  const counts: Record<string, number> = {};
  const seen: Record<string, number> = {};
  for (const h of headers) {
    const key = h || "Column";
    counts[key] = (counts[key] || 0) + 1;
  }
  return headers.map((h, i) => {
    const key = h || `Column ${i + 1}`;
    if (counts[key] > 1) {
      seen[key] = (seen[key] || 0) + 1;
      return `${key} #${seen[key]}`;
    }
    return key;
  });
}

function level(score: number): Confidence {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function profileColumn(
  rawHeader: string,
  uniqueHeader: string,
  position: number,
  values: string[],
): ColumnProfile {
  const nonEmpty = values.map((v) => (v ?? "").toString()).filter((v) => v.trim() !== "");
  const totals: Record<NormalizedField, number> = {} as Record<NormalizedField, number>;
  for (const f of ALL_FIELDS) totals[f] = 0;
  for (const v of nonEmpty) {
    for (const f of ALL_FIELDS) totals[f] += CLASSIFIERS[f](v);
  }
  const scores = {} as Record<NormalizedField, number>;
  const n = Math.max(1, nonEmpty.length);
  for (const f of ALL_FIELDS) scores[f] = totals[f] / n;

  const unique = new Set(nonEmpty.map((v) => v.toLowerCase())).size;
  const uniqueRatio = nonEmpty.length === 0 ? 0 : unique / nonEmpty.length;

  // pick best
  let detected: NormalizedField | "" = "";
  let best = 0;
  for (const f of ALL_FIELDS) {
    if (scores[f] > best) {
      best = scores[f];
      detected = f;
    }
  }
  // require minimum signal
  if (best < 0.4) detected = "";

  // tie-break heuristics for ambiguous text-y columns
  if (detected === "name" && scores.business_category >= scores.name - 0.1) {
    // categories repeat heavily, names don't
    if (uniqueRatio < 0.3) detected = "business_category";
  }
  if (detected === "business_category" && uniqueRatio > 0.7 && scores.name >= 0.4) {
    detected = "name";
  }

  return {
    rawHeader,
    uniqueHeader,
    position,
    sampleValues: nonEmpty.slice(0, 5),
    nonEmptyCount: nonEmpty.length,
    totalSampled: values.length,
    uniqueRatio,
    scores,
    detectedField: detected,
    confidence: detected ? scores[detected as NormalizedField] : 0,
    level: detected ? level(scores[detected as NormalizedField]) : "none",
  };
}

export function detectFields(
  headers: string[],
  rows: Record<string, string>[],
  sampleSize = 50,
): DetectionResult {
  const uniqueHeaders = disambiguateHeaders(headers);
  const sample = rows.slice(0, sampleSize);

  // Build value columns indexed by ORIGINAL header order/position, but
  // values are pulled from disambiguated keys.
  const profiles: ColumnProfile[] = uniqueHeaders.map((uh, idx) => {
    const values = sample.map((r) => r[uh] ?? "");
    return profileColumn(headers[idx] ?? uh, uh, idx, values);
  });

  // Resolve conflicts: each normalized field can only be assigned to one column.
  // Prefer the highest-confidence column per field.
  const mapping: Record<string, NormalizedField | ""> = {};
  for (const p of profiles) mapping[p.uniqueHeader] = "";

  const SINGLE_USE: NormalizedField[] = [
    "rating",
    "review_count",
    "rating_label",
    "phone",
    "email",
    "website_url",
    "gmaps_url",
    "image_url",
    "address",
    "name",
    "business_category",
    "opening_status",
    "closing_time",
    "review_snippet",
  ];

  for (const field of SINGLE_USE) {
    const winner = [...profiles]
      .filter((p) => p.scores[field] >= 0.4)
      .sort((a, b) => b.scores[field] - a.scores[field])[0];
    if (winner && mapping[winner.uniqueHeader] === "") {
      mapping[winner.uniqueHeader] = field;
    }
  }

  // Re-sync each profile's detectedField/confidence with the resolved mapping
  for (const p of profiles) {
    const f = mapping[p.uniqueHeader];
    if (f) {
      p.detectedField = f;
      p.confidence = p.scores[f];
      p.level = level(p.confidence);
    } else if (p.detectedField) {
      // detected but lost the tie-break
      p.detectedField = "";
      p.confidence = 0;
      p.level = "none";
    }
  }

  return { uniqueHeaders, profiles, mapping };
}

// ---------- Fingerprints (for template matching) ----------
export type ColumnFingerprint = {
  header: string;
  topField: NormalizedField | "";
  topScore: number;
  uniqueRatio: number;
};

export function fingerprintColumns(profiles: ColumnProfile[]): ColumnFingerprint[] {
  return profiles.map((p) => ({
    header: p.uniqueHeader,
    topField: p.detectedField,
    topScore: Math.round(p.confidence * 100) / 100,
    uniqueRatio: Math.round(p.uniqueRatio * 100) / 100,
  }));
}

export function templateMatchScore(
  templateHeaders: string[],
  templateFingerprints: ColumnFingerprint[],
  currentHeaders: string[],
  currentProfiles: ColumnProfile[],
): number {
  // Header overlap
  const a = new Set(templateHeaders.map((h) => h.toLowerCase()));
  const b = new Set(currentHeaders.map((h) => h.toLowerCase()));
  let overlap = 0;
  a.forEach((h) => b.has(h) && overlap++);
  const headerScore = a.size === 0 ? 0 : overlap / a.size;

  // Fingerprint agreement on overlapping headers
  let agree = 0;
  let checked = 0;
  for (const tf of templateFingerprints) {
    const match = currentProfiles.find((p) => p.uniqueHeader.toLowerCase() === tf.header.toLowerCase());
    if (!match) continue;
    checked++;
    if (match.detectedField && match.detectedField === tf.topField) agree++;
  }
  const fpScore = checked === 0 ? 0 : agree / checked;

  return headerScore * 0.5 + fpScore * 0.5;
}
