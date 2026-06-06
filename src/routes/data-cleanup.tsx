import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, AlertTriangle, AlertCircle, FileWarning, Sparkles, CheckCircle2,
  Download, ChevronRight, Eye, X, Wand2, Phone, Globe, MapPin, Star,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fetchBusinesses, fetchCategories, updateBusiness, bulkUpdateBusinesses } from "@/lib/db";
import { BusinessDetailDrawer } from "@/components/BusinessDetailDrawer";
import { CategoryBadge, StatusBadge } from "@/components/Badges";
import { RatingStars } from "@/components/RatingStars";
import {
  buildClusters, mergeInto, getInvalidFields, isReadyToExport,
  normalizeWebsite, normalizeName, normalizeAddress,
} from "@/lib/cleanup";
import { normalizePhone } from "@/lib/coerce";
import { leadScore, scoreLabel } from "@/lib/quality";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { Business } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "duplicates" | "missing" | "invalid" | "weak" | "ready";

export const Route = createFileRoute("/data-cleanup")({
  head: () => ({ meta: [{ title: "Data cleanup · LeadForge" }] }),
  component: DataCleanupPage,
});

function DataCleanupPage() {
  const qc = useQueryClient();
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const [tab, setTab] = useState<Tab>("duplicates");
  const [detail, setDetail] = useState<Business | null>(null);

  const clusters = useMemo(
    () => buildClusters(businesses.filter((b) => b.cleanup_status !== "merged" && b.cleanup_status !== "ignored")),
    [businesses],
  );

  const stats = useMemo(() => {
    const active = businesses.filter((b) => b.cleanup_status !== "merged");
    return {
      duplicates: clusters.reduce((n, c) => n + c.businesses.length, 0),
      missing_phone: active.filter((b) => !b.phone).length,
      missing_website: active.filter((b) => !b.website_url).length,
      missing_address: active.filter((b) => !b.address).length,
      missing_name: active.filter((b) => !b.name?.trim()).length,
      invalid_url: active.filter((b) => getInvalidFields(b).includes("website")).length,
      invalid_phone: active.filter((b) => getInvalidFields(b).includes("phone")).length,
      weak: active.filter((b) => leadScore(b) < 40).length,
      ready: active.filter((b) => isReadyToExport(b)).length,
    };
  }, [businesses, clusters]);

  return (
    <AppShell title="Data cleanup">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Possible duplicates" value={stats.duplicates} icon={Copy} tone="orange" onClick={() => setTab("duplicates")} />
        <StatCard label="Missing phone" value={stats.missing_phone} icon={Phone} tone="amber" onClick={() => setTab("missing")} />
        <StatCard label="Missing website" value={stats.missing_website} icon={Globe} tone="amber" onClick={() => setTab("missing")} />
        <StatCard label="Missing address" value={stats.missing_address} icon={MapPin} tone="amber" onClick={() => setTab("missing")} />
        <StatCard label="Missing name" value={stats.missing_name} icon={FileWarning} tone="amber" onClick={() => setTab("missing")} />
        <StatCard label="Invalid URLs" value={stats.invalid_url} icon={AlertCircle} tone="rose" onClick={() => setTab("invalid")} />
        <StatCard label="Invalid phones" value={stats.invalid_phone} icon={AlertCircle} tone="rose" onClick={() => setTab("invalid")} />
        <StatCard label="Weak leads" value={stats.weak} icon={AlertTriangle} tone="rose" onClick={() => setTab("weak")} />
        <StatCard label="Ready to export" value={stats.ready} icon={CheckCircle2} tone="emerald" onClick={() => setTab("ready")} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="duplicates">Duplicates <Badge variant="secondary" className="ml-2">{clusters.length}</Badge></TabsTrigger>
          <TabsTrigger value="missing">Missing data</TabsTrigger>
          <TabsTrigger value="invalid">Invalid data</TabsTrigger>
          <TabsTrigger value="weak">Weak leads</TabsTrigger>
          <TabsTrigger value="ready">Ready to export <Badge variant="secondary" className="ml-2">{stats.ready}</Badge></TabsTrigger>
        </TabsList>

        <TabsContent value="duplicates">
          <DuplicatesPanel clusters={clusters} categories={catMap} onOpen={setDetail} onChange={() => qc.invalidateQueries({ queryKey: ["businesses"] })} />
        </TabsContent>
        <TabsContent value="missing">
          <MissingDataPanel businesses={businesses} onOpen={setDetail} />
        </TabsContent>
        <TabsContent value="invalid">
          <InvalidDataPanel businesses={businesses} onOpen={setDetail} />
        </TabsContent>
        <TabsContent value="weak">
          <WeakLeadsPanel businesses={businesses} categories={catMap} onOpen={setDetail} />
        </TabsContent>
        <TabsContent value="ready">
          <ReadyPanel businesses={businesses} categories={catMap} onOpen={setDetail} />
        </TabsContent>
      </Tabs>

      <BusinessDetailDrawer
        business={detail}
        categories={categories}
        allBusinesses={businesses}
        onClose={() => setDetail(null)}
      />
    </AppShell>
  );
}

// ---------- Stat card ----------
const TONE: Record<string, string> = {
  amber: "border-amber-200 hover:bg-amber-50 [&_.icn]:text-amber-600",
  orange: "border-orange-200 hover:bg-orange-50 [&_.icn]:text-orange-600",
  rose: "border-rose-200 hover:bg-rose-50 [&_.icn]:text-rose-600",
  emerald: "border-emerald-200 hover:bg-emerald-50 [&_.icn]:text-emerald-600",
};
function StatCard({ label, value, icon: Icon, tone, onClick }: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn("text-left rounded-xl border bg-card p-4 transition group", TONE[tone])}>
      <div className="flex items-center justify-between">
        <Icon className="icn h-4 w-4" />
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
}

// ---------- Duplicates panel ----------
function DuplicatesPanel({
  clusters, categories, onOpen, onChange,
}: { clusters: ReturnType<typeof buildClusters>; categories: Map<string, { name: string; color: string }>; onOpen: (b: Business) => void; onChange: () => void }) {
  const [mergeTarget, setMergeTarget] = useState<{ primary: Business; others: Business[] } | null>(null);

  const ignoreMut = useMutation({
    mutationFn: async (ids: string[]) => bulkUpdateBusinesses(ids, { cleanup_status: "ignored" }),
    onSuccess: () => { onChange(); toast.success("Cluster ignored"); },
  });
  const markDupMut = useMutation({
    mutationFn: async (ids: string[]) => bulkUpdateBusinesses(ids, { status: "duplicate" }),
    onSuccess: () => { onChange(); toast.success("Marked as duplicate"); },
  });

  if (clusters.length === 0) {
    return <EmptyState icon={CheckCircle2} title="No duplicate clusters" body="All your businesses look unique. Nice." />;
  }
  return (
    <>
      <div className="space-y-4">
        {clusters.map((cluster) => {
          const primary = cluster.businesses[0];
          return (
            <Card key={cluster.key} className="p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Copy className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">{cluster.businesses.length} possible duplicates</span>
                  <Badge variant="outline" className="text-xs">{cluster.reason}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => ignoreMut.mutate(cluster.businesses.map((b) => b.id))}>
                    <X className="h-3.5 w-3.5 mr-1" /> Ignore warning
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => markDupMut.mutate(cluster.businesses.slice(1).map((b) => b.id))}>
                    Mark others as duplicate
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {cluster.businesses.map((b, idx) => (
                  <DuplicateCard
                    key={b.id}
                    business={b}
                    isPrimary={idx === 0}
                    category={b.category_id ? categories.get(b.category_id) : null}
                    onOpen={() => onOpen(b)}
                    onKeep={() => setMergeTarget({ primary: b, others: cluster.businesses.filter((x) => x.id !== b.id) })}
                  />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <MergeDialog
        data={mergeTarget}
        onClose={() => setMergeTarget(null)}
        onMerged={() => { setMergeTarget(null); onChange(); }}
      />
    </>
  );
}

function DuplicateCard({
  business: b, isPrimary, category, onOpen, onKeep,
}: { business: Business; isPrimary: boolean; category: { name: string; color: string } | null | undefined; onOpen: () => void; onKeep: () => void }) {
  const score = leadScore(b);
  const sl = scoreLabel(score);
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 flex flex-col gap-2 text-sm",
      isPrimary && "border-primary ring-1 ring-primary/30",
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium truncate">{b.name || "—"}</div>
        {isPrimary && <Badge className="text-[10px]">Best</Badge>}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {category ? <CategoryBadge name={category.name} color={category.color} /> : <span className="text-muted-foreground">uncategorized</span>}
        <StatusBadge status={b.status} />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <RatingStars value={b.rating} />
        <span className="text-muted-foreground tabular-nums">{b.review_count?.toLocaleString() ?? 0}</span>
      </div>
      <KV label="Phone" v={b.phone} />
      <KV label="Website" v={b.website_url} />
      <KV label="Address" v={b.address} />
      <KV label="GMaps" v={b.gmaps_url} mono />
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Imported {new Date(b.created_at).toLocaleDateString()}</span>
        <span className={cn("rounded px-1.5 py-0.5 border", sl.tone)}>{score} · {sl.label}</span>
      </div>
      <div className="flex gap-1.5 mt-1">
        <Button size="sm" variant="default" className="h-7 text-xs flex-1" onClick={onKeep}>Keep & merge</Button>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onOpen}><Eye className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}

function KV({ label, v, mono }: { label: string; v: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-muted-foreground w-14 shrink-0">{label}</span>
      <span className={cn("truncate", mono && "font-mono text-[11px]", !v && "text-muted-foreground italic")}>
        {v || "—"}
      </span>
    </div>
  );
}

function MergeDialog({ data, onClose, onMerged }: {
  data: { primary: Business; others: Business[] } | null;
  onClose: () => void;
  onMerged: () => void;
}) {
  const mergeMut = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const patch = mergeInto(data.primary, data.others);
      await updateBusiness(data.primary.id, patch);
      await bulkUpdateBusinesses(
        data.others.map((o) => o.id),
        { status: "duplicate", cleanup_status: "merged" },
      );
    },
    onSuccess: () => { toast.success("Merged"); onMerged(); },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  const preview = mergeInto(data.primary, data.others);
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge {data.others.length} record{data.others.length > 1 ? "s" : ""} into "{data.primary.name || "this record"}"?</DialogTitle>
          <DialogDescription>
            Missing fields will be filled from the other records. The originals will be marked as Duplicate / Merged.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm max-h-60 overflow-y-auto">
          {Object.entries(preview).map(([k, v]) => {
            if (k === "raw_data" || k === "merged_from") return null;
            const before = (data.primary as unknown as Record<string, unknown>)[k];
            const changed = before !== v && v != null;
            if (!changed) return null;
            return (
              <div key={k} className="flex items-baseline gap-2 text-xs">
                <span className="text-muted-foreground w-32 shrink-0">{k}</span>
                <span className="line-through text-rose-700 truncate flex-1">{String(before ?? "—")}</span>
                <span className="text-emerald-700 truncate flex-1">{String(v ?? "—")}</span>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mergeMut.mutate()} disabled={mergeMut.isPending}>
            {mergeMut.isPending ? "Merging…" : "Confirm merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Missing data ----------
function MissingDataPanel({ businesses, onOpen }: { businesses: Business[]; onOpen: (b: Business) => void }) {
  const rows = useMemo(
    () => businesses.filter((b) => b.cleanup_status !== "merged" && b.cleanup_status !== "ignored" &&
      (!b.name || !b.phone || !b.website_url || !b.address || !b.gmaps_url || b.rating == null)),
    [businesses],
  );
  if (rows.length === 0) return <EmptyState icon={CheckCircle2} title="Nothing missing" body="Every business has the key fields." />;
  return <InlineEditList rows={rows} onOpen={onOpen} mode="missing" />;
}

// ---------- Invalid data ----------
function InvalidDataPanel({ businesses, onOpen }: { businesses: Business[]; onOpen: (b: Business) => void }) {
  const rows = useMemo(
    () => businesses.filter((b) => b.cleanup_status !== "merged" && getInvalidFields(b).length > 0),
    [businesses],
  );
  if (rows.length === 0) return <EmptyState icon={CheckCircle2} title="No invalid values" body="Phones, URLs, ratings all look good." />;
  return <InlineEditList rows={rows} onOpen={onOpen} mode="invalid" />;
}

// ---------- Weak leads ----------
function WeakLeadsPanel({ businesses, categories, onOpen }: { businesses: Business[]; categories: Map<string, { name: string; color: string }>; onOpen: (b: Business) => void }) {
  const rows = useMemo(
    () => businesses
      .filter((b) => b.cleanup_status !== "merged" && leadScore(b) < 40)
      .sort((a, b) => leadScore(a) - leadScore(b)),
    [businesses],
  );
  if (rows.length === 0) return <EmptyState icon={Sparkles} title="No weak leads" body="Your data quality is strong." />;
  return (
    <Card className="divide-y">
      {rows.map((b) => {
        const score = leadScore(b);
        const sl = scoreLabel(score);
        const cat = b.category_id ? categories.get(b.category_id) : null;
        return (
          <div key={b.id} className="p-3 flex items-center gap-3 hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{b.name || "—"}</div>
              <div className="text-xs text-muted-foreground truncate">{b.address || "no address"}</div>
            </div>
            {cat && <CategoryBadge name={cat.name} color={cat.color} />}
            <span className={cn("text-xs rounded px-2 py-0.5 border tabular-nums", sl.tone)}>{score}</span>
            <Button size="sm" variant="outline" onClick={() => onOpen(b)}>Open</Button>
          </div>
        );
      })}
    </Card>
  );
}

// ---------- Ready to export ----------
function ReadyPanel({ businesses, categories, onOpen }: { businesses: Business[]; categories: Map<string, { name: string; color: string }>; onOpen: (b: Business) => void }) {
  const [catFilter, setCatFilter] = useState<string>("all");
  const [minScore, setMinScore] = useState("0");
  const rows = useMemo(() => {
    let r = businesses.filter((b) => isReadyToExport(b));
    if (catFilter !== "all") r = r.filter((b) => b.category_id === catFilter);
    const m = parseInt(minScore, 10);
    if (m > 0) r = r.filter((b) => leadScore(b) >= m);
    return r;
  }, [businesses, catFilter, minScore]);

  const exportNow = () => {
    const out = rows.map((b) => ({
      name: b.name, business_category: b.business_category,
      phone: b.phone, email: b.email, website_url: b.website_url, gmaps_url: b.gmaps_url,
      address: b.address, city: b.city, state: b.state,
      rating: b.rating, review_count: b.review_count, lead_score: leadScore(b),
      status: b.status,
    }));
    downloadCsv(`ready-to-export-${Date.now()}.csv`, toCsv(out));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm bg-background">
          <option value="all">All categories</option>
          {[...categories.entries()].map(([id, c]) => <option key={id} value={id}>{c.name}</option>)}
        </select>
        <select value={minScore} onChange={(e) => setMinScore(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm bg-background">
          <option value="0">Any score</option>
          <option value="40">Score 40+</option>
          <option value="60">Score 60+</option>
          <option value="80">Score 80+ (strong)</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{rows.length} ready</span>
          <Button onClick={exportNow} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1.5" /> Export
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing ready yet" body="Clean some records to make them export-ready." />
      ) : (
        <Card className="divide-y">
          {rows.slice(0, 200).map((b) => {
            const cat = b.category_id ? categories.get(b.category_id) : null;
            return (
              <div key={b.id} className="p-3 flex items-center gap-3 hover:bg-muted/40">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{b.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.phone || b.website_url || b.address || ""}
                  </div>
                </div>
                {cat && <CategoryBadge name={cat.name} color={cat.color} />}
                <span className="text-xs tabular-nums">{leadScore(b)}</span>
                <Button size="sm" variant="outline" onClick={() => onOpen(b)}>Open</Button>
              </div>
            );
          })}
          {rows.length > 200 && <div className="p-3 text-xs text-muted-foreground text-center">Showing 200 of {rows.length}. Export to see all.</div>}
        </Card>
      )}
    </div>
  );
}

// ---------- Inline editable list (missing + invalid) ----------
function InlineEditList({ rows, onOpen, mode }: { rows: Business[]; onOpen: (b: Business) => void; mode: "missing" | "invalid" }) {
  const qc = useQueryClient();
  const editMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Business> }) => updateBusiness(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });

  return (
    <Card className="overflow-hidden">
      <div className="divide-y">
        {rows.slice(0, 200).map((b) => {
          const invalid = getInvalidFields(b);
          const issues = mode === "invalid"
            ? invalid
            : [
              !b.name && "name", !b.phone && "phone", !b.website_url && "website",
              !b.address && "address", !b.gmaps_url && "gmaps", b.rating == null && "rating",
            ].filter(Boolean) as string[];
          return (
            <div key={b.id} className="p-3 flex flex-col md:flex-row gap-3 hover:bg-muted/40">
              <div className="min-w-0 md:w-64">
                <div className="font-medium truncate">{b.name || <span className="italic text-muted-foreground">no name</span>}</div>
                <div className="text-xs text-muted-foreground truncate">{b.address || "—"}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {issues.map((i) => (
                    <span key={i} className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border",
                      mode === "invalid" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-800 border-amber-200",
                    )}>
                      {mode === "invalid" ? "invalid " : "missing "}{i}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InlineField label="Phone" value={b.phone ?? ""} onSave={(v) => editMut.mutate({ id: b.id, patch: { phone: v ? normalizePhone(v) : null } })} />
                <InlineField label="Website" value={b.website_url ?? ""} onSave={(v) => editMut.mutate({ id: b.id, patch: { website_url: v ? normalizeWebsite(v) : null } })} />
                <InlineField label="Name" value={b.name ?? ""} onSave={(v) => editMut.mutate({ id: b.id, patch: { name: v ? normalizeName(v) : null } })} />
                <InlineField label="Address" value={b.address ?? ""} onSave={(v) => editMut.mutate({ id: b.id, patch: { address: v ? normalizeAddress(v) : null } })} />
              </div>
              <div className="flex md:flex-col gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onOpen(b)}><Eye className="h-3.5 w-3.5 mr-1" />Open</Button>
                <Button size="sm" variant="ghost" onClick={() => editMut.mutate({ id: b.id, patch: { cleanup_status: "ignored" } })}>Ignore</Button>
                <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => editMut.mutate({ id: b.id, patch: { status: "bad_data", cleanup_status: "bad_data" } })}>Bad data</Button>
                <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => editMut.mutate({ id: b.id, patch: { status: "reviewed", cleanup_status: "clean" } })}>Reviewed</Button>
              </div>
            </div>
          );
        })}
      </div>
      {rows.length > 200 && <div className="p-3 text-xs text-muted-foreground text-center border-t">Showing 200 of {rows.length}.</div>}
    </Card>
  );
}

function InlineField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-14 shrink-0">{label}</span>
      <Input value={v} onChange={(e) => setV(e.target.value)} className="h-8 text-xs" />
      {dirty && <Button size="sm" className="h-7" onClick={() => onSave(v)}>Save</Button>}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Card className="p-12 text-center">
      <Icon className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </Card>
  );
}
