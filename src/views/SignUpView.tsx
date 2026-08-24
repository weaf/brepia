import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery } from '@tanstack/react-query';
import { GoogleIcon } from '@/components/icons/CompanyIcons';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { validateRedirectUrl } from '@/lib/utils';
import { getRegistrationSettings } from '@/services/accountAdminService';

function getAppRedirectUrl(path: string) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${basePath}${path}`;
}

export function SignUpView() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, user, isLoading: authLoading } = useAuth();
  const { data: registration, isLoading: policyLoading } = useQuery({
    queryKey: ['registration-settings'],
    queryFn: getRegistrationSettings,
  });

  const searchParams = new URLSearchParams(location.searchStr);
  const redirectPath = validateRedirectUrl(searchParams.get('redirect'));

  useEffect(() => {
    if (!authLoading && session && user) navigate({ to: '/', replace: true });
  }, [session, user, authLoading, navigate]);

  const { mutate: signInWithGoogle, isPending: isSigningInWithGoogle } =
    useMutation({
      mutationFn: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: getAppRedirectUrl(redirectPath) },
        });
        if (error) throw error;
      },
      onError: (error) =>
        toast({
          title: 'Whoopsies',
          description:
            error instanceof Error ? error.message : 'Something went wrong',
          variant: 'destructive',
        }),
    });

  const emailAllowed =
    registration?.identityPolicy === 'email' ||
    registration?.identityPolicy === 'email_or_social';
  const socialAllowed =
    (registration?.identityPolicy === 'social' ||
      registration?.identityPolicy === 'email_or_social') &&
    registration.allowedSocialProviders.includes('google');

  return (
    <div className="flex min-h-screen items-center justify-center bg-adam-bg-dark p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-adam-bg-secondary-dark p-8 shadow-md">
          <div className="mb-4 flex flex-col items-center justify-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}/cadam-logo.svg`}
              alt="CADAM Logo"
              className="h-8 w-auto"
            />
            <h1 className="text-xl font-semibold text-white">Create account</h1>
          </div>

          {policyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          ) : !registration?.allowRegistration ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-adam-text-secondary">
                Self registration is disabled. Ask an administrator to create
                your account.
              </p>
              <Link to="/signin" className="text-sm text-adam-blue hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {socialAllowed && (
                <div className="w-full py-2">
                  <Button
                    onClick={() => signInWithGoogle()}
                    className="flex w-full items-center gap-2 p-6 md:hover:bg-adam-blue/10"
                    disabled={isSigningInWithGoogle}
                  >
                    <GoogleIcon className="w-4" />
                    <span>Continue with Google</span>
                  </Button>
                </div>
              )}

              {emailAllowed && (
                <div className="pt-4 text-center text-sm text-adam-text-secondary">
                  <Link
                    to="/signup-email"
                    className="text-adam-text-primary hover:underline"
                  >
                    Sign up with email
                  </Link>
                </div>
              )}

              {!emailAllowed && !socialAllowed && (
                <p className="py-4 text-center text-sm text-adam-text-secondary">
                  No configured registration provider is currently available.
                </p>
              )}

              {registration.requireAdminApproval && (
                <p className="mt-4 text-center text-xs text-adam-text-secondary">
                  New accounts require administrator approval before pCAD can be
                  used.
                </p>
              )}
              <div className="pt-4 text-center text-sm">
                <Link to="/signin" className="text-adam-blue hover:underline">
                  Already have an account? Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
