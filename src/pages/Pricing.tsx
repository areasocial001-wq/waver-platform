import React, { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, X, Crown, Zap, Star, Loader2, ExternalLink } from "lucide-react";
import { useQuotas } from "@/hooks/useQuotas";
import { useSubscription, STRIPE_TIERS } from "@/hooks/useSubscription";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "/mese",
    description: "Per iniziare a esplorare la piattaforma",
    icon: Zap,
    features: [
      { name: "5 generazioni video/mese", included: true },
      { name: "Risoluzione 720p", included: true },
      { name: "1 storyboard", included: true },
      { name: "Voice cloning", included: false },
      { name: "Timeline editor", included: false },
      { name: "Accesso API", included: false },
      { name: "Multi-provider", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "€19,90",
    period: "/mese",
    description: "Per professionisti e creator",
    icon: Crown,
    popular: true,
    features: [
      { name: "50 generazioni video/mese", included: true },
      { name: "Risoluzione 1080p", included: true },
      { name: "10 storyboard", included: true },
      { name: "Voice cloning", included: true },
      { name: "Timeline editor", included: true },
      { name: "Accesso API", included: true },
      { name: "Multi-provider", included: true },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "Contattaci",
    period: "",
    description: "Per team e aziende",
    icon: Star,
    features: [
      { name: "Generazioni illimitate", included: true },
      { name: "Risoluzione 4K", included: true },
      { name: "Storyboard illimitati", included: true },
      { name: "Voice cloning", included: true },
      { name: "Timeline editor", included: true },
      { name: "Accesso API dedicato", included: true },
      { name: "Multi-provider + priorità", included: true },
    ],
  },
];

export default function PricingPage() {
  const { quota, usedGenerations, remainingGenerations, isUnlimited } = useQuotas();
  const { tier, subscribed, subscriptionEnd, loading: subLoading, startCheckout, openCustomerPortal, checkSubscription } = useSubscription();
  const { isAdmin } = useUserRole();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = React.useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Pagamento completato! Aggiornamento del piano in corso...");
      // Poll subscription status for up to 30s to catch webhook processing
      let attempts = 0;
      const interval = setInterval(async () => {
        await checkSubscription();
        attempts++;
        if (attempts >= 6) clearInterval(interval);
      }, 5000);
      checkSubscription();
      return () => clearInterval(interval);
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Pagamento annullato.");
    }
  }, [searchParams, checkSubscription]);

  const currentPlan = isAdmin ? "admin" : tier;

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      await startCheckout(STRIPE_TIERS.premium.price_id);
    } catch (err) {
      toast.error("Errore durante l'avvio del checkout");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    try {
      await openCustomerPortal();
    } catch {
      toast.error("Errore nell'apertura del portale di gestione");
    }
  };

  const usagePercent = isUnlimited ? 0 : (usedGenerations / quota.max_video_generations_monthly) * 100;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container max-w-6xl py-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3">Piani e Prezzi</h1>
            <p className="text-muted-foreground text-lg">
              Scegli il piano più adatto alle tue esigenze
            </p>
          </div>

          {/* Current usage summary */}
          <Card className="mb-10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Il tuo utilizzo attuale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Piano attuale</p>
                  <Badge variant="secondary" className="mt-1 text-sm">
                    {currentPlan === "admin" ? "Admin (illimitato)" : currentPlan === "premium" ? "Premium" : "Free"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Generazioni questo mese</p>
                  <p className="font-semibold mt-1">
                    {isUnlimited ? `${usedGenerations} (illimitate)` : `${usedGenerations} / ${quota.max_video_generations_monthly}`}
                  </p>
                  {!isUnlimited && <Progress value={usagePercent} className="h-2 mt-2" />}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Risoluzione max</p>
                  <p className="font-semibold mt-1">{quota.max_resolution}</p>
                </div>
              </div>
              {subscribed && subscriptionEnd && (
                <p className="text-xs text-muted-foreground mt-4">
                  Rinnovo: {new Date(subscriptionEnd).toLocaleDateString("it-IT")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan =
                (plan.id === "free" && currentPlan === "free") ||
                (plan.id === "premium" && (currentPlan === "premium" || currentPlan === "admin"));

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${
                    plan.popular ? "border-primary shadow-lg scale-[1.02]" : ""
                  } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Più popolare
                    </Badge>
                  )}
                  {isCurrentPlan && (
                    <Badge variant="outline" className="absolute -top-3 right-4 border-primary text-primary">
                      Il tuo piano
                    </Badge>
                  )}
                  <CardHeader className="text-center">
                    <plan.icon className="h-10 w-10 mx-auto mb-2 text-primary" />
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature.name} className="flex items-center gap-2 text-sm">
                          {feature.included ? (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={feature.included ? "" : "text-muted-foreground/60"}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    {plan.id === "free" && (
                      <Button variant="outline" className="w-full" disabled>
                        {isCurrentPlan ? "Piano attuale" : "Piano base"}
                      </Button>
                    )}
                    {plan.id === "premium" && !isCurrentPlan && (
                      <Button
                        className="w-full"
                        onClick={handleUpgrade}
                        disabled={checkoutLoading || subLoading}
                      >
                        {checkoutLoading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Caricamento...</>
                        ) : (
                          <><Crown className="h-4 w-4" /> Passa a Premium</>
                        )}
                      </Button>
                    )}
                    {plan.id === "premium" && isCurrentPlan && (
                      <Button variant="outline" className="w-full" onClick={handleManage}>
                        <ExternalLink className="h-4 w-4" /> Gestisci abbonamento
                      </Button>
                    )}
                    {plan.id === "business" && (
                      <Button variant="secondary" className="w-full" disabled>
                        Prossimamente
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
