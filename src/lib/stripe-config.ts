// Stripe product and price IDs for each subscription tier
export const SUBSCRIPTION_TIERS = {
  pilot: {
    product_id: "prod_UgWsl9G2QOswh0",
    price_id: "price_1Th9oVQmZOh39j1D0fFQCTEZ",
    name: "Pilot",
  },
  professional: {
    product_id: "prod_UEHtumkbcklGo9",
    price_id: "price_1TFpJeQmZOh39j1DhRMONrvE",
    name: "Professional",
  },
  enterprise: {
    product_id: "prod_UEHt0iMTlWzL9Z",
    price_id: "price_1TFpJkQmZOh39j1DgEshSdyM",
    name: "Enterprise",
  },
} as const;

export type SubscriptionTier = "pilot" | "professional" | "enterprise" | null;

export function getTierByProductId(productId: string | null): SubscriptionTier {
  if (!productId) return null;
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.product_id === productId) return key as SubscriptionTier;
  }
  return null;
}
