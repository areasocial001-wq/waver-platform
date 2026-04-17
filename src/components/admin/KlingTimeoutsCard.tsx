import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, RefreshCw, Clock, Mail, User, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Plan priority for sorting/badge styling — higher = more important customer
const PLAN_PRIORITY: Record<string, number> = {
  business: 5,
  creator: 4,
  premium: 3,
  moderator: 2,
  admin: 1,
  user: 0,
};

const planBadgeVariant = (plan: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!plan) return "outline";
  if (plan === "business" || plan === "creator" || plan === "premium") return "default";
  if (plan === "admin" || plan === "moderator") return "secondary";
  return "outline";
};

const pickTopPlan = (roles: string[]): string | null => {
  if (!roles.length) return null;
  return [...roles].sort((a, b) => (PLAN_PRIORITY[b] ?? 0) - (PLAN_PRIORITY[a] ?? 0))[0];
};

interface TimeoutLog {
  id: string;
  created_at: string;
  message: string;
  details: any;
  user_id: string;
}

interface OperationStat {
  operationId: string;
  count: number;
  avgDurationMs: number;
  lastSeen: string;
}

interface UserStat {
  userId: string;
  email: string | null;
  fullName: string | null;
  plan: string | null;
  count: number;
  avgDurationMs: number;
  lastSeen: string;
}

export const KlingTimeoutsCard = () => {
  const [logs, setLogs] = useState<TimeoutLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { email: string | null; full_name: string | null }>>({});
  const [userPlans, setUserPlans] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [minTimeouts, setMinTimeouts] = useState(1);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("api_logs")
        .select("id, created_at, message, details, user_id")
        .eq("api_name", "Kling")
        .eq("operation", "video_timeout")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data as TimeoutLog[]) || [];
      setLogs(list);

      // Fetch profiles + roles for all user_ids in the timeout logs (admins can read all)
      const uniqueUserIds = Array.from(new Set(list.map(l => l.user_id).filter(Boolean)));
      if (uniqueUserIds.length > 0) {
        const [{ data: profs }, { data: roles }] = await Promise.all([
          supabase.from("profiles").select("id, email, full_name").in("id", uniqueUserIds),
          supabase.from("user_roles").select("user_id, role").in("user_id", uniqueUserIds),
        ]);
        const map: Record<string, { email: string | null; full_name: string | null }> = {};
        (profs || []).forEach(p => { map[p.id] = { email: p.email, full_name: p.full_name }; });
        setProfiles(map);

        // Aggregate roles per user → keep highest-priority plan
        const rolesByUser = new Map<string, string[]>();
        (roles || []).forEach(r => {
          const arr = rolesByUser.get(r.user_id) || [];
          arr.push(r.role as string);
          rolesByUser.set(r.user_id, arr);
        });
        const planMap: Record<string, string | null> = {};
        uniqueUserIds.forEach(uid => {
          planMap[uid] = pickTopPlan(rolesByUser.get(uid) || []);
        });
        setUserPlans(planMap);
      } else {
        setProfiles({});
        setUserPlans({});
      }
    } catch (err: any) {
      toast.error(`Errore caricamento timeout: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Aggregate stats
  const totalCount = logs.length;
  const durations = logs
    .map(l => Number(l.details?.totalDurationMs))
    .filter(n => Number.isFinite(n) && n > 0);
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Top operationIds
  const opMap = new Map<string, OperationStat>();
  for (const l of logs) {
    const opId = l.details?.operationId;
    if (!opId) continue;
    const existing = opMap.get(opId);
    const dur = Number(l.details?.totalDurationMs) || 0;
    if (existing) {
      existing.count += 1;
      existing.avgDurationMs = Math.round(
        (existing.avgDurationMs * (existing.count - 1) + dur) / existing.count
      );
      if (l.created_at > existing.lastSeen) existing.lastSeen = l.created_at;
    } else {
      opMap.set(opId, {
        operationId: opId,
        count: 1,
        avgDurationMs: dur,
        lastSeen: l.created_at,
      });
    }
  }
  const topOps = Array.from(opMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Daily breakdown
  const dailyMap = new Map<string, number>();
  for (const l of logs) {
    const day = l.created_at.slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
  }
  const dailyEntries = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  // Top users impacted
  const userMap = new Map<string, UserStat>();
  for (const l of logs) {
    if (!l.user_id) continue;
    const dur = Number(l.details?.totalDurationMs) || 0;
    const existing = userMap.get(l.user_id);
    if (existing) {
      existing.count += 1;
      existing.avgDurationMs = Math.round(
        (existing.avgDurationMs * (existing.count - 1) + dur) / existing.count
      );
      if (l.created_at > existing.lastSeen) existing.lastSeen = l.created_at;
    } else {
      const p = profiles[l.user_id];
      userMap.set(l.user_id, {
        userId: l.user_id,
        email: p?.email ?? null,
        fullName: p?.full_name ?? null,
        count: 1,
        avgDurationMs: dur,
        lastSeen: l.created_at,
      });
    }
  }
  const topUsers = Array.from(userMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);

  const formatMs = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s}s`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Timeout Kling ricorrenti
            </CardTitle>
            <CardDescription>
              Aggregato dei timeout 12 minuti su generazione video (ultimi 7 giorni)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Timeout totali</p>
            <p className="text-2xl font-bold">{totalCount}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Durata media
            </p>
            <p className="text-2xl font-bold">{avgDurationMs ? formatMs(avgDurationMs) : "—"}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">Op. uniche</p>
            <p className="text-2xl font-bold">{opMap.size}</p>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> Utenti impattati
            </p>
            <p className="text-2xl font-bold">{userMap.size}</p>
          </div>
        </div>

        {totalCount === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            ✅ Nessun timeout registrato negli ultimi 7 giorni. Kling sta rispondendo nei tempi.
          </div>
        ) : (
          <>
            {/* Daily breakdown */}
            {dailyEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Distribuzione giornaliera</h4>
                <div className="flex items-end gap-1 h-20">
                  {dailyEntries.slice(0, 7).reverse().map(([day, count]) => {
                    const max = Math.max(...dailyEntries.map(([, c]) => c));
                    const heightPct = max ? (count / max) * 100 : 0;
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-[10px] font-mono text-muted-foreground">{count}</div>
                        <div
                          className="w-full bg-amber-500/70 rounded-t"
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                          title={`${day}: ${count} timeout`}
                        />
                        <div className="text-[9px] text-muted-foreground">{day.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top operationIds */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Top operationId con più timeout</h4>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OperationId</TableHead>
                      <TableHead className="text-right">Timeout</TableHead>
                      <TableHead className="text-right">Durata media</TableHead>
                      <TableHead>Ultimo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topOps.map(op => (
                      <TableRow key={op.operationId}>
                        <TableCell className="font-mono text-xs max-w-[280px] truncate" title={op.operationId}>
                          {op.operationId}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={op.count > 1 ? "destructive" : "secondary"}>{op.count}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatMs(op.avgDurationMs)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(op.lastSeen).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {topOps.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Nessun operationId nei dettagli dei log.
                </p>
              )}
            </div>

            {/* Top users impacted */}
            {topUsers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <User className="h-4 w-4" /> Top utenti impattati
                </h4>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Utente</TableHead>
                        <TableHead className="text-right">Timeout</TableHead>
                        <TableHead className="text-right">Durata media</TableHead>
                        <TableHead>Ultimo</TableHead>
                        <TableHead className="text-right">Azione</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topUsers.map(u => (
                        <TableRow key={u.userId}>
                          <TableCell className="text-xs max-w-[260px]">
                            <div className="flex flex-col">
                              <span className="font-medium truncate" title={u.email || u.userId}>
                                {u.email || <span className="text-muted-foreground italic">email non disponibile</span>}
                              </span>
                              {u.fullName && (
                                <span className="text-muted-foreground truncate">{u.fullName}</span>
                              )}
                              <span className="font-mono text-[10px] text-muted-foreground/70 truncate">
                                {u.userId.slice(0, 8)}…
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={u.count > 2 ? "destructive" : u.count > 1 ? "default" : "secondary"}>
                              {u.count}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">{formatMs(u.avgDurationMs)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.lastSeen).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}
                          </TableCell>
                          <TableCell className="text-right">
                            {u.email ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-7 px-2"
                                title={`Contatta ${u.email}`}
                              >
                                <a href={`mailto:${u.email}?subject=${encodeURIComponent("Problema generazione video Story Mode")}&body=${encodeURIComponent(`Ciao,\n\nabbiamo notato che hai riscontrato ${u.count} timeout durante la generazione video negli ultimi 7 giorni.\n\n`)}`}>
                                  <Mail className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {totalCount >= 5 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  ⚠️ Soglia critica raggiunta
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {totalCount} timeout in 7 giorni (durata media {formatMs(avgDurationMs)}). Valuta di
                  cambiare provider video o aumentare il timeout.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
