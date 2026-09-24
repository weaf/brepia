import { normalizeBrepProject, type BrepProject } from './brepProject.ts';
import {
  normalizeBrepTemplateDefinition,
  normalizeBrepTemplateRef,
  type BrepTemplateDefinition,
  type BrepTemplateRef,
} from './brepTemplate.ts';

export class BrepTemplateRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrepTemplateRegistryError';
  }
}

function templateKey(ref: BrepTemplateRef): string {
  return `${ref.id}@${ref.version}`;
}

export type BrepTemplateInstantiationOptions = Readonly<{
  projectIdFactory?: () => string;
}>;

function defaultProjectIdFactory(): string {
  return `project_${crypto.randomUUID().replaceAll('-', '_')}`;
}

export function instantiateBrepTemplateDefinition(
  definition: Readonly<BrepTemplateDefinition>,
  options: BrepTemplateInstantiationOptions = {},
): BrepProject {
  const projectId = (options.projectIdFactory ?? defaultProjectIdFactory)();
  if (projectId === definition.source.id) {
    throw new BrepTemplateRegistryError(
      'Instantiated BRep project id must differ from the template source project id.',
    );
  }

  return normalizeBrepProject({
    ...definition.source,
    id: projectId,
  });
}

export type BuiltinBrepTemplateRegistry = Readonly<{
  resolve(ref: BrepTemplateRef): Readonly<BrepTemplateDefinition>;
  instantiate(
    ref: BrepTemplateRef,
    options?: BrepTemplateInstantiationOptions,
  ): BrepProject;
  list(): readonly Readonly<BrepTemplateDefinition>[];
}>;

export function createBuiltinBrepTemplateRegistry(
  definitions: readonly unknown[],
): BuiltinBrepTemplateRegistry {
  const byKey = new Map<string, Readonly<BrepTemplateDefinition>>();

  for (const candidate of definitions) {
    const definition = normalizeBrepTemplateDefinition(candidate);
    const key = templateKey(definition);
    if (byKey.has(key)) {
      throw new BrepTemplateRegistryError(
        `Duplicate built-in BRep template version: ${key}.`,
      );
    }
    byKey.set(key, definition);
  }

  const ordered = Object.freeze(
    Array.from(byKey.values()).sort((left, right) => {
      const idOrder = left.id.localeCompare(right.id, 'en-US');
      return idOrder || left.version - right.version;
    }),
  );

  return Object.freeze({
    resolve(ref: BrepTemplateRef) {
      const normalized = normalizeBrepTemplateRef(ref);
      const key = templateKey(normalized);
      const definition = byKey.get(key);
      if (!definition) {
        throw new BrepTemplateRegistryError(
          `Built-in BRep template version not found: ${key}.`,
        );
      }
      return definition;
    },
    instantiate(
      ref: BrepTemplateRef,
      options: BrepTemplateInstantiationOptions = {},
    ) {
      const normalized = normalizeBrepTemplateRef(ref);
      const key = templateKey(normalized);
      const definition = byKey.get(key);
      if (!definition) {
        throw new BrepTemplateRegistryError(
          `Built-in BRep template version not found: ${key}.`,
        );
      }
      return instantiateBrepTemplateDefinition(definition, options);
    },
    list() {
      return ordered;
    },
  });
}

/**
 * C1 establishes the immutable repository-owned template foundation only.
 * Product Pack phases add reviewed built-in product definitions later.
 */
export const builtinBrepTemplates = createBuiltinBrepTemplateRegistry([]);
