import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ApiMonitoringDashboard } from "@/components/ApiMonitoringDashboard";
import { ApiWeeklyUptimeChart } from "@/components/ApiWeeklyUptimeChart";
import { ApiThresholdSettings } from "@/components/ApiThresholdSettings";
import { UsageCharts } from "@/components/UsageCharts";
import { LogViewer } from "@/components/LogViewer";
import { NotificationSettings } from "@/components/NotificationSettings";
import { ApiAnalyticsDashboard } from "@/components/ApiAnalyticsDashboard";
import { AIMLApiMonitor } from "@/components/AIMLApiMonitor";
import { useApiMonitoring } from "@/hooks/useApiMonitoring";
import { Activity } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ApiMonitoring() {
  const {
    apis,
    isRefreshing,
    thresholds,
    notifyOnChange,
    history,
    checkApiStatus,
    saveSettings,
  } = useApiMonitoring();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background dark">
        <Navbar />
        <div className="container mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary" />
              Monitoraggio API
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitora lo stato, le performance e i log delle API in tempo reale
            </p>
          </div>

          <Tabs defaultValue="status" className="space-y-6">
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="status">Stato</TabsTrigger>
              <TabsTrigger value="aiml">AI/ML API</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Impostazioni</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="space-y-6">
              {/* Full API Monitoring Dashboard */}
              <ApiMonitoringDashboard 
                apis={apis} 
                history={history} 
                isRefreshing={isRefreshing} 
                onRefresh={checkApiStatus} 
              />

              {/* Weekly Uptime Chart */}
              <ApiWeeklyUptimeChart />

              {/* Usage Charts */}
              <UsageCharts />

              {/* Logs */}
              <LogViewer />
            </TabsContent>

            <TabsContent value="aiml" className="space-y-6">
              <AIMLApiMonitor />
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <ApiAnalyticsDashboard />
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <ApiThresholdSettings 
                  thresholds={thresholds} 
                  notifyOnChange={notifyOnChange} 
                  onSave={saveSettings} 
                />
                <NotificationSettings />
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
}

