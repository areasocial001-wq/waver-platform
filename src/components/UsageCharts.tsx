import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Loader2 } from "lucide-react";

interface DailyStats {
  date: string;
  total: number;
  completed: number;
  failed: number;
}

interface TypeStats {
  name: string;
  value: number;
}

export const UsageCharts = () => {
  const [weeklyData, setWeeklyData] = useState<DailyStats[]>([]);
  const [monthlyData, setMonthlyData] = useState<DailyStats[]>([]);
  const [typeData, setTypeData] = useState<TypeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: videos } = await supabase
          .from("video_generations")
          .select("id, status, type, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (!videos) return;

        // Process weekly data (last 7 days)
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Generate daily stats for last 7 days
        const weeklyStats: Record<string, DailyStats> = {};
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const dateKey = date.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit" });
          weeklyStats[dateKey] = { date: dateKey, total: 0, completed: 0, failed: 0 };
        }

        // Generate monthly stats (by week)
        const monthlyStats: Record<string, DailyStats> = {};
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          const weekKey = `Sett. ${4 - i}`;
          monthlyStats[weekKey] = { date: weekKey, total: 0, completed: 0, failed: 0 };
        }

        // Type distribution
        const typeStats: Record<string, number> = {
          "Text to Video": 0,
          "Image to Video": 0
        };

        videos.forEach(video => {
          const videoDate = new Date(video.created_at);
          
          // Weekly data
          if (videoDate >= weekAgo) {
            const dateKey = videoDate.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit" });
            if (weeklyStats[dateKey]) {
              weeklyStats[dateKey].total++;
              if (video.status === "completed") weeklyStats[dateKey].completed++;
              if (video.status === "failed") weeklyStats[dateKey].failed++;
            }
          }

          // Monthly data
          if (videoDate >= monthAgo) {
            const weekNum = Math.floor((now.getTime() - videoDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
            const weekKey = `Sett. ${4 - Math.min(weekNum, 3)}`;
            if (monthlyStats[weekKey]) {
              monthlyStats[weekKey].total++;
              if (video.status === "completed") monthlyStats[weekKey].completed++;
              if (video.status === "failed") monthlyStats[weekKey].failed++;
            }
          }

          // Type data
          if (video.type === "text_to_video") {
            typeStats["Text to Video"]++;
          } else if (video.type === "image_to_video") {
            typeStats["Image to Video"]++;
          }
        });

        setWeeklyData(Object.values(weeklyStats));
        setMonthlyData(Object.values(monthlyStats));
        setTypeData([
          { name: "Text to Video", value: typeStats["Text to Video"] },
          { name: "Image to Video", value: typeStats["Image to Video"] }
        ]);
      } catch (error) {
        console.error("Error fetching chart data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  const COLORS = ["hsl(217, 91%, 60%)", "hsl(270, 60%, 55%)"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
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
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Statistiche di Utilizzo
        </CardTitle>
        <CardDescription>Analisi delle generazioni video</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="weekly" className="text-xs">
              <TrendingUp className="w-3 h-3 mr-1" />
              Settimanale
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              <BarChart3 className="w-3 h-3 mr-1" />
              Mensile
            </TabsTrigger>
            <TabsTrigger value="types" className="text-xs">
              <PieChartIcon className="w-3 h-3 mr-1" />
              Tipi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="completed" name="Completati" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Falliti" fill="hsl(0, 62%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="monthly" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Totale" 
                  stroke="hsl(217, 91%, 60%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(217, 91%, 60%)" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="completed" 
                  name="Completati" 
                  stroke="hsl(142, 76%, 36%)" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(142, 76%, 36%)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="types" className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: "hsl(var(--muted-foreground))" }}
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
