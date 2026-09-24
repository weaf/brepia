import {
  BREP_PROJECT_MAX_DESCRIPTION_CHARS,
  BREP_PROJECT_MAX_ID_CHARS,
  BREP_PROJECT_MAX_NAME_CHARS,
  BREP_PROJECT_SCHEMA_VERSION,
  normalizeBrepProject,
  type BrepProject,
} from './brepProject.ts';

export const BREP_TEMPLATE_SCHEMA_VERSION = 1 as const;

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

export type BrepTemplateErrorCode =
  | 'invalid_template'
  | 'unsupported_template_schema'
  | 'invalid_template_id'
  | 'invalid_template_version'
  | 'incompatible_brep_schema';

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
