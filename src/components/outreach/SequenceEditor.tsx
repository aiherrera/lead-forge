import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { toast } from "sonner";
import { createSequenceStep, updateSequenceStep, deleteSequenceStep } from "@/lib/outreach/db";
import type { SequenceStep } from "@/lib/outreach/types";

export function SequenceEditor({
  campaignId,
  steps,
  onChange,
}: {
  campaignId: string;
  steps: SequenceStep[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function addStep() {
    setBusy(true);
    try {
      const nextNumber = (steps[steps.length - 1]?.step_number ?? 0) + 1;
      await createSequenceStep({
        campaign_id: campaignId,
        step_number: nextNumber,
        name: `Follow-up ${nextNumber - 1}`,
        delay_days: 3,
        subject: "Re: {{businessName}}",
        body_text: `Hi {{firstName}},\n\nJust circling back on my previous note. Did you get a chance to take a look?\n\nBest,\n{{senderName}}`,
        send_condition: {
          send_if_no_reply: true,
          send_if_not_bounced: true,
          send_if_not_unsubscribed: true,
          send_if_previous_sent: true,
          stop_after_reply: true,
          stop_after_unsubscribe: true,
        },
      });
      toast.success("Step added");
      onChange();
    } catch (e) {
      toast.error("Failed to add step: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {steps.map((s) => (
        <StepCard key={s.id} step={s} onChange={onChange} />
      ))}
      <Button variant="outline" onClick={addStep} disabled={busy}>
        <Plus className="h-4 w-4 mr-2" />Add follow-up step
      </Button>
      <div className="text-xs text-muted-foreground">
        Follow-up steps are scheduled automatically after the previous step is sent, respecting reply / bounce / unsubscribe conditions.
      </div>
    </div>
  );
}

function StepCard({ step, onChange }: { step: SequenceStep; onChange: () => void }) {
  const [name, setName] = useState(step.name);
  const [delay, setDelay] = useState(step.delay_days);
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body_text);
  const [stopOnReply, setStopOnReply] = useState(step.send_condition?.stop_after_reply ?? true);
  const [sendIfNoReply, setSendIfNoReply] = useState(step.send_condition?.send_if_no_reply ?? true);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  function mark<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setDirty(true); };
  }

  async function save() {
    setBusy(true);
    try {
      await updateSequenceStep(step.id, {
        name, delay_days: delay, subject, body_text: body,
        send_condition: {
          ...step.send_condition,
          send_if_no_reply: sendIfNoReply,
          stop_after_reply: stopOnReply,
        },
      });
      setDirty(false);
      toast.success(`Step ${step.step_number} saved`);
      onChange();
    } catch (e) {
      toast.error("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (step.step_number === 1) { toast.error("Cannot delete the initial step"); return; }
    if (!confirm(`Delete step ${step.step_number}?`)) return;
    setBusy(true);
    try {
      await deleteSequenceStep(step.id);
      toast.success("Step deleted");
      onChange();
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base flex items-center gap-2">
          Step {step.step_number}
          {step.step_number === 1 && <Badge variant="outline" className="text-[10px]">Initial</Badge>}
          {dirty && <Badge variant="outline" className="bg-amber-50 text-amber-700 text-[10px]">Unsaved</Badge>}
        </CardTitle>
        <div className="ml-auto flex items-center gap-1">
          {dirty && <Button size="sm" onClick={save} disabled={busy}><Save className="h-3 w-3 mr-1" />Save</Button>}
          {step.step_number > 1 && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>Step name</Label>
            <Input value={name} onChange={(e) => mark(setName)(e.target.value)} />
          </div>
          <div>
            <Label>Delay (days)</Label>
            <Input type="number" min={0} value={delay} disabled={step.step_number === 1}
              onChange={(e) => mark(setDelay)(Number(e.target.value || 0))} />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={sendIfNoReply} onCheckedChange={mark(setSendIfNoReply)} disabled={step.step_number === 1} />
              <Label className="text-xs">Skip if replied</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={stopOnReply} onCheckedChange={mark(setStopOnReply)} />
              <Label className="text-xs">Stop on reply</Label>
            </div>
          </div>
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => mark(setSubject)(e.target.value)} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea rows={6} value={body} onChange={(e) => mark(setBody)(e.target.value)} />
        </div>
      </CardContent>
    </Card>
  );
}
