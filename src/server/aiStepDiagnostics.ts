type SizedJson = {
  bytes: number;
};

export type AiStepContextMeasurement = {
  messageCount: number;
  modelMessageBytes: number;
  brepToolCallCount: number;
  brepToolResultCount: number;
  brepToolInputBytes: number;
  brepToolOutputBytes: number;
  brepToolPayloadBytes: number;
};

export type AiToolErrorClassification = {
  errorClass: string;
  errorCode?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function sizeJson(value: unknown): SizedJson {
  return { bytes: utf8Bytes(jsonText(value)) };
}

function visitBrepToolPayloads(
  value: unknown,
  measurement: AiStepContextMeasurement,
  seen: Set<object>,
): void {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      visitBrepToolPayloads(item, measurement, seen);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const type = typeof record.type === 'string' ? record.type : undefined;
  const toolName =
    typeof record.toolName === 'string' ? record.toolName : undefined;

  if (toolName === 'build_brep_project' && type === 'tool-call') {
    measurement.brepToolCallCount += 1;
    if ('input' in record && record.input !== undefined) {
      measurement.brepToolInputBytes += sizeJson(record.input).bytes;
    }
  } else if (toolName === 'build_brep_project' && type === 'tool-result') {
    measurement.brepToolResultCount += 1;
    if ('output' in record && record.output !== undefined) {
      measurement.brepToolOutputBytes += sizeJson(record.output).bytes;
    }
  }

  for (const child of Object.values(record)) {
    visitBrepToolPayloads(child, measurement, seen);
  }
}

/**
 * Measure only bounded metadata for the exact provider-facing messages of one
 * model step. The payloads themselves are never returned or logged.
 */
export function measureAiStepContext(
  messages: readonly unknown[],
): AiStepContextMeasurement {
  const measurement: AiStepContextMeasurement = {
    messageCount: messages.length,
    modelMessageBytes: sizeJson(messages).bytes,
    brepToolCallCount: 0,
    brepToolResultCount: 0,
    brepToolInputBytes: 0,
    brepToolOutputBytes: 0,
    brepToolPayloadBytes: 0,
  };

  visitBrepToolPayloads(messages, measurement, new Set<object>());
  measurement.brepToolPayloadBytes =
    measurement.brepToolInputBytes + measurement.brepToolOutputBytes;
  return measurement;
}

function classifyOneError(error: unknown): AiToolErrorClassification {
  if (error instanceof Error) {
    const record = error as Error & {
      code?: unknown;
      cause?: unknown;
    };
    const errorCode =
      typeof record.code === 'string' || typeof record.code === 'number'
        ? String(record.code)
        : undefined;
    return {
      errorClass: error.name || error.constructor.name || 'Error',
      ...(errorCode ? { errorCode } : {}),
    };
  }

  const record = asRecord(error);
  const errorClass =
    typeof record?.name === 'string'
      ? record.name
      : typeof record?.type === 'string'
        ? record.type
        : error === null
          ? 'null'
          : typeof error;
  const errorCode =
    typeof record?.code === 'string' || typeof record?.code === 'number'
      ? String(record.code)
      : undefined;
  return {
    errorClass,
    ...(errorCode ? { errorCode } : {}),
  };
}

/**
 * Prefer a bounded underlying cause when an SDK wrapper exposes one. This keeps
 * validation classes such as BrepAiProjectError/ZodError visible without
 * logging error messages or candidate payloads.
 */
export function classifyAiToolError(
  error: unknown,
): AiToolErrorClassification {
  const outer = classifyOneError(error);
  const cause =
    error instanceof Error
      ? (error as Error & { cause?: unknown }).cause
      : asRecord(error)?.cause;
  if (cause === undefined || cause === error) return outer;

  const inner = classifyOneError(cause);
  if (inner.errorClass === 'object' || inner.errorClass === 'unknown') {
    return outer;
  }
  return inner;
}

export function summarizeAiToolChoice(toolChoice: unknown): string {
  if (typeof toolChoice === 'string') return toolChoice;
  const record = asRecord(toolChoice);
  if (!record) return 'unknown';
  const type = typeof record.type === 'string' ? record.type : 'unknown';
  return type === 'tool' && typeof record.toolName === 'string'
    ? `tool:${record.toolName}`
    : type;
}
