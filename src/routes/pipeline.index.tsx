import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  fetchBusinesses, fetchCategories, fetchPipelineStages, updateBusiness,
  createPipelineStage, updatePipelineStage, deletePipelineStage, resetDefaultStages,
} from "@/lib/db";
import { BusinessDetailDrawer } from "@/components/BusinessDetailDrawer";
import {
  PRIORITY_OPTIONS, PRIORITY_META, outreachReadiness, OUTREACH_META,
  type Priority, type PipelineStage,
} from "@/lib/pipeline";
import { leadScore } from "@/lib/quality";
import { CheckSquare, Phone, Globe, Star, Plus, Settings2, GripVertical, Eye, EyeOff, RotateCcw, Trash2, ListTodo, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Business } from "@/lib/types";

export const Route = createFileRoute("/pipeline/")({
  head: () => ({ meta: [{ title: "Pipeline · LeadForge" }] }),
  component: PipelinePage,
});

type SavedView = "all" | "ready" | "high_priority" | "follow_up" | "strong_unassigned" | "qualified_uncontacted" | "overdue";

const SAVED_VIEWS: { key: SavedView; label: string }[] = [
  { key: "all", label: "All leads" },
  { key: "ready", label: "Ready for outreach" },
  { key: "high_priority", label: "High priority leads" },
  { key: "follow_up", label: "Follow-up needed" },
  { key: "strong_unassigned", label: "Strong leads not assigned" },
  { key: "qualified_uncontacted", label: "Qualified but not contacted" },
  { key: "overdue", label: "Overdue follow-ups" },
];

function PipelinePage() {
  const qc = useQueryClient();
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: stages = [] } = useQuery({ queryKey: ["pipeline_stages"], queryFn: fetchPipelineStages });

  const [detail, setDetail] = useState<Business | null>(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterMinScore, setFilterMinScore] = useState("0");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterDate, setFilterDate] = useState<"all" | "overdue" | "today" | "week">("all");
  const [savedView, setSavedView] = useState<SavedView>("all");
  const [stagesDialog, setStagesDialog] = useState(false);

  const visibleStages = useMemo(() => stages.filter((s) => !s.is_hidden), [stages]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const filtered = useMemo(() => {
    const min = parseFloat(filterMinScore);
    return businesses.filter((b) => {
      if (filterCategory !== "all" && b.category_id !== filterCategory) return false;
      if (filterPriority !== "all" && b.priority !== filterPriority) return false;
      if (min > 0 && leadScore(b) < min) return false;
      if (filterAssigned && (b.assigned_to ?? "").toLowerCase().indexOf(filterAssigned.toLowerCase()) === -1) return false;
      if (filterDate !== "all") {
        const d = b.next_action_date ? new Date(b.next_action_date) : null;
        const now = Date.now();
        if (filterDate === "overdue" && (!d || d.getTime() >= now)) return false;
        if (filterDate === "today") {
          if (!d) return false;
          const n = new Date();
          if (!(d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate())) return false;
        }
        if (filterDate === "week") {
          if (!d) return false;
          const diff = (d.getTime() - now) / (1000 * 60 * 60 * 24);
          if (diff < 0 || diff > 7) return false;
        }
      }
      // saved views
      const stage = b.pipeline_stage ? stageById.get(b.pipeline_stage) : null;
      const stageName = stage?.name ?? null;
      switch (savedView) {
        case "ready":
          if (outreachReadiness(b, stageName) !== "ready") return false;
          break;
        case "high_priority":
          if (b.priority !== "high" && b.priority !== "urgent") return false;
          break;
        case "follow_up":
          if (stageName !== "Follow-up needed") return false;
          break;
        case "strong_unassigned":
          if (leadScore(b) < 80 || b.assigned_to) return false;
          break;
        case "qualified_uncontacted":
          if (stageName !== "Qualified" || b.last_contacted_at) return false;
          break;
        case "overdue":
          if (!b.next_action_date || new Date(b.next_action_date).getTime() >= Date.now()) return false;
          break;
      }
      return true;
    });
  }, [businesses, filterCategory, filterPriority, filterMinScore, filterAssigned, filterDate, savedView, stageById]);

  const grouped = useMemo(() => {
    const map = new Map<string, Business[]>();
    for (const s of visibleStages) map.set(s.id, []);
    const unassigned: Business[] = [];
    for (const b of filtered) {
      if (b.pipeline_stage && map.has(b.pipeline_stage)) map.get(b.pipeline_stage)!.push(b);
      else unassigned.push(b);
    }
    return { map, unassigned };
  }, [filtered, visibleStages]);

  const moveMut = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string | null }) => updateBusiness(id, { pipeline_stage: stageId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });

  const onDrop = (e: React.DragEvent, stageId: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/business-id");
    if (id) moveMut.mutate({ id, stageId });
  };

  return (
    <AppShell
      title="Pipeline"
      action={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pipeline/tasks"><ListTodo className="h-4 w-4 mr-1" />Tasks</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStagesDialog(true)}>
            <Settings2 className="h-4 w-4 mr-1" />Manage stages
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-12">
        {/* Saved views */}
        <div className="flex flex-wrap gap-1.5">
          {SAVED_VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setSavedView(v.key)}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition",
                savedView === v.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card hover:bg-muted border-border text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any priority</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMinScore} onValueChange={setFilterMinScore}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Any score</SelectItem>
              <SelectItem value="40">Score ≥ 40</SelectItem>
              <SelectItem value="60">Score ≥ 60</SelectItem>
              <SelectItem value="80">Score ≥ 80</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Assigned to…"
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
            className="w-[160px]"
          />
          <Select value={filterDate} onValueChange={(v: typeof filterDate) => setFilterDate(v)}>
            <SelectTrigger className="w-[160px]"><CalendarClock className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any next action</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="today">Due today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Kanban */}
        {visibleStages.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
            No pipeline stages. <Button variant="link" onClick={() => setStagesDialog(true)}>Add or restore stages</Button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {grouped.unassigned.length > 0 && (
              <KanbanColumn
                title="Unassigned"
                items={grouped.unassigned}
                stageId={null}
                onDrop={onDrop}
                stages={stages}
                onOpen={(b) => setDetail(b)}
                catNameById={(id) => categories.find((c) => c.id === id)?.name}
              />
            )}
            {visibleStages.map((s) => (
              <KanbanColumn
                key={s.id}
                title={s.name}
                items={grouped.map.get(s.id) ?? []}
                stageId={s.id}
                onDrop={onDrop}
                stages={stages}
                onOpen={(b) => setDetail(b)}
                catNameById={(id) => categories.find((c) => c.id === id)?.name}
              />
            ))}
          </div>
        )}
      </div>

      <BusinessDetailDrawer
        business={detail}
        categories={categories}
        allBusinesses={businesses}
        stages={stages}
        onClose={() => setDetail(null)}
      />

      <StagesDialog open={stagesDialog} onOpenChange={setStagesDialog} stages={stages} />
    </AppShell>
  );
}

function KanbanColumn({
  title, items, stageId, onDrop, stages, onOpen, catNameById,
}: {
  title: string;
  items: Business[];
  stageId: string | null;
  onDrop: (e: React.DragEvent, stageId: string | null) => void;
  stages: PipelineStage[];
  onOpen: (b: Business) => void;
  catNameById: (id: string | null) => string | undefined;
}) {
  const qc = useQueryClient();
  const moveMut = useMutation({
    mutationFn: ({ id, sid }: { id: string; sid: string | null }) => updateBusiness(id, { pipeline_stage: sid }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["businesses"] }),
  });
  return (
    <div
      className="w-72 shrink-0 rounded-xl border bg-muted/30 flex flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onDrop(e, stageId)}
    >
      <div className="px-3 py-2.5 border-b bg-card rounded-t-xl flex items-center justify-between">
        <div className="font-medium text-sm">{title}</div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {items.length === 0 && (
          <div className="text-center text-xs text-muted-foreground italic py-8">Drop leads here</div>
        )}
        {items.map((b) => (
          <KanbanCard key={b.id} b={b} onOpen={onOpen} stages={stages} catName={catNameById(b.category_id)} onMove={(sid) => moveMut.mutate({ id: b.id, sid })} />
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  b, onOpen, stages, catName, onMove,
}: {
  b: Business;
  onOpen: (b: Business) => void;
  stages: PipelineStage[];
  catName: string | undefined;
  onMove: (sid: string) => void;
}) {
  const score = leadScore(b);
  const pri = PRIORITY_META[b.priority ?? "medium"];
  const stage = b.pipeline_stage ? stages.find((s) => s.id === b.pipeline_stage)?.name ?? null : null;
  const ready = outreachReadiness(b, stage);
  const overdue = b.next_action_date && new Date(b.next_action_date).getTime() < Date.now();
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/business-id", b.id)}
      onClick={() => onOpen(b)}
      className="rounded-lg border bg-card p-2.5 text-xs space-y-1.5 cursor-pointer hover:border-primary/40 hover:shadow-sm transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm leading-tight truncate flex-1">{b.name ?? "Unnamed"}</div>
        <Badge variant="outline" className={cn("text-[10px]", pri.tone)}>{pri.label}</Badge>
      </div>
      {catName && <div className="text-[11px] text-muted-foreground truncate">{catName}</div>}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3" />{b.rating?.toFixed(1) ?? "—"}</span>
        <span>· Score {score}</span>
        <Phone className={cn("h-3 w-3", b.phone ? "text-emerald-600" : "text-muted-foreground/40")} />
        <Globe className={cn("h-3 w-3", b.website_url ? "text-emerald-600" : "text-muted-foreground/40")} />
      </div>
      <div className="flex flex-wrap gap-1 pt-0.5">
        <Badge variant="outline" className={cn("text-[10px]", OUTREACH_META[ready].tone)}>
          {OUTREACH_META[ready].label}
        </Badge>
        {b.next_action_date && (
          <Badge variant="outline" className={cn("text-[10px]", overdue ? "bg-rose-100 text-rose-700 border-rose-200" : "")}>
            <CalendarClock className="h-2.5 w-2.5 mr-0.5" />
            {new Date(b.next_action_date).toLocaleDateString()}
          </Badge>
        )}
      </div>
      {/* Quick stage change */}
      <Select
        value={b.pipeline_stage ?? ""}
        onValueChange={(v) => onMove(v)}
      >
        <SelectTrigger
          className="h-7 text-[11px] mt-1"
          onClick={(e) => e.stopPropagation()}
        ><SelectValue placeholder="Move to…" /></SelectTrigger>
        <SelectContent>
          {stages.filter((s) => !s.is_hidden).map((s) => (
            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StagesDialog({
  open, onOpenChange, stages,
}: { open: boolean; onOpenChange: (v: boolean) => void; stages: PipelineStage[] }) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const inv = () => qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
  const create = useMutation({
    mutationFn: (n: string) => createPipelineStage({ name: n, order_index: stages.length }),
    onSuccess: () => { inv(); setNewName(""); toast.success("Stage added"); },
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PipelineStage> }) => updatePipelineStage(id, patch),
    onSuccess: () => inv(),
  });
  const del = useMutation({ mutationFn: deletePipelineStage, onSuccess: () => { inv(); toast.success("Stage deleted"); } });
  const reset = useMutation({
    mutationFn: resetDefaultStages,
    onSuccess: () => { inv(); toast.success("Stages reset to defaults"); },
  });

  const move = (id: string, dir: -1 | 1) => {
    const sorted = [...stages].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[idx], b = sorted[j];
    updateM.mutate({ id: a.id, patch: { order_index: b.order_index } });
    updateM.mutate({ id: b.id, patch: { order_index: a.order_index } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Pipeline stages</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {stages.sort((a, b) => a.order_index - b.order_index).map((s) => (
            <div key={s.id} className="flex items-center gap-2 rounded-md border p-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => move(s.id, -1)}>↑</button>
                <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => move(s.id, 1)}>↓</button>
              </div>
              <Input
                value={s.name}
                onChange={(e) => updateM.mutate({ id: s.id, patch: { name: e.target.value } })}
                className="h-8"
              />
              <Button
                variant="ghost" size="sm"
                onClick={() => updateM.mutate({ id: s.id, patch: { is_hidden: !s.is_hidden } })}
                title={s.is_hidden ? "Show" : "Hide"}
              >
                {s.is_hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)}>
                <Trash2 className="h-4 w-4 text-rose-600" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-3 border-t">
          <Input placeholder="New stage name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={() => newName.trim() && create.mutate(newName.trim())}>
            <Plus className="h-4 w-4 mr-1" />Add
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => reset.mutate()}>
            <RotateCcw className="h-4 w-4 mr-1" />Reset to defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
