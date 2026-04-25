import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { DollarSign, TrendingUp, TrendingDown, Activity, Users } from "lucide-react";

// Estimated average API cost per video generation by provider (in EUR)
const PROVIDER_COSTS: Record<string, number> = {
  aiml: 0.08,
  piapi: 0.12,
  luma: 0.15,
  vidu: 0.10,
  ltx: 0.06,
  freepik: 0.05,
  replicate: 0.14,
  elevenlabs: 0.03,
  default: 0.10,
};

const PLAN_PRICES: Record<string, { monthly: number; label: string }> = {
  free: { monthly: 0, label: "Free" },
  user: { monthly: 0, label: "Free" },
  premium: { monthly: 29.90, label: "Premium" },
  creator: { monthly: 49.90, label: "Creator" },
  business: { monthly: 79.90, label: "Business" },
};

interface UserCostData {
  user_id: string;
  email: string;
  role: string;
  total_generations: number;
  estimated_cost: number;
  revenue: number;
  margin: number;
  margin_pct: number;
}

interface PlanSummary {
  plan: string;
  label: string;
  users: number;
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  avgCostPerUser: number;
}

export function CostMarginDashboard() {
  const [userCosts, setUserCosts] = useState<UserCostData[]>([]);
  const [planSummaries, setPlanSummaries] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ revenue: 0, cost: 0, margin: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all users with roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email");

      // Get video generations from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: generations } = await supabase
        .from("video_generations")
        .select("user_id, provider, status")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .in("status", ["completed", "processing", "pending"]);

      // Build user map
      const profileMap = new Map<string, string>();
      (profilesData || []).forEach((p) => profileMap.set(p.id, p.email || "N/A"));

      // Get highest role per user
      const userRoleMap = new Map<string, string>();
      const roleHierarchy = ["business", "creator", "premium", "moderator", "user"];
      (rolesData || []).forEach((r) => {
        const current = userRoleMap.get(r.user_id);
        if (!current || roleHierarchy.indexOf(r.role) < roleHierarchy.indexOf(current)) {
          userRoleMap.set(r.user_id, r.role);
        }
      });

      // Calculate costs per user
      const userGenMap = new Map<string, { count: number; cost: number }>();
      (generations || []).forEach((g) => {
        const existing = userGenMap.get(g.user_id) || { count: 0, cost: 0 };
        const providerCost = PROVIDER_COSTS[g.provider || "default"] || PROVIDER_COSTS.default;
        existing.count += 1;
        existing.cost += providerCost;
        userGenMap.set(g.user_id, existing);
      });

      // Build user cost data
      const allUserIds = new Set([...userRoleMap.keys(), ...userGenMap.keys()]);
      const userData: UserCostData[] = [];

      allUserIds.forEach((userId) => {
        const role = userRoleMap.get(userId) || "user";
        const genData = userGenMap.get(userId) || { count: 0, cost: 0 };
        const planPrice = PLAN_PRICES[role] || PLAN_PRICES.user;
        const revenue = planPrice.monthly;
        const margin = revenue - genData.cost;
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : genData.cost > 0 ? -100 : 0;

        userData.push({
          user_id: userId,
          email: profileMap.get(userId) || "N/A",
          role,
          total_generations: genData.count,
          estimated_cost: genData.cost,
          revenue,
          margin,
          margin_pct: marginPct,
        });
      });

      // Sort by cost descending
      userData.sort((a, b) => b.estimated_cost - a.estimated_cost);
      setUserCosts(userData);

      // Build plan summaries
      const planMap = new Map<string, { users: number; revenue: number; cost: number }>();
      userData.forEach((u) => {
        const key = u.role;
        const existing = planMap.get(key) || { users: 0, revenue: 0, cost: 0 };
        existing.users += 1;
        existing.revenue += u.revenue;
        existing.cost += u.estimated_cost;
        planMap.set(key, existing);
      });

      const summaries: PlanSummary[] = [];
      planMap.forEach((data, plan) => {
        const margin = data.revenue - data.cost;
        summaries.push({
          plan,
          label: PLAN_PRICES[plan]?.label || plan,
          users: data.users,
          totalRevenue: data.revenue,
          totalCost: data.cost,
          margin,
          marginPct: data.revenue > 0 ? (margin / data.revenue) * 100 : data.cost > 0 ? -100 : 0,
          avgCostPerUser: data.users > 0 ? data.cost / data.users : 0,
        });
      });

      // Sort by plan hierarchy
      const planOrder = ["free", "user", "premium", "creator", "business", "admin"];
      summaries.sort((a, b) => planOrder.indexOf(a.plan) - planOrder.indexOf(b.plan));
      setPlanSummaries(summaries);

      const totalRevenue = userData.reduce((s, u) => s + u.revenue, 0);
      const totalCost = userData.reduce((s, u) => s + u.estimated_cost, 0);
      setTotals({ revenue: totalRevenue, cost: totalCost, margin: totalRevenue - totalCost });
    } catch (err) {
      console.error("Error fetching cost data:", err);
    }
    setLoading(false);
  };

  const formatEur = (v: number) => `€${v.toFixed(2)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Ricavi Mensili</CardDescription>
            <CardTitle className="text-2xl text-primary">{formatEur(totals.revenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Activity className="h-3 w-3" /> Costi API Stimati</CardDescription>
            <CardTitle className="text-2xl text-destructive">{formatEur(totals.cost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              {totals.margin >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              Margine Netto
            </CardDescription>
            <CardTitle className={`text-2xl ${totals.margin >= 0 ? "text-green-500" : "text-destructive"}`}>
              {formatEur(totals.margin)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1"><Users className="h-3 w-3" /> Utenti Attivi</CardDescription>
            <CardTitle className="text-2xl">{userCosts.filter(u => u.total_generations > 0).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Margin per plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Margini per Piano (ultimi 30 giorni)
          </CardTitle>
          <CardDescription>Ricavi vs costi API stimati per ogni livello di abbonamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {planSummaries.map((ps) => (
              <div key={ps.plan} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={ps.plan === "business" ? "default" : ps.plan === "creator" ? "default" : ps.plan === "premium" ? "secondary" : "outline"}>
                      {ps.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{ps.users} utenti</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Ricavi: <span className="text-primary font-medium">{formatEur(ps.totalRevenue)}</span></span>
                    <span className="text-muted-foreground">Costi: <span className="text-destructive font-medium">{formatEur(ps.totalCost)}</span></span>
                    <span className={`font-semibold ${ps.margin >= 0 ? "text-green-500" : "text-destructive"}`}>
                      {ps.marginPct > 0 ? "+" : ""}{ps.marginPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  {ps.totalRevenue > 0 && (
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${ps.margin >= 0 ? "bg-green-500/70" : "bg-destructive/70"}`}
                      style={{ width: `${Math.min(100, Math.max(5, ps.marginPct > 0 ? ps.marginPct : 100 - Math.abs(ps.marginPct)))}%` }}
                    />
                  )}
                  {ps.totalRevenue === 0 && ps.totalCost > 0 && (
                    <div className="absolute inset-y-0 left-0 rounded-full bg-destructive/70" style={{ width: "100%" }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top users by cost */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Costi API per Utente (Top 20)
          </CardTitle>
          <CardDescription>Utenti con il maggior consumo API negli ultimi 30 giorni</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Piano</TableHead>
                <TableHead className="text-right">Generazioni</TableHead>
                <TableHead className="text-right">Costo API</TableHead>
                <TableHead className="text-right">Ricavo</TableHead>
                <TableHead className="text-right">Margine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userCosts.slice(0, 20).map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium text-sm truncate max-w-[200px]">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "business" ? "default" : u.role === "creator" ? "default" : u.role === "premium" ? "secondary" : "outline"}>
                      {PLAN_PRICES[u.role]?.label || u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{u.total_generations}</TableCell>
                  <TableCell className="text-right text-destructive">{formatEur(u.estimated_cost)}</TableCell>
                  <TableCell className="text-right text-primary">{formatEur(u.revenue)}</TableCell>
                  <TableCell className={`text-right font-semibold ${u.margin >= 0 ? "text-green-500" : "text-destructive"}`}>
                    {formatEur(u.margin)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
