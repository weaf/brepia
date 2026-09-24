import {
  BREP_PROJECT_MAX_DESCRIPTION_CHARS,
  BREP_PROJECT_MAX_ID_CHARS,
  BREP_PROJECT_MAX_NAME_CHARS,
  BREP_PROJECT_SCHEMA_VERSION,
  normalizeBrepProject,
  type BrepProject,
} from './brepProject.ts';

export const BREP_TEMPLATE_SCHEMA_VERSION = 1 as const;
export const BREP_TEMPLATE_DIGEST_ALGORITHM = 'fnv1a64' as const;

const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export type BrepTemplateRef = {
  id: string;
  version: number;
};

export type BrepTemplateCompatibility = {
  brepSchemaVersion: typeof BREP_PROJECT_SCHEMA_VERSION;
};

export type BrepTemplateDefinitionBody = {
  templateSchemaVersion: typeof BREP_TEMPLATE_SCHEMA_VERSION;
  id: string;
  version: number;
  name: string;
  category: string;
  description: string;
  source: BrepProject;
  compatibility: BrepTemplateCompatibility;
};

export type BrepTemplateDefinition = BrepTemplateDefinitionBody & {
  definitionDigest: string;
};

export type BrepTemplateProvenance = {
  kind: 'template';
  templateId: string;
  templateVersion: number;
  source: 'builtin';
  definitionDigest: string;
};

export type BrepTemplateErrorCode =
  | 'invalid_template'
  | 'unsupported_template_schema'
  | 'invalid_template_id'
  | 'invalid_template_version'
  | 'incompatible_brep_schema'
  | 'invalid_definition_digest'
  | 'invalid_template_provenance';

export class BrepTemplateError extends Error {
  constructor(
    public readonly code: BrepTemplateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BrepTemplateError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRequiredText(
  value: unknown,
  field: string,
  maxChars: number,
): string {
  if (typeof value !== 'string') {
    throw new BrepTemplateError('invalid_template', `${field} must be text.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxChars) {
    throw new BrepTemplateError(
      'invalid_template',
      `${field} must be non-empty and at most ${maxChars} characters.`,
    );
  }
  return normalized;
}

function normalizeTemplateId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > BREP_PROJECT_MAX_ID_CHARS ||
    !TEMPLATE_ID_PATTERN.test(value)
  ) {
    throw new BrepTemplateError(
      'invalid_template_id',
      `Template id must match ${TEMPLATE_ID_PATTERN} and be at most ${BREP_PROJECT_MAX_ID_CHARS} characters.`,
    );
  }
  return value;
}

function normalizeTemplateVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new BrepTemplateError(
      'invalid_template_version',
      'Template version must be a positive safe integer.',
    );
  }
  return Number(value);
}

export function normalizeBrepTemplateRef(value: unknown): BrepTemplateRef {
  if (!isRecord(value)) {
    throw new BrepTemplateError(
      'invalid_template',
      'Template reference must be an object.',
    );
  }
  return {
    id: normalizeTemplateId(value.id),
    version: normalizeTemplateVersion(value.version),
  };
}

export function normalizeBrepTemplateProvenance(
  value: unknown,
): BrepTemplateProvenance {
  if (!isRecord(value) || value.kind !== 'template' || value.source !== 'builtin') {
    throw new BrepTemplateError(
      'invalid_template_provenance',
      'BRep template provenance must describe a built-in template.',
    );
  }

  const ref = normalizeBrepTemplateRef({
    id: value.templateId,
    version: value.templateVersion,
  });
  if (
    typeof value.definitionDigest !== 'string' ||
    !/^fnv1a64:[a-f0-9]{16}$/.test(value.definitionDigest)
  ) {
    throw new BrepTemplateError(
      'invalid_template_provenance',
      'BRep template provenance requires a valid definition digest.',
    );
  }

  return {
    kind: 'template',
    templateId: ref.id,
    templateVersion: ref.version,
    source: 'builtin',
    definitionDigest: value.definitionDigest,
  };
}

export function createBrepTemplateProvenance(
  definition: Readonly<BrepTemplateDefinition>,
): BrepTemplateProvenance {
  return normalizeBrepTemplateProvenance({
    kind: 'template',
    templateId: definition.id,
    templateVersion: definition.version,
    source: 'builtin',
    definitionDigest: definition.definitionDigest,
  });
}

export function normalizeBrepTemplateDefinitionBody(
  value: unknown,
): BrepTemplateDefinitionBody {
  if (!isRecord(value)) {
    throw new BrepTemplateError(
      'invalid_template',
      'BRep template definition must be an object.',
    );
  }

  if (value.templateSchemaVersion !== BREP_TEMPLATE_SCHEMA_VERSION) {
    if (typeof value.templateSchemaVersion === 'number') {
      throw new BrepTemplateError(
        'unsupported_template_schema',
        `Unsupported BRep template schema version: ${value.templateSchemaVersion}.`,
      );
    }
    throw new BrepTemplateError(
      'invalid_template',
      'BRep template templateSchemaVersion is required.',
    );
  }

  if (!isRecord(value.compatibility)) {
    throw new BrepTemplateError(
      'invalid_template',
      'BRep template compatibility must be an object.',
    );
  }
  if (
    value.compatibility.brepSchemaVersion !== BREP_PROJECT_SCHEMA_VERSION
  ) {
    throw new BrepTemplateError(
      'incompatible_brep_schema',
      `BRep template compatibility must target canonical schemaVersion ${BREP_PROJECT_SCHEMA_VERSION}.`,
    );
  }

  const source = normalizeBrepProject(value.source);
  if (source.schemaVersion !== value.compatibility.brepSchemaVersion) {
    throw new BrepTemplateError(
      'incompatible_brep_schema',
      'BRep template source schemaVersion does not match compatibility metadata.',
    );
  }

  return {
    templateSchemaVersion: BREP_TEMPLATE_SCHEMA_VERSION,
    id: normalizeTemplateId(value.id),
    version: normalizeTemplateVersion(value.version),
    name: normalizeRequiredText(
      value.name,
      'Template name',
      BREP_PROJECT_MAX_NAME_CHARS,
    ),
    category: normalizeRequiredText(
      value.category,
      'Template category',
      BREP_PROJECT_MAX_NAME_CHARS,
    ),
    description: normalizeRequiredText(
      value.description,
      'Template description',
      BREP_PROJECT_MAX_DESCRIPTION_CHARS,
    ),
    source,
    compatibility: {
      brepSchemaVersion: BREP_PROJECT_SCHEMA_VERSION,
    },
  };
}


function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  );
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  const bytes = new TextEncoder().encode(text);
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function computeBrepTemplateDefinitionDigest(
  value: unknown,
): string {
  const body = normalizeBrepTemplateDefinitionBody(value);
  return `${BREP_TEMPLATE_DIGEST_ALGORITHM}:${fnv1a64(stableJson(body))}`;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

export function normalizeBrepTemplateDefinition(
  value: unknown,
): Readonly<BrepTemplateDefinition> {
  if (!isRecord(value)) {
    throw new BrepTemplateError(
      'invalid_template',
      'BRep template definition must be an object.',
    );
  }

  const body = normalizeBrepTemplateDefinitionBody(value);
  const expectedDigest = computeBrepTemplateDefinitionDigest(body);
  if (
    typeof value.definitionDigest !== 'string' ||
    value.definitionDigest !== expectedDigest
  ) {
    throw new BrepTemplateError(
      'invalid_definition_digest',
      `BRep template ${body.id}@${body.version} definitionDigest does not match normalized content.`,
    );
  }

  return deepFreeze({
    ...body,
    definitionDigest: expectedDigest,
  });
}
