import { AuthGuard } from "@/components/AuthGuard";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ApiMonitoringDashboard } from "@/components/ApiMonitoringDashboard";
import { ApiWeeklyUptimeChart } from "@/components/ApiWeeklyUptimeChart";
import { ApiThresholdSettings } from "@/components/ApiThresholdSettings";
import { UsageCharts } from "@/components/UsageCharts";
import { LogViewer } from "@/components/LogViewer";
import { NotificationSettings } from "@/components/NotificationSettings";
import { useApiMonitoring } from "@/hooks/useApiMonitoring";
import { Activity } from "lucide-react";

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

          {/* Full API Monitoring Dashboard */}
          <ApiMonitoringDashboard 
            apis={apis} 
            history={history} 
            isRefreshing={isRefreshing} 
            onRefresh={checkApiStatus} 
          />

          {/* Weekly Uptime Chart */}
          <div className="mb-6">
            <ApiWeeklyUptimeChart />
          </div>

          {/* Usage Charts and Threshold Settings */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <UsageCharts />
            </div>
            <ApiThresholdSettings 
              thresholds={thresholds} 
              notifyOnChange={notifyOnChange} 
              onSave={saveSettings} 
            />
          </div>

          {/* Logs and Notifications */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <LogViewer />
            </div>
            <NotificationSettings />
          </div>
        </div>
        <Footer />
      </div>
    </AuthGuard>
  );
}
