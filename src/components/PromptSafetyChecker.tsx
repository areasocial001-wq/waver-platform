import { useState, useEffect } from "react";
import { AlertTriangle, Shield, ShieldAlert, Sparkles, Loader2, RefreshCw, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { checkPromptSafety, getCategoryDisplayName, SafetyCheckResult } from "@/lib/promptSafetyChecker";
import { toast } from "sonner";

interface PromptSafetyCheckerProps {
  prompt: string;
  onAcceptRewrite?: (newPrompt: string) => void;
  className?: string;
}

export function PromptSafetyChecker({ prompt, onAcceptRewrite, className }: PromptSafetyCheckerProps) {
  const [safetyResult, setSafetyResult] = useState<SafetyCheckResult | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  
  // Check safety whenever prompt changes
  useEffect(() => {
    if (prompt.trim().length > 10) {
      const result = checkPromptSafety(prompt);
      setSafetyResult(result);
      // Reset suggested prompt when prompt changes
      setSuggestedPrompt(null);
    } else {
      setSafetyResult(null);
      setSuggestedPrompt(null);
    }
  }, [prompt]);
  
  // Don't show if prompt is too short or is safe
  if (!safetyResult || safetyResult.isSafe) {
    return null;
  }
  
  const handleRewritePrompt = async () => {
    if (!prompt.trim()) return;
    
    setIsRewriting(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-video-prompt', {
        body: {
          prompt,
          action: 'safety_rewrite',
          flaggedCategories: safetyResult.flaggedCategories,
        },
      });
      
      if (error) throw error;
      
      if (data?.optimizedPrompt) {
        setSuggestedPrompt(data.optimizedPrompt);
        toast.success("Prompt alternativo generato!");
      } else {
        toast.error("Impossibile generare un prompt alternativo");
      }
    } catch (error) {
      console.error("Error rewriting prompt:", error);
      toast.error("Errore nella riscrittura del prompt");
    } finally {
      setIsRewriting(false);
    }
  };
  
  const handleAcceptRewrite = () => {
    if (suggestedPrompt && onAcceptRewrite) {
      onAcceptRewrite(suggestedPrompt);
      setSuggestedPrompt(null);
      toast.success("Prompt aggiornato!");
    }
  };
  
  const severityConfig = {
    warning: {
      icon: AlertTriangle,
      variant: "default" as const,
      bgClass: "bg-yellow-500/10 border-yellow-500/30",
      iconClass: "text-yellow-500",
      title: "Potenziale problema di contenuto",
    },
    high: {
      icon: ShieldAlert,
      variant: "destructive" as const,
      bgClass: "bg-destructive/10 border-destructive/30",
      iconClass: "text-destructive",
      title: "Contenuto probabilmente bloccato",
    },
    none: {
      icon: Shield,
      variant: "default" as const,
      bgClass: "bg-green-500/10 border-green-500/30",
      iconClass: "text-green-500",
      title: "Prompt sicuro",
    },
  };
  
  const config = severityConfig[safetyResult.severity];
  const Icon = config.icon;
  
  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={className}>
      <Alert className={`${config.bgClass} border`}>
        <CollapsibleTrigger className="w-full text-left">
          <div className="flex items-start gap-3">
            <Icon className={`h-5 w-5 mt-0.5 ${config.iconClass}`} />
            <div className="flex-1">
              <AlertTitle className="flex items-center gap-2 text-sm font-semibold">
                {config.title}
                <Badge variant="outline" className="text-xs">
                  {isExpanded ? "Nascondi" : "Mostra"} dettagli
                </Badge>
              </AlertTitle>
            </div>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="mt-3 pl-8">
          <AlertDescription className="space-y-3">
            {/* Flagged categories */}
            <div className="flex flex-wrap gap-2">
              {safetyResult.flaggedCategories.map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {getCategoryDisplayName(category)}
                </Badge>
              ))}
            </div>
            
            {/* Suggestions */}
            {safetyResult.suggestions.length > 0 && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p className="font-medium">Suggerimenti:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {safetyResult.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* AI Rewrite button */}
            {!suggestedPrompt && (
              <Button
                onClick={handleRewritePrompt}
                disabled={isRewriting}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                {isRewriting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generazione in corso...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Suggerisci prompt alternativo
                  </>
                )}
              </Button>
            )}
            
            {/* Suggested prompt */}
            {suggestedPrompt && (
              <div className="mt-3 p-3 rounded-lg bg-background/50 border border-border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Prompt alternativo suggerito:
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {suggestedPrompt}
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleAcceptRewrite} size="sm" className="gap-2">
                    <Check className="h-4 w-4" />
                    Usa questo prompt
                  </Button>
                  <Button
                    onClick={handleRewritePrompt}
                    disabled={isRewriting}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRewriting ? 'animate-spin' : ''}`} />
                    Genera altro
                  </Button>
                </div>
              </div>
            )}
          </AlertDescription>
        </CollapsibleContent>
      </Alert>
    </Collapsible>
  );
}
