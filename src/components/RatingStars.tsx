import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({ value, className }: { value: number | null; className?: string }) {
  if (value == null) return <span className="text-xs text-muted-foreground italic">—</span>;
  const full = Math.round(value);
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn("h-3.5 w-3.5", i < full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}
