import { describe, expect, it } from 'vitest';
import { phaseOneCabinetProject } from '@shared/brepSamples';
import {
  BUILTIN_PRODUCT_TEMPLATES,
  builtinProductTemplateCatalog,
  createBuiltinProductTemplateCatalog,
} from '@shared/productTemplateCatalog';

function fixture(version: number) {
  return {
    id: 'builtin:catalog-fixture',
    version,
    name: `Catalog fixture v${version}`,
    category: 'Test fixtures',
    source: {
      kind: 'brep',
      source: phaseOneCabinetProject,
    },
  };
}

describe('repository built-in product template catalog', () => {
  it('resolves only an explicitly requested immutable template version', () => {
    const catalog = createBuiltinProductTemplateCatalog([
      fixture(3),
      fixture(1),
    ]);

    expect(catalog.getExact({ id: 'builtin:catalog-fixture', version: 1 })?.version)
      .toBe(1);
    expect(catalog.getExact({ id: 'builtin:catalog-fixture', version: 3 })?.version)
      .toBe(3);
    expect(
      catalog.getExact({ id: 'builtin:catalog-fixture', version: 2 }),
    ).toBeUndefined();
  });

  it('keeps latest-version resolution explicit and separate from exact lookup', () => {
    const catalog = createBuiltinProductTemplateCatalog([
      fixture(3),
      fixture(1),
      fixture(2),
    ]);

    expect(catalog.getLatest('builtin:catalog-fixture')?.version).toBe(3);
    expect(
      catalog.getVersions('builtin:catalog-fixture').map(
        (template) => template.version,
      ),
    ).toEqual([1, 2, 3]);
    expect(catalog.getLatest('builtin:missing')).toBeUndefined();
  });

  it('requires an exact version without falling back to latest', () => {
    const catalog = createBuiltinProductTemplateCatalog([fixture(4)]);

    expect(() =>
      catalog.requireExact({ id: 'builtin:catalog-fixture', version: 3 }),
    ).toThrow(/not found.*catalog-fixture@3/i);
    expect(
      catalog.requireExact({ id: 'builtin:catalog-fixture', version: 4 })
        .version,
    ).toBe(4);
  });

  it('exposes normalized immutable catalog entries', () => {
    const catalog = createBuiltinProductTemplateCatalog([fixture(2)]);

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(Object.isFrozen(catalog.templates)).toBe(true);
    expect(Object.isFrozen(catalog.templates[0])).toBe(true);
    expect(Object.isFrozen(catalog.getVersions('builtin:catalog-fixture'))).toBe(
      true,
    );
  });

  it('ships no product-pack template before Phase D authorizes one', () => {
    expect(BUILTIN_PRODUCT_TEMPLATES).toEqual([]);
    expect(builtinProductTemplateCatalog.templates).toEqual([]);
  });
});
