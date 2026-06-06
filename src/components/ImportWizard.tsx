import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Upload, ArrowRight, ArrowLeft, FileCheck2, Plus, AlertTriangle, Sparkles, CheckCircle2, EyeOff,
  ShieldAlert, Copy as CopyIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { parseCsvFile, type ParsedCsv } from "@/lib/csv";
import { NORMALIZED_FIELDS, FIELD_LABEL, type NormalizedField } from "@/lib/normalized-fields";
import {
  detectFields, disambiguateHeaders, fingerprintColumns, templateMatchScore,
  type ColumnProfile, type DetectionResult,
} from "@/lib/detection";
import { coerceForField } from "@/lib/coerce";
import { CATEGORY_COLORS, type Business, type DetectedColumn, type DuplicateMode } from "@/lib/types";
import {
  bumpMappingTemplate, createCategory, fetchBusinesses, fetchCategories,
  fetchMappingTemplates, insertBusinesses, insertImport, upsertMappingTemplate,
} from "@/lib/db";
import { buildValidationReport, applyDuplicateMode } from "@/lib/import-validation";
import { toast } from "sonner";
import { MissingBadge } from "./Badges";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export function ImportWizard() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: existing = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: templates = [] } = useQuery({ queryKey: ["mapping_templates"], queryFn: fetchMappingTemplates });

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCatName, setNewCatName] = useState("");
  const [mapping, setMapping] = useState<Record<string, NormalizedField | "">>({});
  const [matchedTemplateId, setMatchedTemplateId] = useState<string | null>(null);
  const [matchedTemplateScore, setMatchedTemplateScore] = useState<number | null>(null);
  const [matchedTemplateName, setMatchedTemplateName] = useState<string | null>(null);
  const [dupMode, setDupMode] = useState<DuplicateMode>("skip");

  const profilesByHeader = useMemo(() => {
    const m = new Map<string, ColumnProfile>();
    detection?.profiles.forEach((p) => m.set(p.uniqueHeader, p));
    return m;
  }, [detection]);

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return mapRows(parsed.rows, mapping);
  }, [parsed, mapping]);

  const validation = useMemo(() => {
    if (mappedRows.length === 0) return null;
    return buildValidationReport(mappedRows, existing);
  }, [mappedRows, existing]);

  const inferCategoryName = (filename: string): string => {
    const base = filename.replace(/\.csv$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
    return base.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  };

  const onFile = async (f: File) => {
    setCategoryId("");
    setNewCatName("");
    setFile(f);
    const p = await parseCsvFile(f);
    const headers = disambiguateHeaders(p.headers);
    const rows = p.rows.map((row) => {
      const out: Record<string, string> = {};
      p.headers.forEach((h, idx) => { out[headers[idx]] = row[h] ?? ""; });
      return out;
    });
    const parsedFixed: ParsedCsv = { headers, rows };
    setParsed(parsedFixed);

    const result = detectFields(headers, rows, 50);

    let bestT: { id: string; name: string; score: number; mapping: Record<string, string> } | null = null;
    for (const t of templates) {
      const score = templateMatchScore(
        t.raw_headers,
        (t.fingerprints ?? []) as unknown as Parameters<typeof templateMatchScore>[1],
        headers,
        result.profiles,
      );
      if (score > 0.7 && (!bestT || score > bestT.score)) {
        bestT = { id: t.id, name: t.name, score, mapping: t.normalized_mapping };
      }
    }
    if (bestT) {
      const merged = { ...result.mapping };
      for (const [k, v] of Object.entries(bestT.mapping)) {
        if (headers.includes(k)) merged[k] = v as NormalizedField;
      }
      result.mapping = merged;
      setMatchedTemplateId(bestT.id);
      setMatchedTemplateScore(bestT.score);
      setMatchedTemplateName(bestT.name);
    } else {
      setMatchedTemplateId(null);
      setMatchedTemplateScore(null);
      setMatchedTemplateName(null);
    }

    setDetection(result);
    setMapping(result.mapping);

    const inferred = inferCategoryName(f.name);
    const existingCat = categories.find((c) => c.name.toLowerCase() === inferred.toLowerCase());
    if (existingCat) setCategoryId(existingCat.id);
    else setNewCatName(inferred);

    setStep(2);
  };

  const createCatMut = useMutation({
    mutationFn: (name: string) => createCategory({
      name, color: CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)],
    }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setCategoryId(c.id);
      setNewCatName("");
      toast.success(`Created "${c.name}"`);
    },
  });

  const importMut = useMutation({
    mutationFn: async () => {
      if (!parsed || !file || !categoryId || !detection || !validation) throw new Error("Missing import context");
      const { toInsert, insertedDuplicates, skipped } = applyDuplicateMode(mappedRows, validation.duplicateIndexes, dupMode);

      let templateId = matchedTemplateId;
      const sampleValues: Record<string, string[]> = {};
      detection.profiles.forEach((p) => { sampleValues[p.uniqueHeader] = p.sampleValues.slice(0, 5); });

      if (matchedTemplateId) {
        await bumpMappingTemplate(matchedTemplateId);
      } else {
        const summary: Record<string, number> = {};
        for (const p of detection.profiles) {
          if (mapping[p.uniqueHeader]) summary[p.uniqueHeader] = Math.round(p.confidence * 100);
        }
        const tpl = await upsertMappingTemplate({
          name: file.name.replace(/\.csv$/i, "") + " mapping",
          raw_headers: parsed.headers,
          normalized_mapping: mapping as Record<string, string>,
          confidence_summary: summary,
          fingerprints: fingerprintColumns(detection.profiles),
          sample_values: sampleValues,
        });
        templateId = tpl.id;
        qc.invalidateQueries({ queryKey: ["mapping_templates"] });
      }

      const detectedColumns: DetectedColumn[] = detection.profiles.map((p) => ({
        rawHeader: p.rawHeader,
        uniqueHeader: p.uniqueHeader,
        position: p.position,
        detectedField: mapping[p.uniqueHeader] || "",
        confidence: p.confidence,
        uniqueRatio: p.uniqueRatio,
        nonEmptyCount: p.nonEmptyCount,
        totalSampled: p.totalSampled,
        sampleValues: p.sampleValues,
        reason: detectionReason(p, mapping[p.uniqueHeader] || ""),
      }));

      const { duplicateIndexes: _di, ...validationSummary } = validation;
      void _di;

      const importRec = await insertImport({
        filename: file.name,
        category_id: categoryId,
        row_count: parsed.rows.length,
        imported_rows: toInsert.length,
        skipped_rows: skipped,
        duplicate_rows: validation.duplicates,
        missing_required_rows: validation.missing_name,
        mapping: mapping as Record<string, string>,
        headers: parsed.headers,
        mapping_template_id: templateId,
        status: "imported",
        validation_report: validationSummary,
        detected_columns: detectedColumns,
        template_match_score: matchedTemplateScore,
        duplicate_mode: dupMode,
      });

      const rows: Partial<Business>[] = toInsert.map((r) => ({
        ...r,
        category_id: categoryId,
        import_id: importRec.id,
        source_file: file.name,
        status: (r as { status?: Business["status"] }).status ?? "new",
      }));
      await insertBusinesses(rows);
      return { inserted: rows.length, skipped, insertedDuplicates };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      qc.invalidateQueries({ queryKey: ["imports"] });
      const dupNote =
        res.skipped > 0 ? ` (${res.skipped} duplicates skipped)` :
        res.insertedDuplicates > 0 ? ` (${res.insertedDuplicates} marked as duplicate)` : "";
      toast.success(`Imported ${res.inserted} businesses${dupNote}`);
      nav({ to: "/imports" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Stepper step={step} />

      {step === 1 && (
        <Card className="p-10 text-center border-dashed border-2">
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">Upload your CSV</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Drop a Google Maps scraper export. We profile the first 50 rows by value — not by header — and auto-detect each column.
          </p>
          <Input
            type="file" accept=".csv,text/csv" className="max-w-sm mx-auto"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </Card>
      )}

      {step === 2 && parsed && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <FileCheck2 className="h-4 w-4 text-emerald-600" />
            <span className="font-medium">{file?.name}</span>
            <span className="text-muted-foreground">
              · {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns
            </span>
          </div>

          {matchedTemplateId && matchedTemplateScore !== null && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-violet-900">
                    Suggested mapping template: {matchedTemplateName} — {Math.round(matchedTemplateScore * 100)}% match
                  </div>
                  <div className="text-violet-800/80 mt-0.5 text-xs">
                    Based on header overlap and value fingerprints from prior imports.
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => setStep(4)}>Use this template</Button>
                    <Button size="sm" variant="outline" onClick={() => setStep(3)}>Review before importing</Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      setMatchedTemplateId(null); setMatchedTemplateScore(null); setMatchedTemplateName(null);
                      if (detection) setMapping(detection.mapping);
                    }}>Create new mapping</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Assign to category / campaign</Label>
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Select category…" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="…or create new e.g. 'HVAC contractors in Florida'"
                value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              />
              <Button variant="outline" disabled={!newCatName.trim() || createCatMut.isPending}
                onClick={() => createCatMut.mutate(newCatName.trim())}>
                <Plus className="h-4 w-4 mr-1" /> Create
              </Button>
            </div>
          </div>
          <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} nextDisabled={!categoryId} />
        </Card>
      )}

      {step === 3 && parsed && detection && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Review auto-detected mapping</h3>
            <p className="text-sm text-muted-foreground">
              Each column was profiled from real values. High-confidence detections are auto-mapped; low-confidence
              rows need a quick look.
            </p>
          </div>
          <DetectionSummary detection={detection} mapping={mapping} />
          <div className="rounded-lg border overflow-hidden">
            <div className="grid grid-cols-[1.4fr_1.6fr_1.3fr_1.4fr_auto] gap-3 px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Raw column</div>
              <div>Sample values</div>
              <div>Confidence · reason</div>
              <div>Map to field</div>
              <div></div>
            </div>
            <div className="divide-y max-h-[520px] overflow-y-auto">
              {parsed.headers.map((h, idx) => {
                const p = profilesByHeader.get(h)!;
                const f = mapping[h] || "";
                return (
                  <div key={h} className="grid grid-cols-[1.4fr_1.6fr_1.3fr_1.4fr_auto] gap-3 px-4 py-3 items-center">
                    <div className="min-w-0">
                      <div className="font-mono text-sm truncate" title={h}>{h}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Column #{idx + 1} · {p.nonEmptyCount}/{p.totalSampled} non-empty
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 min-w-0">
                      {p.sampleValues.length === 0 ? (
                        <span className="italic">empty</span>
                      ) : p.sampleValues.slice(0, 3).map((v, i) => (
                        <div key={i} className="truncate" title={v}>• {v}</div>
                      ))}
                    </div>
                    <div className="min-w-0"><ConfidenceCell profile={p} field={f} /></div>
                    <Select
                      value={f || "__skip"}
                      onValueChange={(v) => setMapping({ ...mapping, [h]: v === "__skip" ? "" : (v as NormalizedField) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip"><span className="text-muted-foreground">— ignore —</span></SelectItem>
                        {NORMALIZED_FIELDS.map((nf) => (
                          <SelectItem key={nf.key} value={nf.key}>{nf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground w-16 text-right">
                      {f ? <CheckCircle2 className="inline h-4 w-4 text-emerald-600" /> : <EyeOff className="inline h-4 w-4" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <NavRow onBack={() => setStep(2)} onNext={() => setStep(4)} />
        </Card>
      )}

      {step === 4 && parsed && detection && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Preview ({Math.min(8, parsed.rows.length)} of {parsed.rows.length})</h3>
          <MappingWarnings mapping={mapping} />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {NORMALIZED_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => (
                    <th key={f.key} className="text-left px-3 py-2 font-medium whitespace-nowrap">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mapRows(parsed.rows.slice(0, 8), mapping).map((r, i) => (
                  <tr key={i} className="border-t">
                    {NORMALIZED_FIELDS.filter((f) => Object.values(mapping).includes(f.key)).map((f) => {
                      const v = (r as Record<string, unknown>)[f.key];
                      return (
                        <td key={f.key} className="px-3 py-2 max-w-[200px] truncate">
                          {v == null || v === "" ? <MissingBadge /> : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NavRow onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </Card>
      )}

      {step === 5 && validation && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" /> Validate before import
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              We checked every row against your mapping. You can continue even with issues — they'll be saved in the import report.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <Stat label="Total rows" value={validation.total} tone="slate" />
            <Stat label="Ready to import" value={validation.ready} tone="emerald" />
            <Stat label="Possible duplicates" value={validation.duplicates} tone="amber" />
            <Stat label="Missing name" value={validation.missing_name} tone={validation.missing_name ? "rose" : "slate"} />
            <Stat label="Missing phone" value={validation.missing_phone} tone="slate" />
            <Stat label="Missing website" value={validation.missing_website} tone="slate" />
            <Stat label="Missing address" value={validation.missing_address} tone="slate" />
            <Stat label="Invalid phone / URL" value={validation.invalid_phone + validation.invalid_url} tone={(validation.invalid_phone + validation.invalid_url) ? "rose" : "slate"} />
          </div>

          {validation.duplicates > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <CopyIcon className="h-4 w-4" /> {validation.duplicates} possible duplicate{validation.duplicates === 1 ? "" : "s"} detected
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                Matched by Google Maps URL, phone, website, or name + address against existing leads and within this file.
              </div>
              <RadioGroup value={dupMode} onValueChange={(v) => setDupMode(v as DuplicateMode)} className="space-y-2">
                <DupOption value="skip" label="Skip duplicates" desc="Don't import any duplicate rows (recommended)" />
                <DupOption value="mark" label="Import but mark as Duplicate" desc="Bring them in with status = Duplicate so you can review later" />
                <DupOption value="all" label="Import all" desc="Insert every row, no duplicate filtering" />
              </RadioGroup>
            </div>
          )}

          <NavRow onBack={() => setStep(4)} onNext={() => setStep(6)} />
        </Card>
      )}

      {step === 6 && parsed && validation && (
        <Card className="p-8 text-center space-y-4">
          <h3 className="font-semibold text-lg">Ready to import</h3>
          <p className="text-sm text-muted-foreground">
            <strong>{file?.name}</strong> → <strong>{categories.find((c) => c.id === categoryId)?.name}</strong>.
            {dupMode === "skip" && validation.duplicates > 0 && <> {validation.duplicates} duplicates will be skipped.</>}
            {dupMode === "mark" && validation.duplicates > 0 && <> {validation.duplicates} duplicates will be marked.</>}
            {dupMode === "all" && <> No duplicate filtering.</>}
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setStep(5)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            <Button size="lg" disabled={importMut.isPending} onClick={() => importMut.mutate()}>
              {importMut.isPending ? "Importing…" : "Import now"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Upload", "Category", "Auto-detect", "Preview", "Validate", "Import"];
  return (
    <div className="flex items-center gap-2 text-sm overflow-x-auto">
      {labels.map((l, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <div key={l} className="flex items-center gap-2 shrink-0">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
              done ? "bg-emerald-500 text-white" :
              active ? "bg-primary text-primary-foreground" :
              "bg-muted text-muted-foreground",
            )}>{i + 1}</div>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{l}</span>
            {i < labels.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

function NavRow({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex justify-between pt-2">
      <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
      <Button onClick={onNext} disabled={nextDisabled}>Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
    </div>
  );
}

function ConfidenceCell({ profile, field }: { profile: ColumnProfile; field: NormalizedField | "" }) {
  if (!field) return <span className="text-xs text-muted-foreground italic">ignored</span>;
  const score = profile.scores[field] ?? 0;
  const pct = Math.round(score * 100);
  const level = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
  const cls =
    level === "high" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    level === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-rose-100 text-rose-700 border-rose-200";
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <Badge variant="outline" className={cn("max-w-full text-xs whitespace-nowrap overflow-hidden text-ellipsis block", cls)}>
        {pct}% · {level === "high" ? "High" : level === "medium" ? "Needs review" : "Low"} → {FIELD_LABEL[field]}
      </Badge>
      <span className="text-[11px] text-muted-foreground truncate" title={detectionReason(profile, field)}>
        {detectionReason(profile, field)}
      </span>
    </div>
  );
}

export function detectionReason(p: ColumnProfile, field: NormalizedField | ""): string {
  if (!field) return "No strong signal in sampled values.";
  const matches = Math.round((p.scores[field] ?? 0) * p.nonEmptyCount);
  const total = p.nonEmptyCount;
  const labelMap: Record<NormalizedField, string> = {
    name: "look like business names",
    business_category: "look like category labels",
    rating: "are numeric between 0 and 5",
    review_count: "look like review counts",
    rating_label: "match the 'X stars · N reviews' label format",
    phone: "match phone number format",
    email: "match email format",
    website_url: "are non-Maps website URLs",
    gmaps_url: "are Google Maps URLs",
    image_url: "look like image URLs",
    address: "look like street addresses",
    opening_status: "match opening status keywords",
    closing_time: "look like opening/closing hours",
    review_snippet: "look like review text",
  };
  return `${matches} of ${total} sampled values ${labelMap[field]}.`;
}

function DetectionSummary({ detection, mapping }: { detection: DetectionResult; mapping: Record<string, NormalizedField | ""> }) {
  let high = 0, med = 0, low = 0, ignored = 0;
  for (const p of detection.profiles) {
    const f = mapping[p.uniqueHeader];
    if (!f) { ignored++; continue; }
    const s = p.scores[f] ?? 0;
    if (s >= 0.8) high++; else if (s >= 0.5) med++; else low++;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
      <SummaryPill tone="emerald" label="High confidence" value={high} />
      <SummaryPill tone="amber" label="Needs review" value={med} />
      <SummaryPill tone="rose" label="Low confidence" value={low} />
      <SummaryPill tone="slate" label="Ignored" value={ignored} />
    </div>
  );
}

function SummaryPill({ tone, label, value }: { tone: string; label: string; value: number }) {
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

function DupOption({ value, label, desc }: { value: DuplicateMode; label: string; desc: string }) {
  return (
    <label className="flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
      <RadioGroupItem value={value} className="mt-0.5" />
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}

function MappingWarnings({ mapping }: { mapping: Record<string, NormalizedField | ""> }) {
  const mapped = new Set(Object.values(mapping));
  const missing = NORMALIZED_FIELDS.filter((f) => f.important && !mapped.has(f.key));
  if (missing.length === 0) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 mt-0.5" />
      <div>
        <strong>Heads up:</strong> these important fields aren't mapped: {missing.map((m) => m.label).join(", ")}.
      </div>
    </div>
  );
}

function mapRows(rows: Record<string, string>[], mapping: Record<string, NormalizedField | "">) {
  return rows.map((row) => {
    const out: Record<string, unknown> = { raw_data: row };
    for (const [src, field] of Object.entries(mapping)) {
      if (!field) continue;
      const raw = row[src];
      if (raw == null || raw === "") continue;
      const coerced = coerceForField(field, raw);
      if (coerced == null) continue;
      out[field] = coerced;
    }
    return out;
  });
}
