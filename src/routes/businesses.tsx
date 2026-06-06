import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BusinessTable } from "@/components/BusinessTable";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";

type BusinessesSearch = {
  categoryId?: string;
  status?: string;
  quick?: string;
  q?: string;
  importId?: string;
};

export const Route = createFileRoute("/businesses")({
  head: () => ({ meta: [{ title: "Businesses · LeadForge" }] }),
  validateSearch: (s: Record<string, unknown>): BusinessesSearch => ({
    categoryId: typeof s.categoryId === "string" ? s.categoryId : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    quick: typeof s.quick === "string" ? s.quick : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    importId: typeof s.importId === "string" ? s.importId : undefined,
  }),
  component: () => (
    <AppShell title="Businesses" action={
      <Button asChild><Link to="/imports/new"><FileUp className="h-4 w-4 mr-1.5" />Import CSV</Link></Button>
    }>
      <BusinessTable />
    </AppShell>
  ),
});
