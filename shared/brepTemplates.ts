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

export type BuiltinBrepTemplateRegistry = {
  resolve(ref: BrepTemplateRef): Readonly<BrepTemplateDefinition>;
  list(): readonly Readonly<BrepTemplateDefinition>[];
};

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
    list() {
      return ordered;
    },
  });
}

/**
 * Product templates are intentionally not published during C1.1.
 * Later Product Pack phases add reviewed immutable definitions here.
 */
export const builtinBrepTemplates = createBuiltinBrepTemplateRegistry([]);
