import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  conversationRenderArtifactPath,
  type ConversationRenderArtifactKind,
} from './conversationWorkspace';
import {
  listConversationModelRevisions,
  type ConversationModelRevisionMetadata,
} from './conversationWorkspaceModels';
import { getAnonSupabaseClient } from './supabaseClient';

export type ConversationRenderSyncResult = {
  discovered: number;
  copied: number;
  existing: number;
  failed: number;
};

type RenderArtifact = {
  revision: number;
  toolCallId: string;
  kind: ConversationRenderArtifactKind;
};

type RenderSyncDependencies = {
  listRevisions?: (
    conversationId: string,
  ) => Promise<ConversationModelRevisionMetadata[]>;
  downloadRender?: (
    request: Request,
    conversationId: string,
    artifact: RenderArtifact,
  ) => Promise<Uint8Array>;
};

function renderStorageFilename(
  kind: ConversationRenderArtifactKind,
  toolCallId: string,
): string {
  return kind === 'inspection'
    ? `inspection-preview-${toolCallId}`
    : `preview-${toolCallId}`;
}

async function defaultDownloadRender(
  request: Request,
  conversationId: string,
  artifact: RenderArtifact,
): Promise<Uint8Array> {
  const supabase = getAnonSupabaseClient({
    global: {
      headers: { Authorization: request.headers.get('Authorization') ?? '' },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    throw new Error('Render mirroring requires an authenticated user');
  }

  const storagePath = `${user.id}/${conversationId}/${renderStorageFilename(
    artifact.kind,
    artifact.toolCallId,
  )}`;
  const { data, error } = await supabase.storage
    .from('images')
    .download(storagePath);
  if (error) throw error;
  if (!data) throw new Error(`Missing ${artifact.kind} render object`);
  return new Uint8Array(await data.arrayBuffer());
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

async function atomicWrite(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, bytes);
    await rename(tempPath, path);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

function renderOwningRevisions(
  revisions: ConversationModelRevisionMetadata[],
): ConversationModelRevisionMetadata[] {
  const firstBuildByToolCall = new Map<
    string,
    ConversationModelRevisionMetadata
  >();
  for (const metadata of [...revisions].sort(
    (a, b) => a.revision - b.revision,
  )) {
    if (metadata.source !== 'build') continue;
    if (!firstBuildByToolCall.has(metadata.toolCallId)) {
      firstBuildByToolCall.set(metadata.toolCallId, metadata);
    }
  }
  return [...firstBuildByToolCall.values()];
}

/**
 * Mirror the two render derivatives already produced by a successful
 * `build_parametric_model` call from private Supabase storage into the local
 * revision-owned workspace:
 *
 *   renders/<revision>/preview.png
 *   renders/<revision>/inspection.png
 *
 * A render storage object is keyed by toolCallId, so exactly the first `build`
 * revision for each tool call owns it. Parameter edits and legacy repeated
 * source variants must never receive a stale copy of that build-time render.
 */
export async function syncConversationRenderArtifacts(
  request: Request,
  conversationId: string,
  dependencies: RenderSyncDependencies = {},
): Promise<ConversationRenderSyncResult> {
  const listRevisions =
    dependencies.listRevisions ?? listConversationModelRevisions;
  const downloadRender = dependencies.downloadRender ?? defaultDownloadRender;
  const revisions = renderOwningRevisions(await listRevisions(conversationId));
  const artifacts: RenderArtifact[] = revisions.flatMap((metadata) => [
    {
      revision: metadata.revision,
      toolCallId: metadata.toolCallId,
      kind: 'preview' as const,
    },
    {
      revision: metadata.revision,
      toolCallId: metadata.toolCallId,
      kind: 'inspection' as const,
    },
  ]);

  let copied = 0;
  let existing = 0;
  let failed = 0;

  for (const artifact of artifacts) {
    const destination = conversationRenderArtifactPath(
      conversationId,
      artifact.revision,
      artifact.kind,
    );
    if (await pathExists(destination)) {
      existing += 1;
      continue;
    }

    try {
      const bytes = await downloadRender(request, conversationId, artifact);
      await atomicWrite(destination, bytes);
      copied += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `[conversation-workspace] Failed to mirror ${artifact.kind} render for revision ${artifact.revision}:`,
        error,
      );
    }
  }

  return {
    discovered: artifacts.length,
    copied,
    existing,
    failed,
  };
}
