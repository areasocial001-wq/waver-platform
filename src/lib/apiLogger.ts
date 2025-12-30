import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "info" | "success" | "warning" | "error";

export interface LogEntry {
  operation: string;
  api_name: string;
  status: LogLevel;
  message: string;
  details?: Record<string, any>;
  duration_ms?: number;
}

class ApiLogger {
  private userId: string | null = null;

  async init() {
    const { data: { user } } = await supabase.auth.getUser();
    this.userId = user?.id || null;
  }

  async log(entry: LogEntry) {
    if (!this.userId) {
      await this.init();
    }

    if (!this.userId) {
      console.warn("ApiLogger: No user ID available, skipping log");
      return;
    }

    try {
      const { error } = await supabase.from("api_logs").insert({
        user_id: this.userId,
        operation: entry.operation,
        api_name: entry.api_name,
        status: entry.status,
        message: entry.message,
        details: entry.details || {},
        duration_ms: entry.duration_ms
      });

      if (error) {
        console.error("ApiLogger error:", error);
      }
    } catch (err) {
      console.error("ApiLogger exception:", err);
    }
  }

  async info(api_name: string, operation: string, message: string, details?: Record<string, any>) {
    await this.log({ api_name, operation, status: "info", message, details });
  }

  async success(api_name: string, operation: string, message: string, details?: Record<string, any>, duration_ms?: number) {
    await this.log({ api_name, operation, status: "success", message, details, duration_ms });
  }

  async warning(api_name: string, operation: string, message: string, details?: Record<string, any>) {
    await this.log({ api_name, operation, status: "warning", message, details });
  }

  async error(api_name: string, operation: string, message: string, details?: Record<string, any>) {
    await this.log({ api_name, operation, status: "error", message, details });
  }

  // Measure and log operation duration
  async measure<T>(api_name: string, operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    await this.info(api_name, operation, `Operazione iniziata`);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      await this.success(api_name, operation, `Operazione completata`, {}, duration);
      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      await this.error(api_name, operation, err.message || "Errore sconosciuto", { 
        error: err.toString(),
        duration_ms: duration 
      });
      throw err;
    }
  }
}

export const apiLogger = new ApiLogger();
