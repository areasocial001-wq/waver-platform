import React, { useEffect, useState } from "react";
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

const getPlans = (isAnnual: boolean) => [
  {
    id: "free",
    name: "Free",
    price: "€0",
    period: "/mese",
    description: "Per iniziare a esplorare la piattaforma",
    icon: Zap,
    features: [
      { name: "5 generazioni video/mese", included: true },
      { name: "Generazione immagini AI", included: true },
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
    price: isAnnual ? "€15,90" : "€19,90",
    period: "/mese",
    yearlyTotal: isAnnual ? "€190,80/anno" : undefined,
    description: "Per professionisti e creator",
    icon: Crown,
    popular: true,
    features: [
      { name: "50 generazioni video/mese", included: true },
      { name: "Generazione immagini illimitata", included: true },
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
      { name: "Generazione immagini illimitata", included: true },
      { name: "Risoluzione 4K", included: true },
      { name: "Storyboard illimitati", included: true },
      { name: "Voice cloning", included: true },
      { name: "Timeline editor", included: true },
      { name: "Accesso API dedicato", included: true },
      { name: "Multi-provider + priorità", included: true },
    ],
  },
];

const comparisonCategories = [
  {
    name: "Generazione Video",
    features: [
      { name: "Video al mese", free: "5", premium: "50", business: "Illimitati" },
      { name: "Risoluzione massima", free: "720p", premium: "1080p", business: "4K" },
      { name: "Durata max per video", free: "10s", premium: "30s", business: "60s" },
      { name: "Multi-provider", free: false, premium: true, business: true },
      { name: "Priorità di generazione", free: false, premium: false, business: true },
    ],
  },
  {
    name: "Generazione Immagini",
    features: [
      { name: "Immagini AI", free: "Incluse", premium: "Illimitate", business: "Illimitate" },
      { name: "Inpainting & editing", free: false, premium: true, business: true },
      { name: "Upscaling immagini", free: false, premium: true, business: true },
    ],
  },
  {
    name: "Audio & Voiceover",
    features: [
      { name: "Text-to-Speech", free: true, premium: true, business: true },
      { name: "Clonazione vocale", free: false, premium: true, business: true },
      { name: "Musica AI", free: false, premium: true, business: true },
      { name: "Audio mixing", free: false, premium: true, business: true },
    ],
  },
  {
    name: "Strumenti di Produzione",
    features: [
      { name: "Storyboard", free: "1", premium: "10", business: "Illimitati" },
      { name: "Timeline editor", free: false, premium: true, business: true },
      { name: "Faceless video", free: false, premium: true, business: true },
      { name: "Trailer generator", free: false, premium: true, business: true },
      { name: "Script-to-video", free: false, premium: true, business: true },
    ],
  },
  {
    name: "Integrazioni & API",
    features: [
      { name: "Accesso API", free: false, premium: true, business: true },
      { name: "Webhook & notifiche", free: false, premium: true, business: true },
      { name: "API dedicata", free: false, premium: false, business: true },
      { name: "Supporto prioritario", free: false, premium: false, business: true },
    ],
  },
];

function BillingToggle({ isAnnual, onToggle }: { isAnnual: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-10">
      <span className={`text-sm font-medium ${!isAnnual ? "text-foreground" : "text-muted-foreground"}`}>Mensile</span>
      <button
        onClick={onToggle}
        className={`relative w-14 h-7 rounded-full transition-colors ${isAnnual ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${isAnnual ? "translate-x-7" : "translate-x-0"}`} />
      </button>
      <span className={`text-sm font-medium ${isAnnual ? "text-foreground" : "text-muted-foreground"}`}>
        Annuale
        <Badge variant="secondary" className="ml-2 text-xs bg-primary/10 text-primary border-primary/20">-20%</Badge>
      </span>
    </div>
  );
}

export default function PricingPage() {
  const { quota, usedGenerations, isUnlimited } = useQuotas();
  const { tier, subscribed, subscriptionEnd, loading: subLoading, startCheckout, openCustomerPortal, checkSubscription } = useSubscription();
  const { isAdmin } = useUserRole();
  const [searchParams] = useSearchParams();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [welcomeShown, setWelcomeShown] = useState(false);
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = getPlans(isAnnual);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Pagamento completato! Aggiornamento del piano in corso...");
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

  useEffect(() => {
    if (tier === "premium" && subscribed && searchParams.get("success") === "true" && !welcomeShown) {
      setWelcomeShown(true);
      toast.success("🎉 Benvenuto nel piano Premium!", {
        description: "Hai sbloccato: Video 1080p, Voice Cloning, Timeline Editor, Multi-provider e molto altro. Buona creazione!",
        duration: 8000,
      });
    }
  }, [tier, subscribed, searchParams, welcomeShown]);

  const currentPlan = isAdmin ? "admin" : tier;

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const priceId = isAnnual ? STRIPE_TIERS.premium.price_id_yearly : STRIPE_TIERS.premium.price_id_monthly;
      await startCheckout(priceId);
    } catch {
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

          {/* Billing toggle */}
          <BillingToggle isAnnual={isAnnual} onToggle={() => setIsAnnual(!isAnnual)} />

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
                    {plan.yearlyTotal && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Fatturato {plan.yearlyTotal}
                      </p>
                    )}
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

          {/* Comparison Table */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-center mb-2">Confronto dettagliato</h2>
            <p className="text-muted-foreground text-center mb-10">Tutte le funzionalità a colpo d'occhio</p>

            <div className="border rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-4 bg-muted/50 border-b">
                <div className="p-4 font-semibold text-sm">Funzionalità</div>
                <div className="p-4 text-center font-semibold text-sm">Free</div>
                <div className="p-4 text-center font-semibold text-sm text-primary">Premium</div>
                <div className="p-4 text-center font-semibold text-sm">Business</div>
              </div>

              {comparisonCategories.map((category, ci) => (
                <div key={category.name}>
                  {/* Category header */}
                  <div className="grid grid-cols-4 bg-muted/30 border-b">
                    <div className="p-3 col-span-4 font-semibold text-sm text-primary">{category.name}</div>
                  </div>
                  {/* Features */}
                  {category.features.map((feature, fi) => (
                    <div
                      key={feature.name}
                      className={`grid grid-cols-4 border-b last:border-b-0 ${fi % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <div className="p-3 text-sm">{feature.name}</div>
                      {(["free", "premium", "business"] as const).map((plan) => {
                        const val = feature[plan];
                        return (
                          <div key={plan} className={`p-3 text-center text-sm ${plan === "premium" ? "bg-primary/5" : ""}`}>
                            {typeof val === "boolean" ? (
                              val ? <Check className="h-4 w-4 text-primary mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            ) : (
                              <span className="font-medium">{val}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
