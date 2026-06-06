import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { fetchBusinesses, fetchCategories, fetchImports, fetchExports, fetchPipelineStages, fetchTasks } from "@/lib/db";
import { leadScore } from "@/lib/quality";
import { isReadyToExport, getInvalidFields } from "@/lib/cleanup";
import { outreachReadiness } from "@/lib/pipeline";
import { STATUS_OPTIONS, type Business } from "@/lib/types";
import {
  Building2, CheckCircle2, Sparkles, Star, PhoneOff, GlobeIcon, Copy, ShieldAlert,
  Download as DownloadIcon, ArrowDown, ArrowUp, FilterX,
} from "lucide-react";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics · LeadForge" }] }),
  component: AnalyticsPage,
});

type Filters = {
  categoryId: string;
  importId: string;
  status: string;
  cleanup_status: string;
  scoreMin: number;
  scoreMax: number;
  from: string;
  to: string;
};
const DEFAULTS: Filters = {
  categoryId: "all", importId: "all", status: "all", cleanup_status: "all",
  scoreMin: 0, scoreMax: 100, from: "", to: "",
};

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function AnalyticsPage() {
  const { data: businesses = [], isLoading } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: imports = [] } = useQuery({ queryKey: ["imports"], queryFn: fetchImports });
  const { data: exports_ = [] } = useQuery({ queryKey: ["exports"], queryFn: fetchExports });
  const [f, setF] = useState<Filters>(DEFAULTS);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const impMap = useMemo(() => new Map(imports.map((i) => [i.id, i])), [imports]);

  const filtered = useMemo(() => {
    return businesses.filter((b) => {
      if (f.categoryId !== "all" && b.category_id !== f.categoryId) return false;
      if (f.importId !== "all" && b.import_id !== f.importId) return false;
      if (f.status !== "all" && b.status !== f.status) return false;
      if (f.cleanup_status !== "all" && b.cleanup_status !== f.cleanup_status) return false;
      const s = leadScore(b);
      if (s < f.scoreMin || s > f.scoreMax) return false;
      if (f.from && new Date(b.created_at) < new Date(f.from)) return false;
      if (f.to && new Date(b.created_at) > new Date(f.to + "T23:59:59")) return false;
      return true;
    });
  }, [businesses, f]);

  const total = filtered.length;
  const ready = filtered.filter(isReadyToExport).length;
  const strong = filtered.filter((b) => leadScore(b) >= 80).length;
  const good = filtered.filter((b) => { const s = leadScore(b); return s >= 60 && s < 80; }).length;
  const needsReview = filtered.filter((b) => { const s = leadScore(b); return s >= 40 && s < 60; }).length;
  const weak = filtered.filter((b) => leadScore(b) < 40).length;
  const missingPhone = filtered.filter((b) => !b.phone).length;
  const missingWebsite = filtered.filter((b) => !b.website_url).length;
  const missingBoth = filtered.filter((b) => !b.phone && !b.website_url).length;
  const hasBoth = filtered.filter((b) => b.phone && b.website_url).length;
  const hasAddress = filtered.filter((b) => !!b.address).length;
  const hasRating = filtered.filter((b) => b.rating != null).length;
  const hasGmaps = filtered.filter((b) => !!b.gmaps_url).length;
  const possibleDuplicates = filtered.filter((b) => b.status === "duplicate" || b.cleanup_status === "merged").length;
  const badData = filtered.filter((b) => b.status === "bad_data" || b.cleanup_status === "bad_data").length;
  const invalid = filtered.filter((b) => getInvalidFields(b).length > 0).length;
  const clean = filtered.filter((b) => b.cleanup_status === "clean").length;
  const valid = filtered.filter((b) => getInvalidFields(b).length === 0 && b.status !== "bad_data").length;
  // exports table doesn't track per-business ids — use exports row count summary
  const exportedRecords = exports_.reduce((s, e) => s + (e.record_count ?? 0), 0);

  // Status counts
  const statusCounts = STATUS_OPTIONS.map((s) => ({
    key: s.value, label: s.label, count: filtered.filter((b) => b.status === s.value).length,
  }));

  // Distribution
  const distribution = [
    { key: "strong", label: "80–100 Strong", count: strong, color: "#10b981", quick: "strong" },
    { key: "good", label: "60–79 Good", count: good, color: "#0ea5e9", quick: "good" },
    { key: "needs", label: "40–59 Needs review", count: needsReview, color: "#f59e0b", quick: "needs_review" },
    { key: "weak", label: "0–39 Weak", count: weak, color: "#ef4444", quick: "weak" },
  ];

  // Category performance
  const perCategory = categories.map((c) => {
    const rows = filtered.filter((b) => b.category_id === c.id);
    const t = rows.length;
    const avg = t ? Math.round(rows.reduce((s, b) => s + leadScore(b), 0) / t) : 0;
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      total: t,
      avg,
      ready: rows.filter(isReadyToExport).length,
      strong: rows.filter((b) => leadScore(b) >= 80).length,
      missingPhone: rows.filter((b) => !b.phone).length,
      missingWebsite: rows.filter((b) => !b.website_url).length,
      duplicates: rows.filter((b) => b.status === "duplicate").length,
      bad: rows.filter((b) => b.status === "bad_data").length,
      exported: exports_.filter((e) => e.category_id === c.id).reduce((s, e) => s + (e.record_count ?? 0), 0),
    };
  }).filter((c) => c.total > 0);

  type CatKey = "name" | "total" | "avg" | "ready" | "strong" | "missingPhone" | "missingWebsite" | "duplicates" | "bad" | "exported";
  const [catSort, setCatSort] = useState<{ key: CatKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const sortedCats = [...perCategory].sort((a, b) => {
    const av = a[catSort.key];
    const bv = b[catSort.key];
    if (typeof av === "string" && typeof bv === "string") {
      return catSort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return catSort.dir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  function toggleSort(k: CatKey) {
    setCatSort((s) => s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" });
  }
  function SortHead({ k, label }: { k: CatKey; label: string }) {
    const active = catSort.key === k;
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
        <div className="inline-flex items-center gap-1">
          {label}
          {active && (catSort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </div>
      </TableHead>
    );
  }

  // Imports quality
  const perImport = imports.map((imp) => {
    const rows = filtered.filter((b) => b.import_id === imp.id);
    const t = rows.length;
    const r = rows.filter(isReadyToExport).length;
    const avg = t ? Math.round(rows.reduce((s, b) => s + leadScore(b), 0) / t) : 0;
    const ratio = t ? r / t : 0;
    let qLabel = "Poor quality", qTone = "bg-rose-100 text-rose-700 border-rose-200";
    if (ratio >= 0.8) { qLabel = "Excellent"; qTone = "bg-emerald-100 text-emerald-700 border-emerald-200"; }
    else if (ratio >= 0.6) { qLabel = "Good"; qTone = "bg-sky-100 text-sky-700 border-sky-200"; }
    else if (ratio >= 0.3) { qLabel = "Needs cleanup"; qTone = "bg-amber-100 text-amber-800 border-amber-200"; }
    return {
      imp,
      catName: imp.category_id ? catMap.get(imp.category_id)?.name ?? "—" : "—",
      total: imp.row_count,
      imported: imp.imported_rows,
      duplicates: imp.duplicate_rows,
      skipped: imp.skipped_rows,
      missingPhone: rows.filter((b) => !b.phone).length,
      missingWebsite: rows.filter((b) => !b.website_url).length,
      invalid: rows.filter((b) => getInvalidFields(b).length > 0).length,
      avg,
      ready: r,
      qLabel, qTone,
    };
  });

  // Funnel
  const importedCount = imports.reduce((s, i) => s + (i.imported_rows ?? 0), 0);
  const validCount = valid;
  const cleanCount = clean || valid; // fallback
  const funnel = [
    { label: "Imported", value: importedCount, color: "#6366f1" },
    { label: "Valid", value: validCount, color: "#3b82f6" },
    { label: "Clean", value: cleanCount, color: "#06b6d4" },
    { label: "Ready to export", value: ready, color: "#10b981" },
    { label: "Exported", value: exportedRecords, color: "#0d9488" },
  ];
  const funnelMax = Math.max(...funnel.map((x) => x.value), 1);

  // Export analytics
  const lastExportDate = exports_[0]?.created_at;
  const mostExportedCategory = (() => {
    const m = new Map<string, number>();
    exports_.forEach((e) => { if (e.category_id) m.set(e.category_id, (m.get(e.category_id) ?? 0) + (e.record_count ?? 0)); });
    let bestId: string | null = null;
    let bestC = -1;
    m.forEach((c, id) => { if (c > bestC) { bestC = c; bestId = id; } });
    return bestId ? catMap.get(bestId)?.name ?? "—" : "—";
  })();
  const readyNotExported = Math.max(0, ready - exportedRecords);

  // Cards
  const cards: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; color: string; to: string; search?: Record<string, string> }[] = [
    { label: "Total businesses", value: total, icon: Building2, color: "text-slate-700", to: "/businesses" },
    { label: "Ready to export", value: ready, icon: CheckCircle2, color: "text-emerald-600", to: "/businesses", search: { quick: "ready" } },
    { label: "Strong leads", value: strong, icon: Sparkles, color: "text-emerald-600", to: "/businesses", search: { quick: "strong" } },
    { label: "Qualified leads", value: filtered.filter((b) => b.status === "qualified").length, icon: Star, color: "text-amber-600", to: "/businesses", search: { quick: "qualified" } },
    { label: "Missing phone", value: missingPhone, icon: PhoneOff, color: "text-rose-600", to: "/businesses", search: { quick: "missing_phone" } },
    { label: "Missing website", value: missingWebsite, icon: GlobeIcon, color: "text-rose-600", to: "/businesses", search: { quick: "missing_website" } },
    { label: "Possible duplicates", value: possibleDuplicates, icon: Copy, color: "text-orange-600", to: "/businesses", search: { quick: "duplicates" } },
    { label: "Bad data", value: badData, icon: ShieldAlert, color: "text-rose-600", to: "/businesses", search: { quick: "bad_data" } },
    { label: "Exported records", value: exportedRecords, icon: DownloadIcon, color: "text-sky-600", to: "/export-center" },
  ];

  function withCategory(extra: Record<string, string>) {
    const s: Record<string, string> = { ...extra };
    if (f.categoryId !== "all") s.categoryId = f.categoryId;
    if (f.importId !== "all") s.importId = f.importId;
    return s;
  }

  if (isLoading) {
    return (
      <AppShell title="Analytics">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Analytics">
      <div className="space-y-6">
        <PipelineOverviewSection businesses={filtered} />
        <ComingSoonSection />

        {/* Filters */}
        <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-2">
          <Select value={f.categoryId} onValueChange={(v) => setF({ ...f, categoryId: v })}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={f.importId} onValueChange={(v) => setF({ ...f, importId: v })}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Import" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All imports</SelectItem>
              {imports.map((i) => <SelectItem key={i.id} value={i.id}>{i.filename}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={f.cleanup_status} onValueChange={(v) => setF({ ...f, cleanup_status: v })}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Cleanup status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cleanup</SelectItem>
              <SelectItem value="needs_review">Needs review</SelectItem>
              <SelectItem value="clean">Clean</SelectItem>
              <SelectItem value="ignored">Ignored</SelectItem>
              <SelectItem value="merged">Merged</SelectItem>
              <SelectItem value="bad_data">Bad data</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Score
            <Input type="number" className="w-16 h-9" value={f.scoreMin}
              onChange={(e) => setF({ ...f, scoreMin: Number(e.target.value || 0) })} />
            –
            <Input type="number" className="w-16 h-9" value={f.scoreMax}
              onChange={(e) => setF({ ...f, scoreMax: Number(e.target.value || 100) })} />
          </div>
          <Input type="date" className="w-40 h-9" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
          <Input type="date" className="w-40 h-9" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
          <Button variant="ghost" size="sm" onClick={() => setF(DEFAULTS)}><FilterX className="h-4 w-4 mr-1" />Reset</Button>
        </div>

        {/* Overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map((c) => {
            const Icon = c.icon;
            const search = withCategory(c.search ?? {});
            return (
              <Link
                key={c.label}
                to={c.to}
                search={search as never}
                className="rounded-xl border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition group"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">{c.label}</div>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <div className="text-2xl font-semibold mt-2 group-hover:text-primary transition">{c.value.toLocaleString()}</div>
              </Link>
            );
          })}
        </div>

        {/* Lead quality distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead quality distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} />
                    <RTooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {distribution.map((d) => <Cell key={d.key} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {distribution.map((d) => (
                  <Link
                    key={d.key}
                    to="/businesses"
                    search={withCategory({ quick: d.quick }) as never}
                    className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 hover:border-primary/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded" style={{ background: d.color }} />
                      <span className="text-sm">{d.label}</span>
                    </div>
                    <div className="text-sm tabular-nums">
                      <span className="font-semibold">{d.count}</span>
                      <span className="text-muted-foreground ml-1.5">({pct(d.count, total)}%)</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cleanup funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cleanup funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {funnel.map((f) => (
                <div key={f.label} className="grid grid-cols-[160px_1fr_auto] items-center gap-3">
                  <div className="text-sm text-muted-foreground">{f.label}</div>
                  <div className="h-7 rounded-md bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-md"
                      style={{ width: `${(f.value / funnelMax) * 100}%`, background: f.color }}
                    />
                  </div>
                  <div className="text-sm tabular-nums w-28 text-right">
                    <span className="font-semibold">{f.value.toLocaleString()}</span>
                    <span className="text-muted-foreground ml-1.5">({pct(f.value, importedCount || total)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {perCategory.length === 0 ? (
              <div className="text-sm text-muted-foreground">No category data yet.</div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedCats.slice(0, 12)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis fontSize={11} />
                      <RTooltip />
                      <Legend />
                      <Bar dataKey="ready" name="Ready" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="strong" name="Strong" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="total" name="Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHead k="name" label="Category" />
                        <SortHead k="total" label="Total" />
                        <SortHead k="avg" label="Avg score" />
                        <SortHead k="ready" label="Ready" />
                        <SortHead k="strong" label="Strong" />
                        <SortHead k="missingPhone" label="Miss phone" />
                        <SortHead k="missingWebsite" label="Miss site" />
                        <SortHead k="duplicates" label="Dupes" />
                        <SortHead k="bad" label="Bad" />
                        <SortHead k="exported" label="Exported" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCats.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <Link to="/businesses" search={{ categoryId: c.id } as never} className="hover:underline inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                              {c.name}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular-nums">{c.total}</TableCell>
                          <TableCell className="tabular-nums">{c.avg}</TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "ready" } as never}>{c.ready}</Link></TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "strong" } as never}>{c.strong}</Link></TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "missing_phone" } as never}>{c.missingPhone}</Link></TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "missing_website" } as never}>{c.missingWebsite}</Link></TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "duplicates" } as never}>{c.duplicates}</Link></TableCell>
                          <TableCell><Link className="hover:underline" to="/businesses" search={{ categoryId: c.id, quick: "bad_data" } as never}>{c.bad}</Link></TableCell>
                          <TableCell className="tabular-nums">{c.exported}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Data completeness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data completeness</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Has phone", v: total - missingPhone },
              { label: "Has website", v: total - missingWebsite },
              { label: "Has both", v: hasBoth },
              { label: "Has neither", v: missingBoth },
              { label: "Has address", v: hasAddress },
              { label: "Has rating", v: hasRating },
              { label: "Has Google Maps", v: hasGmaps },
              { label: "Invalid fields", v: invalid },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">{row.label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-semibold tabular-nums">{row.v.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{pct(row.v, total)}%</span>
                </div>
                <div className="h-1.5 mt-2 rounded bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct(row.v, total)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Status analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusCounts} dataKey="count" nameKey="label" outerRadius={90} label>
                      {statusCounts.map((s, i) => (
                        <Cell key={s.key} fill={["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#94a3b8", "#ef4444", "#fb923c"][i % 7]} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {statusCounts.map((s) => (
                  <Link
                    key={s.key}
                    to="/businesses"
                    search={withCategory({ status: s.key }) as never}
                    className="rounded-lg border bg-card px-3 py-2 hover:border-primary/50 flex items-center justify-between"
                  >
                    <span className="text-sm">{s.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{s.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import quality */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import quality</CardTitle>
          </CardHeader>
          <CardContent>
            {perImport.length === 0 ? (
              <div className="text-sm text-muted-foreground">No imports yet.</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Imported</TableHead>
                      <TableHead>Dupes</TableHead>
                      <TableHead>Skipped</TableHead>
                      <TableHead>Miss phone</TableHead>
                      <TableHead>Miss site</TableHead>
                      <TableHead>Invalid</TableHead>
                      <TableHead>Avg score</TableHead>
                      <TableHead>Ready</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perImport.map((r) => (
                      <TableRow key={r.imp.id}>
                        <TableCell className="max-w-[220px] truncate">
                          <Link to="/imports/$id" params={{ id: r.imp.id }} className="hover:underline">{r.imp.filename}</Link>
                        </TableCell>
                        <TableCell>{r.catName}</TableCell>
                        <TableCell><Badge variant="outline" className={r.qTone}>{r.qLabel}</Badge></TableCell>
                        <TableCell className="tabular-nums">{r.total}</TableCell>
                        <TableCell className="tabular-nums">{r.imported}</TableCell>
                        <TableCell className="tabular-nums">{r.duplicates}</TableCell>
                        <TableCell className="tabular-nums">{r.skipped}</TableCell>
                        <TableCell><Link className="hover:underline" to="/businesses" search={{ importId: r.imp.id, quick: "missing_phone" } as never}>{r.missingPhone}</Link></TableCell>
                        <TableCell><Link className="hover:underline" to="/businesses" search={{ importId: r.imp.id, quick: "missing_website" } as never}>{r.missingWebsite}</Link></TableCell>
                        <TableCell className="tabular-nums">{r.invalid}</TableCell>
                        <TableCell className="tabular-nums">{r.avg}</TableCell>
                        <TableCell><Link className="hover:underline" to="/businesses" search={{ importId: r.imp.id, quick: "ready" } as never}>{r.ready}</Link></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export analytics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export activity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Total exports" value={exports_.length} />
            <Metric label="Exported records" value={exportedRecords} />
            <Metric label="Last export" value={lastExportDate ? new Date(lastExportDate).toLocaleDateString() : "—"} />
            <Metric label="Top category" value={mostExportedCategory} />
            <Metric label="Ready, not exported" value={readyNotExported} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold truncate">{typeof value === "number" ? value.toLocaleString() : value}</div>
    </div>
  );
}

function PipelineOverviewSection({ businesses }: { businesses: Business[] }) {
  const { data: stages = [] } = useQuery({ queryKey: ["pipeline_stages"], queryFn: fetchPipelineStages });
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });

  const stageMap = new Map(stages.map((s) => [s.id, s.name]));
  const byStage = stages.map((s) => {
    const list = businesses.filter((b) => b.pipeline_stage === s.id);
    const value = list.reduce((sum, b) => sum + (b.deal_value_estimate ?? 0), 0);
    return { name: s.name, count: list.length, value };
  });
  const ready = businesses.filter((b) => outreachReadiness(b, b.pipeline_stage ? (stageMap.get(b.pipeline_stage) ?? null) : null) === "ready").length;
  const overdue = tasks.filter((t) => t.status !== "completed" && t.due_date && new Date(t.due_date).getTime() < Date.now()).length;
  const high = businesses.filter((b) => b.priority === "high" || b.priority === "urgent").length;
  const totalValue = businesses.reduce((s, b) => s + (b.deal_value_estimate ?? 0), 0);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Pipeline overview</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Ready for outreach" value={ready} />
        <Metric label="High priority leads" value={high} />
        <Metric label="Overdue follow-ups" value={overdue} />
        <Metric label="Est. deal value" value={`$${totalValue.toLocaleString()}`} />
      </div>
      <div className="rounded-lg border bg-muted/30 p-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="px-2 py-1">Stage</th><th className="px-2 py-1">Leads</th><th className="px-2 py-1">Est. value</th></tr></thead>
          <tbody>
            {byStage.map((s) => (
              <tr key={s.name} className="border-t">
                <td className="px-2 py-1">{s.name}</td>
                <td className="px-2 py-1 tabular-nums">{s.count}</td>
                <td className="px-2 py-1 tabular-nums">${s.value.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComingSoonSection() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h2 className="font-semibold mb-3">Coming soon</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {["Outreach campaigns", "Email sending", "CRM integrations"].map((t) => (
          <div key={t} className="rounded-lg border border-dashed p-4 text-center bg-muted/30">
            <div className="font-medium text-sm">{t}</div>
            <div className="text-xs text-muted-foreground mt-1">Coming soon</div>
          </div>
        ))}
      </div>
    </div>
  );
}
