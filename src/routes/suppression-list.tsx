import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { fetchSuppression, addSuppression, removeSuppression } from "@/lib/outreach/db";
import { SUPPRESSION_REASON_OPTIONS, type SuppressionEntry, type SuppressionReason } from "@/lib/outreach/types";
import { toast } from "sonner";

export const Route = createFileRoute("/suppression-list")({ component: SuppressionPage });

function SuppressionPage() {
  const [list, setList] = useState<SuppressionEntry[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; domain: string; reason: SuppressionReason; notes: string }>({
    email: "", domain: "", reason: "manual_block", notes: "",
  });

  async function refresh() { setList(await fetchSuppression()); }
  useEffect(() => { refresh(); }, []);

  const filtered = list.filter((s) =>
    !search || (s.email ?? "").includes(search.toLowerCase()) || (s.domain ?? "").includes(search.toLowerCase()),
  );

  async function add() {
    if (!form.email && !form.domain) { toast.error("Enter an email or domain"); return; }
    await addSuppression({
      email: form.email || null, domain: form.domain || null,
      reason: form.reason, notes: form.notes || null, source: "manual",
    });
    setOpen(false); setForm({ email: "", domain: "", reason: "manual_block", notes: "" });
    refresh(); toast.success("Added to suppression list");
  }

  return (
    <AppShell
      title="Suppression list"
      action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Add</Button>}
    >
      <div className="mb-4 flex items-center gap-3">
        <Input placeholder="Search email or domain…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <div className="text-sm text-muted-foreground">{filtered.length} entries</div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">No suppressed contacts.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Email / Domain</TableHead><TableHead>Reason</TableHead>
                <TableHead>Source</TableHead><TableHead>Added</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email ?? `@${s.domain}`}</TableCell>
                    <TableCell><Badge variant="outline">{s.reason}</Badge></TableCell>
                    <TableCell className="text-xs">{s.source ?? "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={async () => { await removeSuppression(s.id); refresh(); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add to suppression list</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" /></div>
            <div><Label>Or whole domain</Label><Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="example.com" /></div>
            <div>
              <Label>Reason</Label>
              <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v as SuppressionReason })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPRESSION_REASON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={add}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
