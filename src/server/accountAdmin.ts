import type { User } from '@supabase/supabase-js';
import { env } from '@/server/env';
import {
  getServiceRoleSupabaseClient,
  type SupabaseClient,
} from '@/server/supabaseClient';

export type AccountRole = 'admin' | 'user';
export type AccountStatus = 'pending' | 'active' | 'disabled';
export type RegistrationIdentityPolicy =
  | 'email'
  | 'social'
  | 'email_or_social';

export type RegistrationSettings = {
  allowRegistration: boolean;
  requireAdminApproval: boolean;
  identityPolicy: RegistrationIdentityPolicy;
  allowedSocialProviders: string[];
};

export type AccountAccess = {
  userId: string;
  username: string | null;
  role: AccountRole;
  status: AccountStatus;
};

export type AdminUser = AccountAccess & {
  email: string | null;
  fullName: string | null;
  contactEmail: string | null;
  localAccount: boolean;
  providers: string[];
};

type AccountRow = {
  user_id: string;
  username: string | null;
  contact_email: string | null;
  role: AccountRole;
  status: AccountStatus;
};

type RegistrationRow = {
  id: number;
  allow_registration: boolean;
  require_admin_approval: boolean;
  identity_policy: RegistrationIdentityPolicy;
  allowed_social_providers: string[];
};

export const DEFAULT_REGISTRATION_SETTINGS: RegistrationSettings = {
  allowRegistration: false,
  requireAdminApproval: true,
  identityPolicy: 'email',
  allowedSocialProviders: ['google'],
};

export class AccountAdminError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
    this.name = 'AccountAdminError';
  }
}

// Database types are generated from the local Supabase schema. The branch adds
// these tables declaratively first; shared/database.ts must be regenerated with
// `supabase gen types typescript --local` after the generated migration exists.
// Keep the escape hatch isolated here so the rest of the feature stays typed.
function fromAccountTable(supabase: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

function isLocalAuthEmail(email: string | null | undefined) {
  return Boolean(email?.toLowerCase().endsWith('@pcad.invalid'));
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new AccountAdminError('invalid_username');
  }
  return username;
}

export function localAuthEmail(username: string) {
  return `${validateUsername(username)}@pcad.invalid`;
}

function realEmail(email: string | null | undefined) {
  if (!email || isLocalAuthEmail(email)) return null;
  return email;
}

function toAccess(row: AccountRow): AccountAccess {
  return {
    userId: row.user_id,
    username: row.username,
    role: row.role,
    status: row.status,
  };
}

async function getAccountRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountRow | null> {
  const { data, error } = await fromAccountTable(supabase, 'user_accounts')
    .select('user_id,username,contact_email,role,status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new AccountAdminError('failed_to_load_account', 500);
  return (data as AccountRow | null) ?? null;
}

async function materializeLegacyAccount(
  supabase: SupabaseClient,
  user: User,
): Promise<AccountRow> {
  const row: AccountRow = {
    user_id: user.id,
    username: isLocalAuthEmail(user.email)
      ? user.email!.slice(0, -'@pcad.invalid'.length)
      : null,
    contact_email: realEmail(user.email),
    role: 'user',
    status: 'active',
  };
  const { data, error } = await fromAccountTable(supabase, 'user_accounts')
    .upsert(row, { onConflict: 'user_id' })
    .select('user_id,username,contact_email,role,status')
    .single();
  if (error) throw new AccountAdminError('failed_to_create_account_state', 500);
  return data as AccountRow;
}

async function hasActiveAdmin(supabase: SupabaseClient) {
  const { count, error } = await fromAccountTable(supabase, 'user_accounts')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'active');
  if (error) throw new AccountAdminError('failed_to_check_admin', 500);
  return (count ?? 0) > 0;
}

async function canBootstrapAdmin(supabase: SupabaseClient, user: User) {
  const configuredEmail = env('PCAD_ADMIN_EMAIL').trim().toLowerCase();
  if (configuredEmail) {
    return user.email?.trim().toLowerCase() === configuredEmail;
  }

  // Safe zero-config local bootstrap: only a deployment with exactly one auth
  // user may promote that sole existing account automatically.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 2,
  });
  if (error) throw new AccountAdminError('failed_to_check_admin_bootstrap', 500);
  return data.users.length === 1 && data.users[0]?.id === user.id;
}

export async function getAccountAccess(
  user: User,
  options: { allowAdminBootstrap?: boolean } = {},
): Promise<AccountAccess> {
  const supabase = getServiceRoleSupabaseClient();
  let row = await getAccountRow(supabase, user.id);

  // A missing row means this is an account that predates the migration. It
  // remains active so rollout cannot lock out existing pCAD users.
  if (!row) row = await materializeLegacyAccount(supabase, user);

  if (
    options.allowAdminBootstrap &&
    !(await hasActiveAdmin(supabase)) &&
    (await canBootstrapAdmin(supabase, user))
  ) {
    const { data, error } = await fromAccountTable(supabase, 'user_accounts')
      .update({ role: 'admin', status: 'active' })
      .eq('user_id', user.id)
      .select('user_id,username,contact_email,role,status')
      .single();
    if (error) throw new AccountAdminError('failed_to_bootstrap_admin', 500);
    row = data as AccountRow;
  }

  return toAccess(row);
}

export async function requireAdmin(user: User): Promise<AccountAccess> {
  const access = await getAccountAccess(user, { allowAdminBootstrap: true });
  if (access.status !== 'active') {
    throw new AccountAdminError('account_not_active', 403);
  }
  if (access.role !== 'admin') {
    const supabase = getServiceRoleSupabaseClient();
    if (!(await hasActiveAdmin(supabase))) {
      throw new AccountAdminError('admin_bootstrap_required', 403);
    }
    throw new AccountAdminError('admin_required', 403);
  }
  return access;
}

export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const supabase = getServiceRoleSupabaseClient();
  const { data, error } = await fromAccountTable(
    supabase,
    'registration_settings',
  )
    .select(
      'id,allow_registration,require_admin_approval,identity_policy,allowed_social_providers',
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new AccountAdminError('failed_to_load_registration', 500);
  if (!data) return DEFAULT_REGISTRATION_SETTINGS;
  const row = data as RegistrationRow;
  return {
    allowRegistration: row.allow_registration,
    requireAdminApproval: row.require_admin_approval,
    identityPolicy: row.identity_policy,
    allowedSocialProviders: row.allowed_social_providers ?? [],
  };
}

export async function updateRegistrationSettings(
  input: RegistrationSettings,
): Promise<RegistrationSettings> {
  if (!['email', 'social', 'email_or_social'].includes(input.identityPolicy)) {
    throw new AccountAdminError('invalid_identity_policy');
  }
  const allowedSocialProviders = Array.from(
    new Set(
      input.allowedSocialProviders
        .map((provider) => provider.trim().toLowerCase())
        .filter((provider) => ['google', 'github'].includes(provider)),
    ),
  );
  if (
    (input.identityPolicy === 'social' ||
      input.identityPolicy === 'email_or_social') &&
    allowedSocialProviders.length === 0 &&
    input.identityPolicy === 'social'
  ) {
    throw new AccountAdminError('social_provider_required');
  }

  const supabase = getServiceRoleSupabaseClient();
  const { error } = await fromAccountTable(supabase, 'registration_settings')
    .upsert(
      {
        id: 1,
        allow_registration: Boolean(input.allowRegistration),
        require_admin_approval: Boolean(input.requireAdminApproval),
        identity_policy: input.identityPolicy,
        allowed_social_providers: allowedSocialProviders,
      },
      { onConflict: 'id' },
    );
  if (error) throw new AccountAdminError('failed_to_update_registration', 500);
  return getRegistrationSettings();
}

async function listAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new AccountAdminError('failed_to_list_users', 500);
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const supabase = getServiceRoleSupabaseClient();
  const users = await listAuthUsers(supabase);
  const { data: accountData, error: accountError } = await fromAccountTable(
    supabase,
    'user_accounts',
  ).select('user_id,username,contact_email,role,status');
  if (accountError) throw new AccountAdminError('failed_to_list_accounts', 500);

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('user_id,full_name');
  if (profileError) throw new AccountAdminError('failed_to_list_profiles', 500);

  const accounts = new Map<string, AccountRow>(
    ((accountData ?? []) as AccountRow[]).map((row) => [row.user_id, row]),
  );
  const profiles = new Map(
    (profileData ?? []).map((row) => [row.user_id, row.full_name]),
  );

  return users.map((user) => {
    const localAccount = isLocalAuthEmail(user.email);
    const account = accounts.get(user.id);
    const fallbackUsername = localAccount
      ? user.email!.slice(0, -'@pcad.invalid'.length)
      : null;
    return {
      userId: user.id,
      username: account?.username ?? fallbackUsername,
      role: account?.role ?? 'user',
      status: account?.status ?? 'active',
      email: account?.contact_email ?? realEmail(user.email),
      contactEmail: account?.contact_email ?? null,
      fullName: profiles.get(user.id) ?? null,
      localAccount,
      providers: Array.from(
        new Set((user.identities ?? []).map((identity) => identity.provider)),
      ),
    };
  });
}

export type CreateLocalUserInput = {
  username: string;
  password: string;
  fullName?: string;
  contactEmail?: string;
};

export async function createLocalUser(input: CreateLocalUserInput) {
  const username = validateUsername(input.username);
  if (input.password.length < 6) {
    throw new AccountAdminError('password_too_short');
  }
  const contactEmail = input.contactEmail?.trim() || null;
  if (contactEmail && !contactEmail.includes('@')) {
    throw new AccountAdminError('invalid_contact_email');
  }

  const supabase = getServiceRoleSupabaseClient();
  const { data: existing } = await fromAccountTable(supabase, 'user_accounts')
    .select('user_id')
    .eq('username', username)
    .maybeSingle();
  if (existing) throw new AccountAdminError('username_taken', 409);

  const { data, error } = await supabase.auth.admin.createUser({
    email: localAuthEmail(username),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName?.trim() || username,
      pcad_local_account: true,
    },
  });
  if (error || !data.user) {
    throw new AccountAdminError('failed_to_create_user', 500);
  }

  const { error: accountError } = await fromAccountTable(
    supabase,
    'user_accounts',
  ).upsert(
    {
      user_id: data.user.id,
      username,
      contact_email: contactEmail,
      role: 'user',
      status: 'active',
    },
    { onConflict: 'user_id' },
  );

  if (accountError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new AccountAdminError('failed_to_create_account_state', 500);
  }

  return { userId: data.user.id };
}

export type UpdateAdminUserInput = {
  userId: string;
  username?: string;
  password?: string;
  fullName?: string;
  contactEmail?: string | null;
  status?: AccountStatus;
};

export async function updateAdminUser(input: UpdateAdminUserInput) {
  const supabase = getServiceRoleSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(input.userId);
  if (error || !data.user) throw new AccountAdminError('user_not_found', 404);
  const user = data.user;
  let account = await getAccountRow(supabase, user.id);
  if (!account) account = await materializeLegacyAccount(supabase, user);

  if (input.status && !['pending', 'active', 'disabled'].includes(input.status)) {
    throw new AccountAdminError('invalid_account_status');
  }
  if (account.role === 'admin' && input.status && input.status !== 'active') {
    throw new AccountAdminError('cannot_disable_admin', 409);
  }

  const accountUpdates: Record<string, unknown> = {};
  let oldAuthEmail: string | null = null;

  if (input.username !== undefined) {
    if (!isLocalAuthEmail(user.email)) {
      throw new AccountAdminError('username_requires_local_account', 409);
    }
    const username = validateUsername(input.username);
    const { data: conflicting } = await fromAccountTable(
      supabase,
      'user_accounts',
    )
      .select('user_id')
      .eq('username', username)
      .neq('user_id', user.id)
      .maybeSingle();
    if (conflicting) throw new AccountAdminError('username_taken', 409);

    oldAuthEmail = user.email ?? null;
    const { error: authEmailError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email: localAuthEmail(username), email_confirm: true },
    );
    if (authEmailError) {
      throw new AccountAdminError('failed_to_update_username', 500);
    }
    accountUpdates.username = username;
  }

  if (input.password !== undefined) {
    if (input.password.length < 6) {
      throw new AccountAdminError('password_too_short');
    }
    const { error: passwordError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: input.password },
    );
    if (passwordError) {
      throw new AccountAdminError('failed_to_update_password', 500);
    }
  }

  if (input.fullName !== undefined) {
    const fullName = input.fullName.trim();
    if (!fullName) throw new AccountAdminError('full_name_required');
    const { error: authMetadataError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: { ...user.user_metadata, full_name: fullName },
      },
    );
    if (authMetadataError) {
      throw new AccountAdminError('failed_to_update_user_metadata', 500);
    }
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', user.id);
    if (profileError) throw new AccountAdminError('failed_to_update_profile', 500);
  }

  if (input.contactEmail !== undefined) {
    const contactEmail = input.contactEmail?.trim() || null;
    if (contactEmail && !contactEmail.includes('@')) {
      throw new AccountAdminError('invalid_contact_email');
    }
    accountUpdates.contact_email = contactEmail;
  }
  if (input.status !== undefined) accountUpdates.status = input.status;

  if (Object.keys(accountUpdates).length > 0) {
    const { error: accountError } = await fromAccountTable(
      supabase,
      'user_accounts',
    )
      .update(accountUpdates)
      .eq('user_id', user.id);
    if (accountError) {
      if (oldAuthEmail) {
        await supabase.auth.admin.updateUserById(user.id, {
          email: oldAuthEmail,
          email_confirm: true,
        });
      }
      throw new AccountAdminError('failed_to_update_account', 500);
    }
  }

  return { success: true };
}

export async function assertUserCanBeDeleted(userId: string) {
  const supabase = getServiceRoleSupabaseClient();
  const row = await getAccountRow(supabase, userId);
  if (!row || row.role !== 'admin') return;

  const { count, error } = await fromAccountTable(supabase, 'user_accounts')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('status', 'active');
  if (error) throw new AccountAdminError('failed_to_check_admin', 500);
  if ((count ?? 0) <= 1) {
    throw new AccountAdminError('cannot_delete_last_admin', 409);
  }
}
