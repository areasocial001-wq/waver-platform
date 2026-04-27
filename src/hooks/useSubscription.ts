// Commercial features removed: this hook is now a no-op stub that grants
// full access to every user. Kept to preserve the API surface used across
// the codebase without forcing a large refactor.

export type SubscriptionTier = "free" | "premium" | "creator" | "business";

export const STRIPE_TIERS = {
  premium: { price_id_monthly: "", price_id_yearly: "", product_id: "" },
  creator: { price_id_monthly: "", price_id_yearly: "", product_id: "" },
  business: { price_id_monthly: "", price_id_yearly: "", product_id: "" },
} as const;

export const useSubscription = () => {
  return {
    subscribed: true,
    productId: null as string | null,
    subscriptionEnd: null as string | null,
    loading: false,
    tier: "business" as SubscriptionTier,
    checkSubscription: async () => {},
    startCheckout: async (_priceId: string) => {},
    openCustomerPortal: async () => {},
  };
};
