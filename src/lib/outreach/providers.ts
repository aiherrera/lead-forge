/**
 * Email provider adapters (HTTP-API based, edge-runtime safe).
 *
 * Cloudflare Workers cannot run raw SMTP (no TCP from nodemailer in workerd),
 * so we standardize on HTTP-API providers. Each adapter takes a normalized
 * `SendInput` and an API key, performs a single fetch, and returns a
 * normalized `SendResult`.
 *
 * Add new providers by adding a case to `sendViaProvider`.
 */

export type ProviderName = "resend" | "sendgrid" | "mailgun" | "postmark";

export type SendInput = {
  from: { name?: string | null; email: string };
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  /** Provider-specific extras (e.g. mailgun domain) */
  extras?: Record<string, string | undefined | null>;
};

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; status: number; bounced?: boolean; error: string };

export async function sendViaProvider(
  provider: ProviderName,
  apiKey: string,
  input: SendInput,
): Promise<SendResult> {
  switch (provider) {
    case "resend": return sendResend(apiKey, input);
    case "sendgrid": return sendSendgrid(apiKey, input);
    case "mailgun": return sendMailgun(apiKey, input);
    case "postmark": return sendPostmark(apiKey, input);
    default: return { ok: false, status: 0, error: `Unknown provider: ${provider}` };
  }
}

function formatFrom(from: SendInput["from"]): string {
  return from.name ? `${from.name} <${from.email}>` : from.email;
}

// ---------- Resend ----------
async function sendResend(apiKey: string, i: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: formatFrom(i.from),
      to: [i.to],
      reply_to: i.replyTo || undefined,
      subject: i.subject,
      html: i.html,
      text: i.text,
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) return { ok: false, status: res.status, error: extractError(json) };
  return { ok: true, providerMessageId: (json?.id as string) ?? null };
}

// ---------- SendGrid ----------
async function sendSendgrid(apiKey: string, i: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: i.to }] }],
      from: { email: i.from.email, name: i.from.name ?? undefined },
      reply_to: i.replyTo ? { email: i.replyTo } : undefined,
      subject: i.subject,
      content: [
        { type: "text/plain", value: i.text },
        { type: "text/html", value: i.html },
      ],
    }),
  });
  if (!res.ok) {
    const json = await safeJson(res);
    return { ok: false, status: res.status, error: extractError(json) };
  }
  return { ok: true, providerMessageId: res.headers.get("x-message-id") };
}

// ---------- Mailgun ----------
async function sendMailgun(apiKey: string, i: SendInput): Promise<SendResult> {
  const domain = i.extras?.domain;
  if (!domain) return { ok: false, status: 0, error: "Mailgun requires `extras.domain`" };
  const form = new URLSearchParams();
  form.set("from", formatFrom(i.from));
  form.set("to", i.to);
  if (i.replyTo) form.set("h:Reply-To", i.replyTo);
  form.set("subject", i.subject);
  form.set("text", i.text);
  form.set("html", i.html);
  const region = (i.extras?.region ?? "us") === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
  const res = await fetch(`https://${region}/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`api:${apiKey}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = await safeJson(res);
  if (!res.ok) return { ok: false, status: res.status, error: extractError(json) };
  return { ok: true, providerMessageId: (json?.id as string) ?? null };
}

// ---------- Postmark ----------
async function sendPostmark(apiKey: string, i: SendInput): Promise<SendResult> {
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      From: formatFrom(i.from),
      To: i.to,
      ReplyTo: i.replyTo || undefined,
      Subject: i.subject,
      HtmlBody: i.html,
      TextBody: i.text,
      MessageStream: i.extras?.stream || "outbound",
    }),
  });
  const json = await safeJson(res);
  if (!res.ok) {
    // Postmark inactive recipient code 406 indicates a bounced/blocked address
    const bounced = json?.ErrorCode === 406;
    return { ok: false, status: res.status, bounced, error: extractError(json) };
  }
  return { ok: true, providerMessageId: (json?.MessageID as string) ?? null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeJson(res: Response): Promise<any> {
  try { return await res.json(); } catch { return null; }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractError(j: any): string {
  if (!j) return "Unknown provider error";
  return (
    j.message || j.error || j.Message ||
    (Array.isArray(j.errors) ? j.errors.map((e: { message?: string }) => e.message).join("; ") : null) ||
    JSON.stringify(j)
  );
}
