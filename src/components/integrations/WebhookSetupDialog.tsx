import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { testWebhook } from "@/lib/integrations/webhook.functions";
import { buildVariables, defaultWebhookTemplate, renderJsonTemplate, SAMPLE_BUSINESS } from "@/lib/integrations/variables";
import { createIntegration, updateIntegration } from "@/lib/integrations/db";
import type { Integration, IntegrationProvider } from "@/lib/integrations/types";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  provider: IntegrationProvider; // webhook | zapier | make
  existing?: Integration | null;
  onSaved: () => void;
};

type AuthType = "none" | "bearer" | "custom_header";

export function WebhookSetupDialog({ open, onOpenChange, provider, existing, onSaved }: Props) {
  const cfg = (existing?.config ?? {}) as Record<string, unknown>;
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<"POST" | "PUT">("POST");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [bearer, setBearer] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [customHeadersText, setCustomHeadersText] = useState("");
  const [template, setTemplate] = useState(defaultWebhookTemplate());
  const [enabled, setEnabled] = useState(true);

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testWebhook>> | null>(null);

  const runTest = useServerFn(testWebhook);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? defaultName(provider));
    setUrl(String(cfg.url ?? ""));
    setMethod(((cfg.method as string) ?? "POST") as "POST" | "PUT");
    const at = (cfg.auth_type as AuthType) ?? "none";
    setAuthType(at);
    setBearer(String(cfg.bearer_token ?? ""));
    setHeaderName(String(cfg.header_name ?? ""));
    setHeaderValue(String(cfg.header_value ?? ""));
    setCustomHeadersText(typeof cfg.custom_headers === "string" ? (cfg.custom_headers as string) : "");
    setTemplate(String(cfg.payload_template ?? defaultWebhookTemplate()));
    setEnabled(existing?.is_enabled ?? true);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const sampleBody = useMemo(() => {
    const vars = buildVariables({ business: SAMPLE_BUSINESS, campaignName: "Spring Outreach" });
    try {
      return renderJsonTemplate(template, vars as Record<string, unknown>);
    } catch {
      return template;
    }
  }, [template]);

  function parsedCustomHeaders(): Record<string, string> {
    if (!customHeadersText.trim()) return {};
    try {
      const j = JSON.parse(customHeadersText);
      if (j && typeof j === "object") return j as Record<string, string>;
    } catch {
      // key: value lines
      const out: Record<string, string> = {};
      for (const line of customHeadersText.split("\n")) {
        const m = line.match(/^([^:]+):\s*(.+)$/);
        if (m) out[m[1].trim()] = m[2].trim();
      }
      return out;
    }
    return {};
  }

  async function handleTest() {
    setTesting(true);
    setResult(null);
    try {
      const auth =
        authType === "bearer" ? { type: "bearer" as const, token: bearer } :
        authType === "custom_header" ? { type: "custom_header" as const, header: headerName, value: headerValue } :
        { type: "none" as const };
      const r = await runTest({ data: {
        url, method, auth,
        customHeaders: parsedCustomHeaders(),
        body: sampleBody,
      }});
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    const config = {
      url, method, auth_type: authType,
      bearer_token: bearer, header_name: headerName, header_value: headerValue,
      custom_headers: customHeadersText, payload_template: template,
    };
    try {
      if (existing) {
        await updateIntegration(existing.id, {
          name, config, is_enabled: enabled,
          status: result?.ok ? "connected" : existing.status,
          last_tested_at: result ? new Date().toISOString() : existing.last_tested_at,
          last_error: result && !result.ok ? `${result.status} ${result.statusText}: ${result.error ?? ""}`.trim() : null,
        });
      } else {
        await createIntegration({
          provider, name, config, auth_type: "webhook",
          is_enabled: enabled,
          status: result?.ok ? "connected" : "not_connected",
          last_tested_at: result ? new Date().toISOString() : null,
          last_error: result && !result.ok ? `${result.status} ${result.statusText}: ${result.error ?? ""}`.trim() : null,
        });
      }
      toast.success(existing ? "Integration updated" : "Integration saved");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Configure" : "Connect"} {labelFor(provider)}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Zapier hook" />
            </div>
            <div className="space-y-1.5">
              <Label>HTTP method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as "POST" | "PUT")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Authentication</Label>
              <Select value={authType} onValueChange={(v) => setAuthType(v as AuthType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="custom_header">Custom header</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex items-end gap-2">
              <div className="flex items-center gap-2 h-9">
                <Switch checked={enabled} onCheckedChange={setEnabled} />
                <span className="text-sm">Enabled</span>
              </div>
            </div>
          </div>

          {authType === "bearer" && (
            <div className="space-y-1.5">
              <Label>Bearer token</Label>
              <Input value={bearer} onChange={(e) => setBearer(e.target.value)} type="password" />
              <p className="text-[11px] text-muted-foreground">Stored with the integration. For high security use a custom header pointing to a backend secret.</p>
            </div>
          )}
          {authType === "custom_header" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Header name</Label>
                <Input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="X-API-Key" />
              </div>
              <div className="space-y-1.5">
                <Label>Header value</Label>
                <Input value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} type="password" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Custom headers (optional)</Label>
            <Textarea
              rows={3}
              value={customHeadersText}
              onChange={(e) => setCustomHeadersText(e.target.value)}
              placeholder={`JSON: {"X-Source":"leadforge"}\nor lines:\nX-Source: leadforge`}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Payload template</Label>
              <span className="text-[11px] text-muted-foreground">Use <code className="bg-muted px-1 rounded">{`{{variable}}`}</code> tokens — see preview below.</span>
            </div>
            <Textarea rows={10} value={template} onChange={(e) => setTemplate(e.target.value)} className="font-mono text-xs" />
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs font-medium mb-1">Rendered sample payload</div>
            <pre className="text-[11px] overflow-auto max-h-40">{JSON.stringify(sampleBody, null, 2)}</pre>
          </div>

          {result && (
            <div className={`rounded-md border p-3 text-xs ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                <span>{result.ok ? "Test succeeded" : "Test failed"}</span>
                <Badge variant="outline">{result.status || "—"} {result.statusText}</Badge>
                <span className="text-muted-foreground">{result.durationMs}ms</span>
              </div>
              {result.error && <div className="mt-1 text-rose-700">{result.error}</div>}
              {result.responseBody && (
                <pre className="mt-2 max-h-32 overflow-auto bg-card border rounded p-2">{result.responseBody}</pre>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !url}>
            {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Test webhook
          </Button>
          <Button onClick={save}>{existing ? "Save changes" : "Save integration"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultName(p: IntegrationProvider) {
  if (p === "zapier") return "Zapier webhook";
  if (p === "make") return "Make webhook";
  return "Generic webhook";
}
function labelFor(p: IntegrationProvider) {
  if (p === "zapier") return "Zapier";
  if (p === "make") return "Make";
  return "Generic Webhook";
}
