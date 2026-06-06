import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import type { ComplianceIssue } from "@/lib/outreach/compliance";

export function ComplianceCheckDialog({
  open,
  onOpenChange,
  issues,
  onConfirm,
  confirmLabel = "Start sending",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  issues: ComplianceIssue[];
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const blocked = errors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance & safety check
          </DialogTitle>
          <DialogDescription>
            Pre-send validation for sender info, audience, content, and CAN-SPAM / GDPR requirements.
          </DialogDescription>
        </DialogHeader>

        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="h-5 w-5" />
            All checks passed. Ready to send.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {errors.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.length} blocking issue{errors.length === 1 ? "" : "s"}
                </div>
                <ul className="space-y-1">
                  {errors.map((i) => (
                    <li key={i.id} className="text-sm rounded-md border border-rose-200 bg-rose-50 p-2 text-rose-900">
                      <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 mr-2">Error</Badge>
                      {i.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-amber-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                </div>
                <ul className="space-y-1">
                  {warnings.map((i) => (
                    <li key={i.id} className="text-sm rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900">
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 mr-2">Warn</Badge>
                      {i.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={blocked}>
            {blocked ? "Resolve blocking issues first" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
