import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RatingStars } from "./RatingStars";
import { CategoryBadge } from "./Badges";
import { ExternalLink, Phone, Mail, MapPin, Image as ImageIcon, AlertTriangle, Copy, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { STATUS_OPTIONS, type Business, type BusinessStatus, type Category } from "@/lib/types";
import { updateBusiness, fetchActivities, createActivity, deleteActivity } from "@/lib/db";
import {
  PRIORITY_OPTIONS, ACTIVITY_TYPE_OPTIONS, ACTIVITY_LABEL, OUTREACH_META, outreachReadiness,
  type Priority, type ActivityType, type PipelineStage,
} from "@/lib/pipeline";
import { buildDuplicateIndex, getWarnings, leadScore, scoreLabel, WARNING_LABEL } from "@/lib/quality";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function BusinessDetailDrawer({
  business,
  categories,
  allBusinesses = [],
  stages = [],
  onClose,
}: {
  business: Business | null;
  categories: Category[];
  allBusinesses?: Business[];
  stages?: PipelineStage[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Business>>({});

  const merged = useMemo(() => ({ ...(business ?? {}), ...draft }) as Business, [business, draft]);
  const dupIndex = useMemo(() => buildDuplicateIndex(allBusinesses), [allBusinesses]);
  const warnings = useMemo(() => (business ? getWarnings(merged, dupIndex) : []), [business, merged, dupIndex]);
  const duplicates = useMemo(() => (business ? dupIndex.duplicatesOf(merged) : []), [business, merged, dupIndex]);
  const score = useMemo(() => (business ? leadScore(merged) : 0), [business, merged]);
  const sl = scoreLabel(score);
  const stageName = merged.pipeline_stage ? stages.find((s) => s.id === merged.pipeline_stage)?.name ?? null : null;
  const readiness = business ? outreachReadiness(merged, stageName) : "not_ready";

  const mut = useMutation({
    mutationFn: async () => {
      if (!business) return;
      await updateBusiness(business.id, draft);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Business updated");
      onClose();
      setDraft({});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!business) return null;
  const cat = categories.find((c) => c.id === merged.category_id);

  return (
    <Sheet open={!!business} onOpenChange={(o) => !o && (onClose(), setDraft({}))}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl flex items-center gap-2">
            {merged.name || "Unnamed business"}
            <Badge variant="outline" className={cn("text-[10px]", OUTREACH_META[readiness].tone)}>
              {OUTREACH_META[readiness].label}
            </Badge>
          </SheetTitle>
          <SheetDescription>Review, qualify, and manage this lead</SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-6 mt-4">
            {merged.image_url ? (
              <img src={merged.image_url} alt="" className="w-full h-44 object-cover rounded-lg border" />
            ) : (
              <div className="w-full h-44 rounded-lg border bg-muted flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <RatingStars value={merged.rating} />
              <span className="text-sm text-muted-foreground">{merged.review_count?.toLocaleString() ?? 0} reviews</span>
            </div>
            <div className={cn("rounded-xl border p-4 flex items-center justify-between", sl.tone)}>
              <div>
                <div className="text-xs uppercase tracking-wide font-semibold opacity-80">Lead score</div>
                <div className="text-sm font-semibold mt-0.5">{sl.label}</div>
              </div>
              <div className="text-4xl font-bold tabular-nums">{score}</div>
            </div>
            {warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 text-amber-800 font-medium text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />Data quality warnings ({warnings.length})
                </div>
                <ul className="space-y-1 text-xs text-amber-900">
                  {warnings.map((w) => <li key={w}>• {WARNING_LABEL[w]}</li>)}
                </ul>
              </div>
            )}
            {duplicates.length > 0 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
                <div className="flex items-center gap-1.5 text-orange-800 font-medium text-sm mb-2">
                  <Copy className="h-4 w-4" />{duplicates.length} possible duplicate{duplicates.length > 1 ? "s" : ""}
                </div>
                <ul className="space-y-1 text-xs text-orange-900">
                  {duplicates.slice(0, 5).map((d) => (
                    <li key={d.id} className="truncate">• {d.name || "Unnamed"} — {d.address || d.phone || d.website_url || "no info"}</li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs"
                  onClick={() => setDraft({ ...draft, status: "duplicate" })}>Mark as Duplicate</Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Business name"><Input value={merged.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="Type / category"><Input value={merged.business_category ?? ""} onChange={(e) => setDraft({ ...draft, business_category: e.target.value })} /></Field>
              <Field label="Phone"><Input value={merged.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={merged.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <Field label="Website"><Input value={merged.website_url ?? ""} onChange={(e) => setDraft({ ...draft, website_url: e.target.value })} /></Field>
              <Field label="Google Maps URL"><Input value={merged.gmaps_url ?? ""} onChange={(e) => setDraft({ ...draft, gmaps_url: e.target.value })} /></Field>
              <Field label="Address" className="col-span-2"><Input value={merged.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
              <Field label="City"><Input value={merged.city ?? ""} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></Field>
              <Field label="State"><Input value={merged.state ?? ""} onChange={(e) => setDraft({ ...draft, state: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={merged.status} onValueChange={(v) => setDraft({ ...draft, status: v as BusinessStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={merged.category_id ?? ""} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={3} value={merged.notes ?? ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>

            <div className="flex flex-wrap gap-2">
              {merged.phone && <Button variant="outline" size="sm" asChild><a href={`tel:${merged.phone}`}><Phone className="h-3.5 w-3.5 mr-1" />Call</a></Button>}
              {merged.email && <Button variant="outline" size="sm" asChild><a href={`mailto:${merged.email}`}><Mail className="h-3.5 w-3.5 mr-1" />Email</a></Button>}
              {merged.website_url && <Button variant="outline" size="sm" asChild><a href={merged.website_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" />Website</a></Button>}
              {merged.gmaps_url && <Button variant="outline" size="sm" asChild><a href={merged.gmaps_url} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5 mr-1" />Open in Maps</a></Button>}
            </div>
            {cat && <div className="text-sm"><span className="text-muted-foreground mr-2">Current category:</span><CategoryBadge name={cat.name} color={cat.color} /></div>}
          </TabsContent>

          {/* CRM TAB */}
          <TabsContent value="crm" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pipeline stage">
                <Select value={merged.pipeline_stage ?? ""} onValueChange={(v) => setDraft({ ...draft, pipeline_stage: v })}>
                  <SelectTrigger><SelectValue placeholder="No stage" /></SelectTrigger>
                  <SelectContent>
                    {stages.filter((s) => !s.is_hidden).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={merged.priority ?? "medium"} onValueChange={(v: Priority) => setDraft({ ...draft, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Assigned to"><Input value={merged.assigned_to ?? ""} onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })} /></Field>
              <Field label="Estimated deal value">
                <Input
                  type="number"
                  value={merged.deal_value_estimate ?? ""}
                  onChange={(e) => setDraft({ ...draft, deal_value_estimate: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </Field>
              <Field label="Next action" className="col-span-2">
                <Input value={merged.next_action ?? ""} onChange={(e) => setDraft({ ...draft, next_action: e.target.value })} />
              </Field>
              <Field label="Next action date" className="col-span-2">
                <Input
                  type="datetime-local"
                  value={merged.next_action_date ? toLocal(merged.next_action_date) : ""}
                  onChange={(e) => setDraft({ ...draft, next_action_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </Field>
            </div>
            <Field label="Pipeline notes">
              <Textarea rows={4} value={merged.pipeline_notes ?? ""} onChange={(e) => setDraft({ ...draft, pipeline_notes: e.target.value })} />
            </Field>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-0.5">
              <div>Last activity: {merged.last_activity_at ? new Date(merged.last_activity_at).toLocaleString() : "—"}</div>
              <div>Last contacted: {merged.last_contacted_at ? new Date(merged.last_contacted_at).toLocaleString() : "—"}</div>
            </div>
          </TabsContent>

          {/* ACTIVITY TAB */}
          <TabsContent value="activity" className="mt-4">
            <ActivityTimeline businessId={business.id} />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 mt-4 border-t">
          <Button variant="ghost" onClick={() => { onClose(); setDraft({}); }}>Cancel</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || Object.keys(draft).length === 0}>
            {mut.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActivityTimeline({ businessId }: { businessId: string }) {
  const qc = useQueryClient();
  const { data: activities = [] } = useQuery({
    queryKey: ["activities", businessId],
    queryFn: () => fetchActivities(businessId),
  });
  const [type, setType] = useState<ActivityType>("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");

  const createM = useMutation({
    mutationFn: () => createActivity({
      business_id: businessId,
      type,
      title: title.trim() || ACTIVITY_LABEL[type],
      description: description || null,
      due_date: due ? new Date(due).toISOString() : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", businessId] });
      qc.invalidateQueries({ queryKey: ["businesses"] });
      setTitle(""); setDescription(""); setDue(""); setType("note");
      toast.success("Activity added");
    },
  });
  const delM = useMutation({
    mutationFn: deleteActivity,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities", businessId] }),
  });
  const completeM = useMutation({
    mutationFn: (id: string) => import("@/lib/db").then((m) => m.updateActivity(id, { completed_at: new Date().toISOString() })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities", businessId] }),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onValueChange={(v: ActivityType) => setType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACTIVITY_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="datetime-local" placeholder="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea rows={2} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Button size="sm" onClick={() => createM.mutate()} disabled={createM.isPending}>
          <Plus className="h-4 w-4 mr-1" />Add activity
        </Button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground italic py-8">No activity yet</div>
      ) : (
        <ol className="relative border-l-2 border-border ml-2 space-y-3">
          {activities.map((a) => (
            <li key={a.id} className="ml-4">
              <span className="absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full bg-primary border-2 border-background" />
              <div className="rounded-lg border bg-card p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{ACTIVITY_LABEL[a.type]}</Badge>
                    <span className="font-medium">{a.title}</span>
                  </div>
                  <div className="flex gap-1">
                    {!a.completed_at && (
                      <Button variant="ghost" size="sm" onClick={() => completeM.mutate(a.id)} title="Mark complete">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => delM.mutate(a.id)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
                {a.description && <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.description}</div>}
                <div className="text-[11px] text-muted-foreground mt-1.5 flex gap-3">
                  <span>{new Date(a.created_at).toLocaleString()}</span>
                  {a.due_date && <span>Due: {new Date(a.due_date).toLocaleString()}</span>}
                  {a.completed_at && <span className="text-emerald-600">✓ Done</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
