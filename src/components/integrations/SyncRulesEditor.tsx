import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { TRIGGER_TYPES, type SyncRule } from "@/lib/integrations/types";
import { fetchSyncRules, createSyncRule, updateSyncRule, deleteSyncRule } from "@/lib/integrations/db";
import { toast } from "sonner";

export function SyncRulesEditor({ integrationId }: { integrationId: string }) {
  const [rules, setRules] = useState<SyncRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("manual");

  async function refresh() {
    setRules(await fetchSyncRules(integrationId));
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [integrationId]);

  async function add() {
    if (!newName.trim()) { toast.error("Name required"); return; }
    await createSyncRule({
      integration_id: integrationId,
      name: newName.trim(),
      trigger_type: newTrigger,
      audience_config: {},
      sync_direction: "leadforge_to_crm",
      create_or_update_behavior: "create_or_update",
      is_enabled: true,
    });
    setNewName(""); setNewTrigger("manual");
    refresh();
  }
  async function toggle(r: SyncRule) {
    await updateSyncRule(r.id, { is_enabled: !r.is_enabled });
    refresh();
  }
  async function remove(r: SyncRule) {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    await deleteSyncRule(r.id); refresh();
  }
  async function patch(r: SyncRule, p: Partial<SyncRule>) {
    await updateSyncRule(r.id, p); refresh();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="text-sm font-medium">New sync rule</div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input placeholder="Rule name (e.g. Push qualified leads)" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Select value={newTrigger} onValueChange={setNewTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Only <span className="text-foreground">Manual selection</span> is wired into actions today. Automated triggers will fire as those flows are wired in Phase 3.
          </p>
        </CardContent>
      </Card>

      {rules.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border rounded">No rules yet.</div>
      ) : (
        <div className="rounded border divide-y">
          {rules.map((r) => (
            <div key={r.id} className="p-3 grid grid-cols-[1fr_180px_180px_auto_auto] gap-2 items-center">
              <div>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[10px]">{TRIGGER_TYPES.find((t) => t.value === r.trigger_type)?.label ?? r.trigger_type}</Badge>
                  {r.trigger_type !== "manual" && <span className="text-amber-600">Automation queued — runs in Phase 3</span>}
                </div>
              </div>
              <Select value={r.sync_direction} onValueChange={(v) => patch(r, { sync_direction: v as SyncRule["sync_direction"] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leadforge_to_crm">LeadForge → CRM</SelectItem>
                  <SelectItem value="crm_to_leadforge">CRM → LeadForge</SelectItem>
                  <SelectItem value="two_way">Two-way</SelectItem>
                </SelectContent>
              </Select>
              <Select value={r.create_or_update_behavior} onValueChange={(v) => patch(r, { create_or_update_behavior: v as SyncRule["create_or_update_behavior"] })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_only">Create only</SelectItem>
                  <SelectItem value="update_only">Update only</SelectItem>
                  <SelectItem value="create_or_update">Create or update</SelectItem>
                  <SelectItem value="skip_existing">Skip existing</SelectItem>
                  <SelectItem value="ask">Ask each time</SelectItem>
                </SelectContent>
              </Select>
              <Switch checked={r.is_enabled} onCheckedChange={() => toggle(r)} />
              <Button size="icon" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
