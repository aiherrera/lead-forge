import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ImportWizard } from "@/components/ImportWizard";

export const Route = createFileRoute("/imports/new")({
  head: () => ({ meta: [{ title: "Import CSV · LeadForge" }] }),
  component: () => (
    <AppShell title="Import CSV">
      <ImportWizard />
    </AppShell>
  ),
});
