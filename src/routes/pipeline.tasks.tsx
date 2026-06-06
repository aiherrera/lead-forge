import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  fetchTasks, fetchBusinesses, fetchPipelineStages, createTask, updateTask, deleteTask,
} from "@/lib/db";
import { PRIORITY_OPTIONS, PRIORITY_META, type Priority, type Task } from "@/lib/pipeline";
import { CheckCircle2, Trash2, Plus, CalendarDays, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pipeline/tasks")({
  head: () => ({ meta: [{ title: "Tasks · LeadForge" }] }),
  component: TasksPage,
});

function TasksPage() {
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks });
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: stages = [] } = useQuery({ queryKey: ["pipeline_stages"], queryFn: fetchPipelineStages });
  const [open, setOpen] = useState(false);

  const bizName = (id: string | null) => businesses.find((b) => b.id === id)?.name ?? "—";
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? null;

  const groups = useMemo(() => {
    const now = Date.now();
    const overdue: Task[] = [], today: Task[] = [], upcoming: Task[] = [], completed: Task[] = [];
    for (const t of tasks) {
      if (t.status === "completed") { completed.push(t); continue; }
      if (!t.due_date) { upcoming.push(t); continue; }
      const d = new Date(t.due_date); const n = new Date();
      const isToday = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
      if (d.getTime() < now && !isToday) overdue.push(t);
      else if (isToday) today.push(t);
      else upcoming.push(t);
    }
    return { overdue, today, upcoming, completed };
  }, [tasks]);

  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) => updateTask(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const delM = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
  });

  const renderGroup = (label: string, items: Task[], tone?: string) => (
    <div className="rounded-xl border bg-card">
      <div className={cn("px-4 py-2.5 border-b font-medium text-sm flex items-center justify-between", tone)}>
        <span>{label}</span>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground italic">No tasks</div>
      ) : (
        <div className="divide-y">
          {items.map((t) => {
            const biz = businesses.find((b) => b.id === t.business_id);
            const stage = biz?.pipeline_stage ? stageName(biz.pipeline_stage) : null;
            return (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => updateM.mutate({ id: t.id, patch: { status: t.status === "completed" ? "open" : "completed" } })}
                >
                  <CheckCircle2 className={cn("h-5 w-5", t.status === "completed" ? "text-emerald-600" : "text-muted-foreground")} />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium text-sm truncate", t.status === "completed" && "line-through text-muted-foreground")}>
                    {t.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {bizName(t.business_id)}
                    {stage && <> · {stage}</>}
                    {t.due_date && <> · <CalendarDays className="inline h-3 w-3" /> {new Date(t.due_date).toLocaleString()}</>}
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", PRIORITY_META[t.priority ?? "medium"].tone)}>
                  {PRIORITY_META[t.priority ?? "medium"].label}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => delM.mutate(t.id)}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <AppShell
      title="Tasks"
      action={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/pipeline"><ArrowLeft className="h-4 w-4 mr-1" />Pipeline</Link>
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />New task
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-12">
        {renderGroup("Overdue", groups.overdue, "bg-rose-50 text-rose-800")}
        {renderGroup("Due today", groups.today, "bg-amber-50 text-amber-800")}
        {renderGroup("Upcoming", groups.upcoming)}
        {renderGroup("Completed", groups.completed, "text-muted-foreground")}
      </div>

      <NewTaskDialog open={open} onOpenChange={setOpen} businesses={businesses} />
    </AppShell>
  );
}

function NewTaskDialog({
  open, onOpenChange, businesses,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  businesses: { id: string; name: string | null }[];
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [businessId, setBusinessId] = useState<string>("");

  const mut = useMutation({
    mutationFn: () => createTask({
      title,
      description: description || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
      business_id: businessId || null,
      status: "open",
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created");
      onOpenChange(false);
      setTitle(""); setDescription(""); setDueDate(""); setPriority("medium"); setBusinessId("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due date</Label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: Priority) => setPriority(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Related business (optional)</Label>
            <Select value={businessId} onValueChange={setBusinessId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {businesses.slice(0, 200).map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name ?? "Unnamed"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={!title.trim() || mut.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
