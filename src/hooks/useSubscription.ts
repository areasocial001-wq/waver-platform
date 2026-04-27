// Commercial features removed: this hook is now a no-op stub that grants
// full access to every user. Kept to preserve the API surface used across
// the codebase without forcing a large refactor.

export type AccessTier = "full";

export const useSubscription = () => {
  return {
    subscribed: true,
    loading: false,
    tier: "full" as AccessTier,
    refresh: async () => {},
  };
};
