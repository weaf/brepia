import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiJson } from '@/services/api';
import { AuthContext } from './AuthContext';
import {
  LegacyBillingContext,
  type BillingStatus,
} from './legacyBillingContext';

const LOCAL_BILLING_STATUS: BillingStatus = {
  user: { hasTrialed: false },
  subscription: {
    level: 'pro',
    status: 'active',
    currentPeriodEnd: new Date(
      Date.now() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString(),
  },
  tokens: {
    free: 1_000_000,
    subscription: 1_000_000,
    purchased: 1_000_000,
    total: 3_000_000,
  },
};

const billingStatusSchema = z.object({
  user: z.object({ hasTrialed: z.boolean() }),
  subscription: z
    .object({
      level: z.union([
        z.literal('standard'),
        z.literal('pro'),
        z.literal('max'),
      ]),
      status: z.string().nullable(),
      currentPeriodEnd: z.string().nullable(),
    })
    .nullable(),
  tokens: z.object({
    free: z.number(),
    subscription: z.number(),
    purchased: z.number(),
    total: z.number(),
  }),
});

/**
 * Transitional billing boundary used only until Step 3 removes the remaining
 * credits/subscription UI. Billing no longer participates in auth/session
 * state or auth loading; this provider exists solely so legacy UI consumers
 * keep their current data source while they are removed independently.
 */
export function LegacyBillingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useContext(AuthContext);
  if (auth === undefined) {
    throw new Error('LegacyBillingProvider must be used within AuthProvider');
  }

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing', 'status'],
    enabled: !!auth.user,
    refetchInterval: 30000,
    queryFn: async (): Promise<BillingStatus> => {
      try {
        return await apiJson('billing-status', {}, billingStatusSchema);
      } catch (error) {
        if (import.meta.env.DEV) return LOCAL_BILLING_STATUS;
        throw error;
      }
    },
  });

  return (
    <LegacyBillingContext.Provider
      value={{ billing: billing ?? null, isLoading }}
    >
      {children}
    </LegacyBillingContext.Provider>
  );
}
