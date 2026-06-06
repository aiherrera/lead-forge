import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Tags, PhoneOff, Globe, Star, FileUp, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fetchBusinesses, fetchCategories, fetchImports } from "@/lib/db";
import { CategoryBadge } from "@/components/Badges";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard · LeadForge" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: imports = [] } = useQuery({ queryKey: ["imports"], queryFn: fetchImports });

  const totalBusinesses = businesses.length;
  const noPhone = businesses.filter((b) => !b.phone).length;
  const noWeb = businesses.filter((b) => !b.website_url).length;
  const highRated = businesses.filter((b) => (b.rating ?? 0) >= 4.5).length;

  const stats = [
    { label: "Total businesses", value: totalBusinesses.toLocaleString(), icon: Building2, tone: "text-primary" },
    { label: "Categories", value: categories.length, icon: Tags, tone: "text-violet-500" },
    { label: "Missing phone", value: noPhone, icon: PhoneOff, tone: "text-amber-600" },
    { label: "Missing website", value: noWeb, icon: Globe, tone: "text-rose-600" },
    { label: "Rated 4.5+", value: highRated, icon: Star, tone: "text-emerald-600" },
  ];

  return (
    <AppShell title="Dashboard" action={
      <Button asChild><Link to="/imports/new"><FileUp className="h-4 w-4 mr-1.5" />Import CSV</Link></Button>
    }>
      {totalBusinesses === 0 && categories.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <Icon className={`h-4 w-4 ${s.tone}`} />
                  </div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{s.value}</div>
                </Card>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <h3 className="font-semibold mb-4">Progress by category</h3>
              <div className="space-y-4">
                {categories.length === 0 && (
                  <p className="text-sm text-muted-foreground">No categories yet.</p>
                )}
                {categories.map((c) => {
                  const inCat = businesses.filter((b) => b.category_id === c.id);
                  const reviewed = inCat.filter((b) => b.status !== "new").length;
                  const pct = inCat.length > 0 ? (reviewed / inCat.length) * 100 : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <CategoryBadge name={c.name} color={c.color} />
                        <span className="text-muted-foreground tabular-nums">
                          {reviewed}/{inCat.length} processed
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Recent imports</h3>
                <Link to="/imports" className="text-xs text-primary inline-flex items-center">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </div>
              <div className="space-y-2">
                {imports.length === 0 && (
                  <p className="text-sm text-muted-foreground">No imports yet.</p>
                )}
                {imports.slice(0, 6).map((i) => {
                  const cat = categories.find((c) => c.id === i.category_id);
                  return (
                    <div key={i.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{i.filename}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(i.created_at).toLocaleString()} · {i.row_count} rows
                        </div>
                      </div>
                      {cat && <CategoryBadge name={cat.name} color={cat.color} />}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center max-w-2xl mx-auto">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <FileUp className="h-7 w-7 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Welcome to LeadForge</h2>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Drop a Google Maps scraper CSV to get started. We'll help you map messy headers,
        organize businesses into campaigns, and prepare clean data for outreach.
      </p>
      <Button asChild size="lg"><Link to="/imports/new"><FileUp className="h-4 w-4 mr-2" />Import your first CSV</Link></Button>
    </Card>
  );
}
