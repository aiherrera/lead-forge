import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Sparkles, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchBusinessesByImport, fetchCategories, fetchImport, fetchMappingTemplates,
} from "@/lib/db";
import { CategoryBadge } from "@/components/Badges";
import { downloadCsv, toCsv } from "@/lib/csv";
import { ImportStatusBadge } from "./imports.index";
import { FIELD_LABEL, type NormalizedField } from "@/lib/normalized-fields";
import { cn } from "@/lib/utils";
import type { DetectedColumn } from "@/lib/types";

export const Route = createFileRoute("/imports/$id")({
  head: () => ({ meta: [{ title: "Import report · LeadForge" }] }),
  component: ImportDetail,
});

function ImportDetail() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { data: rec, isLoading } = useQuery({ queryKey: ["import", id], queryFn: () => fetchImport(id) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: templates = [] } = useQuery({ queryKey: ["mapping_templates"], queryFn: fetchMappingTemplates });
  const { data: bizz = [] } = useQuery({
    queryKey: ["businesses", "by-import", id],
    queryFn: () => fetchBusinessesByImport(id),
    enabled: !!id,
  });

  if (isLoading) return <AppShell title="Import"><Card className="p-8 text-center text-muted-foreground">Loading…</Card></AppShell>;
  if (!rec) return (
    <AppShell title="Import not found">
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground mb-4">That import doesn't exist.</p>
        <Button onClick={() => nav({ to: "/imports" })}><ArrowLeft className="h-4 w-4 mr-1.5" />Back to imports</Button>
      </Card>
    </AppShell>
  );

  const cat = categories.find((c) => c.id === rec.category_id);
  const tpl = templates.find((t) => t.id === rec.mapping_template_id);
  const v = rec.validation_report;
  const cols: DetectedColumn[] = rec.detected_columns ?? [];

  const exportNormalized = () => {
    const cleaned = bizz.map(({ raw_data: _r, ...rest }) => { void _r; return rest; });
    downloadCsv(rec.filename.replace(/\.csv$/i, "") + "-normalized.csv", toCsv(cleaned));
  };

  return (
    <AppShell title="Import report" action={
      <Button variant="outline" onClick={exportNormalized} disabled={bizz.length === 0}>
        <Download className="h-4 w-4 mr-1.5" />Export normalized
      </Button>
    }>
      <div className="max-w-6xl mx-auto space-y-6">
        <Link to="/imports" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" />All imports
        </Link>

        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">{rec.filename}</h2>
                <ImportStatusBadge status={rec.status} />
              </div>
              <div className="text-xs text-muted-foreground">
                Imported {new Date(rec.created_at).toLocaleString()}
                {cat && <> · into {cat.name}</>}
              </div>
            </div>
            {cat && <CategoryBadge name={cat.name} color={cat.color} />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <Stat label="Total rows" value={rec.row_count} tone="slate" />
            <Stat label="Imported" value={rec.imported_rows} tone="emerald" />
            <Stat label="Skipped" value={rec.skipped_rows} tone="slate" />
            <Stat label="Duplicates" value={rec.duplicate_rows} tone={rec.duplicate_rows ? "amber" : "slate"} />
            <Stat label="Missing required" value={rec.missing_required_rows} tone={rec.missing_required_rows ? "rose" : "slate"} />
          </div>
        </Card>

        {tpl && (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Mapping template: {tpl.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {rec.template_match_score != null
                      ? `${Math.round(Number(rec.template_match_score) * 100)}% match · `
                      : ""}
                    used {tpl.use_count}×
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/mapping-templates">View template</Link>
              </Button>
            </div>
          </Card>
        )}

        {cols.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b text-sm font-medium">Detected columns ({cols.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Raw column</th>
                    <th className="text-left px-3 py-2 font-medium">Detected field</th>
                    <th className="text-left px-3 py-2 font-medium">Confidence</th>
                    <th className="text-left px-3 py-2 font-medium">Sample values</th>
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {cols.map((c) => (
                    <tr key={c.uniqueHeader} className="border-t">
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs truncate max-w-[200px]" title={c.uniqueHeader}>{c.uniqueHeader}</div>
                        <div className="text-[10px] text-muted-foreground">col #{c.position + 1}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {c.detectedField
                          ? <Badge variant="secondary">{FIELD_LABEL[c.detectedField as NormalizedField] ?? c.detectedField}</Badge>
                          : <span className="text-xs text-muted-foreground italic">ignored</span>}
                      </td>
                      <td className="px-3 py-2.5"><ConfBadge pct={Math.round(c.confidence * 100)} /></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[260px]">
                        {c.sampleValues.slice(0, 2).map((v, i) => (
                          <div key={i} className="truncate" title={v}>• {v}</div>
                        ))}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px]">{c.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {v && (
          <Card className="p-5 space-y-3">
            <div className="text-sm font-medium">Data quality report</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Missing name" value={v.missing_name} tone={v.missing_name ? "rose" : "slate"} />
              <Stat label="Missing phone" value={v.missing_phone} tone="slate" />
              <Stat label="Missing website" value={v.missing_website} tone="slate" />
              <Stat label="Missing address" value={v.missing_address} tone="slate" />
              <Stat label="Invalid phone" value={v.invalid_phone} tone={v.invalid_phone ? "rose" : "slate"} />
              <Stat label="Invalid URL" value={v.invalid_url} tone={v.invalid_url ? "rose" : "slate"} />
              <Stat label="Possible duplicates" value={v.duplicates} tone={v.duplicates ? "amber" : "slate"} />
              <Stat label="Ready" value={v.ready} tone="emerald" />
            </div>
            {v.missing_name === 0 && v.invalid_phone === 0 && v.invalid_url === 0 && v.duplicates === 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 pt-1">
                <CheckCircle2 className="h-4 w-4" /> No data quality issues detected.
              </div>
            )}
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b text-sm font-medium flex items-center justify-between">
            <span>Imported businesses ({bizz.length})</span>
            <Button asChild variant="outline" size="sm"><Link to="/businesses">Open in Businesses</Link></Button>
          </div>
          {bizz.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No businesses linked to this import.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-3 py-2 font-medium">Phone</th>
                    <th className="text-left px-3 py-2 font-medium">Website</th>
                    <th className="text-left px-3 py-2 font-medium">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {bizz.slice(0, 200).map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{b.name ?? <span className="text-muted-foreground italic">—</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">{b.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]">{b.website_url ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[260px]">{b.address ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "slate" }) {
  const cls: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={cn("rounded-md border px-3 py-2", cls[tone])}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ConfBadge({ pct }: { pct: number }) {
  const cls =
    pct >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    pct >= 50 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-rose-100 text-rose-700 border-rose-200";
  return <Badge variant="outline" className={cn("text-xs", cls)}>{pct}%</Badge>;
}
