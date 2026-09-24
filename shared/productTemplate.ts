import {
  BREP_PROJECT_MAX_DESCRIPTION_CHARS,
  BREP_PROJECT_MAX_NAME_CHARS,
} from './brepProject.ts';
import {
  normalizeParametricProjectSource,
  type ParametricProjectSource,
} from './parametricProjectSource.ts';

export const BUILTIN_PRODUCT_TEMPLATE_ID_PATTERN =
  /^builtin:[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PRODUCT_TEMPLATE_MAX_CATEGORY_CHARS = 120;
export const PRODUCT_TEMPLATE_MAX_GROUPS = 32;
export const PRODUCT_TEMPLATE_MAX_PREVIEW_ASSET_ID_CHARS = 256;

export type ProductTemplatePresentationGroup = Readonly<{
  id: string;
  label: string;
  parameterIds: readonly string[];
}>;

export type ProductTemplatePresentation = Readonly<{
  parameterOrder?: readonly string[];
  groups?: readonly ProductTemplatePresentationGroup[];
  preview?: Readonly<{
    kind: 'bundled';
    assetId: string;
  }>;
}>;

export type BuiltinProductTemplate = Readonly<{
  id: string;
  version: number;
  name: string;
  category: string;
  description?: string;
  source: Extract<ParametricProjectSource, { kind: 'brep' }>;
  presentation?: ProductTemplatePresentation;
}>;

export type ProductTemplateErrorCode =
  | 'invalid_template'
  | 'invalid_id'
  | 'invalid_version'
  | 'invalid_metadata'
  | 'invalid_source'
  | 'invalid_presentation'
  | 'duplicate_template_version';

export class ProductTemplateError extends Error {
  constructor(
    public readonly code: ProductTemplateErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProductTemplateError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(
  value: unknown,
  field: string,
  maxChars: number,
  required = true,
): string | undefined {
  if (value == null && !required) return undefined;
  if (typeof value !== 'string') {
    throw new ProductTemplateError(
      'invalid_metadata',
      `${field} must be text.`,
    );
  }
  const normalized = value.trim();
  if ((required && normalized.length === 0) || normalized.length > maxChars) {
    throw new ProductTemplateError(
      'invalid_metadata',
      `${field} must be ${required ? 'non-empty and ' : ''}at most ${maxChars} characters.`,
    );
  }
  return normalized;
}

function normalizeParameterReferences(
  value: unknown,
  field: string,
  parameterIds: ReadonlySet<string>,
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ProductTemplateError(
      'invalid_presentation',
      `${field} must be an array of published parameter IDs.`,
    );
  }

  const seen = new Set<string>();
  const normalized = value.map((parameterId, index) => {
    if (typeof parameterId !== 'string' || parameterId.length === 0) {
      throw new ProductTemplateError(
        'invalid_presentation',
        `${field}[${index}] must be a published parameter ID.`,
      );
    }
    if (!parameterIds.has(parameterId)) {
      throw new ProductTemplateError(
        'invalid_presentation',
        `${field} references unknown published parameter ${parameterId}.`,
      );
    }
    if (seen.has(parameterId)) {
      throw new ProductTemplateError(
        'invalid_presentation',
        `${field} contains duplicate published parameter ${parameterId}.`,
      );
    }
    seen.add(parameterId);
    return parameterId;
  });

  return normalized;
}

function normalizePresentation(
  value: unknown,
  parameterIds: ReadonlySet<string>,
): ProductTemplatePresentation | undefined {
  if (value == null) return undefined;
  if (!isRecord(value)) {
    throw new ProductTemplateError(
      'invalid_presentation',
      'Product template presentation must be an object.',
    );
  }

  const parameterOrder =
    value.parameterOrder == null
      ? undefined
      : normalizeParameterReferences(
          value.parameterOrder,
          'Product template parameterOrder',
          parameterIds,
        );

  let groups: readonly ProductTemplatePresentationGroup[] | undefined;
  if (value.groups != null) {
    if (!Array.isArray(value.groups)) {
      throw new ProductTemplateError(
        'invalid_presentation',
        'Product template presentation groups must be an array.',
      );
    }
    if (value.groups.length > PRODUCT_TEMPLATE_MAX_GROUPS) {
      throw new ProductTemplateError(
        'invalid_presentation',
        `Product template presentation exceeds ${PRODUCT_TEMPLATE_MAX_GROUPS} groups.`,
      );
    }

    const groupIds = new Set<string>();
    groups = value.groups.map((group, index) => {
      if (!isRecord(group)) {
        throw new ProductTemplateError(
          'invalid_presentation',
          `Product template presentation group ${index} must be an object.`,
        );
      }
      const id = normalizeText(
        group.id,
        `Product template presentation group ${index} id`,
        BREP_PROJECT_MAX_NAME_CHARS,
      )!;
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
        throw new ProductTemplateError(
          'invalid_presentation',
          `Product template presentation group id ${id} is invalid.`,
        );
      }
      if (groupIds.has(id)) {
        throw new ProductTemplateError(
          'invalid_presentation',
          `Duplicate product template presentation group id: ${id}.`,
        );
      }
      groupIds.add(id);

      const label = normalizeText(
        group.label,
        `Product template presentation group ${id} label`,
        BREP_PROJECT_MAX_NAME_CHARS,
      )!;
      const parameterIdsForGroup = normalizeParameterReferences(
        group.parameterIds,
        `Product template presentation group ${id} parameterIds`,
        parameterIds,
      );

      return {
        id,
        label,
        parameterIds: parameterIdsForGroup,
      };
    });
  }

  let preview: ProductTemplatePresentation['preview'];
  if (value.preview != null) {
    if (!isRecord(value.preview) || value.preview.kind !== 'bundled') {
      throw new ProductTemplateError(
        'invalid_presentation',
        'Product template preview must be a bundled preview reference.',
      );
    }
    const assetId = normalizeText(
      value.preview.assetId,
      'Product template preview assetId',
      PRODUCT_TEMPLATE_MAX_PREVIEW_ASSET_ID_CHARS,
    )!;
    preview = { kind: 'bundled', assetId };
  }

  const normalized: ProductTemplatePresentation = {
    ...(parameterOrder ? { parameterOrder } : {}),
    ...(groups ? { groups } : {}),
    ...(preview ? { preview } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return value;
}

export function normalizeBuiltinProductTemplate(
  value: unknown,
): BuiltinProductTemplate {
  if (!isRecord(value)) {
    throw new ProductTemplateError(
      'invalid_template',
      'Built-in product template must be an object.',
    );
  }

  if (
    typeof value.id !== 'string' ||
    !BUILTIN_PRODUCT_TEMPLATE_ID_PATTERN.test(value.id)
  ) {
    throw new ProductTemplateError(
      'invalid_id',
      `Built-in product template id must match ${BUILTIN_PRODUCT_TEMPLATE_ID_PATTERN}.`,
    );
  }
  if (!Number.isSafeInteger(value.version) || (value.version as number) < 1) {
    throw new ProductTemplateError(
      'invalid_version',
      'Built-in product template version must be a positive safe integer.',
    );
  }

  const name = normalizeText(
    value.name,
    'Product template name',
    BREP_PROJECT_MAX_NAME_CHARS,
  )!;
  const category = normalizeText(
    value.category,
    'Product template category',
    PRODUCT_TEMPLATE_MAX_CATEGORY_CHARS,
  )!;
  const description = normalizeText(
    value.description,
    'Product template description',
    BREP_PROJECT_MAX_DESCRIPTION_CHARS,
    false,
  );

  let source: ParametricProjectSource;
  try {
    source = normalizeParametricProjectSource(value.source);
  } catch (error) {
    throw new ProductTemplateError(
      'invalid_source',
      'Product template canonical source is invalid or unsupported.',
      error,
    );
  }
  if (source.kind !== 'brep') {
    throw new ProductTemplateError(
      'invalid_source',
      'Product template canonical source must have kind brep.',
    );
  }

  const parameterIds = new Set(
    source.source.parameters.map((parameter) => parameter.id),
  );
  const presentation = normalizePresentation(value.presentation, parameterIds);

  return deepFreeze({
    id: value.id,
    version: value.version as number,
    name,
    category,
    ...(description ? { description } : {}),
    source,
    ...(presentation ? { presentation } : {}),
  });
}

export function normalizeBuiltinProductTemplateCatalog(
  values: readonly unknown[],
): readonly BuiltinProductTemplate[] {
  const seen = new Set<string>();
  const normalized = values.map((value) => {
    const template = normalizeBuiltinProductTemplate(value);
    const key = `${template.id}@${template.version}`;
    if (seen.has(key)) {
      throw new ProductTemplateError(
        'duplicate_template_version',
        `Duplicate built-in product template version: ${key}.`,
      );
    }
    seen.add(key);
    return template;
  });

  normalized.sort(
    (left, right) =>
      left.id.localeCompare(right.id, 'en-US') ||
      left.version - right.version,
  );
  return deepFreeze(normalized);
}
