import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ProviderCard } from "@/components/integrations/ProviderCard";
import { WebhookSetupDialog } from "@/components/integrations/WebhookSetupDialog";
import { AirtableSetupDialog } from "@/components/integrations/AirtableSetupDialog";
import { fetchIntegrations, deleteIntegration, updateIntegration } from "@/lib/integrations/db";
import { testWebhook } from "@/lib/integrations/webhook.functions";
import { testAirtable } from "@/lib/integrations/airtable.functions";
import { useServerFn } from "@tanstack/react-start";
import type { Integration, IntegrationProvider } from "@/lib/integrations/types";
import { PROVIDER_META } from "@/lib/integrations/types";
import { toast } from "sonner";
import { buildVariables, renderJsonTemplate, SAMPLE_BUSINESS } from "@/lib/integrations/variables";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/integrations")({ component: IntegrationsPage });

const PROVIDERS: IntegrationProvider[] = [
  "webhook", "zapier", "make", "airtable",
  "hubspot", "pipedrive", "salesforce", "gohighlevel", "csv_scheduled",
];

function IntegrationsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Integration[]>([]);
  const [webhookOpen, setWebhookOpen] = useState(false);
  const [airtableOpen, setAirtableOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<IntegrationProvider>("webhook");
  const [editing, setEditing] = useState<Integration | null>(null);

  const runWebhook = useServerFn(testWebhook);
  const runAirtable = useServerFn(testAirtable);

  async function refresh() { setList(await fetchIntegrations()); }
  useEffect(() => { refresh(); }, []);

  function openSetup(provider: IntegrationProvider, existing: Integration | null = null) {
    setEditingProvider(provider);
    setEditing(existing);
    if (provider === "airtable") setAirtableOpen(true);
    else if (["webhook", "zapier", "make"].includes(provider)) setWebhookOpen(true);
    else toast.info(`${PROVIDER_META[provider].label} integration is coming soon. UI is ready; provider credentials aren't supported yet.`);
  }

  async function test(integration: Integration) {
    const t = toast.loading("Testing connection…");
    try {
      let ok = false; let msg = "";
      if (integration.provider === "airtable") {
        const cfg = integration.config as Record<string, unknown>;
        const r = await runAirtable({ data: {
          secretName: String(cfg.secret_name ?? "AIRTABLE_API_KEY"),
          baseId: String(cfg.base_id ?? ""), tableName: String(cfg.table_name ?? ""),
        }});
        ok = r.ok; msg = r.message;
      } else if (["webhook", "zapier", "make"].includes(integration.provider)) {
        const cfg = integration.config as Record<string, unknown>;
        const vars = buildVariables({ business: SAMPLE_BUSINESS });
        const body = renderJsonTemplate(String(cfg.payload_template ?? "{}"), vars as Record<string, unknown>);
        const at = (cfg.auth_type as string) ?? "none";
        const auth =
          at === "bearer" ? { type: "bearer" as const, token: String(cfg.bearer_token ?? "") } :
          at === "custom_header" ? { type: "custom_header" as const, header: String(cfg.header_name ?? ""), value: String(cfg.header_value ?? "") } :
          { type: "none" as const };
        const r = await runWebhook({ data: {
          url: String(cfg.url ?? ""),
          method: ((cfg.method as string) ?? "POST") as "POST" | "PUT",
          auth, body,
        }});
        ok = r.ok; msg = r.error ? `${r.status} ${r.statusText}: ${r.error}` : `${r.status} ${r.statusText}`;
      } else {
        toast.dismiss(t); toast.info("Test not available for this provider yet."); return;
      }
      await updateIntegration(integration.id, {
        status: ok ? "connected" : "error",
        last_tested_at: new Date().toISOString(),
        last_error: ok ? null : msg,
      });
      await refresh();
      toast.dismiss(t);
      if (ok) toast.success("Connection OK"); else toast.error(`Test failed — ${msg}`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Test failed");
    }
  }

  async function toggle(integration: Integration) {
    await updateIntegration(integration.id, { is_enabled: !integration.is_enabled });
    await refresh();
  }
  async function remove(integration: Integration) {
    if (!confirm(`Disconnect ${integration.name}? Sync rules and history for this integration will also be removed.`)) return;
    await deleteIntegration(integration.id);
    await refresh();
    toast.success("Integration disconnected");
  }

  return (
    <AppShell title="Integrations">
      <p className="text-sm text-muted-foreground mb-4">
        Push leads, replies, and pipeline activity to your CRM or any HTTP endpoint. Generic Webhook and Airtable are fully functional; other providers show the setup UI but require credentials we haven't enabled yet.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROVIDERS.map((p) => {
          const existing = list.find((i) => i.provider === p) ?? undefined;
          return (
            <ProviderCard
              key={p}
              provider={p}
              existing={existing}
              onConnect={() => openSetup(p)}
              onConfigure={() => existing && openSetup(p, existing)}
              onManage={() => existing && navigate({ to: "/integrations/$id", params: { id: existing.id } })}
              onTest={() => existing && test(existing)}
              onDisconnect={() => existing && remove(existing)}
              onToggle={() => existing && toggle(existing)}
            />
          );
        })}
      </div>

      {list.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4 text-xs text-muted-foreground">
            Configured integrations: <span className="text-foreground font-medium">{list.length}</span> · Connected:{" "}
            <span className="text-foreground font-medium">{list.filter((i) => i.status === "connected" && i.is_enabled).length}</span> · Errors:{" "}
            <span className="text-foreground font-medium">{list.filter((i) => i.status === "error").length}</span>
          </CardContent>
        </Card>
      )}

      <WebhookSetupDialog
        open={webhookOpen}
        onOpenChange={setWebhookOpen}
        provider={editingProvider}
        existing={editing}
        onSaved={refresh}
      />
      <AirtableSetupDialog
        open={airtableOpen}
        onOpenChange={setAirtableOpen}
        existing={editing}
        onSaved={refresh}
      />
    </AppShell>
  );
}
