import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Database, RefreshCw, Clock, AlertTriangle, CheckCircle2, HardDrive, Activity, Loader2, Wrench, Hammer, History as HistoryIcon, Play } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TableStat {
  name: string;
  total_size_bytes: number;
  total_size_pretty: string;
  table_size_pretty: string;
  live_rows: number;
  dead_rows: number;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
}

interface CronJob {
  jobname: string;
  schedule: string;
  active: boolean;
  last_run: string | null;
  last_status: string | null;
}

interface UnusedIndex {
  index: string;
  table: string;
  size_pretty: string;
}

interface DbHealthStats {
  db_size_bytes: number;
  db_size_pretty: string;
  tables: TableStat[];
  unused_indexes: UnusedIndex[];
  cron_jobs: CronJob[];
}

interface SnapshotRow {
  recorded_at: string;
  db_size_bytes: number;
  total_rows: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const DbHealthDashboard = () => {
  const [stats, setStats] = useState<DbHealthStats | null>(null);
  const [history, setHistory] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vacuuming, setVacuuming] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [maintenanceResult, setMaintenanceResult] = useState<any>(null);
  const [maintenanceLog, setMaintenanceLog] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, historyRes, logRes] = await Promise.all([
        supabase.rpc("get_db_health_stats" as any),
        supabase
          .from("db_health_snapshots" as any)
          .select("recorded_at, db_size_bytes, total_rows")
          .order("recorded_at", { ascending: true })
          .limit(90),
        supabase
          .from("maintenance_log" as any)
          .select("id, operation, status, triggered_by, tables_processed, total_freed_bytes, duration_ms, created_at")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      if (statsRes.error) throw statsRes.error;
      if (historyRes.error) throw historyRes.error;

      setStats(statsRes.data as unknown as DbHealthStats);
      setHistory((historyRes.data as unknown as SnapshotRow[]) || []);
      setMaintenanceLog((logRes.data as any[]) || []);
    } catch (err: any) {
      console.error("DB health load error:", err);
      toast.error(err.message || "Errore nel caricamento delle statistiche");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSnapshot = async () => {
    try {
      const { error } = await supabase.rpc("record_db_health_snapshot" as any);
      if (error) throw error;
      toast.success("Snapshot registrato");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Errore nel salvataggio dello snapshot");
    }
  };

  const handleVacuum = async () => {
    setVacuuming(true);
    setMaintenanceResult(null);
    try {
      const { data, error } = await supabase.rpc("run_db_maintenance" as any);
      if (error) throw error;
      const result = data as any;
      setMaintenanceResult(result);
      toast.success(
        `Manutenzione completata: ${result.tables_processed} tabelle, liberati ${result.total_freed_pretty}`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Errore durante la manutenzione");
    } finally {
      setVacuuming(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setMaintenanceResult(null);
    try {
      const { data, error } = await supabase.rpc("run_db_reindex" as any);
      if (error) throw error;
      const result = data as any;
      setMaintenanceResult({ ...result, operation: "reindex" });
      toast.success(
        `REINDEX completato: ${result.tables_processed} tabelle, liberati ${result.total_freed_pretty}`
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Errore durante il REINDEX");
    } finally {
      setReindexing(false);
    }
  };

  const handleRunCron = async (jobname: string) => {
    setRunningCron(true);
    try {
      const { error } = await supabase.rpc("run_scheduled_maintenance" as any);
      if (error) throw error;
      toast.success(`Job "${jobname}" eseguito manualmente`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Errore durante l'esecuzione del job");
    } finally {
      setRunningCron(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const chartData = history.map(s => ({
    date: new Date(s.recorded_at).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
    sizeMB: +(s.db_size_bytes / 1024 / 1024).toFixed(2),
    rows: s.total_rows,
  }));

  const topTables = stats.tables.slice(0, 10);
  const heaviestSeqScan = [...stats.tables]
    .filter(t => t.seq_tup_read > 10000)
    .sort((a, b) => b.seq_tup_read - a.seq_tup_read)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" />
            Salute Database
          </h2>
          <p className="text-sm text-muted-foreground">Monitoraggio in tempo reale</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={vacuuming}>
                {vacuuming ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wrench className="h-4 w-4 mr-1" />}
                {vacuuming ? "Manutenzione..." : "VACUUM/ANALYZE"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eseguire manutenzione database?</AlertDialogTitle>
                <AlertDialogDescription>
                  Verrà eseguito <code>VACUUM ANALYZE</code> sulle tabelle pubbliche più pesanti per liberare dead tuples e aggiornare le statistiche del query planner. L'operazione può richiedere alcuni secondi e blocca temporaneamente le scritture sulle tabelle interessate.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleVacuum}>Esegui</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={reindexing}>
                {reindexing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Hammer className="h-4 w-4 mr-1" />}
                {reindexing ? "Reindex..." : "REINDEX"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ricostruire gli indici?</AlertDialogTitle>
                <AlertDialogDescription>
                  Verrà eseguito <code>REINDEX TABLE</code> sulle 10 tabelle pubbliche più usate per ricostruire indici frammentati. L'operazione può bloccare le scritture per alcuni secondi per tabella.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleReindex}>Esegui</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={handleSnapshot}>
            <Activity className="h-4 w-4 mr-1" /> Snapshot
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} /> Aggiorna
          </Button>
        </div>
      </div>

      {/* Maintenance result */}
      {maintenanceResult && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Manutenzione completata
            </CardTitle>
            <CardDescription>
              {maintenanceResult.tables_processed} tabelle processate · spazio liberato: <strong>{maintenanceResult.total_freed_pretty}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 max-h-48 overflow-y-auto text-sm">
              {(maintenanceResult.results || []).map((r: any) => (
                <div key={r.table} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/30">
                  <span className="font-mono text-xs">{r.table}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.size_before} → {r.size_after}</span>
                    <Badge variant="outline" className="text-xs">{r.duration_ms}ms</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <HardDrive className="h-4 w-4" /> Dimensione DB
            </CardDescription>
            <CardTitle className="text-3xl">{stats.db_size_pretty}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Database className="h-4 w-4" /> Tabelle pubbliche
            </CardDescription>
            <CardTitle className="text-3xl">{stats.tables.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> Cron jobs attivi
            </CardDescription>
            <CardTitle className="text-3xl">
              {stats.cron_jobs.filter(j => j.active).length} / {stats.cron_jobs.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Historical chart */}
      <Card>
        <CardHeader>
          <CardTitle>Crescita storica</CardTitle>
          <CardDescription>Ultimi {chartData.length} snapshot</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length < 2 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Servono almeno 2 snapshot per visualizzare il grafico. Il prossimo verrà registrato automaticamente domani alle 04:00 UTC.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="sizeMB" stroke="hsl(var(--primary))" name="Dimensione (MB)" />
                <Line yAxisId="right" type="monotone" dataKey="rows" stroke="hsl(var(--accent))" name="Righe totali" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top tables by size */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 tabelle per dimensione</CardTitle>
          <CardDescription>Include indici e toast storage</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tabella</TableHead>
                <TableHead className="text-right">Dim. totale</TableHead>
                <TableHead className="text-right">Solo dati</TableHead>
                <TableHead className="text-right">Righe</TableHead>
                <TableHead className="text-right">Seq scan</TableHead>
                <TableHead className="text-right">Idx scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topTables.map(t => (
                <TableRow key={t.name}>
                  <TableCell className="font-mono text-sm">{t.name}</TableCell>
                  <TableCell className="text-right">{t.total_size_pretty}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.table_size_pretty}</TableCell>
                  <TableCell className="text-right">{t.live_rows.toLocaleString("it-IT")}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn(t.seq_tup_read > 100000 && "text-destructive font-semibold")}>
                      {t.seq_scan.toLocaleString("it-IT")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.idx_scan.toLocaleString("it-IT")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Slow queries / heavy seq scans */}
      {heaviestSeqScan.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Tabelle con scansioni sequenziali pesanti
            </CardTitle>
            <CardDescription>Considera di aggiungere indici su queste tabelle</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {heaviestSeqScan.map(t => (
                <div key={t.name} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <span className="font-mono text-sm">{t.name}</span>
                  <Badge variant="destructive">
                    {(t.seq_tup_read / 1000).toFixed(0)}k tuple lette
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cron jobs status */}
      <Card>
        <CardHeader>
          <CardTitle>Cron jobs</CardTitle>
          <CardDescription>Pulizia e manutenzione automatiche</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.cron_jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun cron job configurato</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Ultima esecuzione</TableHead>
                  <TableHead>Esito</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.cron_jobs.map(j => (
                  <TableRow key={j.jobname}>
                    <TableCell className="font-mono text-sm">{j.jobname}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{j.schedule}</TableCell>
                    <TableCell>
                      {j.active ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Attivo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Disattivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {j.last_run ? new Date(j.last_run).toLocaleString("it-IT") : "Mai"}
                    </TableCell>
                    <TableCell>
                      {j.last_status === "succeeded" ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30">OK</Badge>
                      ) : j.last_status ? (
                        <Badge variant="destructive">{j.last_status}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {j.jobname === "weekly-vacuum-analyze" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRunCron(j.jobname)}
                          disabled={runningCron}
                          className="h-7"
                        >
                          {runningCron ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Play className="h-3 w-3 mr-1" /> Esegui ora</>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unused indexes */}
      {stats.unused_indexes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Indici inutilizzati</CardTitle>
            <CardDescription>Indici mai usati che occupano spazio — valuta se rimuoverli</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-1 max-h-64 overflow-y-auto">
              {stats.unused_indexes.map(i => (
                <div key={i.index} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-muted/30">
                  <span className="font-mono text-xs">{i.index}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">su {i.table}</span>
                    <Badge variant="outline" className="text-xs">{i.size_pretty}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5" />
            Storico manutenzioni
          </CardTitle>
          <CardDescription>
            Operazioni VACUUM/REINDEX (manuali e automatiche). Job settimanale: domenica 05:00 UTC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {maintenanceLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nessuna operazione registrata. Esegui un VACUUM o REINDEX per iniziare.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Operazione</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead className="text-right">Tabelle</TableHead>
                  <TableHead className="text-right">Liberati</TableHead>
                  <TableHead className="text-right">Durata</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceLog.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("it-IT")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{l.operation}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.triggered_by?.startsWith("cron") ? "secondary" : "default"} className="text-xs">
                        {l.triggered_by?.startsWith("cron") ? "Auto" : "Manuale"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{l.tables_processed}</TableCell>
                    <TableCell className="text-right text-xs">{formatBytes(l.total_freed_bytes || 0)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {(l.duration_ms / 1000).toFixed(1)}s
                    </TableCell>
                    <TableCell>
                      {l.status === "success" ? (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 text-xs">OK</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">{l.status}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
