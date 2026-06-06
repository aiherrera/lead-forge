import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Sparkles, MoreHorizontal, Trash2, Eye, RotateCcw, Download } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteImport, fetchBusinessesByImport, fetchCategories, fetchImports,
} from "@/lib/db";
import { CategoryBadge } from "@/components/Badges";
import { IMPORT_STATUS_META, type ImportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toCsv, downloadCsv } from "@/lib/csv";
import { toast } from "sonner";

export const Route = createFileRoute("/imports/")({
  head: () => ({ meta: [{ title: "Imports · LeadForge" }] }),
  component: ImportsList,
});

function ImportsList() {
  const qc = useQueryClient();
  const { data: imports = [] } = useQuery({ queryKey: ["imports"], queryFn: fetchImports });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const del = useMutation({
    mutationFn: (id: string) => deleteImport(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["imports"] }); toast.success("Import deleted"); },
  });

  const exportImport = async (id: string, filename: string) => {
    const rows = await fetchBusinessesByImport(id);
    if (rows.length === 0) { toast.error("No rows to export"); return; }
    const cleaned = rows.map(({ raw_data: _r, ...rest }) => { void _r; return rest; });
    downloadCsv(filename.replace(/\.csv$/i, "") + "-normalized.csv", toCsv(cleaned));
  };

  return (
    <AppShell title="Imports" action={
      <Button asChild><Link to="/imports/new"><Plus className="h-4 w-4 mr-1.5" />New import</Link></Button>
    }>
      {imports.length === 0 ? (
        <Card className="p-12 text-center max-w-xl mx-auto">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No imports yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your first Google Maps scraper CSV. We'll auto-detect every column, even when the headers are gibberish.
          </p>
          <Button asChild><Link to="/imports/new"><Plus className="h-4 w-4 mr-1.5" />Start your first import</Link></Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">File</th>
                <th className="text-left px-3 py-2.5 font-medium">Category</th>
                <th className="text-left px-3 py-2.5 font-medium">Status</th>
                <th className="text-right px-3 py-2.5 font-medium">Total</th>
                <th className="text-right px-3 py-2.5 font-medium">Imported</th>
                <th className="text-right px-3 py-2.5 font-medium">Skipped</th>
                <th className="text-right px-3 py-2.5 font-medium">Dupes</th>
                <th className="text-right px-3 py-2.5 font-medium">Missing</th>
                <th className="text-left px-3 py-2.5 font-medium">Template</th>
                <th className="text-left px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {imports.map((i) => {
                const cat = categories.find((c) => c.id === i.category_id);
                return (
                  <tr key={i.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/imports/$id" params={{ id: i.id }} className="font-medium hover:underline">
                        {i.filename}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{cat ? <CategoryBadge name={cat.name} color={cat.color} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-3"><ImportStatusBadge status={i.status} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{i.row_count}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-700 font-medium">{i.imported_rows}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{i.skipped_rows}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">{i.duplicate_rows}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-rose-700">{i.missing_required_rows}</td>
                    <td className="px-3 py-3">
                      {i.mapping_template_id ? (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          {i.template_match_score != null ? `${Math.round(Number(i.template_match_score) * 100)}%` : "Used"}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(i.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/imports/$id" params={{ id: i.id }}><Eye className="h-4 w-4 mr-2" />View import report</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/imports/new"><RotateCcw className="h-4 w-4 mr-2" />Reimport (new upload)</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportImport(i.id, i.filename)}>
                            <Download className="h-4 w-4 mr-2" />Export normalized results
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600" onClick={() => {
                            if (confirm(`Delete import "${i.filename}"? Imported businesses stay.`)) del.mutate(i.id);
                          }}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete import
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const meta = IMPORT_STATUS_META[status] ?? IMPORT_STATUS_META.imported;
  return <Badge variant="outline" className={cn("font-medium", meta.tone)}>{meta.label}</Badge>;
}
