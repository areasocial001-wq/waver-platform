import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldAlert, Zap } from "lucide-react";
import { useQuotas } from "@/hooks/useQuotas";

export const QuotaGuard = () => {
  const { quota, usedGenerations, canGenerate, remainingGenerations, loading, isUnlimited } = useQuotas();

  if (loading) return null;
  if (isUnlimited) return null;

  const percentage = (usedGenerations / quota.max_video_generations_monthly) * 100;

  if (!canGenerate) {
    return (
      <Alert variant="destructive" className="mb-4">
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="flex flex-col gap-2">
          <span className="font-semibold">Limite mensile raggiunto</span>
          <span className="text-sm">
            Hai utilizzato tutte le {quota.max_video_generations_monthly} generazioni del tuo piano.
            Passa a un piano superiore per continuare a generare video.
          </span>
          <Progress value={100} className="h-2" />
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border mb-4">
      <div className="flex items-center gap-2 text-sm">
        <Zap className="h-4 w-4 text-primary" />
        <span className="text-muted-foreground">Generazioni rimaste:</span>
        <Badge variant={remainingGenerations <= 2 ? "destructive" : "secondary"} className="font-mono">
          {remainingGenerations} / {quota.max_video_generations_monthly}
        </Badge>
      </div>
      <Progress value={percentage} className="w-24 h-2" />
    </div>
  );
};

/** Hook helper to use in form submit handlers */
export const useQuotaCheck = () => {
  const quotaData = useQuotas();
  return quotaData;
};
