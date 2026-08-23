import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ssoProvider } from '@/lib/supabase';
import { signInWithSsoProvider } from '@/lib/ssoAuth';
import { getAccountAccess } from '@/services/accountAdminService';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { session, user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasFiredSsoRedirect = useRef(false);

  const { data: access, isLoading: isAccessLoading } = useQuery({
    queryKey: ['account-access', user?.id],
    queryFn: getAccountAccess,
    enabled: Boolean(session && user),
    staleTime: 15_000,
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading && !session && !user) {
      const currentPath = location.pathname + location.searchStr;

      if (ssoProvider) {
        if (hasFiredSsoRedirect.current) return;
        hasFiredSsoRedirect.current = true;

        signInWithSsoProvider(currentPath).catch((error) => {
          toast({
            title: 'Whoopsies',
            description:
              error instanceof Error ? error.message : 'Something went wrong',
            variant: 'destructive',
          });
          navigate({ to: '/', replace: true });
        });
        return;
      }

      const search = currentPath !== '/' ? { redirect: currentPath } : {};
      navigate({ to: '/signin', search, replace: true });
    }
  }, [
    session,
    user,
    navigate,
    isLoading,
    location.pathname,
    location.searchStr,
  ]);

  if (isLoading || (session && user && isAccessLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session || !user) {
    if (ssoProvider) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      );
    }
    return null;
  }

  if (access?.status === 'pending' || access?.status === 'disabled') {
    const pending = access.status === 'pending';
    return (
      <div className="flex min-h-screen items-center justify-center bg-adam-background-1 px-4">
        <div className="w-full max-w-md rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-8 text-center">
          <h1 className="text-xl font-medium text-adam-neutral-50">
            {pending ? 'Account awaiting approval' : 'Account disabled'}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-adam-neutral-200">
            {pending
              ? 'An administrator must approve this account before pCAD can be used.'
              : 'This account has been disabled by an administrator.'}
          </p>
          <Button
            variant="dark"
            className="mt-6 rounded-full"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  // If the access endpoint is unavailable, protected APIs still enforce the
  // active-account rule. Avoid rendering the application until status is known.
  if (!access) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-adam-background-1 px-4">
        <div className="w-full max-w-md rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-8 text-center">
          <h1 className="text-xl font-medium text-adam-neutral-50">
            Account access unavailable
          </h1>
          <p className="mt-3 text-sm text-adam-neutral-200">
            pCAD could not verify the account status. Check the local Supabase
            service and try again.
          </p>
          <Button
            variant="dark"
            className="mt-6 rounded-full"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
