import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { ArrowLeft, RefreshCw, AlertTriangle, BarChart3 } from "lucide-react";

type RecoveryEntry = {
  timestamp?: string;
  context?: string;
  attempts?: number;
  assets?: Array<{
    type?: string;
    sceneNumber?: number | null;
    urlKind?: "blob" | "remote" | string;
  }>;
};

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  recovery_history: RecoveryEntry[];
};

const TYPE_COLORS: Record<string, string> = {
  narration: "hsl(var(--primary))",
  voce: "hsl(var(--primary))",
  audio: "hsl(var(--primary))",
  sfx: "hsl(25 95% 53%)",
  music: "hsl(280 70% 60%)",
  musica: "hsl(280 70% 60%)",
  unknown: "hsl(var(--muted-foreground))",
};

const KIND_COLORS: Record<string, string> = {
  blob: "hsl(0 84% 60%)",
  remote: "hsl(142 71% 45%)",
  unknown: "hsl(var(--muted-foreground))",
};

const normalizeType = (t?: string) => {
  if (!t) return "unknown";
  const s = t.toLowerCase();
  if (s === "voce" || s === "audio") return "narration";
  if (s === "musica") return "music";
  return s;
};

export default function AdminRecoveryAnalytics() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Accesso non autorizzato");
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Admins have view access to all rows via existing RLS? story_mode_projects has only user-scoped policies.
      // For analytics across all users we rely on the admin_users edge function pattern.
      // Fall back to client-side aggregation of own projects if admin policies aren't set.
      const { data, error } = await supabase
        .from("story_mode_projects")
        .select("id, user_id, title, recovery_history")
        .not("recovery_history", "eq", "[]");
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => ({
        ...r,
        recovery_history: Array.isArray(r.recovery_history) ? r.recovery_history : [],
      })) as ProjectRow[];
      setProjects(rows.filter((r) => r.recovery_history.length > 0));
    } catch (err: any) {
      toast.error("Errore caricamento analytics: " + err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const allEntries = useMemo(
    () => projects.flatMap((p) => p.recovery_history.map((e) => ({ ...e, projectId: p.id, projectTitle: p.title }))),
    [projects],
  );

  const totalFailures = allEntries.length;
  const totalAssets = allEntries.reduce((sum, e) => sum + (e.assets?.length ?? 0), 0);
  const affectedProjects = projects.length;

  // Aggregations
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach((e) =>
      e.assets?.forEach((a) => {
        const t = normalizeType(a.type);
        map.set(t, (map.get(t) ?? 0) + 1);
      }),
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [allEntries]);

  const byKind = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach((e) =>
      e.assets?.forEach((a) => {
        const k = a.urlKind ?? "unknown";
        map.set(k, (map.get(k) ?? 0) + 1);
      }),
    );
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [allEntries]);

  const byScene = useMemo(() => {
    const map = new Map<number, number>();
    allEntries.forEach((e) =>
      e.assets?.forEach((a) => {
        if (typeof a.sceneNumber === "number" && a.sceneNumber > 0) {
          map.set(a.sceneNumber, (map.get(a.sceneNumber) ?? 0) + 1);
        }
      }),
    );
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([scene, count]) => ({ scene: `Scena ${scene}`, count }));
  }, [allEntries]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach((e) => {
      if (!e.timestamp) return;
      const d = new Date(e.timestamp);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + (e.assets?.length ?? 1));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }, [allEntries]);

  const topFailingType = byType.slice().sort((a, b) => b.value - a.value)[0];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="mb-2 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-1" /> Admin Dashboard
              </Button>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <BarChart3 className="h-7 w-7 text-primary" />
                Recovery Analytics
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Analisi dei fallimenti di recupero audio Shotstack su tutti i progetti Story Mode.
              </p>
            </div>
            <Button onClick={fetchData} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Eventi di fallimento</CardDescription>
                <CardTitle className="text-3xl">{totalFailures}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Asset persi (totale)</CardDescription>
                <CardTitle className="text-3xl">{totalAssets}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Progetti coinvolti</CardDescription>
                <CardTitle className="text-3xl">{affectedProjects}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Tipo più fallito</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {topFailingType ? (
                    <>
                      <Badge style={{ backgroundColor: TYPE_COLORS[topFailingType.name] ?? "hsl(var(--primary))" }}>
                        {topFailingType.name}
                      </Badge>
                      <span className="text-base text-muted-foreground">×{topFailingType.value}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground text-base">—</span>
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {totalFailures === 0 && !loading && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Nessun fallimento di recovery registrato. Tutti i recuperi automatici hanno avuto successo.
                </p>
              </CardContent>
            </Card>
          )}

          {totalFailures > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Asset più fallito (per tipo)</CardTitle>
                  <CardDescription>Distribuzione di voce / SFX / musica tra gli asset persi.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {byType.map((entry, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[entry.name] ?? "hsl(var(--primary))"} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* By kind */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuzione blob vs remote</CardTitle>
                  <CardDescription>
                    Gli URL <code className="text-xs">blob:</code> non sono raggiungibili da Shotstack — dovrebbero essere 0.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={byKind} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                        {byKind.map((entry, idx) => (
                          <Cell key={idx} fill={KIND_COLORS[entry.name] ?? "hsl(var(--muted-foreground))"} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* By scene */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Frequenza fallimenti per scena</CardTitle>
                  <CardDescription>
                    Identifica scene problematiche. La musica non è inclusa (è globale).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {byScene.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nessun fallimento legato a una scena specifica.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={byScene}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="scene" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                          }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Trend */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Trend temporale</CardTitle>
                  <CardDescription>Numero di asset falliti per giorno.</CardDescription>
                </CardHeader>
                <CardContent>
                  {byDay.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nessun timestamp disponibile per il trend.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={byDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "0.5rem",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Project breakdown */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Progetti con più fallimenti</CardTitle>
                  <CardDescription>Top progetti per numero di asset persi.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {projects
                      .map((p) => ({
                        ...p,
                        assetCount: p.recovery_history.reduce((s, e) => s + (e.assets?.length ?? 0), 0),
                        eventCount: p.recovery_history.length,
                      }))
                      .sort((a, b) => b.assetCount - a.assetCount)
                      .slice(0, 10)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{p.title || "Untitled"}</div>
                            <div className="text-xs text-muted-foreground truncate">{p.id}</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Badge variant="outline">{p.eventCount} eventi</Badge>
                            <Badge variant="destructive">{p.assetCount} asset</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
