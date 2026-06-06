import { createServerFn } from "@tanstack/react-start";

type WebhookAuth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "custom_header"; header: string; value: string };

export type WebhookTestInput = {
  url: string;
  method: "POST" | "PUT";
  auth: WebhookAuth;
  customHeaders?: Record<string, string>;
  body: unknown;
};

export type WebhookTestResult = {
  ok: boolean;
  status: number;
  statusText: string;
  responseBody: string;
  requestHeaders: Record<string, string>;
  error?: string;
  durationMs: number;
};

export const testWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: WebhookTestInput) => data)
  .handler(async ({ data }): Promise<WebhookTestResult> => {
    const started = Date.now();
    try {
      if (!data.url || !/^https?:\/\//i.test(data.url)) {
        return { ok: false, status: 0, statusText: "Invalid URL", responseBody: "", requestHeaders: {}, error: "Webhook URL must start with http(s)://", durationMs: 0 };
      }
      const headers: Record<string, string> = { "content-type": "application/json", ...(data.customHeaders ?? {}) };
      if (data.auth.type === "bearer") headers["authorization"] = `Bearer ${data.auth.token}`;
      if (data.auth.type === "custom_header") headers[data.auth.header.toLowerCase()] = data.auth.value;

      const res = await fetch(data.url, {
        method: data.method,
        headers,
        body: typeof data.body === "string" ? data.body : JSON.stringify(data.body),
      });
      const text = await res.text().catch(() => "");
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        responseBody: text.slice(0, 8000),
        requestHeaders: redact(headers),
        durationMs: Date.now() - started,
      };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        statusText: "Network error",
        responseBody: "",
        requestHeaders: {},
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      };
    }
  });

function redact(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = /authorization|api[-_]?key|token|secret/i.test(k) ? `${v.slice(0, 6)}…` : v;
  }
  return out;
}
