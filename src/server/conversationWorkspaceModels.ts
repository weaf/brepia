import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  conversationCurrentModelMetadataPath,
  conversationCurrentModelPath,
  conversationModelRevisionMetadataPath,
  conversationModelRevisionPath,
  conversationModelRevisionsDir,
} from './conversationWorkspace';
import { getAnonSupabaseClient } from './supabaseClient';

export type ConversationMessageRow = {
  id: string;
  parent_message_id: string | null;
  created_at: string | null;
  role: string;
  parts: unknown;
};

export type SuccessfulParametricBuild = {
  toolCallId: string;
  messageId: string;
  messageCreatedAt: string | null;
  title: string;
  version: string;
  code: string;
};

export type ConversationModelSyncResult = {
  discovered: number;
  revisionsCreated: number;
  currentRevision: number | null;
};

type RevisionMetadata = {
  revision: number;
  toolCallId: string;
  messageId: string;
  messageCreatedAt: string | null;
  title: string;
  version: string;
  codeSha256: string;
  savedAt: string;
};

type RevisionState = {
  metadata: RevisionMetadata[];
  maxRevision: number;
};

type ModelSyncDependencies = {
  loadMessages?: (
    request: Request,
    conversationId: string,
  ) => Promise<ConversationMessageRow[]>;
};

const conversationLocks = new Map<string, Promise<void>>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function codeSha256(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

function parseSuccessfulBuildPart(
  part: unknown,
  message: ConversationMessageRow,
): SuccessfulParametricBuild | null {
  if (!isRecord(part)) return null;
  if (part.type !== 'tool-build_parametric_model') return null;
  if (part.state !== 'output-available') return null;
  if (typeof part.toolCallId !== 'string' || !part.toolCallId) return null;
  if (!isRecord(part.input) || !isRecord(part.output)) return null;
  if (part.output.status !== 'success') return null;

  const title = part.input.title;
  const version = part.input.version;
  const code = part.input.code;
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    typeof version !== 'string' ||
    !version.trim() ||
    typeof code !== 'string' ||
    !code.trim()
  ) {
    return null;
  }

  return {
    toolCallId: part.toolCallId,
    messageId: message.id,
    messageCreatedAt: message.created_at,
    title,
    version,
    code,
  };
}

/**
 * Walk only the active parent chain. Successful builds that exist solely on an
 * abandoned sibling branch never become `current.scad` for the active branch.
 */
export function collectSuccessfulParametricBuilds(
  rows: ConversationMessageRow[],
  leafId: string | null,
): SuccessfulParametricBuild[] {
  if (!leafId) return [];

  const byId = new Map(rows.map((row) => [row.id, row]));
  const branch: ConversationMessageRow[] = [];
  const seen = new Set<string>();
  let currentId: string | null = leafId;

  while (currentId) {
    if (seen.has(currentId)) {
      throw new Error(`Conversation message parent cycle at ${currentId}`);
    }
    seen.add(currentId);

    const row = byId.get(currentId);
    if (!row) {
      throw new Error(`Conversation branch message not found: ${currentId}`);
    }
    branch.push(row);
    currentId = row.parent_message_id;
  }

  branch.reverse();
  const builds: SuccessfulParametricBuild[] = [];
  for (const row of branch) {
    if (row.role !== 'assistant' || !Array.isArray(row.parts)) continue;
    for (const part of row.parts) {
      const build = parseSuccessfulBuildPart(part, row);
      if (build) builds.push(build);
    }
  }
  return builds;
}

async function defaultLoadMessages(
  request: Request,
  conversationId: string,
): Promise<ConversationMessageRow[]> {
  const supabase = getAnonSupabaseClient({
    global: {
      headers: { Authorization: request.headers.get('Authorization') ?? '' },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  // Ownership is checked by the lifecycle conversation query. RLS on messages
  // provides the second boundary here.
  const { data, error } = await supabase
    .from('messages')
    .select('id, parent_message_id, created_at, role, parts')
    .eq('conversation_id', conversationId);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    parent_message_id: row.parent_message_id,
    created_at: row.created_at,
    role: row.role,
    parts: row.parts,
  }));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

async function atomicWriteText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, path);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function revisionNumberFromFilename(filename: string): number | null {
  const match = /^(\d{3,})\.(?:scad|json)$/.exec(filename);
  if (!match) return null;
  const revision = Number(match[1]);
  return Number.isSafeInteger(revision) && revision >= 1 ? revision : null;
}

async function readRevisionState(
  conversationId: string,
): Promise<RevisionState> {
  const directory = conversationModelRevisionsDir(conversationId);
  const entries = await readdir(directory).catch((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [] as string[];
    }
    throw error;
  });

  let maxRevision = 0;
  const metadata: RevisionMetadata[] = [];
  for (const entry of entries) {
    const entryRevision = revisionNumberFromFilename(entry);
    if (entryRevision) maxRevision = Math.max(maxRevision, entryRevision);
    if (!/^\d{3,}\.json$/.test(entry)) continue;

    const raw: unknown = JSON.parse(await readFile(join(directory, entry), 'utf8'));
    if (!isRecord(raw)) continue;
    if (
      typeof raw.revision !== 'number' ||
      typeof raw.toolCallId !== 'string' ||
      typeof raw.messageId !== 'string' ||
      !(
        raw.messageCreatedAt === null ||
        typeof raw.messageCreatedAt === 'string'
      ) ||
      typeof raw.title !== 'string' ||
      typeof raw.version !== 'string' ||
      typeof raw.codeSha256 !== 'string' ||
      typeof raw.savedAt !== 'string'
    ) {
      continue;
    }
    metadata.push(raw as RevisionMetadata);
  }
  metadata.sort((a, b) => a.revision - b.revision);
  return { metadata, maxRevision };
}

async function ensureExistingRevisionMatches(
  conversationId: string,
  metadata: RevisionMetadata,
  build: SuccessfulParametricBuild,
): Promise<void> {
  const path = conversationModelRevisionPath(conversationId, metadata.revision);
  const expectedHash = codeSha256(build.code);
  if (expectedHash !== metadata.codeSha256) {
    throw new Error(
      `Immutable model revision ${metadata.revision} replay changed source`,
    );
  }

  if (!(await pathExists(path))) {
    await writeFile(path, build.code, { encoding: 'utf8', flag: 'wx' });
    return;
  }

  const existingCode = await readFile(path, 'utf8');
  if (codeSha256(existingCode) !== metadata.codeSha256) {
    throw new Error(
      `Immutable model revision ${metadata.revision} checksum mismatch`,
    );
  }
}

async function createRevision(
  conversationId: string,
  revision: number,
  build: SuccessfulParametricBuild,
): Promise<RevisionMetadata> {
  const metadata: RevisionMetadata = {
    revision,
    toolCallId: build.toolCallId,
    messageId: build.messageId,
    messageCreatedAt: build.messageCreatedAt,
    title: build.title,
    version: build.version,
    codeSha256: codeSha256(build.code),
    savedAt: new Date().toISOString(),
  };

  const metadataPath = conversationModelRevisionMetadataPath(
    conversationId,
    revision,
  );
  const sourcePath = conversationModelRevisionPath(conversationId, revision);
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    await writeFile(sourcePath, build.code, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    await rm(metadataPath, { force: true }).catch(() => undefined);
    throw error;
  }
  return metadata;
}

async function persistBuildsLocked(
  conversationId: string,
  builds: SuccessfulParametricBuild[],
): Promise<ConversationModelSyncResult> {
  const state = await readRevisionState(conversationId);
  const byToolCall = new Map(
    state.metadata.map((metadata) => [metadata.toolCallId, metadata]),
  );
  let nextRevision = state.maxRevision + 1;
  let revisionsCreated = 0;
  let currentMetadata: RevisionMetadata | null = null;

  for (const build of builds) {
    let metadata = byToolCall.get(build.toolCallId);
    if (metadata) {
      await ensureExistingRevisionMatches(conversationId, metadata, build);
    } else {
      metadata = await createRevision(conversationId, nextRevision, build);
      byToolCall.set(build.toolCallId, metadata);
      nextRevision += 1;
      revisionsCreated += 1;
    }
    currentMetadata = metadata;
  }

  const latestBuild = builds.at(-1);
  if (latestBuild && currentMetadata) {
    await atomicWriteText(
      conversationCurrentModelPath(conversationId),
      latestBuild.code,
    );
    await atomicWriteText(
      conversationCurrentModelMetadataPath(conversationId),
      `${JSON.stringify(currentMetadata, null, 2)}\n`,
    );
  }

  return {
    discovered: builds.length,
    revisionsCreated,
    currentRevision: currentMetadata?.revision ?? null,
  };
}

async function withConversationLock<T>(
  conversationId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = conversationLocks.get(conversationId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  conversationLocks.set(conversationId, queued);

  await previous;
  try {
    return await task();
  } finally {
    release();
    if (conversationLocks.get(conversationId) === queued) {
      conversationLocks.delete(conversationId);
    }
  }
}

/**
 * Persist successful OpenSCAD builds from the active conversation branch.
 * Revisions are immutable and idempotent by toolCallId. `current.scad` always
 * follows the newest successful build on the currently selected branch.
 */
export async function syncConversationModelSources(
  request: Request,
  conversationId: string,
  leafId: string | null,
  dependencies: ModelSyncDependencies = {},
): Promise<ConversationModelSyncResult> {
  if (!leafId) {
    return { discovered: 0, revisionsCreated: 0, currentRevision: null };
  }
  const loadMessages = dependencies.loadMessages ?? defaultLoadMessages;
  const rows = await loadMessages(request, conversationId);
  const builds = collectSuccessfulParametricBuilds(rows, leafId);
  return withConversationLock(conversationId, () =>
    persistBuildsLocked(conversationId, builds),
  );
}