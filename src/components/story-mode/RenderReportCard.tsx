import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Download, Loader2, ClipboardCheck, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { reportToText, type RenderReport } from "@/lib/storyModeRenderReport";

interface Props {
  report: RenderReport | null;
  loading?: boolean;
  onRerun?: () => void;
}

const sevIcon = (s: "pass" | "warn" | "fail") => {
  if (s === "pass") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (s === "warn") return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
  return <XCircle className="w-3.5 h-3.5 text-red-500" />;
};

const sevTone = (s: "pass" | "warn" | "fail"): string => {
  if (s === "pass") return "border-emerald-500/30 bg-emerald-500/5";
  if (s === "warn") return "border-orange-500/30 bg-orange-500/5";
  return "border-red-500/30 bg-red-500/5";
};

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const RenderReportCard: React.FC<Props> = ({ report, loading, onRerun }) => {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="w-4 h-4" /> Test automatico audio
          </CardTitle>
          <CardDescription>
            Verifica musica, rapporto voce/SFX, headroom e clipping subito dopo il render.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          {onRerun && (
            <Button size="sm" variant="outline" onClick={onRerun} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Ri-esegui test
            </Button>
          )}
          {report && (
            <Button size="sm" variant="outline" onClick={() => downloadText(`audio-report-${new Date(report.generatedAt).toISOString().slice(0,16)}.txt`, reportToText(report))}>
              <Download className="w-3.5 h-3.5 mr-1" /> Esporta
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisi audio in corso…
          </div>
        )}

        {!loading && !report && (
          <p className="text-xs text-muted-foreground">
            Il test parte automaticamente alla fine di ogni render. Premi <strong>Ri-esegui test</strong>
            se vuoi rivalidare il file finale.
          </p>
        )}

        {report && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500">
                ✅ {report.summary.pass} OK
              </Badge>
              {report.summary.warn > 0 && (
                <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-500">
                  ⚠️ {report.summary.warn} warning
                </Badge>
              )}
              {report.summary.fail > 0 && (
                <Badge variant="outline" className="text-[10px] border-red-500/40 text-red-500">
                  ❌ {report.summary.fail} fallit{report.summary.fail === 1 ? "o" : "i"}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>

            <ul className="space-y-1">
              {report.checks.map((c) => (
                <li key={c.id} className={cn("flex items-start gap-2 px-2 py-1.5 rounded border text-[11px]", sevTone(c.severity))}>
                  <span className="mt-0.5">{sevIcon(c.severity)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{c.label}</div>
                    <div className="text-[10px] text-muted-foreground">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>

            {report.scenes.length > 0 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Misure dettagliate ({report.scenes.length} scene)
                </summary>
                <div className="mt-2 grid gap-1 font-mono text-[10px]">
                  {report.scenes.map((s) => (
                    <div key={s.sceneNumber} className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 py-1 rounded bg-muted/20">
                      <span className="text-muted-foreground">scena {s.sceneNumber}:</span>
                      {s.voice && <span>voce {s.voice.rmsDb.toFixed(1)}/{s.voice.peakDb.toFixed(1)}/{Number.isFinite(s.voice.lufs) ? s.voice.lufs.toFixed(1) : "—"}LUFS</span>}
                      {s.ambience && <span>amb {s.ambience.rmsDb.toFixed(1)}/{s.ambience.peakDb.toFixed(1)}</span>}
                      {s.sfx && <span>sfx {s.sfx.rmsDb.toFixed(1)}/{s.sfx.peakDb.toFixed(1)}</span>}
                    </div>
                  ))}
                  {report.music && (
                    <div className="flex flex-wrap gap-x-3 px-2 py-1 rounded bg-muted/20">
                      <span className="text-muted-foreground">musica:</span>
                      <span>RMS {report.music.rmsDb.toFixed(1)}</span>
                      <span>peak {report.music.peakDb.toFixed(1)}</span>
                      <span>{Number.isFinite(report.music.lufs) ? report.music.lufs.toFixed(1) : "—"} LUFS</span>
                    </div>
                  )}
                </div>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
