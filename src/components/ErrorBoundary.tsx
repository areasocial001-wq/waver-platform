import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
  /** Optional label so multiple boundaries can be told apart in logs */
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface to console so devs / replay tooling can see it.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="font-semibold">Errore di rendering</h3>
              <p className="text-sm text-muted-foreground break-words">
                {this.state.error.message || "Errore sconosciuto"}
              </p>
              {this.state.error.stack && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Dettagli tecnici
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-muted/40 p-2 rounded">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              <Button variant="outline" size="sm" onClick={this.reset} className="gap-2">
                <RefreshCw className="w-3.5 h-3.5" /> Riprova
              </Button>
            </div>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}
