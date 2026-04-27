import { useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Wallet, TrendingUp, AlertTriangle, Save } from "lucide-react";
import { formatEur, getPricePerSecond } from "@/lib/videoCostEstimator";
import { getCostAlertThreshold, setCostAlertThreshold } from "@/lib/costAlertThreshold";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { SceneCostDetailDialog } from "@/components/costs/SceneCostDetailDialog";

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

interface ProjectOption {
  id: string;
  title: string;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(270, 60%, 55%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(180, 60%, 45%)",
  "hsl(320, 70%, 55%)",
];

const Costs = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CostRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [threshold, setThresholdState] = useState<number>(getCostAlertThreshold());
  const [detailRow, setDetailRow] = useState<CostRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [{ data: costs }, { data: projs }] = await Promise.all([
          supabase
            .from("video_cost_log")
            .select("id, provider, seconds_billed, cost_eur, story_project_id, scene_index, status, created_at, metadata")
            .eq("user_id", user.id)
            .gte("created_at", startOfMonth.toISOString())
            .order("created_at", { ascending: false })
            .limit(1000),
          supabase
            .from("story_mode_projects")
            .select("id, title")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(200),
        ]);

        if (!mounted) return;
        setRows((costs as CostRow[]) ?? []);
        setProjects((projs as ProjectOption[]) ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Errore nel caricamento dei costi");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    if (projectFilter === "all") return rows;
    if (projectFilter === "none") return rows.filter(r => !r.story_project_id);
    return rows.filter(r => r.story_project_id === projectFilter);
  }, [rows, projectFilter]);

  const totals = useMemo(() => {
    const totalEur = filtered.reduce((s, r) => s + Number(r.cost_eur || 0), 0);
    const totalSec = filtered.reduce((s, r) => s + Number(r.seconds_billed || 0), 0);
    const generations = filtered.length;
    return {
      totalEur: +totalEur.toFixed(2),
      totalSec: +totalSec.toFixed(1),
      generations,
      avgPerGen: generations ? +(totalEur / generations).toFixed(2) : 0,
    };
  }, [filtered]);

  const byProvider = useMemo(() => {
    const map = new Map<string, { provider: string; cost: number; seconds: number; count: number }>();
    for (const r of filtered) {
      const key = r.provider || "unknown";
      const cur = map.get(key) ?? { provider: key, cost: 0, seconds: 0, count: 0 };
      cur.cost += Number(r.cost_eur || 0);
      cur.seconds += Number(r.seconds_billed || 0);
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map(v => ({ ...v, cost: +v.cost.toFixed(2), seconds: +v.seconds.toFixed(1) }))
      .sort((a, b) => b.cost - a.cost);
  }, [filtered]);

  const topScenes = useMemo(() => {
    return [...filtered]
      .sort((a, b) => Number(b.cost_eur) - Number(a.cost_eur))
      .slice(0, 10);
  }, [filtered]);

  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of projects) m.set(p.id, p.title);
    return m;
  }, [projects]);

  const overThreshold = totals.totalEur > threshold;
  const cheapestProvider = useMemo(() => {
    // Selezioniamo il provider più economico tra quelli usati
    if (!byProvider.length) return null;
    const candidates = byProvider
      .map(p => ({ ...p, pps: getPricePerSecond(p.provider) }))
      .sort((a, b) => a.pps - b.pps);
    return candidates[0] ?? null;
  }, [byProvider]);

  const saveThreshold = () => {
    setCostAlertThreshold(threshold);
    toast.success(`Soglia avviso impostata a ${formatEur(threshold)}`);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Wallet className="w-7 h-7 text-primary" />
              Costi generazione video
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Riepilogo del mese corrente. I dati riguardano solo le generazioni tracciate via Story Mode.
            </p>
          </header>

          {/* Filtri + soglia */}
          <Card className="mb-6 bg-card/50 border-border/50">
            <CardContent className="pt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Filtra per progetto</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti i progetti" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i progetti</SelectItem>
                    <SelectItem value="none">Senza progetto associato</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Soglia avviso costo per progetto (EUR)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={threshold}
                    onChange={(e) => setThresholdState(Number(e.target.value) || 0)}
                  />
                  <Button onClick={saveThreshold} variant="secondary">
                    <Save className="w-4 h-4 mr-2" /> Salva
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Avvisa in Story Mode quando la stima di un progetto supera questa soglia.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* KPI */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardDescription>Spesa mese corrente</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatEur(totals.totalEur)}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardDescription>Secondi generati</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{totals.totalSec}s</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardDescription>Generazioni</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{totals.generations}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardDescription>Media per generazione</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatEur(totals.avgPerGen)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Avviso soglia */}
          {overThreshold && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Spesa sopra la soglia ({formatEur(threshold)})</AlertTitle>
              <AlertDescription>
                Hai superato la soglia di avviso. Per ridurre i costi:
                <ul className="list-disc list-inside mt-2 space-y-0.5">
                  <li>Usa <strong>Luma Ray Flash 2</strong> (€0,03/s) o <strong>Pixverse v5</strong> (€0,04/s) per scene non chiave.</li>
                  <li>Riduci la durata delle scene da 10s a 5–8s dove possibile.</li>
                  <li>Riserva VEO/Sora Pro solo per le scene più importanti.</li>
                  {cheapestProvider && cheapestProvider.provider !== "unknown" && (
                    <li>
                      Il provider più economico che hai già usato è{" "}
                      <strong>{cheapestProvider.provider}</strong> ({formatEur(cheapestProvider.pps)}/s).
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Spesa per provider */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Spesa per provider
                  </CardTitle>
                  <CardDescription>Top provider del mese</CardDescription>
                </CardHeader>
                <CardContent>
                  {byProvider.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato per questo filtro.</p>
                  ) : (
                    <>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={byProvider.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="provider" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-25} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                            <ReTooltip
                              formatter={(v: number, name: string) => [
                                name === "cost" ? formatEur(v) : v,
                                name === "cost" ? "Costo" : name,
                              ]}
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                            />
                            <Bar dataKey="cost" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 space-y-1">
                        {byProvider.slice(0, 5).map((p, idx) => (
                          <div key={p.provider} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: COLORS[idx % COLORS.length] }}
                              />
                              {p.provider}
                              <Badge variant="outline" className="text-[10px] py-0 h-4">{p.count}x</Badge>
                            </span>
                            <span className="tabular-nums font-medium">{formatEur(p.cost)} · {p.seconds}s</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Pie distribuzione */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Distribuzione spesa</CardTitle>
                  <CardDescription>% per provider</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {byProvider.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nessun dato.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={byProvider.slice(0, 7)}
                          dataKey="cost"
                          nameKey="provider"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={85}
                          paddingAngle={3}
                          label={({ provider, percent }) => `${provider}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {byProvider.slice(0, 7).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip
                          formatter={(v: number) => formatEur(v)}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top scene costose */}
              <Card className="bg-card/50 border-border/50 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Top 10 scene più costose</CardTitle>
                  <CardDescription>Singole generazioni con il costo più alto</CardDescription>
                </CardHeader>
                <CardContent>
                  {topScenes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Nessuna generazione registrata.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Progetto</TableHead>
                          <TableHead>Scena</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead className="text-right">Secondi</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topScenes.map(s => (
                          <TableRow
                            key={s.id}
                            className="cursor-pointer hover:bg-accent/40"
                            onClick={() => { setDetailRow(s); setDetailOpen(true); }}
                          >
                            <TableCell className="text-xs">
                              {new Date(s.created_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">
                              {s.story_project_id ? (projectTitleById.get(s.story_project_id) ?? <span className="text-muted-foreground">— eliminato —</span>) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-xs">{s.scene_index !== null ? `#${s.scene_index + 1}` : "—"}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{s.provider}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums text-xs">{Number(s.seconds_billed).toFixed(1)}s</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{formatEur(Number(s.cost_eur))}</TableCell>
                            <TableCell>
                              <Badge
                                variant={s.status === "success" ? "default" : "destructive"}
                                className="text-[10px]"
                              >
                                {s.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
};

export default Costs;
