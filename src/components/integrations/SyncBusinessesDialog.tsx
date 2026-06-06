import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { fetchIntegrations } from "@/lib/integrations/db";
import type { Integration } from "@/lib/integrations/types";
import { PROVIDER_META } from "@/lib/integrations/types";
import { syncBusinesses } from "@/lib/integrations/sync.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function SyncBusinessesDialog({
  open, onOpenChange, businessIds,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  businessIds: string[];
}) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ total: number; succeeded: number; failed: number; errors: { businessId: string; message: string }[] } | null>(null);
  const run = useServerFn(syncBusinesses);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    fetchIntegrations().then((list) => {
      const usable = list.filter((i) => i.is_enabled && ["webhook", "zapier", "make", "airtable"].includes(i.provider));
      setIntegrations(usable);
      if (usable.length > 0) setSelected(usable[0].id);
    });
  }, [open]);

  async function start() {
    if (!selected) return;
    setRunning(true);
    try {
      const r = await run({ data: { integrationId: selected, businessIds } });
      setResult(r);
      if (r.failed === 0) toast.success(`Synced ${r.succeeded} of ${r.total}`);
      else toast.warning(`Synced ${r.succeeded} of ${r.total} — ${r.failed} failed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync {businessIds.length} {businessIds.length === 1 ? "lead" : "leads"} to CRM</DialogTitle>
        </DialogHeader>

        {integrations.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            No enabled integrations support push sync yet. Go to <span className="font-medium">Integrations</span> and connect a Webhook, Zapier, Make, or Airtable destination.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Destination</label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {integrations.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} <span className="text-muted-foreground text-xs ml-1">({PROVIDER_META[i.provider].label})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Each lead is sent according to the integration's field mappings. Jobs are recorded in Sync Center.
            </p>

            {result && (
              <div className="rounded border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Succeeded: <Badge variant="outline">{result.succeeded}</Badge></span>
                  <span>Failed: <Badge variant="outline" className={result.failed ? "text-rose-700" : ""}>{result.failed}</Badge></span>
                </div>
                {result.errors.slice(0, 5).map((e, i) => (
                  <div key={i} className="text-xs text-rose-700">• {e.message}</div>
                ))}
                {result.errors.length > 5 && <div className="text-xs text-muted-foreground">+ {result.errors.length - 5} more — see Sync Center.</div>}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!selected || running || integrations.length === 0} onClick={start}>
            <Send className="h-4 w-4 mr-1" />{running ? "Syncing…" : `Sync ${businessIds.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
