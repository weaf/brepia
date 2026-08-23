import { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { LegacyBillingContext } from './legacyBillingContext';

export {
  getLevel,
  type BillingStatus,
  type PlanLevel,
  type SubscriptionLevel,
} from './legacyBillingContext';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

/**
 * AuthContext itself is billing-free. The merged `billing` field below is a
 * temporary compatibility bridge for legacy billing UI and is removed in
 * Step 3 together with those consumers. Billing does not affect `isLoading`.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  const legacyBilling = useContext(LegacyBillingContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return {
    ...context,
    billing: legacyBilling.billing,
    billingIsLoading: legacyBilling.isLoading,
  };
}
