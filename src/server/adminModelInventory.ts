import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { conversationWorkspaceRoot } from './conversationWorkspace';
import { getServiceRoleSupabaseClient } from './supabaseClient';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODEL_EXTENSIONS = new Set([
  '3mf',
  'dxf',
  'glb',
  'gltf',
  'obj',
  'off',
  'ply',
  'scad',
  'step',
  'stl',
  'stp',
]);

export type AdminModelFileKind = 'generated' | 'parametric' | 'export';

export type AdminModelFile = {
  name: string;
  relativePath: string;
  absolutePath: string;
  kind: AdminModelFileKind;
  sizeBytes: number;
  modifiedAt: string;
};

export type AdminConversationWorkspace = {
  conversationId: string;
  title: string | null;
  type: string | null;
  userId: string | null;
  ownerLabel: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  workspacePath: string;
  totalBytes: number;
  fileCount: number;
  modelCount: number;
  orphaned: boolean;
  models: AdminModelFile[];
};

export type AdminModelInventory = {
  workspaceRoot: string;
  workspaceCount: number;
  orphanedCount: number;
  modelCount: number;
  totalBytes: number;
  workspaces: AdminConversationWorkspace[];
};

type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  type: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string;
};

type AccountRow = {
  user_id: string;
  username: string | null;
  contact_email: string | null;
};

type WalkResult = {
  totalBytes: number;
  fileCount: number;
  models: AdminModelFile[];
};

function modelKind(relativePath: string): AdminModelFileKind | null {
  const normalized = relativePath.replaceAll('\\', '/');
  const extension = normalized.split('.').at(-1)?.toLowerCase() ?? '';
  if (!MODEL_EXTENSIONS.has(extension)) return null;
  if (normalized.startsWith('models/generated/')) return 'generated';
  if (normalized.startsWith('models/')) return 'parametric';
  if (normalized.startsWith('exports/')) return 'export';
  return null;
}

async function walkWorkspace(root: string, directory: string): Promise<WalkResult> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return { totalBytes: 0, fileCount: 0, models: [] };
    }
    throw error;
  }

  let totalBytes = 0;
  let fileCount = 0;
  const models: AdminModelFile[] = [];

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const nested = await walkWorkspace(root, absolutePath);
      totalBytes += nested.totalBytes;
      fileCount += nested.fileCount;
      models.push(...nested.models);
      continue;
    }
    if (!entry.isFile()) continue;

    const fileStat = await stat(absolutePath);
    totalBytes += fileStat.size;
    fileCount += 1;
    const relativePath = relative(root, absolutePath).replaceAll('\\', '/');
    const kind = modelKind(relativePath);
    if (!kind) continue;
    models.push({
      name: entry.name,
      relativePath,
      absolutePath,
      kind,
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
    });
  }

  return { totalBytes, fileCount, models };
}

function chunks<T>(values: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export async function listAdminModelInventory(): Promise<AdminModelInventory> {
  const workspaceRoot = conversationWorkspaceRoot();
  let entries;
  try {
    entries = await readdir(workspaceRoot, { withFileTypes: true });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {
        workspaceRoot,
        workspaceCount: 0,
        orphanedCount: 0,
        modelCount: 0,
        totalBytes: 0,
        workspaces: [],
      };
    }
    throw error;
  }

  const conversationIds = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.isSymbolicLink() &&
        UUID_PATTERN.test(entry.name),
    )
    .map((entry) => entry.name);

  const supabase = getServiceRoleSupabaseClient();
  const conversations: ConversationRow[] = [];
  for (const batch of chunks(conversationIds)) {
    if (batch.length === 0) continue;
    const { data, error } = await supabase
      .from('conversations')
      .select('id,user_id,title,type,created_at,updated_at')
      .in('id', batch);
    if (error) throw error;
    conversations.push(...((data ?? []) as ConversationRow[]));
  }
  const conversationById = new Map(conversations.map((row) => [row.id, row]));

  const userIds = Array.from(new Set(conversations.map((row) => row.user_id)));
  const profiles: ProfileRow[] = [];
  const accounts: AccountRow[] = [];
  for (const batch of chunks(userIds)) {
    if (batch.length === 0) continue;
    const [profileResult, accountResult] = await Promise.all([
      supabase.from('profiles').select('user_id,full_name').in('user_id', batch),
      supabase
        .from('user_accounts')
        .select('user_id,username,contact_email')
        .in('user_id', batch),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (accountResult.error) throw accountResult.error;
    profiles.push(...((profileResult.data ?? []) as ProfileRow[]));
    accounts.push(...((accountResult.data ?? []) as AccountRow[]));
  }
  const profileByUser = new Map(profiles.map((row) => [row.user_id, row]));
  const accountByUser = new Map(accounts.map((row) => [row.user_id, row]));

  const workspaces: AdminConversationWorkspace[] = [];
  for (const conversationId of conversationIds) {
    const workspacePath = join(workspaceRoot, conversationId);
    const disk = await walkWorkspace(workspacePath, workspacePath);
    const row = conversationById.get(conversationId) ?? null;
    const profile = row ? profileByUser.get(row.user_id) : null;
    const account = row ? accountByUser.get(row.user_id) : null;
    const ownerLabel = row
      ? profile?.full_name ||
        account?.username ||
        account?.contact_email ||
        row.user_id
      : null;

    workspaces.push({
      conversationId,
      title: row?.title ?? null,
      type: row?.type ?? null,
      userId: row?.user_id ?? null,
      ownerLabel,
      createdAt: row?.created_at ?? null,
      updatedAt: row?.updated_at ?? null,
      workspacePath,
      totalBytes: disk.totalBytes,
      fileCount: disk.fileCount,
      modelCount: disk.models.length,
      orphaned: row === null,
      models: disk.models.sort((a, b) =>
        b.modifiedAt.localeCompare(a.modifiedAt),
      ),
    });
  }

  workspaces.sort((a, b) => {
    if (a.orphaned !== b.orphaned) return a.orphaned ? -1 : 1;
    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
  });

  return {
    workspaceRoot,
    workspaceCount: workspaces.length,
    orphanedCount: workspaces.filter((workspace) => workspace.orphaned).length,
    modelCount: workspaces.reduce((sum, workspace) => sum + workspace.modelCount, 0),
    totalBytes: workspaces.reduce((sum, workspace) => sum + workspace.totalBytes, 0),
    workspaces,
  };
}
