import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Building2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { fetchBusinesses, fetchCategories, createCategory, updateCategory, deleteCategory } from "@/lib/db";
import { CATEGORY_COLORS, type Category } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories · LeadForge" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: businesses = [] } = useQuery({ queryKey: ["businesses"], queryFn: fetchBusinesses });
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const mut = useMutation({
    mutationFn: async (input: { name: string; color: string; description: string; id?: string }) => {
      if (input.id) await updateCategory(input.id, input);
      else await createCategory(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditing(null); setCreating(false);
      toast.success("Saved");
    },
  });

  const delMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Deleted"); },
  });

  return (
    <AppShell title="Categories" action={
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4 mr-1.5" />New category</Button>
        </DialogTrigger>
        <CategoryDialog
          onSave={(v) => mut.mutate(v)}
          pending={mut.isPending}
        />
      </Dialog>
    }>
      {categories.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="font-semibold mb-1">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create a category for each search you ran, e.g. "HVAC contractors in Florida".
          </p>
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1.5" />Create category</Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => {
            const count = businesses.filter((b) => b.category_id === c.id).length;
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <h3 className="font-semibold">{c.name}</h3>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm(`Delete "${c.name}"? Businesses will be uncategorized.`)) delMut.mutate(c.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {c.description && <p className="text-sm text-muted-foreground mt-2">{c.description}</p>}
                <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="tabular-nums font-medium text-foreground">{count}</span> businesses
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <CategoryDialog
            initial={editing}
            onSave={(v) => mut.mutate({ ...v, id: editing.id })}
            pending={mut.isPending}
          />
        )}
      </Dialog>
    </AppShell>
  );
}

function CategoryDialog({
  initial, onSave, pending,
}: { initial?: Category; onSave: (v: { name: string; color: string; description: string }) => void; pending: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0]);
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HVAC contractors in Florida" />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <Label className="mb-2 block">Color</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={"h-7 w-7 rounded-full border-2 " + (color === c ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!name.trim() || pending} onClick={() => onSave({ name: name.trim(), color, description })}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
