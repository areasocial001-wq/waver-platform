import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Clock, Cpu, FileText, Hash, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatEur, getPricePerSecond } from "@/lib/videoCostEstimator";

interface CostRow {
  id: string;
  provider: string;
  seconds_billed: number;
  cost_eur: number;
  story_project_id: string | null;
  scene_index: number | null;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

interface SceneCostDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: CostRow | null;
  projectTitle?: string;
}

export const SceneCostDetailDialog = ({ open, onOpenChange, row, projectTitle }: SceneCostDetailDialogProps) => {
  const [history, setHistory] = useState<CostRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !row) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Cronologia: tutte le righe dello stesso (project, scene_index)
        let q = supabase
          .from("video_cost_log")
          .select("id, provider, seconds_billed, cost_eur, story_project_id, scene_index, status, created_at, metadata")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (row.story_project_id) q = q.eq("story_project_id", row.story_project_id);
        else q = q.is("story_project_id", null);

        if (row.scene_index !== null) q = q.eq("scene_index", row.scene_index);
        else q = q.is("scene_index", null);

        const { data } = await q;
        if (!mounted) return;
        setHistory((data as CostRow[]) ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [open, row]);

  if (!row) return null;

  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const prompt = typeof meta.prompt === "string" ? meta.prompt : null;
  const requestedDuration = typeof meta.requestedDuration === "number" ? meta.requestedDuration : null;
  const source = typeof meta.source === "string" ? meta.source : null;

  const totalCost = history.reduce((s, r) => s + Number(r.cost_eur || 0), 0);
  const totalSec = history.reduce((s, r) => s + Number(r.seconds_billed || 0), 0);
  const providersUsed = Array.from(new Set(history.map(h => h.provider)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Dettaglio scena {row.scene_index !== null ? `#${row.scene_index + 1}` : ""}
          </DialogTitle>
          <DialogDescription>
            {projectTitle ? <>Progetto: <strong>{projectTitle}</strong></> : "Generazione senza progetto associato"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4">
            {/* Riepilogo */}
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Generazioni</div>
                  <div className="text-xl font-bold tabular-nums">{history.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Secondi totali</div>
                  <div className="text-xl font-bold tabular-nums">{totalSec.toFixed(1)}s</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="text-[10px] text-muted-foreground uppercase">Costo totale</div>
                  <div className="text-xl font-bold tabular-nums">{formatEur(totalCost)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Input / prompt */}
            {(prompt || requestedDuration || source) && (
              <Card className="bg-card/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
                    <FileText className="w-3.5 h-3.5" /> Input scena
                  </div>
                  {prompt && (
                    <div className="text-sm leading-relaxed bg-muted/40 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {prompt}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {requestedDuration !== null && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="w-3 h-3" /> Richiesti: {requestedDuration}s
                      </Badge>
                    )}
                    {source && (
                      <Badge variant="outline" className="gap-1">
                        <Hash className="w-3 h-3" /> {source}
                      </Badge>
                    )}
                    {providersUsed.length > 0 && (
                      <Badge variant="outline" className="gap-1">
                        <Cpu className="w-3 h-3" /> {providersUsed.length} provider
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase mb-3">
                  <Clock className="w-3.5 h-3.5" /> Cronologia generazioni ({history.length})
                </div>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nessuna cronologia disponibile.
                  </p>
                ) : (
                  <div className="relative pl-6 space-y-3">
                    {/* Linea verticale */}
                    <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
                    {history.map((h, idx) => {
                      const isCurrent = h.id === row.id;
                      const pps = getPricePerSecond(h.provider);
                      const date = new Date(h.created_at);
                      return (
                        <div key={h.id} className="relative">
                          {/* Pallino */}
                          <div
                            className={`absolute -left-[18px] top-1.5 w-3 h-3 rounded-full border-2 ${
                              isCurrent
                                ? "bg-primary border-primary ring-2 ring-primary/30"
                                : h.status === "success"
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "bg-destructive border-destructive"
                            }`}
                          />
                          <div className={`rounded-md border p-2.5 ${isCurrent ? "border-primary/50 bg-primary/5" : "border-border/40"}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">
                                  #{idx + 1}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">{h.provider}</Badge>
                                <Badge
                                  variant={h.status === "success" ? "default" : "destructive"}
                                  className="text-[10px]"
                                >
                                  {h.status}
                                </Badge>
                                {isCurrent && <Badge className="text-[10px] bg-primary/20 text-primary">attuale</Badge>}
                              </div>
                              <div className="text-[11px] text-muted-foreground tabular-nums">
                                {date.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            <div className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                              <div>
                                <span className="text-muted-foreground">Secondi:</span>{" "}
                                <span className="tabular-nums font-medium">{Number(h.seconds_billed).toFixed(1)}s</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">€/sec:</span>{" "}
                                <span className="tabular-nums font-medium">{formatEur(pps)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-muted-foreground">Costo:</span>{" "}
                                <span className="tabular-nums font-bold">{formatEur(Number(h.cost_eur))}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
