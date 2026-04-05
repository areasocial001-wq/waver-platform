import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Crown, Lock, ArrowRight } from "lucide-react";

interface PremiumGateProps {
  children: React.ReactNode;
  featureName?: string;
}

export const PremiumGate = ({ children, featureName = "Questa funzionalità" }: PremiumGateProps) => {
  const { subscribed, tier, loading } = useSubscription();
  const navigate = useNavigate();

  if (loading) return <>{children}</>;

  if (subscribed && tier === "premium") {
    return <>{children}</>;
  }

  return (
    <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-amber-600/5">
      <CardHeader className="text-center pb-3">
        <div className="mx-auto w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-3 border border-amber-500/20">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <CardTitle className="text-lg flex items-center justify-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          Funzionalità Premium
        </CardTitle>
        <CardDescription>
          {featureName} è disponibile solo per gli utenti Premium.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button
          onClick={() => navigate("/pricing")}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-white group"
        >
          Upgrade a Premium
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
};
