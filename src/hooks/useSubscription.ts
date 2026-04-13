import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STRIPE_TIERS = {
  premium: {
    price_id_monthly: "price_1TLYCgR04kRDmaB2yYJAqTk4",
    price_id_yearly: "price_1TLYEJR04kRDmaB20EqvTwj6",
    product_id: "prod_UJ3ckIlkRtr8Y4",
  },
  creator: {
    price_id_monthly: "price_1TLY5WR04kRDmaB2cuDWkY9c",
    price_id_yearly: "price_1TLYEoR04kRDmaB2Dgcb4eQ1",
    product_id: "prod_UKCUBt1UvmhELT",
  },
  business: {
    price_id_monthly: "price_1TKRfhR04kRDmaB2Wur5VCM6",
    price_id_yearly: "price_1TKRglR04kRDmaB26aDLMPTW",
    product_id: "prod_UJ3nUlG2OGNxRA",
  },
} as const;

export type SubscriptionTier = "free" | "premium" | "creator" | "business";

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  tier: SubscriptionTier;
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

      let tier: SubscriptionTier = "free";
      if (data?.product_id === STRIPE_TIERS.business.product_id) tier = "business";
      else if (data?.product_id === STRIPE_TIERS.creator.product_id) tier = "creator";
      else if (data?.product_id === STRIPE_TIERS.premium.product_id) tier = "premium";

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