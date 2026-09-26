import {
  normalizeBuiltinProductTemplateCatalog,
  type BuiltinProductTemplate,
} from './productTemplate.ts';
import { electricalCabinetV1 } from './productTemplates/electricalCabinetV1.ts';

export type BuiltinProductTemplateLookup = Readonly<{
  id: string;
  version: number;
}>;

export type BuiltinProductTemplateCatalog = Readonly<{
  templates: readonly BuiltinProductTemplate[];
  getExact(
    lookup: BuiltinProductTemplateLookup,
  ): BuiltinProductTemplate | undefined;
  requireExact(lookup: BuiltinProductTemplateLookup): BuiltinProductTemplate;
  getLatest(id: string): BuiltinProductTemplate | undefined;
  getVersions(id: string): readonly BuiltinProductTemplate[];
}>;

function templateKey(id: string, version: number): string {
  return `${id}@${version}`;
}

export function createBuiltinProductTemplateCatalog(
  values: readonly unknown[],
): BuiltinProductTemplateCatalog {
  const templates = normalizeBuiltinProductTemplateCatalog(values);
  const byKey = new Map<string, BuiltinProductTemplate>();
  const byId = new Map<string, BuiltinProductTemplate[]>();

  for (const template of templates) {
    byKey.set(templateKey(template.id, template.version), template);
    const family = byId.get(template.id) ?? [];
    family.push(template);
    byId.set(template.id, family);
  }

  for (const family of byId.values()) {
    family.sort((left, right) => left.version - right.version);
    Object.freeze(family);
  }

  const getExact = ({
    id,
    version,
  }: BuiltinProductTemplateLookup): BuiltinProductTemplate | undefined =>
    byKey.get(templateKey(id, version));

  return Object.freeze({
    templates,
    getExact,
    requireExact(lookup: BuiltinProductTemplateLookup) {
      const template = getExact(lookup);
      if (!template) {
        throw new Error(
          `Built-in product template not found: ${lookup.id}@${lookup.version}.`,
        );
      }
      return template;
    },
    getLatest(id: string) {
      const family = byId.get(id);
      return family?.[family.length - 1];
    },
    getVersions(id: string) {
      return byId.get(id) ?? Object.freeze([]);
    },
  });
}

/**
 * Repository-shipped product catalog.
 *
 * C1 establishes the catalog contract before Phase D adds real product-pack
 * definitions. Keep this empty until a product template is explicitly
 * authorized and accepted.
 */
export const BUILTIN_PRODUCT_TEMPLATES =
  normalizeBuiltinProductTemplateCatalog([electricalCabinetV1]);

export const builtinProductTemplateCatalog =
  createBuiltinProductTemplateCatalog(BUILTIN_PRODUCT_TEMPLATES);
