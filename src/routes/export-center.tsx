import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download, Plus, Sparkles, CheckCircle2, Users, Phone, Globe, Copy, Trash2,
  FileSpreadsheet, FileJson, FileText, ChevronRight, Pencil, Eye, AlertTriangle,
  History as HistoryIcon, Save,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import {
  fetchBusinesses, fetchCategories, fetchImports, fetchSegments, createSegment, updateSegment, deleteSegment,
  fetchExports, createExportRecord, deleteExportRecord, type ExportRecord,
} from "@/lib/db";
import {
  matchSegment, describeFilters, defaultFilters, type SegmentFilters, type SavedSegment,
} from "@/lib/segments";
import {
  ALL_FIELDS, DEFAULT_FIELDS, DEFAULT_OPTIONS, buildRows, exportFile, makeFilename,
  type ExportField, type ExportFormat, type ExportOptions,
} from "@/lib/export";
import { leadScore } from "@/lib/quality";
import { isReadyToExport, CLEANUP_STATUS_META } from "@/lib/cleanup";
import { STATUS_OPTIONS, type Business, type Category } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/export-center")({
  head: () => ({ meta: [{ title: "Export center · LeadForge" }] }),
  component: ExportCenterPage,
});

function ExportCenterPage() {
  const qc = useQueryClient();
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: imports = [] } = useQuery({ queryKey: ["imports"], queryFn: fetchImports });
  const { data: segments = [] } = useQuery({ queryKey: ["segments"], queryFn: fetchSegments });
  const { data: exports = [] } = useQuery({ queryKey: ["exports"], queryFn: fetchExports });

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const importMap = useMemo(() => new Map(imports.map((i) => [i.id, i])), [imports]);

  const [tab, setTab] = useState("overview");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPreset, setExportPreset] = useState<{
    source: ExportSource; segmentId?: string; categoryId?: string; selectedIds?: string[];
  }>({ source: "ready" });
  const [editingSegment, setEditingSegment] = useState<SavedSegment | "new" | null>(null);

  const stats = useMemo(() => {
    const active = businesses.filter((b) => b.cleanup_status !== "merged");
    const ready = active.filter((b) => isReadyToExport(b));
    const weekAgo = Date.now() - 7 * 86400e3;
    const exportedWeek = exports.filter((e) => new Date(e.created_at).getTime() >= weekAgo)
      .reduce((n, e) => n + (e.record_count ?? 0), 0);
    return {
      ready: ready.length,
      exportedWeek,
      segments: segments.length,
      strong: active.filter((b) => leadScore(b) >= 80).length,
      qualified: active.filter((b) => b.status === "qualified").length,
      missingContact: active.filter((b) => !b.phone && !b.email).length,
      duplicates: active.filter((b) => b.status === "duplicate").length,
    };
  }, [businesses, exports, segments]);

  const openExport = (preset: typeof exportPreset) => { setExportPreset(preset); setExportOpen(true); };

  return (
    <AppShell title="Export center" action={
      <Button onClick={() => openExport({ source: "ready" })}>
        <Download className="h-4 w-4 mr-1.5" /> New export
      </Button>
    }>
      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Ready to export" value={stats.ready} icon={CheckCircle2} tone="emerald" onClick={() => openExport({ source: "ready" })} />
        <Stat label="Exported this week" value={stats.exportedWeek} icon={HistoryIcon} tone="sky" onClick={() => setTab("history")} />
        <Stat label="Saved segments" value={stats.segments} icon={Save} tone="violet" onClick={() => setTab("segments")} />
        <Stat label="Strong leads" value={stats.strong} icon={Sparkles} tone="emerald" />
        <Stat label="Qualified leads" value={stats.qualified} icon={Users} tone="sky" />
        <Stat label="Missing contact data" value={stats.missingContact} icon={Phone} tone="amber" />
        <Stat label="Duplicates excluded" value={stats.duplicates} icon={Copy} tone="orange" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Exportable businesses</TabsTrigger>
          <TabsTrigger value="segments">Saved segments <Badge variant="secondary" className="ml-2">{segments.length}</Badge></TabsTrigger>
          <TabsTrigger value="history">Export history <Badge variant="secondary" className="ml-2">{exports.length}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ExportableTable
            businesses={businesses} categories={catMap}
            onExportSelected={(ids) => openExport({ source: "selected", selectedIds: ids })}
            onExportCategory={(id) => openExport({ source: "category", categoryId: id })}
          />
        </TabsContent>

        <TabsContent value="segments">
          <SegmentsPanel
            segments={segments} businesses={businesses} categories={catMap}
            onNew={() => setEditingSegment("new")}
            onEdit={(s) => setEditingSegment(s)}
            onExport={(s) => openExport({ source: "segment", segmentId: s.id })}
            onDelete={async (id) => { await deleteSegment(id); qc.invalidateQueries({ queryKey: ["segments"] }); toast.success("Segment deleted"); }}
            onDuplicate={async (s) => {
              await createSegment({ name: s.name + " (copy)", filters: s.filters });
              qc.invalidateQueries({ queryKey: ["segments"] });
              toast.success("Segment duplicated");
            }}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryPanel
            exports={exports} categories={catMap} segments={segments}
            businesses={businesses}
            onRerun={(e) => openExport({
              source: (e.source_type as ExportSource), segmentId: e.segment_id ?? undefined, categoryId: e.category_id ?? undefined,
            })}
            onDelete={async (id) => { await deleteExportRecord(id); qc.invalidateQueries({ queryKey: ["exports"] }); toast.success("Removed"); }}
          />
        </TabsContent>
      </Tabs>

      {/* Segment builder dialog */}
      <SegmentBuilderDialog
        open={!!editingSegment}
        initial={editingSegment === "new" ? null : editingSegment}
        businesses={businesses}
        categories={categories}
        imports={imports.map((i) => ({ id: i.id, name: i.filename }))}
        onClose={() => setEditingSegment(null)}
        onSaved={() => { setEditingSegment(null); qc.invalidateQueries({ queryKey: ["segments"] }); }}
      />

      {/* Export wizard */}
      <ExportWizard
        open={exportOpen} onClose={() => setExportOpen(false)}
        preset={exportPreset}
        businesses={businesses} categories={categories} catMap={catMap}
        imports={imports} importMap={importMap}
        segments={segments}
        onDone={() => { qc.invalidateQueries({ queryKey: ["exports"] }); qc.invalidateQueries({ queryKey: ["segments"] }); }}
      />
    </AppShell>
  );
}

// ============ Stat card ============
const TONE: Record<string, string> = {
  emerald: "border-emerald-200 hover:bg-emerald-50 [&_.icn]:text-emerald-600",
  sky: "border-sky-200 hover:bg-sky-50 [&_.icn]:text-sky-600",
  violet: "border-violet-200 hover:bg-violet-50 [&_.icn]:text-violet-600",
  amber: "border-amber-200 hover:bg-amber-50 [&_.icn]:text-amber-600",
  orange: "border-orange-200 hover:bg-orange-50 [&_.icn]:text-orange-600",
};
function Stat({ label, value, icon: Icon, tone, onClick }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string; onClick?: () => void;
}) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp onClick={onClick} className={cn("text-left rounded-xl border bg-card p-4 transition group", TONE[tone], onClick && "cursor-pointer")}>
      <div className="flex items-center justify-between">
        <Icon className="icn h-4 w-4" />
        {onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </Cmp>
  );
}

// ============ Exportable table ============
function readyBadge(b: Business) {
  if (b.status === "duplicate") return { label: "Duplicate", tone: "bg-orange-100 text-orange-700 border-orange-200" };
  if (b.status === "bad_data") return { label: "Bad data", tone: "bg-rose-100 text-rose-700 border-rose-200" };
  if (isReadyToExport(b)) return { label: "Ready", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  return { label: "Needs review", tone: "bg-amber-100 text-amber-700 border-amber-200" };
}

function ExportableTable({
  businesses, categories, onExportSelected, onExportCategory,
}: {
  businesses: Business[]; categories: Map<string, Category>;
  onExportSelected: (ids: string[]) => void;
  onExportCategory: (id: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [catFilter, setCatFilter] = useState("all");
  const rows = useMemo(() => {
    let r = businesses.filter((b) => b.cleanup_status !== "merged");
    if (catFilter !== "all") r = r.filter((b) => b.category_id === catFilter);
    return r.sort((a, b) => Number(isReadyToExport(b)) - Number(isReadyToExport(a)) || leadScore(b) - leadScore(a));
  }, [businesses, catFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {[...categories.values()].map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {catFilter !== "all" && (
          <Button size="sm" variant="outline" onClick={() => onExportCategory(catFilter)}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export this category
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button size="sm" disabled={selected.size === 0} onClick={() => onExportSelected([...selected])}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export selected
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Website</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cleanup</th>
                <th className="px-3 py-2">Ready</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((b) => {
                const cat = b.category_id ? categories.get(b.category_id) : null;
                const rb = readyBadge(b);
                const cs = CLEANUP_STATUS_META[b.cleanup_status];
                return (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(b.id)} onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(b.id); else next.delete(b.id);
                        setSelected(next);
                      }} />
                    </td>
                    <td className="px-3 py-2 max-w-[260px]">
                      <div className="font-medium truncate">{b.name || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{b.address || ""}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{cat?.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{leadScore(b)}</td>
                    <td className="px-3 py-2 text-xs truncate max-w-[140px]">{b.phone || "—"}</td>
                    <td className="px-3 py-2 text-xs truncate max-w-[180px]">{b.website_url || "—"}</td>
                    <td className="px-3 py-2"><span className="text-[10px] uppercase">{b.status}</span></td>
                    <td className="px-3 py-2"><span className={cn("text-[10px] px-1.5 py-0.5 rounded border", cs.tone)}>{cs.label}</span></td>
                    <td className="px-3 py-2"><span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", rb.tone)}>{rb.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 300 && <div className="p-3 text-xs text-muted-foreground text-center border-t">Showing 300 of {rows.length}.</div>}
          {rows.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No businesses match.</div>}
        </div>
      </Card>
    </div>
  );
}

// ============ Segments panel ============
function SegmentsPanel({
  segments, businesses, categories, onNew, onEdit, onExport, onDelete, onDuplicate,
}: {
  segments: SavedSegment[]; businesses: Business[]; categories: Map<string, Category>;
  onNew: () => void; onEdit: (s: SavedSegment) => void; onExport: (s: SavedSegment) => void;
  onDelete: (id: string) => void; onDuplicate: (s: SavedSegment) => void;
}) {
  if (segments.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Save className="h-10 w-10 text-violet-500 mx-auto mb-2" />
        <h3 className="font-semibold mb-1">No saved segments yet</h3>
        <p className="text-sm text-muted-foreground mb-4">Save your favorite filter combinations to export the same shape of leads again.</p>
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1.5" />New segment</Button>
      </Card>
    );
  }
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={onNew}><Plus className="h-4 w-4 mr-1.5" />New segment</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {segments.map((s) => {
          const count = businesses.filter((b) => matchSegment(b, s.filters)).length;
          const desc = describeFilters(s.filters, (id) => categories.get(id)?.name ?? id);
          return (
            <Card key={s.id} className="p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{s.name}</h3>
                <Badge variant="secondary" className="tabular-nums">{count}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {desc.slice(0, 5).map((d, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{d}</span>)}
                {desc.length === 0 && <span className="text-xs text-muted-foreground italic">All businesses</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Last exported: {s.last_exported_at ? new Date(s.last_exported_at).toLocaleDateString() : "never"}
              </div>
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" className="flex-1" onClick={() => onExport(s)}><Download className="h-3.5 w-3.5 mr-1" />Export</Button>
                <Button size="sm" variant="outline" onClick={() => onEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => onDuplicate(s)}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" className="text-rose-700" onClick={() => { if (confirm("Delete segment?")) onDelete(s.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ============ History panel ============
function HistoryPanel({
  exports, categories, segments, onRerun, onDelete,
}: {
  exports: ExportRecord[]; categories: Map<string, Category>; segments: SavedSegment[];
  businesses: Business[];
  onRerun: (e: ExportRecord) => void; onDelete: (id: string) => void;
}) {
  if (exports.length === 0) {
    return (
      <Card className="p-12 text-center">
        <HistoryIcon className="h-10 w-10 text-sky-500 mx-auto mb-2" />
        <h3 className="font-semibold mb-1">No exports yet</h3>
        <p className="text-sm text-muted-foreground">Your export history will appear here.</p>
      </Card>
    );
  }
  return (
    <Card className="divide-y overflow-hidden">
      {exports.map((e) => {
        const seg = e.segment_id ? segments.find((s) => s.id === e.segment_id) : null;
        const cat = e.category_id ? categories.get(e.category_id) : null;
        const Fmt = e.format === "xlsx" ? FileSpreadsheet : e.format === "json" ? FileJson : FileText;
        return (
          <div key={e.id} className="p-3 flex items-center gap-3 hover:bg-muted/40">
            <Fmt className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{e.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {e.source_type === "segment" && seg ? `Segment: ${seg.name}` : null}
                {e.source_type === "category" && cat ? `Category: ${cat.name}` : null}
                {e.source_type === "selected" ? "Selected businesses" : null}
                {e.source_type === "ready" ? "Ready to export" : null}
                {e.source_type === "all" ? "All businesses" : null}
                {" · "}{(e.fields ?? []).length} fields
              </div>
            </div>
            <div className="text-xs tabular-nums">{e.record_count.toLocaleString()} rows</div>
            <div className="text-xs text-muted-foreground hidden sm:block">{new Date(e.created_at).toLocaleString()}</div>
            <Button size="sm" variant="outline" onClick={() => onRerun(e)}><Download className="h-3.5 w-3.5 mr-1" />Re-run</Button>
            <Button size="icon" variant="ghost" className="text-rose-700 h-8 w-8" onClick={() => onDelete(e.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </Card>
  );
}

// ============ Segment builder ============
function SegmentBuilderDialog({
  open, initial, businesses, categories, imports, onClose, onSaved,
}: {
  open: boolean; initial: SavedSegment | null;
  businesses: Business[]; categories: Category[]; imports: { id: string; name: string }[];
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [f, setF] = useState<SegmentFilters>(initial?.filters ?? defaultFilters());

  // Reset when opening
  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setF(initial?.filters ?? defaultFilters());
    }
  }, [open, initial]);

  const matches = useMemo(() => businesses.filter((b) => matchSegment(b, f)), [businesses, f]);

  const save = useMutation({
    mutationFn: async () => {
      if (initial?.id) await updateSegment(initial.id, { name, filters: f });
      else await createSegment({ name, filters: f });
    },
    onSuccess: () => { toast.success("Segment saved"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit segment" : "New segment"}</DialogTitle>
          <DialogDescription>Save a reusable filter combination you can export anytime.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Segment name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Strong roofing leads in Florida" />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <SelectField label="Category" value={f.category_id ?? "all"} onChange={(v) => setF({ ...f, category_id: v === "all" ? undefined : v })}>
              <SelectItem value="all">Any category</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectField>
            <SelectField label="Business status" value={f.status ?? "all"} onChange={(v) => setF({ ...f, status: v })}>
              <SelectItem value="all">Any status</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectField>
            <SelectField label="Cleanup status" value={f.cleanup_status ?? "all"} onChange={(v) => setF({ ...f, cleanup_status: v })}>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
              <SelectItem value="bad_data">Bad data</SelectItem>
            </SelectField>
            <SelectField label="Source import" value={f.import_id ?? "all"} onChange={(v) => setF({ ...f, import_id: v === "all" ? undefined : v })}>
              <SelectItem value="all">Any import</SelectItem>
              {imports.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
            </SelectField>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <NumField label="Min lead score" value={f.score_min} onChange={(v) => setF({ ...f, score_min: v })} max={100} />
            <NumField label="Min rating" value={f.rating_min} onChange={(v) => setF({ ...f, rating_min: v })} max={5} step={0.5} />
            <NumField label="Min reviews" value={f.reviews_min} onChange={(v) => setF({ ...f, reviews_min: v })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2 rounded-lg border p-3 bg-muted/30">
            <Toggle label="Has phone" v={!!f.has_phone} onChange={(v) => setF({ ...f, has_phone: v })} />
            <Toggle label="Has website" v={!!f.has_website} onChange={(v) => setF({ ...f, has_website: v })} />
            <Toggle label="Has email" v={!!f.has_email} onChange={(v) => setF({ ...f, has_email: v })} />
            <Toggle label="Has address" v={!!f.has_address} onChange={(v) => setF({ ...f, has_address: v })} />
            <Toggle label="Has Google Maps URL" v={!!f.has_gmaps} onChange={(v) => setF({ ...f, has_gmaps: v })} />
            <Toggle label="Missing phone" v={!!f.missing_phone} onChange={(v) => setF({ ...f, missing_phone: v })} />
            <Toggle label="Missing website" v={!!f.missing_website} onChange={(v) => setF({ ...f, missing_website: v })} />
            <Toggle label="Exclude duplicates" v={!!f.exclude_duplicates} onChange={(v) => setF({ ...f, exclude_duplicates: v })} />
            <Toggle label="Exclude bad data" v={!!f.exclude_bad_data} onChange={(v) => setF({ ...f, exclude_bad_data: v })} />
            <Toggle label="Only ready-to-export" v={!!f.only_ready} onChange={(v) => setF({ ...f, only_ready: v })} />
          </div>

          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium tabular-nums">{matches.length.toLocaleString()} businesses match this segment</div>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="divide-y border rounded">
              {matches.slice(0, 5).map((b) => (
                <div key={b.id} className="px-3 py-2 text-sm flex items-center gap-2">
                  <span className="font-medium truncate flex-1">{b.name || "—"}</span>
                  <span className="text-xs text-muted-foreground truncate hidden sm:block">{b.address || ""}</span>
                  <span className="text-xs tabular-nums">{leadScore(b)}</span>
                </div>
              ))}
              {matches.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground text-center">No matches</div>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending}>
            {save.isPending ? "Saving…" : "Save segment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
function NumField({ label, value, onChange, max, step }: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; max?: number; step?: number }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type="number" min={0} max={max} step={step ?? 1} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} />
    </div>
  );
}
function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm cursor-pointer py-1">
      <span>{label}</span>
      <Switch checked={v} onCheckedChange={onChange} />
    </label>
  );
}

// ============ Export wizard ============
type ExportSource = "ready" | "all" | "filtered" | "selected" | "segment" | "category";

function ExportWizard({
  open, onClose, preset, businesses, categories, catMap, imports, importMap, segments, onDone,
}: {
  open: boolean; onClose: () => void;
  preset: { source: ExportSource; segmentId?: string; categoryId?: string; selectedIds?: string[] };
  businesses: Business[]; categories: Category[]; catMap: Map<string, Category>;
  imports: { id: string; filename: string }[]; importMap: Map<string, { filename: string }>;
  segments: SavedSegment[];
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<ExportSource>(preset.source);
  const [segmentId, setSegmentId] = useState<string | undefined>(preset.segmentId);
  const [categoryId, setCategoryId] = useState<string | undefined>(preset.categoryId);
  const [fields, setFields] = useState<ExportField[]>(DEFAULT_FIELDS);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
  const [name, setName] = useState("");

  // Initialize when opens
  useMemo(() => {
    if (open) {
      setStep(0);
      setSource(preset.source);
      setSegmentId(preset.segmentId);
      setCategoryId(preset.categoryId);
      setFields(DEFAULT_FIELDS);
      setFormat("csv");
      setOptions(DEFAULT_OPTIONS);
      setName("");
    }
  }, [open, preset]);

  const sourceLabel = useMemo(() => {
    if (source === "segment" && segmentId) return segments.find((s) => s.id === segmentId)?.name ?? "segment";
    if (source === "category" && categoryId) return catMap.get(categoryId)?.name ?? "category";
    if (source === "ready") return "ready-to-export";
    if (source === "selected") return "selected-businesses";
    return "all-businesses";
  }, [source, segmentId, categoryId, segments, catMap]);

  const base = useMemo(() => {
    let list = businesses.filter((b) => b.cleanup_status !== "merged");
    if (source === "ready") list = list.filter((b) => isReadyToExport(b));
    if (source === "selected") list = list.filter((b) => preset.selectedIds?.includes(b.id));
    if (source === "category" && categoryId) list = list.filter((b) => b.category_id === categoryId);
    if (source === "segment" && segmentId) {
      const seg = segments.find((s) => s.id === segmentId);
      if (seg) list = list.filter((b) => matchSegment(b, seg.filters));
    }
    return list;
  }, [businesses, source, segmentId, categoryId, segments, preset.selectedIds]);

  const excludedDups = useMemo(() => options.excludeDuplicates ? base.filter((b) => b.status === "duplicate").length : 0, [base, options]);
  const excludedBad = useMemo(() => options.excludeBadData ? base.filter((b) => b.status === "bad_data").length : 0, [base, options]);
  const finalList = useMemo(() => {
    let r = base;
    if (options.excludeDuplicates) r = r.filter((b) => b.status !== "duplicate");
    if (options.excludeBadData) r = r.filter((b) => b.status !== "bad_data");
    if (options.onlyReady) r = r.filter((b) => isReadyToExport(b));
    return r;
  }, [base, options]);

  const rows = useMemo(
    () => buildRows(finalList, fields, options, { categories: catMap, imports: importMap }),
    [finalList, fields, options, catMap, importMap],
  );

  const runExport = useMutation({
    mutationFn: async () => {
      const filename = makeFilename(name || sourceLabel, format);
      exportFile(filename, rows, format);
      await createExportRecord({
        name: filename,
        source_type: source,
        segment_id: segmentId ?? null,
        category_id: categoryId ?? null,
        record_count: rows.length,
        format,
        fields,
        options: options as unknown as Record<string, unknown>,
      });
      if (segmentId) await updateSegment(segmentId, { last_exported_at: new Date().toISOString() });
    },
    onSuccess: () => { toast.success("Exported"); onDone(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export businesses</DialogTitle>
          <DialogDescription>Step {step + 1} of 5</DialogDescription>
        </DialogHeader>

        {/* Step 0: source */}
        {step === 0 && (
          <div className="space-y-3">
            <Label>Choose what to export</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { v: "all", l: "All businesses" },
                { v: "ready", l: "Ready to export only" },
                { v: "selected", l: "Selected businesses", disabled: !preset.selectedIds?.length },
                { v: "segment", l: "Saved segment" },
                { v: "category", l: "Specific category" },
              ].map((o) => (
                <button
                  key={o.v} disabled={o.disabled}
                  onClick={() => setSource(o.v as ExportSource)}
                  className={cn(
                    "text-left rounded-lg border p-3 text-sm",
                    source === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    o.disabled && "opacity-50 cursor-not-allowed",
                  )}>
                  {o.l}
                </button>
              ))}
            </div>
            {source === "segment" && (
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger><SelectValue placeholder="Pick a segment" /></SelectTrigger>
                <SelectContent>{segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {source === "category" && (
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            <div className="text-sm text-muted-foreground">{base.length.toLocaleString()} businesses in source</div>
          </div>
        )}

        {/* Step 1: fields */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Choose fields</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setFields(ALL_FIELDS.map((f) => f.key))}>Select all</Button>
                <Button size="sm" variant="ghost" onClick={() => setFields(DEFAULT_FIELDS)}>Reset</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-lg border p-3 max-h-80 overflow-y-auto">
              {ALL_FIELDS.map((f) => {
                const on = fields.includes(f.key);
                return (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-muted">
                    <input type="checkbox" checked={on} onChange={(e) => {
                      if (e.target.checked) setFields([...fields, f.key]);
                      else setFields(fields.filter((x) => x !== f.key));
                    }} />
                    {f.label}
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">{fields.length} fields selected</div>
          </div>
        )}

        {/* Step 2: format */}
        {step === 2 && (
          <div className="space-y-3">
            <Label>Choose format</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: "csv", l: "CSV", I: FileText },
                { v: "xlsx", l: "Excel", I: FileSpreadsheet },
                { v: "json", l: "JSON", I: FileJson },
              ] as const).map((o) => (
                <button key={o.v}
                  onClick={() => setFormat(o.v)}
                  className={cn(
                    "rounded-lg border p-4 text-center text-sm",
                    format === o.v ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}>
                  <o.I className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: options */}
        {step === 3 && (
          <div className="space-y-3">
            <Label>Export options</Label>
            <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2 rounded-lg border p-3 bg-muted/30">
              <Toggle label="Exclude duplicates" v={options.excludeDuplicates} onChange={(v) => setOptions({ ...options, excludeDuplicates: v })} />
              <Toggle label="Exclude bad data" v={options.excludeBadData} onChange={(v) => setOptions({ ...options, excludeBadData: v })} />
              <Toggle label="Only ready businesses" v={options.onlyReady} onChange={(v) => setOptions({ ...options, onlyReady: v })} />
              <Toggle label="Include notes" v={options.includeNotes} onChange={(v) => setOptions({ ...options, includeNotes: v })} />
              <Toggle label="Include raw data" v={options.includeRawData} onChange={(v) => setOptions({ ...options, includeRawData: v })} />
              <Toggle label="Include source import" v={options.includeSourceImport} onChange={(v) => setOptions({ ...options, includeSourceImport: v })} />
              <Toggle label="Normalize phone numbers" v={options.normalizePhones} onChange={(v) => setOptions({ ...options, normalizePhones: v })} />
              <Toggle label="Normalize website URLs" v={options.normalizeWebsites} onChange={(v) => setOptions({ ...options, normalizeWebsites: v })} />
            </div>
          </div>
        )}

        {/* Step 4: preview */}
        {step === 4 && (
          <div className="space-y-3">
            <div>
              <Label>Export name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={sourceLabel} />
              <div className="text-xs text-muted-foreground mt-1">Saved as: <code>{makeFilename(name || sourceLabel, format)}</code></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Records" value={rows.length} icon={CheckCircle2} tone="emerald" />
              <Stat label="Excluded dups" value={excludedDups} icon={Copy} tone="orange" />
              <Stat label="Excluded bad" value={excludedBad} icon={AlertTriangle} tone="rose" />
              <Stat label="Missing phone" value={finalList.filter((b) => !b.phone).length} icon={Phone} tone="amber" />
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>{fields.slice(0, 6).map((f) => <th key={f} className="px-2 py-1.5 text-left">{f}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      {fields.slice(0, 6).map((f) => (
                        <td key={f} className="px-2 py-1.5 truncate max-w-[160px]">{String((r as Record<string, unknown>)[f] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nothing to export.</div>}
            </Card>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 4 && (
              <Button onClick={() => setStep(step + 1)}
                disabled={(source === "segment" && !segmentId) || (source === "category" && !categoryId) || (step === 1 && fields.length === 0)}>
                Next
              </Button>
            )}
            {step === 4 && (
              <Button onClick={() => runExport.mutate()} disabled={runExport.isPending || rows.length === 0}>
                <Download className="h-4 w-4 mr-1.5" />
                {runExport.isPending ? "Exporting…" : `Export ${rows.length.toLocaleString()} rows`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
