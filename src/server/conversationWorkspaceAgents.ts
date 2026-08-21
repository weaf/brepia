import { randomUUID } from 'node:crypto';
import {
  appendFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  conversationAgentEventsLogPath,
  conversationAgentSessionPath,
  conversationAgentTurnPath,
  type ConversationAgentKind,
} from './conversationWorkspace';

const AGENT_RECORD_SCHEMA_VERSION = 1 as const;
const MAX_ERROR_MESSAGE_CHARS = 2_000;

export type ConversationAgentTransport = 'cli' | 'streaming';
export type ConversationAgentTurnStatus = 'success' | 'error' | 'cancelled';
export type ConversationAgentResultKind = 'code' | 'message' | 'none';

export type ConversationAgentSessionInput = {
  conversationId: string;
  agent: ConversationAgentKind;
  transport: ConversationAgentTransport;
  model: string;
  sessionId: string | null;
  reused: boolean;
  server?: string;
  directory?: string;
  attachCommand?: string;
};

export type ConversationAgentSessionRecord = ConversationAgentSessionInput & {
  schemaVersion: typeof AGENT_RECORD_SCHEMA_VERSION;
  firstSeenAt: string;
  updatedAt: string;
};

export type ConversationAgentTurnInput = {
  id: string;
  conversationId: string;
  agent: ConversationAgentKind;
  transport: ConversationAgentTransport;
  model: string;
  sessionId: string | null;
  reused: boolean;
  status: ConversationAgentTurnStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  resultKind?: ConversationAgentResultKind;
  admittedSeq?: number;
  validationAttempts?: number;
  permissionRequestCount?: number;
  finishReason?: string;
  error?: unknown;
};

export type ConversationAgentTurnRecord = Omit<
  ConversationAgentTurnInput,
  'error'
> & {
  schemaVersion: typeof AGENT_RECORD_SCHEMA_VERSION;
  error?: { name: string; message: string };
};

type AgentEvent =
  | {
      type: 'agent-session';
      at: string;
      record: ConversationAgentSessionRecord;
    }
  | {
      type: 'agent-turn';
      at: string;
      record: ConversationAgentTurnRecord;
    };

const appendLocks = new Map<string, Promise<void>>();

function serializedError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, MAX_ERROR_MESSAGE_CHARS),
    };
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return {
        name: 'NonErrorObject',
        message: JSON.stringify(error).slice(0, MAX_ERROR_MESSAGE_CHARS),
      };
    } catch {
      // fall through
    }
  }
  return {
    name: typeof error,
    message: String(error).slice(0, MAX_ERROR_MESSAGE_CHARS),
  };
}

async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await rename(tempPath, path);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function appendJsonLine(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const previous = appendLocks.get(path) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(() => appendFile(path, `${JSON.stringify(value)}\n`, 'utf8'));
  appendLocks.set(path, queued);
  try {
    await queued;
  } finally {
    if (appendLocks.get(path) === queued) appendLocks.delete(path);
  }
}

async function readExistingSession(
  path: string,
): Promise<ConversationAgentSessionRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const record = parsed as Partial<ConversationAgentSessionRecord>;
    return typeof record.sessionId === 'string' || record.sessionId === null
      ? (record as ConversationAgentSessionRecord)
      : null;
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

export async function recordConversationAgentSession(
  input: ConversationAgentSessionInput,
): Promise<ConversationAgentSessionRecord> {
  const path = conversationAgentSessionPath(input.conversationId, input.agent);
  const existing = await readExistingSession(path);
  const now = new Date().toISOString();
  const sameSession =
    existing?.sessionId === input.sessionId &&
    existing?.transport === input.transport &&
    existing?.model === input.model;
  const record: ConversationAgentSessionRecord = {
    schemaVersion: AGENT_RECORD_SCHEMA_VERSION,
    ...input,
    firstSeenAt: sameSession ? existing.firstSeenAt : now,
    updatedAt: now,
  };

  await atomicWriteJson(path, record);
  const event: AgentEvent = { type: 'agent-session', at: now, record };
  await appendJsonLine(conversationAgentEventsLogPath(input.conversationId), event);
  return record;
}

export async function recordConversationAgentTurn(
  input: ConversationAgentTurnInput,
): Promise<ConversationAgentTurnRecord> {
  const record: ConversationAgentTurnRecord = {
    schemaVersion: AGENT_RECORD_SCHEMA_VERSION,
    id: input.id,
    conversationId: input.conversationId,
    agent: input.agent,
    transport: input.transport,
    model: input.model,
    sessionId: input.sessionId,
    reused: input.reused,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs,
    ...(input.resultKind ? { resultKind: input.resultKind } : {}),
    ...(input.admittedSeq !== undefined ? { admittedSeq: input.admittedSeq } : {}),
    ...(input.validationAttempts !== undefined
      ? { validationAttempts: input.validationAttempts }
      : {}),
    ...(input.permissionRequestCount !== undefined
      ? { permissionRequestCount: input.permissionRequestCount }
      : {}),
    ...(input.finishReason ? { finishReason: input.finishReason } : {}),
    ...(input.error ? { error: serializedError(input.error) } : {}),
  };

  const path = conversationAgentTurnPath(
    input.conversationId,
    input.agent,
    input.id,
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  const event: AgentEvent = {
    type: 'agent-turn',
    at: input.finishedAt,
    record,
  };
  await appendJsonLine(conversationAgentEventsLogPath(input.conversationId), event);
  return record;
}

export async function recordConversationAgentSessionBestEffort(
  input: ConversationAgentSessionInput,
): Promise<boolean> {
  try {
    await recordConversationAgentSession(input);
    return true;
  } catch (error) {
    console.warn(
      `[conversation-workspace] Failed to persist ${input.agent} session metadata:`,
      error,
    );
    return false;
  }
}

export async function recordConversationAgentTurnBestEffort(
  input: ConversationAgentTurnInput,
): Promise<boolean> {
  try {
    await recordConversationAgentTurn(input);
    return true;
  } catch (error) {
    console.warn(
      `[conversation-workspace] Failed to persist ${input.agent} turn diagnostics:`,
      error,
    );
    return false;
  }
}
