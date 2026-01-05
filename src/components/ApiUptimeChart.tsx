import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";
import { ApiHistoryEntry } from "@/hooks/useApiMonitoring";

interface ApiUptimeChartProps {
  history: ApiHistoryEntry[];
  loading: boolean;
}

export const ApiUptimeChart = ({ history, loading }: ApiUptimeChartProps) => {
  const chartData = useMemo(() => {
    if (!history.length) return [];

    // Group by hour
    const hourlyData = new Map<string, {
      hour: string;
      Replicate: number;
      Freepik: number;
      Shotstack: number;
      ElevenLabs: number;
      ReplicateCount: number;
      FreepikCount: number;
      ShotstackCount: number;
      ElevenLabsCount: number;
    }>();

    history.forEach((entry) => {
      const date = new Date(entry.checked_at);
      const hourKey = date.toLocaleString("it-IT", { 
        day: "2-digit", 
        month: "2-digit", 
        hour: "2-digit" 
      });

      if (!hourlyData.has(hourKey)) {
        hourlyData.set(hourKey, {
          hour: hourKey,
          Replicate: 0,
          Freepik: 0,
          Shotstack: 0,
          ElevenLabs: 0,
          ReplicateCount: 0,
          FreepikCount: 0,
          ShotstackCount: 0,
          ElevenLabsCount: 0,
        });
      }

      const data = hourlyData.get(hourKey)!;
      const isOnline = entry.status === "online" ? 100 : entry.status === "degraded" ? 50 : 0;
      
      switch (entry.api_name) {
        case "Replicate":
          data.Replicate = (data.Replicate * data.ReplicateCount + isOnline) / (data.ReplicateCount + 1);
          data.ReplicateCount++;
          break;
        case "Freepik":
          data.Freepik = (data.Freepik * data.FreepikCount + isOnline) / (data.FreepikCount + 1);
          data.FreepikCount++;
          break;
        case "Shotstack":
          data.Shotstack = (data.Shotstack * data.ShotstackCount + isOnline) / (data.ShotstackCount + 1);
          data.ShotstackCount++;
          break;
        case "ElevenLabs":
          data.ElevenLabs = (data.ElevenLabs * data.ElevenLabsCount + isOnline) / (data.ElevenLabsCount + 1);
          data.ElevenLabsCount++;
          break;
      }
    });

    return Array.from(hourlyData.values()).map(d => ({
      hour: d.hour,
      Replicate: Math.round(d.Replicate),
      Freepik: Math.round(d.Freepik),
      Shotstack: Math.round(d.Shotstack),
      ElevenLabs: Math.round(d.ElevenLabs),
    }));
  }, [history]);

  const overallUptime = useMemo(() => {
    if (!history.length) return { total: 0, byApi: {} as Record<string, number> };

    const apiCounts: Record<string, { online: number; total: number }> = {};
    
    history.forEach((entry) => {
      if (!apiCounts[entry.api_name]) {
        apiCounts[entry.api_name] = { online: 0, total: 0 };
      }
      apiCounts[entry.api_name].total++;
      if (entry.status === "online") {
        apiCounts[entry.api_name].online++;
      }
    });

    const byApi: Record<string, number> = {};
    let totalOnline = 0;
    let totalChecks = 0;

    Object.entries(apiCounts).forEach(([api, counts]) => {
      byApi[api] = Math.round((counts.online / counts.total) * 100);
      totalOnline += counts.online;
      totalChecks += counts.total;
    });

    return {
      total: totalChecks > 0 ? Math.round((totalOnline / totalChecks) * 100) : 0,
      byApi,
    };
  }, [history]);

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Uptime Ultime 24 Ore
        </CardTitle>
        <CardDescription className="flex items-center gap-4 flex-wrap">
          <span>Uptime totale: <strong className="text-green-500">{overallUptime.total}%</strong></span>
          {Object.entries(overallUptime.byApi).map(([api, uptime]) => (
            <span key={api} className="text-xs">
              {api}: <span className={uptime >= 90 ? "text-green-500" : uptime >= 70 ? "text-yellow-500" : "text-destructive"}>{uptime}%</span>
            </span>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessun dato storico disponibile. I dati verranno raccolti automaticamente.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorReplicate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFreepik" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorShotstack" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorElevenLabs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${value}%`, ""]}
              />
              <Legend 
                wrapperStyle={{ fontSize: "10px" }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="Replicate"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorReplicate)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Freepik"
                stroke="#22c55e"
                fillOpacity={1}
                fill="url(#colorFreepik)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="Shotstack"
                stroke="#eab308"
                fillOpacity={1}
                fill="url(#colorShotstack)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="ElevenLabs"
                stroke="#8b5cf6"
                fillOpacity={1}
                fill="url(#colorElevenLabs)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
