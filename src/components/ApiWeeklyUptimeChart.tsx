import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  BarChart3,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DailyStats {
  date: string;
  uptime: number;
  avgResponseTime: number;
  totalChecks: number;
  offlineCount: number;
}

interface ApiWeeklyData {
  apiName: string;
  dailyStats: DailyStats[];
  weeklyUptime: number;
  weeklyAvgResponse: number;
  trend: "up" | "down" | "stable";
}

export const ApiWeeklyUptimeChart = () => {
  const [weeklyData, setWeeklyData] = useState<ApiWeeklyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApi, setSelectedApi] = useState<string>("all");
  const [chartType, setChartType] = useState<"line" | "area" | "bar">("area");

  useEffect(() => {
    loadWeeklyData();
  }, []);

  const loadWeeklyData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data } = await supabase
        .from("api_status_history")
        .select("api_name, status, response_time, checked_at")
        .eq("user_id", user.id)
        .gte("checked_at", sevenDaysAgo.toISOString())
        .order("checked_at", { ascending: true });

      if (data) {
        // Group by API and day
        const apiGroups: Record<string, Record<string, { online: number; total: number; responseTimes: number[]; offline: number }>> = {};
        
        data.forEach(entry => {
          const apiName = entry.api_name;
          const day = new Date(entry.checked_at).toISOString().split('T')[0];
          
          if (!apiGroups[apiName]) apiGroups[apiName] = {};
          if (!apiGroups[apiName][day]) {
            apiGroups[apiName][day] = { online: 0, total: 0, responseTimes: [], offline: 0 };
          }
          
          apiGroups[apiName][day].total++;
          if (entry.status === "online") {
            apiGroups[apiName][day].online++;
          } else if (entry.status === "offline") {
            apiGroups[apiName][day].offline++;
          }
          if (entry.response_time) {
            apiGroups[apiName][day].responseTimes.push(entry.response_time);
          }
        });

        // Convert to weekly data format
        const weeklyDataArray: ApiWeeklyData[] = Object.entries(apiGroups).map(([apiName, days]) => {
          const dailyStats: DailyStats[] = [];
          let totalUptime = 0;
          let totalResponse = 0;
          let dayCount = 0;
          
          // Generate stats for each of the last 7 days
          for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStr = date.toISOString().split('T')[0];
            const dayData = days[dayStr];
            
            if (dayData) {
              const uptime = dayData.total > 0 ? (dayData.online / dayData.total) * 100 : 0;
              const avgResponse = dayData.responseTimes.length > 0 
                ? dayData.responseTimes.reduce((a, b) => a + b, 0) / dayData.responseTimes.length 
                : 0;
              
              dailyStats.push({
                date: date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" }),
                uptime: Math.round(uptime * 10) / 10,
                avgResponseTime: Math.round(avgResponse),
                totalChecks: dayData.total,
                offlineCount: dayData.offline
              });
              
              totalUptime += uptime;
              totalResponse += avgResponse;
              dayCount++;
            } else {
              dailyStats.push({
                date: date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" }),
                uptime: 0,
                avgResponseTime: 0,
                totalChecks: 0,
                offlineCount: 0
              });
            }
          }

          // Calculate trend (compare first half to second half)
          const firstHalf = dailyStats.slice(0, 3).reduce((sum, d) => sum + d.uptime, 0) / 3;
          const secondHalf = dailyStats.slice(4, 7).reduce((sum, d) => sum + d.uptime, 0) / 3;
          const trend: "up" | "down" | "stable" = 
            secondHalf > firstHalf + 5 ? "up" : 
            secondHalf < firstHalf - 5 ? "down" : 
            "stable";

          return {
            apiName,
            dailyStats,
            weeklyUptime: dayCount > 0 ? Math.round((totalUptime / dayCount) * 10) / 10 : 0,
            weeklyAvgResponse: dayCount > 0 ? Math.round(totalResponse / dayCount) : 0,
            trend
          };
        });

        setWeeklyData(weeklyDataArray);
      }
    } catch (error) {
      console.error("Error loading weekly data:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayData = useMemo(() => {
    if (selectedApi === "all") {
      // Combine all APIs into average
      const combined: DailyStats[] = [];
      if (weeklyData.length === 0) return combined;
      
      for (let i = 0; i < 7; i++) {
        const dayStats = weeklyData.map(api => api.dailyStats[i]).filter(Boolean);
        if (dayStats.length > 0) {
          combined.push({
            date: dayStats[0].date,
            uptime: Math.round(dayStats.reduce((sum, d) => sum + d.uptime, 0) / dayStats.length * 10) / 10,
            avgResponseTime: Math.round(dayStats.reduce((sum, d) => sum + d.avgResponseTime, 0) / dayStats.length),
            totalChecks: dayStats.reduce((sum, d) => sum + d.totalChecks, 0),
            offlineCount: dayStats.reduce((sum, d) => sum + d.offlineCount, 0)
          });
        }
      }
      return combined;
    }
    
    const apiData = weeklyData.find(api => api.apiName === selectedApi);
    return apiData?.dailyStats || [];
  }, [weeklyData, selectedApi]);

  const overallStats = useMemo(() => {
    if (selectedApi === "all") {
      const avgUptime = weeklyData.length > 0 
        ? weeklyData.reduce((sum, api) => sum + api.weeklyUptime, 0) / weeklyData.length 
        : 0;
      const avgResponse = weeklyData.length > 0 
        ? weeklyData.reduce((sum, api) => sum + api.weeklyAvgResponse, 0) / weeklyData.length 
        : 0;
      const trendUp = weeklyData.filter(a => a.trend === "up").length;
      const trendDown = weeklyData.filter(a => a.trend === "down").length;
      
      return {
        uptime: Math.round(avgUptime * 10) / 10,
        avgResponse: Math.round(avgResponse),
        trend: trendUp > trendDown ? "up" : trendDown > trendUp ? "down" : "stable" as const
      };
    }
    
    const apiData = weeklyData.find(api => api.apiName === selectedApi);
    return {
      uptime: apiData?.weeklyUptime || 0,
      avgResponse: apiData?.weeklyAvgResponse || 0,
      trend: apiData?.trend || "stable" as const
    };
  }, [weeklyData, selectedApi]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-1">{label}</p>
          <p className="text-xs text-green-500">
            Uptime: {payload[0]?.value || 0}%
          </p>
          {payload[1] && (
            <p className="text-xs text-primary">
              Tempo risposta: {payload[1]?.value || 0}ms
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Trend Uptime Settimanale
            </CardTitle>
            <CardDescription className="mt-1">
              Statistiche degli ultimi 7 giorni
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedApi} onValueChange={setSelectedApi}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Seleziona API" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le API</SelectItem>
                {weeklyData.map(api => (
                  <SelectItem key={api.apiName} value={api.apiName}>
                    {api.apiName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="area">Area</SelectItem>
                <SelectItem value="line">Linea</SelectItem>
                <SelectItem value="bar">Barre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Uptime medio:</span>
            <Badge variant="outline" className={`${
              overallStats.uptime >= 95 ? "bg-green-500/10 text-green-500" :
              overallStats.uptime >= 80 ? "bg-yellow-500/10 text-yellow-500" :
              "bg-destructive/10 text-destructive"
            } border-0`}>
              {overallStats.uptime}%
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Risposta:</span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-0">
              {overallStats.avgResponse}ms
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trend:</span>
            {overallStats.trend === "up" ? (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-0 gap-1">
                <TrendingUp className="w-3 h-3" />
                In crescita
              </Badge>
            ) : overallStats.trend === "down" ? (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-0 gap-1">
                <TrendingDown className="w-3 h-3" />
                In calo
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-0">
                Stabile
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <BarChart3 className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Nessun dato disponibile</p>
            <p className="text-xs">I dati verranno popolati con l'uso dell'app</p>
          </div>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "area" ? (
                <AreaChart data={displayData}>
                  <defs>
                    <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs fill-muted-foreground" 
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="uptime" 
                    stroke="hsl(var(--chart-1))" 
                    fill="url(#uptimeGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : chartType === "line" ? (
                <LineChart data={displayData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs fill-muted-foreground" 
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="uptime" 
                    stroke="hsl(var(--chart-1))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={displayData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs fill-muted-foreground" 
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[0, 100]} 
                    className="text-xs fill-muted-foreground"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="uptime" 
                    fill="hsl(var(--chart-1))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-API breakdown when viewing all */}
        {selectedApi === "all" && weeklyData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">Dettaglio per API</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {weeklyData.map(api => (
                <div 
                  key={api.apiName}
                  className="p-2 rounded-lg bg-background/50 cursor-pointer hover:bg-background/80 transition-colors"
                  onClick={() => setSelectedApi(api.apiName)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{api.apiName}</span>
                    {api.trend === "up" ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : api.trend === "down" ? (
                      <TrendingDown className="w-3 h-3 text-destructive" />
                    ) : null}
                  </div>
                  <p className={`text-sm font-bold ${
                    api.weeklyUptime >= 95 ? "text-green-500" :
                    api.weeklyUptime >= 80 ? "text-yellow-500" :
                    "text-destructive"
                  }`}>
                    {api.weeklyUptime}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
