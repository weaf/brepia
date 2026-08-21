import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { env } from './env';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const WORKSPACE_SCHEMA_VERSION = 1 as const;

export type ConversationInputArtifactKind = 'image' | 'mesh' | 'file';

export type ConversationWorkspaceMetadata = {
  conversationId: string;
  title?: string | null;
  type?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ConversationWorkspaceManifest = {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  id: string;
  title: string | null;
  type: string | null;
  createdAt: string;
  updatedAt: string;
} & Record<string, unknown>;

function assertConversationId(conversationId: string): void {
  if (!UUID_PATTERN.test(conversationId)) {
    throw new Error(`Invalid conversation UUID: ${conversationId}`);
  }
}

function assertSafeSegment(value: string, label: string): void {
  if (
    !SAFE_SEGMENT_PATTERN.test(value) ||
    value === '.' ||
    value === '..'
  ) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function resolveInside(root: string, ...segments: string[]): string {
  const target = resolve(root, ...segments);
  const rel = relative(root, target);
  if (
    rel === '' ||
    (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
  ) {
    return target;
  }
  throw new Error(`Workspace path escapes configured root: ${target}`);
}

export function conversationWorkspaceRoot(): string {
  const configured = env('PCAD_CONVERSATIONS_DIR').trim();
  return configured
    ? resolve(configured)
    : resolve(process.cwd(), 'conversations');
}

export function conversationRoot(conversationId: string): string {
  assertConversationId(conversationId);
  return resolveInside(conversationWorkspaceRoot(), conversationId);
}

export function conversationManifestPath(conversationId: string): string {
  return join(conversationRoot(conversationId), 'conversation.json');
}

export function conversationInputDir(conversationId: string): string {
  return join(conversationRoot(conversationId), 'input');
}

export function conversationInputImagesDir(conversationId: string): string {
  return join(conversationInputDir(conversationId), 'images');
}

export function conversationInputMeshesDir(conversationId: string): string {
  return join(conversationInputDir(conversationId), 'meshes');
}

export function conversationInputFilesDir(conversationId: string): string {
  return join(conversationInputDir(conversationId), 'files');
}

export function conversationInputArtifactPath(
  conversationId: string,
  kind: ConversationInputArtifactKind,
  artifactId: string,
  extension?: string | null,
): string {
  assertSafeSegment(artifactId, 'input artifact id');
  const normalizedExtension = extension?.replace(/^\./, '') || '';
  if (normalizedExtension) {
    assertSafeSegment(normalizedExtension, 'input artifact extension');
  }

  const directory =
    kind === 'image'
      ? conversationInputImagesDir(conversationId)
      : kind === 'mesh'
        ? conversationInputMeshesDir(conversationId)
        : conversationInputFilesDir(conversationId);
  const filename = normalizedExtension
    ? `${artifactId}.${normalizedExtension}`
    : artifactId;
  return join(directory, filename);
}

export function conversationModelDir(conversationId: string): string {
  return join(conversationRoot(conversationId), 'models');
}

export function conversationModelRevisionsDir(conversationId: string): string {
  return join(conversationModelDir(conversationId), 'revisions');
}

export function conversationGeneratedModelDir(conversationId: string): string {
  return join(conversationModelDir(conversationId), 'generated');
}

export function conversationRenderDir(conversationId: string): string {
  return join(conversationRoot(conversationId), 'renders');
}

export function conversationExportDir(conversationId: string): string {
  return join(conversationRoot(conversationId), 'exports');
}

export function conversationExportFormatDir(
  conversationId: string,
  format: 'stl' | '3mf' | 'dxf',
): string {
  return join(conversationExportDir(conversationId), format);
}

export function conversationAgentDir(
  conversationId: string,
  agent: string,
): string {
  assertSafeSegment(agent, 'agent workspace name');
  return join(conversationRoot(conversationId), 'agents', agent);
}

export function conversationLogDir(conversationId: string): string {
  return join(conversationRoot(conversationId), 'logs');
}

function requiredDirectories(conversationId: string): string[] {
  return [
    conversationRoot(conversationId),
    conversationInputDir(conversationId),
    conversationInputImagesDir(conversationId),
    conversationInputMeshesDir(conversationId),
    conversationInputFilesDir(conversationId),
    conversationModelDir(conversationId),
    conversationModelRevisionsDir(conversationId),
    conversationGeneratedModelDir(conversationId),
    conversationRenderDir(conversationId),
    conversationExportDir(conversationId),
    conversationExportFormatDir(conversationId, 'stl'),
    conversationExportFormatDir(conversationId, '3mf'),
    conversationExportFormatDir(conversationId, 'dxf'),
    conversationAgentDir(conversationId, 'opencode'),
    conversationAgentDir(conversationId, 'codex'),
    conversationLogDir(conversationId),
  ];
}

async function readExistingManifest(
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error(`Conversation workspace manifest is not an object: ${path}`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

function existingString(
  manifest: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = manifest?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export async function initializeConversationWorkspace(
  metadata: ConversationWorkspaceMetadata,
): Promise<ConversationWorkspaceManifest> {
  assertConversationId(metadata.conversationId);

  await Promise.all(
    requiredDirectories(metadata.conversationId).map((dir) =>
      mkdir(dir, { recursive: true }),
    ),
  );

  const manifestPath = conversationManifestPath(metadata.conversationId);
  const existing = await readExistingManifest(manifestPath);
  const existingId = existingString(existing, 'id');
  if (existingId && existingId !== metadata.conversationId) {
    throw new Error(
      `Conversation workspace manifest ID mismatch: expected ${metadata.conversationId}, found ${existingId}`,
    );
  }

  const now = new Date().toISOString();
  const manifest: ConversationWorkspaceManifest = {
    ...(existing ?? {}),
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    id: metadata.conversationId,
    title: metadata.title ?? existingString(existing, 'title'),
    type: metadata.type ?? existingString(existing, 'type'),
    createdAt: metadata.createdAt ?? existingString(existing, 'createdAt') ?? now,
    updatedAt: metadata.updatedAt ?? now,
  };

  const tempPath = join(
    conversationRoot(metadata.conversationId),
    `.conversation-${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(tempPath, manifestPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }

  return manifest;
}