import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ListChecks, Trash2, MoreHorizontal, Eye, Copy as CopyIcon, Pencil, Plus } from "lucide-react";
import {
  deleteMappingTemplate, duplicateMappingTemplate, fetchImports, fetchMappingTemplates,
  updateMappingTemplate,
} from "@/lib/db";
import { toast } from "sonner";
import { FIELD_LABEL, type NormalizedField } from "@/lib/normalized-fields";
import type { MappingTemplate } from "@/lib/types";

export const Route = createFileRoute("/mapping-templates")({
  head: () => ({ meta: [{ title: "Mapping templates · LeadForge" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ["mapping_templates"], queryFn: fetchMappingTemplates });
  const { data: imports = [] } = useQuery({ queryKey: ["imports"], queryFn: fetchImports });
  const [open, setOpen] = useState<MappingTemplate | null>(null);
  const [renaming, setRenaming] = useState<string>("");

  const del = useMutation({
    mutationFn: (id: string) => deleteMappingTemplate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mapping_templates"] }); toast.success("Template deleted"); },
  });
  const dup = useMutation({
    mutationFn: (t: MappingTemplate) => duplicateMappingTemplate(t),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mapping_templates"] }); toast.success("Duplicated"); },
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateMappingTemplate(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mapping_templates"] });
      toast.success("Renamed");
      setRenaming("");
    },
  });

  return (
    <AppShell title="Mapping templates">
      {templates.length === 0 ? (
        <Card className="p-12 text-center max-w-xl mx-auto">
          <div className="h-14 w-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <ListChecks className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-1">No mapping templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Templates are saved automatically the first time you confirm a mapping during import — and reused on future files with matching columns.
          </p>
          <Button asChild><Link to="/imports/new"><Plus className="h-4 w-4 mr-1.5" />Import a CSV</Link></Button>
        </Card>
      ) : (
        <div className="space-y-3 max-w-5xl">
          {templates.map((t) => {
            const mapped = Object.entries(t.normalized_mapping ?? {}).filter(([, v]) => v);
            const importsUsing = imports.filter((i) => i.mapping_template_id === t.id);
            const confs = Object.values(t.confidence_summary ?? {});
            const avgConf = confs.length ? Math.round(confs.reduce((a, b) => a + Number(b), 0) / confs.length) : null;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {renaming === t.id ? (
                      <div className="flex gap-2 mb-2">
                        <Input
                          autoFocus
                          defaultValue={t.name}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") rename.mutate({ id: t.id, name: (e.target as HTMLInputElement).value });
                            if (e.key === "Escape") setRenaming("");
                          }}
                          onBlur={(e) => rename.mutate({ id: t.id, name: e.target.value })}
                          className="h-8"
                        />
                      </div>
                    ) : (
                      <button className="font-medium hover:underline text-left" onClick={() => setOpen(t)}>{t.name}</button>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                      <span>{mapped.length} fields mapped</span>
                      <span>·</span>
                      <span>used {t.use_count}× in {importsUsing.length} import{importsUsing.length === 1 ? "" : "s"}</span>
                      {avgConf != null && <><span>·</span><span>avg confidence {avgConf}%</span></>}
                      {t.last_used_at && <><span>·</span><span>last used {new Date(t.last_used_at).toLocaleDateString()}</span></>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mapped.slice(0, 8).map(([h, f]) => (
                        <Badge key={h} variant="outline" className="font-mono text-[10px]">
                          {h} → {FIELD_LABEL[f as NormalizedField] ?? f}
                        </Badge>
                      ))}
                      {mapped.length > 8 && <Badge variant="outline" className="text-[10px]">+{mapped.length - 8} more</Badge>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setOpen(t)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setRenaming(t.id)}><Pencil className="h-4 w-4 mr-2" />Rename</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => dup.mutate(t)}><CopyIcon className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600" onClick={() => {
                        if (confirm(`Delete template "${t.name}"?`)) del.mutate(t.id);
                      }}>
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {open && <TemplateDetail t={open} importsUsing={imports.filter((i) => i.mapping_template_id === open.id)} />}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TemplateDetail({ t, importsUsing }: { t: MappingTemplate; importsUsing: { id: string; filename: string; created_at: string }[] }) {
  const fps = t.fingerprints ?? [];
  const samples = t.sample_values ?? {};
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t.name}</DialogTitle>
        <DialogDescription>
          {(t.raw_headers ?? []).length} columns · used {t.use_count}× · created {new Date(t.created_at).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 pt-2">
        <section>
          <h4 className="text-sm font-medium mb-2">Raw headers</h4>
          <div className="flex flex-wrap gap-1">
            {(t.raw_headers ?? []).map((h, i) => (
              <Badge key={i} variant="outline" className="font-mono text-[10px]">{h}</Badge>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium mb-2">Normalized mapping & detection rules</h4>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Raw column</th>
                  <th className="text-left px-3 py-2 font-medium">Maps to</th>
                  <th className="text-left px-3 py-2 font-medium">Top score</th>
                  <th className="text-left px-3 py-2 font-medium">Unique ratio</th>
                  <th className="text-left px-3 py-2 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {(t.raw_headers ?? []).map((h) => {
                  const fp = fps.find((f) => f.header === h);
                  const target = t.normalized_mapping?.[h];
                  const sv = samples[h] ?? [];
                  return (
                    <tr key={h} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs truncate max-w-[200px]" title={h}>{h}</td>
                      <td className="px-3 py-2">
                        {target ? <Badge variant="secondary">{FIELD_LABEL[target as NormalizedField] ?? target}</Badge> : <span className="text-xs text-muted-foreground italic">ignored</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">{fp ? `${Math.round(fp.topScore * 100)}%` : "—"}</td>
                      <td className="px-3 py-2 text-xs">{fp ? `${Math.round(fp.uniqueRatio * 100)}%` : "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[220px]">
                        {sv.slice(0, 2).map((v, i) => <div key={i} className="truncate" title={v}>• {v}</div>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h4 className="text-sm font-medium mb-2">Imports using this template</h4>
          {importsUsing.length === 0 ? (
            <div className="text-xs text-muted-foreground rounded-md border border-dashed p-4 text-center">
              No imports recorded yet.
            </div>
          ) : (
            <div className="space-y-1">
              {importsUsing.map((i) => (
                <Link
                  key={i.id}
                  to="/imports/$id"
                  params={{ id: i.id }}
                  className="flex justify-between text-sm rounded-md border px-3 py-2 hover:bg-muted/40"
                >
                  <span className="truncate">{i.filename}</span>
                  <span className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
