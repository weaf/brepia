import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

const hoisted = vi.hoisted(() => ({
  queryQueue: [] as QueryResult[],
  dbCalls: [] as Array<{
    table: string;
    operation: 'update' | 'upsert';
    value: unknown;
  }>,
  listUsers: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
}));

function nextQueryResult(): QueryResult {
  const result = hoisted.queryQueue.shift();
  if (!result) throw new Error('accountAdmin test query queue exhausted');
  return {
    data: result.data ?? null,
    error: result.error ?? null,
    count: result.count ?? null,
  };
}

function makeQuery(table: string) {
  const query: Record<string, unknown> = {};

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.update = vi.fn((value: unknown) => {
    hoisted.dbCalls.push({ table, operation: 'update', value });
    return query;
  });
  query.upsert = vi.fn((value: unknown) => {
    hoisted.dbCalls.push({ table, operation: 'upsert', value });
    return query;
  });
  query.maybeSingle = vi.fn(async () => nextQueryResult());
  query.single = vi.fn(async () => nextQueryResult());
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(nextQueryResult()).then(resolve, reject);

  return query;
}

vi.mock('@/server/supabaseClient', () => ({
  getServiceRoleSupabaseClient: () => ({
    auth: {
      admin: {
        listUsers: hoisted.listUsers,
        createUser: hoisted.createUser,
        getUserById: hoisted.getUserById,
        updateUserById: hoisted.updateUserById,
        deleteUser: hoisted.deleteUser,
      },
    },
    from: (table: string) => makeQuery(table),
  }),
}));

function authUser(id = 'user-1', email = 'admin@example.com') {
  return {
    id,
    email,
    identities: [],
    user_metadata: {},
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-24T00:00:00.000Z',
  };
}

function accountRow(
  overrides: Partial<{
    user_id: string;
    username: string | null;
    contact_email: string | null;
    role: 'admin' | 'user';
    status: 'pending' | 'active' | 'disabled';
  }> = {},
) {
  return {
    user_id: 'user-1',
    username: null,
    contact_email: 'admin@example.com',
    role: 'admin' as const,
    status: 'active' as const,
    ...overrides,
  };
}

async function expectAccountAdminError(
  promise: Promise<unknown>,
  expectedCode: string,
  expectedStatus: number,
) {
  await expect(promise).rejects.toMatchObject({
    name: 'AccountAdminError',
    code: expectedCode,
    status: expectedStatus,
  });
}

describe('account administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.queryQueue.length = 0;
    hoisted.dbCalls.length = 0;
    hoisted.updateUserById.mockResolvedValue({ data: {}, error: null });
    hoisted.deleteUser.mockResolvedValue({ data: {}, error: null });
  });

  describe('registration bootstrap state', () => {
    it('offers bootstrap on an empty installation even when registration is disabled', async () => {
      hoisted.queryQueue.push({
        data: {
          id: 1,
          allow_registration: false,
          require_admin_approval: true,
          identity_policy: 'email',
          allowed_social_providers: ['google'],
        },
      });
      hoisted.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

      const { getRegistrationSettings } = await import('@/server/accountAdmin');
      await expect(getRegistrationSettings()).resolves.toEqual({
        allowRegistration: false,
        requireAdminApproval: true,
        identityPolicy: 'email',
        allowedSocialProviders: ['google'],
        bootstrapAvailable: true,
      });
    });

    it('turns bootstrap off as soon as an auth user exists', async () => {
      hoisted.queryQueue.push({
        data: {
          id: 1,
          allow_registration: false,
          require_admin_approval: true,
          identity_policy: 'email',
          allowed_social_providers: ['google'],
        },
      });
      hoisted.listUsers.mockResolvedValue({
        data: { users: [authUser()] },
        error: null,
      });

      const { getRegistrationSettings } = await import('@/server/accountAdmin');
      await expect(getRegistrationSettings()).resolves.toMatchObject({
        bootstrapAvailable: false,
      });
    });
  });

  describe('first administrator bootstrap', () => {
    it('creates a username bootstrap account with the trusted marker', async () => {
      hoisted.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
      hoisted.createUser.mockResolvedValue({
        data: { user: authUser('first-admin', 'alice@pcad.invalid') },
        error: null,
      });
      hoisted.queryQueue.push({
        data: accountRow({
          user_id: 'first-admin',
          username: 'alice',
          contact_email: null,
        }),
      });

      const { bootstrapFirstAdmin } = await import('@/server/accountAdmin');
      await expect(
        bootstrapFirstAdmin({ identifier: ' Alice ', password: 'secret1' }),
      ).resolves.toEqual({
        userId: 'first-admin',
        username: 'alice',
        email: null,
      });

      expect(hoisted.createUser).toHaveBeenCalledWith({
        email: 'alice@pcad.invalid',
        password: 'secret1',
        email_confirm: true,
        app_metadata: { pcad_bootstrap: true },
        user_metadata: { full_name: 'alice' },
      });
    });

    it('creates an email bootstrap account with the trusted marker', async () => {
      hoisted.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
      hoisted.createUser.mockResolvedValue({
        data: { user: authUser('first-admin', 'owner@example.com') },
        error: null,
      });
      hoisted.queryQueue.push({
        data: accountRow({
          user_id: 'first-admin',
          username: null,
          contact_email: 'owner@example.com',
        }),
      });

      const { bootstrapFirstAdmin } = await import('@/server/accountAdmin');
      await expect(
        bootstrapFirstAdmin({
          identifier: 'Owner@Example.com',
          password: 'secret1',
        }),
      ).resolves.toEqual({
        userId: 'first-admin',
        username: null,
        email: 'owner@example.com',
      });

      expect(hoisted.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'owner@example.com',
          app_metadata: { pcad_bootstrap: true },
        }),
      );
    });

    it('rejects bootstrap when any auth user already exists', async () => {
      hoisted.listUsers.mockResolvedValue({
        data: { users: [authUser()] },
        error: null,
      });

      const { bootstrapFirstAdmin } = await import('@/server/accountAdmin');
      await expectAccountAdminError(
        bootstrapFirstAdmin({ identifier: 'alice', password: 'secret1' }),
        'bootstrap_unavailable',
        409,
      );
      expect(hoisted.createUser).not.toHaveBeenCalled();
    });

    it('removes a created auth user if the database did not make it active admin', async () => {
      hoisted.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
      hoisted.createUser.mockResolvedValue({
        data: { user: authUser('first-admin', 'alice@pcad.invalid') },
        error: null,
      });
      hoisted.queryQueue.push({
        data: accountRow({
          user_id: 'first-admin',
          username: 'alice',
          contact_email: null,
          role: 'user',
        }),
      });

      const { bootstrapFirstAdmin } = await import('@/server/accountAdmin');
      await expectAccountAdminError(
        bootstrapFirstAdmin({ identifier: 'alice', password: 'secret1' }),
        'bootstrap_unavailable',
        409,
      );
      expect(hoisted.deleteUser).toHaveBeenCalledWith('first-admin');
    });
  });

  describe('active administrator invariant', () => {
    it('blocks demoting the last active administrator', async () => {
      hoisted.getUserById.mockResolvedValue({
        data: { user: authUser() },
        error: null,
      });
      hoisted.queryQueue.push({ data: accountRow() }, { count: 0 });

      const { updateAdminUser } = await import('@/server/accountAdmin');
      await expectAccountAdminError(
        updateAdminUser({ userId: 'user-1', role: 'user' }),
        'cannot_remove_last_admin',
        409,
      );
      expect(hoisted.dbCalls).toEqual([]);
    });

    it('blocks disabling the last active administrator', async () => {
      hoisted.getUserById.mockResolvedValue({
        data: { user: authUser() },
        error: null,
      });
      hoisted.queryQueue.push({ data: accountRow() }, { count: 0 });

      const { updateAdminUser } = await import('@/server/accountAdmin');
      await expectAccountAdminError(
        updateAdminUser({ userId: 'user-1', status: 'disabled' }),
        'cannot_remove_last_admin',
        409,
      );
      expect(hoisted.dbCalls).toEqual([]);
    });

    it('allows demotion when another active administrator exists', async () => {
      hoisted.getUserById.mockResolvedValue({
        data: { user: authUser() },
        error: null,
      });
      hoisted.queryQueue.push(
        { data: accountRow() },
        { count: 1 },
        { data: null },
      );

      const { updateAdminUser } = await import('@/server/accountAdmin');
      await expect(
        updateAdminUser({ userId: 'user-1', role: 'user' }),
      ).resolves.toEqual({ success: true });
      expect(hoisted.dbCalls).toContainEqual({
        table: 'user_accounts',
        operation: 'update',
        value: { role: 'user' },
      });
    });

    it('blocks deletion of the last active administrator', async () => {
      hoisted.queryQueue.push({ data: accountRow() }, { count: 0 });

      const { assertUserCanBeDeleted } = await import('@/server/accountAdmin');
      await expectAccountAdminError(
        assertUserCanBeDeleted('user-1'),
        'cannot_remove_last_admin',
        409,
      );
    });

    it('allows deletion eligibility when another active administrator exists', async () => {
      hoisted.queryQueue.push({ data: accountRow() }, { count: 1 });

      const { assertUserCanBeDeleted } = await import('@/server/accountAdmin');
      await expect(assertUserCanBeDeleted('user-1')).resolves.toBeUndefined();
    });

    it('does not apply the last-admin check to a normal user', async () => {
      hoisted.queryQueue.push({ data: accountRow({ role: 'user' }) });

      const { assertUserCanBeDeleted } = await import('@/server/accountAdmin');
      await expect(assertUserCanBeDeleted('user-1')).resolves.toBeUndefined();
      expect(hoisted.queryQueue).toHaveLength(0);
    });
  });
});
