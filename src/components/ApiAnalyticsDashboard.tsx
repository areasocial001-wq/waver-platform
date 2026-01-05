import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bar,
  ScatterChart,
  Scatter,
  ComposedChart,
  Legend,
  ReferenceLine,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock,
  Activity,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  BarChart3,
  Timer,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface HourlyStats {
  hour: string;
  uptime: number;
  avgResponseTime: number;
  checks: number;
  errors: number;
}

interface PerformanceMetric {
  apiName: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  uptime: number;
  totalChecks: number;
  errorCount: number;
  trend: "up" | "down" | "stable";
}

interface IncidentData {
  apiName: string;
  timestamp: string;
  duration: number;
  resolved: boolean;
}

interface ResponseTimeDistribution {
  range: string;
  count: number;
  percentage: number;
}

const TIME_RANGES = [
  { value: "24h", label: "Ultime 24 ore", hours: 24 },
  { value: "7d", label: "Ultimi 7 giorni", hours: 168 },
  { value: "30d", label: "Ultimi 30 giorni", hours: 720 },
];

export const ApiAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("24h");
  const [selectedApi, setSelectedApi] = useState("all");
  const [hourlyData, setHourlyData] = useState<Record<string, HourlyStats[]>>({});
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [responseDistribution, setResponseDistribution] = useState<ResponseTimeDistribution[]>([]);

  const rangeHours = TIME_RANGES.find(r => r.value === timeRange)?.hours || 24;

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = new Date();
      startDate.setHours(startDate.getHours() - rangeHours);

      const { data } = await supabase
        .from("api_status_history")
        .select("api_name, status, response_time, checked_at")
        .eq("user_id", user.id)
        .gte("checked_at", startDate.toISOString())
        .order("checked_at", { ascending: true });

      if (data) {
        processAnalyticsData(data);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (data: any[]) => {
    const apiGroups: Record<string, any[]> = {};
    
    data.forEach(entry => {
      if (!apiGroups[entry.api_name]) apiGroups[entry.api_name] = [];
      apiGroups[entry.api_name].push(entry);
    });

    // Process hourly data
    const hourlyByApi: Record<string, HourlyStats[]> = {};
    const bucketSize = timeRange === "24h" ? 1 : timeRange === "7d" ? 6 : 24; // hours per bucket
    
    Object.entries(apiGroups).forEach(([apiName, entries]) => {
      const buckets: Record<string, { online: number; total: number; responseTimes: number[]; errors: number }> = {};
      
      entries.forEach(entry => {
        const date = new Date(entry.checked_at);
        let bucketKey: string;
        
        if (timeRange === "24h") {
          bucketKey = `${date.getHours().toString().padStart(2, '0')}:00`;
        } else if (timeRange === "7d") {
          bucketKey = date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric" });
        } else {
          bucketKey = date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
        }
        
        if (!buckets[bucketKey]) {
          buckets[bucketKey] = { online: 0, total: 0, responseTimes: [], errors: 0 };
        }
        
        buckets[bucketKey].total++;
        if (entry.status === "online") buckets[bucketKey].online++;
        if (entry.status === "offline") buckets[bucketKey].errors++;
        if (entry.response_time) buckets[bucketKey].responseTimes.push(entry.response_time);
      });

      hourlyByApi[apiName] = Object.entries(buckets).map(([hour, stats]) => ({
        hour,
        uptime: stats.total > 0 ? Math.round((stats.online / stats.total) * 100 * 10) / 10 : 0,
        avgResponseTime: stats.responseTimes.length > 0 
          ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
          : 0,
        checks: stats.total,
        errors: stats.errors,
      }));
    });
    
    setHourlyData(hourlyByApi);

    // Process performance metrics
    const metrics: PerformanceMetric[] = Object.entries(apiGroups).map(([apiName, entries]) => {
      const responseTimes = entries
        .filter(e => e.response_time)
        .map(e => e.response_time)
        .sort((a, b) => a - b);
      
      const onlineCount = entries.filter(e => e.status === "online").length;
      const errorCount = entries.filter(e => e.status === "offline").length;
      
      // Calculate percentiles
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);
      
      // Calculate trend (compare first half to second half)
      const midPoint = Math.floor(entries.length / 2);
      const firstHalfOnline = entries.slice(0, midPoint).filter(e => e.status === "online").length;
      const secondHalfOnline = entries.slice(midPoint).filter(e => e.status === "online").length;
      const firstHalfTotal = midPoint;
      const secondHalfTotal = entries.length - midPoint;
      
      const firstHalfUptime = firstHalfTotal > 0 ? firstHalfOnline / firstHalfTotal : 0;
      const secondHalfUptime = secondHalfTotal > 0 ? secondHalfOnline / secondHalfTotal : 0;
      
      let trend: "up" | "down" | "stable" = "stable";
      if (secondHalfUptime > firstHalfUptime + 0.05) trend = "up";
      else if (secondHalfUptime < firstHalfUptime - 0.05) trend = "down";

      return {
        apiName,
        avgResponseTime: responseTimes.length > 0 
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
        minResponseTime: responseTimes[0] || 0,
        maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
        uptime: entries.length > 0 ? Math.round((onlineCount / entries.length) * 100 * 10) / 10 : 0,
        totalChecks: entries.length,
        errorCount,
        trend,
      };
    });
    
    setPerformanceMetrics(metrics);

    // Process response time distribution (all APIs combined)
    const allResponseTimes = data.filter(d => d.response_time).map(d => d.response_time);
    const ranges = [
      { min: 0, max: 200, label: "<200ms" },
      { min: 200, max: 500, label: "200-500ms" },
      { min: 500, max: 1000, label: "500ms-1s" },
      { min: 1000, max: 2000, label: "1-2s" },
      { min: 2000, max: 5000, label: "2-5s" },
      { min: 5000, max: Infinity, label: ">5s" },
    ];

    const distribution: ResponseTimeDistribution[] = ranges.map(range => {
      const count = allResponseTimes.filter(t => t >= range.min && t < range.max).length;
      return {
        range: range.label,
        count,
        percentage: allResponseTimes.length > 0 ? Math.round((count / allResponseTimes.length) * 100) : 0,
      };
    });
    
    setResponseDistribution(distribution);

    // Process incidents (offline periods)
    const incidentList: IncidentData[] = [];
    Object.entries(apiGroups).forEach(([apiName, entries]) => {
      let offlineStart: Date | null = null;
      
      entries.forEach((entry, i) => {
        if (entry.status === "offline" && !offlineStart) {
          offlineStart = new Date(entry.checked_at);
        } else if (entry.status === "online" && offlineStart) {
          incidentList.push({
            apiName,
            timestamp: offlineStart.toISOString(),
            duration: Math.round((new Date(entry.checked_at).getTime() - offlineStart.getTime()) / 60000),
            resolved: true,
          });
          offlineStart = null;
        }
      });
      
      // Check for ongoing incident
      if (offlineStart) {
        incidentList.push({
          apiName,
          timestamp: offlineStart.toISOString(),
          duration: Math.round((new Date().getTime() - offlineStart.getTime()) / 60000),
          resolved: false,
        });
      }
    });
    
    setIncidents(incidentList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const displayData = useMemo(() => {
    if (selectedApi === "all") {
      // Combine all APIs
      const combined: Record<string, { uptime: number[]; responseTime: number[]; checks: number; errors: number }> = {};
      
      Object.values(hourlyData).forEach(apiData => {
        apiData.forEach(point => {
          if (!combined[point.hour]) {
            combined[point.hour] = { uptime: [], responseTime: [], checks: 0, errors: 0 };
          }
          combined[point.hour].uptime.push(point.uptime);
          combined[point.hour].responseTime.push(point.avgResponseTime);
          combined[point.hour].checks += point.checks;
          combined[point.hour].errors += point.errors;
        });
      });

      return Object.entries(combined).map(([hour, stats]) => ({
        hour,
        uptime: Math.round(stats.uptime.reduce((a, b) => a + b, 0) / stats.uptime.length * 10) / 10,
        avgResponseTime: Math.round(stats.responseTime.reduce((a, b) => a + b, 0) / stats.responseTime.length),
        checks: stats.checks,
        errors: stats.errors,
      }));
    }
    
    return hourlyData[selectedApi] || [];
  }, [hourlyData, selectedApi]);

  const overallStats = useMemo(() => {
    const totalUptime = performanceMetrics.reduce((sum, m) => sum + m.uptime, 0) / (performanceMetrics.length || 1);
    const avgResponse = performanceMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / (performanceMetrics.length || 1);
    const totalErrors = performanceMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const totalChecks = performanceMetrics.reduce((sum, m) => sum + m.totalChecks, 0);
    
    return {
      uptime: Math.round(totalUptime * 10) / 10,
      avgResponse: Math.round(avgResponse),
      totalErrors,
      totalChecks,
      errorRate: totalChecks > 0 ? Math.round((totalErrors / totalChecks) * 100 * 10) / 10 : 0,
    };
  }, [performanceMetrics]);

  const getDistributionColor = (range: string) => {
    if (range.includes("<200")) return "hsl(142, 76%, 36%)";
    if (range.includes("200-500")) return "hsl(142, 60%, 50%)";
    if (range.includes("500ms-1s")) return "hsl(48, 96%, 53%)";
    if (range.includes("1-2s")) return "hsl(38, 92%, 50%)";
    if (range.includes("2-5s")) return "hsl(25, 95%, 53%)";
    return "hsl(0, 72%, 51%)";
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}{entry.name.includes("Uptime") ? "%" : entry.name.includes("Risposta") ? "ms" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Analytics Avanzate
          </h2>
          <p className="text-sm text-muted-foreground">
            Analisi dettagliata delle performance API
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedApi} onValueChange={setSelectedApi}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le API</SelectItem>
              {Object.keys(hourlyData).map(api => (
                <SelectItem key={api} value={api}>{api}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <Activity className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Uptime Medio</p>
                <p className={`text-2xl font-bold ${
                  overallStats.uptime >= 99 ? "text-green-500" :
                  overallStats.uptime >= 95 ? "text-yellow-500" :
                  "text-destructive"
                }`}>
                  {overallStats.uptime}%
                </p>
              </div>
              <CheckCircle className={`w-8 h-8 ${
                overallStats.uptime >= 99 ? "text-green-500/20" :
                overallStats.uptime >= 95 ? "text-yellow-500/20" :
                "text-destructive/20"
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Risposta Media</p>
                <p className="text-2xl font-bold text-primary">{overallStats.avgResponse}ms</p>
              </div>
              <Timer className="w-8 h-8 text-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Controlli Totali</p>
                <p className="text-2xl font-bold">{overallStats.totalChecks}</p>
              </div>
              <Target className="w-8 h-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Errori</p>
                <p className={`text-2xl font-bold ${overallStats.totalErrors > 0 ? "text-destructive" : "text-green-500"}`}>
                  {overallStats.totalErrors}
                </p>
              </div>
              <XCircle className={`w-8 h-8 ${overallStats.totalErrors > 0 ? "text-destructive/20" : "text-green-500/20"}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tasso Errore</p>
                <p className={`text-2xl font-bold ${
                  overallStats.errorRate <= 1 ? "text-green-500" :
                  overallStats.errorRate <= 5 ? "text-yellow-500" :
                  "text-destructive"
                }`}>
                  {overallStats.errorRate}%
                </p>
              </div>
              <AlertTriangle className={`w-8 h-8 ${
                overallStats.errorRate <= 1 ? "text-green-500/20" :
                overallStats.errorRate <= 5 ? "text-yellow-500/20" :
                "text-destructive/20"
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Uptime & Response Time Chart */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Uptime e Tempi di Risposta
            </CardTitle>
            <CardDescription className="text-xs">
              Andamento nel periodo selezionato
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={displayData}>
                  <defs>
                    <linearGradient id="uptimeGradientAnalytics" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis 
                    yAxisId="left"
                    domain={[0, 100]} 
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine yAxisId="left" y={99} stroke="hsl(142, 76%, 36%)" strokeDasharray="3 3" />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="uptime" 
                    name="Uptime"
                    stroke="hsl(142, 76%, 36%)" 
                    fill="url(#uptimeGradientAnalytics)"
                    strokeWidth={2}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="avgResponseTime" 
                    name="Risposta Media"
                    stroke="hsl(217, 91%, 60%)" 
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Response Time Distribution */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Distribuzione Tempi di Risposta
            </CardTitle>
            <CardDescription className="text-xs">
              Come si distribuiscono i tempi di risposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis 
                    dataKey="range" 
                    type="category"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="percentage" name="Percentuale" radius={[0, 4, 4, 0]}>
                    {responseDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getDistributionColor(entry.range)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Metriche per API
          </CardTitle>
          <CardDescription className="text-xs">
            Statistiche dettagliate per ogni servizio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">API</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Uptime</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Media</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">P95</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">P99</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Min/Max</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Controlli</th>
                  <th className="text-center py-2 px-3 font-medium text-muted-foreground">Trend</th>
                </tr>
              </thead>
              <tbody>
                {performanceMetrics.map((metric) => (
                  <tr key={metric.apiName} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{metric.apiName}</td>
                    <td className="text-center py-2 px-3">
                      <Badge variant="outline" className={`${
                        metric.uptime >= 99 ? "bg-green-500/10 text-green-500" :
                        metric.uptime >= 95 ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-destructive/10 text-destructive"
                      } border-0`}>
                        {metric.uptime}%
                      </Badge>
                    </td>
                    <td className="text-center py-2 px-3 text-primary">{metric.avgResponseTime}ms</td>
                    <td className="text-center py-2 px-3 text-muted-foreground">{metric.p95ResponseTime}ms</td>
                    <td className="text-center py-2 px-3 text-muted-foreground">{metric.p99ResponseTime}ms</td>
                    <td className="text-center py-2 px-3 text-xs text-muted-foreground">
                      {metric.minResponseTime}/{metric.maxResponseTime}ms
                    </td>
                    <td className="text-center py-2 px-3">
                      <span className="text-foreground">{metric.totalChecks}</span>
                      {metric.errorCount > 0 && (
                        <span className="text-destructive ml-1">({metric.errorCount} err)</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-3">
                      {metric.trend === "up" ? (
                        <div className="flex items-center justify-center text-green-500">
                          <ArrowUpRight className="w-4 h-4" />
                        </div>
                      ) : metric.trend === "down" ? (
                        <div className="flex items-center justify-center text-destructive">
                          <ArrowDownRight className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center text-muted-foreground">—</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Incidents */}
      {incidents.length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Incidenti Recenti
            </CardTitle>
            <CardDescription className="text-xs">
              Periodi di inattività registrati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {incidents.slice(0, 10).map((incident, i) => (
                <div 
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    incident.resolved ? "bg-muted/30" : "bg-destructive/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {incident.resolved ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive animate-pulse" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{incident.apiName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.timestamp).toLocaleString("it-IT")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={incident.resolved ? "secondary" : "destructive"}>
                      {incident.duration} min
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {incident.resolved ? "Risolto" : "In corso"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
