import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { testAirtable } from "@/lib/integrations/airtable.functions";
import { createIntegration, updateIntegration } from "@/lib/integrations/db";
import type { Integration } from "@/lib/integrations/types";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";

export function AirtableSetupDialog({
  open, onOpenChange, existing, onSaved,
}: { open: boolean; onOpenChange: (b: boolean) => void; existing?: Integration | null; onSaved: () => void }) {
  const cfg = (existing?.config ?? {}) as Record<string, unknown>;
  const [name, setName] = useState("");
  const [secretName, setSecretName] = useState("AIRTABLE_API_KEY");
  const [baseId, setBaseId] = useState("");
  const [tableName, setTableName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof testAirtable>> | null>(null);
  const run = useServerFn(testAirtable);

  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? "Airtable");
    setSecretName(String(cfg.secret_name ?? "AIRTABLE_API_KEY"));
    setBaseId(String(cfg.base_id ?? ""));
    setTableName(String(cfg.table_name ?? ""));
    setEnabled(existing?.is_enabled ?? true);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  async function handleTest() {
    setTesting(true); setResult(null);
    try {
      const r = await run({ data: { secretName, baseId, tableName } });
      setResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally { setTesting(false); }
  }

  async function save() {
    if (!name.trim() || !baseId.trim() || !tableName.trim()) {
      toast.error("Name, base ID and table name required"); return;
    }
    const config = { secret_name: secretName, base_id: baseId, table_name: tableName };
    try {
      if (existing) {
        await updateIntegration(existing.id, {
          name, config, is_enabled: enabled,
          status: result?.ok ? "connected" : existing.status,
          last_tested_at: result ? new Date().toISOString() : existing.last_tested_at,
          last_error: result && !result.ok ? result.message : null,
        });
      } else {
        await createIntegration({
          provider: "airtable", name, config, auth_type: "api_key",
          secret_reference: secretName, is_enabled: enabled,
          status: result?.ok ? "connected" : "not_connected",
          last_tested_at: result ? new Date().toISOString() : null,
          last_error: result && !result.ok ? result.message : null,
        });
      }
      toast.success(existing ? "Airtable updated" : "Airtable connected");
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Configure" : "Connect"} Airtable</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Connection name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Backend secret name</Label>
            <Input value={secretName} onChange={(e) => setSecretName(e.target.value)} placeholder="AIRTABLE_API_KEY" />
            <p className="text-[11px] text-muted-foreground">
              Name of the backend secret holding your Airtable personal access token. Add it in project secrets — never paste the raw token here.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Base ID</Label>
              <Input value={baseId} onChange={(e) => setBaseId(e.target.value)} placeholder="appXXXXXXXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Table name</Label>
              <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="Leads" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span className="text-sm">Enabled</span>
          </div>

          {result && (
            <div className={`rounded-md border p-3 text-xs ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
              <div className="flex items-center gap-2 font-medium">
                {result.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                <span>{result.ok ? "Connection OK" : "Connection failed"}</span>
                {result.status > 0 && <Badge variant="outline">{result.status}</Badge>}
              </div>
              <div className="mt-1">{result.message}</div>
              {result.sampleRecordIds?.length ? <div className="mt-1 text-muted-foreground">Sample record id: {result.sampleRecordIds[0]}</div> : null}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Test connection
          </Button>
          <Button onClick={save}>{existing ? "Save changes" : "Save integration"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
