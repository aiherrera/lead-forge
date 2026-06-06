import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Settings2, Plug, AlertCircle, CheckCircle2, Pause } from "lucide-react";
import type { Integration, IntegrationProvider } from "@/lib/integrations/types";
import { PROVIDER_META } from "@/lib/integrations/types";
import { formatDistanceToNow } from "date-fns";

export function ProviderCard({
  provider,
  existing,
  onConnect,
  onConfigure,
  onManage,
  onTest,
  onDisconnect,
  onToggle,
}: {
  provider: IntegrationProvider;
  existing?: Integration;
  onConnect: () => void;
  onConfigure: () => void;
  onManage?: () => void;
  onTest: () => void;
  onDisconnect: () => void;
  onToggle: () => void;
}) {
  const meta = PROVIDER_META[provider];
  const status = existing?.status ?? "not_connected";
  const enabled = existing?.is_enabled ?? false;

  return (
    <Card className={!meta.supported && !existing ? "opacity-75" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="font-semibold">{meta.label}</div>
              <StatusBadge status={status} enabled={enabled} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
          </div>
          {!meta.supported && !existing && (
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-2">
        {existing ? (
          <>
            <div className="flex items-center justify-between">
              <span>Last sync</span>
              <span className="text-foreground">{existing.last_sync_at ? formatDistanceToNow(new Date(existing.last_sync_at), { addSuffix: true }) : "Never"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last tested</span>
              <span className="text-foreground">{existing.last_tested_at ? formatDistanceToNow(new Date(existing.last_tested_at), { addSuffix: true }) : "Never"}</span>
            </div>
            {existing.last_error && (
              <div className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-700 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{existing.last_error}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Button size="sm" variant="outline" onClick={onConfigure}>
                <Settings2 className="h-3.5 w-3.5 mr-1" /> Credentials
              </Button>
              {onManage && (
                <Button size="sm" variant="outline" onClick={onManage}>Mapping & rules</Button>
              )}
              <Button size="sm" variant="outline" onClick={onTest}>Test</Button>
              <Button size="sm" variant="outline" onClick={onToggle}>
                {enabled ? <><Pause className="h-3.5 w-3.5 mr-1" /> Disable</> : "Enable"}
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={onDisconnect}>Disconnect</Button>
            </div>
          </>
        ) : (
          <div className="pt-1">
            <Button size="sm" onClick={onConnect} disabled={!meta.supported}>
              <Plug className="h-3.5 w-3.5 mr-1" /> {meta.supported ? "Connect" : "Not available yet"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, enabled }: { status: string; enabled: boolean }) {
  if (!enabled && status === "connected") return <Badge variant="outline" className="text-[10px] bg-slate-100">Disabled</Badge>;
  if (status === "connected") return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
  if (status === "error") return <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Error</Badge>;
  if (status === "disabled") return <Badge variant="outline" className="text-[10px] bg-slate-100">Disabled</Badge>;
  return <Badge variant="outline" className="text-[10px]">Not connected</Badge>;
}
