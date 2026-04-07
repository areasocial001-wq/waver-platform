import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STRIPE_TIERS = {
  premium: {
    price_id: "price_1TFcd4R04kRDmaB2V69i8JZ7",
    product_id: "prod_UE4miTNOOaQ5jZ",
  },
} as const;

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  tier: "free" | "premium";
}

export const useSubscription = () => {
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    subscriptionEnd: null,
    loading: true,
    tier: "free",
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      const tier = data?.product_id === STRIPE_TIERS.premium.product_id ? "premium" : "free";

      setState({
        subscribed: data?.subscribed || false,
        productId: data?.product_id || null,
        subscriptionEnd: data?.subscription_end || null,
        loading: false,
        tier,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const startCheckout = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  };

  const openCustomerPortal = async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  };

  return {
    ...state,
    checkSubscription,
    startCheckout,
    openCustomerPortal,
  };
};
