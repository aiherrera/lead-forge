import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { LEADFORGE_FIELDS, TRANSFORMATIONS, type IntegrationMapping } from "@/lib/integrations/types";
import { fetchMappings, upsertMappings } from "@/lib/integrations/db";
import { toast } from "sonner";

type Row = {
  source_field: string;
  target_field: string;
  transformation: string;
  is_required: boolean;
};

export function MappingEditor({ integrationId, providerLabel }: { integrationId: string; providerLabel: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await fetchMappings(integrationId);
      if (cancelled) return;
      setRows(m.length > 0 ? m.map((x: IntegrationMapping) => ({
        source_field: x.source_field, target_field: x.target_field,
        transformation: x.transformation || "text", is_required: x.is_required,
      })) : defaultRows());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [integrationId]);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function add() {
    setRows((r) => [...r, { source_field: "businessName", target_field: "", transformation: "text", is_required: false }]);
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  async function save() {
    setSaving(true);
    try {
      const filtered = rows.filter((r) => r.source_field && r.target_field);
      await upsertMappings(integrationId, filtered.map((r) => ({
        source_field: r.source_field, target_field: r.target_field,
        target_object: "lead", transformation: r.transformation, is_required: r.is_required,
      })));
      toast.success(`Saved ${filtered.length} field mappings`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="text-sm text-muted-foreground">
          Map LeadForge fields to <span className="text-foreground font-medium">{providerLabel}</span> destination fields. If no mappings are defined, the full payload is sent.
        </div>

        <div className="rounded border divide-y">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-2 bg-muted/40 text-xs font-medium">
            <div>LeadForge field</div>
            <div>Destination field</div>
            <div>Transformation</div>
            <div></div>
          </div>
          {rows.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No mappings yet. Add one to start mapping fields.</div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 p-2 items-center">
              <Select value={r.source_field} onValueChange={(v) => update(i, { source_field: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEADFORGE_FIELDS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={r.target_field} onChange={(e) => update(i, { target_field: e.target.value })} placeholder="e.g. Email, Company Name" />
              <Select value={r.transformation} onValueChange={(v) => update(i, { transformation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSFORMATIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={add}><Plus className="h-3.5 w-3.5 mr-1" />Add mapping</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save mappings"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function defaultRows(): Row[] {
  return [
    { source_field: "businessName", target_field: "Name", transformation: "text", is_required: true },
    { source_field: "email", target_field: "Email", transformation: "email", is_required: false },
    { source_field: "phone", target_field: "Phone", transformation: "phone", is_required: false },
    { source_field: "websiteUrl", target_field: "Website", transformation: "url", is_required: false },
    { source_field: "city", target_field: "City", transformation: "text", is_required: false },
  ];
}
