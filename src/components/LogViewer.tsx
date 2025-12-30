import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Clock,
  Filter,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LogEntry {
  id: string;
  operation: string;
  api_name: string;
  status: string;
  message: string;
  details: Record<string, any>;
  duration_ms: number | null;
  created_at: string;
}

export const LogViewer = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [apiFilter, setApiFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("api_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      if (apiFilter !== "all") {
        query = query.eq("api_name", apiFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching logs:", error);
        return;
      }

      const mappedLogs: LogEntry[] = (data || []).map(d => ({
        id: d.id,
        operation: d.operation,
        api_name: d.api_name,
        status: d.status,
        message: d.message,
        details: (d.details as Record<string, any>) || {},
        duration_ms: d.duration_ms,
        created_at: d.created_at
      }));
      
      setLogs(mappedLogs);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("api_logs")
        .delete()
        .eq("user_id", user.id);

      setLogs([]);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, apiFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case "error":
        return <XCircle className="w-3 h-3 text-destructive" />;
      case "warning":
        return <AlertTriangle className="w-3 h-3 text-yellow-500" />;
      default:
        return <Info className="w-3 h-3 text-primary" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const uniqueApis = [...new Set(logs.map(l => l.api_name))];

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === "success").length,
    error: logs.filter(l => l.status === "error").length,
    warning: logs.filter(l => l.status === "warning").length,
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Log Operazioni API
            </CardTitle>
            <CardDescription>Tracciamento operazioni</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={clearLogs} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-background/50 text-center">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground">Totale</p>
          </div>
          <div className="p-2 rounded-lg bg-green-500/10 text-center">
            <p className="text-lg font-bold text-green-500">{stats.success}</p>
            <p className="text-[10px] text-muted-foreground">Success</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10 text-center">
            <p className="text-lg font-bold text-destructive">{stats.error}</p>
            <p className="text-[10px] text-muted-foreground">Error</p>
          </div>
          <div className="p-2 rounded-lg bg-yellow-500/10 text-center">
            <p className="text-lg font-bold text-yellow-500">{stats.warning}</p>
            <p className="text-[10px] text-muted-foreground">Warning</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Select value={apiFilter} onValueChange={setApiFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <SelectValue placeholder="API" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {uniqueApis.map(api => (
                <SelectItem key={api} value={api}>{api}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[250px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nessun log disponibile
            </p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Collapsible 
                  key={log.id}
                  open={expandedLogs.has(log.id)}
                  onOpenChange={() => toggleExpand(log.id)}
                >
                  <div className="rounded-lg bg-background/50 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 p-2 cursor-pointer hover:bg-background/80 transition-colors">
                        {getStatusIcon(log.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {log.api_name}
                            </Badge>
                            <span className="text-xs font-medium truncate">
                              {log.operation}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {log.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.duration_ms && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {log.duration_ms}ms
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(log.created_at)}
                          </span>
                          {expandedLogs.has(log.id) ? (
                            <ChevronUp className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-2 pb-2">
                        <div className="p-2 rounded bg-muted/50 text-[10px] font-mono overflow-x-auto">
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
