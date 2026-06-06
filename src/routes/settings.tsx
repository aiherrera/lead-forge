import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings · LeadForge" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const wipe = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      await sb.from("businesses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("imports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await sb.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    },
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("All data cleared");
    },
  });

  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-1">About LeadForge</h3>
          <p className="text-sm text-muted-foreground">
            A processor for businesses scraped from Google Maps. Import messy CSVs, map fields,
            categorize into campaigns, clean records, and export for outreach.
          </p>
        </Card>
        <Card className="p-6 border-destructive/40">
          <h3 className="font-semibold mb-1 text-destructive">Danger zone</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete all categories, imports, and businesses.
          </p>
          <Button variant="destructive" disabled={wipe.isPending}
            onClick={() => { if (confirm("Wipe ALL data? This cannot be undone.")) wipe.mutate(); }}>
            {wipe.isPending ? "Wiping…" : "Wipe all data"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
