import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DeleteAccountDialog } from '@/components/auth/DeleteAccountDialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import * as Sentry from '@sentry/react';
import { useProfile, useUpdateProfile } from '@/services/profileService';
import { AvatarUpdateDialog } from '@/components/auth/AvatarUpdateDialog';
import { accountUrl, ssoManaged } from '@/lib/supabase';
import { AiSettingsSection } from '@/components/settings/AiSettingsSection';
import { AdminSettingsSection } from '@/components/settings/AdminSettingsSection';
import { DebugSettingsSection } from '@/components/settings/DebugSettingsSection';
import { InstanceIdentitySettingsSection } from '@/components/settings/InstanceIdentitySettingsSection';
import { InstanceLegalLinks } from '@/components/settings/InstanceLegalLinks';
import { ActivityIndicator } from '@/components/brand';

export default function SettingsView() {
  const { user, resetPassword } = useAuth();
  const { data: profile } = useProfile();
  const { mutate: updateProfile, isPending: isUpdateLoading } =
    useUpdateProfile();
  const { toast } = useToast();
  const [newName, setNewName] = useState(profile?.full_name || '');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  useEffect(() => {
    setNewName(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleUpdateName = () => {
    updateProfile(
      { full_name: newName },
      {
        onSuccess: () => {
          setEditingName(false);
          setNewName(profile?.full_name || '');
          toast({ title: 'Success', description: 'Your name has been updated' });
        },
        onError: (e) => {
          Sentry.captureException(e);
          toast({
            title: 'Error',
            description: 'Failed to update name',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleUpdateNotifications = async (notificationsEnabled: boolean) => {
    updateProfile(
      { notifications_enabled: notificationsEnabled },
      {
        onSuccess: () =>
          toast({
            title: 'Success',
            description: 'Your notifications have been updated',
          }),
        onError: (e) => {
          Sentry.captureException(e);
          toast({
            title: 'Error',
            description: 'Failed to update notifications',
            variant: 'destructive',
          });
        },
      },
    );
  };

  const { mutate: handleResetPassword, isPending: isResetLoading } =
    useMutation({
      mutationFn: async () => {
        if (!user?.email) throw new Error('User email not found');
        await resetPassword(user.email);
      },
      onSuccess: () =>
        toast({
          title: 'Success',
          description:
            'Password reset instructions have been sent to your email',
        }),
      onError: () =>
        toast({
          title: 'Error',
          description: 'Failed to reset password',
          variant: 'destructive',
        }),
    });

  const localAccount = user?.email?.endsWith('@pcad.invalid') ?? false;

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-adam-background-1 px-6 py-10">
      <div className="w-full max-w-xl">
        <header className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight text-adam-neutral-50">
            Settings
          </h1>
          <p className="mt-1 text-sm text-adam-neutral-200">
            Manage your account and preferences.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
            <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
              Account
            </h2>

            {ssoManaged ? (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <AvatarUpdateDialog className="h-10 w-10" />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-adam-neutral-50">
                      {profile?.full_name || user?.email}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-adam-neutral-200">
                      {user?.email}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-adam-neutral-800 pt-5">
                  <div className="min-w-0">
                    <div className="text-sm text-adam-neutral-50">
                      Manage account
                    </div>
                    <div className="mt-0.5 text-xs leading-relaxed text-adam-neutral-200">
                      Update your name, email, password, and account details in
                      your account. Brepia avatar icons remain local to this
                      application.
                    </div>
                  </div>
                  <a
                    href={accountUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="dark" className="rounded-full font-light">
                      Manage account
                    </Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-adam-neutral-800">
                <div className="flex items-center justify-between gap-4 pb-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <AvatarUpdateDialog />
                    {editingName ? (
                      <Input
                        ref={nameInputRef}
                        value={newName}
                        className="h-9 w-full max-w-xs"
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleUpdateName();
                          }
                        }}
                      />
                    ) : (
                      <div className="min-w-0 truncate text-sm text-adam-neutral-50">
                        {profile?.full_name || user?.email}
                      </div>
                    )}
                  </div>
                  {editingName ? (
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <Button
                        onClick={() => handleUpdateName()}
                        variant="light"
                        disabled={isUpdateLoading}
                        className="rounded-full font-light"
                      >
                        {isUpdateLoading ? (
                          <ActivityIndicator label="Saving name" size="sm" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setEditingName(false);
                          setNewName(profile?.full_name || '');
                        }}
                        variant="dark"
                        className="rounded-full font-light"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setEditingName(true)}
                      variant="dark"
                      className="flex-shrink-0 rounded-full font-light"
                    >
                      Edit
                    </Button>
                  )}
                </div>

                <div className="py-5">
                  <div className="text-sm text-adam-neutral-50">
                    {localAccount ? 'Account type' : 'Email'}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-adam-neutral-200">
                    {localAccount ? 'Local username/password account' : user?.email}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-5">
                  <div className="min-w-0">
                    <div className="text-sm text-adam-neutral-50">Password</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-adam-neutral-200">
                      {localAccount
                        ? 'Password is managed by an administrator'
                        : 'Send a reset link to your email'}
                    </div>
                  </div>
                  {!localAccount && (
                    <Button
                      onClick={() => handleResetPassword()}
                      disabled={isResetLoading}
                      variant="dark"
                      className="flex-shrink-0 rounded-full font-light"
                    >
                      {isResetLoading ? (
                        <ActivityIndicator
                          label="Sending password reset"
                          size="sm"
                        />
                      ) : (
                        'Reset Password'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
            <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
              Notifications
            </h2>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-adam-neutral-50">Responses</div>
                <div className="mt-0.5 text-xs leading-relaxed text-adam-neutral-200">
                  Get notified when Brepia finishes a long-running request.
                </div>
              </div>
              <Switch
                className="mt-0.5"
                checked={profile?.notifications_enabled ?? false}
                onCheckedChange={handleUpdateNotifications}
              />
            </div>
          </section>

          {!ssoManaged && (
            <section className="rounded-xl border border-adam-neutral-800 bg-adam-background-2 p-6">
              <h2 className="mb-5 text-sm font-medium text-adam-neutral-50">
                Data and privacy
              </h2>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-adam-neutral-50">
                    Delete account
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-adam-neutral-200">
                    Permanently delete your account and all associated data.
                  </div>
                </div>
                <DeleteAccountDialog>
                  <Button
                    className="flex-shrink-0 rounded-full font-light"
                    variant="destructive"
                  >
                    Delete
                  </Button>
                </DeleteAccountDialog>
              </div>
            </section>
          )}

          <AdminSettingsSection />
          <InstanceIdentitySettingsSection />
          <AiSettingsSection />
          <DebugSettingsSection />
          <InstanceLegalLinks />
        </div>
      </div>
    </div>
  );
}
