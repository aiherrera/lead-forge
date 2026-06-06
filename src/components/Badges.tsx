import { Badge } from "@/components/ui/badge";
import { STATUS_OPTIONS, type BusinessStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: BusinessStatus }) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
  return <Badge variant="outline" className={cn("font-medium", opt.tone)}>{opt.label}</Badge>;
}

export function MissingBadge({ label = "missing" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-muted-foreground/30 px-2 py-0.5 text-[11px] text-muted-foreground italic">
      {label}
    </span>
  );
}

export function CategoryBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color + "22", color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
