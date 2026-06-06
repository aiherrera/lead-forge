import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { addSuppression, updateCampaignLead } from "@/lib/outreach/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

export const Route = createFileRoute("/u/$token")({ component: UnsubPage });

function UnsubPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"loading" | "ready" | "done" | "invalid">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [bizId, setBizId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("campaign_leads").select("id,business_id,campaign_id,unsubscribed_at").eq("unsubscribe_token", token).maybeSingle();
      if (!data) { setState("invalid"); return; }
      const { data: b } = await sb.from("businesses").select("email").eq("id", data.business_id).maybeSingle();
      setEmail(b?.email ?? null);
      setLeadId(data.id); setBizId(data.business_id); setCampaignId(data.campaign_id);
      setState(data.unsubscribed_at ? "done" : "ready");
    })();
  }, [token]);

  async function confirm() {
    if (!email || !leadId) return;
    const now = new Date().toISOString();
    await addSuppression({ email, reason: "unsubscribed", source: "unsubscribe_link", campaign_id: campaignId, business_id: bizId });
    await updateCampaignLead(leadId, { unsubscribed_at: now, status: "unsubscribed" });
    if (bizId) await sb.from("businesses").update({ unsubscribed_at: now, do_not_contact: true }).eq("id", bizId);
    setState("done");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-6">
      <Card className="max-w-md w-full">
        <CardHeader><CardTitle>Unsubscribe</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && <p>Loading…</p>}
          {state === "invalid" && <p className="text-sm">This unsubscribe link is invalid or expired.</p>}
          {state === "ready" && (
            <>
              <p className="text-sm">Are you sure you want to unsubscribe <b>{email}</b> from future emails?</p>
              <Button onClick={confirm}>Confirm unsubscribe</Button>
            </>
          )}
          {state === "done" && (
            <p className="text-sm text-emerald-700">
              You've been unsubscribed{email ? `: ${email}` : ""}. You will not receive further messages from us.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
