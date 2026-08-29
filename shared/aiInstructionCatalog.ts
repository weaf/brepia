import { z } from 'zod';
import manifestRaw from '../config/ai/instructions/manifest.json?raw';
import runtimeRaw from '../config/ai/runtime.json?raw';

const instructionFiles = import.meta.glob<string>(
  '../config/ai/instructions/*.md',
  {
    eager: true,
    query: '?raw',
    import: 'default',
  },
);

const InstructionDefinitionSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  label: z.string().min(1),
  description: z.string(),
  category: z.enum(['agent', 'tool', 'vision', 'conversation', 'context']),
  template: z.string().min(1).regex(/^[a-z0-9][a-z0-9_.-]*\.md$/),
  supportsOverlay: z.boolean().default(true),
});

const ManifestSchema = z.object({
  version: z.number().int().positive(),
  instructions: z.array(InstructionDefinitionSchema).min(1),
});

const RuntimeSettingSchema = z
  .object({
    label: z.string().min(1),
    description: z.string(),
    type: z.enum(['integer', 'number', 'enum']),
    default: z.union([z.number(), z.string()]),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'enum') {
      if (typeof value.default !== 'string' || !value.options?.includes(value.default)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'enum default must be present in options',
        });
      }
      return;
    }

    if (typeof value.default !== 'number' || !Number.isFinite(value.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'numeric runtime setting requires a finite numeric default',
      });
      return;
    }

    if (value.type === 'integer' && !Number.isInteger(value.default)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'integer runtime setting requires an integer default',
      });
    }
  });

const RuntimeConfigSchema = z.object({
  version: z.number().int().positive(),
  settings: z.record(z.string(), RuntimeSettingSchema),
});

const manifest = ManifestSchema.parse(JSON.parse(manifestRaw) as unknown);
const runtimeConfig = RuntimeConfigSchema.parse(JSON.parse(runtimeRaw) as unknown);

const instructionKeys = new Set(
  manifest.instructions.map((definition) => definition.key),
);
if (instructionKeys.size !== manifest.instructions.length) {
  throw new Error('AI instruction manifest contains duplicate keys');
}

for (const definition of manifest.instructions) {
  const path = `../config/ai/instructions/${definition.template}`;
  if (typeof instructionFiles[path] !== 'string') {
    throw new Error(
      `AI instruction template is missing for ${definition.key}: ${definition.template}`,
    );
  }
}

export type AiInstructionKey = string;
export type AiInstructionCategory =
  | 'agent'
  | 'tool'
  | 'vision'
  | 'conversation'
  | 'context';

export type AiInstructionDefinition = z.infer<
  typeof InstructionDefinitionSchema
>;

export const AI_INSTRUCTION_DEFINITIONS: readonly AiInstructionDefinition[] =
  manifest.instructions;
export const AI_INSTRUCTION_KEYS: readonly string[] = manifest.instructions.map(
  (definition) => definition.key,
);

export function isAiInstructionKey(value: unknown): value is AiInstructionKey {
  return typeof value === 'string' && instructionKeys.has(value);
}

export function getAiInstructionDefinition(
  key: AiInstructionKey,
): AiInstructionDefinition | undefined {
  return manifest.instructions.find((definition) => definition.key === key);
}

export function loadBundledInstruction(key: AiInstructionKey): string {
  const definition = getAiInstructionDefinition(key);
  if (!definition) throw new Error(`Unknown AI instruction key: ${key}`);
  const path = `../config/ai/instructions/${definition.template}`;
  const content = instructionFiles[path];
  if (typeof content !== 'string') {
    throw new Error(`Missing bundled AI instruction template: ${definition.template}`);
  }
  return content.trim();
}

export function renderInstructionTemplate(
  template: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  return template.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value == null ? '' : String(value);
  });
}

export function renderBundledInstruction(
  key: AiInstructionKey,
  values: Record<string, string | number | boolean | null | undefined> = {},
): string {
  return renderInstructionTemplate(loadBundledInstruction(key), values);
}

export type AiRuntimeLimitKey = string;
export type AiRuntimeLimitDefinition = {
  key: AiRuntimeLimitKey;
  label: string;
  description: string;
  kind: 'integer' | 'number' | 'enum';
  defaultValue: number | string;
  min?: number;
  max?: number;
  options?: readonly string[];
};

export const AI_RUNTIME_LIMIT_DEFINITIONS: readonly AiRuntimeLimitDefinition[] =
  Object.entries(runtimeConfig.settings).map(([key, definition]) => ({
    key,
    label: definition.label,
    description: definition.description,
    kind: definition.type,
    defaultValue: definition.default,
    min: definition.min,
    max: definition.max,
    options: definition.options,
  }));

const runtimeDefinitionByKey = new Map(
  AI_RUNTIME_LIMIT_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function isAiRuntimeLimitKey(value: unknown): value is AiRuntimeLimitKey {
  return typeof value === 'string' && runtimeDefinitionByKey.has(value);
}

export function getAiRuntimeLimitDefinition(
  key: AiRuntimeLimitKey,
): AiRuntimeLimitDefinition | undefined {
  return runtimeDefinitionByKey.get(key);
}
