export const AI_INSTRUCTION_KEYS = [
  'parametric',
  'creative',
  'tool.build_parametric_model',
  'tool.answer_user',
  'tool.create_mesh',
  'vision.reference',
  'vision.inspection',
  'conversation.title',
  'suggestions.parametric',
  'suggestions.creative',
  'context.parametric_attachment',
  'context.mesh_preferences',
  'context.parametric_inspection_output',
] as const;

export type AiInstructionKey = (typeof AI_INSTRUCTION_KEYS)[number];

export type AiInstructionCategory =
  | 'agent'
  | 'tool'
  | 'vision'
  | 'conversation'
  | 'context';

export type AiInstructionDefinition = {
  key: AiInstructionKey;
  label: string;
  description: string;
  category: AiInstructionCategory;
  supportsOverlay: boolean;
};

export const AI_INSTRUCTION_DEFINITIONS: readonly AiInstructionDefinition[] = [
  {
    key: 'parametric',
    label: 'Generative system prompt',
    description: 'Primary system prompt used by the Generative/Parametric CAD agent.',
    category: 'agent',
    supportsOverlay: true,
  },
  {
    key: 'creative',
    label: 'Creative system prompt',
    description: 'Primary system prompt used by the Creative mesh agent.',
    category: 'agent',
    supportsOverlay: true,
  },
  {
    key: 'tool.build_parametric_model',
    label: 'Build CAD tool instruction',
    description: 'Instruction shown to the model for the build_parametric_model tool.',
    category: 'tool',
    supportsOverlay: true,
  },
  {
    key: 'tool.answer_user',
    label: 'Answer user tool instruction',
    description: 'Instruction shown to the model for the answer_user tool.',
    category: 'tool',
    supportsOverlay: true,
  },
  {
    key: 'tool.create_mesh',
    label: 'Create mesh tool instruction',
    description: 'Instruction shown to the Creative agent for the create_mesh tool.',
    category: 'tool',
    supportsOverlay: true,
  },
  {
    key: 'vision.reference',
    label: 'Vision reference analysis',
    description: 'Instructions used when a vision model analyzes user reference images.',
    category: 'vision',
    supportsOverlay: true,
  },
  {
    key: 'vision.inspection',
    label: 'Vision inspection QA',
    description: 'Instructions used when a vision model reviews rendered CAD inspection views.',
    category: 'vision',
    supportsOverlay: true,
  },
  {
    key: 'conversation.title',
    label: 'Conversation title generation',
    description: 'Instruction used to generate short conversation titles.',
    category: 'conversation',
    supportsOverlay: true,
  },
  {
    key: 'suggestions.parametric',
    label: 'Generative follow-up suggestions',
    description: 'Instruction used to generate follow-up suggestions for Generative conversations.',
    category: 'conversation',
    supportsOverlay: true,
  },
  {
    key: 'suggestions.creative',
    label: 'Creative follow-up suggestions',
    description: 'Instruction used to generate follow-up suggestions for Creative conversations.',
    category: 'conversation',
    supportsOverlay: true,
  },
  {
    key: 'context.parametric_attachment',
    label: 'Imported CAD attachment context',
    description: 'Model-facing context injected when an imported CAD/STL asset is attached.',
    category: 'context',
    supportsOverlay: true,
  },
  {
    key: 'context.mesh_preferences',
    label: 'Mesh preference context',
    description: 'Model-facing context injected for topology and polygon-count preferences.',
    category: 'context',
    supportsOverlay: true,
  },
  {
    key: 'context.parametric_inspection_output',
    label: 'CAD inspection tool result context',
    description: 'Model-facing text accompanying the rendered multi-view inspection result.',
    category: 'context',
    supportsOverlay: true,
  },
] as const;

export function isAiInstructionKey(value: unknown): value is AiInstructionKey {
  return (
    typeof value === 'string' &&
    (AI_INSTRUCTION_KEYS as readonly string[]).includes(value)
  );
}

export type AiRuntimeLimitKey =
  | 'chat.thinkingBudgetTokens'
  | 'chat.parametricMaxSteps'
  | 'chat.creativeMaxSteps'
  | 'chat.parametricMaxOutputTokens'
  | 'chat.creativeMaxOutputTokens'
  | 'chat.creativeThinkingMaxOutputTokens'
  | 'vision.timeoutMs'
  | 'vision.referenceMaxOutputTokens'
  | 'vision.inspectionMaxOutputTokens'
  | 'vision.temperature'
  | 'creative.healthTimeoutMs'
  | 'creative.imageGenerationTimeoutMs'
  | 'creative.meshGenerationTimeoutMs'
  | 'creative.trellisResolution';

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

export const AI_RUNTIME_LIMIT_DEFINITIONS: readonly AiRuntimeLimitDefinition[] = [
  {
    key: 'chat.thinkingBudgetTokens',
    label: 'Thinking budget',
    description: 'Default reasoning token budget for models that expose a bounded thinking budget.',
    kind: 'integer',
    defaultValue: 9000,
    min: 0,
    max: 64000,
  },
  {
    key: 'chat.parametricMaxSteps',
    label: 'Generative max steps',
    description: 'Maximum tool/reasoning steps allowed in one Generative turn.',
    kind: 'integer',
    defaultValue: 60,
    min: 1,
    max: 200,
  },
  {
    key: 'chat.creativeMaxSteps',
    label: 'Creative max steps',
    description: 'Maximum tool/reasoning steps allowed in one Creative turn.',
    kind: 'integer',
    defaultValue: 5,
    min: 1,
    max: 50,
  },
  {
    key: 'chat.parametricMaxOutputTokens',
    label: 'Generative max output tokens',
    description: 'Maximum output-token budget for Generative turns.',
    kind: 'integer',
    defaultValue: 64000,
    min: 1024,
    max: 131072,
  },
  {
    key: 'chat.creativeMaxOutputTokens',
    label: 'Creative max output tokens',
    description: 'Maximum output-token budget for Creative turns without extended thinking.',
    kind: 'integer',
    defaultValue: 16000,
    min: 1024,
    max: 131072,
  },
  {
    key: 'chat.creativeThinkingMaxOutputTokens',
    label: 'Creative thinking max output tokens',
    description: 'Maximum output-token budget for Creative turns with thinking enabled.',
    kind: 'integer',
    defaultValue: 32000,
    min: 1024,
    max: 131072,
  },
  {
    key: 'vision.timeoutMs',
    label: 'Vision timeout',
    description: 'Maximum time allowed for a vision fallback request.',
    kind: 'integer',
    defaultValue: 300000,
    min: 5000,
    max: 1800000,
  },
  {
    key: 'vision.referenceMaxOutputTokens',
    label: 'Vision reference output tokens',
    description: 'Maximum vision output for reference-image analysis.',
    kind: 'integer',
    defaultValue: 1800,
    min: 256,
    max: 16000,
  },
  {
    key: 'vision.inspectionMaxOutputTokens',
    label: 'Vision inspection output tokens',
    description: 'Maximum vision output for rendered inspection QA.',
    kind: 'integer',
    defaultValue: 2400,
    min: 256,
    max: 16000,
  },
  {
    key: 'vision.temperature',
    label: 'Vision temperature',
    description: 'Sampling temperature used by vision fallback analysis.',
    kind: 'number',
    defaultValue: 0.1,
    min: 0,
    max: 2,
  },
  {
    key: 'creative.healthTimeoutMs',
    label: 'Creative runtime health timeout',
    description: 'Timeout for checking llama-swap Creative runtime availability.',
    kind: 'integer',
    defaultValue: 5000,
    min: 1000,
    max: 60000,
  },
  {
    key: 'creative.imageGenerationTimeoutMs',
    label: 'Conditioning image timeout',
    description: 'Timeout for text-to-image conditioning generation before TRELLIS.2.',
    kind: 'integer',
    defaultValue: 600000,
    min: 30000,
    max: 3600000,
  },
  {
    key: 'creative.meshGenerationTimeoutMs',
    label: 'TRELLIS.2 generation timeout',
    description: 'Timeout for TRELLIS.2 mesh generation.',
    kind: 'integer',
    defaultValue: 1800000,
    min: 60000,
    max: 7200000,
  },
  {
    key: 'creative.trellisResolution',
    label: 'TRELLIS.2 resolution',
    description: 'Supported TRELLIS.2 generation resolution.',
    kind: 'enum',
    defaultValue: '1024',
    options: ['512', '1024', '1536'],
  },
] as const;

export const AI_HARD_INVARIANTS = [
  'Authentication and authorization checks',
  'Supabase row ownership and storage ownership checks',
  'Database integrity and schema validation',
  'Backend-advertised model capabilities',
  'Tool input/output schemas required for application interoperability',
  'File-format and binary-integrity validation',
] as const;
