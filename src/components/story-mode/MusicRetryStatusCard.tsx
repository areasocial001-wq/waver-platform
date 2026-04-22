import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, History, RotateCcw, CheckCircle2, AlertTriangle, XCircle, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { stageLabel, stageTone, type MusicRetryLog } from "@/lib/musicRetryLog";

interface Props {
  log: MusicRetryLog;
  onManualRetry?: () => void;
  onClear?: () => void;
  busy?: boolean;
}

const toneClass = (t: ReturnType<typeof stageTone>): string => {
  switch (t) {
    case "ok": return "text-emerald-500 border-emerald-500/40 bg-emerald-500/10";
    case "warn": return "text-orange-500 border-orange-500/40 bg-orange-500/10";
    case "error": return "text-red-500 border-red-500/40 bg-red-500/10";
    case "info": return "text-muted-foreground border-border bg-muted/30";
  }
};

const toneIcon = (t: ReturnType<typeof stageTone>) => {
  switch (t) {
    case "ok": return <CheckCircle2 className="w-3.5 h-3.5" />;
    case "warn": return <AlertTriangle className="w-3.5 h-3.5" />;
    case "error": return <XCircle className="w-3.5 h-3.5" />;
    case "info": return <Info className="w-3.5 h-3.5" />;
  }
};

const fmtTime = (ts: number) => {
  try { return new Date(ts).toLocaleTimeString(undefined, { hour12: false }); }
  catch { return ""; }
};

export const MusicRetryStatusCard: React.FC<Props> = ({ log, onManualRetry, onClear, busy }) => {
  const last = log.entries[log.entries.length - 1];
  const overall = log.lastAudible === true ? "ok" : log.lastAudible === false ? "warn" : "info";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="w-4 h-4" /> Stato retry musica
          </CardTitle>
          <CardDescription>
            Cronologia delle verifiche e dei tentativi di rigenerazione della colonna sonora per
            questo progetto.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {onManualRetry && (
            <Button size="sm" variant="outline" onClick={onManualRetry} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
              Retry musica
            </Button>
          )}
          {onClear && log.entries.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
              Pulisci
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", toneClass(overall))}>
            {toneIcon(overall)}
            <span className="ml-1">
              {log.lastAudible === true && "Musica presente nel render"}
              {log.lastAudible === false && "Musica mancante"}
              {log.lastAudible === null && "Nessuna verifica eseguita"}
            </span>
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            <History className="w-3 h-3 mr-1" /> {log.attempts} tentativ{log.attempts === 1 ? "o" : "i"}
          </Badge>
          {last && (
            <span className="text-[10px] text-muted-foreground font-mono">
              ultimo evento: {fmtTime(last.ts)}
            </span>
          )}
        </div>

        {log.entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nessun evento ancora. Dopo ogni render il sistema verifica la musica e registra qui i
            risultati.
          </p>
        ) : (
          <ol className="space-y-1 max-h-60 overflow-y-auto pr-1">
            {[...log.entries].reverse().map((e, i) => {
              const tone = stageTone(e.stage);
              return (
                <li key={i} className={cn("flex items-start gap-2 px-2 py-1.5 rounded border text-[11px]", toneClass(tone))}>
                  <span className="mt-0.5">{toneIcon(tone)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{stageLabel(e.stage)}</span>
                      {typeof e.attempt === "number" && (
                        <span className="font-mono text-[10px] opacity-70">#{e.attempt + 1}</span>
                      )}
                      <span className="font-mono text-[10px] opacity-70">{fmtTime(e.ts)}</span>
                    </div>
                    {(e.note || typeof e.sizeBytes === "number") && (
                      <div className="text-[10px] opacity-80 truncate">
                        {e.note}
                        {typeof e.sizeBytes === "number" && (
                          <> · {(e.sizeBytes / 1024).toFixed(0)} KB</>
                        )}
                        {e.contentType && <> · {e.contentType}</>}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
};
