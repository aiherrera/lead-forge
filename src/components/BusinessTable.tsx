import { useMemo, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink, MapPin, Phone, Mail, Search, Trash2, ArrowRight, MoreHorizontal,
  ImageIcon, FilterX, Star, Download, Clock, AlertTriangle, CheckCircle2, X, Sparkles, Send,
} from "lucide-react";
import { SyncBusinessesDialog } from "@/components/integrations/SyncBusinessesDialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchBusinesses, fetchCategories, bulkUpdateBusinesses, deleteBusinesses } from "@/lib/db";
import { CategoryBadge, MissingBadge, StatusBadge } from "./Badges";
import { RatingStars } from "./RatingStars";
import { BusinessDetailDrawer } from "./BusinessDetailDrawer";
import { STATUS_OPTIONS, type Business, type BusinessStatus } from "@/lib/types";
import { downloadCsv, toCsv } from "@/lib/csv";
import { buildDuplicateIndex, getWarnings, leadScore, scoreLabel, WARNING_LABEL } from "@/lib/quality";
import { isReadyToExport } from "@/lib/cleanup";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Quick = "all" | "needs_review" | "strong" | "good" | "missing_phone" | "missing_website" | "missing_both" | "duplicates" | "weak" | "qualified" | "ready" | "bad_data";

type Filters = {
  q: string;
  categoryId: string;
  status: string;
  minRating: string;
  quick: Quick;
  sort: "created_at" | "name" | "rating" | "review_count" | "score";
};

const DEFAULTS: Filters = {
  q: "", categoryId: "all", status: "all", minRating: "0", quick: "all", sort: "created_at",
};

const QUICK_CHIPS: { key: Quick; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready to export" },
  { key: "needs_review", label: "Needs review" },
  { key: "strong", label: "Strong leads" },
  { key: "good", label: "Good leads" },
  { key: "missing_phone", label: "Missing phone" },
  { key: "missing_website", label: "Missing website" },
  { key: "missing_both", label: "Missing both" },
  { key: "duplicates", label: "Possible duplicates" },
  { key: "weak", label: "Weak data" },
  { key: "qualified", label: "Qualified" },
  { key: "bad_data", label: "Bad data" },
];

export function BusinessTable({ categoryIdFilter }: { categoryIdFilter?: string }) {
  const qc = useQueryClient();
  const { data: businesses = [], isLoading } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const search = useSearch({ strict: false }) as Partial<Filters> & { importId?: string };
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULTS,
    categoryId: categoryIdFilter ?? search.categoryId ?? "all",
    status: search.status ?? "all",
    quick: (search.quick as Quick) ?? "all",
    q: search.q ?? "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Business | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const dupIndex = useMemo(() => buildDuplicateIndex(businesses), [businesses]);

  const filtered = useMemo(() => {
    let rows = businesses;
    const q = filters.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter((b) =>
        [b.name, b.phone, b.email, b.website_url, b.address, b.business_category]
          .filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    }
    if (filters.categoryId !== "all") rows = rows.filter((b) => b.category_id === filters.categoryId);
    if (filters.status !== "all") rows = rows.filter((b) => b.status === filters.status);
    if (search.importId) rows = rows.filter((b) => b.import_id === search.importId);
    const min = parseFloat(filters.minRating);
    if (min > 0) rows = rows.filter((b) => (b.rating ?? 0) >= min);

    switch (filters.quick) {
      case "needs_review": {
        rows = rows.filter((b) => {
          const s = leadScore(b);
          return s >= 40 && s < 60;
        });
        break;
      }
      case "strong":
        rows = rows.filter((b) => leadScore(b) >= 80);
        break;
      case "good":
        rows = rows.filter((b) => { const s = leadScore(b); return s >= 60 && s < 80; });
        break;
      case "missing_phone":
        rows = rows.filter((b) => !b.phone);
        break;
      case "missing_website":
        rows = rows.filter((b) => !b.website_url);
        break;
      case "missing_both":
        rows = rows.filter((b) => !b.phone && !b.website_url);
        break;
      case "duplicates":
        rows = rows.filter((b) => dupIndex.isDuplicate(b) || b.status === "duplicate");
        break;
      case "weak":
        rows = rows.filter((b) => leadScore(b) < 40);
        break;
      case "qualified":
        rows = rows.filter((b) => b.status === "qualified");
        break;
      case "bad_data":
        rows = rows.filter((b) => b.status === "bad_data" || b.cleanup_status === "bad_data");
        break;
      case "ready":
        rows = rows.filter((b) => isReadyToExport(b));
        break;
    }

    const sorted = [...rows].sort((a, b) => {
      switch (filters.sort) {
        case "name": return (a.name ?? "").localeCompare(b.name ?? "");
        case "rating": return (b.rating ?? 0) - (a.rating ?? 0);
        case "review_count": return (b.review_count ?? 0) - (a.review_count ?? 0);
        case "score": return leadScore(b) - leadScore(a);
        default: return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }
    });
    return sorted;
  }, [businesses, filters, dupIndex, search.importId]);

  const allChecked = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
  const someChecked = filtered.some((b) => selected.has(b.id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["businesses"] });

  const moveMut = useMutation({
    mutationFn: ({ ids, categoryId }: { ids: string[]; categoryId: string }) =>
      bulkUpdateBusinesses(ids, { category_id: categoryId }),
    onSuccess: () => { invalidate(); toast.success("Moved to category"); setSelected(new Set()); },
  });

  const statusMut = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: BusinessStatus }) =>
      bulkUpdateBusinesses(ids, { status }),
    onSuccess: (_d, v) => {
      invalidate();
      const label = STATUS_OPTIONS.find((s) => s.value === v.status)?.label ?? v.status;
      toast.success(`Marked as ${label}`);
      setSelected(new Set());
    },
  });

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => deleteBusinesses(ids),
    onSuccess: () => { invalidate(); toast.success("Deleted"); setSelected(new Set()); },
  });

  const exportRows = (rows: Business[]) => {
    const out = rows.map((b) => ({
      business_name: b.name,
      category: catMap.get(b.category_id ?? "")?.name ?? "",
      business_category: b.business_category,
      rating: b.rating, review_count: b.review_count, rating_label: b.rating_label,
      phone: b.phone, email: b.email,
      website_url: b.website_url, gmaps_url: b.gmaps_url, image_url: b.image_url,
      address: b.address, city: b.city, state: b.state,
      opening_status: b.opening_status, closing_time: b.closing_time,
      review_snippet: b.review_snippet, lead_score: leadScore(b),
      status: b.status, notes: b.notes, source_file: b.source_file, imported_date: b.imported_date,
    }));
    downloadCsv(`businesses-${Date.now()}.csv`, toCsv(out));
  };

  const selectedRows = useMemo(
    () => businesses.filter((b) => selected.has(b.id)),
    [businesses, selected],
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4 pb-24">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search name, phone, email, website, address…"
              className="pl-8"
            />
          </div>
          {!categoryIdFilter && (
            <Select value={filters.categoryId} onValueChange={(v) => setFilters({ ...filters, categoryId: v })}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.minRating} onValueChange={(v) => setFilters({ ...filters, minRating: v })}>
            <SelectTrigger className="w-[140px]"><Star className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any rating</SelectItem>
              <SelectItem value="3">3+ stars</SelectItem>
              <SelectItem value="4">4+ stars</SelectItem>
              <SelectItem value="4.5">4.5+ stars</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v: Filters["sort"]) => setFilters({ ...filters, sort: v })}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest first</SelectItem>
              <SelectItem value="name">Name A→Z</SelectItem>
              <SelectItem value="rating">Highest rating</SelectItem>
              <SelectItem value="review_count">Most reviews</SelectItem>
              <SelectItem value="score">Lead score</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setFilters({ ...DEFAULTS, categoryId: categoryIdFilter ?? "all" })}>
            <FilterX className="h-4 w-4 mr-1" />Reset
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportRows(filtered)}>
              <Download className="h-4 w-4 mr-1" /> Export filtered
            </Button>
          </div>
        </div>

        {/* Quick filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((c) => {
            const active = filters.quick === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setFilters({ ...filters, quick: c.key })}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-muted border-border text-foreground",
                )}
              >
                {c.key === "strong" && <Sparkles className="h-3 w-3" />}
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={(c) => {
                        const next = new Set(selected);
                        if (c) filtered.forEach((b) => next.add(b.id));
                        else filtered.forEach((b) => next.delete(b.id));
                        setSelected(next);
                      }}
                    />
                  </TableHead>
                  <TableHead className="w-14"></TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center py-16">
                    <div className="text-muted-foreground">No businesses match your filters.</div>
                  </TableCell></TableRow>
                )}
                {filtered.map((b) => {
                  const cat = b.category_id ? catMap.get(b.category_id) : null;
                  const warnings = getWarnings(b, dupIndex);
                  const score = leadScore(b);
                  const sl = scoreLabel(score);
                  return (
                    <TableRow
                      key={b.id}
                      className={cn("cursor-pointer", selected.has(b.id) && "bg-primary/5")}
                      onClick={(e) => {
                        const tgt = e.target as HTMLElement;
                        if (tgt.closest("button,a,input,[role='menuitem'],[data-no-row-click]")) return;
                        setDetail(b);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(b.id)}
                          onCheckedChange={(c) => {
                            const next = new Set(selected);
                            if (c) next.add(b.id); else next.delete(b.id);
                            setSelected(next);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {b.image_url ? (
                          <img src={b.image_url} alt="" className="h-10 w-10 rounded-md object-cover border"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-left">
                          <div className="font-medium hover:text-primary flex items-center gap-1.5">
                            {b.name || <MissingBadge label="no name" />}
                            {warnings.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-0.5 text-amber-600">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-semibold tabular-nums">{warnings.length}</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  <ul className="space-y-0.5">
                                    {warnings.map((w) => <li key={w}>• {WARNING_LABEL[w]}</li>)}
                                  </ul>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{b.address || "—"}</div>
                          {b.business_category && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{b.business_category}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {cat ? <CategoryBadge name={cat.name} color={cat.color} /> : <MissingBadge label="uncategorized" />}
                      </TableCell>
                      <TableCell>
                        <RatingStars value={b.rating} />
                        {b.review_count != null ? (
                          <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            {b.review_count.toLocaleString()} reviews
                          </div>
                        ) : <MissingBadge label="no reviews" />}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {b.phone ? (
                            <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                              <Phone className="h-3 w-3" />{b.phone}
                            </a>
                          ) : <MissingBadge label="no phone" />}
                          {b.email ? (
                            <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 text-xs hover:text-primary">
                              <Mail className="h-3 w-3" />{b.email}
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.website_url ? (
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                              <a href={b.website_url} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3 w-3 mr-1" />Site
                              </a>
                            </Button>
                          ) : <MissingBadge label="no site" />}
                          {b.gmaps_url && (
                            <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                              <a href={b.gmaps_url} target="_blank" rel="noreferrer">
                                <MapPin className="h-3 w-3 mr-1" />Map
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {b.opening_status || b.closing_time ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {b.opening_status && (
                              <span className={cn(
                                "inline-flex items-center gap-1 font-medium",
                                /open/i.test(b.opening_status) ? "text-emerald-600" : "text-rose-600",
                              )}>
                                <Clock className="h-3 w-3" />{b.opening_status}
                              </span>
                            )}
                            {b.closing_time && <span className="text-muted-foreground">{b.closing_time}</span>}
                          </div>
                        ) : <MissingBadge label="no hours" />}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                              sl.tone,
                            )}>
                              {score}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{sl.label}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetail(b)}>Open details</DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Move to category</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {categories.map((c) => (
                                  <DropdownMenuItem key={c.id} onClick={() =>
                                    moveMut.mutate({ ids: [b.id], categoryId: c.id })}>{c.name}</DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <DropdownMenuItem key={s.value} onClick={() =>
                                    statusMut.mutate({ ids: [b.id], status: s.value })}>{s.label}</DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive"
                              onClick={() => { if (confirm("Delete this business?")) deleteMut.mutate([b.id]); }}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>Showing {filtered.length} of {businesses.length}</span>
            <Badge variant="outline">{selected.size} selected</Badge>
          </div>
        </div>

        {/* Sticky bulk action bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl border bg-card/95 backdrop-blur shadow-2xl px-4 py-2.5 max-w-[95vw] overflow-x-auto">
            <div className="flex items-center gap-2 pr-3 border-r">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2 tabular-nums">
                {selected.size}
              </span>
              <span className="text-sm font-medium whitespace-nowrap">selected</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><ArrowRight className="h-3.5 w-3.5 mr-1" />Move</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Move to category</DropdownMenuLabel>
                {categories.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No categories</div>}
                {categories.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => moveMut.mutate({ ids: [...selected], categoryId: c.id })}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">Status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s.value} onClick={() => statusMut.mutate({ ids: [...selected], status: s.value })}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline"
              onClick={() => statusMut.mutate({ ids: [...selected], status: "reviewed" })}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Reviewed
            </Button>
            <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              onClick={() => statusMut.mutate({ ids: [...selected], status: "qualified" })}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />Qualified
            </Button>
            <Button size="sm" variant="outline" className="text-rose-700 border-rose-200 hover:bg-rose-50"
              onClick={() => statusMut.mutate({ ids: [...selected], status: "bad_data" })}>
              <AlertTriangle className="h-3.5 w-3.5 mr-1" />Bad data
            </Button>

            <Button size="sm" variant="outline" onClick={() => exportRows(selectedRows)}>
              <Download className="h-3.5 w-3.5 mr-1" />Export
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSyncOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1" />Sync to CRM
            </Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm(`Delete ${selected.size} businesses? This cannot be undone.`))
                deleteMut.mutate([...selected]);
            }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
            </Button>

            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />Clear
            </Button>
          </div>
        )}

        <BusinessDetailDrawer
          business={detail}
          categories={categories}
          allBusinesses={businesses}
          onClose={() => setDetail(null)}
        />
        <SyncBusinessesDialog
          open={syncOpen}
          onOpenChange={setSyncOpen}
          businessIds={[...selected]}
        />
      </div>
    </TooltipProvider>
  );
}
