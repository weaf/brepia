import { createContext } from 'react';

export type SubscriptionLevel = 'standard' | 'pro' | 'max';
export type PlanLevel = SubscriptionLevel | 'free';

export type BillingStatus = {
  user: {
    hasTrialed: boolean;
  };
  subscription: {
    level: SubscriptionLevel;
    status: string | null;
    currentPeriodEnd: string | null;
  } | null;
  tokens: {
    free: number;
    subscription: number;
    purchased: number;
    total: number;
  };
};

const ACTIVE_STATUSES = new Set(['active', 'trialing']);

export function getLevel(billing: BillingStatus | null | undefined): PlanLevel {
  if (!billing?.subscription) return 'free';
  if (!ACTIVE_STATUSES.has(billing.subscription.status ?? '')) return 'free';
  return billing.subscription.level;
}

export type LegacyBillingContextValue = {
  billing: BillingStatus | null;
  isLoading: boolean;
};

export const LegacyBillingContext = createContext<LegacyBillingContextValue>({
  billing: null,
  isLoading: false,
});
