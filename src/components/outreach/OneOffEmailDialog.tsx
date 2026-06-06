import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  fetchEmailTemplates, fetchEmailAccounts, fetchAppSettings,
  insertEmailJobs, isSuppressed,
} from "@/lib/outreach/db";
import { renderForBusiness } from "@/lib/outreach/sender";
import type { EmailAccount, EmailTemplate, AppSettings } from "@/lib/outreach/types";
import type { Business, Category } from "@/lib/types";

export function OneOffEmailDialog({
  open,
  onOpenChange,
  business,
  category,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  business: Business | null;
  category?: Category | null;
  onSent?: () => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [t, a, s] = await Promise.all([fetchEmailTemplates(), fetchEmailAccounts(), fetchAppSettings()]);
      setTemplates(t); setAccounts(a); setSettings(s);
      const defAcc = s.default_sender_account_id ?? a[0]?.id ?? "";
      setAccountId(defAcc);
      setSenderName(s.default_sender_name ?? "");
      setSenderCompany(s.default_sender_company ?? "");
    })();
  }, [open]);

  useEffect(() => {
    if (!open || !business?.email) { setSuppressed(false); return; }
    isSuppressed(business.email).then(setSuppressed);
  }, [open, business?.email]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject);
    setBody(t.body_text);
  }

  const rendered = useMemo(() => {
    if (!business) return null;
    return renderForBusiness(subject, body, business, category ?? null,
      { sender_name: senderName, sender_company: senderCompany });
  }, [subject, body, business, category, senderName, senderCompany]);

  async function send() {
    if (!business?.email) { toast.error("Lead has no email address"); return; }
    if (!accountId) { toast.error("Select a sender account"); return; }
    if (!subject.trim() || !body.trim()) { toast.error("Subject and body are required"); return; }
    setSubmitting(true);
    try {
      await insertEmailJobs([{
        business_id: business.id,
        sender_account_id: accountId,
        recipient_email: business.email,
        subject: rendered?.subject ?? subject,
        body_text: rendered?.bodyText ?? body,
        body_html: rendered?.bodyHtml ?? null,
        status: "queued",
        is_simulated: false,
        scheduled_at: new Date().toISOString(),
      }]);
      toast.success("Email queued for sending");
      onSent?.();
      onOpenChange(false);
      setTemplateId(""); setSubject(""); setBody("");
    } catch (e) {
      toast.error("Failed to queue email: " + (e instanceof Error ? e.message : String(e)));
    } finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />One-off email</DialogTitle>
          <DialogDescription>
            Send a single personalized email to {business?.name ?? "this lead"}. Not part of a campaign sequence.
          </DialogDescription>
        </DialogHeader>

        {suppressed && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
            This recipient is on the suppression list. Sending is blocked.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger><SelectValue placeholder="Pick a template (optional)" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sender account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Pick a sender" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.sender_email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sender name</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
          </div>
          <div>
            <Label>Sender company</Label>
            <Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>To</Label>
          <Input value={business?.email ?? ""} disabled />
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>

        {rendered && (rendered.missing.length > 0) && (
          <div className="text-xs text-amber-700">
            Missing variable values: {rendered.missing.map((m) => <Badge key={m} variant="outline" className="mr-1">{m}</Badge>)}
          </div>
        )}
        {rendered && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Preview</div>
            <div className="font-medium">{rendered.subject}</div>
            <pre className="whitespace-pre-wrap text-xs mt-1">{rendered.bodyText}</pre>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={submitting || suppressed || !business?.email}>
            <Send className="h-4 w-4 mr-2" />Queue email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
